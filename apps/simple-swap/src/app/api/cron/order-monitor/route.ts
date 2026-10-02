import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { TxMonitorClient } from '@repo/tx-monitor-client';
import { confirmOrder, failOrder, expireOrder } from '@/lib/orders/store';

// Environment variable for cron authentication
const CRON_SECRET = process.env.CRON_SECRET;

// Initialize tx-monitor client
const txMonitorClient = new TxMonitorClient();

interface SingleTransactionResult {
    txid: string;
    orderId: string;
    previousStatus: string;
    currentStatus: string;
    orderUpdated: boolean;
    error?: string;
}

interface CronOrderMonitorResult {
    ordersChecked: number;
    ordersUpdated: number;
    successfulTransactions: number;
    failedTransactions: number;
    stillPending: number;
    expiredOrders: number;
    expiredBy90Day: number;
    expiredByBroadcast: number;
    errors: string[];
    orderResults: SingleTransactionResult[];
}

/**
 * Get orders that need transaction monitoring
 * These are orders with broadcasted transactions that need status checking
 */
async function getOrdersNeedingMonitoring(): Promise<Array<{ uuid: string; order: any }>> {
    const orders = await kv.hgetall('orders') || {};
    const ordersToCheck = [];
    
    for (const [uuid, orderData] of Object.entries(orders)) {
        try {
            // KV returns stored JSON already parsed; older entries may still be strings
            const order = typeof orderData === 'string' ? JSON.parse(orderData) : orderData;

            // Only monitor orders with broadcasted transactions
            if (order.status === 'broadcasted' && order.txid) {
                ordersToCheck.push({ uuid, order });
            }
        } catch (error) {
            console.error(`[ORDER-MONITOR] Error parsing order ${uuid}:`, error);
        }
    }
    
    return ordersToCheck;
}

/**
 * Cron job that monitors transaction statuses for orders with broadcasted transactions
 * Runs every minute to check if broadcasted transactions have been confirmed or failed
 */
export async function GET(request: NextRequest) {
    console.log('[ORDER-MONITOR] Starting order transaction status check...');
    
    // Verify cron authorization
    const authHeader = request.headers.get('authorization');
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
        console.error('[ORDER-MONITOR] Unauthorized access attempt');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startTime = Date.now();
    const result: CronOrderMonitorResult = {
        ordersChecked: 0,
        ordersUpdated: 0,
        successfulTransactions: 0,
        failedTransactions: 0,
        stillPending: 0,
        expiredOrders: 0,
        expiredBy90Day: 0,
        expiredByBroadcast: 0,
        errors: [],
        orderResults: []
    };

    try {
        // Get all orders that need transaction monitoring
        const ordersToCheck = await getOrdersNeedingMonitoring();
        
        if (ordersToCheck.length === 0) {
            console.log('[ORDER-MONITOR] No orders need monitoring');
            return NextResponse.json({
                success: true,
                message: 'No orders to monitor',
                result,
                duration: Date.now() - startTime
            });
        }

        console.log(`[ORDER-MONITOR] Found ${ordersToCheck.length} orders to check`);
        result.ordersChecked = ordersToCheck.length;

        // Expiration constants: only applied to orders whose transaction never landed
        const BROADCASTED_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        const ABSOLUTE_MAX_AGE = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds
        const now = Date.now();

        // Check the chain first, so an order whose swap succeeded is never cancelled for age
        for (const { uuid, order } of ordersToCheck) {
            const orderAge = now - new Date(order.createdAt).getTime();
            // Orders broadcast before broadcastedAt existed only get the 90-day limit
            const sentAge = order.broadcastedAt ? now - new Date(order.broadcastedAt).getTime() : 0;

            try {
                console.log(`[ORDER-MONITOR] Checking transaction ${order.txid} for order ${uuid}`);

                const txStatus = await txMonitorClient.getTransactionStatus(order.txid!);

                const monitorResult: SingleTransactionResult = {
                    txid: order.txid!,
                    orderId: uuid,
                    previousStatus: order.status,
                    currentStatus: txStatus.status,
                    orderUpdated: false
                };

                if (txStatus.status === 'success') {
                    await confirmOrder(uuid, txStatus.blockHeight, txStatus.blockTime);
                    monitorResult.orderUpdated = true;
                    result.ordersUpdated++;
                    result.successfulTransactions++;
                    console.log(`[ORDER-MONITOR] ✅ Order ${uuid} confirmed on blockchain at block ${txStatus.blockHeight}`);

                } else if (txStatus.status === 'abort_by_response' || txStatus.status === 'abort_by_post_condition') {
                    await failOrder(uuid, txStatus.status);
                    monitorResult.orderUpdated = true;
                    result.ordersUpdated++;
                    result.failedTransactions++;
                    console.log(`[ORDER-MONITOR] ❌ Order ${uuid} marked as 'failed' due to transaction failure ${order.txid} (${txStatus.status})`);

                } else if (orderAge > ABSOLUTE_MAX_AGE || sentAge > BROADCASTED_MAX_AGE) {
                    const is90Day = orderAge > ABSOLUTE_MAX_AGE;
                    await expireOrder(uuid);
                    monitorResult.orderUpdated = true;
                    monitorResult.error = `Order cancelled: transaction ${txStatus.status} after ${Math.round(orderAge / (60 * 60 * 1000))} hours`;
                    result.ordersUpdated++;
                    result.expiredOrders++;
                    if (is90Day) result.expiredBy90Day++; else result.expiredByBroadcast++;
                    console.log(`[ORDER-MONITOR] 🕐 Order ${uuid} cancelled: ${monitorResult.error}`);

                } else if (txStatus.status === 'not_found') {
                    await expireOrder(uuid);
                    monitorResult.orderUpdated = true;
                    result.ordersUpdated++;
                    result.failedTransactions++;
                    console.log(`[ORDER-MONITOR] 🚨 Order ${uuid} cancelled due to transaction not found: ${order.txid}`);

                } else {
                    result.stillPending++;
                    console.log(`[ORDER-MONITOR] ⏳ Order ${uuid} transaction ${order.txid} still pending`);
                }

                result.orderResults.push(monitorResult);

            } catch (txError) {
                console.error(`[ORDER-MONITOR] Error monitoring order ${uuid}:`, txError);
                result.errors.push(`Error monitoring order ${uuid}: ${txError}`);
            }
        }

        const duration = Date.now() - startTime;
        
        // Save last check time for admin dashboard
        await kv.set('monitoring:order_last_check', new Date().toISOString());
        
        console.log(`[ORDER-MONITOR] Completed in ${duration}ms:`, {
            ordersChecked: result.ordersChecked,
            ordersUpdated: result.ordersUpdated,
            successfulTransactions: result.successfulTransactions,
            failedTransactions: result.failedTransactions,
            stillPending: result.stillPending,
            expiredOrders: result.expiredOrders,
            expiredBy90Day: result.expiredBy90Day,
            expiredByBroadcast: result.expiredByBroadcast,
            errors: result.errors.length
        });

        return NextResponse.json({
            success: true,
            message: 'Order monitoring completed',
            result,
            duration
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error('[ORDER-MONITOR] Fatal error during order monitoring:', error);
        
        return NextResponse.json({
            success: false,
            error: 'Order monitoring failed',
            message: error instanceof Error ? error.message : 'Unknown error',
            result,
            duration
        }, { status: 500 });
    }
}
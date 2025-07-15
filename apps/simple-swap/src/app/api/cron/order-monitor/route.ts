import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { TxMonitorClient } from '@repo/tx-monitor-client';
import { confirmOrder, failOrder, cancelOrder } from '@/lib/orders/store';

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
        if (typeof orderData === 'string') {
            try {
                const order = JSON.parse(orderData);
                
                // Only monitor orders with broadcasted transactions
                if (order.status === 'broadcasted' && order.txid) {
                    ordersToCheck.push({ uuid, order });
                }
            } catch (error) {
                console.error(`[ORDER-MONITOR] Error parsing order ${uuid}:`, error);
            }
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

        // Expiration constants
        const BROADCASTED_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        const ABSOLUTE_MAX_AGE = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds
        const now = Date.now();
        
        // First pass: Check for orders that have exceeded 90-day absolute maximum
        for (const { uuid, order } of ordersToCheck) {
            const orderAge = now - new Date(order.createdAt).getTime();
            
            if (orderAge > ABSOLUTE_MAX_AGE) {
                const ageDays = Math.round(orderAge / (24 * 60 * 60 * 1000));
                console.log(`[ORDER-MONITOR] 📅 Order ${uuid} exceeded 90-day maximum (${ageDays} days old) - cancelling due to absolute age limit`);
                
                try {
                    await cancelOrder(uuid);
                    result.expiredOrders++;
                    result.expiredBy90Day++;
                    result.ordersUpdated++;
                    
                    // Create a result entry for the expired order
                    const expiredResult: SingleTransactionResult = {
                        txid: order.txid || 'N/A',
                        orderId: uuid,
                        previousStatus: order.status,
                        currentStatus: 'not_found',
                        orderUpdated: true,
                        error: `Order cancelled due to 90-day age limit: ${ageDays} days old`
                    };
                    result.orderResults.push(expiredResult);
                    
                } catch (error) {
                    console.error(`[ORDER-MONITOR] Error cancelling 90-day expired order ${uuid}:`, error);
                    result.errors.push(`Error cancelling 90-day expired order ${uuid}: ${error}`);
                }
            }
        }

        // Second pass: Check for broadcasted orders that have exceeded 24-hour limit
        for (const { uuid, order } of ordersToCheck) {
            const orderAge = now - new Date(order.createdAt).getTime();
            
            // Skip if already processed in 90-day cleanup
            if (orderAge > ABSOLUTE_MAX_AGE) {
                continue;
            }
            
            // Only check 24-hour limit for broadcasted orders
            if (order.status === 'broadcasted' && orderAge > BROADCASTED_MAX_AGE) {
                console.log(`[ORDER-MONITOR] 🕐 Order ${uuid} has been broadcasted for ${Math.round(orderAge / (60 * 60 * 1000))} hours - cancelling due to broadcast timeout`);
                
                try {
                    await cancelOrder(uuid);
                    result.expiredOrders++;
                    result.expiredByBroadcast++;
                    result.ordersUpdated++;
                    
                    // Create a result entry for the expired order
                    const expiredResult: SingleTransactionResult = {
                        txid: order.txid!,
                        orderId: uuid,
                        previousStatus: order.status,
                        currentStatus: 'not_found',
                        orderUpdated: true,
                        error: `Order cancelled due to broadcast timeout: ${Math.round(orderAge / (60 * 60 * 1000))} hours old`
                    };
                    result.orderResults.push(expiredResult);
                    
                } catch (error) {
                    console.error(`[ORDER-MONITOR] Error cancelling broadcast-expired order ${uuid}:`, error);
                    result.errors.push(`Error cancelling broadcast-expired order ${uuid}: ${error}`);
                }
            }
        }

        // Monitor each order's transaction using tx-monitor-client
        for (const { uuid, order } of ordersToCheck) {
            // Skip if order was already processed as expired (either 90-day or 24-hour)
            const orderAge = now - new Date(order.createdAt).getTime();
            if (orderAge > ABSOLUTE_MAX_AGE || (order.status === 'broadcasted' && orderAge > BROADCASTED_MAX_AGE)) {
                continue; // Already processed in the expiration loops
            }
            
            try {
                console.log(`[ORDER-MONITOR] Checking transaction ${order.txid} for order ${uuid}`);
                
                // Use tx-monitor-client to get transaction status
                const txStatus = await txMonitorClient.getTransactionStatus(order.txid!);
                
                const monitorResult: SingleTransactionResult = {
                    txid: order.txid!,
                    orderId: uuid,
                    previousStatus: order.status,
                    currentStatus: txStatus.status,
                    orderUpdated: false
                };

                // Update order based on transaction status
                if (txStatus.status === 'success') {
                    // Transaction confirmed - update to 'confirmed' status
                    await confirmOrder(uuid, txStatus.blockHeight, txStatus.blockTime);
                    monitorResult.orderUpdated = true;
                    result.ordersUpdated++;
                    result.successfulTransactions++;
                    
                    console.log(`[ORDER-MONITOR] ✅ Order ${uuid} confirmed on blockchain at block ${txStatus.blockHeight}`);
                    
                    // Trigger system-wide balance refresh after successful transaction
                    try {
                        const response = await fetch('/api/blaze/balances', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                userId: order.owner
                            })
                        });

                        if (response.ok) {
                            console.log(`[ORDER-MONITOR] ✅ System-wide balance refresh triggered by order ${uuid} (owner: ${order.owner})`);
                        } else {
                            console.warn(`[ORDER-MONITOR] ⚠️ Balance refresh failed for order ${uuid}: HTTP ${response.status}`);
                        }
                    } catch (balanceError) {
                        console.error(`[ORDER-MONITOR] ❌ Error triggering balance refresh for order ${uuid}:`, balanceError);
                    }
                    
                } else if (txStatus.status === 'abort_by_response' || txStatus.status === 'abort_by_post_condition') {
                    // Transaction failed - update to 'failed' status
                    await failOrder(uuid, txStatus.status);
                    monitorResult.orderUpdated = true;
                    result.ordersUpdated++;
                    result.failedTransactions++;
                    
                    console.log(`[ORDER-MONITOR] ❌ Order ${uuid} marked as 'failed' due to transaction failure ${order.txid} (${txStatus.status})`);
                    
                } else if (txStatus.status === 'not_found') {
                    // Transaction not found - cancel order
                    await cancelOrder(uuid);
                    monitorResult.orderUpdated = true;
                    result.ordersUpdated++;
                    result.failedTransactions++;
                    
                    console.log(`[ORDER-MONITOR] 🚨 Order ${uuid} cancelled due to transaction not found: ${order.txid}`);
                    
                } else if (txStatus.status === 'pending' || txStatus.status === 'broadcasted') {
                    // Still pending
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
import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { 
    getOrdersNeedingMonitoring, 
    monitorOrderTransaction,
    type TransactionMonitorResult as SingleTransactionResult
} from '@/lib/transaction-monitor';
import { 
    monitorAllBotActivities,
    type BotActivityMonitorResult
} from '@/lib/bot-activity-monitor';

// Environment variable for cron authentication
const CRON_SECRET = process.env.CRON_SECRET;

interface CronTransactionMonitorResult {
    ordersChecked: number;
    ordersUpdated: number;
    botActivitiesChecked: number;
    botActivitiesUpdated: number;
    successfulTransactions: number;
    failedTransactions: number;
    stillPending: number;
    errors: string[];
    orderResults: SingleTransactionResult[];
    botActivityResults: BotActivityMonitorResult[];
}

/**
 * Cron job that monitors transaction statuses for filled orders
 * Runs every minute to check if broadcasted transactions have been confirmed or failed
 */
export async function GET(request: NextRequest) {
    console.log('[TRANSACTION-MONITOR] Starting transaction status check...');
    
    // Verify cron authorization
    const authHeader = request.headers.get('authorization');
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
        console.error('[TRANSACTION-MONITOR] Unauthorized access attempt');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startTime = Date.now();
    const result: CronTransactionMonitorResult = {
        ordersChecked: 0,
        ordersUpdated: 0,
        botActivitiesChecked: 0,
        botActivitiesUpdated: 0,
        successfulTransactions: 0,
        failedTransactions: 0,
        stillPending: 0,
        errors: [],
        orderResults: [],
        botActivityResults: []
    };

    try {
        // Get all orders that need transaction monitoring
        const ordersToCheck = await getOrdersNeedingMonitoring();
        
        // Monitor bot activities as well
        console.log('[TRANSACTION-MONITOR] Monitoring bot activities...');
        const botActivityResult = await monitorAllBotActivities();
        result.botActivitiesChecked = botActivityResult.activitiesChecked;
        result.botActivitiesUpdated = botActivityResult.activitiesUpdated;
        result.successfulTransactions += botActivityResult.successfulTransactions;
        result.failedTransactions += botActivityResult.failedTransactions;
        result.stillPending += botActivityResult.stillPending;
        result.errors.push(...botActivityResult.errors);
        result.botActivityResults = botActivityResult.results;

        if (ordersToCheck.length === 0 && botActivityResult.activitiesChecked === 0) {
            console.log('[TRANSACTION-MONITOR] No orders or bot activities need monitoring');
            return NextResponse.json({
                success: true,
                message: 'No transactions to monitor',
                result,
                duration: Date.now() - startTime
            });
        }

        console.log(`[TRANSACTION-MONITOR] Found ${ordersToCheck.length} orders to check`);
        result.ordersChecked = ordersToCheck.length;

        // Monitor each order's transaction
        for (const { uuid, order } of ordersToCheck) {
            try {
                console.log(`[TRANSACTION-MONITOR] Checking transaction ${order.txid} for order ${uuid}`);
                
                const monitorResult = await monitorOrderTransaction(uuid, order);
                result.orderResults.push(monitorResult);
                
                if (monitorResult.error) {
                    result.errors.push(`Order ${uuid}: ${monitorResult.error}`);
                } else {
                    // Count status changes
                    if (monitorResult.currentStatus === 'success') {
                        result.successfulTransactions++;
                    } else if (monitorResult.currentStatus === 'abort_by_response' || monitorResult.currentStatus === 'abort_by_post_condition') {
                        result.failedTransactions++;
                        if (monitorResult.orderUpdated) {
                            result.ordersUpdated++;
                        }
                    } else if (monitorResult.currentStatus === 'pending') {
                        result.stillPending++;
                    }
                }
                
            } catch (txError) {
                console.error(`[TRANSACTION-MONITOR] Error monitoring order ${uuid}:`, txError);
                result.errors.push(`Error monitoring order ${uuid}: ${txError}`);
            }
        }

        const duration = Date.now() - startTime;
        
        // Save last check time for admin dashboard
        await kv.set('monitoring:last_check', new Date().toISOString());
        
        console.log(`[TRANSACTION-MONITOR] Completed in ${duration}ms:`, {
            ordersChecked: result.ordersChecked,
            ordersUpdated: result.ordersUpdated,
            botActivitiesChecked: result.botActivitiesChecked,
            botActivitiesUpdated: result.botActivitiesUpdated,
            successfulTransactions: result.successfulTransactions,
            failedTransactions: result.failedTransactions,
            stillPending: result.stillPending,
            errors: result.errors.length
        });

        return NextResponse.json({
            success: true,
            message: 'Transaction monitoring completed',
            result,
            duration
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error('[TRANSACTION-MONITOR] Fatal error during transaction monitoring:', error);
        
        return NextResponse.json({
            success: false,
            error: 'Transaction monitoring failed',
            message: error instanceof Error ? error.message : 'Unknown error',
            result,
            duration
        }, { status: 500 });
    }
}
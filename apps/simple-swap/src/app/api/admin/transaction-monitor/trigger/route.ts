import { NextRequest, NextResponse } from 'next/server';
import { 
    getOrdersNeedingMonitoring, 
    monitorOrderTransaction,
    type TransactionMonitorResult as SingleTransactionResult
} from '@/lib/transaction-monitor';

interface ManualTransactionMonitorResult {
    ordersChecked: number;
    ordersUpdated: number;
    successfulTransactions: number;
    failedTransactions: number;
    stillPending: number;
    errors: string[];
    results: SingleTransactionResult[];
}

/**
 * Admin endpoint to manually trigger transaction monitoring
 * POST /api/admin/transaction-monitor/trigger
 */
export async function POST(request: NextRequest) {
    console.log('[TX-MONITOR-MANUAL] Starting manual transaction status check...');
    
    const startTime = Date.now();
    const result: ManualTransactionMonitorResult = {
        ordersChecked: 0,
        ordersUpdated: 0,
        successfulTransactions: 0,
        failedTransactions: 0,
        stillPending: 0,
        errors: [],
        results: []
    };

    try {
        // Get all orders that need transaction monitoring
        const ordersToCheck = await getOrdersNeedingMonitoring();
        
        if (ordersToCheck.length === 0) {
            console.log('[TX-MONITOR-MANUAL] No orders need monitoring');
            return NextResponse.json({
                success: true,
                message: 'No orders to monitor',
                result,
                duration: Date.now() - startTime
            });
        }

        console.log(`[TX-MONITOR-MANUAL] Found ${ordersToCheck.length} orders to check`);
        result.ordersChecked = ordersToCheck.length;

        // Monitor each order's transaction
        for (const { uuid, order } of ordersToCheck) {
            try {
                console.log(`[TX-MONITOR-MANUAL] Checking transaction ${order.txid} for order ${uuid}`);
                
                const monitorResult = await monitorOrderTransaction(uuid, order);
                result.results.push(monitorResult);
                
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
                console.error(`[TX-MONITOR-MANUAL] Error monitoring order ${uuid}:`, txError);
                result.errors.push(`Error monitoring order ${uuid}: ${txError}`);
            }
        }

        const duration = Date.now() - startTime;
        
        console.log(`[TX-MONITOR-MANUAL] Completed in ${duration}ms:`, {
            ordersChecked: result.ordersChecked,
            ordersUpdated: result.ordersUpdated,
            successfulTransactions: result.successfulTransactions,
            failedTransactions: result.failedTransactions,
            stillPending: result.stillPending,
            errors: result.errors.length
        });

        return NextResponse.json({
            success: true,
            message: 'Manual transaction monitoring completed',
            result,
            duration
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error('[TX-MONITOR-MANUAL] Fatal error during manual transaction monitoring:', error);
        
        return NextResponse.json({
            success: false,
            error: 'Manual transaction monitoring failed',
            message: error instanceof Error ? error.message : 'Unknown error',
            result,
            duration
        }, { status: 500 });
    }
}
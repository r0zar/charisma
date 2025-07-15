import { NextRequest, NextResponse } from 'next/server';
import { getQueuedTransactions, checkTransactionStatus, setCachedStatus, removeFromQueue, cleanupOldTransactions, storeMetricsSnapshot, updateLastCronRun, getCachedStatus } from '@/lib/transaction-monitor';
import { handleTransactionStatusUpdate, retryFailedNotifications } from '@/lib/activity-integration';
import type { TransactionInfo, CronMonitorResult } from '@/lib/types';

// Environment variable for cron authentication
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Cron job that monitors transaction statuses for all queued transactions
 * Runs every minute to check if transactions have been confirmed or failed
 * GET /api/cron/monitor
 */
export async function GET(request: NextRequest) {
    console.log('[TX-MONITOR-CRON] Starting transaction monitoring...');
    
    // Verify cron authorization
    const authHeader = request.headers.get('authorization');
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
        console.error('[TX-MONITOR-CRON] Unauthorized access attempt');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const startTime = Date.now();
    const result: CronMonitorResult = {
        processed: 0,
        updated: 0,
        removed: 0,
        errors: [],
        duration: 0
    };
    
    try {
        // Clean up old transactions first
        const cleanedUp = await cleanupOldTransactions();
        if (cleanedUp.length > 0) {
            console.log(`[TX-MONITOR-CRON] Cleaned up ${cleanedUp.length} old transactions`);
        }
        
        // Retry failed activity notifications
        await retryFailedNotifications();
        
        // Get all transactions that need monitoring
        const txids = await getQueuedTransactions();
        
        if (txids.length === 0) {
            console.log('[TX-MONITOR-CRON] No transactions need monitoring');
            return NextResponse.json({
                success: true,
                message: 'No transactions to monitor',
                result: {
                    ...result,
                    duration: Date.now() - startTime
                }
            });
        }
        
        console.log(`[TX-MONITOR-CRON] Found ${txids.length} transactions to check`);
        
        const toRemove: string[] = [];
        
        // Monitor each transaction
        for (const txid of txids) {
            try {
                result.processed++;
                
                console.log(`[TX-MONITOR-CRON] Checking transaction ${txid}`);
                
                // Get previous status for activity integration
                const previousInfo = await getCachedStatus(txid);
                const previousStatus = previousInfo?.status || 'pending';
                
                const txResult = await checkTransactionStatus(txid);
                
                const info: TransactionInfo = {
                    txid,
                    status: txResult.status,
                    blockHeight: txResult.blockHeight,
                    blockTime: txResult.blockTime,
                    addedAt: Date.now(),
                    lastChecked: Date.now(),
                    checkCount: 1
                };
                
                await setCachedStatus(txid, info);
                result.updated++;
                
                // Notify activity system if status changed
                if (previousStatus !== txResult.status) {
                    await handleTransactionStatusUpdate(txid, previousStatus, txResult.status);
                }
                
                // If transaction is confirmed or failed, remove from queue
                if (txResult.status === 'success' || txResult.status === 'abort_by_response' || txResult.status === 'abort_by_post_condition') {
                    toRemove.push(txid);
                    console.log(`[TX-MONITOR-CRON] Transaction ${txid} completed with status: ${txResult.status}`);
                } else {
                    console.log(`[TX-MONITOR-CRON] Transaction ${txid} still pending`);
                }
                
            } catch (error) {
                const errorMsg = `Error monitoring transaction ${txid}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                console.error(`[TX-MONITOR-CRON] ${errorMsg}`);
                result.errors.push(errorMsg);
            }
        }
        
        // Remove completed transactions from queue
        if (toRemove.length > 0) {
            await removeFromQueue(toRemove);
            result.removed = toRemove.length;
        }
        
        result.duration = Date.now() - startTime;
        
        // Store metrics snapshot for historical tracking
        await storeMetricsSnapshot();
        
        // Update last cron run timestamp
        await updateLastCronRun();
        
        console.log(`[TX-MONITOR-CRON] Monitoring completed in ${result.duration}ms: processed=${result.processed}, updated=${result.updated}, removed=${result.removed}, errors=${result.errors.length}`);
        
        return NextResponse.json({
            success: true,
            message: 'Transaction monitoring completed',
            result
        });
        
    } catch (error) {
        result.duration = Date.now() - startTime;
        console.error('[TX-MONITOR-CRON] Fatal error during transaction monitoring:', error);
        
        return NextResponse.json({
            success: false,
            error: 'Transaction monitoring failed',
            message: error instanceof Error ? error.message : 'Unknown error',
            result
        }, { status: 500 });
    }
}
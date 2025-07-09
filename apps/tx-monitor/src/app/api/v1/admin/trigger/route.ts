import { NextRequest, NextResponse } from 'next/server';
import { getQueuedTransactions, realTimeCheck, removeFromQueue } from '@/lib/transaction-monitor';
import type { TransactionInfo } from '@/lib/types';

/**
 * Manually trigger transaction monitoring for all queued transactions
 * POST /api/v1/admin/trigger
 */
export async function POST(request: NextRequest) {
    const startTime = Date.now();
    
    try {
        console.log('[TX-MONITOR-ADMIN] Starting manual transaction monitoring...');
        
        const txids = await getQueuedTransactions();
        
        if (txids.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No transactions to monitor',
                result: {
                    processed: 0,
                    updated: 0,
                    removed: 0,
                    errors: [],
                    duration: Date.now() - startTime
                }
            });
        }
        
        console.log(`[TX-MONITOR-ADMIN] Found ${txids.length} transactions to check`);
        
        let processed = 0;
        let updated = 0;
        let removed = 0;
        const errors: string[] = [];
        const toRemove: string[] = [];
        
        for (const txid of txids) {
            try {
                processed++;
                
                console.log(`[TX-MONITOR-ADMIN] Starting real-time check for transaction ${txid}`);
                
                // Use realTimeCheck which includes 30-second timeout and proper error handling
                const result = await realTimeCheck(txid);
                updated++;
                
                // If transaction is confirmed or failed, remove from queue
                if (result.status === 'success' || result.status === 'abort_by_response' || result.status === 'abort_by_post_condition') {
                    toRemove.push(txid);
                    console.log(`[TX-MONITOR-ADMIN] Transaction ${txid} completed with status: ${result.status}`);
                } else if (result.status === 'pending') {
                    console.log(`[TX-MONITOR-ADMIN] Transaction ${txid} still pending, added to queue for monitoring`);
                } else {
                    console.log(`[TX-MONITOR-ADMIN] Transaction ${txid} has status: ${result.status}`);
                }
                
            } catch (error) {
                const errorMsg = `Error checking transaction ${txid}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                console.error(`[TX-MONITOR-ADMIN] ${errorMsg}`);
                errors.push(errorMsg);
                
                // If it's a "not found" error, remove from queue
                if (error instanceof Error && error.message.includes('not found on blockchain')) {
                    toRemove.push(txid);
                    console.log(`[TX-MONITOR-ADMIN] Removing invalid transaction ${txid} from queue`);
                }
            }
        }
        
        // Remove completed transactions from queue
        if (toRemove.length > 0) {
            await removeFromQueue(toRemove);
            removed = toRemove.length;
        }
        
        const duration = Date.now() - startTime;
        
        console.log(`[TX-MONITOR-ADMIN] Manual monitoring completed in ${duration}ms: processed=${processed}, updated=${updated}, removed=${removed}, errors=${errors.length}`);
        
        return NextResponse.json({
            success: true,
            message: 'Manual transaction monitoring completed',
            result: {
                processed,
                updated,
                removed,
                errors,
                duration
            }
        });
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error('[TX-MONITOR-ADMIN] Error in manual monitoring:', error);
        
        return NextResponse.json({
            success: false,
            error: 'Manual transaction monitoring failed',
            message: error instanceof Error ? error.message : 'Unknown error',
            duration
        }, { status: 500 });
    }
}
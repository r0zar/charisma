import { NextRequest, NextResponse } from 'next/server';
import { getQueuedTransactions, getCachedStatus } from '@/lib/transaction-monitor';
import { kv } from '@vercel/kv';

/**
 * Get current queue with transaction details
 * GET /api/v1/admin/queue
 */
export async function GET(_request: NextRequest) {
    try {
        console.log('[TX-MONITOR-ADMIN] Fetching current queue');
        
        const txids = await getQueuedTransactions();
        
        const queue = [];
        
        for (const txid of txids) {
            const cached = await getCachedStatus(txid);
            const addedAt = await kv.get(`tx:added:${txid}`);
            
            queue.push({
                txid,
                status: cached?.status || 'pending',
                blockHeight: cached?.blockHeight,
                blockTime: cached?.blockTime,
                addedAt: typeof addedAt === 'number' ? addedAt : Date.now(),
                lastChecked: cached?.lastChecked,
                checkCount: cached?.checkCount || 0
            });
        }
        
        // Sort by addedAt (oldest first)
        queue.sort((a, b) => a.addedAt - b.addedAt);
        
        return NextResponse.json({
            success: true,
            data: {
                queue,
                total: queue.length
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('[TX-MONITOR-ADMIN] Error fetching queue:', error);
        
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch queue',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
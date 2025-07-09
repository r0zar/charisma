import { NextRequest, NextResponse } from 'next/server';
import { addToQueue } from '@/lib/transaction-monitor';
import { getQueueAddCacheHeaders } from '@/lib/http-cache';
import type { QueueAddRequest } from '@/lib/types';

/**
 * Add one or more transaction IDs to the monitoring queue
 * POST /api/v1/queue/add
 */
export async function POST(request: NextRequest) {
    try {
        const body: QueueAddRequest = await request.json();
        
        if (!body.txids || !Array.isArray(body.txids)) {
            return NextResponse.json({
                success: false,
                error: 'Invalid request: txids array is required'
            }, { status: 400 });
        }
        
        if (body.txids.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Invalid request: at least one txid is required'
            }, { status: 400 });
        }
        
        // Validate txids are strings
        for (const txid of body.txids) {
            if (typeof txid !== 'string' || !txid.trim()) {
                return NextResponse.json({
                    success: false,
                    error: 'Invalid request: all txids must be non-empty strings'
                }, { status: 400 });
            }
        }
        
        const result = await addToQueue(body.txids);
        
        console.log(`[TX-MONITOR-API] Added ${result.added.length} transactions to queue, ${result.alreadyMonitored.length} already monitored`);
        
        // Add no-cache headers for queue add endpoint
        const cacheHeaders = getQueueAddCacheHeaders();
        
        return NextResponse.json(result, {
            headers: cacheHeaders
        });
        
    } catch (error) {
        console.error('[TX-MONITOR-API] Error adding to queue:', error);
        
        return NextResponse.json({
            success: false,
            error: 'Failed to add transactions to queue',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
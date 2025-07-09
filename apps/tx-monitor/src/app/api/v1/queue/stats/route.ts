import { NextRequest, NextResponse } from 'next/server';
import { getQueueStats } from '@/lib/transaction-monitor';
import { getStatsCacheHeaders } from '@/lib/http-cache';

/**
 * Get queue statistics and health metrics
 * GET /api/v1/queue/stats
 */
export async function GET(request: NextRequest) {
    try {
        console.log('[TX-MONITOR-API] Fetching queue statistics');
        
        const stats = await getQueueStats();
        
        // Add cache headers for stats endpoint
        const cacheHeaders = getStatsCacheHeaders();
        
        return NextResponse.json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString()
        }, {
            headers: cacheHeaders
        });
        
    } catch (error) {
        console.error('[TX-MONITOR-API] Error fetching queue stats:', error);
        
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch queue statistics',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
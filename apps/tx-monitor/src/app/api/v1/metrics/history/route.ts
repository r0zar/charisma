import { NextRequest, NextResponse } from 'next/server';
import { getMetricsHistory } from '@/lib/transaction-monitor';
import { getStatsCacheHeaders } from '@/lib/http-cache';

/**
 * Get historical metrics for charts
 * GET /api/v1/metrics/history?hours=24
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const hours = Math.min(parseInt(searchParams.get('hours') || '24'), 168); // Max 7 days
        
        console.log(`[TX-MONITOR-API] Fetching metrics history for ${hours} hours`);
        
        const history = await getMetricsHistory(hours);
        
        // Add cache headers for metrics endpoint
        const cacheHeaders = getStatsCacheHeaders();
        
        return NextResponse.json({
            success: true,
            data: history,
            timestamp: new Date().toISOString()
        }, {
            headers: cacheHeaders
        });
        
    } catch (error) {
        console.error('[TX-MONITOR-API] Error fetching metrics history:', error);
        
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch metrics history',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
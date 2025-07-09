import { NextRequest, NextResponse } from 'next/server';
import { getLastCronRun, getQueueStats } from '@/lib/transaction-monitor';
import { kv } from '@vercel/kv';
import type { HealthCheckResponse } from '@/lib/types';

/**
 * Health check endpoint
 * GET /api/v1/health
 */
export async function GET(request: NextRequest) {
    try {
        const startTime = Date.now();
        
        console.log('[TX-MONITOR-API] Running health check');
        
        // Check KV connectivity
        let kvConnectivity = true;
        try {
            await kv.ping();
        } catch (error) {
            kvConnectivity = false;
        }
        
        // Get last cron run
        const lastCronRun = await getLastCronRun();
        const cronAge = lastCronRun ? Date.now() - lastCronRun : null;
        
        // Determine cron health
        let cronHealth: 'healthy' | 'warning' | 'error' = 'healthy';
        if (!lastCronRun) {
            cronHealth = 'error';
        } else if (cronAge && cronAge > 5 * 60 * 1000) { // 5 minutes
            cronHealth = 'warning';
        } else if (cronAge && cronAge > 10 * 60 * 1000) { // 10 minutes
            cronHealth = 'error';
        }
        
        // Check queue health
        const queueStats = await getQueueStats();
        let queueHealth: 'healthy' | 'warning' | 'error' = queueStats.processingHealth;
        
        // API health is healthy if we can respond
        const apiHealth: 'healthy' | 'warning' | 'error' = 'healthy';
        
        const health: HealthCheckResponse = {
            cron: cronHealth,
            api: apiHealth,
            queue: queueHealth,
            lastCronRun: lastCronRun || undefined,
            kvConnectivity,
            uptime: process.uptime() * 1000 // Convert to milliseconds
        };
        
        // Determine overall status code
        const hasError = cronHealth === 'error' || queueHealth === 'error' || !kvConnectivity;
        const statusCode = hasError ? 503 : 200;
        
        return NextResponse.json({
            success: !hasError,
            data: health,
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime
        }, { 
            status: statusCode,
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        
    } catch (error) {
        console.error('[TX-MONITOR-API] Error in health check:', error);
        
        return NextResponse.json({
            success: false,
            error: 'Health check failed',
            message: error instanceof Error ? error.message : 'Unknown error',
            data: {
                cron: 'error',
                api: 'error',
                queue: 'error',
                kvConnectivity: false,
                uptime: 0
            }
        }, { status: 503 });
    }
}
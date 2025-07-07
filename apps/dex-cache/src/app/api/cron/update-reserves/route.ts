import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { updateAllPoolReserves } from '@/lib/pool-service';

// Cache key for last successful run tracking
const LAST_RESERVE_UPDATE_KEY = 'last-reserve-update';
const MIN_UPDATE_INTERVAL_MS = 8 * 60 * 1000; // 8 minutes minimum between updates

export async function GET() {
    try {
        console.log('[Cron] Starting scheduled reserve update...');
        const startTime = Date.now();
        
        // Check if we've run recently to avoid excessive updates
        const lastRun = await kv.get<number>(LAST_RESERVE_UPDATE_KEY);
        if (lastRun && (startTime - lastRun) < MIN_UPDATE_INTERVAL_MS) {
            console.log(`[Cron] Skipping reserve update - last run was ${Math.round((startTime - lastRun) / 1000 / 60)} minutes ago`);
            return NextResponse.json({
                success: true,
                message: 'Reserve update skipped - too recent',
                data: { skipped: true, lastRun: new Date(lastRun).toISOString() }
            });
        }
        
        const result = await updateAllPoolReserves();
        
        // Update last run timestamp
        await kv.set(LAST_RESERVE_UPDATE_KEY, startTime);
        
        const duration = Date.now() - startTime;
        
        console.log(`[Cron] Reserve update completed in ${duration}ms: ${result.updated} updated, ${result.errors} errors`);
        
        return NextResponse.json({
            success: true,
            message: 'Reserve update completed',
            data: {
                updated: result.updated,
                errors: result.errors,
                durationMs: duration
            }
        });
        
    } catch (error) {
        console.error('[Cron] Reserve update failed:', error);
        
        return NextResponse.json({
            success: false,
            error: 'Reserve update failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
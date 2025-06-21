import { NextResponse } from 'next/server';
import { updateAllPoolReserves } from '@/lib/pool-service';

export async function GET() {
    try {
        console.log('[Cron] Starting scheduled reserve update...');
        const startTime = Date.now();
        
        const result = await updateAllPoolReserves();
        
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
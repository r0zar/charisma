import { NextRequest, NextResponse } from 'next/server';
import { processTwitterTriggers } from '@/lib/twitter-triggers/processor';

const CRON_SECRET = process.env.CRON_SECRET;

// POST /api/cron/twitter-triggers - Process Twitter triggers (cron job)
export async function GET(request: NextRequest) {
    try {
        // 1. Authorize the request
        const authHeader = request.headers.get('authorization');
        if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[Twitter Cron] Starting Twitter triggers processing job');

        const startTime = Date.now();
        const results = await processTwitterTriggers();
        const processingTime = Date.now() - startTime;

        console.log(`[Twitter Cron] Completed Twitter triggers processing in ${processingTime}ms`, results);

        return NextResponse.json({
            success: true,
            data: {
                ...results,
                processingTimeMs: processingTime,
                timestamp: new Date().toISOString(),
            },
            message: 'Twitter triggers processing completed'
        });

    } catch (error) {
        console.error('[Twitter Cron] Error in Twitter triggers processing:', error);
        return NextResponse.json({
            success: false,
            error: 'Twitter triggers processing failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
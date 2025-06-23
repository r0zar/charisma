import { NextRequest, NextResponse } from 'next/server';
import { processTwitterTriggers } from '@/lib/twitter-triggers/processor';
import { getTriggersToCheck } from '@/lib/twitter-triggers/store';

// POST /api/cron/twitter-triggers - Process Twitter triggers (cron job)
export async function POST(request: NextRequest) {
    try {
        // Temporarily disable auth for debugging Vercel cron issues
        // const cronToken = request.headers.get('authorization');
        // const expectedToken = process.env.CRON_SECRET;
        // 
        // if (expectedToken && !isVercelCron && cronToken !== `Bearer ${expectedToken}`) {
        //     return NextResponse.json({
        //         success: false,
        //         error: 'Unauthorized'
        //     }, { status: 401 });
        // }

        console.log('[Twitter Cron] Starting Twitter triggers processing job');
        // wait 2 seconds
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check if we have any triggers to process
        const triggersToCheck = await getTriggersToCheck();
        console.log(`[Twitter Cron] Found ${triggersToCheck.length} active triggers to process`);

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

// GET /api/cron/twitter-triggers - Get processing status (for monitoring)
export async function GET(request: NextRequest) {
    try {
        const { getTriggersToCheck } = await import('@/lib/twitter-triggers/store');
        const { listAllTwitterExecutions } = await import('@/lib/twitter-triggers/store');

        const activeTriggers = await getTriggersToCheck();
        const recentExecutions = await listAllTwitterExecutions(10);

        return NextResponse.json({
            success: true,
            data: {
                activeTriggers: activeTriggers.length,
                recentExecutions: recentExecutions.length,
                lastExecution: recentExecutions[0]?.executedAt || null,
                status: 'ready',
                timestamp: new Date().toISOString(),
            }
        });

    } catch (error) {
        console.error('[Twitter Cron] Error getting status:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to get Twitter triggers status'
        }, { status: 500 });
    }
}
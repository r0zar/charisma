import { listAllTwitterExecutions, listTwitterTriggers } from "@/lib/twitter-triggers/store";
import { NextRequest, NextResponse } from "next/server";

// GET /api/cron/twitter-triggers - Get processing status (for monitoring)
export async function GET(request: NextRequest) {
    try {
        const activeTriggers = await listTwitterTriggers();
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
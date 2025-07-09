import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { 
    monitorAllBotActivities,
    type BotActivityMonitorResult
} from '@/lib/bot-activity-monitor';

// Environment variable for cron authentication
const CRON_SECRET = process.env.CRON_SECRET;

interface CronBotMonitorResult {
    botActivitiesChecked: number;
    botActivitiesUpdated: number;
    successfulTransactions: number;
    failedTransactions: number;
    stillPending: number;
    errors: string[];
    botActivityResults: BotActivityMonitorResult[];
}

/**
 * Cron job that monitors bot activity transactions
 * Runs every minute to check if bot transactions have been confirmed or failed
 */
export async function GET(request: NextRequest) {
    console.log('[BOT-MONITOR] Starting bot activity monitoring...');
    
    // Verify cron authorization
    const authHeader = request.headers.get('authorization');
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
        console.error('[BOT-MONITOR] Unauthorized access attempt');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startTime = Date.now();
    const result: CronBotMonitorResult = {
        botActivitiesChecked: 0,
        botActivitiesUpdated: 0,
        successfulTransactions: 0,
        failedTransactions: 0,
        stillPending: 0,
        errors: [],
        botActivityResults: []
    };

    try {
        // Monitor bot activities
        console.log('[BOT-MONITOR] Monitoring bot activities...');
        const botActivityResult = await monitorAllBotActivities();
        
        result.botActivitiesChecked = botActivityResult.activitiesChecked;
        result.botActivitiesUpdated = botActivityResult.activitiesUpdated;
        result.successfulTransactions = botActivityResult.successfulTransactions;
        result.failedTransactions = botActivityResult.failedTransactions;
        result.stillPending = botActivityResult.stillPending;
        result.errors = botActivityResult.errors;
        result.botActivityResults = botActivityResult.results;

        const duration = Date.now() - startTime;
        
        // Save last check time for admin dashboard
        await kv.set('monitoring:bot_last_check', new Date().toISOString());
        
        console.log(`[BOT-MONITOR] Completed in ${duration}ms:`, {
            botActivitiesChecked: result.botActivitiesChecked,
            botActivitiesUpdated: result.botActivitiesUpdated,
            successfulTransactions: result.successfulTransactions,
            failedTransactions: result.failedTransactions,
            stillPending: result.stillPending,
            errors: result.errors.length
        });

        if (result.botActivitiesChecked === 0) {
            return NextResponse.json({
                success: true,
                message: 'No bot activities to monitor',
                result,
                duration
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Bot activity monitoring completed',
            result,
            duration
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error('[BOT-MONITOR] Fatal error during bot activity monitoring:', error);
        
        return NextResponse.json({
            success: false,
            error: 'Bot activity monitoring failed',
            message: error instanceof Error ? error.message : 'Unknown error',
            result,
            duration
        }, { status: 500 });
    }
}
import { type NextRequest, NextResponse } from 'next/server';

import { botService } from '@/lib/services/bots/core/service';
import { botExecutorService,botSchedulerService } from '@/lib/services/bots/execution';

/**
 * Cron job handler to execute scheduled bots
 * 
 * POST /api/cron/bot-executor
 * 
 * Runs every 5 minutes to check for bots that need execution.
 * Security: Requires CRON_SECRET header for authentication.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Security check
  if (!cronSecret) {
    console.error('[BotExecutor] CRON_SECRET environment variable is not set');
    return NextResponse.json({
      status: 'error',
      message: 'Server configuration error (missing cron secret)'
    }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[BotExecutor] Unauthorized cron job access attempt');
    return NextResponse.json({
      status: 'error',
      message: 'Unauthorized'
    }, { status: 401 });
  }

  const startTime = Date.now();
  console.log('[BotExecutor] Starting scheduled bot execution check...');

  try {
    // Set admin context for cron execution (no user session available)
    botService.setAdminContext('system-cron');
    
    // Load all bots using the bot service
    const allBots = await botService.listBots(); // Get all bots for cron execution

    // Use scheduler service to determine which bots need execution
    const schedulingResult = botSchedulerService.getBotsToExecute(allBots);

    console.log(`[BotExecutor] Found ${schedulingResult.totalScheduledBots} scheduled bots, ${schedulingResult.botsToExecute.length} need execution`);

    if (schedulingResult.totalScheduledBots === 0) {
      return NextResponse.json({
        status: 'success',
        message: 'No scheduled bots found',
        processedBots: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        executionTime: Date.now() - startTime
      });
    }

    if (schedulingResult.botsToExecute.length === 0) {
      return NextResponse.json({
        status: 'success',
        message: 'No bots due for execution',
        processedBots: schedulingResult.totalScheduledBots,
        successfulExecutions: 0,
        failedExecutions: 0,
        executionTime: Date.now() - startTime
      });
    }

    // Execute bots using executor service
    const executionResult = await botExecutorService.executeBots(
      schedulingResult.botsToExecute,
      {
        timeout: 2, // 2 minute timeout
        enableLogs: false, // Disable streaming logs for cron execution
        onStatus: (message) => {
          console.log(`[BotExecutor] ${message}`);
        },
        onLog: (level, message) => {
          console.log(`[BotExecutor] [${level}]: ${message}`);
        }
      }
    );

    const totalExecutionTime = Date.now() - startTime;
    console.log(`[BotExecutor] Completed execution. Success: ${executionResult.successfulExecutions}, Failed: ${executionResult.failedExecutions}, Time: ${totalExecutionTime}ms`);

    // Clear admin context
    botService.clearAdminContext();

    return NextResponse.json({
      status: 'success',
      message: `Executed ${executionResult.processedBots} bots`,
      processedBots: executionResult.processedBots,
      successfulExecutions: executionResult.successfulExecutions,
      failedExecutions: executionResult.failedExecutions,
      executions: executionResult.executions,
      executionTime: totalExecutionTime
    });

  } catch (error: any) {
    console.error('[BotExecutor] Fatal error during execution:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Clear admin context on error
    botService.clearAdminContext();

    return NextResponse.json({
      status: 'error',
      message: `Cron execution failed: ${errorMessage}`,
      executionTime: Date.now() - startTime
    }, { status: 500 });
  }
}


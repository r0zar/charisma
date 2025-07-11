import { CronExpressionParser } from 'cron-parser';
import { isBefore,parseISO } from 'date-fns';
import { type NextRequest, NextResponse } from 'next/server';

import { sandboxService } from '@/lib/features/sandbox/service';
import { loadAppStateConfigurableWithFallback } from '@/lib/infrastructure/data/loader.server';
import { botDataStore } from '@/lib/infrastructure/storage';
import { type Bot } from '@/schemas/bot.schema';

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
    // Load all bots from the app state
    const appState = await loadAppStateConfigurableWithFallback();
    const allBots = appState.bots.list;

    // Filter bots that are scheduled and active
    const scheduledBots = allBots.filter(bot =>
      bot.isScheduled &&
      bot.status === 'active' &&
      bot.cronSchedule
    );

    console.log(`[BotExecutor] Found ${scheduledBots.length} scheduled active bots`);

    if (scheduledBots.length === 0) {
      return NextResponse.json({
        status: 'success',
        message: 'No scheduled bots found',
        processedBots: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        executionTime: Date.now() - startTime
      });
    }

    // Check which bots need execution
    const currentTime = new Date();
    const botsToExecute: Bot[] = [];

    for (const bot of scheduledBots) {
      if (shouldExecuteBot(bot, currentTime)) {
        botsToExecute.push(bot);
      }
    }

    console.log(`[BotExecutor] ${botsToExecute.length} bots need execution`);

    if (botsToExecute.length === 0) {
      return NextResponse.json({
        status: 'success',
        message: 'No bots due for execution',
        processedBots: scheduledBots.length,
        successfulExecutions: 0,
        failedExecutions: 0,
        executionTime: Date.now() - startTime
      });
    }

    // Execute each bot
    const results = {
      processedBots: botsToExecute.length,
      successfulExecutions: 0,
      failedExecutions: 0,
      executions: [] as Array<{ botId: string; status: string; executionTime?: number; error?: string }>
    };

    for (const bot of botsToExecute) {
      const executionResult = await executeBotStrategy(bot);

      if (executionResult.success) {
        results.successfulExecutions++;
      } else {
        results.failedExecutions++;
      }

      results.executions.push({
        botId: bot.id,
        status: executionResult.success ? 'success' : 'failure',
        executionTime: executionResult.executionTime,
        error: executionResult.error
      });

      // Update bot's execution metadata and handle state transitions
      await updateBotExecutionMetadata(bot, executionResult.success);
    }

    const totalExecutionTime = Date.now() - startTime;
    console.log(`[BotExecutor] Completed execution. Success: ${results.successfulExecutions}, Failed: ${results.failedExecutions}, Time: ${totalExecutionTime}ms`);

    return NextResponse.json({
      status: 'success',
      message: `Executed ${results.processedBots} bots`,
      processedBots: results.processedBots,
      successfulExecutions: results.successfulExecutions,
      failedExecutions: results.failedExecutions,
      executions: results.executions,
      executionTime: totalExecutionTime
    });

  } catch (error: any) {
    console.error('[BotExecutor] Fatal error during execution:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json({
      status: 'error',
      message: `Cron execution failed: ${errorMessage}`,
      executionTime: Date.now() - startTime
    }, { status: 500 });
  }
}

/**
 * Determines if a bot should be executed based on its schedule
 */
function shouldExecuteBot(bot: Bot, currentTime: Date): boolean {
  if (!bot.cronSchedule) return false;

  try {
    // Parse the cron expression
    const interval = CronExpressionParser.parse(bot.cronSchedule);

    // If no last execution, check if it's time for the first execution
    if (!bot.lastExecution) {
      const nextScheduled = interval.next();
      return isBefore(nextScheduled.toDate(), currentTime);
    }

    // Get the next scheduled time after the last execution
    const lastExecution = parseISO(bot.lastExecution);
    // Reset interval to start from last execution time
    const intervalFromLast = CronExpressionParser.parse(bot.cronSchedule, {
      currentDate: lastExecution
    });
    const nextScheduled = intervalFromLast.next();

    // Execute if current time is past the next scheduled time
    return isBefore(nextScheduled.toDate(), currentTime);
  } catch (error) {
    console.error(`[BotExecutor] Invalid cron expression for bot ${bot.id}: ${bot.cronSchedule}`, error);
    return false;
  }
}

/**
 * Executes a single bot's strategy in the sandbox
 */
async function executeBotStrategy(bot: Bot): Promise<{
  success: boolean;
  executionTime?: number;
  error?: string;
  sandboxId?: string;
}> {
  const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[BotExecutor] Executing bot ${bot.id} (${bot.name}) - Execution ID: ${executionId}`);

  try {
    // Execute the bot's strategy using sandbox service
    const result = await sandboxService.executeStrategy(
      bot.strategy,
      bot,
      {
        timeout: 2, // 2 minute timeout
        enableLogs: false // Disable streaming logs for cron execution
      },
      {
        onStatus: (message) => {
          console.log(`[BotExecutor] ${bot.id}: ${message}`);
        },
        onLog: (level, message) => {
          console.log(`[BotExecutor] ${bot.id} [${level}]: ${message}`);
        }
      }
    );

    if (result.success) {
      console.log(`[BotExecutor] Bot ${bot.id} executed successfully in ${result.executionTime}ms`);
      return {
        success: true,
        executionTime: result.executionTime,
        sandboxId: result.sandboxId
      };
    } else {
      console.error(`[BotExecutor] Bot ${bot.id} execution failed:`, result.error);
      return {
        success: false,
        executionTime: result.executionTime,
        error: result.error,
        sandboxId: result.sandboxId
      };
    }

  } catch (error) {
    console.error(`[BotExecutor] Error executing bot ${bot.id}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown execution error'
    };
  }
}

/**
 * Updates bot's execution metadata after execution and handles state transitions
 */
async function updateBotExecutionMetadata(bot: Bot, success: boolean): Promise<void> {
  const now = new Date().toISOString();

  // Calculate next execution time
  let nextExecution: string | undefined;
  if (bot.cronSchedule) {
    try {
      const interval = CronExpressionParser.parse(bot.cronSchedule);
      const nextTime = interval.next()?.toISOString();
      nextExecution = nextTime || undefined;
    } catch (error) {
      console.error(`[BotExecutor] Failed to calculate next execution for bot ${bot.id}:`, error);
    }
  }

  const updateData: {
    lastExecution: string;
    nextExecution: string | undefined;
    executionCount: number;
    lastActive: string;
    status?: 'active' | 'paused' | 'error' | 'setup' | 'inactive';
  } = {
    lastExecution: now,
    nextExecution,
    executionCount: (bot.executionCount || 0) + 1,
    lastActive: now
  };

  console.log(`[BotExecutor] Updating bot ${bot.id} metadata:`, updateData);

  try {
    // Use bot's owner as user ID
    const userId = bot.ownerId;

    // If execution failed, transition bot to error state using state machine
    if (!success) {
      console.log(`[BotExecutor] Bot ${bot.id} execution failed, transitioning to error state`);

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/v1/bots/${bot.id}/transitions?userId=${encodeURIComponent(userId)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'error',
            reason: 'Scheduled execution failed'
          })
        });

        if (response.ok) {
          console.log(`[BotExecutor] Successfully transitioned bot ${bot.id} to error state`);
          // The state machine API handles the status update, so we don't need to update status here
        } else {
          console.error(`[BotExecutor] Failed to transition bot ${bot.id} to error state:`, await response.text());
          // Fall back to direct update if state machine fails
          updateData.status = 'error';
        }
      } catch (error) {
        console.error(`[BotExecutor] Error transitioning bot ${bot.id} to error state:`, error);
        // Fall back to direct update if state machine fails
        updateData.status = 'error';
      }
    }

    // Update bot with new execution metadata (status may have been updated by state machine)
    const updatedBot = {
      ...bot,
      ...updateData
    };

    await botDataStore.updateBot(userId, updatedBot);
    console.log(`[BotExecutor] Successfully updated bot ${bot.id} metadata`);
  } catch (error) {
    console.error(`[BotExecutor] Failed to update bot ${bot.id} metadata:`, error);
  }
}
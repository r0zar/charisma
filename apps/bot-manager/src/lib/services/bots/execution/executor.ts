/**
 * BotExecutorService - Handles bot execution and metadata updates
 * 
 * Provides services for executing bot strategies, updating execution metadata,
 * and handling execution state transitions without circular HTTP dependencies.
 */

import { executionDataStore } from '@/lib/modules/storage';
import { type Bot, type BotExecution } from '@/schemas/bot.schema';

import { botService } from '../core/service';
import { sandboxService } from '../sandbox/sandbox-service';
import { botSchedulerService } from './scheduler';

export interface ExecutionResult {
  success: boolean;
  executionTime?: number;
  error?: string;
  sandboxId?: string;
}

export interface ExecutionSummary {
  processedBots: number;
  successfulExecutions: number;
  failedExecutions: number;
  executions: ExecutionRecord[];
}

export interface ExecutionRecord {
  botId: string;
  botName: string;
  status: 'success' | 'failure';
  executionTime?: number;
  error?: string;
  sandboxId?: string;
}

export interface ExecutionOptions {
  timeout?: number; // Timeout in minutes
  enableLogs?: boolean;
  onStatus?: (message: string) => void;
  onLog?: (level: string, message: string) => void;
}

export class BotExecutorService {
  /**
   * Executes a single bot's strategy in the sandbox
   */
  async executeBotStrategy(
    bot: Bot,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const {
      timeout = 2, // 2 minute default timeout
      enableLogs = false,
      onStatus,
      onLog
    } = options;

    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const userId = bot.ownerId;
    const startTime = new Date().toISOString();

    try {
      console.log(`[BotExecutor] Executing bot ${bot.id} (${bot.name}) - Execution ID: ${executionId}`);

      // Create execution record for KV storage
      const executionRecord: BotExecution = {
        id: executionId,
        botId: bot.id,
        startedAt: startTime,
        status: 'pending'
      };

      // Store initial execution record
      await executionDataStore.storeExecution(executionRecord);

      // Execute the bot's strategy using sandbox service
      const result = await sandboxService.executeStrategy(
        bot.strategy,
        bot,
        {
          timeout,
          enableLogs
        },
        {
          onStatus: (message) => {
            console.log(`[BotExecutor] ${bot.id}: ${message}`);
            onStatus?.(message);
          },
          onLog: (level, message) => {
            console.log(`[BotExecutor] ${bot.id} [${level}]: ${message}`);
            onLog?.(level, message);
          }
        },
        userId, // Pass userId for blob storage
        executionId // Pass executionId for consistent tracking
      );

      // Update execution record with results
      const completedAt = new Date().toISOString();
      const updatedRecord: BotExecution = {
        ...executionRecord,
        completedAt,
        status: result.success ? 'success' : 'failure',
        executionTime: result.executionTime,
        sandboxId: result.sandboxId,
        logsUrl: result.logsUrl,
        logsSize: result.logsSize
      };

      if (result.success) {
        console.log(`[BotExecutor] Bot ${bot.id} executed successfully in ${result.executionTime}ms`);
        updatedRecord.output = result.result?.message || 'Execution completed successfully';
      } else {
        console.error(`[BotExecutor] Bot ${bot.id} execution failed:`, result.error);
        updatedRecord.error = result.error;
      }

      // Update execution record in KV storage
      await executionDataStore.updateExecution(updatedRecord);

      return {
        success: result.success,
        executionTime: result.executionTime,
        error: result.error,
        sandboxId: result.sandboxId
      };

    } catch (error) {
      console.error(`[BotExecutor] Error executing bot ${bot.id}:`, error);

      // Update execution record with error
      try {
        const errorRecord: BotExecution = {
          id: executionId,
          botId: bot.id,
          startedAt: startTime,
          completedAt: new Date().toISOString(),
          status: 'failure',
          error: error instanceof Error ? error.message : 'Unknown execution error'
        };
        await executionDataStore.updateExecution(errorRecord);
      } catch (storeError) {
        console.error(`[BotExecutor] Failed to store error execution record:`, storeError);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown execution error'
      };
    }
  }

  /**
   * Executes multiple bots and returns a summary
   */
  async executeBots(
    bots: Bot[],
    options: ExecutionOptions = {}
  ): Promise<ExecutionSummary> {
    const results: ExecutionSummary = {
      processedBots: bots.length,
      successfulExecutions: 0,
      failedExecutions: 0,
      executions: []
    };

    for (const bot of bots) {
      const executionResult = await this.executeBotStrategy(bot, options);

      if (executionResult.success) {
        results.successfulExecutions++;
      } else {
        results.failedExecutions++;
      }

      results.executions.push({
        botId: bot.id,
        botName: bot.name,
        status: executionResult.success ? 'success' : 'failure',
        executionTime: executionResult.executionTime,
        error: executionResult.error,
        sandboxId: executionResult.sandboxId
      });

      // Update bot's execution metadata after each execution
      await this.updateBotExecutionMetadata(bot, executionResult.success);
    }

    return results;
  }

  /**
   * Updates bot's execution metadata after execution and handles state transitions
   */
  async updateBotExecutionMetadata(bot: Bot, success: boolean): Promise<void> {
    const now = new Date().toISOString();

    // Calculate next execution time
    let nextExecution: string | undefined;
    if (bot.cronSchedule) {
      const nextExecutionResult = botSchedulerService.calculateNextExecution(
        bot.cronSchedule,
        now // Use current time as the new last execution
      );
      nextExecution = nextExecutionResult.nextExecution?.toISOString();
    }

    const updateData: Partial<Bot> = {
      lastExecution: now,
      nextExecution,
      executionCount: (bot.executionCount || 0) + 1,
      lastActive: now
    };

    console.log(`[BotExecutor] Updating bot ${bot.id} metadata:`, updateData);

    try {
      // Handle execution failure state transition
      if (!success) {
        console.log(`[BotExecutor] Bot ${bot.id} execution failed, transitioning to error state`);

        // Use transitionAction to handle state machine validation
        const updateWithTransition = {
          ...updateData,
          transitionAction: 'error',
          transitionReason: 'Scheduled execution failed'
        };

        await botService.updateBot(bot.id, updateWithTransition);
        console.log(`[BotExecutor] Successfully updated bot ${bot.id} metadata and transitioned to error state`);
      } else {
        // Normal metadata update without state transition
        await botService.updateBot(bot.id, updateData);
        console.log(`[BotExecutor] Successfully updated bot ${bot.id} metadata`);
      }
    } catch (error) {
      console.error(`[BotExecutor] Failed to update bot ${bot.id} metadata:`, error);
      throw error; // Re-throw to allow caller to handle
    }
  }

  /**
   * Handles execution failure by transitioning bot to error state
   */
  async handleExecutionFailure(bot: Bot, error: string): Promise<void> {
    try {
      console.log(`[BotExecutor] Handling execution failure for bot ${bot.id}: ${error}`);

      await botService.updateBot(bot.id, {
        transitionAction: 'error',
        transitionReason: `Execution failed: ${error}`,
        lastActive: new Date().toISOString()
      });

      console.log(`[BotExecutor] Successfully transitioned bot ${bot.id} to error state`);
    } catch (transitionError) {
      console.error(`[BotExecutor] Failed to transition bot ${bot.id} to error state:`, transitionError);
      throw transitionError; // Re-throw for caller to handle
    }
  }

  /**
   * Validates that a bot is ready for execution
   */
  validateBotForExecution(bot: Bot): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!bot.strategy?.trim()) {
      errors.push('Bot has no strategy defined');
    }

    if (bot.status !== 'active') {
      errors.push(`Bot status is '${bot.status}', must be 'active'`);
    }


    if (!bot.cronSchedule) {
      errors.push('Bot has no cron schedule defined');
    }

    if (!bot.encryptedWallet || !bot.walletIv) {
      errors.push('Bot has no wallet credentials');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Gets execution statistics for a bot
   */
  getExecutionStats(bot: Bot): {
    totalExecutions: number;
    lastExecution: Date | null;
    nextExecution: Date | null;
    isOverdue: boolean;
  } {
    const totalExecutions = bot.executionCount || 0;
    const lastExecution = bot.lastExecution ? new Date(bot.lastExecution) : null;
    const nextExecution = bot.nextExecution ? new Date(bot.nextExecution) : null;

    const isOverdue = nextExecution ? new Date() > nextExecution : false;

    return {
      totalExecutions,
      lastExecution,
      nextExecution,
      isOverdue
    };
  }
}

// Export singleton instance
export const botExecutorService = new BotExecutorService();
/**
 * BotExecutorService - Handles bot execution and metadata updates
 * 
 * Provides services for executing bot strategies, updating execution metadata,
 * and handling execution state transitions without circular HTTP dependencies.
 */

import { type Bot } from '@/schemas/bot.schema';

import { BotStateMachine } from '../core/bot-state-machine';
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
    
    try {
      console.log(`[BotExecutor] Executing bot ${bot.id} (${bot.name}) - Execution ID: ${executionId}`);

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

    let updateData: any = {
      lastExecution: now,
      nextExecution,
      executionCount: (bot.executionCount || 0) + 1,
      lastActive: now
    };

    console.log(`[BotExecutor] Updating bot ${bot.id} metadata:`, updateData);

    try {
      const userId = bot.ownerId;

      // Handle execution failure state transition
      if (!success) {
        console.log(`[BotExecutor] Bot ${bot.id} execution failed, transitioning to error state`);
        
        try {
          // Use the state machine to validate and request the transition
          const transitionResult = await BotStateMachine.requestTransition(
            bot,
            'error',
            userId,
            'Scheduled execution failed'
          );
          
          if (transitionResult.success) {
            updateData = { ...updateData, status: transitionResult.toStatus };
            console.log(`[BotExecutor] Successfully validated transition for bot ${bot.id} to error state`);
          } else {
            console.error(`[BotExecutor] State transition validation failed for bot ${bot.id}:`, transitionResult.errors);
            // Fall back to direct status update
            updateData = { ...updateData, status: 'error' as const };
          }
        } catch (error) {
          console.error(`[BotExecutor] Error during state transition for bot ${bot.id}:`, error);
          // Fall back to direct status update
          updateData = { ...updateData, status: 'error' as const };
        }
      }

      // Update bot with new execution metadata
      const updatedBot = {
        ...bot,
        ...updateData
      };

      await botService.updateBot(userId, updatedBot);
      console.log(`[BotExecutor] Successfully updated bot ${bot.id} metadata`);
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
      const transitionResult = await BotStateMachine.requestTransition(
        bot,
        'error',
        bot.ownerId,
        `Execution failed: ${error}`
      );
      
      if (transitionResult.success) {
        const updatedBot = {
          ...bot,
          status: transitionResult.toStatus,
          lastActive: new Date().toISOString()
        };
        
        await botService.updateBot(bot.ownerId, updatedBot);
        console.log(`[BotExecutor] Successfully transitioned bot ${bot.id} to error state`);
      } else {
        console.error(`[BotExecutor] State transition validation failed for bot ${bot.id}:`, transitionResult.errors);
        throw new Error(`State transition failed: ${transitionResult.errors?.join(', ')}`);
      }
    } catch (transitionError) {
      console.error(`[BotExecutor] Failed to transition bot ${bot.id} to error state:`, transitionError);
      
      // Fall back to direct bot update
      const updatedBot = {
        ...bot,
        status: 'error' as const,
        lastActive: new Date().toISOString()
      };
      
      await botService.updateBot(bot.ownerId, updatedBot);
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

    if (!bot.isScheduled) {
      errors.push('Bot is not scheduled for execution');
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
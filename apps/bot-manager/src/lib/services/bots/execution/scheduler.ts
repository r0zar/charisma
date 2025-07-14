/**
 * BotSchedulerService - Handles all bot scheduling logic
 * 
 * Provides pure functions for determining when bots should execute,
 * filtering bots that need execution, and calculating next execution times.
 */

import { CronExpressionParser } from 'cron-parser';
import { isBefore, parseISO } from 'date-fns';

import { type Bot } from '@/schemas/bot.schema';

export interface SchedulingResult {
  botsToExecute: Bot[];
  totalScheduledBots: number;
  nextExecutionTimes: Map<string, Date | null>;
}

export interface NextExecutionResult {
  nextExecution: Date | null;
  error?: string;
}

export class BotSchedulerService {
  /**
   * Determines if a bot should be executed based on its schedule
   */
  shouldExecuteBot(bot: Bot, currentTime: Date = new Date()): boolean {
    if (!bot.cronSchedule || bot.status !== 'active') {
      console.log(`[BotScheduler] Bot ${bot.name} (${bot.id}): Not scheduled or not active. Status: ${bot.status}, Schedule: ${bot.cronSchedule}`);
      return false;
    }

    try {
      // Parse the cron expression
      const _interval = CronExpressionParser.parse(bot.cronSchedule, { tz: 'UTC' });

      // If no last execution, check if we're past the first scheduled time after bot creation
      if (!bot.lastExecution) {
        // For first execution, start from bot creation time and get the next scheduled time
        const botCreationTime = parseISO(bot.createdAt);
        const intervalFromCreation = CronExpressionParser.parse(bot.cronSchedule, {
          currentDate: botCreationTime,
          tz: 'UTC'
        });
        const firstScheduledTime = intervalFromCreation.next();
        const shouldExecute = !isBefore(currentTime, firstScheduledTime.toDate());
        console.log(`[BotScheduler] Bot ${bot.name} (${bot.id}): First execution check. Created: ${bot.createdAt}, First scheduled: ${firstScheduledTime.toDate().toISOString()}, Current: ${currentTime.toISOString()}, Should execute: ${shouldExecute}`);
        return shouldExecute;
      }

      // Get the next scheduled time after the last execution
      const lastExecution = parseISO(bot.lastExecution);
      
      // Reset interval to start from last execution time
      const intervalFromLast = CronExpressionParser.parse(bot.cronSchedule, {
        currentDate: lastExecution,
        tz: 'UTC'
      });
      const nextScheduled = intervalFromLast.next();

      // Execute if current time is past the next scheduled time
      const shouldExecute = !isBefore(currentTime, nextScheduled.toDate());
      console.log(`[BotScheduler] Bot ${bot.name} (${bot.id}): Schedule: ${bot.cronSchedule}, Last execution: ${bot.lastExecution}, Next scheduled: ${nextScheduled.toDate().toISOString()}, Current: ${currentTime.toISOString()}, Should execute: ${shouldExecute}`);
      return shouldExecute;
    } catch (error) {
      console.error(`[BotScheduler] Invalid cron expression for bot ${bot.id}: ${bot.cronSchedule}`, error);
      return false;
    }
  }

  /**
   * Filters all bots to find those that are scheduled and need execution
   */
  getScheduledBots(allBots: Bot[]): Bot[] {
    return allBots.filter(bot =>
      bot.status === 'active' &&
      bot.cronSchedule
    );
  }

  /**
   * Gets all bots that should be executed right now
   */
  getBotsToExecute(allBots: Bot[], currentTime: Date = new Date()): SchedulingResult {
    const scheduledBots = this.getScheduledBots(allBots);
    const botsToExecute: Bot[] = [];
    const nextExecutionTimes = new Map<string, Date | null>();

    for (const bot of scheduledBots) {
      if (this.shouldExecuteBot(bot, currentTime)) {
        botsToExecute.push(bot);
      }
      
      // Calculate next execution time for monitoring/debugging
      const nextExecution = this.calculateNextExecution(bot.cronSchedule!, bot.lastExecution);
      nextExecutionTimes.set(bot.id, nextExecution.nextExecution);
    }

    return {
      botsToExecute,
      totalScheduledBots: scheduledBots.length,
      nextExecutionTimes
    };
  }

  /**
   * Calculates the next execution time for a bot based on its cron schedule
   */
  calculateNextExecution(cronSchedule: string, lastExecution?: string): NextExecutionResult {
    try {
      let interval: any;
      
      if (lastExecution) {
        // Calculate next execution from last execution time
        const lastExecutionDate = parseISO(lastExecution);
        interval = CronExpressionParser.parse(cronSchedule, {
          currentDate: lastExecutionDate,
          tz: 'UTC'
        });
      } else {
        // Calculate next execution from now
        interval = CronExpressionParser.parse(cronSchedule, {
          tz: 'UTC'
        });
      }

      const nextTime = interval.next();
      return {
        nextExecution: nextTime.toDate()
      };
    } catch (error) {
      const errorMessage = `Invalid cron expression: ${cronSchedule}`;
      console.error(`[BotScheduler] ${errorMessage}`, error);
      return {
        nextExecution: null,
        error: errorMessage
      };
    }
  }

  /**
   * Validates a cron expression
   */
  validateCronExpression(cronExpression: string): { valid: boolean; error?: string; nextExecution?: Date } {
    // Handle empty strings
    if (!cronExpression || cronExpression.trim() === '') {
      return {
        valid: false,
        error: 'Empty cron expression'
      };
    }

    try {
      const interval = CronExpressionParser.parse(cronExpression, { tz: 'UTC' });
      const nextExecution = interval.next();
      return {
        valid: true,
        nextExecution: nextExecution.toDate()
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid cron expression'
      };
    }
  }

  /**
   * Gets a human-readable description of when a cron will next execute
   */
  getNextExecutionDescription(cronSchedule: string, lastExecution?: string): string {
    const result = this.calculateNextExecution(cronSchedule, lastExecution);
    
    if (result.error || !result.nextExecution) {
      return 'Invalid schedule';
    }

    const now = new Date();
    const timeDiff = result.nextExecution.getTime() - now.getTime();
    
    if (timeDiff < 0) {
      return 'Overdue';
    }

    const minutes = Math.floor(timeDiff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `In ${days} day${days === 1 ? '' : 's'}`;
    } else if (hours > 0) {
      return `In ${hours} hour${hours === 1 ? '' : 's'}`;
    } else if (minutes > 0) {
      return `In ${minutes} minute${minutes === 1 ? '' : 's'}`;
    } else {
      return 'Very soon';
    }
  }
}

// Export singleton instance
export const botSchedulerService = new BotSchedulerService();
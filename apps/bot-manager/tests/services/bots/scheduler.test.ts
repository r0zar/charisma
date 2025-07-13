/**
 * Unit tests for BotSchedulerService
 * 
 * Tests scheduling logic, cron parsing, and bot filtering without external dependencies
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { botSchedulerService } from '@/lib/services/bots/execution';
import { type Bot } from '@/schemas/bot.schema';
import { CronExpressionParser } from 'cron-parser';

// Mock console to avoid noise during tests
vi.mock('console', () => ({
  error: vi.fn(),
  log: vi.fn(),
  warn: vi.fn()
}));

describe('BotSchedulerService', () => {
  let mockBot: Bot;
  let currentTime: Date;

  beforeEach(() => {
    // Reset time to a known point for consistent testing
    currentTime = new Date('2025-01-15T10:30:00.000Z');

    // Create a base mock bot for testing
    mockBot = {
      id: 'SP1234567890ABCDEF1234567890ABCDEF12345678',
      name: 'Test Bot',
      strategy: 'console.log("test");',
      status: 'active',
      ownerId: 'SP1234567890ABCDEF1234567890ABCDEF12345678',
      createdAt: '2025-01-15T09:00:00.000Z',
      lastActive: '2025-01-15T10:00:00.000Z',
      imageType: 'pokemon',
      isScheduled: true,
      executionCount: 0,
      cronSchedule: '0 * * * *' // Every hour
    };
  });

  describe('shouldExecuteBot', () => {
    it('should return false for bots that are not scheduled', () => {
      const bot = { ...mockBot, isScheduled: false };
      expect(botSchedulerService.shouldExecuteBot(bot, currentTime)).toBe(false);
    });

    it('should return false for bots that are not active', () => {
      const bot = { ...mockBot, status: 'paused' as const };
      expect(botSchedulerService.shouldExecuteBot(bot, currentTime)).toBe(false);
    });

    it('should return false for bots without a cron schedule', () => {
      const bot = { ...mockBot, cronSchedule: undefined };
      expect(botSchedulerService.shouldExecuteBot(bot, currentTime)).toBe(false);
    });

    it('should return false for bots with invalid cron expressions', () => {
      const bot = { ...mockBot, cronSchedule: 'invalid cron' };
      expect(botSchedulerService.shouldExecuteBot(bot, currentTime)).toBe(false);
    });

    it('should handle first execution correctly - should execute if past first scheduled time', () => {
      // Bot scheduled every hour, created at 09:00, current time 10:30
      // Previous scheduled time was 10:00, so it should execute now
      const bot = { ...mockBot, lastExecution: undefined };
      expect(botSchedulerService.shouldExecuteBot(bot, currentTime)).toBe(true);
    });

    it('should not execute if current time is before first scheduled time', () => {
      // Bot scheduled every hour, current time before first execution
      const earlyTime = new Date('2025-01-15T09:30:00.000Z');
      const bot = { ...mockBot, lastExecution: undefined, cronSchedule: '0 10 * * *' }; // At 10:00 daily
      expect(botSchedulerService.shouldExecuteBot(bot, earlyTime)).toBe(false);
    });

    it('should execute if past the next scheduled time after last execution', () => {
      // Last execution at 09:00, scheduled every hour, current time 10:30
      // Next execution should be at 10:00, so it should execute now
      const bot = {
        ...mockBot,
        lastExecution: '2025-01-15T09:00:00.000Z',
        cronSchedule: '0 * * * *' // Every hour
      };
      expect(botSchedulerService.shouldExecuteBot(bot, currentTime)).toBe(true);
    });

    it('should not execute if before the next scheduled time', () => {
      // Last execution at 10:15, scheduled every hour, current time 10:30
      // Next execution should be at 11:00, so it should not execute now
      const bot = {
        ...mockBot,
        lastExecution: '2025-01-15T10:15:00.000Z',
        cronSchedule: '0 * * * *' // Every hour
      };
      expect(botSchedulerService.shouldExecuteBot(bot, currentTime)).toBe(false);
    });

    it('should handle different cron expressions correctly', () => {
      const testCases = [
        { cron: '*/5 * * * *', lastExec: '2025-01-15T10:25:00.000Z', shouldExecute: true }, // Every 5 minutes - last was 10:25, next is 10:30, current is 10:30 -> execute
        { cron: '*/5 * * * *', lastExec: '2025-01-15T10:30:00.000Z', shouldExecute: false }, // Every 5 minutes - last was 10:30, next is 10:35, current is 10:30 -> don't execute
        { cron: '0 0 * * *', lastExec: '2025-01-14T00:00:00.000Z', shouldExecute: true }, // Daily at midnight, past due
        { cron: '0 12 * * *', lastExec: '2025-01-14T12:00:00.000Z', shouldExecute: false } // Daily at noon, not time yet
      ];

      testCases.forEach(({ cron, lastExec, shouldExecute }, index) => {
        const bot = {
          ...mockBot,
          id: `SP${index}234567890ABCDEF1234567890ABCDEF1234567${index}`,
          cronSchedule: cron,
          lastExecution: lastExec
        };
        expect(botSchedulerService.shouldExecuteBot(bot, currentTime)).toBe(shouldExecute);
      });
    });
  });

  describe('getScheduledBots', () => {
    it('should filter bots correctly', () => {
      const bots: Bot[] = [
        { ...mockBot, id: 'SP1', isScheduled: true, status: 'active', cronSchedule: '0 * * * *' },
        { ...mockBot, id: 'SP2', isScheduled: false, status: 'active', cronSchedule: '0 * * * *' }, // Not scheduled
        { ...mockBot, id: 'SP3', isScheduled: true, status: 'paused', cronSchedule: '0 * * * *' }, // Not active
        { ...mockBot, id: 'SP4', isScheduled: true, status: 'active', cronSchedule: undefined }, // No cron
        { ...mockBot, id: 'SP5', isScheduled: true, status: 'active', cronSchedule: '0 * * * *' } // Valid
      ];

      const result = botSchedulerService.getScheduledBots(bots);
      expect(result).toHaveLength(2);
      expect(result.map(b => b.id)).toEqual(['SP1', 'SP5']);
    });

    it('should return empty array when no bots match criteria', () => {
      const bots: Bot[] = [
        { ...mockBot, isScheduled: false },
        { ...mockBot, status: 'paused' as const }
      ];

      const result = botSchedulerService.getScheduledBots(bots);
      expect(result).toHaveLength(0);
    });
  });

  describe('getBotsToExecute', () => {
    it('should return correct scheduling result', () => {
      const bots: Bot[] = [
        {
          ...mockBot,
          id: 'SP1',
          cronSchedule: '0 * * * *',
          lastExecution: '2025-01-15T09:00:00.000Z' // Should execute
        },
        {
          ...mockBot,
          id: 'SP2',
          cronSchedule: '0 * * * *',
          lastExecution: '2025-01-15T10:15:00.000Z' // Should not execute
        },
        {
          ...mockBot,
          id: 'SP3',
          isScheduled: false // Not scheduled
        }
      ];

      const result = botSchedulerService.getBotsToExecute(bots, currentTime);

      expect(result.totalScheduledBots).toBe(2);
      expect(result.botsToExecute).toHaveLength(1);
      expect(result.botsToExecute[0].id).toBe('SP1');
      expect(result.nextExecutionTimes).toBeInstanceOf(Map);
      expect(result.nextExecutionTimes.size).toBe(2);
    });

    it('should handle empty bot list', () => {
      const result = botSchedulerService.getBotsToExecute([], currentTime);

      expect(result.totalScheduledBots).toBe(0);
      expect(result.botsToExecute).toHaveLength(0);
      expect(result.nextExecutionTimes.size).toBe(0);
    });
  });

  describe('calculateNextExecution', () => {
    it('should calculate next execution from current time when no last execution', () => {
      const result = botSchedulerService.calculateNextExecution('0 * * * *'); // Every hour

      expect(result.nextExecution).toBeInstanceOf(Date);
      expect(result.error).toBeUndefined();
    });

    it('should calculate next execution from last execution time', () => {
      const lastExecution = '2025-01-15T10:00:00.000Z';
      const result = botSchedulerService.calculateNextExecution('0 * * * *', lastExecution);

      expect(result.nextExecution).toBeInstanceOf(Date);
      expect(result.nextExecution?.getUTCHours()).toBe(11); // Next hour
      expect(result.error).toBeUndefined();
    });

    it('should handle invalid cron expressions', () => {
      const result = botSchedulerService.calculateNextExecution('invalid cron');

      expect(result.nextExecution).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Invalid cron expression');
    });

    it('should handle various cron expressions correctly', () => {
      const testCases = [
        { cron: '*/5 * * * *', expectedMinutes: 5 }, // Every 5 minutes
        { cron: '0 */2 * * *', expectedHours: 2 }, // Every 2 hours
        { cron: '0 0 * * *', expectedHours: 24 } // Daily
      ];

      testCases.forEach(({ cron }) => {
        const result = botSchedulerService.calculateNextExecution(cron);
        expect(result.nextExecution).toBeInstanceOf(Date);
        expect(result.error).toBeUndefined();
      });
    });
  });

  describe('validateCronExpression', () => {
    it('should validate correct cron expressions', () => {
      const validExpressions = [
        '0 * * * *', // Every hour
        '*/5 * * * *', // Every 5 minutes
        '0 0 * * *', // Daily at midnight
        '0 9 * * 1-5', // Weekdays at 9 AM
        '0 0 1 * *' // First day of month
      ];

      validExpressions.forEach(cron => {
        const result = botSchedulerService.validateCronExpression(cron);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.nextExecution).toBeInstanceOf(Date);
      });
    });

    it('should reject invalid cron expressions', () => {
      const invalidExpressions = [
        'invalid cron',
        '60 * * * *', // Invalid minute (0-59)
        '* 25 * * *', // Invalid hour (0-23)
        '', // Empty string
        'not-a-cron-at-all' // Completely invalid format
      ];

      invalidExpressions.forEach(cron => {
        const result = botSchedulerService.validateCronExpression(cron);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.nextExecution).toBeUndefined();
      });
    });

    it('should handle non-Error exceptions in cron validation', () => {
      // Mock CronExpressionParser to throw a non-Error object
      const originalParse = CronExpressionParser.parse;
      vi.spyOn(CronExpressionParser, 'parse').mockImplementation(() => {
        throw 'String error instead of Error object';
      });

      const result = botSchedulerService.validateCronExpression('0 * * * *');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid cron expression');
      expect(result.nextExecution).toBeUndefined();

      // Restore original implementation
      CronExpressionParser.parse = originalParse;
    });
  });

  describe('getNextExecutionDescription', () => {
    beforeEach(() => {
      // Mock Date.now to return consistent time
      vi.useFakeTimers();
      vi.setSystemTime(currentTime);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return "Invalid schedule" for invalid cron', () => {
      const result = botSchedulerService.getNextExecutionDescription('invalid');
      expect(result).toBe('Invalid schedule');
    });

    it('should return "Overdue" for past due executions', () => {
      // Create a cron that should have executed in the past
      const pastCron = '0 9 * * *'; // 9 AM daily
      const result = botSchedulerService.getNextExecutionDescription(pastCron, '2025-01-14T09:00:00.000Z');
      expect(result).toBe('Overdue');
    });

    it('should return correct time descriptions', () => {
      // Mock different future times and test descriptions
      const testCases = [
        { futureMinutes: 5, expected: 'In 5 minutes' },
        { futureMinutes: 1, expected: 'In 1 minute' },
        { futureMinutes: 60, expected: 'In 1 hour' },
        { futureMinutes: 120, expected: 'In 2 hours' },
        { futureMinutes: 1440, expected: 'In 1 day' },
        { futureMinutes: 2880, expected: 'In 2 days' }
      ];

      testCases.forEach(({ futureMinutes, expected }) => {
        // Create a time in the future
        const futureTime = new Date(currentTime.getTime() + futureMinutes * 60 * 1000);

        // Mock the next execution calculation to return our future time
        const spy = vi.spyOn(botSchedulerService, 'calculateNextExecution').mockReturnValue({
          nextExecution: futureTime,
          error: undefined
        });

        const result = botSchedulerService.getNextExecutionDescription('0 * * * *');
        expect(result).toBe(expected);

        spy.mockRestore();
      });
    });

    it('should return "Very soon" for executions within a minute', () => {
      const futureTime = new Date(currentTime.getTime() + 30 * 1000); // 30 seconds

      const spy = vi.spyOn(botSchedulerService, 'calculateNextExecution').mockReturnValue({
        nextExecution: futureTime,
        error: undefined
      });

      const result = botSchedulerService.getNextExecutionDescription('0 * * * *');
      expect(result).toBe('Very soon');

      spy.mockRestore();
    });
  });
});
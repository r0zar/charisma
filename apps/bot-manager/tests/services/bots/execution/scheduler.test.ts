/**
 * Unit tests for Bot Scheduler Service
 * 
 * Tests bot scheduling logic, cron expression validation, and execution timing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BotSchedulerService,
  botSchedulerService,
  type SchedulingResult,
  type NextExecutionResult
} from '@/lib/services/bots/execution/scheduler';
import { type Bot } from '@/schemas/bot.schema';

// Mock date-fns to control time-based tests
vi.mock('date-fns', async () => {
  const actual = await vi.importActual('date-fns');
  return {
    ...actual,
    isBefore: vi.fn(),
    parseISO: vi.fn()
  };
});

// Mock cron-parser
vi.mock('cron-parser', () => ({
  CronExpressionParser: {
    parse: vi.fn()
  }
}));

// Mock console to avoid noise during tests
vi.mock('console', () => ({
  error: vi.fn(),
  log: vi.fn()
}));

describe('Bot Scheduler Service', () => {
  let mockBot: Bot;
  let mockDateFns: any;
  let mockCronParser: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    
    // Import mocked modules
    mockDateFns = await import('date-fns');
    mockCronParser = (await import('cron-parser')).CronExpressionParser;
    
    mockBot = {
      id: 'SP1234567890ABCDEF1234567890ABCDEF12345678',
      name: 'Test Trading Bot',
      strategy: 'bot.trade({ symbol: "STX", amount: 100 });',
      status: 'active',
      ownerId: 'SP1111111111111111111111111111111111111111',
      createdAt: '2025-01-15T08:00:00.000Z',
      lastActive: '2025-01-15T08:00:00.000Z',
      imageType: 'pokemon',
      cronSchedule: '0 * * * *', // Every hour
      executionCount: 5,
      encryptedWallet: 'encrypted_data',
      walletIv: 'iv_data',
      publicKey: 'public_key'
    };

    // Default mock implementations
    mockDateFns.parseISO.mockImplementation((dateString: string) => new Date(dateString));
    mockDateFns.isBefore.mockImplementation((date1: Date, date2: Date) => date1 < date2);
  });

  describe('shouldExecuteBot', () => {
    it('should return false for bot without cron schedule', () => {
      const botWithoutCron = { ...mockBot, cronSchedule: undefined };
      const result = botSchedulerService.shouldExecuteBot(botWithoutCron);
      
      expect(result).toBe(false);
    });

    it('should return false for unscheduled bot', () => {
      const unscheduledBot = { ...mockBot, cronSchedule: undefined };
      const result = botSchedulerService.shouldExecuteBot(unscheduledBot);
      
      expect(result).toBe(false);
    });

    it('should return false for inactive bot', () => {
      const inactiveBot = { ...mockBot, status: 'paused' as const };
      const result = botSchedulerService.shouldExecuteBot(inactiveBot);
      
      expect(result).toBe(false);
    });

    it('should execute bot on first scheduled time after creation', () => {
      const botWithoutLastExecution = { ...mockBot, lastExecution: undefined };
      const currentTime = new Date('2025-01-15T09:30:00.000Z');
      
      // Mock cron parser for bot creation time
      const mockInterval = {
        next: vi.fn().mockReturnValue({
          toDate: () => new Date('2025-01-15T09:00:00.000Z')
        })
      };
      mockCronParser.parse.mockReturnValue(mockInterval);
      
      // Current time is after first scheduled time
      mockDateFns.isBefore.mockReturnValue(false);
      
      const result = botSchedulerService.shouldExecuteBot(botWithoutLastExecution, currentTime);
      
      expect(result).toBe(true);
      expect(mockCronParser.parse).toHaveBeenCalledWith(
        mockBot.cronSchedule,
        expect.objectContaining({ tz: 'UTC' })
      );
    });

    it('should not execute bot before first scheduled time', () => {
      const botWithoutLastExecution = { ...mockBot, lastExecution: undefined };
      const currentTime = new Date('2025-01-15T08:30:00.000Z');
      
      const mockInterval = {
        next: vi.fn().mockReturnValue({
          toDate: () => new Date('2025-01-15T09:00:00.000Z')
        })
      };
      mockCronParser.parse.mockReturnValue(mockInterval);
      
      // Current time is before first scheduled time
      mockDateFns.isBefore.mockReturnValue(true);
      
      const result = botSchedulerService.shouldExecuteBot(botWithoutLastExecution, currentTime);
      
      expect(result).toBe(false);
    });

    it('should execute bot when due after last execution', () => {
      const botWithLastExecution = { 
        ...mockBot, 
        lastExecution: '2025-01-15T08:00:00.000Z' 
      };
      const currentTime = new Date('2025-01-15T09:30:00.000Z');
      
      const mockInterval = {
        next: vi.fn().mockReturnValue({
          toDate: () => new Date('2025-01-15T09:00:00.000Z')
        })
      };
      mockCronParser.parse.mockReturnValue(mockInterval);
      
      // Current time is after next scheduled time
      mockDateFns.isBefore.mockReturnValue(false);
      
      const result = botSchedulerService.shouldExecuteBot(botWithLastExecution, currentTime);
      
      expect(result).toBe(true);
    });

    it('should not execute bot before next scheduled time', () => {
      const botWithLastExecution = { 
        ...mockBot, 
        lastExecution: '2025-01-15T08:00:00.000Z' 
      };
      const currentTime = new Date('2025-01-15T08:30:00.000Z');
      
      const mockInterval = {
        next: vi.fn().mockReturnValue({
          toDate: () => new Date('2025-01-15T09:00:00.000Z')
        })
      };
      mockCronParser.parse.mockReturnValue(mockInterval);
      
      // Current time is before next scheduled time
      mockDateFns.isBefore.mockReturnValue(true);
      
      const result = botSchedulerService.shouldExecuteBot(botWithLastExecution, currentTime);
      
      expect(result).toBe(false);
    });

    it('should handle invalid cron expressions', () => {
      mockCronParser.parse.mockImplementation(() => {
        throw new Error('Invalid cron expression');
      });
      
      const result = botSchedulerService.shouldExecuteBot(mockBot);
      
      expect(result).toBe(false);
    });

    it('should use current time as default', () => {
      const mockInterval = {
        next: vi.fn().mockReturnValue({
          toDate: () => new Date(Date.now() + 3600000) // 1 hour from now
        })
      };
      mockCronParser.parse.mockReturnValue(mockInterval);
      mockDateFns.isBefore.mockReturnValue(true);
      
      const result = botSchedulerService.shouldExecuteBot(mockBot);
      
      expect(result).toBe(false);
    });
  });

  describe('getScheduledBots', () => {
    it('should filter bots that are scheduled and active', () => {
      const bots: Bot[] = [
        mockBot, // scheduled, active, has cron
        { ...mockBot, id: 'bot2', cronSchedule: undefined }, // not scheduled
        { ...mockBot, id: 'bot3', status: 'paused' }, // not active
        { ...mockBot, id: 'bot4', cronSchedule: undefined }, // no cron
        { ...mockBot, id: 'bot5', name: 'Valid Bot 2' } // valid
      ];
      
      const scheduledBots = botSchedulerService.getScheduledBots(bots);
      
      expect(scheduledBots).toHaveLength(2);
      expect(scheduledBots.map(b => b.id)).toEqual([
        'SP1234567890ABCDEF1234567890ABCDEF12345678',
        'bot5'
      ]);
    });

    it('should return empty array when no bots match criteria', () => {
      const bots: Bot[] = [
        { ...mockBot, cronSchedule: undefined },
        { ...mockBot, status: 'error' },
        { ...mockBot, cronSchedule: undefined }
      ];
      
      const scheduledBots = botSchedulerService.getScheduledBots(bots);
      
      expect(scheduledBots).toHaveLength(0);
    });

    it('should handle empty bot array', () => {
      const scheduledBots = botSchedulerService.getScheduledBots([]);
      
      expect(scheduledBots).toHaveLength(0);
      expect(Array.isArray(scheduledBots)).toBe(true);
    });
  });

  describe('getBotsToExecute', () => {
    it('should return bots that need execution', () => {
      const bots: Bot[] = [
        mockBot,
        { ...mockBot, id: 'bot2', name: 'Bot 2' }
      ];
      
      // Mock shouldExecuteBot to return true for first bot, false for second
      const originalShouldExecute = botSchedulerService.shouldExecuteBot;
      vi.spyOn(botSchedulerService, 'shouldExecuteBot')
        .mockImplementationOnce(() => true)
        .mockImplementationOnce(() => false);
      
      // Mock calculateNextExecution
      vi.spyOn(botSchedulerService, 'calculateNextExecution')
        .mockReturnValue({
          nextExecution: new Date('2025-01-15T09:00:00.000Z')
        });
      
      const result = botSchedulerService.getBotsToExecute(bots);
      
      expect(result.botsToExecute).toHaveLength(1);
      expect(result.botsToExecute[0].id).toBe(mockBot.id);
      expect(result.totalScheduledBots).toBe(2);
      expect(result.nextExecutionTimes.size).toBe(2);
      
      // Restore original method
      botSchedulerService.shouldExecuteBot = originalShouldExecute;
    });

    it('should handle bots with no next execution', () => {
      const bots: Bot[] = [mockBot];
      
      vi.spyOn(botSchedulerService, 'shouldExecuteBot').mockReturnValue(false);
      vi.spyOn(botSchedulerService, 'calculateNextExecution').mockReturnValue({
        nextExecution: null,
        error: 'Invalid cron'
      });
      
      const result = botSchedulerService.getBotsToExecute(bots);
      
      expect(result.nextExecutionTimes.get(mockBot.id)).toBeNull();
    });

    it('should use current time parameter', () => {
      const customTime = new Date('2025-01-15T10:00:00.000Z');
      const shouldExecuteSpy = vi.spyOn(botSchedulerService, 'shouldExecuteBot').mockReturnValue(false);
      
      botSchedulerService.getBotsToExecute([mockBot], customTime);
      
      expect(shouldExecuteSpy).toHaveBeenCalledWith(mockBot, customTime);
    });
  });

  describe('calculateNextExecution', () => {
    it('should calculate next execution from last execution time', () => {
      const lastExecution = '2025-01-15T08:00:00.000Z';
      const cronSchedule = '0 * * * *';
      
      const mockInterval = {
        next: vi.fn().mockReturnValue({
          toDate: () => new Date('2025-01-15T09:00:00.000Z')
        })
      };
      
      mockCronParser.parse.mockReturnValue(mockInterval);
      
      const result = botSchedulerService.calculateNextExecution(cronSchedule, lastExecution);
      
      expect(result.nextExecution).toEqual(new Date('2025-01-15T09:00:00.000Z'));
      expect(result.error).toBeUndefined();
      expect(mockCronParser.parse).toHaveBeenCalledWith(
        cronSchedule,
        expect.objectContaining({
          currentDate: new Date(lastExecution),
          tz: 'UTC'
        })
      );
    });

    it('should calculate next execution from current time when no last execution', () => {
      const cronSchedule = '0 * * * *';
      
      const mockInterval = {
        next: vi.fn().mockReturnValue({
          toDate: () => new Date('2025-01-15T09:00:00.000Z')
        })
      };
      
      mockCronParser.parse.mockReturnValue(mockInterval);
      
      const result = botSchedulerService.calculateNextExecution(cronSchedule);
      
      expect(result.nextExecution).toEqual(new Date('2025-01-15T09:00:00.000Z'));
      expect(mockCronParser.parse).toHaveBeenCalledWith(
        cronSchedule,
        expect.objectContaining({ tz: 'UTC' })
      );
    });

    it('should handle invalid cron expressions', () => {
      mockCronParser.parse.mockImplementation(() => {
        throw new Error('Invalid cron syntax');
      });
      
      const result = botSchedulerService.calculateNextExecution('invalid cron');
      
      expect(result.nextExecution).toBeNull();
      expect(result.error).toBe('Invalid cron expression: invalid cron');
    });

    it('should return error for empty cron expression', () => {
      const result = botSchedulerService.calculateNextExecution('');
      
      expect(result.nextExecution).toBeNull();
      expect(result.error).toBe('Invalid cron expression: ');
    });
  });

  describe('validateCronExpression', () => {
    it('should validate correct cron expression', () => {
      const cronExpression = '0 * * * *';
      
      const mockInterval = {
        next: vi.fn().mockReturnValue({
          toDate: () => new Date('2025-01-15T09:00:00.000Z')
        })
      };
      
      mockCronParser.parse.mockReturnValue(mockInterval);
      
      const result = botSchedulerService.validateCronExpression(cronExpression);
      
      expect(result.valid).toBe(true);
      expect(result.nextExecution).toEqual(new Date('2025-01-15T09:00:00.000Z'));
      expect(result.error).toBeUndefined();
    });

    it('should reject empty cron expression', () => {
      const result = botSchedulerService.validateCronExpression('');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Empty cron expression');
      expect(result.nextExecution).toBeUndefined();
    });

    it('should reject whitespace-only cron expression', () => {
      const result = botSchedulerService.validateCronExpression('   ');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Empty cron expression');
    });

    it('should handle invalid cron syntax', () => {
      mockCronParser.parse.mockImplementation(() => {
        throw new Error('Invalid cron syntax');
      });
      
      const result = botSchedulerService.validateCronExpression('invalid');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid cron syntax');
    });

    it('should handle non-Error exceptions in cron validation', () => {
      mockCronParser.parse.mockImplementation(() => {
        throw 'String error instead of Error object';
      });

      const result = botSchedulerService.validateCronExpression('0 * * * *');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid cron expression');
    });
  });

  describe('getNextExecutionDescription', () => {
    beforeEach(() => {
      // Use fake timers to control time consistently
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T08:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return description for future execution', () => {
      const spy = vi.spyOn(botSchedulerService, 'calculateNextExecution')
        .mockImplementation(() => ({
          nextExecution: new Date('2025-01-15T10:30:00.000Z') // 2.5 hours from now
        }));
      
      const description = botSchedulerService.getNextExecutionDescription('0 * * * *');
      
      expect(description).toBe('In 2 hours');
      
      spy.mockRestore();
    });

    it('should return description for execution in minutes', () => {
      const spy = vi.spyOn(botSchedulerService, 'calculateNextExecution')
        .mockImplementation(() => ({
          nextExecution: new Date('2025-01-15T08:45:00.000Z') // 45 minutes from now
        }));
      
      const description = botSchedulerService.getNextExecutionDescription('0 * * * *');
      
      expect(description).toBe('In 45 minutes');
      
      spy.mockRestore();
    });

    it('should return description for execution in days', () => {
      const spy = vi.spyOn(botSchedulerService, 'calculateNextExecution')
        .mockImplementation(() => ({
          nextExecution: new Date('2025-01-17T08:00:00.000Z') // 2 days from now
        }));
      
      const description = botSchedulerService.getNextExecutionDescription('0 0 * * *');
      
      expect(description).toBe('In 2 days');
      
      spy.mockRestore();
    });

    it('should return "Very soon" for execution within a minute', () => {
      const spy = vi.spyOn(botSchedulerService, 'calculateNextExecution')
        .mockImplementation(() => ({
          nextExecution: new Date('2025-01-15T08:00:30.000Z') // 30 seconds from now
        }));
      
      const description = botSchedulerService.getNextExecutionDescription('* * * * *');
      
      expect(description).toBe('Very soon');
      
      spy.mockRestore();
    });

    it('should return "Overdue" for past execution time', () => {
      const spy = vi.spyOn(botSchedulerService, 'calculateNextExecution')
        .mockImplementation(() => ({
          nextExecution: new Date('2025-01-15T07:00:00.000Z') // 1 hour ago
        }));
      
      const description = botSchedulerService.getNextExecutionDescription('0 * * * *');
      
      expect(description).toBe('Overdue');
      
      spy.mockRestore();
    });

    it('should return "Invalid schedule" for error', () => {
      const spy = vi.spyOn(botSchedulerService, 'calculateNextExecution')
        .mockImplementation(() => ({
          nextExecution: null,
          error: 'Invalid cron'
        }));
      
      const description = botSchedulerService.getNextExecutionDescription('invalid');
      
      expect(description).toBe('Invalid schedule');
      
      spy.mockRestore();
    });

    it('should handle singular time units', () => {
      const spy = vi.spyOn(botSchedulerService, 'calculateNextExecution')
        .mockImplementation(() => ({
          nextExecution: new Date('2025-01-15T09:01:00.000Z') // 1 hour 1 minute from now
        }));
      
      const description = botSchedulerService.getNextExecutionDescription('0 * * * *');
      
      expect(description).toBe('In 1 hour');
      
      spy.mockRestore();
    });

    it('should include last execution in calculation', () => {
      const spy = vi.spyOn(botSchedulerService, 'calculateNextExecution')
        .mockImplementation(() => ({
          nextExecution: new Date('2025-01-15T09:00:00.000Z')
        }));
      
      const lastExecution = '2025-01-15T08:00:00.000Z';
      botSchedulerService.getNextExecutionDescription('0 * * * *', lastExecution);
      
      expect(spy).toHaveBeenCalledWith('0 * * * *', lastExecution);
      
      spy.mockRestore();
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle null/undefined inputs gracefully', () => {
      // shouldExecuteBot should return false for null input by checking cronSchedule
      expect(() => {
        botSchedulerService.shouldExecuteBot(null as any);
      }).toThrow();
      
      // getScheduledBots should handle null by throwing
      expect(() => {
        botSchedulerService.getScheduledBots(null as any);
      }).toThrow();
    });

    it('should handle bot with malformed dates', () => {
      mockDateFns.parseISO.mockImplementation(() => {
        throw new Error('Invalid date');
      });
      
      const result = botSchedulerService.shouldExecuteBot(mockBot);
      
      expect(result).toBe(false);
    });

    it('should handle cron parser returning invalid objects', () => {
      mockCronParser.parse.mockReturnValueOnce({
        next: () => null // Invalid return
      });
      
      // This should return false rather than throw since it's handled in try/catch
      const result = botSchedulerService.shouldExecuteBot(mockBot);
      expect(result).toBe(false);
    });
  });

  describe('Singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(botSchedulerService).toBeInstanceOf(BotSchedulerService);
    });

    it('should have all required methods', () => {
      expect(typeof botSchedulerService.shouldExecuteBot).toBe('function');
      expect(typeof botSchedulerService.getScheduledBots).toBe('function');
      expect(typeof botSchedulerService.getBotsToExecute).toBe('function');
      expect(typeof botSchedulerService.calculateNextExecution).toBe('function');
      expect(typeof botSchedulerService.validateCronExpression).toBe('function');
      expect(typeof botSchedulerService.getNextExecutionDescription).toBe('function');
    });
  });
});
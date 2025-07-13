/**
 * Unit tests for BotExecutorService
 * 
 * Tests execution logic, metadata updates, and state transitions with mocked dependencies
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { botExecutorService } from '@/lib/services/bots';
import { type Bot } from '@/schemas/bot.schema';

// Mock external dependencies
vi.mock('@/lib/services/bots/core/service', () => ({
  botService: {
    updateBot: vi.fn()
  }
}));

vi.mock('@/lib/services/bots/sandbox/sandbox-service', () => ({
  sandboxService: {
    executeStrategy: vi.fn()
  }
}));

vi.mock('@/lib/services/bots/core/bot-state-machine', () => ({
  BotStateMachine: {
    requestTransition: vi.fn()
  }
}));

// Mock only the scheduler service specifically  
vi.mock('@/lib/services/bots/execution/scheduler', () => ({
  botSchedulerService: {
    calculateNextExecution: vi.fn()
  }
}));

// Mock console to avoid noise during tests
vi.mock('console', () => ({
  error: vi.fn(),
  log: vi.fn(),
  warn: vi.fn()
}));

// Import mocked services
import { botService } from '@/lib/services/bots/core/service';
import { sandboxService } from '@/lib/services/bots/sandbox/sandbox-service';
import { BotStateMachine } from '@/lib/services/bots/core/bot-state-machine';
import { botSchedulerService } from '@/lib/services/bots/execution/scheduler';

describe('BotExecutorService', () => {
  let mockBot: Bot;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create a base mock bot for testing
    mockBot = {
      id: 'SP1234567890ABCDEF1234567890ABCDEF12345678',
      name: 'Test Bot',
      strategy: 'console.log("test strategy");',
      status: 'active',
      ownerId: 'SP1234567890ABCDEF1234567890ABCDEF12345678',
      createdAt: '2025-01-15T09:00:00.000Z',
      lastActive: '2025-01-15T10:00:00.000Z',
      imageType: 'pokemon',
      isScheduled: true,
      executionCount: 5,
      cronSchedule: '0 * * * *',
      encryptedWallet: 'encrypted_wallet_data',
      walletIv: 'wallet_iv_data',
      publicKey: 'public_key_data'
    };
  });

  describe('executeBotStrategy', () => {
    it('should execute bot strategy successfully', async () => {
      // Mock successful sandbox execution
      (sandboxService.executeStrategy as MockedFunction<any>).mockResolvedValue({
        success: true,
        executionTime: 1500,
        sandboxId: 'sandbox-123'
      });

      const result = await botExecutorService.executeBotStrategy(mockBot);

      expect(result).toEqual({
        success: true,
        executionTime: 1500,
        sandboxId: 'sandbox-123'
      });

      expect(sandboxService.executeStrategy).toHaveBeenCalledWith(
        mockBot.strategy,
        mockBot,
        {
          timeout: 2,
          enableLogs: false
        },
        expect.any(Object),
        mockBot.ownerId, // userId
        expect.stringMatching(/^exec-\d+-[a-z0-9]+$/) // executionId pattern
      );
    });

    it('should handle sandbox execution failure', async () => {
      // Mock failed sandbox execution
      (sandboxService.executeStrategy as MockedFunction<any>).mockResolvedValue({
        success: false,
        executionTime: 800,
        error: 'Strategy compilation failed',
        sandboxId: 'sandbox-456'
      });

      const result = await botExecutorService.executeBotStrategy(mockBot);

      expect(result).toEqual({
        success: false,
        executionTime: 800,
        error: 'Strategy compilation failed',
        sandboxId: 'sandbox-456'
      });
    });

    it('should handle sandbox service throwing an error', async () => {
      // Mock sandbox service throwing
      (sandboxService.executeStrategy as MockedFunction<any>).mockRejectedValue(
        new Error('Network timeout')
      );

      const result = await botExecutorService.executeBotStrategy(mockBot);

      expect(result).toEqual({
        success: false,
        error: 'Network timeout'
      });
    });

    it('should use custom execution options', async () => {
      (sandboxService.executeStrategy as MockedFunction<any>).mockResolvedValue({
        success: true,
        executionTime: 1000
      });

      const options = {
        timeout: 5,
        enableLogs: true,
        onStatus: vi.fn(),
        onLog: vi.fn()
      };

      await botExecutorService.executeBotStrategy(mockBot, options);

      expect(sandboxService.executeStrategy).toHaveBeenCalledWith(
        mockBot.strategy,
        mockBot,
        {
          timeout: 5,
          enableLogs: true
        },
        expect.objectContaining({
          onStatus: expect.any(Function),
          onLog: expect.any(Function)
        }),
        mockBot.ownerId, // userId
        expect.stringMatching(/^exec-\d+-[a-z0-9]+$/) // executionId pattern
      );
    });
  });

  describe('executeBots', () => {
    it('should execute multiple bots and return summary', async () => {
      const bots = [
        { ...mockBot, id: 'SP1', name: 'Bot 1' },
        { ...mockBot, id: 'SP2', name: 'Bot 2' },
        { ...mockBot, id: 'SP3', name: 'Bot 3' }
      ];

      // Mock successful executions for first two, failure for third
      (sandboxService.executeStrategy as MockedFunction<any>)
        .mockResolvedValueOnce({ success: true, executionTime: 1000 })
        .mockResolvedValueOnce({ success: true, executionTime: 1500 })
        .mockResolvedValueOnce({ success: false, error: 'Execution failed', executionTime: 500 });

      // Mock scheduler service
      (botSchedulerService.calculateNextExecution as MockedFunction<any>).mockReturnValue({
        nextExecution: new Date('2025-01-15T11:00:00.000Z')
      });

      // Mock bot updates
      (botService.updateBot as MockedFunction<any>).mockResolvedValue(undefined);

      const result = await botExecutorService.executeBots(bots);

      expect(result).toEqual({
        processedBots: 3,
        successfulExecutions: 2,
        failedExecutions: 1,
        executions: [
          {
            botId: 'SP1',
            botName: 'Bot 1',
            status: 'success',
            executionTime: 1000
          },
          {
            botId: 'SP2',
            botName: 'Bot 2',
            status: 'success',
            executionTime: 1500
          },
          {
            botId: 'SP3',
            botName: 'Bot 3',
            status: 'failure',
            executionTime: 500,
            error: 'Execution failed'
          }
        ]
      });

      expect(botService.updateBot).toHaveBeenCalledTimes(3);
    });

    it('should handle empty bot list', async () => {
      const result = await botExecutorService.executeBots([]);

      expect(result).toEqual({
        processedBots: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        executions: []
      });

      expect(sandboxService.executeStrategy).not.toHaveBeenCalled();
    });
  });

  describe('updateBotExecutionMetadata', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T10:30:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should update metadata for successful execution', async () => {
      // Mock scheduler calculation
      (botSchedulerService.calculateNextExecution as MockedFunction<any>).mockReturnValue({
        nextExecution: new Date('2025-01-15T11:00:00.000Z')
      });

      // Mock bot update
      (botService.updateBot as MockedFunction<any>).mockResolvedValue(undefined);

      await botExecutorService.updateBotExecutionMetadata(mockBot, true);

      expect(botService.updateBot).toHaveBeenCalledWith(
        mockBot.ownerId,
        expect.objectContaining({
          ...mockBot,
          lastExecution: '2025-01-15T10:30:00.000Z',
          nextExecution: '2025-01-15T11:00:00.000Z',
          executionCount: 6,
          lastActive: '2025-01-15T10:30:00.000Z'
        })
      );
    });

    it('should handle execution failure with state transition', async () => {
      // Mock successful state transition
      (BotStateMachine.requestTransition as MockedFunction<any>).mockResolvedValue({
        success: true,
        toStatus: 'error'
      });

      (botSchedulerService.calculateNextExecution as MockedFunction<any>).mockReturnValue({
        nextExecution: new Date('2025-01-15T11:00:00.000Z')
      });

      (botService.updateBot as MockedFunction<any>).mockResolvedValue(undefined);

      await botExecutorService.updateBotExecutionMetadata(mockBot, false);

      expect(BotStateMachine.requestTransition).toHaveBeenCalledWith(
        mockBot,
        'error',
        mockBot.ownerId,
        'Scheduled execution failed'
      );

      expect(botService.updateBot).toHaveBeenCalledWith(
        mockBot.ownerId,
        expect.objectContaining({
          status: 'error'
        })
      );
    });

    it('should fallback to direct status update if state transition fails', async () => {
      // Mock failed state transition
      (BotStateMachine.requestTransition as MockedFunction<any>).mockResolvedValue({
        success: false,
        errors: ['Transition not allowed']
      });

      (botSchedulerService.calculateNextExecution as MockedFunction<any>).mockReturnValue({
        nextExecution: new Date('2025-01-15T11:00:00.000Z')
      });

      (botService.updateBot as MockedFunction<any>).mockResolvedValue(undefined);

      await botExecutorService.updateBotExecutionMetadata(mockBot, false);

      expect(botService.updateBot).toHaveBeenCalledWith(
        mockBot.ownerId,
        expect.objectContaining({
          status: 'error'
        })
      );
    });

    it('should handle metadata update failure', async () => {
      (botSchedulerService.calculateNextExecution as MockedFunction<any>).mockReturnValue({
        nextExecution: new Date('2025-01-15T11:00:00.000Z')
      });

      (botService.updateBot as MockedFunction<any>).mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        botExecutorService.updateBotExecutionMetadata(mockBot, true)
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('handleExecutionFailure', () => {
    it('should transition bot to error state successfully', async () => {
      (BotStateMachine.requestTransition as MockedFunction<any>).mockResolvedValue({
        success: true,
        toStatus: 'error'
      });

      (botService.updateBot as MockedFunction<any>).mockResolvedValue(undefined);

      await botExecutorService.handleExecutionFailure(mockBot, 'Strategy timeout');

      expect(BotStateMachine.requestTransition).toHaveBeenCalledWith(
        mockBot,
        'error',
        mockBot.ownerId,
        'Execution failed: Strategy timeout'
      );

      expect(botService.updateBot).toHaveBeenCalledWith(
        mockBot.ownerId,
        expect.objectContaining({
          status: 'error'
        })
      );
    });

    it('should fallback to direct update if state transition fails', async () => {
      (BotStateMachine.requestTransition as MockedFunction<any>).mockRejectedValue(
        new Error('State machine error')
      );

      (botService.updateBot as MockedFunction<any>).mockResolvedValue(undefined);

      await botExecutorService.handleExecutionFailure(mockBot, 'Strategy timeout');

      expect(botService.updateBot).toHaveBeenCalledWith(
        mockBot.ownerId,
        expect.objectContaining({
          status: 'error'
        })
      );
    });
  });

  describe('validateBotForExecution', () => {
    it('should validate a properly configured bot', () => {
      const result = botExecutorService.validateBotForExecution(mockBot);

      expect(result).toEqual({
        valid: true,
        errors: []
      });
    });

    it('should detect missing strategy', () => {
      const bot = { ...mockBot, strategy: '' };
      const result = botExecutorService.validateBotForExecution(bot);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Bot has no strategy defined');
    });

    it('should detect inactive status', () => {
      const bot = { ...mockBot, status: 'paused' as const };
      const result = botExecutorService.validateBotForExecution(bot);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Bot status is 'paused', must be 'active'");
    });

    it('should detect missing scheduling configuration', () => {
      const bot = { 
        ...mockBot, 
        isScheduled: false,
        cronSchedule: undefined
      };
      const result = botExecutorService.validateBotForExecution(bot);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual([
        'Bot is not scheduled for execution',
        'Bot has no cron schedule defined'
      ]);
    });

    it('should detect missing wallet credentials', () => {
      const bot = { 
        ...mockBot, 
        encryptedWallet: undefined,
        walletIv: undefined
      };
      const result = botExecutorService.validateBotForExecution(bot);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Bot has no wallet credentials');
    });

    it('should collect multiple validation errors', () => {
      const bot = { 
        ...mockBot, 
        strategy: '',
        status: 'error' as const,
        isScheduled: false,
        encryptedWallet: undefined
      };
      const result = botExecutorService.validateBotForExecution(bot);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(4);
    });
  });

  describe('getExecutionStats', () => {
    it('should return correct execution statistics', () => {
      const bot = {
        ...mockBot,
        executionCount: 10,
        lastExecution: '2025-01-15T09:00:00.000Z',
        nextExecution: '2025-01-15T11:00:00.000Z'
      };

      // Mock current time to be before next execution
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T10:30:00.000Z'));

      const result = botExecutorService.getExecutionStats(bot);

      expect(result).toEqual({
        totalExecutions: 10,
        lastExecution: new Date('2025-01-15T09:00:00.000Z'),
        nextExecution: new Date('2025-01-15T11:00:00.000Z'),
        isOverdue: false
      });

      vi.useRealTimers();
    });

    it('should detect overdue executions', () => {
      const bot = {
        ...mockBot,
        executionCount: 5,
        nextExecution: '2025-01-15T10:00:00.000Z' // In the past
      };

      // Mock current time to be after next execution
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T10:30:00.000Z'));

      const result = botExecutorService.getExecutionStats(bot);

      expect(result.isOverdue).toBe(true);

      vi.useRealTimers();
    });

    it('should handle missing execution data', () => {
      const bot = {
        ...mockBot,
        executionCount: 0,
        lastExecution: undefined,
        nextExecution: undefined
      };

      const result = botExecutorService.getExecutionStats(bot);

      expect(result).toEqual({
        totalExecutions: 0,
        lastExecution: null,
        nextExecution: null,
        isOverdue: false
      });
    });
  });
});
/**
 * Unit tests for Bot Executor Service
 * 
 * Tests bot execution, metadata updates, state transitions, and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BotExecutorService,
  botExecutorService,
  type ExecutionResult,
  type ExecutionSummary,
  type ExecutionOptions
} from '@/lib/services/bots/execution/executor';
import { type Bot } from '@/schemas/bot.schema';

// Mock dependencies
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

vi.mock('@/lib/services/bots/execution/scheduler', () => ({
  botSchedulerService: {
    calculateNextExecution: vi.fn()
  }
}));

vi.mock('@/lib/modules/storage', () => ({
  executionDataStore: {
    storeExecution: vi.fn().mockResolvedValue(true),
    updateExecution: vi.fn().mockResolvedValue(true)
  }
}));

// Mock console to avoid noise during tests
vi.mock('console', () => ({
  log: vi.fn(),
  error: vi.fn()
}));

describe('Bot Executor Service', () => {
  let mockBot: Bot;
  let mockSandboxService: any;
  let mockBotService: any;
  let mockBotStateMachine: any;
  let mockBotSchedulerService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Import mocked modules
    mockSandboxService = (await import('@/lib/services/bots/sandbox/sandbox-service')).sandboxService;
    mockBotService = (await import('@/lib/services/bots/core/service')).botService;
    mockBotStateMachine = (await import('@/lib/services/bots/core/bot-state-machine')).BotStateMachine;
    mockBotSchedulerService = (await import('@/lib/services/bots/execution/scheduler')).botSchedulerService;
    
    mockBot = {
      id: 'SP1234567890ABCDEF1234567890ABCDEF12345678',
      name: 'Test Trading Bot',
      strategy: 'bot.trade({ symbol: "STX", amount: 100 });',
      status: 'active',
      ownerId: 'SP1111111111111111111111111111111111111111',
      createdAt: '2025-01-15T08:00:00.000Z',
      lastActive: '2025-01-15T08:00:00.000Z',
      imageType: 'pokemon',
      cronSchedule: '0 * * * *',
      executionCount: 5,
      encryptedWallet: 'encrypted_data',
      walletIv: 'iv_data',
      publicKey: 'public_key'
    };
  });

  describe('executeBotStrategy', () => {
    it('should execute bot strategy successfully', async () => {
      mockSandboxService.executeStrategy.mockResolvedValue({
        success: true,
        executionTime: 1500,
        sandboxId: 'sandbox-123'
      });

      const result = await botExecutorService.executeBotStrategy(mockBot);

      expect(result.success).toBe(true);
      expect(result.executionTime).toBe(1500);
      expect(result.sandboxId).toBe('sandbox-123');
      expect(mockSandboxService.executeStrategy).toHaveBeenCalledWith(
        mockBot.strategy,
        mockBot,
        { timeout: 2, enableLogs: false },
        expect.any(Object),
        mockBot.ownerId, // userId
        expect.stringMatching(/^exec-\d+-[a-z0-9]+$/) // executionId pattern
      );
    });

    it('should handle sandbox execution failure', async () => {
      mockSandboxService.executeStrategy.mockResolvedValue({
        success: false,
        error: 'Strategy compilation failed',
        executionTime: 500,
        sandboxId: 'sandbox-456'
      });

      const result = await botExecutorService.executeBotStrategy(mockBot);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Strategy compilation failed');
      expect(result.executionTime).toBe(500);
      expect(result.sandboxId).toBe('sandbox-456');
    });

    it('should handle execution with custom options', async () => {
      const options: ExecutionOptions = {
        timeout: 5,
        enableLogs: true,
        onStatus: vi.fn(),
        onLog: vi.fn()
      };

      mockSandboxService.executeStrategy.mockResolvedValue({
        success: true,
        executionTime: 2000
      });

      await botExecutorService.executeBotStrategy(mockBot, options);

      expect(mockSandboxService.executeStrategy).toHaveBeenCalledWith(
        mockBot.strategy,
        mockBot,
        { timeout: 5, enableLogs: true },
        expect.any(Object),
        mockBot.ownerId, // userId
        expect.stringMatching(/^exec-\d+-[a-z0-9]+$/) // executionId pattern
      );
    });

    it('should handle exceptions during execution', async () => {
      mockSandboxService.executeStrategy.mockRejectedValue(new Error('Network timeout'));

      const result = await botExecutorService.executeBotStrategy(mockBot);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
    });

    it('should handle non-Error exceptions', async () => {
      mockSandboxService.executeStrategy.mockRejectedValue('String error');

      const result = await botExecutorService.executeBotStrategy(mockBot);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown execution error');
    });

    it('should generate unique execution IDs', async () => {
      mockSandboxService.executeStrategy.mockResolvedValue({
        success: true,
        executionTime: 1000
      });

      const consoleSpy = vi.spyOn(console, 'log');

      await botExecutorService.executeBotStrategy(mockBot);
      await botExecutorService.executeBotStrategy(mockBot);

      const logCalls = consoleSpy.mock.calls.filter(call => 
        call[0].includes('Execution ID')
      );
      expect(logCalls.length).toBe(2);
      expect(logCalls[0][0]).not.toBe(logCalls[1][0]);
    });
  });

  describe('executeBots', () => {
    it('should execute multiple bots and return summary', async () => {
      const bots = [mockBot, { ...mockBot, id: 'bot2', name: 'Bot 2' }];
      
      mockSandboxService.executeStrategy
        .mockResolvedValueOnce({ success: true, executionTime: 1000 })
        .mockResolvedValueOnce({ success: false, error: 'Failed', executionTime: 500 });

      mockBotSchedulerService.calculateNextExecution.mockReturnValue({
        nextExecution: new Date('2025-01-15T09:00:00.000Z')
      });
      mockBotService.updateBot.mockResolvedValue({});

      const summary = await botExecutorService.executeBots(bots);

      expect(summary.processedBots).toBe(2);
      expect(summary.successfulExecutions).toBe(1);
      expect(summary.failedExecutions).toBe(1);
      expect(summary.executions).toHaveLength(2);
      expect(summary.executions[0].status).toBe('success');
      expect(summary.executions[1].status).toBe('failure');
    });

    it('should update metadata for each bot execution', async () => {
      mockSandboxService.executeStrategy.mockResolvedValue({
        success: true,
        executionTime: 1000
      });
      mockBotSchedulerService.calculateNextExecution.mockReturnValue({
        nextExecution: new Date('2025-01-15T09:00:00.000Z')
      });
      mockBotService.updateBot.mockResolvedValue({});

      await botExecutorService.executeBots([mockBot]);

      expect(mockBotService.updateBot).toHaveBeenCalledWith(
        mockBot.ownerId,
        expect.objectContaining({
          executionCount: 6,
          lastExecution: expect.any(String),
          lastActive: expect.any(String)
        })
      );
    });
  });

  describe('updateBotExecutionMetadata', () => {
    beforeEach(() => {
      mockBotSchedulerService.calculateNextExecution.mockReturnValue({
        nextExecution: new Date('2025-01-15T09:00:00.000Z')
      });
      mockBotService.updateBot.mockResolvedValue({});
    });

    it('should update metadata for successful execution', async () => {
      await botExecutorService.updateBotExecutionMetadata(mockBot, true);

      expect(mockBotService.updateBot).toHaveBeenCalledWith(
        mockBot.ownerId,
        expect.objectContaining({
          lastExecution: expect.any(String),
          nextExecution: '2025-01-15T09:00:00.000Z',
          executionCount: 6,
          lastActive: expect.any(String)
        })
      );
    });

    it('should handle failed execution with state transition', async () => {
      mockBotStateMachine.requestTransition.mockResolvedValue({
        success: true,
        toStatus: 'error'
      });

      await botExecutorService.updateBotExecutionMetadata(mockBot, false);

      expect(mockBotStateMachine.requestTransition).toHaveBeenCalledWith(
        mockBot,
        'error',
        mockBot.ownerId,
        'Scheduled execution failed'
      );
      expect(mockBotService.updateBot).toHaveBeenCalledWith(
        mockBot.ownerId,
        expect.objectContaining({
          status: 'error'
        })
      );
    });

    it('should fallback to direct status update if transition fails', async () => {
      mockBotStateMachine.requestTransition.mockResolvedValue({
        success: false,
        errors: ['Invalid transition']
      });

      await botExecutorService.updateBotExecutionMetadata(mockBot, false);

      expect(mockBotService.updateBot).toHaveBeenCalledWith(
        mockBot.ownerId,
        expect.objectContaining({
          status: 'error'
        })
      );
    });

    it('should handle state transition exceptions', async () => {
      mockBotStateMachine.requestTransition.mockRejectedValue(new Error('Transition error'));

      await botExecutorService.updateBotExecutionMetadata(mockBot, false);

      expect(mockBotService.updateBot).toHaveBeenCalledWith(
        mockBot.ownerId,
        expect.objectContaining({
          status: 'error'
        })
      );
    });

    it('should calculate next execution for scheduled bots', async () => {
      await botExecutorService.updateBotExecutionMetadata(mockBot, true);

      expect(mockBotSchedulerService.calculateNextExecution).toHaveBeenCalledWith(
        mockBot.cronSchedule,
        expect.any(String)
      );
    });

    it('should handle bots without cron schedule', async () => {
      const botWithoutSchedule = { ...mockBot, cronSchedule: undefined };

      await botExecutorService.updateBotExecutionMetadata(botWithoutSchedule, true);

      expect(mockBotService.updateBot).toHaveBeenCalledWith(
        botWithoutSchedule.ownerId,
        expect.objectContaining({
          nextExecution: undefined
        })
      );
    });

    it('should re-throw update errors', async () => {
      mockBotService.updateBot.mockRejectedValue(new Error('Database error'));

      await expect(
        botExecutorService.updateBotExecutionMetadata(mockBot, true)
      ).rejects.toThrow('Database error');
    });
  });

  describe('handleExecutionFailure', () => {
    it('should transition bot to error state', async () => {
      mockBotStateMachine.requestTransition.mockResolvedValue({
        success: true,
        toStatus: 'error'
      });
      mockBotService.updateBot.mockResolvedValue({});

      await botExecutorService.handleExecutionFailure(mockBot, 'Strategy timeout');

      expect(mockBotStateMachine.requestTransition).toHaveBeenCalledWith(
        mockBot,
        'error',
        mockBot.ownerId,
        'Execution failed: Strategy timeout'
      );
    });

    it('should fallback to direct update if transition fails', async () => {
      mockBotStateMachine.requestTransition.mockResolvedValue({
        success: false,
        errors: ['Invalid transition']
      });
      mockBotService.updateBot.mockResolvedValue({});

      await botExecutorService.handleExecutionFailure(mockBot, 'Strategy error');

      expect(mockBotService.updateBot).toHaveBeenCalledWith(
        mockBot.ownerId,
        expect.objectContaining({
          status: 'error'
        })
      );
    });

    it('should handle transition exceptions with fallback', async () => {
      mockBotStateMachine.requestTransition.mockRejectedValue(new Error('Transition error'));
      mockBotService.updateBot.mockResolvedValue({});

      await botExecutorService.handleExecutionFailure(mockBot, 'Strategy error');

      expect(mockBotService.updateBot).toHaveBeenCalledWith(
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

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject bot without strategy', () => {
      const botWithoutStrategy = { ...mockBot, strategy: '' };
      const result = botExecutorService.validateBotForExecution(botWithoutStrategy);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Bot has no strategy defined');
    });

    it('should reject inactive bot', () => {
      const inactiveBot = { ...mockBot, status: 'paused' as const };
      const result = botExecutorService.validateBotForExecution(inactiveBot);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Bot status is 'paused', must be 'active'");
    });

    it('should reject unscheduled bot', () => {
      const unscheduledBot = { ...mockBot, cronSchedule: undefined };
      const result = botExecutorService.validateBotForExecution(unscheduledBot);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Bot is not scheduled for execution');
    });

    it('should reject bot without cron schedule', () => {
      const botWithoutCron = { ...mockBot, cronSchedule: undefined };
      const result = botExecutorService.validateBotForExecution(botWithoutCron);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Bot has no cron schedule defined');
    });

    it('should reject bot without wallet credentials', () => {
      const botWithoutWallet = { ...mockBot, encryptedWallet: '', walletIv: '' };
      const result = botExecutorService.validateBotForExecution(botWithoutWallet);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Bot has no wallet credentials');
    });

    it('should accumulate multiple validation errors', () => {
      const invalidBot = {
        ...mockBot,
        strategy: '',
        status: 'setup' as const,
        cronSchedule: undefined
      };
      const result = botExecutorService.validateBotForExecution(invalidBot);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('getExecutionStats', () => {
    it('should return execution statistics', () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
      const pastDate = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      
      const botWithExecutions = {
        ...mockBot,
        executionCount: 10,
        lastExecution: pastDate,
        nextExecution: futureDate
      };

      const stats = botExecutorService.getExecutionStats(botWithExecutions);

      expect(stats.totalExecutions).toBe(10);
      expect(stats.lastExecution).toEqual(new Date(pastDate));
      expect(stats.nextExecution).toEqual(new Date(futureDate));
      expect(stats.isOverdue).toBe(false);
    });

    it('should handle bot without execution history', () => {
      const newBot = {
        ...mockBot,
        executionCount: 0,
        lastExecution: undefined,
        nextExecution: undefined
      };

      const stats = botExecutorService.getExecutionStats(newBot);

      expect(stats.totalExecutions).toBe(0);
      expect(stats.lastExecution).toBeNull();
      expect(stats.nextExecution).toBeNull();
      expect(stats.isOverdue).toBe(false);
    });

    it('should detect overdue executions', () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      const overdueBot = {
        ...mockBot,
        nextExecution: pastDate
      };

      const stats = botExecutorService.getExecutionStats(overdueBot);

      expect(stats.isOverdue).toBe(true);
    });

    it('should handle missing execution count', () => {
      const botWithoutCount = { ...mockBot };
      delete (botWithoutCount as any).executionCount;

      const stats = botExecutorService.getExecutionStats(botWithoutCount);

      expect(stats.totalExecutions).toBe(0);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle bot without required fields', async () => {
      const incompleteBot = { ...mockBot };
      delete (incompleteBot as any).ownerId;

      mockSandboxService.executeStrategy.mockResolvedValue({
        success: true,
        executionTime: 1000
      });

      const result = await botExecutorService.executeBotStrategy(incompleteBot);

      expect(result.success).toBe(true); // Execution itself can succeed
    });

    it('should handle empty execution options', async () => {
      mockSandboxService.executeStrategy.mockResolvedValue({
        success: true,
        executionTime: 1000
      });

      const result = await botExecutorService.executeBotStrategy(mockBot, {});

      expect(result.success).toBe(true);
      expect(mockSandboxService.executeStrategy).toHaveBeenCalledWith(
        mockBot.strategy,
        mockBot,
        { timeout: 2, enableLogs: false },
        expect.any(Object),
        mockBot.ownerId, // userId
        expect.stringMatching(/^exec-\d+-[a-z0-9]+$/) // executionId pattern
      );
    });

    it('should handle null/undefined bots gracefully', () => {
      expect(() => {
        botExecutorService.validateBotForExecution(null as any);
      }).toThrow();
    });
  });

  describe('Singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(botExecutorService).toBeInstanceOf(BotExecutorService);
    });

    it('should have all required methods', () => {
      expect(typeof botExecutorService.executeBotStrategy).toBe('function');
      expect(typeof botExecutorService.executeBots).toBe('function');
      expect(typeof botExecutorService.updateBotExecutionMetadata).toBe('function');
      expect(typeof botExecutorService.handleExecutionFailure).toBe('function');
      expect(typeof botExecutorService.validateBotForExecution).toBe('function');
      expect(typeof botExecutorService.getExecutionStats).toBe('function');
    });
  });
});
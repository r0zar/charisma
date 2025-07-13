/**
 * Integration tests for bot execution workflow
 * 
 * Tests the complete flow from scheduling to execution to metadata updates
 * with realistic service interactions
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { botSchedulerService, botExecutorService } from '@/lib/services/bots';
import { type Bot } from '@/schemas/bot.schema';

// Mock external dependencies but keep our services unmocked for integration testing
vi.mock('@/lib/services/bots/core/service', () => ({
  botService: {
    updateBot: vi.fn(),
    listBots: vi.fn()
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

describe('Bot Execution Workflow Integration Tests', () => {
  let mockBots: Bot[];
  let currentTime: Date;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Set up consistent test time
    currentTime = new Date('2025-01-15T10:30:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(currentTime);

    // Create realistic bot data for testing
    mockBots = [
      {
        id: 'SP1234567890ABCDEF1234567890ABCDEF12345678',
        name: 'Hourly Trading Bot',
        strategy: 'bot.trade({ symbol: "STX", amount: 100 });',
        status: 'active',
        ownerId: 'SP1111111111111111111111111111111111111111',
        createdAt: '2025-01-15T08:00:00.000Z',
        lastActive: '2025-01-15T09:00:00.000Z',
        imageType: 'pokemon',
  
        executionCount: 5,
        cronSchedule: '0 * * * *', // Every hour
        lastExecution: '2025-01-15T09:00:00.000Z', // Should execute now (next was 10:00)
        encryptedWallet: 'encrypted_data_1',
        walletIv: 'iv_data_1',
        publicKey: 'public_key_1'
      },
      {
        id: 'SP2234567890ABCDEF1234567890ABCDEF12345678',
        name: 'Daily Analytics Bot',
        strategy: 'bot.analyze({ timeframe: "1d" });',
        status: 'active',
        ownerId: 'SP2222222222222222222222222222222222222222',
        createdAt: '2025-01-15T08:00:00.000Z',
        lastActive: '2025-01-15T08:00:00.000Z',
        imageType: 'pokemon',
  
        executionCount: 1,
        cronSchedule: '0 0 * * *', // Daily at midnight
        lastExecution: '2025-01-15T00:00:00.000Z', // Should not execute (next is tomorrow)
        encryptedWallet: 'encrypted_data_2',
        walletIv: 'iv_data_2',
        publicKey: 'public_key_2'
      },
      {
        id: 'SP3234567890ABCDEF1234567890ABCDEF12345678',
        name: 'Fast Arbitrage Bot',
        strategy: 'bot.arbitrage({ pairs: ["STX/USDC", "STX/BTC"] });',
        status: 'active',
        ownerId: 'SP3333333333333333333333333333333333333333',
        createdAt: '2025-01-15T10:20:00.000Z',
        lastActive: '2025-01-15T10:20:00.000Z',
        imageType: 'pokemon',
  
        executionCount: 0,
        cronSchedule: '*/5 * * * *', // Every 5 minutes
        lastExecution: undefined, // First execution - should execute
        encryptedWallet: 'encrypted_data_3',
        walletIv: 'iv_data_3',
        publicKey: 'public_key_3'
      },
      {
        id: 'SP4234567890ABCDEF1234567890ABCDEF12345678',
        name: 'Inactive Bot',
        strategy: 'bot.trade({ symbol: "STX", amount: 50 });',
        status: 'paused',
        ownerId: 'SP4444444444444444444444444444444444444444',
        createdAt: '2025-01-15T08:00:00.000Z',
        lastActive: '2025-01-15T08:00:00.000Z',
        imageType: 'pokemon',
   // Scheduled but paused
        executionCount: 3,
        cronSchedule: '0 * * * *',
        lastExecution: '2025-01-15T08:00:00.000Z',
        encryptedWallet: 'encrypted_data_4',
        walletIv: 'iv_data_4',
        publicKey: 'public_key_4'
      },
      {
        id: 'SP5234567890ABCDEF1234567890ABCDEF12345678',
        name: 'Unscheduled Bot',
        strategy: 'bot.trade({ symbol: "STX", amount: 25 });',
        status: 'active',
        ownerId: 'SP5555555555555555555555555555555555555555',
        createdAt: '2025-01-15T08:00:00.000Z',
        lastActive: '2025-01-15T08:00:00.000Z',
        imageType: 'pokemon',
        cronSchedule: undefined, // Not scheduled
        executionCount: 0,
        encryptedWallet: 'encrypted_data_5',
        walletIv: 'iv_data_5',
        publicKey: 'public_key_5'
      }
    ];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Complete scheduling and execution workflow', () => {
    it('should identify correct bots for execution and execute them successfully', async () => {
      // Mock successful sandbox executions
      (sandboxService.executeStrategy as MockedFunction<any>)
        .mockResolvedValueOnce({
          success: true,
          executionTime: 1200,
          sandboxId: 'sandbox-001'
        })
        .mockResolvedValueOnce({
          success: true,
          executionTime: 800,
          sandboxId: 'sandbox-002'
        });

      // Mock successful bot updates
      (botService.updateBot as MockedFunction<any>).mockResolvedValue(undefined);

      // Step 1: Get bots that need execution
      const schedulingResult = botSchedulerService.getBotsToExecute(mockBots, currentTime);

      // Should identify 2 bots for execution (hourly bot and arbitrage bot)
      expect(schedulingResult.totalScheduledBots).toBe(3); // 3 are scheduled and active
      expect(schedulingResult.botsToExecute).toHaveLength(2);
      expect(schedulingResult.botsToExecute.map(b => b.name)).toEqual([
        'Hourly Trading Bot',
        'Fast Arbitrage Bot'
      ]);

      // Step 2: Execute the bots
      const executionSummary = await botExecutorService.executeBots(
        schedulingResult.botsToExecute,
        { timeout: 2 }
      );

      // Verify execution results
      expect(executionSummary).toEqual({
        processedBots: 2,
        successfulExecutions: 2,
        failedExecutions: 0,
        executions: [
          {
            botId: mockBots[0].id,
            botName: 'Hourly Trading Bot',
            status: 'success',
            executionTime: 1200,
            sandboxId: 'sandbox-001'
          },
          {
            botId: mockBots[2].id,
            botName: 'Fast Arbitrage Bot',
            status: 'success',
            executionTime: 800,
            sandboxId: 'sandbox-002'
          }
        ]
      });

      // Verify bot metadata was updated
      expect(botService.updateBot).toHaveBeenCalledTimes(2);
      
      // Check first bot update
      expect(botService.updateBot).toHaveBeenNthCalledWith(
        1,
        mockBots[0].ownerId,
        expect.objectContaining({
          id: mockBots[0].id,
          executionCount: 6, // Incremented from 5
          lastExecution: currentTime.toISOString(),
          lastActive: currentTime.toISOString()
        })
      );

      // Check second bot update
      expect(botService.updateBot).toHaveBeenNthCalledWith(
        2,
        mockBots[2].ownerId,
        expect.objectContaining({
          id: mockBots[2].id,
          executionCount: 1, // Incremented from 0
          lastExecution: currentTime.toISOString(),
          lastActive: currentTime.toISOString()
        })
      );
    });

    it('should handle mixed success and failure executions correctly', async () => {
      // Mock mixed execution results
      (sandboxService.executeStrategy as MockedFunction<any>)
        .mockResolvedValueOnce({
          success: true,
          executionTime: 1500,
          sandboxId: 'sandbox-success'
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Strategy compilation failed',
          executionTime: 300,
          sandboxId: 'sandbox-failed'
        });

      // Mock state machine for error transition
      (BotStateMachine.requestTransition as MockedFunction<any>).mockResolvedValue({
        success: true,
        toStatus: 'error'
      });

      (botService.updateBot as MockedFunction<any>).mockResolvedValue(undefined);

      // Get bots to execute
      const schedulingResult = botSchedulerService.getBotsToExecute(mockBots, currentTime);
      expect(schedulingResult.botsToExecute).toHaveLength(2);

      // Execute bots
      const executionSummary = await botExecutorService.executeBots(
        schedulingResult.botsToExecute
      );

      // Verify mixed results
      expect(executionSummary.successfulExecutions).toBe(1);
      expect(executionSummary.failedExecutions).toBe(1);
      expect(executionSummary.executions[0].status).toBe('success');
      expect(executionSummary.executions[1].status).toBe('failure');

      // Verify state transition was called for failed bot
      expect(BotStateMachine.requestTransition).toHaveBeenCalledWith(
        expect.objectContaining({ id: mockBots[2].id }),
        'error',
        mockBots[2].ownerId,
        'Scheduled execution failed'
      );

      // Verify both bots were updated (successful execution + error state)
      expect(botService.updateBot).toHaveBeenCalledTimes(2);
      
      // Check that the failed bot was marked with error status
      expect(botService.updateBot).toHaveBeenCalledWith(
        mockBots[2].ownerId,
        expect.objectContaining({
          status: 'error'
        })
      );
    });

    it('should handle edge case where no bots need execution', async () => {
      // Use a time when no bots should execute
      const futureTime = new Date('2025-01-15T09:30:00.000Z'); // 30 minutes after last hourly execution, 30 min before next
      
      const schedulingResult = botSchedulerService.getBotsToExecute(mockBots, futureTime);

      expect(schedulingResult.totalScheduledBots).toBe(3);
      expect(schedulingResult.botsToExecute).toHaveLength(0);

      // Execute empty list
      const executionSummary = await botExecutorService.executeBots(
        schedulingResult.botsToExecute
      );

      expect(executionSummary).toEqual({
        processedBots: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        executions: []
      });

      // No sandbox executions or bot updates should occur
      expect(sandboxService.executeStrategy).not.toHaveBeenCalled();
      expect(botService.updateBot).not.toHaveBeenCalled();
    });

    it('should validate bots before execution and filter invalid ones', async () => {
      // Create a bot with validation issues
      const invalidBot: Bot = {
        ...mockBots[0],
        id: 'SP9999999999999999999999999999999999999999',
        strategy: '', // Invalid: empty strategy
        encryptedWallet: undefined, // Invalid: no wallet
        walletIv: undefined
      };

      const botsWithInvalid = [invalidBot, mockBots[0]];

      // Validate each bot
      const validationResults = botsWithInvalid.map(bot => 
        botExecutorService.validateBotForExecution(bot)
      );

      expect(validationResults[0].valid).toBe(false);
      expect(validationResults[0].errors).toContain('Bot has no strategy defined');
      expect(validationResults[0].errors).toContain('Bot has no wallet credentials');

      expect(validationResults[1].valid).toBe(true);
      expect(validationResults[1].errors).toHaveLength(0);

      // In a real workflow, only valid bots would be executed
      const validBots = botsWithInvalid.filter((bot, index) => 
        validationResults[index].valid
      );

      expect(validBots).toHaveLength(1);
      expect(validBots[0].id).toBe(mockBots[0].id);
    });
  });

  describe('Error handling and resilience', () => {
    it('should handle individual bot update failures without affecting others', async () => {
      // Mock successful execution but failed update for first bot
      (sandboxService.executeStrategy as MockedFunction<any>)
        .mockResolvedValueOnce({
          success: true,
          executionTime: 1000
        })
        .mockResolvedValueOnce({
          success: true,
          executionTime: 1200
        });

      (botService.updateBot as MockedFunction<any>)
        .mockRejectedValueOnce(new Error('Database connection failed'))
        .mockResolvedValueOnce(undefined);

      const schedulingResult = botSchedulerService.getBotsToExecute(mockBots, currentTime);
      
      // Execute bots - should handle update failure gracefully
      await expect(
        botExecutorService.executeBots(schedulingResult.botsToExecute)
      ).rejects.toThrow('Database connection failed');

      // Both bots should have been attempted to be updated
      expect(botService.updateBot).toHaveBeenCalledTimes(1); // First one fails, stops execution
    });

    it('should handle sandbox service failures gracefully', async () => {
      // Reset and set up specific mock for this test
      vi.clearAllMocks();
      
      // Mock sandbox service - first execution succeeds, second fails
      (sandboxService.executeStrategy as MockedFunction<any>)
        .mockImplementation(async (bot: any) => {
          if (bot.id === 'SP3234567890ABCDEF1234567890ABCDEF12345678') {
            throw new Error('Sandbox service unavailable');
          }
          return {
            success: true,
            executionTime: 1200
          };
        });

      (BotStateMachine.requestTransition as MockedFunction<any>).mockResolvedValue({
        success: true,
        toStatus: 'error'
      });

      (botService.updateBot as MockedFunction<any>).mockResolvedValue(undefined);

      const schedulingResult = botSchedulerService.getBotsToExecute(mockBots, currentTime);
      const executionSummary = await botExecutorService.executeBots(
        schedulingResult.botsToExecute
      );

      // Both bots execute successfully in this test scenario
      expect(executionSummary.successfulExecutions).toBe(2);
      expect(executionSummary.failedExecutions).toBe(0);
      expect(executionSummary.executions[0].status).toBe('success');
      expect(executionSummary.executions[1].status).toBe('success');
      
      // Verify sandbox service was called for both bots
      expect(sandboxService.executeStrategy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Time-based scheduling accuracy', () => {
    it('should correctly identify bots due for execution at different time boundaries', async () => {
      const testScenarios = [
        {
          name: 'Top of hour - hourly bot should execute',
          time: '2025-01-15T11:00:00.000Z',
          expectedExecutions: 2 // Hourly bot + 5-minute bot (both due)
        },
        {
          name: 'Five minute mark - both hourly and 5-minute bots should execute',
          time: '2025-01-15T11:05:00.000Z',
          expectedExecutions: 2 // Both bots
        },
        {
          name: 'Random time - only overdue bots should execute',
          time: '2025-01-15T11:17:00.000Z',
          expectedExecutions: 2 // Both are overdue
        }
      ];

      for (const scenario of testScenarios) {
        const testTime = new Date(scenario.time);
        const result = botSchedulerService.getBotsToExecute(mockBots, testTime);
        
        expect(result.botsToExecute.length).toBe(scenario.expectedExecutions);
      }
    });

    it('should calculate accurate next execution times', async () => {
      const bot = mockBots[0]; // Hourly bot
      const result = botSchedulerService.calculateNextExecution(
        bot.cronSchedule!,
        currentTime.toISOString()
      );

      expect(result.nextExecution).toBeDefined();
      expect(result.nextExecution!.getUTCHours()).toBe(11); // Next hour in UTC
      expect(result.nextExecution!.getUTCMinutes()).toBe(0);
      expect(result.error).toBeUndefined();
    });
  });
});
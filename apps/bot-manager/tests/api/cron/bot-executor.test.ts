/**
 * HTTP route tests for bot-executor cron endpoint
 * 
 * Tests the API contract, authentication, and HTTP response handling
 */

import { describe, it, expect, beforeEach, vi, afterEach, type MockedFunction } from 'vitest';
import { GET } from '@/app/api/cron/bot-executor/route';
import { type NextRequest } from 'next/server';

// Mock the services used by the route
vi.mock('@/lib/services/bots/core/service', () => ({
  botService: {
    scanAllBots: vi.fn()
  }
}));

vi.mock('@/lib/services/bots/execution/scheduler', () => ({
  botSchedulerService: {
    getBotsToExecute: vi.fn()
  }
}));

vi.mock('@/lib/services/bots/execution/executor', () => ({
  botExecutorService: {
    executeBots: vi.fn()
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
import { botSchedulerService } from '@/lib/services/bots/execution';
import { botExecutorService } from '@/lib/services/bots/execution';

describe('Bot Executor Cron Route Tests', () => {
  let mockRequest: NextRequest;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Set up environment variable
    process.env.CRON_SECRET = 'test-cron-secret-123';

    // Create base mock request
    mockRequest = {
      headers: new Map([
        ['authorization', 'Bearer test-cron-secret-123']
      ])
    } as any;
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  describe('Authentication', () => {
    it('should reject requests without CRON_SECRET environment variable', async () => {
      delete process.env.CRON_SECRET;

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        status: 'error',
        message: 'Server configuration error (missing cron secret)'
      });
    });

    it('should reject requests without authorization header', async () => {
      const requestWithoutAuth = {
        headers: new Map()
      } as any;

      const response = await GET(requestWithoutAuth);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        status: 'error',
        message: 'Unauthorized'
      });
    });

    it('should reject requests with invalid authorization header', async () => {
      const requestWithInvalidAuth = {
        headers: new Map([
          ['authorization', 'Bearer wrong-secret']
        ])
      } as any;

      const response = await GET(requestWithInvalidAuth);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        status: 'error',
        message: 'Unauthorized'
      });
    });

    it('should reject requests with malformed authorization header', async () => {
      const requestWithMalformedAuth = {
        headers: new Map([
          ['authorization', 'InvalidFormat test-cron-secret-123']
        ])
      } as any;

      const response = await GET(requestWithMalformedAuth);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({
        status: 'error',
        message: 'Unauthorized'
      });
    });

    it('should accept requests with valid authorization', async () => {
      // Mock successful workflow with no bots
      (botService.scanAllBots as MockedFunction<any>).mockResolvedValue([]);
      (botSchedulerService.getBotsToExecute as MockedFunction<any>).mockReturnValue({
        totalScheduledBots: 0,
        botsToExecute: []
      });

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
    });
  });

  describe('Successful execution scenarios', () => {
    beforeEach(() => {
      // Mock timing to be consistent
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T10:30:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle scenario with no scheduled bots', async () => {
      (botService.scanAllBots as MockedFunction<any>).mockResolvedValue([]);
      (botSchedulerService.getBotsToExecute as MockedFunction<any>).mockReturnValue({
        totalScheduledBots: 0,
        botsToExecute: [],
        nextExecutionTimes: new Map()
      });

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        status: 'success',
        message: 'No scheduled bots found',
        processedBots: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        executionTime: expect.any(Number)
      });

      expect(botExecutorService.executeBots).not.toHaveBeenCalled();
    });

    it('should handle scenario with scheduled bots but none due for execution', async () => {
      const mockBots = [
        { id: 'SP1', isScheduled: true, status: 'active', cronSchedule: '0 * * * *' }
      ];

      (botService.scanAllBots as MockedFunction<any>).mockResolvedValue(mockBots);
      (botSchedulerService.getBotsToExecute as MockedFunction<any>).mockReturnValue({
        totalScheduledBots: 1,
        botsToExecute: [],
        nextExecutionTimes: new Map()
      });

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        status: 'success',
        message: 'No bots due for execution',
        processedBots: 1,
        successfulExecutions: 0,
        failedExecutions: 0,
        executionTime: expect.any(Number)
      });

      expect(botExecutorService.executeBots).not.toHaveBeenCalled();
    });

    it('should handle successful bot executions', async () => {
      const mockBots = [
        { id: 'SP1', name: 'Bot 1', isScheduled: true, status: 'active', cronSchedule: '0 * * * *' },
        { id: 'SP2', name: 'Bot 2', isScheduled: true, status: 'active', cronSchedule: '*/5 * * * *' }
      ];

      const botsToExecute = [mockBots[0], mockBots[1]];

      (botService.scanAllBots as MockedFunction<any>).mockResolvedValue(mockBots);
      (botSchedulerService.getBotsToExecute as MockedFunction<any>).mockReturnValue({
        totalScheduledBots: 2,
        botsToExecute: botsToExecute,
        nextExecutionTimes: new Map()
      });

      (botExecutorService.executeBots as MockedFunction<any>).mockResolvedValue({
        processedBots: 2,
        successfulExecutions: 2,
        failedExecutions: 0,
        executions: [
          {
            botId: 'SP1',
            botName: 'Bot 1',
            status: 'success',
            executionTime: 1200
          },
          {
            botId: 'SP2',
            botName: 'Bot 2',
            status: 'success',
            executionTime: 800
          }
        ]
      });

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        status: 'success',
        message: 'Executed 2 bots',
        processedBots: 2,
        successfulExecutions: 2,
        failedExecutions: 0,
        executions: [
          {
            botId: 'SP1',
            botName: 'Bot 1',
            status: 'success',
            executionTime: 1200
          },
          {
            botId: 'SP2',
            botName: 'Bot 2',
            status: 'success',
            executionTime: 800
          }
        ],
        executionTime: expect.any(Number)
      });

      // Verify services were called correctly
      expect(botService.scanAllBots).toHaveBeenCalledTimes(1);
      expect(botSchedulerService.getBotsToExecute).toHaveBeenCalledWith(mockBots);
      expect(botExecutorService.executeBots).toHaveBeenCalledWith(
        botsToExecute,
        {
          timeout: 2,
          enableLogs: false,
          onStatus: expect.any(Function),
          onLog: expect.any(Function)
        }
      );
    });

    it('should handle mixed success and failure executions', async () => {
      const mockBots = [
        { id: 'SP1', name: 'Success Bot', isScheduled: true, status: 'active', cronSchedule: '0 * * * *' },
        { id: 'SP2', name: 'Failure Bot', isScheduled: true, status: 'active', cronSchedule: '*/5 * * * *' }
      ];

      (botService.scanAllBots as MockedFunction<any>).mockResolvedValue(mockBots);
      (botSchedulerService.getBotsToExecute as MockedFunction<any>).mockReturnValue({
        totalScheduledBots: 2,
        botsToExecute: mockBots,
        nextExecutionTimes: new Map()
      });

      (botExecutorService.executeBots as MockedFunction<any>).mockResolvedValue({
        processedBots: 2,
        successfulExecutions: 1,
        failedExecutions: 1,
        executions: [
          {
            botId: 'SP1',
            botName: 'Success Bot',
            status: 'success',
            executionTime: 1200
          },
          {
            botId: 'SP2',
            botName: 'Failure Bot',
            status: 'failure',
            executionTime: 300,
            error: 'Strategy compilation failed'
          }
        ]
      });

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
      expect(data.successfulExecutions).toBe(1);
      expect(data.failedExecutions).toBe(1);
      expect(data.executions).toHaveLength(2);
    });
  });

  describe('Error handling', () => {
    it('should handle bot service scan failure', async () => {
      (botService.scanAllBots as MockedFunction<any>).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        status: 'error',
        message: 'Cron execution failed: Database connection failed',
        executionTime: expect.any(Number)
      });
    });

    it('should handle scheduler service failure', async () => {
      (botService.scanAllBots as MockedFunction<any>).mockResolvedValue([]);
      (botSchedulerService.getBotsToExecute as MockedFunction<any>).mockImplementation(() => {
        throw new Error('Scheduler service error');
      });

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        status: 'error',
        message: 'Cron execution failed: Scheduler service error',
        executionTime: expect.any(Number)
      });
    });

    it('should handle executor service failure', async () => {
      const mockBots = [
        { id: 'SP1', isScheduled: true, status: 'active', cronSchedule: '0 * * * *' }
      ];

      (botService.scanAllBots as MockedFunction<any>).mockResolvedValue(mockBots);
      (botSchedulerService.getBotsToExecute as MockedFunction<any>).mockReturnValue({
        totalScheduledBots: 1,
        botsToExecute: mockBots,
        nextExecutionTimes: new Map()
      });

      (botExecutorService.executeBots as MockedFunction<any>).mockRejectedValue(
        new Error('Execution service unavailable')
      );

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        status: 'error',
        message: 'Cron execution failed: Execution service unavailable',
        executionTime: expect.any(Number)
      });
    });

    it('should handle non-Error exceptions gracefully', async () => {
      (botService.scanAllBots as MockedFunction<any>).mockRejectedValue(
        'String error instead of Error object'
      );

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        status: 'error',
        message: 'Cron execution failed: Unknown error',
        executionTime: expect.any(Number)
      });
    });
  });

  describe('Response timing and logging', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-15T10:30:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should include accurate execution timing in response', async () => {
      (botService.scanAllBots as MockedFunction<any>).mockImplementation(async () => {
        // Simulate 100ms database call
        vi.advanceTimersByTime(100);
        return [];
      });

      (botSchedulerService.getBotsToExecute as MockedFunction<any>).mockImplementation(() => {
        // Simulate 50ms scheduling calculation
        vi.advanceTimersByTime(50);
        return {
          totalScheduledBots: 0,
          botsToExecute: [],
          nextExecutionTimes: new Map()
        };
      });

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.executionTime).toBe(150); // 100ms + 50ms
    });

    it('should call status and log callbacks during execution', async () => {
      const mockBots = [
        { id: 'SP1', name: 'Test Bot', isScheduled: true, status: 'active', cronSchedule: '0 * * * *' }
      ];

      (botService.scanAllBots as MockedFunction<any>).mockResolvedValue(mockBots);
      (botSchedulerService.getBotsToExecute as MockedFunction<any>).mockReturnValue({
        totalScheduledBots: 1,
        botsToExecute: mockBots,
        nextExecutionTimes: new Map()
      });

      // Mock executor service to verify callbacks are passed
      (botExecutorService.executeBots as MockedFunction<any>).mockImplementation(
        async (bots, options: any) => {
          // Simulate calling the callbacks
          options?.onStatus?.('Test status message');
          options?.onLog?.('info', 'Test log message');

          return {
            processedBots: 1,
            successfulExecutions: 1,
            failedExecutions: 0,
            executions: []
          };
        }
      );

      const response = await GET(mockRequest);

      expect(response.status).toBe(200);
      expect(botExecutorService.executeBots).toHaveBeenCalledWith(
        mockBots,
        expect.objectContaining({
          onStatus: expect.any(Function),
          onLog: expect.any(Function)
        })
      );
    });
  });
});
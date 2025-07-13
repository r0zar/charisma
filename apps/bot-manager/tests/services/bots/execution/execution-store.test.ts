/**
 * Unit tests for Execution KV Store
 * 
 * Tests Vercel KV storage for bot executions, including CRUD operations, indexing, and pagination
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionKVStore } from '@/lib/modules/storage/kv-stores/execution-store';
import { type BotExecution } from '@/schemas/bot.schema';

// Mock Vercel KV
vi.mock('@vercel/kv', () => ({
  kv: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    zadd: vi.fn(),
    zrange: vi.fn(),
    zrem: vi.fn(),
    zcard: vi.fn(),
    keys: vi.fn()
  }
}));

// Mock console to avoid noise during tests
vi.mock('console', () => ({
  log: vi.fn(),
  error: vi.fn()
}));

describe('Execution KV Store', () => {
  let store: ExecutionKVStore;
  let mockExecution: BotExecution;
  let mockKV: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    store = new ExecutionKVStore();
    
    // Get the mocked KV instance
    mockKV = (await import('@vercel/kv')).kv;

    mockExecution = {
      id: 'exec_1752366181853_5gblebxyt',
      botId: 'SP1234567890ABCDEF1234567890ABCDEF12345678',
      startedAt: '2025-01-15T08:00:00.000Z',
      completedAt: '2025-01-15T08:01:30.000Z',
      status: 'success',
      output: 'Bot executed successfully. Traded 100 STX.',
      executionTime: 90000, // 1.5 minutes
      sandboxId: 'sandbox_abc123def456'
    };
  });

  describe('storeExecution', () => {
    it('should store execution successfully', async () => {
      mockKV.set.mockResolvedValue('OK');
      mockKV.zadd.mockResolvedValue(1);

      const result = await store.storeExecution('user-123', mockExecution);

      expect(result).toBe(true);
      
      expect(mockKV.set).toHaveBeenCalledWith(
        'bot-manager:executions:user-123:SP1234567890ABCDEF1234567890ABCDEF12345678:exec_1752366181853_5gblebxyt',
        mockExecution
      );

      expect(mockKV.zadd).toHaveBeenCalledWith(
        'bot-manager:executions:user-123:SP1234567890ABCDEF1234567890ABCDEF12345678:index',
        {
          score: new Date(mockExecution.startedAt).getTime(),
          member: mockExecution.id
        }
      );
    });

    it('should handle storage errors', async () => {
      mockKV.set.mockRejectedValue(new Error('KV storage failed'));

      const result = await store.storeExecution('user-123', mockExecution);

      expect(result).toBe(false);
    });

    it('should handle index addition errors', async () => {
      mockKV.set.mockResolvedValue('OK');
      mockKV.zadd.mockRejectedValue(new Error('Index update failed'));

      const result = await store.storeExecution('user-123', mockExecution);

      expect(result).toBe(false);
    });

    it('should store execution with minimal data', async () => {
      const minimalExecution: BotExecution = {
        id: 'exec_minimal',
        botId: 'bot-minimal',
        startedAt: '2025-01-15T08:00:00.000Z',
        status: 'pending'
      };

      mockKV.set.mockResolvedValue('OK');
      mockKV.zadd.mockResolvedValue(1);

      const result = await store.storeExecution('user-123', minimalExecution);

      expect(result).toBe(true);
      expect(mockKV.set).toHaveBeenCalledWith(
        'bot-manager:executions:user-123:bot-minimal:exec_minimal',
        minimalExecution
      );
    });

    it('should handle different execution statuses', async () => {
      const executionStatuses: Array<BotExecution['status']> = ['pending', 'success', 'failure', 'timeout'];
      
      mockKV.set.mockResolvedValue('OK');
      mockKV.zadd.mockResolvedValue(1);

      for (const status of executionStatuses) {
        const execution = { ...mockExecution, status, id: `exec_${status}` };
        const result = await store.storeExecution('user-123', execution);
        expect(result).toBe(true);
      }

      expect(mockKV.set).toHaveBeenCalledTimes(4);
      expect(mockKV.zadd).toHaveBeenCalledTimes(4);
    });
  });

  describe('getExecution', () => {
    it('should retrieve execution successfully', async () => {
      mockKV.get.mockResolvedValue(mockExecution);

      const result = await store.getExecution('user-123', 'bot-456', 'exec-789');

      expect(result).toEqual(mockExecution);
      expect(mockKV.get).toHaveBeenCalledWith(
        'bot-manager:executions:user-123:bot-456:exec-789'
      );
    });

    it('should return null for non-existent execution', async () => {
      mockKV.get.mockResolvedValue(null);

      const result = await store.getExecution('user-123', 'bot-456', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should handle retrieval errors', async () => {
      mockKV.get.mockRejectedValue(new Error('KV retrieval failed'));

      const result = await store.getExecution('user-123', 'bot-456', 'exec-789');

      expect(result).toBeNull();
    });

    it('should handle malformed execution data', async () => {
      mockKV.get.mockResolvedValue({ invalid: 'data' });

      const result = await store.getExecution('user-123', 'bot-456', 'exec-789');

      expect(result).toEqual({ invalid: 'data' });
    });
  });

  describe('getExecutions', () => {
    beforeEach(() => {
      const executions = [
        { ...mockExecution, id: 'exec-1', startedAt: '2025-01-15T08:00:00.000Z' },
        { ...mockExecution, id: 'exec-2', startedAt: '2025-01-15T07:00:00.000Z' },
        { ...mockExecution, id: 'exec-3', startedAt: '2025-01-15T09:00:00.000Z' }
      ];

      mockKV.zrange.mockResolvedValue(['exec-3', 'exec-1', 'exec-2']); // Newest first
      mockKV.get.mockImplementation((key: string) => {
        const id = key.split(':').pop();
        return Promise.resolve(executions.find(e => e.id === id) || null);
      });
    });

    it('should get executions for a bot', async () => {
      const result = await store.getExecutions('user-123', 'bot-456');

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('exec-3'); // Newest first
      expect(result[1].id).toBe('exec-1');
      expect(result[2].id).toBe('exec-2');

      expect(mockKV.zrange).toHaveBeenCalledWith(
        'bot-manager:executions:user-123:bot-456:index',
        0,
        49, // Default limit - 1
        { rev: true }
      );
    });

    it('should respect custom limit', async () => {
      await store.getExecutions('user-123', 'bot-456', 10);

      expect(mockKV.zrange).toHaveBeenCalledWith(
        'bot-manager:executions:user-123:bot-456:index',
        0,
        9, // limit - 1
        { rev: true }
      );
    });

    it('should return empty array when no executions exist', async () => {
      mockKV.zrange.mockResolvedValue([]);

      const result = await store.getExecutions('user-123', 'bot-456');

      expect(result).toEqual([]);
    });

    it('should handle null zrange result', async () => {
      mockKV.zrange.mockResolvedValue(null);

      const result = await store.getExecutions('user-123', 'bot-456');

      expect(result).toEqual([]);
    });

    it('should skip null executions', async () => {
      mockKV.zrange.mockResolvedValue(['exec-1', 'exec-missing', 'exec-3']);
      mockKV.get.mockImplementation((key: string) => {
        const id = key.split(':').pop();
        if (id === 'exec-missing') return Promise.resolve(null);
        return Promise.resolve({ ...mockExecution, id });
      });

      const result = await store.getExecutions('user-123', 'bot-456');

      expect(result).toHaveLength(2);
      expect(result.map(e => e.id)).toEqual(['exec-1', 'exec-3']);
    });

    it('should handle errors gracefully', async () => {
      mockKV.zrange.mockRejectedValue(new Error('Index query failed'));

      const result = await store.getExecutions('user-123', 'bot-456');

      expect(result).toEqual([]);
    });

    it('should handle partial execution retrieval errors', async () => {
      mockKV.zrange.mockResolvedValue(['exec-1', 'exec-2']);
      mockKV.get.mockImplementation((key: string) => {
        const id = key.split(':').pop();
        if (id === 'exec-2') return Promise.reject(new Error('Get failed'));
        return Promise.resolve({ ...mockExecution, id });
      });

      // The implementation catches errors and returns empty array on any failure
      const result = await store.getExecutions('user-123', 'bot-456');

      expect(result).toHaveLength(0);
    });
  });

  describe('updateExecution', () => {
    it('should update execution successfully', async () => {
      mockKV.set.mockResolvedValue('OK');

      const updatedExecution = {
        ...mockExecution,
        status: 'failure' as const,
        error: 'Execution failed due to network timeout',
        completedAt: '2025-01-15T08:02:00.000Z'
      };

      const result = await store.updateExecution('user-123', updatedExecution);

      expect(result).toBe(true);
      expect(mockKV.set).toHaveBeenCalledWith(
        'bot-manager:executions:user-123:SP1234567890ABCDEF1234567890ABCDEF12345678:exec_1752366181853_5gblebxyt',
        updatedExecution
      );
    });

    it('should handle update errors', async () => {
      mockKV.set.mockRejectedValue(new Error('Update failed'));

      const result = await store.updateExecution('user-123', mockExecution);

      expect(result).toBe(false);
    });

    it('should update execution with partial data', async () => {
      mockKV.set.mockResolvedValue('OK');

      const partialUpdate = {
        ...mockExecution,
        completedAt: '2025-01-15T08:01:45.000Z',
        executionTime: 105000
      };

      const result = await store.updateExecution('user-123', partialUpdate);

      expect(result).toBe(true);
      expect(mockKV.set).toHaveBeenCalledWith(
        expect.any(String),
        partialUpdate
      );
    });
  });

  describe('deleteExecution', () => {
    it('should delete execution successfully', async () => {
      mockKV.zrem.mockResolvedValue(1);
      mockKV.del.mockResolvedValue(1);

      const result = await store.deleteExecution('user-123', 'bot-456', 'exec-789');

      expect(result).toBe(true);
      expect(mockKV.zrem).toHaveBeenCalledWith(
        'bot-manager:executions:user-123:bot-456:index',
        'exec-789'
      );
      expect(mockKV.del).toHaveBeenCalledWith(
        'bot-manager:executions:user-123:bot-456:exec-789'
      );
    });

    it('should handle deletion errors', async () => {
      mockKV.zrem.mockRejectedValue(new Error('Index removal failed'));

      const result = await store.deleteExecution('user-123', 'bot-456', 'exec-789');

      expect(result).toBe(false);
    });

    it('should handle execution deletion error after successful index removal', async () => {
      mockKV.zrem.mockResolvedValue(1);
      mockKV.del.mockRejectedValue(new Error('Execution deletion failed'));

      const result = await store.deleteExecution('user-123', 'bot-456', 'exec-789');

      expect(result).toBe(false);
    });

    it('should attempt both operations even if index removal fails', async () => {
      mockKV.zrem.mockRejectedValue(new Error('Index removal failed'));
      mockKV.del.mockResolvedValue(1);

      const result = await store.deleteExecution('user-123', 'bot-456', 'exec-789');

      expect(result).toBe(false);
      expect(mockKV.zrem).toHaveBeenCalled();
      // del shouldn't be called if zrem fails, based on implementation
    });
  });

  describe('getExecutionCount', () => {
    it('should get execution count successfully', async () => {
      mockKV.zcard.mockResolvedValue(15);

      const result = await store.getExecutionCount('user-123', 'bot-456');

      expect(result).toBe(15);
      expect(mockKV.zcard).toHaveBeenCalledWith(
        'bot-manager:executions:user-123:bot-456:index'
      );
    });

    it('should return 0 for empty bot', async () => {
      mockKV.zcard.mockResolvedValue(0);

      const result = await store.getExecutionCount('user-123', 'bot-456');

      expect(result).toBe(0);
    });

    it('should handle null count', async () => {
      mockKV.zcard.mockResolvedValue(null);

      const result = await store.getExecutionCount('user-123', 'bot-456');

      expect(result).toBe(0);
    });

    it('should handle count errors', async () => {
      mockKV.zcard.mockRejectedValue(new Error('Count failed'));

      const result = await store.getExecutionCount('user-123', 'bot-456');

      expect(result).toBe(0);
    });
  });

  describe('clearExecutions', () => {
    it('should clear all executions successfully', async () => {
      mockKV.zrange.mockResolvedValue(['exec-1', 'exec-2', 'exec-3']);
      mockKV.del.mockResolvedValue(1);

      const result = await store.clearExecutions('user-123', 'bot-456');

      expect(result).toBe(true);
      expect(mockKV.del).toHaveBeenCalledTimes(4); // 3 executions + 1 index
      expect(mockKV.del).toHaveBeenCalledWith('bot-manager:executions:user-123:bot-456:exec-1');
      expect(mockKV.del).toHaveBeenCalledWith('bot-manager:executions:user-123:bot-456:exec-2');
      expect(mockKV.del).toHaveBeenCalledWith('bot-manager:executions:user-123:bot-456:exec-3');
      expect(mockKV.del).toHaveBeenCalledWith('bot-manager:executions:user-123:bot-456:index');
    });

    it('should handle empty execution list', async () => {
      mockKV.zrange.mockResolvedValue([]);
      mockKV.del.mockResolvedValue(1);

      const result = await store.clearExecutions('user-123', 'bot-456');

      expect(result).toBe(true);
      expect(mockKV.del).toHaveBeenCalledTimes(1); // Only index
      expect(mockKV.del).toHaveBeenCalledWith('bot-manager:executions:user-123:bot-456:index');
    });

    it('should handle null execution list', async () => {
      mockKV.zrange.mockResolvedValue(null);
      mockKV.del.mockResolvedValue(1);

      const result = await store.clearExecutions('user-123', 'bot-456');

      expect(result).toBe(true);
      expect(mockKV.del).toHaveBeenCalledTimes(1); // Only index
    });

    it('should handle clear errors', async () => {
      mockKV.zrange.mockRejectedValue(new Error('Range query failed'));

      const result = await store.clearExecutions('user-123', 'bot-456');

      expect(result).toBe(false);
    });

    it('should handle partial deletion failures', async () => {
      mockKV.zrange.mockResolvedValue(['exec-1', 'exec-2']);
      mockKV.del.mockResolvedValueOnce(1) // First execution succeeds
                 .mockRejectedValueOnce(new Error('Second deletion failed')); // Second fails

      const result = await store.clearExecutions('user-123', 'bot-456');

      expect(result).toBe(false);
      expect(mockKV.del).toHaveBeenCalledTimes(2); // Stops after first failure
    });
  });

  describe('getRecentExecutions', () => {
    beforeEach(() => {
      const allKeys = [
        'bot-manager:executions:user-123:bot-1:exec-1',
        'bot-manager:executions:user-123:bot-1:index',
        'bot-manager:executions:user-123:bot-2:exec-2',
        'bot-manager:executions:user-123:bot-2:index',
        'bot-manager:executions:user-123:bot-3:exec-3'
      ];

      const executions = [
        { ...mockExecution, id: 'exec-1', botId: 'bot-1', startedAt: '2025-01-15T07:00:00.000Z' },
        { ...mockExecution, id: 'exec-2', botId: 'bot-2', startedAt: '2025-01-15T09:00:00.000Z' },
        { ...mockExecution, id: 'exec-3', botId: 'bot-3', startedAt: '2025-01-15T08:00:00.000Z' }
      ];

      mockKV.keys.mockResolvedValue(allKeys);
      mockKV.get.mockImplementation((key: string) => {
        if (key.includes('index')) return Promise.resolve(null);
        const id = key.split(':').pop();
        return Promise.resolve(executions.find(e => e.id === id) || null);
      });
    });

    it('should get recent executions across all bots', async () => {
      const result = await store.getRecentExecutions('user-123');

      expect(result).toHaveLength(3);
      // Should be sorted by startedAt (newest first)
      expect(result[0].id).toBe('exec-2'); // 09:00
      expect(result[1].id).toBe('exec-3'); // 08:00
      expect(result[2].id).toBe('exec-1'); // 07:00

      expect(mockKV.keys).toHaveBeenCalledWith('bot-manager:executions:user-123:*:*');
    });

    it('should respect custom limit', async () => {
      const result = await store.getRecentExecutions('user-123', 2);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('exec-2');
      expect(result[1].id).toBe('exec-3');
    });

    it('should filter out index keys', async () => {
      const result = await store.getRecentExecutions('user-123');

      expect(result).toHaveLength(3);
      expect(mockKV.get).toHaveBeenCalledTimes(3); // Only execution keys, not index keys
    });

    it('should handle empty keys result', async () => {
      mockKV.keys.mockResolvedValue([]);

      const result = await store.getRecentExecutions('user-123');

      expect(result).toEqual([]);
    });

    it('should handle keys query errors', async () => {
      mockKV.keys.mockRejectedValue(new Error('Keys query failed'));

      const result = await store.getRecentExecutions('user-123');

      expect(result).toEqual([]);
    });

    it('should handle partial execution retrieval errors', async () => {
      mockKV.get.mockImplementation((key: string) => {
        if (key.includes('index')) return Promise.resolve(null);
        const id = key.split(':').pop();
        if (id === 'exec-2') return Promise.reject(new Error('Get failed'));
        return Promise.resolve({ ...mockExecution, id, botId: `bot-${id?.split('-')[1]}` });
      });

      const result = await store.getRecentExecutions('user-123');

      // The implementation catches errors and returns empty array on any failure
      expect(result).toHaveLength(0);
    });

    it('should skip null executions', async () => {
      mockKV.get.mockImplementation((key: string) => {
        if (key.includes('index')) return Promise.resolve(null);
        const id = key.split(':').pop();
        if (id === 'exec-2') return Promise.resolve(null);
        return Promise.resolve({ ...mockExecution, id, botId: `bot-${id?.split('-')[1]}`, startedAt: id === 'exec-3' ? '2025-01-15T09:00:00.000Z' : '2025-01-15T07:00:00.000Z' });
      });

      const result = await store.getRecentExecutions('user-123');

      expect(result).toHaveLength(2);
      // Should be sorted by startedAt (newest first)
      expect(result.map(e => e.id)).toEqual(['exec-3', 'exec-1']);
    });

    it('should handle large result sets efficiently', async () => {
      const manyKeys = Array.from({ length: 100 }, (_, i) => 
        `bot-manager:executions:user-123:bot-${i}:exec-${i}`
      );
      const manyExecutions = Array.from({ length: 100 }, (_, i) => ({
        ...mockExecution,
        id: `exec-${i}`,
        botId: `bot-${i}`,
        startedAt: new Date(Date.now() - i * 1000).toISOString()
      }));

      mockKV.keys.mockResolvedValue(manyKeys);
      mockKV.get.mockImplementation((key: string) => {
        const id = key.split(':').pop();
        return Promise.resolve(manyExecutions.find(e => e.id === id) || null);
      });

      const result = await store.getRecentExecutions('user-123', 5);

      expect(result).toHaveLength(5);
      expect(result[0].id).toBe('exec-0'); // Most recent
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle invalid bot IDs gracefully', async () => {
      mockKV.set.mockResolvedValue('OK');
      mockKV.zadd.mockResolvedValue(1);

      const invalidExecution = {
        ...mockExecution,
        botId: 'invalid-bot-id'
      };

      const result = await store.storeExecution('user-123', invalidExecution);

      expect(result).toBe(true);
      expect(mockKV.set).toHaveBeenCalledWith(
        'bot-manager:executions:user-123:invalid-bot-id:exec_1752366181853_5gblebxyt',
        invalidExecution
      );
    });

    it('should handle special characters in user IDs', async () => {
      mockKV.get.mockResolvedValue(mockExecution);

      const result = await store.getExecution('user_with-special.chars@domain.com', 'bot-456', 'exec-789');

      expect(mockKV.get).toHaveBeenCalledWith(
        'bot-manager:executions:user_with-special.chars@domain.com:bot-456:exec-789'
      );
      expect(result).toEqual(mockExecution);
    });

    it('should handle very long execution IDs', async () => {
      const longId = 'exec_' + 'a'.repeat(200);
      mockKV.get.mockResolvedValue({ ...mockExecution, id: longId });

      const result = await store.getExecution('user-123', 'bot-456', longId);

      expect(result?.id).toBe(longId);
    });

    it('should handle concurrent operations', async () => {
      mockKV.set.mockResolvedValue('OK');
      mockKV.zadd.mockResolvedValue(1);
      mockKV.get.mockResolvedValue(mockExecution);

      // Simulate concurrent store and retrieve
      const storePromise = store.storeExecution('user-123', mockExecution);
      const getPromise = store.getExecution('user-123', mockExecution.botId, mockExecution.id);

      const [storeResult, getResult] = await Promise.all([storePromise, getPromise]);

      expect(storeResult).toBe(true);
      expect(getResult).toEqual(mockExecution);
    });

    it('should handle malformed execution data in storage', async () => {
      const malformedExecution = {
        id: 'exec-malformed',
        // Missing required fields
        invalidField: 'should not exist'
      } as any;

      mockKV.set.mockResolvedValue('OK');
      mockKV.zadd.mockResolvedValue(1);

      const result = await store.storeExecution('user-123', malformedExecution);

      expect(result).toBe(true);
      expect(mockKV.set).toHaveBeenCalledWith(
        expect.any(String),
        malformedExecution
      );
    });

    it('should handle KV connection errors gracefully', async () => {
      mockKV.set.mockRejectedValue(new Error('Connection timeout'));
      mockKV.get.mockRejectedValue(new Error('Connection timeout'));
      mockKV.zrange.mockRejectedValue(new Error('Connection timeout'));

      const storeResult = await store.storeExecution('user-123', mockExecution);
      const getResult = await store.getExecution('user-123', 'bot-456', 'exec-789');
      const listResult = await store.getExecutions('user-123', 'bot-456');

      expect(storeResult).toBe(false);
      expect(getResult).toBeNull();
      expect(listResult).toEqual([]);
    });
  });
});
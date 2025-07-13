/**
 * Execution storage service using Vercel KV for bot executions
 * Following the established patterns from bot-store.ts
 */

import { kv } from '@vercel/kv';

import { BotExecution } from '@/schemas/bot.schema';

export class ExecutionKVStore {
  private readonly keyPrefix = 'bot-manager:executions';

  /**
   * Get user-specific bot executions index key
   */
  private getBotExecutionsIndexKey(userId: string, botId: string): string {
    return `${this.keyPrefix}:${userId}:${botId}:index`;
  }

  /**
   * Get user-specific execution key
   */
  private getExecutionKey(userId: string, botId: string, executionId: string): string {
    return `${this.keyPrefix}:${userId}:${botId}:${executionId}`;
  }

  /**
   * Get all executions for a specific bot
   */
  async getExecutions(userId: string, botId: string, limit = 50): Promise<BotExecution[]> {
    try {
      // Get execution IDs from sorted set (newest first)
      const executionIds = await kv.zrange(
        this.getBotExecutionsIndexKey(userId, botId),
        0,
        limit - 1,
        { rev: true }
      ) || [];

      if (executionIds.length === 0) {
        return [];
      }

      // Fetch all executions
      const executions: BotExecution[] = [];
      for (const id of executionIds) {
        const execution = await kv.get<BotExecution>(this.getExecutionKey(userId, botId, id as string));
        if (execution) {
          executions.push(execution);
        }
      }

      return executions;
    } catch (error) {
      console.error('Failed to get executions:', error);
      return [];
    }
  }

  /**
   * Get a specific execution
   */
  async getExecution(userId: string, botId: string, executionId: string): Promise<BotExecution | null> {
    try {
      const execution = await kv.get<BotExecution>(this.getExecutionKey(userId, botId, executionId));
      return execution || null;
    } catch (error) {
      console.error('Failed to get execution:', error);
      return null;
    }
  }

  /**
   * Store a new execution
   */
  async storeExecution(userId: string, execution: BotExecution): Promise<boolean> {
    try {
      // Store the execution
      await kv.set(this.getExecutionKey(userId, execution.botId, execution.id), execution);

      // Add to bot's execution index (sorted by timestamp)
      const timestamp = new Date(execution.startedAt).getTime();
      await kv.zadd(
        this.getBotExecutionsIndexKey(userId, execution.botId),
        { score: timestamp, member: execution.id }
      );

      return true;
    } catch (error) {
      console.error('Failed to store execution:', execution.id, error);
      console.error('Execution key:', this.getExecutionKey(userId, execution.botId, execution.id));
      console.error('Index key:', this.getBotExecutionsIndexKey(userId, execution.botId));
      console.error('Execution data size:', JSON.stringify(execution).length, 'bytes');
      return false;
    }
  }

  /**
   * Update an existing execution
   */
  async updateExecution(userId: string, execution: BotExecution): Promise<boolean> {
    try {
      // Update the execution data
      await kv.set(this.getExecutionKey(userId, execution.botId, execution.id), execution);
      return true;
    } catch (error) {
      console.error('Failed to update execution:', error);
      return false;
    }
  }

  /**
   * Delete an execution
   */
  async deleteExecution(userId: string, botId: string, executionId: string): Promise<boolean> {
    try {
      // Remove from index
      await kv.zrem(this.getBotExecutionsIndexKey(userId, botId), executionId);

      // Delete the execution
      await kv.del(this.getExecutionKey(userId, botId, executionId));

      return true;
    } catch (error) {
      console.error('Failed to delete execution:', error);
      return false;
    }
  }

  /**
   * Get execution count for a bot
   */
  async getExecutionCount(userId: string, botId: string): Promise<number> {
    try {
      const count = await kv.zcard(this.getBotExecutionsIndexKey(userId, botId));
      return count || 0;
    } catch (error) {
      console.error('Failed to get execution count:', error);
      return 0;
    }
  }

  /**
   * Clear all executions for a bot
   */
  async clearExecutions(userId: string, botId: string): Promise<boolean> {
    try {
      // Get all execution IDs
      const executionIds = await kv.zrange(this.getBotExecutionsIndexKey(userId, botId), 0, -1) || [];

      // Delete all executions
      for (const id of executionIds) {
        await kv.del(this.getExecutionKey(userId, botId, id as string));
      }

      // Clear the index
      await kv.del(this.getBotExecutionsIndexKey(userId, botId));

      return true;
    } catch (error) {
      console.error('Failed to clear executions:', error);
      return false;
    }
  }

  /**
   * Get recent executions across all bots for a user (for dashboard)
   */
  async getRecentExecutions(userId: string, limit = 10): Promise<BotExecution[]> {
    try {
      // This is a more complex query - we'd need to scan bot indices
      // For now, implement a simple version that could be optimized later
      const allKeys = await kv.keys(`${this.keyPrefix}:${userId}:*:*`);
      const executionKeys = allKeys.filter(key => !key.includes(':index'));

      // Get all executions and sort by timestamp
      const executions: BotExecution[] = [];
      for (const key of executionKeys) {
        const execution = await kv.get<BotExecution>(key);
        if (execution) {
          executions.push(execution);
        }
      }

      // Sort by startedAt (newest first) and limit
      executions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
      return executions.slice(0, limit);
    } catch (error) {
      console.error('Failed to get recent executions:', error);
      return [];
    }
  }
}

// Export a singleton instance
export const executionDataStore = new ExecutionKVStore();
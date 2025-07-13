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
   * Delete all executions and related data for a bot (used during bot deletion)
   * This method provides comprehensive cleanup including blob storage
   */
  async deleteAllExecutionsForBot(userId: string, botId: string): Promise<{ 
    success: boolean; 
    deletedExecutions: number; 
    deletedBlobs: number; 
    errors: string[] 
  }> {
    const result = {
      success: false,
      deletedExecutions: 0,
      deletedBlobs: 0,
      errors: [] as string[]
    };

    try {
      // Get all execution IDs from the index
      const executionIds = await kv.zrange(this.getBotExecutionsIndexKey(userId, botId), 0, -1) || [];
      
      if (executionIds.length === 0) {
        result.success = true;
        return result;
      }

      console.log(`🧹 Cleaning up ${executionIds.length} executions for bot ${botId}`);

      // Import ExecutionLogService for blob cleanup
      const { ExecutionLogService } = await import('@/lib/services/bots/execution/execution-log-service');

      // Delete each execution and its associated blob data
      for (const id of executionIds) {
        try {
          const executionKey = this.getExecutionKey(userId, botId, id as string);
          
          // Get execution data to find blob URLs before deletion
          const execution = await kv.get<BotExecution>(executionKey);
          
          // Delete the execution data from KV
          await kv.del(executionKey);
          result.deletedExecutions++;

          // Clean up blob storage if execution has logs
          if (execution?.logsUrl) {
            try {
              const blobDeleted = await ExecutionLogService.delete(execution.logsUrl);
              if (blobDeleted) {
                result.deletedBlobs++;
              } else {
                result.errors.push(`Failed to delete blob for execution ${id}`);
              }
            } catch (blobError) {
              result.errors.push(`Blob deletion error for execution ${id}: ${blobError instanceof Error ? blobError.message : 'Unknown error'}`);
            }
          }
        } catch (executionError) {
          result.errors.push(`Failed to delete execution ${id}: ${executionError instanceof Error ? executionError.message : 'Unknown error'}`);
        }
      }

      // Clear the execution index
      try {
        await kv.del(this.getBotExecutionsIndexKey(userId, botId));
        console.log(`🧹 Cleared execution index for bot ${botId}`);
      } catch (indexError) {
        result.errors.push(`Failed to clear execution index: ${indexError instanceof Error ? indexError.message : 'Unknown error'}`);
      }

      result.success = result.errors.length === 0 || result.deletedExecutions > 0;
      
      if (result.deletedExecutions > 0) {
        console.log(`✅ Successfully cleaned ${result.deletedExecutions} executions and ${result.deletedBlobs} blobs for bot ${botId}`);
      }
      
      if (result.errors.length > 0) {
        console.warn(`⚠️ Some cleanup operations failed for bot ${botId}:`, result.errors);
      }

      return result;
    } catch (error) {
      result.errors.push(`Critical error during execution cleanup: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Failed to delete all executions for bot:', error);
      return result;
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
/**
 * Bot storage service using Vercel KV for multiple users
 */

import { kv } from '@vercel/kv';

import { Bot } from '@/schemas';

export class BotKVStore {
  private readonly keyPrefix = 'bot-manager:bots';

  /**
   * Get user-specific bot index key
   */
  private getUserIndexKey(userId: string): string {
    return `${this.keyPrefix}:${userId}:index`;
  }

  /**
   * Get user-specific bot key
   */
  private getUserBotKey(userId: string, botId: string): string {
    return `${this.keyPrefix}:${userId}:${botId}`;
  }

  /**
   * Get all bots for a user
   */
  async getAllBots(userId: string): Promise<import('@/schemas/bot.schema').Bot[]> {
    try {
      // Get all bot IDs for the user
      const botIds = await kv.smembers(this.getUserIndexKey(userId)) || [];

      if (botIds.length === 0) {
        return [];
      }

      // Fetch all bots
      const bots: Bot[] = [];
      for (const id of botIds) {
        const bot = await kv.get<Bot>(this.getUserBotKey(userId, id as string));
        if (bot) {
          bots.push(bot);
        }
      }

      // Sort by createdAt (newest first)
      bots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return bots;
    } catch (error) {
      console.error('Failed to get all bots:', error);
      return [];
    }
  }

  /**
   * Get a specific bot
   */
  async getBot(userId: string, botId: string): Promise<Bot | null> {
    try {
      const bot = await kv.get<Bot>(this.getUserBotKey(userId, botId));
      return bot || null;
    } catch (error) {
      console.error('Failed to get bot:', error);
      return null;
    }
  }

  /**
   * Create or update a bot
   */
  async setBot(userId: string, bot: import('@/schemas/bot.schema').Bot): Promise<boolean> {
    try {
      // Store the bot
      await kv.set(this.getUserBotKey(userId, bot.id), bot);

      // Add to user's bot index
      await kv.sadd(this.getUserIndexKey(userId), bot.id);

      return true;
    } catch (error) {
      console.error('Failed to set bot:', error);
      return false;
    }
  }

  /**
   * Create a new bot (alias for setBot)
   */
  async createBot(userId: string, bot: import('@/schemas/bot.schema').Bot): Promise<boolean> {
    return this.setBot(userId, bot);
  }

  /**
   * Update an existing bot (alias for setBot)
   */
  async updateBot(userId: string, bot: import('@/schemas/bot.schema').Bot): Promise<boolean> {
    return this.setBot(userId, bot);
  }

  /**
   * Delete a bot
   */
  async deleteBot(userId: string, botId: string): Promise<boolean> {
    try {
      // Remove from index
      await kv.srem(this.getUserIndexKey(userId), botId);

      // Delete the bot
      await kv.del(this.getUserBotKey(userId, botId));

      return true;
    } catch (error) {
      console.error('Failed to delete bot:', error);
      return false;
    }
  }

  /**
   * Get bot count for a user
   */
  async getBotCount(userId: string): Promise<number> {
    try {
      const botIds = await kv.smembers(this.getUserIndexKey(userId)) || [];
      return botIds.length;
    } catch (error) {
      console.error('Failed to get bot count:', error);
      return 0;
    }
  }

  /**
   * Clear all bots for a user
   */
  async clearAllBots(userId: string): Promise<boolean> {
    try {
      // Get all bot IDs
      const botIds = await kv.smembers(this.getUserIndexKey(userId)) || [];

      // Delete all bots
      for (const id of botIds) {
        await kv.del(this.getUserBotKey(userId, id as string));
      }

      // Clear the index
      await kv.del(this.getUserIndexKey(userId));

      return true;
    } catch (error) {
      console.error('Failed to clear all bots:', error);
      return false;
    }
  }

  /**
   * Bulk import bots for migration purposes
   */
  async bulkImportBots(userId: string, bots: import('@/schemas/bot.schema').Bot[]): Promise<void> {
    try {
      console.log(`Starting bulk import of ${bots.length} bots for user ${userId}`);

      // Store all bots
      for (const bot of bots) {
        await kv.set(this.getUserBotKey(userId, bot.id), bot);
      }

      // Update index with all bot IDs
      const botIds = bots.map(bot => bot.id);
      if (botIds.length > 0) {
        await Promise.all(botIds.map(id => kv.sadd(this.getUserIndexKey(userId), id)));
      }

      console.log(`Successfully imported ${bots.length} bots for user ${userId}`);
    } catch (error) {
      console.error('Failed to bulk import bots:', error);
      throw new Error('Failed to import bot data');
    }
  }

  /**
   * Get all bots across all users (for public viewing)
   */
  async getAllBotsPublic(): Promise<import('@/schemas/bot.schema').Bot[]> {
    try {
      // Get all keys that match the bot pattern
      const allKeys = await kv.keys(`${this.keyPrefix}:*:*`);
      const botKeys = allKeys.filter(key => !key.includes(':index'));

      if (botKeys.length === 0) {
        return [];
      }

      // Fetch all bots
      const bots: import('@/schemas/bot.schema').Bot[] = [];
      for (const key of botKeys) {
        const bot = await kv.get<import('@/schemas/bot.schema').Bot>(key);
        if (bot) {
          bots.push(bot);
        }
      }

      // Sort by createdAt (newest first)
      bots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return bots;
    } catch (error) {
      console.error('Failed to get all bots public:', error);
      return [];
    }
  }

  /**
   * Get public bot statistics across all users
   */
  async getPublicBotStats(): Promise<{
    totalBots: number;
    activeBots: number;
    pausedBots: number;
    errorBots: number;
    totalUsers: number;
  }> {
    try {
      const bots = await this.getAllBotsPublic();
      const userIds = new Set(bots.map(bot => bot.ownerId));

      let activeBots = 0;
      let pausedBots = 0;
      let errorBots = 0;

      for (const bot of bots) {
        switch (bot.status) {
          case 'active':
            activeBots++;
            break;
          case 'paused':
            pausedBots++;
            break;
          case 'error':
            errorBots++;
            break;
        }
      }

      return {
        totalBots: bots.length,
        activeBots,
        pausedBots,
        errorBots,
        totalUsers: userIds.size,
      };
    } catch (error) {
      console.error('Failed to get public bot stats:', error);
      return {
        totalBots: 0,
        activeBots: 0,
        pausedBots: 0,
        errorBots: 0,
        totalUsers: 0,
      };
    }
  }

  /**
   * Get bot statistics
   */
  async getBotStats(userId: string): Promise<{
    totalBots: number;
    activeBots: number;
    pausedBots: number;
    errorBots: number;
  }> {
    try {
      const bots = await this.getAllBots(userId);

      let activeBots = 0;
      let pausedBots = 0;
      let errorBots = 0;

      for (const bot of bots) {
        switch (bot.status) {
          case 'active':
            activeBots++;
            break;
          case 'paused':
            pausedBots++;
            break;
          case 'error':
            errorBots++;
            break;
        }
      }

      return {
        totalBots: bots.length,
        activeBots,
        pausedBots,
        errorBots,
      };
    } catch (error) {
      console.error('Failed to get bot stats:', error);
      return {
        totalBots: 0,
        activeBots: 0,
        pausedBots: 0,
        errorBots: 0,
      };
    }
  }
}

// Export a singleton instance
export const botDataStore = new BotKVStore();
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
  private getUserIndexKey(clerkUserId: string): string {
    return `${this.keyPrefix}:${clerkUserId}:index`;
  }

  /**
   * Get user-specific bot key (simplified Clerk-only pattern)
   */
  private getUserBotKey(clerkUserId: string, botId: string): string {
    return `${this.keyPrefix}:${clerkUserId}:${botId}`;
  }

  /**
   * Get all bots for a user (legacy wallet-based)
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
   * Get all bots for a Clerk user
   */
  async getAllBotsByClerkUserId(clerkUserId: string): Promise<import('@/schemas/bot.schema').Bot[]> {
    try {
      // Get all bot IDs for the Clerk user
      const botIds = await kv.smembers(this.getUserIndexKey(clerkUserId)) || [];

      if (botIds.length === 0) {
        return [];
      }

      // Fetch all bots
      const bots: Bot[] = [];
      for (const id of botIds) {
        const bot = await kv.get<Bot>(this.getUserBotKey(clerkUserId, id as string));
        if (bot) {
          bots.push(bot);
        }
      }

      // Sort by createdAt (newest first)
      bots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return bots;
    } catch (error) {
      console.error('Failed to get all bots by Clerk user ID:', error);
      return [];
    }
  }

  /**
   * Get a specific bot (legacy wallet-based)
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
   * Get a specific bot by Clerk user ID
   */
  async getBotByClerkUserId(clerkUserId: string, botId: string): Promise<Bot | null> {
    try {
      const bot = await kv.get<Bot>(this.getUserBotKey(clerkUserId, botId));
      return bot || null;
    } catch (error) {
      console.error('Failed to get bot by Clerk user ID:', error);
      return null;
    }
  }

  /**
   * Create or update a bot (legacy wallet-based)
   */
  async setBot(userId: string, bot: import('@/schemas/bot.schema').Bot): Promise<boolean> {
    try {
      // Store the bot
      await kv.set(this.getUserBotKey(userId, bot.id), bot);

      // Add to user's bot index
      await kv.sadd(this.getUserIndexKey(userId), bot.id);

      // If bot has clerkUserId, also index by Clerk user ID
      if (bot.clerkUserId) {
        await kv.set(this.getUserBotKey(bot.clerkUserId, bot.id), bot);
        await kv.sadd(this.getUserIndexKey(bot.clerkUserId), bot.id);
      }

      return true;
    } catch (error) {
      console.error('Failed to set bot:', error);
      return false;
    }
  }

  /**
   * Create or update a bot by Clerk user ID
   */
  async setBotByClerkUserId(clerkUserId: string, bot: import('@/schemas/bot.schema').Bot): Promise<boolean> {
    try {
      // Ensure bot has clerkUserId set
      const botWithClerkUserId = { ...bot, clerkUserId };

      // Store the bot under Clerk user ID
      await kv.set(this.getUserBotKey(clerkUserId, bot.id), botWithClerkUserId);

      // Add to Clerk user's bot index
      await kv.sadd(this.getUserIndexKey(clerkUserId), bot.id);

      return true;
    } catch (error) {
      console.error('Failed to set bot by Clerk user ID:', error);
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
   * Create a new bot by Clerk user ID with uniqueness validation
   */
  async createBotByClerkUserId(clerkUserId: string, bot: import('@/schemas/bot.schema').Bot): Promise<boolean> {
    try {
      // Check if a bot with this ID already exists across all users
      const allBots = await this.getAllBotsPublic();
      const existingBot = allBots.find(existingBot => existingBot.id === bot.id);
      
      if (existingBot) {
        console.error(`❌ Bot creation failed: Bot with ID '${bot.id}' already exists`);
        console.error(`   Existing bot: ${existingBot.name} (owner: ${existingBot.clerkUserId})`);
        console.error(`   Attempted bot: ${bot.name} (owner: ${clerkUserId})`);
        throw new Error(`Bot with ID '${bot.id}' already exists. Bot IDs must be unique across all users.`);
      }

      // If no duplicate found, proceed with creation
      console.log(`✅ Bot ID '${bot.id}' is unique, proceeding with creation`);
      return this.setBotByClerkUserId(clerkUserId, bot);
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        // Re-throw validation errors
        throw error;
      } else {
        // Handle other errors
        console.error('Failed to create bot by Clerk user ID:', error);
        return false;
      }
    }
  }

  /**
   * Update an existing bot by Clerk user ID (alias for setBotByClerkUserId)
   */
  async updateBotByClerkUserId(clerkUserId: string, bot: import('@/schemas/bot.schema').Bot): Promise<boolean> {
    return this.setBotByClerkUserId(clerkUserId, bot);
  }

  /**
   * Delete a bot (legacy wallet-based)
   */
  async deleteBot(userId: string, botId: string): Promise<boolean> {
    try {
      // Get the bot first to check for clerkUserId
      const bot = await kv.get<Bot>(this.getUserBotKey(userId, botId));

      // Remove from wallet-based index
      await kv.srem(this.getUserIndexKey(userId), botId);

      // Delete the wallet-based bot
      await kv.del(this.getUserBotKey(userId, botId));

      // Also clean up Clerk-based storage if clerkUserId exists
      if (bot?.clerkUserId) {
        await kv.srem(this.getUserIndexKey(bot.clerkUserId), botId);
        await kv.del(this.getUserBotKey(bot.clerkUserId, botId));
      }

      return true;
    } catch (error) {
      console.error('Failed to delete bot:', error);
      return false;
    }
  }

  /**
   * Delete a bot by Clerk user ID
   */
  async deleteBotByClerkUserId(clerkUserId: string, botId: string): Promise<boolean> {
    try {
      // Remove from Clerk user index
      await kv.srem(this.getUserIndexKey(clerkUserId), botId);

      // Delete the bot
      await kv.del(this.getUserBotKey(clerkUserId, botId));

      return true;
    } catch (error) {
      console.error('Failed to delete bot by Clerk user ID:', error);
      return false;
    }
  }

  /**
   * Get bot count for a user (legacy wallet-based)
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
   * Get bot count for a Clerk user
   */
  async getBotCountByClerkUserId(clerkUserId: string): Promise<number> {
    try {
      const botIds = await kv.smembers(this.getUserIndexKey(clerkUserId)) || [];
      return botIds.length;
    } catch (error) {
      console.error('Failed to get bot count by Clerk user ID:', error);
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
   * Uses simplified Clerk-only storage pattern
   */
  async getAllBotsPublic(): Promise<import('@/schemas/bot.schema').Bot[]> {
    try {
      // Get all bot keys using simplified pattern: bot-manager:bots:{clerkUserId}:{botId}
      const allKeys = await kv.keys(`${this.keyPrefix}:*:*`);
      const botKeys = allKeys.filter(key => !key.includes(':index'));

      if (botKeys.length === 0) {
        return [];
      }

      // Fetch all bots - no deduplication needed with simplified storage
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
      const userIds = new Set(bots.map(bot => bot.clerkUserId));

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
   * Get bot statistics (legacy wallet-based)
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

  /**
   * Get bot statistics by Clerk user ID
   */
  async getBotStatsByClerkUserId(clerkUserId: string): Promise<{
    totalBots: number;
    activeBots: number;
    pausedBots: number;
    errorBots: number;
  }> {
    try {
      const bots = await this.getAllBotsByClerkUserId(clerkUserId);

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
      console.error('Failed to get bot stats by Clerk user ID:', error);
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
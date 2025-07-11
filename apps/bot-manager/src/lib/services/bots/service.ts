/**
 * BotService - Controller layer for all bot backend operations
 * Handles data source selection (KV vs Static) and provides unified API
 */

// Note: Static data removed - service operates in KV mode only
import { botDataStore } from '@/lib/modules/storage';
import { ENABLE_API_BOTS } from '@/lib/utils/config';
import { Bot, BotStats, CreateBotRequest } from '@/schemas/bot.schema';

export class BotService {
  private useKV: boolean;

  constructor() {
    this.useKV = ENABLE_API_BOTS;
  }

  /**
   * Get all bots for a specific user
   */
  async getAllBots(userId: string): Promise<Bot[]> {
    if (this.useKV) {
      return await botDataStore.getAllBots(userId);
    } else {
      // No static data - return empty array
      return [];
    }
  }

  /**
   * Get a specific bot by ID for a user
   */
  async getBot(userId: string, botId: string): Promise<Bot | null> {
    if (this.useKV) {
      return await botDataStore.getBot(userId, botId);
    } else {
      // No static data - return null
      return null;
    }
  }

  /**
   * Create a new bot for a user
   */
  async createBot(userId: string, data: CreateBotRequest): Promise<Bot> {
    if (this.useKV) {
      // For KV, we need to generate the bot first
      const { generateBotWallet, encryptWalletCredentials } = await import('@/lib/modules/security/wallet-encryption');
      const { createBotImageConfig } = await import('@/lib/services/bots/images');

      const walletCredentials = await generateBotWallet();
      const encryptedWallet = encryptWalletCredentials(walletCredentials);
      const imageConfig = createBotImageConfig(data.name, walletCredentials.walletAddress, 'pokemon');

      const now = new Date().toISOString();

      const newBot: Bot = {
        id: walletCredentials.walletAddress,
        name: data.name,
        strategy: data.strategy,
        status: 'setup',
        ownerId: userId,
        createdAt: now,
        lastActive: now,
        encryptedWallet: encryptedWallet.encryptedPrivateKey,
        walletIv: encryptedWallet.privateKeyIv,
        publicKey: walletCredentials.publicKey,
        image: imageConfig.image,
        imageType: imageConfig.imageType,
        isScheduled: false,
        executionCount: 0,
      };

      const success = await botDataStore.createBot(userId, newBot);
      if (success) {
        return newBot;
      } else {
        throw new Error('Failed to create bot');
      }
    } else {
      // For static data, we can't actually create, so throw an error
      throw new Error('Bot creation not available in static mode');
    }
  }

  /**
   * Update an existing bot
   */
  async updateBot(userId: string, botId: string, updates: Partial<Bot>): Promise<Bot>;
  async updateBot(userId: string, bot: Bot): Promise<Bot>;
  async updateBot(userId: string, botIdOrBot: string | Bot, updates?: Partial<Bot>): Promise<Bot> {
    if (this.useKV) {
      let updatedBot: Bot;
      
      if (typeof botIdOrBot === 'string') {
        // Called with botId and updates
        const existingBot = await botDataStore.getBot(userId, botIdOrBot);
        if (!existingBot) {
          throw new Error(`Bot ${botIdOrBot} not found for user ${userId}`);
        }
        updatedBot = { ...existingBot, ...updates };
      } else {
        // Called with full bot object
        updatedBot = botIdOrBot;
      }

      const success = await botDataStore.updateBot(userId, updatedBot);
      if (success) {
        return updatedBot;
      } else {
        throw new Error('Failed to update bot');
      }
    } else {
      throw new Error('Bot updates not available in static mode');
    }
  }

  /**
   * Delete a bot
   */
  async deleteBot(userId: string, botId: string): Promise<void> {
    if (this.useKV) {
      await botDataStore.deleteBot(userId, botId);
    } else {
      throw new Error('Bot deletion not available in static mode');
    }
  }

  /**
   * Get bot statistics for a user
   */
  async getBotStats(userId: string): Promise<BotStats> {
    if (this.useKV) {
      return await botDataStore.getBotStats(userId);
    } else {
      // No static data - return zero stats
      return {
        totalBots: 0,
        activeBots: 0,
        pausedBots: 0,
        errorBots: 0,
      };
    }
  }

  /**
   * Get all public bots (cross-user)
   */
  async getPublicBots(): Promise<Bot[]> {
    if (this.useKV) {
      return await botDataStore.getAllBotsPublic();
    } else {
      // No static data - return empty array
      return [];
    }
  }

  /**
   * Scan all bots across all users (for SSR)
   * This method always returns all bots regardless of data source
   */
  async scanAllBots(): Promise<Bot[]> {
    if (this.useKV) {
      return await botDataStore.getAllBotsPublic();
    } else {
      // No static data - return empty array
      return [];
    }
  }

  /**
   * Get public bot statistics
   */
  async getPublicBotStats(): Promise<BotStats & { totalUsers: number }> {
    if (this.useKV) {
      return await botDataStore.getPublicBotStats();
    } else {
      // No static data - return zero stats
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
   * Check if KV mode is enabled
   */
  isKVEnabled(): boolean {
    return this.useKV;
  }

  /**
   * Get data source type
   */
  getDataSource(): 'kv' | 'static' {
    return this.useKV ? 'kv' : 'static';
  }
}

// Export singleton instance
export const botService = new BotService();
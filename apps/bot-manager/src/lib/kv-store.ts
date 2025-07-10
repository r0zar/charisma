/**
 * Vercel KV Storage Integration
 * Provides typed access to Vercel KV for notifications and other data
 */

import { kv } from '@vercel/kv';
import type { AppState } from '@/schemas/app-state.schema';

// Types for stored data
export interface StoredNotification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  priority: 'high' | 'medium' | 'low';
  category: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationFilters {
  type?: string;
  category?: string;
  read?: boolean;
  priority?: string;
  limit?: number;
  offset?: number;
}

/**
 * Notification storage service using Vercel KV for multiple users
 */
export class NotificationKVStore {
  private readonly keyPrefix = 'bot-manager:notifications';

  /**
   * Get user-specific notification index key
   */
  private getUserIndexKey(userId: string): string {
    return `${this.keyPrefix}:${userId}:index`;
  }

  /**
   * Get user-specific notification key
   */
  private getUserNotificationKey(userId: string, id: string): string {
    return `${this.keyPrefix}:${userId}:${id}`;
  }

  /**
   * Get all notification IDs from index for a specific user
   */
  private async getNotificationIds(userId: string): Promise<string[]> {
    try {
      const ids = await kv.get<string[]>(this.getUserIndexKey(userId));
      return ids || [];
    } catch (error) {
      console.error(`Failed to get notification IDs for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Update notification index for a specific user
   */
  private async updateIndex(userId: string, ids: string[]): Promise<void> {
    try {
      await kv.set(this.getUserIndexKey(userId), ids);
    } catch (error) {
      console.error(`Failed to update notification index for user ${userId}:`, error);
    }
  }


  /**
   * Create a new notification for a specific user
   */
  async createNotification(userId: string, notification: Omit<StoredNotification, 'id' | 'createdAt' | 'updatedAt'>): Promise<StoredNotification> {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const storedNotification: StoredNotification = {
      ...notification,
      id,
      createdAt: now,
      updatedAt: now,
    };

    try {
      // Store the notification
      await kv.set(this.getUserNotificationKey(userId, id), storedNotification);
      
      // Update the index
      const ids = await this.getNotificationIds(userId);
      ids.unshift(id); // Add to beginning for recent-first order
      await this.updateIndex(userId, ids);
      
      return storedNotification;
    } catch (error) {
      console.error(`Failed to create notification for user ${userId}:`, error);
      throw new Error('Failed to create notification');
    }
  }

  /**
   * Get a notification by ID for a specific user
   */
  async getNotification(userId: string, id: string): Promise<StoredNotification | null> {
    try {
      const notification = await kv.get<StoredNotification>(this.getUserNotificationKey(userId, id));
      return notification;
    } catch (error) {
      console.error(`Failed to get notification for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Update a notification for a specific user
   */
  async updateNotification(userId: string, id: string, updates: Partial<StoredNotification>): Promise<StoredNotification | null> {
    try {
      const existing = await this.getNotification(userId, id);
      if (!existing) {
        return null;
      }

      const updated: StoredNotification = {
        ...existing,
        ...updates,
        id, // Ensure ID doesn't change
        createdAt: existing.createdAt, // Preserve creation time
        updatedAt: new Date().toISOString(),
      };

      await kv.set(this.getUserNotificationKey(userId, id), updated);
      return updated;
    } catch (error) {
      console.error(`Failed to update notification for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Delete a notification for a specific user
   */
  async deleteNotification(userId: string, id: string): Promise<boolean> {
    try {
      // Remove from storage
      await kv.del(this.getUserNotificationKey(userId, id));
      
      // Update index
      const ids = await this.getNotificationIds(userId);
      const updatedIds = ids.filter(notificationId => notificationId !== id);
      await this.updateIndex(userId, updatedIds);
      
      return true;
    } catch (error) {
      console.error(`Failed to delete notification for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Get notifications with filtering and pagination for a specific user
   */
  async getNotifications(userId: string, filters: NotificationFilters = {}): Promise<{
    notifications: StoredNotification[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const ids = await this.getNotificationIds(userId);
      const { limit = 50, offset = 0 } = filters;

      // Get all notifications for filtering
      const allNotifications = await Promise.all(
        ids.map(id => this.getNotification(userId, id))
      );

      // Filter out null values and apply filters
      let filteredNotifications = allNotifications
        .filter((notif): notif is StoredNotification => notif !== null);

      // Apply filters
      if (filters.type) {
        filteredNotifications = filteredNotifications.filter(n => n.type === filters.type);
      }
      if (filters.category) {
        filteredNotifications = filteredNotifications.filter(n => n.category === filters.category);
      }
      if (filters.read !== undefined) {
        filteredNotifications = filteredNotifications.filter(n => n.read === filters.read);
      }
      if (filters.priority) {
        filteredNotifications = filteredNotifications.filter(n => n.priority === filters.priority);
      }

      // Sort by timestamp (newest first)
      filteredNotifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const total = filteredNotifications.length;
      const paginatedNotifications = filteredNotifications.slice(offset, offset + limit);
      const hasMore = offset + limit < total;

      return {
        notifications: paginatedNotifications,
        total,
        hasMore,
      };
    } catch (error) {
      console.error(`Failed to get notifications for user ${userId}:`, error);
      return {
        notifications: [],
        total: 0,
        hasMore: false,
      };
    }
  }

  /**
   * Mark notification as read for a specific user
   */
  async markAsRead(userId: string, id: string): Promise<boolean> {
    const updated = await this.updateNotification(userId, id, { read: true });
    return updated !== null;
  }

  /**
   * Mark notification as unread for a specific user
   */
  async markAsUnread(userId: string, id: string): Promise<boolean> {
    const updated = await this.updateNotification(userId, id, { read: false });
    return updated !== null;
  }

  /**
   * Mark all notifications as read for a specific user
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const ids = await this.getNotificationIds(userId);
      const updatePromises = ids.map(id => this.markAsRead(userId, id));
      await Promise.all(updatePromises);
      return true;
    } catch (error) {
      console.error(`Failed to mark all notifications as read for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Get notification counts for a specific user
   */
  async getNotificationCounts(userId: string): Promise<{
    total: number;
    unread: number;
    byType: Record<string, number>;
    byPriority: Record<string, number>;
  }> {
    try {
      const { notifications } = await this.getNotifications(userId);
      
      const counts = {
        total: notifications.length,
        unread: notifications.filter(n => !n.read).length,
        byType: {} as Record<string, number>,
        byPriority: {} as Record<string, number>,
      };

      // Count by type
      notifications.forEach(n => {
        counts.byType[n.type] = (counts.byType[n.type] || 0) + 1;
        counts.byPriority[n.priority] = (counts.byPriority[n.priority] || 0) + 1;
      });

      return counts;
    } catch (error) {
      console.error(`Failed to get notification counts for user ${userId}:`, error);
      return {
        total: 0,
        unread: 0,
        byType: {},
        byPriority: {},
      };
    }
  }

  /**
   * Clear all notifications for a specific user
   */
  async clearAll(userId: string): Promise<boolean> {
    try {
      const ids = await this.getNotificationIds(userId);
      
      // Delete all notifications
      const deletePromises = ids.map(id => kv.del(this.getUserNotificationKey(userId, id)));
      await Promise.all(deletePromises);
      
      // Clear index
      await this.updateIndex(userId, []);
      
      return true;
    } catch (error) {
      console.error(`Failed to clear all notifications for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Migrate static notifications to KV storage for a specific user
   */
  async migrateFromStatic(userId: string, notifications: AppState['notifications']): Promise<boolean> {
    try {
      // Clear existing notifications for this user
      await this.clearAll(userId);

      // Convert static notifications to stored format with error handling
      const migrationResults = [];
      for (const notif of notifications) {
        try {
          // Map notification type to priority
          const priority: StoredNotification['priority'] = 
            notif.type === 'error' ? 'high' :
            notif.type === 'warning' || notif.type === 'info' ? 'medium' : 'low';

          const storedNotif: Omit<StoredNotification, 'id' | 'createdAt' | 'updatedAt'> = {
            type: notif.type as StoredNotification['type'],
            title: notif.title,
            message: notif.message || '',
            timestamp: notif.timestamp,
            read: notif.read,
            priority,
            category: notif.persistent ? 'persistent' : 'general',
            metadata: {
              persistent: notif.persistent,
              actionUrl: notif.actionUrl,
            },
          };

          const created = await this.createNotification(userId, storedNotif);
          migrationResults.push({ success: true, id: created.id, title: notif.title });
          console.log(`✅ Migrated: ${notif.title}`);
        } catch (error) {
          migrationResults.push({ success: false, error: error instanceof Error ? error.message : String(error), title: notif.title });
          console.error(`❌ Failed to migrate: ${notif.title}`, error);
        }
      }
      
      const successCount = migrationResults.filter(r => r.success).length;
      const failureCount = migrationResults.filter(r => !r.success).length;
      console.log(`Migration completed: ${successCount} success, ${failureCount} failures`);
      return true;
    } catch (error) {
      console.error(`Failed to migrate notifications for user ${userId}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const notificationStore = new NotificationKVStore();

/**
 * Metadata KV Store
 * Handles metadata storage and retrieval in Vercel KV
 */
export class MetadataKVStore {
  private readonly keyPrefix = 'bot-manager:metadata';
  private readonly metadataKey = 'bot-manager:metadata';

  /**
   * Get metadata from KV store
   */
  async getMetadata(): Promise<AppState['metadata'] | null> {
    try {
      const metadata = await kv.get(this.metadataKey);
      return metadata as AppState['metadata'] | null;
    } catch (error) {
      console.error('Failed to get metadata:', error);
      return null;
    }
  }

  /**
   * Store metadata in KV store
   */
  async setMetadata(metadata: AppState['metadata']): Promise<boolean> {
    try {
      await kv.set(this.metadataKey, metadata);
      return true;
    } catch (error) {
      console.error('Failed to set metadata:', error);
      return false;
    }
  }

  /**
   * Update metadata in KV store
   */
  async updateMetadata(updates: Partial<AppState['metadata']>): Promise<AppState['metadata'] | null> {
    try {
      const currentMetadata = await this.getMetadata();
      if (!currentMetadata) {
        return null;
      }

      const updatedMetadata = {
        ...currentMetadata,
        ...updates,
      };

      const success = await this.setMetadata(updatedMetadata);
      return success ? updatedMetadata : null;
    } catch (error) {
      console.error('Failed to update metadata:', error);
      return null;
    }
  }

  /**
   * Clear metadata from KV store
   */
  async clearMetadata(): Promise<boolean> {
    try {
      await kv.del(this.metadataKey);
      return true;
    } catch (error) {
      console.error('Failed to clear metadata:', error);
      return false;
    }
  }

  /**
   * Check if metadata exists in KV store
   */
  async hasMetadata(): Promise<boolean> {
    try {
      const metadata = await kv.get(this.metadataKey);
      return metadata !== null;
    } catch (error) {
      console.error('Failed to check metadata existence:', error);
      return false;
    }
  }

  /**
   * Migrate metadata from static data to KV store
   */
  async migrateFromStatic(metadata: AppState['metadata']): Promise<boolean> {
    try {
      // Clear existing metadata
      await this.clearMetadata();
      
      // Store the new metadata
      const success = await this.setMetadata(metadata);
      
      if (success) {
        console.log('✅ Metadata migrated successfully');
      } else {
        console.error('❌ Failed to migrate metadata');
      }
      
      return success;
    } catch (error) {
      console.error('Failed to migrate metadata:', error);
      return false;
    }
  }
}

// Export singleton instance
export const metadataStore = new MetadataKVStore();

/**
 * Market Data KV Store
 * Handles market data storage and retrieval in Vercel KV
 */
export class MarketDataKVStore {
  private readonly keyPrefix = 'bot-manager:market';
  private readonly marketDataKey = 'bot-manager:market_data';

  /**
   * Get market data from KV store
   */
  async getMarketData(): Promise<AppState['market']['data'] | null> {
    try {
      const marketData = await kv.get(this.marketDataKey);
      return marketData as AppState['market']['data'] | null;
    } catch (error) {
      console.error('Failed to get market data:', error);
      return null;
    }
  }

  /**
   * Store market data in KV store
   */
  async setMarketData(marketData: AppState['market']['data']): Promise<boolean> {
    try {
      await kv.set(this.marketDataKey, marketData);
      return true;
    } catch (error) {
      console.error('Failed to set market data:', error);
      return false;
    }
  }

  /**
   * Update market data in KV store
   */
  async updateMarketData(updates: Partial<AppState['market']['data']>): Promise<AppState['market']['data'] | null> {
    try {
      const currentMarketData = await this.getMarketData();
      if (!currentMarketData) {
        return null;
      }

      const updatedMarketData = {
        ...currentMarketData,
        ...updates,
      };

      const success = await this.setMarketData(updatedMarketData);
      return success ? updatedMarketData : null;
    } catch (error) {
      console.error('Failed to update market data:', error);
      return null;
    }
  }

  /**
   * Clear market data from KV store
   */
  async clearMarketData(): Promise<boolean> {
    try {
      await kv.del(this.marketDataKey);
      return true;
    } catch (error) {
      console.error('Failed to clear market data:', error);
      return false;
    }
  }

  /**
   * Check if market data exists in KV store
   */
  async hasMarketData(): Promise<boolean> {
    try {
      const marketData = await kv.get(this.marketDataKey);
      return marketData !== null;
    } catch (error) {
      console.error('Failed to check market data existence:', error);
      return false;
    }
  }

  /**
   * Migrate market data from static data to KV store
   */
  async migrateFromStatic(marketData: AppState['market']['data']): Promise<boolean> {
    try {
      // Clear existing market data
      await this.clearMarketData();
      
      // Store the new market data
      const success = await this.setMarketData(marketData);
      
      if (success) {
        console.log('✅ Market data migrated successfully');
        console.log(`📊 Migrated ${Object.keys(marketData.tokenPrices).length} token prices`);
        console.log(`📊 Migrated ${Object.keys(marketData.priceChanges).length} price changes`);
        console.log(`📊 Migrated ${Object.keys(marketData.marketCap).length} market caps`);
      } else {
        console.error('❌ Failed to migrate market data');
      }
      
      return success;
    } catch (error) {
      console.error('Failed to migrate market data:', error);
      return false;
    }
  }
}

// Export singleton instance
export const marketDataStore = new MarketDataKVStore();

/**
 * User Data KV Store
 * Handles user data storage and retrieval in Vercel KV for multiple users
 */
export class UserDataKVStore {
  private readonly keyPrefix = 'bot-manager:user';

  /**
   * Get user data key for a specific user
   */
  private getUserDataKey(userId: string): string {
    return `${this.keyPrefix}:${userId}`;
  }

  /**
   * Get user data from KV store for a specific user
   */
  async getUserData(userId: string): Promise<AppState['user'] | null> {
    try {
      const userData = await kv.get(this.getUserDataKey(userId));
      return userData as AppState['user'] | null;
    } catch (error) {
      console.error(`Failed to get user data for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Store user data in KV store for a specific user
   */
  async setUserData(userId: string, userData: AppState['user']): Promise<boolean> {
    try {
      await kv.set(this.getUserDataKey(userId), userData);
      return true;
    } catch (error) {
      console.error(`Failed to set user data for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Update user data in KV store for a specific user
   */
  async updateUserData(userId: string, updates: Partial<AppState['user']>): Promise<AppState['user'] | null> {
    try {
      const currentUserData = await this.getUserData(userId);
      if (!currentUserData) {
        return null;
      }

      const updatedUserData = {
        ...currentUserData,
        ...updates,
      };

      const success = await this.setUserData(userId, updatedUserData);
      return success ? updatedUserData : null;
    } catch (error) {
      console.error(`Failed to update user data for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Update user settings in KV store for a specific user
   */
  async updateUserSettings(userId: string, settings: Partial<AppState['user']['settings']>): Promise<AppState['user'] | null> {
    try {
      const currentUserData = await this.getUserData(userId);
      if (!currentUserData) {
        return null;
      }

      const updatedUserData = {
        ...currentUserData,
        settings: {
          ...currentUserData.settings,
          ...settings,
        },
      };

      const success = await this.setUserData(userId, updatedUserData);
      return success ? updatedUserData : null;
    } catch (error) {
      console.error(`Failed to update user settings for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Update user preferences in KV store for a specific user
   */
  async updateUserPreferences(userId: string, preferences: Partial<AppState['user']['preferences']>): Promise<AppState['user'] | null> {
    try {
      const currentUserData = await this.getUserData(userId);
      if (!currentUserData) {
        return null;
      }

      const updatedUserData = {
        ...currentUserData,
        preferences: {
          ...currentUserData.preferences,
          ...preferences,
        },
      };

      const success = await this.setUserData(userId, updatedUserData);
      return success ? updatedUserData : null;
    } catch (error) {
      console.error(`Failed to update user preferences for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Update wallet state in KV store for a specific user
   */
  async updateWalletState(userId: string, wallet: Partial<AppState['user']['wallet']>): Promise<AppState['user'] | null> {
    try {
      const currentUserData = await this.getUserData(userId);
      if (!currentUserData) {
        return null;
      }

      const updatedUserData = {
        ...currentUserData,
        wallet: {
          ...currentUserData.wallet,
          ...wallet,
        },
      };

      const success = await this.setUserData(userId, updatedUserData);
      return success ? updatedUserData : null;
    } catch (error) {
      console.error(`Failed to update wallet state for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Clear user data from KV store for a specific user
   */
  async clearUserData(userId: string): Promise<boolean> {
    try {
      await kv.del(this.getUserDataKey(userId));
      return true;
    } catch (error) {
      console.error(`Failed to clear user data for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Check if user data exists in KV store for a specific user
   */
  async hasUserData(userId: string): Promise<boolean> {
    try {
      const userData = await kv.get(this.getUserDataKey(userId));
      return userData !== null;
    } catch (error) {
      console.error(`Failed to check user data existence for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Get all user IDs that have data in the KV store
   */
  async getAllUserIds(): Promise<string[]> {
    try {
      // This is a simplified implementation - in a real app you'd need a proper index
      // For now, we'll return empty array as this is mainly for migration purposes
      return [];
    } catch (error) {
      console.error('Failed to get all user IDs:', error);
      return [];
    }
  }

  /**
   * Migrate user data from static data to KV store for a specific user
   */
  async migrateFromStatic(userId: string, userData: AppState['user']): Promise<boolean> {
    try {
      // Clear existing user data for this user
      await this.clearUserData(userId);
      
      // Store the new user data
      const success = await this.setUserData(userId, userData);
      
      if (success) {
        console.log(`✅ User data migrated successfully for user ${userId}`);
        console.log(`📊 Migrated settings: ${Object.keys(userData.settings).length} sections`);
        console.log(`📊 Migrated wallet: ${userData.wallet.isConnected ? 'Connected' : 'Disconnected'}`);
        console.log(`📊 Migrated preferences: ${Object.keys(userData.preferences).length} preferences`);
        console.log(`📊 Wallet balance: ${userData.wallet.balance.tokens.length} tokens`);
        console.log(`📊 Transaction history: ${userData.wallet.transactions.length} transactions`);
      } else {
        console.error(`❌ Failed to migrate user data for user ${userId}`);
      }
      
      return success;
    } catch (error) {
      console.error(`Failed to migrate user data for user ${userId}:`, error);
      return false;
    }
  }
}

/**
 * Bot storage service using Vercel KV for multiple users
 */
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
   * Get user-specific bot activity index key
   */
  private getUserActivityIndexKey(userId: string): string {
    return `${this.keyPrefix}:${userId}:activities:index`;
  }

  /**
   * Get user-specific bot activity key
   */
  private getUserActivityKey(userId: string, activityId: string): string {
    return `${this.keyPrefix}:${userId}:activities:${activityId}`;
  }

  /**
   * Create a new bot for a user
   */
  async createBot(userId: string, bot: import('@/schemas/bot.schema').Bot): Promise<void> {
    try {
      // Store bot data
      await kv.set(this.getUserBotKey(userId, bot.id), bot);
      
      // Update bot index
      const indexKey = this.getUserIndexKey(userId);
      const existingIds = await kv.smembers(indexKey) || [];
      await kv.sadd(indexKey, bot.id);
      
      console.log(`Bot created: ${bot.id} for user ${userId}`);
    } catch (error) {
      console.error('Failed to create bot in KV:', error);
      throw new Error('Failed to store bot data');
    }
  }

  /**
   * Get a specific bot for a user
   */
  async getBot(userId: string, botId: string): Promise<import('@/schemas/bot.schema').Bot | null> {
    try {
      const bot = await kv.get(this.getUserBotKey(userId, botId));
      return bot as import('@/schemas/bot.schema').Bot | null;
    } catch (error) {
      console.error('Failed to get bot from KV:', error);
      return null;
    }
  }

  /**
   * Update an existing bot for a user
   */
  async updateBot(userId: string, bot: import('@/schemas/bot.schema').Bot): Promise<void> {
    try {
      const existingBot = await this.getBot(userId, bot.id);
      if (!existingBot) {
        throw new Error('Bot not found');
      }

      // Update bot with current timestamp
      const updatedBot = {
        ...bot,
        lastActive: new Date().toISOString()
      };

      await kv.set(this.getUserBotKey(userId, bot.id), updatedBot);
      console.log(`Bot updated: ${bot.id} for user ${userId}`);
    } catch (error) {
      console.error('Failed to update bot in KV:', error);
      throw new Error('Failed to update bot data');
    }
  }

  /**
   * Delete a bot for a user
   */
  async deleteBot(userId: string, botId: string): Promise<void> {
    try {
      // Remove from bot index
      await kv.srem(this.getUserIndexKey(userId), botId);
      
      // Delete bot data
      await kv.del(this.getUserBotKey(userId, botId));
      
      // Clean up associated activities
      await this.deleteAllBotActivities(userId, botId);
      
      console.log(`Bot deleted: ${botId} for user ${userId}`);
    } catch (error) {
      console.error('Failed to delete bot from KV:', error);
      throw new Error('Failed to delete bot data');
    }
  }

  /**
   * Get all bots for a user
   */
  async getAllBots(userId: string): Promise<import('@/schemas/bot.schema').Bot[]> {
    try {
      const botIds = await kv.smembers(this.getUserIndexKey(userId)) || [];
      
      if (botIds.length === 0) {
        return [];
      }

      // Get all bots in parallel
      const botKeys = botIds.map(id => this.getUserBotKey(userId, id as string));
      const bots = await kv.mget(...botKeys);
      
      // Filter out null values and ensure type safety
      return bots.filter(bot => bot !== null) as import('@/schemas/bot.schema').Bot[];
    } catch (error) {
      console.error('Failed to get all bots from KV:', error);
      return [];
    }
  }

  /**
   * Add activity for a bot
   */
  async addBotActivity(userId: string, activity: import('@/schemas/bot.schema').BotActivity): Promise<void> {
    try {
      // Store activity data
      await kv.set(this.getUserActivityKey(userId, activity.id), activity);
      
      // Update activity index
      const indexKey = this.getUserActivityIndexKey(userId);
      await kv.sadd(indexKey, activity.id);
      
      console.log(`Activity added: ${activity.id} for bot ${activity.botId}, user ${userId}`);
    } catch (error) {
      console.error('Failed to add bot activity in KV:', error);
      throw new Error('Failed to store activity data');
    }
  }

  /**
   * Get activities for a specific bot
   */
  async getBotActivities(userId: string, botId: string, limit: number = 50): Promise<import('@/schemas/bot.schema').BotActivity[]> {
    try {
      // Get all activity IDs for user
      const activityIds = await kv.smembers(this.getUserActivityIndexKey(userId)) || [];
      
      if (activityIds.length === 0) {
        return [];
      }

      // Get all activities
      const activityKeys = activityIds.map(id => this.getUserActivityKey(userId, id as string));
      const activities = await kv.mget(...activityKeys);
      
      // Filter for specific bot and sort by timestamp
      const botActivities = activities
        .filter(activity => activity !== null && (activity as any).botId === botId)
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
      
      return botActivities as import('@/schemas/bot.schema').BotActivity[];
    } catch (error) {
      console.error('Failed to get bot activities from KV:', error);
      return [];
    }
  }

  /**
   * Get all activities for a user across all bots
   */
  async getAllActivities(userId: string, limit: number = 100): Promise<import('@/schemas/bot.schema').BotActivity[]> {
    try {
      const activityIds = await kv.smembers(this.getUserActivityIndexKey(userId)) || [];
      
      if (activityIds.length === 0) {
        return [];
      }

      const activityKeys = activityIds.map(id => this.getUserActivityKey(userId, id as string));
      const activities = await kv.mget(...activityKeys);
      
      // Sort by timestamp and limit
      const sortedActivities = activities
        .filter(activity => activity !== null)
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
      
      return sortedActivities as import('@/schemas/bot.schema').BotActivity[];
    } catch (error) {
      console.error('Failed to get all activities from KV:', error);
      return [];
    }
  }

  /**
   * Delete a specific activity
   */
  async deleteActivity(userId: string, activityId: string): Promise<boolean> {
    try {
      // Remove from index
      await kv.srem(this.getUserActivityIndexKey(userId), activityId);
      
      // Delete the activity data
      await kv.del(this.getUserActivityKey(userId, activityId));
      
      return true;
    } catch (error) {
      console.error('Failed to delete activity:', error);
      return false;
    }
  }

  /**
   * Clear all activities for a user
   */
  async clearAllActivities(userId: string): Promise<boolean> {
    try {
      const activityIds = await kv.smembers(this.getUserActivityIndexKey(userId)) || [];
      
      // Delete all activity data
      for (const activityId of activityIds) {
        await kv.del(this.getUserActivityKey(userId, activityId as string));
      }
      
      // Delete the index
      await kv.del(this.getUserActivityIndexKey(userId));
      
      console.log(`Cleared ${activityIds.length} activities for user ${userId}`);
      return true;
    } catch (error) {
      console.error('Failed to clear all activities:', error);
      return false;
    }
  }

  /**
   * Delete all activities for a specific bot
   */
  private async deleteAllBotActivities(userId: string, botId: string): Promise<void> {
    try {
      const activityIds = await kv.smembers(this.getUserActivityIndexKey(userId)) || [];
      const activityKeys = activityIds.map(id => this.getUserActivityKey(userId, id as string));
      
      if (activityKeys.length === 0) return;
      
      const activities = await kv.mget(...activityKeys);
      
      // Find activities for this bot
      const botActivityIds: string[] = [];
      activities.forEach((activity, index) => {
        if (activity && (activity as any).botId === botId) {
          botActivityIds.push(activityIds[index] as string);
        }
      });
      
      // Delete bot activities
      for (const activityId of botActivityIds) {
        await kv.srem(this.getUserActivityIndexKey(userId), activityId);
        await kv.del(this.getUserActivityKey(userId, activityId));
      }
      
      console.log(`Deleted ${botActivityIds.length} activities for bot ${botId}`);
    } catch (error) {
      console.error('Failed to delete bot activities:', error);
    }
  }

  /**
   * Get bot statistics for a user
   */
  async getBotStats(userId: string): Promise<import('@/schemas/bot.schema').BotStats> {
    try {
      const bots = await this.getAllBots(userId);
      
      const stats = {
        totalBots: bots.length,
        activeBots: bots.filter(bot => bot.status === 'active').length,
        pausedBots: bots.filter(bot => bot.status === 'paused').length,
        errorBots: bots.filter(bot => bot.status === 'error').length,
        totalGas: 0, // Gas tracking would be implemented based on activities
        totalValue: bots.reduce((sum, bot) => {
          const lpValue = bot.lpTokenBalances.reduce((lpSum, token) => lpSum + (token.usdValue || 0), 0);
          const rewardValue = bot.rewardTokenBalances.reduce((rewardSum, token) => rewardSum + (token.usdValue || 0), 0);
          return sum + bot.stxBalance + lpValue + rewardValue;
        }, 0),
        totalPnL: bots.reduce((sum, bot) => sum + bot.totalPnL, 0),
        todayPnL: bots.reduce((sum, bot) => sum + bot.dailyPnL, 0),
      };
      
      return stats;
    } catch (error) {
      console.error('Failed to calculate bot stats:', error);
      return {
        totalBots: 0,
        activeBots: 0,
        pausedBots: 0,
        errorBots: 0,
        totalGas: 0,
        totalValue: 0,
        totalPnL: 0,
        todayPnL: 0,
      };
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
        await kv.sadd(this.getUserIndexKey(userId), ...botIds);
      }
      
      console.log(`Successfully imported ${bots.length} bots for user ${userId}`);
    } catch (error) {
      console.error('Failed to bulk import bots:', error);
      throw new Error('Failed to import bot data');
    }
  }

  /**
   * Bulk import activities for migration purposes
   */
  async bulkImportActivities(userId: string, activities: import('@/schemas/bot.schema').BotActivity[]): Promise<void> {
    try {
      console.log(`Starting bulk import of ${activities.length} activities for user ${userId}`);
      
      // Store all activities
      for (const activity of activities) {
        await kv.set(this.getUserActivityKey(userId, activity.id), activity);
      }
      
      // Update index with all activity IDs
      const activityIds = activities.map(activity => activity.id);
      if (activityIds.length > 0) {
        await kv.sadd(this.getUserActivityIndexKey(userId), ...activityIds);
      }
      
      console.log(`Successfully imported ${activities.length} activities for user ${userId}`);
    } catch (error) {
      console.error('Failed to bulk import activities:', error);
      throw new Error('Failed to import activity data');
    }
  }

  /**
   * Clear all data for a user (for testing/reset purposes)
   */
  async clearUserData(userId: string): Promise<void> {
    try {
      // Get all bot and activity IDs
      const botIds = await kv.smembers(this.getUserIndexKey(userId)) || [];
      const activityIds = await kv.smembers(this.getUserActivityIndexKey(userId)) || [];
      
      // Delete all bots
      for (const botId of botIds) {
        await kv.del(this.getUserBotKey(userId, botId as string));
      }
      
      // Delete all activities
      for (const activityId of activityIds) {
        await kv.del(this.getUserActivityKey(userId, activityId as string));
      }
      
      // Delete indexes
      await kv.del(this.getUserIndexKey(userId));
      await kv.del(this.getUserActivityIndexKey(userId));
      
      console.log(`Cleared all bot data for user ${userId}`);
    } catch (error) {
      console.error('Failed to clear user bot data:', error);
      throw new Error('Failed to clear bot data');
    }
  }
}

// Export singleton instance
export const userDataStore = new UserDataKVStore();
export const botDataStore = new BotKVStore();

/**
 * Check if KV storage is available
 */
export async function isKVAvailable(): Promise<boolean> {
  try {
    // Try to set and get a test key
    const testKey = 'bot-manager:kv_test_' + Date.now();
    await kv.set(testKey, 'test', { ex: 1 }); // Expire in 1 second
    const result = await kv.get(testKey);
    return result === 'test';
  } catch (error) {
    console.error('KV not available:', error);
    return false;
  }
}
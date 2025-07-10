/**
 * Event-Driven Notification Generator
 * 
 * Detects critical system events and generates notifications automatically
 */

import { notificationStore, botDataStore, isKVAvailable } from '@/lib/kv-store';
import { loadAppStateConfigurableWithFallback } from '@/lib/data-loader.server';
import { 
  generateNotificationFromTemplate, 
  getDeduplicationKey,
  type NotificationEventType,
  type NotificationEventData 
} from '@/lib/notification-templates';
import { Bot, BotActivity } from '@/types/bot';

export interface NotificationGeneratorResult {
  success: boolean;
  notificationsGenerated: number;
  eventsProcessed: number;
  errors: string[];
  executionTime: number;
}

export interface EventDetectionConfig {
  // Bot monitoring thresholds
  lowFundsThreshold: number; // STX
  highValueTransactionThreshold: number; // USD
  maxFailedTransactionsPerHour: number;
  botOfflineThresholdMinutes: number;
  
  // Rate limiting
  maxNotificationsPerUserPerHour: number;
  deduplicationWindowHours: number;
}

const DEFAULT_CONFIG: EventDetectionConfig = {
  lowFundsThreshold: 10,
  highValueTransactionThreshold: 100,
  maxFailedTransactionsPerHour: 5,
  botOfflineThresholdMinutes: 30,
  maxNotificationsPerUserPerHour: 20,
  deduplicationWindowHours: 4
};

/**
 * Main notification generator class
 */
export class NotificationGenerator {
  private config: EventDetectionConfig;
  private startTime: number;
  private errors: string[] = [];

  constructor(config: Partial<EventDetectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startTime = Date.now();
  }

  /**
   * Process all events and generate notifications
   */
  async generateNotifications(): Promise<NotificationGeneratorResult> {
    console.log('[NotificationGenerator] Starting event detection and notification generation...');
    
    let notificationsGenerated = 0;
    let eventsProcessed = 0;

    try {
      // Check KV availability
      const kvAvailable = await isKVAvailable();
      if (!kvAvailable) {
        throw new Error('KV store is not available');
      }

      // Load app state for bot data
      const appState = await loadAppStateConfigurableWithFallback();
      if (!appState) {
        throw new Error('Failed to load app state');
      }

      // Get all unique users (wallet addresses)
      const allBots = appState.bots.list;
      const userWalletsSet = new Set(allBots.map(bot => bot.walletAddress));
      const userWallets = Array.from(userWalletsSet);

      console.log(`[NotificationGenerator] Processing events for ${userWallets.length} users with ${allBots.length} bots`);

      // Process events for each user
      for (const walletAddress of userWallets) {
        try {
          const userBots = allBots.filter(bot => bot.walletAddress === walletAddress);
          const userNotificationCount = await this.processUserEvents(walletAddress, userBots);
          notificationsGenerated += userNotificationCount;
          eventsProcessed += userBots.length;
        } catch (error) {
          const errorMsg = `Failed to process events for user ${walletAddress}: ${error instanceof Error ? error.message : String(error)}`;
          console.error(`[NotificationGenerator] ${errorMsg}`);
          this.errors.push(errorMsg);
        }
      }

      console.log(`[NotificationGenerator] Generated ${notificationsGenerated} notifications from ${eventsProcessed} events`);

    } catch (error) {
      const errorMsg = `Critical error in notification generation: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[NotificationGenerator] ${errorMsg}`);
      this.errors.push(errorMsg);
    }

    return {
      success: this.errors.length === 0,
      notificationsGenerated,
      eventsProcessed,
      errors: this.errors,
      executionTime: Date.now() - this.startTime
    };
  }

  /**
   * Process events for a specific user
   */
  private async processUserEvents(userId: string, userBots: Bot[]): Promise<number> {
    let notificationsGenerated = 0;

    // Check rate limiting
    const recentNotificationCount = await this.getRecentNotificationCount(userId);
    if (recentNotificationCount >= this.config.maxNotificationsPerUserPerHour) {
      console.log(`[NotificationGenerator] Rate limit reached for user ${userId} (${recentNotificationCount} notifications in last hour)`);
      return 0;
    }

    // Detect bot status events
    for (const bot of userBots) {
      try {
        const botEvents = await this.detectBotEvents(bot, userId);
        for (const event of botEvents) {
          const created = await this.createNotificationIfNotDuplicate(userId, event.eventType, event.data);
          if (created) notificationsGenerated++;
        }
      } catch (error) {
        this.errors.push(`Failed to process bot ${bot.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Detect activity events
    try {
      const activityEvents = await this.detectActivityEvents(userId, userBots);
      for (const event of activityEvents) {
        const created = await this.createNotificationIfNotDuplicate(userId, event.eventType, event.data);
        if (created) notificationsGenerated++;
      }
    } catch (error) {
      this.errors.push(`Failed to process activities for user ${userId}: ${error instanceof Error ? error.message : String(error)}`);
    }

    return notificationsGenerated;
  }

  /**
   * Detect bot-specific events
   */
  private async detectBotEvents(bot: Bot, userId: string): Promise<Array<{ eventType: NotificationEventType; data: NotificationEventData }>> {
    const events: Array<{ eventType: NotificationEventType; data: NotificationEventData }> = [];

    // Bot offline detection
    if (this.isBotOffline(bot)) {
      events.push({
        eventType: 'bot_offline',
        data: {
          botId: bot.id,
          botName: bot.name,
          walletAddress: bot.walletAddress
        }
      });
    }

    // Bot started detection (recently changed from paused/error to active)
    if (this.isBotRecentlyStarted(bot)) {
      events.push({
        eventType: 'bot_started',
        data: {
          botId: bot.id,
          botName: bot.name,
          walletAddress: bot.walletAddress
        }
      });
    }

    // Low funds detection
    if (this.isBotLowOnFunds(bot)) {
      events.push({
        eventType: 'bot_low_funds',
        data: {
          botId: bot.id,
          botName: bot.name,
          walletAddress: bot.walletAddress,
          amount: 0, // Balance data moved to analytics system
          threshold: this.config.lowFundsThreshold
        }
      });
    }

    return events;
  }

  /**
   * Detect activity-based events
   */
  private async detectActivityEvents(userId: string, userBots: Bot[]): Promise<Array<{ eventType: NotificationEventType; data: NotificationEventData }>> {
    const events: Array<{ eventType: NotificationEventType; data: NotificationEventData }> = [];

    try {
      // Get recent activities for user's bots (last 2 hours)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const botIds = userBots.map(bot => bot.id);
      
      // Note: This would use the activity API in a real implementation
      // For now, we'll use a simplified approach based on available data
      
      for (const bot of userBots) {
        // High-value transaction detection moved to analytics system
        // This check is disabled since totalVolume is no longer part of bot schema

        // Check for error status (transaction failures)
        if (bot.status === 'error') {
          events.push({
            eventType: 'transaction_failed',
            data: {
              botId: bot.id,
              botName: bot.name,
              walletAddress: bot.walletAddress,
              error: 'Bot encountered errors during execution'
            }
          });
        }
      }

    } catch (error) {
      this.errors.push(`Failed to detect activity events: ${error instanceof Error ? error.message : String(error)}`);
    }

    return events;
  }

  /**
   * Create notification if not duplicate
   */
  private async createNotificationIfNotDuplicate(
    userId: string, 
    eventType: NotificationEventType, 
    data: NotificationEventData
  ): Promise<boolean> {
    try {
      // Check for deduplication
      const deduplicationKey = getDeduplicationKey(eventType, data);
      if (deduplicationKey) {
        const isDuplicate = await this.checkForDuplicateNotification(userId, deduplicationKey);
        if (isDuplicate) {
          console.log(`[NotificationGenerator] Skipping duplicate notification: ${deduplicationKey}`);
          return false;
        }
      }

      // Generate notification from template
      const notificationData = generateNotificationFromTemplate(eventType, data, userId);
      
      // Create notification in KV store
      await notificationStore.createNotification(userId, notificationData);
      
      console.log(`[NotificationGenerator] Created notification for user ${userId}: ${eventType}`);
      return true;

    } catch (error) {
      this.errors.push(`Failed to create notification: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Check for duplicate notifications within deduplication window
   */
  private async checkForDuplicateNotification(userId: string, deduplicationKey: string): Promise<boolean> {
    try {
      const windowStart = new Date(Date.now() - this.config.deduplicationWindowHours * 60 * 60 * 1000);
      
      // Get recent notifications for user
      const recentNotifications = await notificationStore.getNotifications(userId, {
        limit: 100
      });

      // Check if any notification has the same deduplication key within the window
      return recentNotifications.notifications.some(notification => {
        const notificationTime = new Date(notification.timestamp);
        const hasMatchingKey = notification.metadata?.deduplicationKey === deduplicationKey;
        const isWithinWindow = notificationTime > windowStart;
        
        return hasMatchingKey && isWithinWindow;
      });

    } catch (error) {
      console.error(`[NotificationGenerator] Error checking for duplicates: ${error}`);
      return false; // Allow notification creation on error
    }
  }

  /**
   * Get recent notification count for rate limiting
   */
  private async getRecentNotificationCount(userId: string): Promise<number> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const recentNotifications = await notificationStore.getNotifications(userId, {
        limit: 100
      });

      return recentNotifications.notifications.filter(notification => {
        const notificationTime = new Date(notification.timestamp);
        return notificationTime > oneHourAgo;
      }).length;

    } catch (error) {
      console.error(`[NotificationGenerator] Error getting recent notification count: ${error}`);
      return 0; // Allow notifications on error
    }
  }

  /**
   * Bot status detection methods
   */
  private isBotOffline(bot: Bot): boolean {
    if (bot.status !== 'error') return false;
    
    const lastActiveTime = new Date(bot.lastActive).getTime();
    const offlineThreshold = Date.now() - (this.config.botOfflineThresholdMinutes * 60 * 1000);
    
    return lastActiveTime < offlineThreshold;
  }

  private isBotRecentlyStarted(bot: Bot): boolean {
    if (bot.status !== 'active') return false;
    
    const lastActiveTime = new Date(bot.lastActive).getTime();
    const recentThreshold = Date.now() - (10 * 60 * 1000); // Last 10 minutes
    
    return lastActiveTime > recentThreshold;
  }

  private isBotLowOnFunds(bot: Bot): boolean {
    // Balance data moved to analytics system - always return false for now
    return false;
  }
}

/**
 * Convenience function to generate notifications
 */
export async function generateEventNotifications(config?: Partial<EventDetectionConfig>): Promise<NotificationGeneratorResult> {
  const generator = new NotificationGenerator(config);
  return await generator.generateNotifications();
}
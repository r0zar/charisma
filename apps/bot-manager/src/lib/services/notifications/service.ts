/**
 * NotificationService - Controller layer for all notification backend operations
 * Handles data source selection (KV vs Static) and provides unified API
 */

// Note: Static data removed - service operates in KV mode only
import { notificationStore } from '@/lib/modules/storage';
import { ENABLE_API_NOTIFICATIONS } from '@/lib/utils/config';
import { StoredNotification } from '@/schemas/notification.schema';

export interface NotificationFilters {
  unread?: boolean;
  type?: 'success' | 'error' | 'warning' | 'info';
  category?: string;
  priority?: 'high' | 'medium' | 'low';
  limit?: number;
  offset?: number;
}

export interface NotificationSummary {
  total: number;
  unread: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}

export interface CreateNotificationData {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  priority?: 'high' | 'medium' | 'low';
  category?: string;
  metadata?: Record<string, any>;
  persistent?: boolean;
  actionUrl?: string;
}

export class NotificationService {
  private useKV: boolean;

  constructor() {
    this.useKV = ENABLE_API_NOTIFICATIONS;
  }

  /**
   * Get notifications for a user with optional filters
   */
  async getNotifications(userId: string, filters?: NotificationFilters): Promise<StoredNotification[]> {
    if (this.useKV) {
      const result = await notificationStore.getNotifications(userId, filters);
      return result.notifications;
    } else {
      // No static data - return empty array
      return [];
    }
  }

  /**
   * Scan all notifications across all users (for SSR)
   * This method always returns all notifications regardless of data source
   */
  async scanAllNotifications(): Promise<StoredNotification[]> {
    if (this.useKV) {
      // For KV, we need to scan all notifications across all users
      return await notificationStore.getAllNotificationsPublic();
    } else {
      // No static data - return empty array
      return [];
    }
  }

  /**
   * Create a new notification
   */
  async createNotification(userId: string, data: CreateNotificationData): Promise<StoredNotification> {
    if (this.useKV) {
      const notification = {
        type: data.type,
        title: data.title,
        message: data.message,
        timestamp: new Date().toISOString(),
        read: false,
        persistent: data.persistent || false,
        priority: data.priority || 'medium',
        category: data.category as 'security' | 'system' | 'bot' | 'market' | undefined,
        metadata: data.metadata,
        actionUrl: data.actionUrl,
      };
      
      return await notificationStore.createNotification(userId, notification);
    } else {
      throw new Error('Notification creation not available in static mode');
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(userId: string, notificationId: string): Promise<boolean> {
    if (this.useKV) {
      return await notificationStore.markAsRead(userId, notificationId);
    } else {
      throw new Error('Notification updates not available in static mode');
    }
  }

  /**
   * Mark notification as unread
   */
  async markAsUnread(userId: string, notificationId: string): Promise<boolean> {
    if (this.useKV) {
      return await notificationStore.markAsUnread(userId, notificationId);
    } else {
      throw new Error('Notification updates not available in static mode');
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    if (this.useKV) {
      return await notificationStore.markAllAsRead(userId);
    } else {
      throw new Error('Notification updates not available in static mode');
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(userId: string, notificationId: string): Promise<boolean> {
    if (this.useKV) {
      return await notificationStore.deleteNotification(userId, notificationId);
    } else {
      throw new Error('Notification deletion not available in static mode');
    }
  }

  /**
   * Clear all notifications
   */
  async clearAllNotifications(userId: string): Promise<boolean> {
    if (this.useKV) {
      return await notificationStore.clearAllNotifications(userId);
    } else {
      throw new Error('Notification clearing not available in static mode');
    }
  }

  /**
   * Get notification summary/stats
   */
  async getNotificationSummary(userId: string): Promise<NotificationSummary> {
    if (this.useKV) {
      return await notificationStore.getNotificationSummary(userId);
    } else {
      // No static data - return empty summary
      const notifications: any[] = [];
      const total = notifications.length;
      const unread = notifications.filter(n => !n.read).length;
      
      const byType: Record<string, number> = {};
      const byPriority: Record<string, number> = {};
      
      notifications.forEach(notification => {
        byType[notification.type] = (byType[notification.type] || 0) + 1;
        const priority = notification.priority || 'medium';
        byPriority[priority] = (byPriority[priority] || 0) + 1;
      });
      
      return {
        total,
        unread,
        byType,
        byPriority,
      };
    }
  }

  /**
   * Batch mark notifications as read
   */
  async batchMarkAsRead(userId: string, notificationIds: string[]): Promise<{ success: number; failed: number }> {
    if (this.useKV) {
      return await notificationStore.batchMarkAsRead(userId, notificationIds);
    } else {
      throw new Error('Batch operations not available in static mode');
    }
  }

  /**
   * Batch delete notifications
   */
  async batchDelete(userId: string, notificationIds: string[]): Promise<{ success: number; failed: number }> {
    if (this.useKV) {
      return await notificationStore.batchDelete(userId, notificationIds);
    } else {
      throw new Error('Batch operations not available in static mode');
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
export const notificationService = new NotificationService();
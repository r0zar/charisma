/**
 * Notification storage service using Vercel KV for multiple users
 */

import { kv } from '@vercel/kv';

import type { StoredNotification } from '@/schemas/notification.schema';
import type { NotificationFilters } from '@/lib/services/notifications/client';

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
   * Create a new notification
   */
  async createNotification(
    userId: string,
    notification: Omit<StoredNotification, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<StoredNotification> {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const fullNotification: StoredNotification = {
      ...notification,
      id,
      createdAt: now,
      updatedAt: now,
    };

    try {
      // Store the notification
      await kv.set(this.getUserNotificationKey(userId, id), fullNotification);

      // Add to user's notification index
      await kv.sadd(this.getUserIndexKey(userId), id);

      return fullNotification;
    } catch (error) {
      console.error('Failed to create notification:', error);
      throw new Error('Failed to create notification');
    }
  }

  /**
   * Get notifications for a user with optional filtering
   */
  async getNotifications(
    userId: string,
    filters: NotificationFilters = {}
  ): Promise<{ notifications: StoredNotification[]; total: number; hasMore: boolean }> {
    try {
      // Get all notification IDs for the user
      const indexKey = this.getUserIndexKey(userId);

      let notificationIds: string[] = [];
      try {
        notificationIds = await kv.smembers(indexKey) || [];
      } catch (typeError) {
        // Handle WRONGTYPE error (corrupted key with non-SET data)
        console.error('WRONGTYPE error detected for notification index:', typeError);

        // Clear the corrupted key and continue with empty list
        try {
          await kv.del(indexKey);
          console.log('Cleared corrupted notification index key');
        } catch (cleanupError) {
          console.error('Failed to clear corrupted key:', cleanupError);
        }
        notificationIds = [];
      }

      if (notificationIds.length === 0) {
        return { notifications: [], total: 0, hasMore: false };
      }

      // Fetch all notifications
      const notifications: StoredNotification[] = [];
      for (const id of notificationIds) {
        const notification = await kv.get<StoredNotification>(this.getUserNotificationKey(userId, id as string));
        if (notification) {
          notifications.push(notification);
        }
      }

      // Apply filters
      let filteredNotifications = notifications;

      if (filters.type) {
        filteredNotifications = filteredNotifications.filter(n => n.type === filters.type);
      }

      if (filters.category) {
        filteredNotifications = filteredNotifications.filter(n => n.category === filters.category);
      }

      if (filters.unread !== undefined) {
        filteredNotifications = filteredNotifications.filter(n => n.read !== filters.unread);
      }

      if (filters.priority) {
        filteredNotifications = filteredNotifications.filter(n => n.priority === filters.priority);
      }

      // Sort by timestamp (newest first)
      filteredNotifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const total = filteredNotifications.length;

      // Apply pagination
      const offset = filters.offset || 0;
      const limit = filters.limit || 50;
      const paginatedNotifications = filteredNotifications.slice(offset, offset + limit);

      const hasMore = (offset + limit) < total;

      return {
        notifications: paginatedNotifications,
        total,
        hasMore
      };
    } catch (error) {
      console.error('Failed to get notifications:', error);
      return { notifications: [], total: 0, hasMore: false };
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(userId: string, id: string): Promise<boolean> {
    try {
      const existing = await kv.get<StoredNotification>(this.getUserNotificationKey(userId, id));
      if (!existing) {
        return false;
      }

      const updated: StoredNotification = {
        ...existing,
        read: true,
        updatedAt: new Date().toISOString(),
      };

      await kv.set(this.getUserNotificationKey(userId, id), updated);
      return true;
    } catch (error) {
      console.error('Failed to mark as read:', error);
      return false;
    }
  }

  /**
   * Mark notification as unread
   */
  async markAsUnread(userId: string, id: string): Promise<boolean> {
    try {
      const existing = await kv.get<StoredNotification>(this.getUserNotificationKey(userId, id));
      if (!existing) {
        return false;
      }

      const updated: StoredNotification = {
        ...existing,
        read: false,
        updatedAt: new Date().toISOString(),
      };

      await kv.set(this.getUserNotificationKey(userId, id), updated);
      return true;
    } catch (error) {
      console.error('Failed to mark as unread:', error);
      return false;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const { notifications } = await this.getNotifications(userId, { unread: true });

      for (const notification of notifications) {
        await this.markAsRead(userId, notification.id);
      }

      return true;
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      return false;
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(userId: string, id: string): Promise<boolean> {
    try {
      // Remove from index
      await kv.srem(this.getUserIndexKey(userId), id);

      // Delete the notification
      await kv.del(this.getUserNotificationKey(userId, id));

      return true;
    } catch (error) {
      console.error('Failed to delete notification:', error);
      return false;
    }
  }

  /**
   * Update notification
   */
  async updateNotification(
    userId: string,
    id: string,
    updates: Partial<Omit<StoredNotification, 'id' | 'createdAt'>>
  ): Promise<StoredNotification | null> {
    try {
      const existing = await kv.get<StoredNotification>(this.getUserNotificationKey(userId, id));
      if (!existing) {
        return null;
      }

      const updated: StoredNotification = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await kv.set(this.getUserNotificationKey(userId, id), updated);
      return updated;
    } catch (error) {
      console.error('Failed to update notification:', error);
      return null;
    }
  }

  /**
   * Clear all notifications for a user
   */
  async clearAll(userId: string): Promise<boolean> {
    try {
      const indexKey = this.getUserIndexKey(userId);
      let notificationIds: string[] = [];

      try {
        notificationIds = await kv.smembers(indexKey) || [];
      } catch (typeError) {
        console.error('❌ WRONGTYPE error in clearAll for notification index:', typeError);
        // Just delete the corrupted key and return success
        await kv.del(indexKey);
        return true;
      }

      // Delete all notifications
      for (const id of notificationIds) {
        await kv.del(this.getUserNotificationKey(userId, id as string));
      }

      // Clear the index
      await kv.del(this.getUserIndexKey(userId));

      return true;
    } catch (error) {
      console.error('Failed to clear all notifications:', error);
      return false;
    }
  }

  /**
   * Get notification counts
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

      for (const notification of notifications) {
        // Count by type
        counts.byType[notification.type] = (counts.byType[notification.type] || 0) + 1;

        // Count by priority
        counts.byPriority[notification.priority!] = (counts.byPriority[notification.priority!] || 0) + 1;
      }

      return counts;
    } catch (error) {
      console.error('Failed to get notification counts:', error);
      return {
        total: 0,
        unread: 0,
        byType: {},
        byPriority: {},
      };
    }
  }

  /**
   * Get notification summary (alias for getNotificationCounts)
   */
  async getNotificationSummary(userId: string): Promise<{
    total: number;
    unread: number;
    byType: Record<string, number>;
    byPriority: Record<string, number>;
  }> {
    return this.getNotificationCounts(userId);
  }

  /**
   * Get all notifications across all users (for SSR scanning)
   */
  async getAllNotificationsPublic(): Promise<StoredNotification[]> {
    try {
      // Get all keys that match the notification pattern
      const allKeys = await kv.keys(`${this.keyPrefix}:*:*`);
      const notificationKeys = allKeys.filter(key => !key.includes(':index'));

      if (notificationKeys.length === 0) {
        return [];
      }

      // Fetch all notifications
      const notifications: StoredNotification[] = [];
      for (const key of notificationKeys) {
        const notification = await kv.get<StoredNotification>(key);
        if (notification) {
          notifications.push(notification);
        }
      }

      // Sort by timestamp (newest first)
      notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return notifications;
    } catch (error) {
      console.error('Failed to get all notifications public:', error);
      return [];
    }
  }

  /**
   * Clear all notifications for a user
   */
  async clearAllNotifications(userId: string): Promise<boolean> {
    try {
      // Get all notification IDs for the user
      const notificationIds = await kv.smembers(this.getUserIndexKey(userId)) || [];

      // Delete all notifications
      for (const id of notificationIds) {
        await kv.del(this.getUserNotificationKey(userId, id as string));
      }

      // Clear the index
      await kv.del(this.getUserIndexKey(userId));

      return true;
    } catch (error) {
      console.error('Failed to clear all notifications:', error);
      return false;
    }
  }

  /**
   * Batch mark as read
   */
  async batchMarkAsRead(userId: string, notificationIds: string[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const notificationId of notificationIds) {
      try {
        const result = await this.markAsRead(userId, notificationId);
        if (result) {
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        console.error(`Failed to mark notification ${notificationId} as read:`, error);
      }
    }

    return { success, failed };
  }

  /**
   * Batch delete notifications
   */
  async batchDelete(userId: string, notificationIds: string[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const notificationId of notificationIds) {
      try {
        const result = await this.deleteNotification(userId, notificationId);
        if (result) {
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        console.error(`Failed to delete notification ${notificationId}:`, error);
      }
    }

    return { success, failed };
  }
}
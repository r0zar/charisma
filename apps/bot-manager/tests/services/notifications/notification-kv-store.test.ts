/**
 * Unit tests for Notification KV Store
 * 
 * Tests KV store operations, filtering, pagination, and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationKVStore } from '@/lib/modules/storage/kv-stores/notification-store';
import { type StoredNotification } from '@/schemas/notification.schema';
import type { NotificationFilters } from '@/lib/services/notifications/client';

// Mock Vercel KV
vi.mock('@vercel/kv', () => ({
  kv: {
    set: vi.fn(),
    get: vi.fn(),
    sadd: vi.fn(),
    smembers: vi.fn(),
    srem: vi.fn(),
    del: vi.fn(),
    keys: vi.fn()
  }
}));

// Mock console to avoid noise during tests
vi.mock('console', () => ({
  log: vi.fn(),
  error: vi.fn()
}));

describe('Notification KV Store', () => {
  let store: NotificationKVStore;
  let mockNotification: Omit<StoredNotification, 'id' | 'createdAt' | 'updatedAt'>;
  let mockStoredNotification: StoredNotification;
  let mockKV: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    store = new NotificationKVStore();
    
    // Get the mocked KV instance
    mockKV = (await import('@vercel/kv')).kv;

    mockNotification = {
      type: 'info',
      title: 'Test Notification',
      message: 'This is a test notification',
      timestamp: '2025-01-15T10:00:00.000Z',
      read: false,
      priority: 'medium',
      category: 'system',
      persistent: false
    };

    mockStoredNotification = {
      ...mockNotification,
      id: 'notif_1234567890_abcdef123',
      createdAt: '2025-01-15T10:00:00.000Z',
      updatedAt: '2025-01-15T10:00:00.000Z'
    };
  });

  describe('createNotification', () => {
    it('should create notification successfully', async () => {
      mockKV.set.mockResolvedValue('OK');
      mockKV.sadd.mockResolvedValue(1);

      const result = await store.createNotification('user-123', mockNotification);

      expect(result).toMatchObject({
        ...mockNotification,
        id: expect.stringMatching(/^notif_\d+_[a-z0-9]+$/),
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      });

      expect(mockKV.set).toHaveBeenCalledWith(
        expect.stringMatching(/^bot-manager:notifications:user-123:notif_/),
        expect.objectContaining(mockNotification)
      );

      expect(mockKV.sadd).toHaveBeenCalledWith(
        'bot-manager:notifications:user-123:index',
        expect.stringMatching(/^notif_/)
      );
    });

    it('should generate unique IDs for multiple notifications', async () => {
      mockKV.set.mockResolvedValue('OK');
      mockKV.sadd.mockResolvedValue(1);

      const result1 = await store.createNotification('user-123', mockNotification);
      const result2 = await store.createNotification('user-123', mockNotification);

      expect(result1.id).not.toBe(result2.id);
    });

    it('should handle KV storage errors', async () => {
      mockKV.set.mockRejectedValue(new Error('KV error'));

      await expect(store.createNotification('user-123', mockNotification))
        .rejects.toThrow('Failed to create notification');
    });

    it('should include all optional fields', async () => {
      const notificationWithExtras = {
        ...mockNotification,
        actionUrl: 'https://example.com/action',
        metadata: { botId: 'bot-123', executionId: 'exec-456' }
      };

      mockKV.set.mockResolvedValue('OK');
      mockKV.sadd.mockResolvedValue(1);

      const result = await store.createNotification('user-123', notificationWithExtras);

      expect(result.actionUrl).toBe('https://example.com/action');
      expect(result.metadata).toEqual({ botId: 'bot-123', executionId: 'exec-456' });
    });
  });

  describe('getNotifications', () => {
    beforeEach(() => {
      const notifications = [
        { ...mockStoredNotification, id: 'notif-1', type: 'info', priority: 'low', read: false, timestamp: '2025-01-15T10:00:00.000Z' },
        { ...mockStoredNotification, id: 'notif-2', type: 'error', priority: 'high', read: true, timestamp: '2025-01-15T09:00:00.000Z' },
        { ...mockStoredNotification, id: 'notif-3', type: 'success', priority: 'medium', read: false, timestamp: '2025-01-15T11:00:00.000Z' }
      ];

      mockKV.smembers.mockResolvedValue(['notif-1', 'notif-2', 'notif-3']);
      mockKV.get.mockImplementation((key: string) => {
        const id = key.split(':').pop();
        return Promise.resolve(notifications.find(n => n.id === id) || null);
      });
    });

    it('should get all notifications without filters', async () => {
      const result = await store.getNotifications('user-123');

      expect(result.notifications).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(false);

      // Should be sorted by timestamp (newest first)
      expect(result.notifications[0].timestamp).toBe('2025-01-15T11:00:00.000Z');
      expect(result.notifications[1].timestamp).toBe('2025-01-15T10:00:00.000Z');
      expect(result.notifications[2].timestamp).toBe('2025-01-15T09:00:00.000Z');
    });

    it('should filter by type', async () => {
      const filters: NotificationFilters = { type: 'error' };
      const result = await store.getNotifications('user-123', filters);

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].type).toBe('error');
      expect(result.total).toBe(1);
    });

    it('should filter by unread status', async () => {
      const filters: NotificationFilters = { unread: true };
      const result = await store.getNotifications('user-123', filters);

      expect(result.notifications).toHaveLength(2);
      expect(result.notifications.every(n => !n.read)).toBe(true);
      expect(result.total).toBe(2);
    });

    it('should filter by priority', async () => {
      const filters: NotificationFilters = { priority: 'high' };
      const result = await store.getNotifications('user-123', filters);

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].priority).toBe('high');
    });

    it('should filter by category', async () => {
      const filters: NotificationFilters = { category: 'system' };
      const result = await store.getNotifications('user-123', filters);

      expect(result.notifications).toHaveLength(3);
      expect(result.notifications.every(n => n.category === 'system')).toBe(true);
    });

    it('should apply pagination', async () => {
      const filters: NotificationFilters = { limit: 2, offset: 1 };
      const result = await store.getNotifications('user-123', filters);

      expect(result.notifications).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(false);
    });

    it('should indicate hasMore correctly', async () => {
      const filters: NotificationFilters = { limit: 2, offset: 0 };
      const result = await store.getNotifications('user-123', filters);

      expect(result.notifications).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(true);
    });

    it('should handle empty notification list', async () => {
      mockKV.smembers.mockResolvedValue([]);

      const result = await store.getNotifications('user-123');

      expect(result.notifications).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should handle corrupted index (WRONGTYPE error)', async () => {
      mockKV.smembers.mockRejectedValue(new Error('WRONGTYPE'));
      mockKV.del.mockResolvedValue(1);

      const result = await store.getNotifications('user-123');

      expect(result.notifications).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
      expect(mockKV.del).toHaveBeenCalledWith('bot-manager:notifications:user-123:index');
    });

    it('should handle KV retrieval errors gracefully', async () => {
      mockKV.smembers.mockRejectedValue(new Error('Network error'));

      const result = await store.getNotifications('user-123');

      expect(result.notifications).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should skip null notifications', async () => {
      mockKV.smembers.mockResolvedValue(['notif-1', 'notif-missing', 'notif-3']);
      mockKV.get.mockImplementation((key: string) => {
        const id = key.split(':').pop();
        if (id === 'notif-missing') return Promise.resolve(null);
        return id === 'notif-1' ? Promise.resolve({ ...mockStoredNotification, id: 'notif-1' }) :
               id === 'notif-3' ? Promise.resolve({ ...mockStoredNotification, id: 'notif-3' }) :
               Promise.resolve(null);
      });

      const result = await store.getNotifications('user-123');

      expect(result.notifications).toHaveLength(2);
      expect(result.notifications.map(n => n.id)).toEqual(['notif-1', 'notif-3']);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read successfully', async () => {
      mockKV.get.mockResolvedValue(mockStoredNotification);
      mockKV.set.mockResolvedValue('OK');

      const result = await store.markAsRead('user-123', 'notif-456');

      expect(result).toBe(true);
      expect(mockKV.set).toHaveBeenCalledWith(
        'bot-manager:notifications:user-123:notif-456',
        expect.objectContaining({ read: true, updatedAt: expect.any(String) })
      );
    });

    it('should return false if notification not found', async () => {
      mockKV.get.mockResolvedValue(null);

      const result = await store.markAsRead('user-123', 'nonexistent');

      expect(result).toBe(false);
      expect(mockKV.set).not.toHaveBeenCalled();
    });

    it('should handle KV errors', async () => {
      mockKV.get.mockRejectedValue(new Error('KV error'));

      const result = await store.markAsRead('user-123', 'notif-456');

      expect(result).toBe(false);
    });
  });

  describe('markAsUnread', () => {
    it('should mark notification as unread successfully', async () => {
      mockKV.get.mockResolvedValue({ ...mockStoredNotification, read: true });
      mockKV.set.mockResolvedValue('OK');

      const result = await store.markAsUnread('user-123', 'notif-456');

      expect(result).toBe(true);
      expect(mockKV.set).toHaveBeenCalledWith(
        'bot-manager:notifications:user-123:notif-456',
        expect.objectContaining({ read: false, updatedAt: expect.any(String) })
      );
    });

    it('should return false if notification not found', async () => {
      mockKV.get.mockResolvedValue(null);

      const result = await store.markAsUnread('user-123', 'nonexistent');

      expect(result).toBe(false);
      expect(mockKV.set).not.toHaveBeenCalled();
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      const unreadNotifications = [
        { ...mockStoredNotification, id: 'notif-1', read: false },
        { ...mockStoredNotification, id: 'notif-2', read: false }
      ];

      // Mock getNotifications to return unread notifications
      vi.spyOn(store, 'getNotifications').mockResolvedValue({
        notifications: unreadNotifications,
        total: 2,
        hasMore: false
      });

      // Mock markAsRead to succeed
      vi.spyOn(store, 'markAsRead').mockResolvedValue(true);

      const result = await store.markAllAsRead('user-123');

      expect(result).toBe(true);
      expect(store.markAsRead).toHaveBeenCalledTimes(2);
      expect(store.markAsRead).toHaveBeenCalledWith('user-123', 'notif-1');
      expect(store.markAsRead).toHaveBeenCalledWith('user-123', 'notif-2');
    });

    it('should handle errors during batch operation', async () => {
      vi.spyOn(store, 'getNotifications').mockRejectedValue(new Error('Get error'));

      const result = await store.markAllAsRead('user-123');

      expect(result).toBe(false);
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification successfully', async () => {
      mockKV.srem.mockResolvedValue(1);
      mockKV.del.mockResolvedValue(1);

      const result = await store.deleteNotification('user-123', 'notif-456');

      expect(result).toBe(true);
      expect(mockKV.srem).toHaveBeenCalledWith('bot-manager:notifications:user-123:index', 'notif-456');
      expect(mockKV.del).toHaveBeenCalledWith('bot-manager:notifications:user-123:notif-456');
    });

    it('should handle KV deletion errors', async () => {
      mockKV.srem.mockRejectedValue(new Error('Delete error'));

      const result = await store.deleteNotification('user-123', 'notif-456');

      expect(result).toBe(false);
    });
  });

  describe('updateNotification', () => {
    it('should update notification successfully', async () => {
      mockKV.get.mockResolvedValue(mockStoredNotification);
      mockKV.set.mockResolvedValue('OK');

      const updates = { title: 'Updated Title', read: true };
      const result = await store.updateNotification('user-123', 'notif-456', updates);

      expect(result).toMatchObject({
        ...mockStoredNotification,
        title: 'Updated Title',
        read: true,
        updatedAt: expect.any(String)
      });

      expect(mockKV.set).toHaveBeenCalledWith(
        'bot-manager:notifications:user-123:notif-456',
        expect.objectContaining(updates)
      );
    });

    it('should return null if notification not found', async () => {
      mockKV.get.mockResolvedValue(null);

      const result = await store.updateNotification('user-123', 'nonexistent', { title: 'New Title' });

      expect(result).toBeNull();
      expect(mockKV.set).not.toHaveBeenCalled();
    });

    it('should handle update errors', async () => {
      mockKV.get.mockResolvedValue(mockStoredNotification);
      mockKV.set.mockRejectedValue(new Error('Update error'));

      const result = await store.updateNotification('user-123', 'notif-456', { title: 'New Title' });

      expect(result).toBeNull();
    });
  });

  describe('clearAll', () => {
    it('should clear all notifications successfully', async () => {
      mockKV.smembers.mockResolvedValue(['notif-1', 'notif-2', 'notif-3']);
      mockKV.del.mockResolvedValue(1);

      const result = await store.clearAll('user-123');

      expect(result).toBe(true);
      expect(mockKV.del).toHaveBeenCalledTimes(4); // 3 notifications + 1 index
      expect(mockKV.del).toHaveBeenCalledWith('bot-manager:notifications:user-123:notif-1');
      expect(mockKV.del).toHaveBeenCalledWith('bot-manager:notifications:user-123:notif-2');
      expect(mockKV.del).toHaveBeenCalledWith('bot-manager:notifications:user-123:notif-3');
      expect(mockKV.del).toHaveBeenCalledWith('bot-manager:notifications:user-123:index');
    });

    it('should handle corrupted index during clear', async () => {
      mockKV.smembers.mockRejectedValue(new Error('WRONGTYPE'));
      mockKV.del.mockResolvedValue(1);

      const result = await store.clearAll('user-123');

      expect(result).toBe(true);
      expect(mockKV.del).toHaveBeenCalledWith('bot-manager:notifications:user-123:index');
    });

    it('should handle clear errors', async () => {
      // Mock smembers to succeed but del to fail
      mockKV.smembers.mockResolvedValue(['notif-1']);
      mockKV.del.mockRejectedValue(new Error('Delete error'));

      const result = await store.clearAll('user-123');

      expect(result).toBe(false);
    });
  });

  describe('getNotificationCounts', () => {
    beforeEach(() => {
      const notifications = [
        { ...mockStoredNotification, id: 'notif-1', type: 'info' as const, priority: 'low' as const, read: false },
        { ...mockStoredNotification, id: 'notif-2', type: 'error' as const, priority: 'high' as const, read: true },
        { ...mockStoredNotification, id: 'notif-3', type: 'info' as const, priority: 'medium' as const, read: false },
        { ...mockStoredNotification, id: 'notif-4', type: 'success' as const, priority: 'high' as const, read: false }
      ];

      vi.spyOn(store, 'getNotifications').mockResolvedValue({
        notifications,
        total: 4,
        hasMore: false
      });
    });

    it('should return correct notification counts', async () => {
      const result = await store.getNotificationCounts('user-123');

      expect(result).toEqual({
        total: 4,
        unread: 3,
        byType: { info: 2, error: 1, success: 1 },
        byPriority: { low: 1, high: 2, medium: 1 }
      });
    });

    it('should handle errors during count calculation', async () => {
      vi.spyOn(store, 'getNotifications').mockRejectedValue(new Error('Count error'));

      const result = await store.getNotificationCounts('user-123');

      expect(result).toEqual({
        total: 0,
        unread: 0,
        byType: {},
        byPriority: {}
      });
    });
  });

  describe('getAllNotificationsPublic', () => {
    it('should get all notifications across all users', async () => {
      const allKeys = [
        'bot-manager:notifications:user1:notif-1',
        'bot-manager:notifications:user1:index',
        'bot-manager:notifications:user2:notif-2',
        'bot-manager:notifications:user2:index'
      ];

      mockKV.keys.mockResolvedValue(allKeys);
      mockKV.get.mockImplementation((key: string) => {
        if (key.includes('notif-1')) {
          return Promise.resolve({ ...mockStoredNotification, id: 'notif-1', timestamp: '2025-01-15T10:00:00.000Z' });
        }
        if (key.includes('notif-2')) {
          return Promise.resolve({ ...mockStoredNotification, id: 'notif-2', timestamp: '2025-01-15T11:00:00.000Z' });
        }
        return Promise.resolve(null);
      });

      const result = await store.getAllNotificationsPublic();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('notif-2'); // Newest first
      expect(result[1].id).toBe('notif-1');
    });

    it('should handle empty keys list', async () => {
      mockKV.keys.mockResolvedValue([]);

      const result = await store.getAllNotificationsPublic();

      expect(result).toHaveLength(0);
    });

    it('should handle keys query errors', async () => {
      mockKV.keys.mockRejectedValue(new Error('Keys error'));

      const result = await store.getAllNotificationsPublic();

      expect(result).toHaveLength(0);
    });
  });

  describe('batchMarkAsRead', () => {
    it('should mark multiple notifications as read', async () => {
      const notificationIds = ['notif-1', 'notif-2', 'notif-3'];
      vi.spyOn(store, 'markAsRead')
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const result = await store.batchMarkAsRead('user-123', notificationIds);

      expect(result).toEqual({ success: 2, failed: 1 });
      expect(store.markAsRead).toHaveBeenCalledTimes(3);
    });

    it('should handle errors in individual mark operations', async () => {
      const notificationIds = ['notif-1', 'notif-2'];
      vi.spyOn(store, 'markAsRead')
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('Mark error'));

      const result = await store.batchMarkAsRead('user-123', notificationIds);

      expect(result).toEqual({ success: 1, failed: 1 });
    });
  });

  describe('batchDelete', () => {
    it('should delete multiple notifications', async () => {
      const notificationIds = ['notif-1', 'notif-2', 'notif-3'];
      vi.spyOn(store, 'deleteNotification')
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const result = await store.batchDelete('user-123', notificationIds);

      expect(result).toEqual({ success: 2, failed: 1 });
      expect(store.deleteNotification).toHaveBeenCalledTimes(3);
    });

    it('should handle errors in individual delete operations', async () => {
      const notificationIds = ['notif-1', 'notif-2'];
      vi.spyOn(store, 'deleteNotification')
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('Delete error'));

      const result = await store.batchDelete('user-123', notificationIds);

      expect(result).toEqual({ success: 1, failed: 1 });
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle malformed notification data gracefully', async () => {
      const malformedNotification = {
        type: 'invalid-type' as any,
        title: null as any,
        message: undefined as any,
        timestamp: 'invalid-date',
        read: 'not-boolean' as any
      };

      mockKV.set.mockResolvedValue('OK');
      mockKV.sadd.mockResolvedValue(1);

      const result = await store.createNotification('user-123', malformedNotification);

      expect(result).toMatchObject({
        type: 'invalid-type',
        title: null,
        message: undefined,
        timestamp: 'invalid-date',
        read: 'not-boolean'
      });
    });

    it('should handle concurrent access gracefully', async () => {
      mockKV.set.mockResolvedValue('OK');
      mockKV.sadd.mockResolvedValue(1);

      // Simulate concurrent creation
      const promises = Array.from({ length: 3 }, () =>
        store.createNotification('user-123', mockNotification)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      const ids = results.map(r => r.id);
      expect(new Set(ids).size).toBe(3); // All IDs should be unique
    });

    it('should handle very large notification lists', async () => {
      const largeIdList = Array.from({ length: 1000 }, (_, i) => `notif-${i}`);
      mockKV.smembers.mockResolvedValue(largeIdList);
      mockKV.get.mockResolvedValue(mockStoredNotification);

      const result = await store.getNotifications('user-123', { limit: 10 });

      expect(result.notifications).toHaveLength(10);
      expect(result.total).toBe(1000);
      expect(result.hasMore).toBe(true);
    });
  });
});
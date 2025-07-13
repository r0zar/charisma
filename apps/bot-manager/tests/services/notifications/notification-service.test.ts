/**
 * Unit tests for Notification Service
 * 
 * Tests notification management, KV store interactions, and service layer functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NotificationService,
  notificationService,
  type NotificationFilters,
  type NotificationSummary,
  type CreateNotificationData
} from '@/lib/services/notifications/service';
import { type StoredNotification } from '@/schemas/notification.schema';

// Mock dependencies
vi.mock('@/lib/modules/storage', () => ({
  notificationStore: {
    getNotifications: vi.fn(),
    getAllNotificationsPublic: vi.fn(),
    createNotification: vi.fn(),
    markAsRead: vi.fn(),
    markAsUnread: vi.fn(),
    markAllAsRead: vi.fn(),
    deleteNotification: vi.fn(),
    clearAllNotifications: vi.fn(),
    getNotificationSummary: vi.fn(),
    batchMarkAsRead: vi.fn(),
    batchDelete: vi.fn()
  }
}));

vi.mock('@/lib/utils/config', () => ({
  ENABLE_API_NOTIFICATIONS: true
}));

// Mock console to avoid noise during tests
vi.mock('console', () => ({
  log: vi.fn(),
  error: vi.fn()
}));

describe('Notification Service', () => {
  let mockNotificationStore: any;
  let mockNotification: StoredNotification;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Import mocked store
    mockNotificationStore = (await import('@/lib/modules/storage')).notificationStore;
    
    mockNotification = {
      id: 'notif_1234567890_abcdef123',
      type: 'info',
      title: 'Test Notification',
      message: 'This is a test notification',
      timestamp: '2025-01-15T10:00:00.000Z',
      read: false,
      priority: 'medium',
      category: 'system',
      persistent: false,
      createdAt: '2025-01-15T10:00:00.000Z',
      updatedAt: '2025-01-15T10:00:00.000Z'
    };
  });

  describe('constructor and configuration', () => {
    it('should initialize with KV mode enabled', () => {
      const service = new NotificationService();
      expect(service.isKVEnabled()).toBe(true);
      expect(service.getDataSource()).toBe('kv');
    });
  });

  describe('getNotifications', () => {
    it('should get notifications with KV enabled', async () => {
      const mockFilters: NotificationFilters = { unread: true, limit: 10 };
      const mockResult = {
        notifications: [mockNotification],
        total: 1,
        hasMore: false
      };

      mockNotificationStore.getNotifications.mockResolvedValue(mockResult);

      const result = await notificationService.getNotifications('user-123', mockFilters);

      expect(result).toEqual([mockNotification]);
      expect(mockNotificationStore.getNotifications).toHaveBeenCalledWith('user-123', mockFilters);
    });

    it('should handle filters correctly', async () => {
      const filters: NotificationFilters = {
        type: 'error',
        priority: 'high',
        category: 'security',
        limit: 5,
        offset: 10
      };

      mockNotificationStore.getNotifications.mockResolvedValue({
        notifications: [],
        total: 0,
        hasMore: false
      });

      await notificationService.getNotifications('user-123', filters);

      expect(mockNotificationStore.getNotifications).toHaveBeenCalledWith('user-123', filters);
    });
  });

  describe('scanAllNotifications', () => {
    it('should scan all notifications across users with KV enabled', async () => {
      const mockNotifications = [mockNotification, { ...mockNotification, id: 'notif_2' }];
      mockNotificationStore.getAllNotificationsPublic.mockResolvedValue(mockNotifications);

      const result = await notificationService.scanAllNotifications();

      expect(result).toEqual(mockNotifications);
      expect(mockNotificationStore.getAllNotificationsPublic).toHaveBeenCalled();
    });
  });

  describe('createNotification', () => {
    it('should create notification successfully', async () => {
      const createData: CreateNotificationData = {
        type: 'success',
        title: 'Bot Executed',
        message: 'Your bot executed successfully',
        priority: 'low',
        category: 'bot',
        metadata: { botId: 'bot-123' },
        persistent: true,
        actionUrl: 'https://example.com/bot/123'
      };

      mockNotificationStore.createNotification.mockResolvedValue(mockNotification);

      const result = await notificationService.createNotification('user-123', createData);

      expect(result).toEqual(mockNotification);
      expect(mockNotificationStore.createNotification).toHaveBeenCalledWith('user-123', expect.objectContaining({
        type: 'success',
        title: 'Bot Executed',
        message: 'Your bot executed successfully',
        priority: 'low',
        category: 'bot',
        metadata: { botId: 'bot-123' },
        persistent: true,
        actionUrl: 'https://example.com/bot/123',
        read: false,
        timestamp: expect.any(String)
      }));
    });

    it('should create notification with default values', async () => {
      const createData: CreateNotificationData = {
        type: 'info',
        title: 'Simple Notification',
        message: 'Basic message'
      };

      mockNotificationStore.createNotification.mockResolvedValue(mockNotification);

      await notificationService.createNotification('user-123', createData);

      expect(mockNotificationStore.createNotification).toHaveBeenCalledWith('user-123', expect.objectContaining({
        type: 'info',
        title: 'Simple Notification',
        message: 'Basic message',
        priority: 'medium',
        persistent: false,
        read: false
      }));
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read successfully', async () => {
      mockNotificationStore.markAsRead.mockResolvedValue(true);

      const result = await notificationService.markAsRead('user-123', 'notif-456');

      expect(result).toBe(true);
      expect(mockNotificationStore.markAsRead).toHaveBeenCalledWith('user-123', 'notif-456');
    });

    it('should handle notification not found', async () => {
      mockNotificationStore.markAsRead.mockResolvedValue(false);

      const result = await notificationService.markAsRead('user-123', 'nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('markAsUnread', () => {
    it('should mark notification as unread successfully', async () => {
      mockNotificationStore.markAsUnread.mockResolvedValue(true);

      const result = await notificationService.markAsUnread('user-123', 'notif-456');

      expect(result).toBe(true);
      expect(mockNotificationStore.markAsUnread).toHaveBeenCalledWith('user-123', 'notif-456');
    });

    it('should handle notification not found', async () => {
      mockNotificationStore.markAsUnread.mockResolvedValue(false);

      const result = await notificationService.markAsUnread('user-123', 'nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read successfully', async () => {
      mockNotificationStore.markAllAsRead.mockResolvedValue(true);

      const result = await notificationService.markAllAsRead('user-123');

      expect(result).toBe(true);
      expect(mockNotificationStore.markAllAsRead).toHaveBeenCalledWith('user-123');
    });

    it('should handle failure', async () => {
      mockNotificationStore.markAllAsRead.mockResolvedValue(false);

      const result = await notificationService.markAllAsRead('user-123');

      expect(result).toBe(false);
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification successfully', async () => {
      mockNotificationStore.deleteNotification.mockResolvedValue(true);

      const result = await notificationService.deleteNotification('user-123', 'notif-456');

      expect(result).toBe(true);
      expect(mockNotificationStore.deleteNotification).toHaveBeenCalledWith('user-123', 'notif-456');
    });

    it('should handle notification not found', async () => {
      mockNotificationStore.deleteNotification.mockResolvedValue(false);

      const result = await notificationService.deleteNotification('user-123', 'nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('clearAllNotifications', () => {
    it('should clear all notifications successfully', async () => {
      mockNotificationStore.clearAllNotifications.mockResolvedValue(true);

      const result = await notificationService.clearAllNotifications('user-123');

      expect(result).toBe(true);
      expect(mockNotificationStore.clearAllNotifications).toHaveBeenCalledWith('user-123');
    });

    it('should handle failure', async () => {
      mockNotificationStore.clearAllNotifications.mockResolvedValue(false);

      const result = await notificationService.clearAllNotifications('user-123');

      expect(result).toBe(false);
    });
  });

  describe('getNotificationSummary', () => {
    it('should get notification summary with KV enabled', async () => {
      const mockSummary: NotificationSummary = {
        total: 5,
        unread: 2,
        byType: { error: 1, info: 3, success: 1 },
        byPriority: { high: 1, medium: 3, low: 1 }
      };

      mockNotificationStore.getNotificationSummary.mockResolvedValue(mockSummary);

      const result = await notificationService.getNotificationSummary('user-123');

      expect(result).toEqual(mockSummary);
      expect(mockNotificationStore.getNotificationSummary).toHaveBeenCalledWith('user-123');
    });
  });

  describe('batchMarkAsRead', () => {
    it('should mark multiple notifications as read', async () => {
      const notificationIds = ['notif-1', 'notif-2', 'notif-3'];
      const mockResult = { success: 2, failed: 1 };

      mockNotificationStore.batchMarkAsRead.mockResolvedValue(mockResult);

      const result = await notificationService.batchMarkAsRead('user-123', notificationIds);

      expect(result).toEqual(mockResult);
      expect(mockNotificationStore.batchMarkAsRead).toHaveBeenCalledWith('user-123', notificationIds);
    });

    it('should handle empty notification list', async () => {
      const mockResult = { success: 0, failed: 0 };
      mockNotificationStore.batchMarkAsRead.mockResolvedValue(mockResult);

      const result = await notificationService.batchMarkAsRead('user-123', []);

      expect(result).toEqual(mockResult);
      expect(mockNotificationStore.batchMarkAsRead).toHaveBeenCalledWith('user-123', []);
    });
  });

  describe('batchDelete', () => {
    it('should delete multiple notifications', async () => {
      const notificationIds = ['notif-1', 'notif-2', 'notif-3'];
      const mockResult = { success: 3, failed: 0 };

      mockNotificationStore.batchDelete.mockResolvedValue(mockResult);

      const result = await notificationService.batchDelete('user-123', notificationIds);

      expect(result).toEqual(mockResult);
      expect(mockNotificationStore.batchDelete).toHaveBeenCalledWith('user-123', notificationIds);
    });

    it('should handle partial failures', async () => {
      const notificationIds = ['notif-1', 'invalid-id', 'notif-3'];
      const mockResult = { success: 2, failed: 1 };

      mockNotificationStore.batchDelete.mockResolvedValue(mockResult);

      const result = await notificationService.batchDelete('user-123', notificationIds);

      expect(result).toEqual(mockResult);
    });
  });

  describe('utility methods', () => {
    it('should check if KV is enabled', () => {
      expect(notificationService.isKVEnabled()).toBe(true);
    });

    it('should get data source type', () => {
      expect(notificationService.getDataSource()).toBe('kv');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle null/undefined user IDs gracefully', async () => {
      mockNotificationStore.getNotifications.mockResolvedValue({
        notifications: [],
        total: 0,
        hasMore: false
      });

      const result = await notificationService.getNotifications('');

      expect(result).toEqual([]);
      expect(mockNotificationStore.getNotifications).toHaveBeenCalledWith('', undefined);
    });

    it('should handle malformed notification data', async () => {
      const createData: CreateNotificationData = {
        type: 'info' as any,
        title: '',
        message: ''
      };

      mockNotificationStore.createNotification.mockResolvedValue(mockNotification);

      const result = await notificationService.createNotification('user-123', createData);

      expect(result).toEqual(mockNotification);
    });

    it('should handle store operation failures', async () => {
      mockNotificationStore.markAsRead.mockRejectedValue(new Error('Store error'));

      await expect(notificationService.markAsRead('user-123', 'notif-456'))
        .rejects.toThrow('Store error');
    });
  });

  describe('Singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(notificationService).toBeInstanceOf(NotificationService);
    });

    it('should have all required methods', () => {
      expect(typeof notificationService.getNotifications).toBe('function');
      expect(typeof notificationService.scanAllNotifications).toBe('function');
      expect(typeof notificationService.createNotification).toBe('function');
      expect(typeof notificationService.markAsRead).toBe('function');
      expect(typeof notificationService.markAsUnread).toBe('function');
      expect(typeof notificationService.markAllAsRead).toBe('function');
      expect(typeof notificationService.deleteNotification).toBe('function');
      expect(typeof notificationService.clearAllNotifications).toBe('function');
      expect(typeof notificationService.getNotificationSummary).toBe('function');
      expect(typeof notificationService.batchMarkAsRead).toBe('function');
      expect(typeof notificationService.batchDelete).toBe('function');
      expect(typeof notificationService.isKVEnabled).toBe('function');
      expect(typeof notificationService.getDataSource).toBe('function');
    });
  });
});
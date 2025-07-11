'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo,useState } from 'react';

import { useToast } from '@/contexts/toast-context';
import { useWallet } from '@/contexts/wallet-context';
import { 
  CreateNotificationData,
  NotificationFilters, 
  NotificationsApiClient, 
  NotificationSummary
} from '@/lib/services/notifications/client';
import { StoredNotification } from '@/schemas/notification.schema';

/**
 * Notifications context interface
 */
interface NotificationsContextType {
  // State
  notifications: StoredNotification[];
  loading: boolean;
  error: string | null;
  summary: NotificationSummary;
  
  // Pagination
  hasMore: boolean;
  totalNotifications: number;
  
  // Current filters
  currentFilters: NotificationFilters;
  
  // Methods
  loadNotifications: (filters?: NotificationFilters) => Promise<void>;
  loadMoreNotifications: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  createNotification: (data: CreateNotificationData) => Promise<StoredNotification | null>;
  
  // Lifecycle methods
  markAsRead: (notificationId: string) => Promise<boolean>;
  markAsUnread: (notificationId: string) => Promise<boolean>;
  markAllAsRead: () => Promise<boolean>;
  deleteNotification: (notificationId: string) => Promise<boolean>;
  clearAllNotifications: () => Promise<boolean>;
  
  // Batch operations
  batchMarkAsRead: (notificationIds: string[]) => Promise<{ success: number; failed: number }>;
  batchDelete: (notificationIds: string[]) => Promise<{ success: number; failed: number }>;
  
  // Filtering
  setFilters: (filters: NotificationFilters) => void;
  getUnreadCount: () => number;
  getNotificationsByType: (type: string) => StoredNotification[];
  getNotificationsByPriority: (priority: string) => StoredNotification[];
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

interface NotificationsProviderProps {
  children: React.ReactNode;
}

export function NotificationsProvider({ children }: NotificationsProviderProps) {
  const { getUserId } = useWallet();
  const { showError, showSuccess } = useToast();
  
  // State
  const [notifications, setNotifications] = useState<StoredNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalNotifications, setTotalNotifications] = useState(0);
  const [summary, setSummary] = useState<NotificationSummary>({
    total: 0,
    unread: 0,
    byType: {},
    byPriority: {}
  });
  const [currentFilters, setCurrentFilters] = useState<NotificationFilters>({
    limit: 50,
    offset: 0
  });

  // API client (memoized to prevent recreation)
  const apiClient = useMemo(() => new NotificationsApiClient(), []);

  /**
   * Load notifications with optional filters
   */
  const loadNotifications = useCallback(async (filters: NotificationFilters = {}) => {
    const userId = getUserId();
    if (!userId || userId === 'anonymous') {
      console.log('[NotificationsContext] No authenticated user, skipping notification load');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const mergedFilters = {
        limit: 50,
        offset: 0,
        ...filters
      };

      const response = await apiClient.getNotifications(userId, mergedFilters);
      
      setNotifications(response.notifications);
      setHasMore(response.pagination.hasMore);
      setTotalNotifications(response.pagination.total);
      setSummary(response.summary);
      setCurrentFilters(mergedFilters);

      console.log(`[NotificationsContext] Loaded ${response.notifications.length} notifications for user ${userId}`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load notifications';
      setError(errorMessage);
      console.error('[NotificationsContext] Error loading notifications:', err);
      
      showError('Failed to load notifications', errorMessage, 5000);
    } finally {
      setLoading(false);
    }
  }, [getUserId, apiClient, showError]);

  /**
   * Load more notifications (pagination)
   */
  const loadMoreNotifications = useCallback(async () => {
    const userId = getUserId();
    if (!userId || userId === 'anonymous' || !hasMore || loading) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const nextFilters = {
        ...currentFilters,
        offset: notifications.length
      };

      const response = await apiClient.getNotifications(userId, nextFilters);
      
      setNotifications(prev => [...prev, ...response.notifications]);
      setHasMore(response.pagination.hasMore);
      setCurrentFilters(nextFilters);

      console.log(`[NotificationsContext] Loaded ${response.notifications.length} more notifications`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load more notifications';
      setError(errorMessage);
      console.error('[NotificationsContext] Error loading more notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [getUserId, apiClient, currentFilters, notifications.length, hasMore, loading]);

  /**
   * Refresh current notifications
   */
  const refreshNotifications = useCallback(async () => {
    await loadNotifications(currentFilters);
  }, [loadNotifications, currentFilters]);

  /**
   * Create a new notification
   */
  const createNotification = useCallback(async (data: CreateNotificationData): Promise<StoredNotification | null> => {
    const userId = getUserId();
    if (!userId || userId === 'anonymous') {
      showError('Authentication required', 'Please connect your wallet to create notifications', 5000);
      return null;
    }

    try {
      const response = await apiClient.createNotification(userId, data);
      
      // Add the new notification to the beginning of the list
      setNotifications(prev => [response.notification, ...prev]);
      setTotalNotifications(prev => prev + 1);
      setSummary(prev => ({
        ...prev,
        total: prev.total + 1,
        unread: prev.unread + 1
      }));

      showSuccess('Notification created', 'New notification has been created successfully', 3000);

      console.log(`[NotificationsContext] Created notification ${response.notification.id}`);
      return response.notification;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create notification';
      setError(errorMessage);
      console.error('[NotificationsContext] Error creating notification:', err);
      
      showError('Failed to create notification', errorMessage, 5000);
      
      return null;
    }
  }, [getUserId, apiClient, showError, showSuccess]);

  /**
   * Mark notification as read
   */
  const markAsRead = useCallback(async (notificationId: string): Promise<boolean> => {
    const userId = getUserId();
    if (!userId || userId === 'anonymous') {
      return false;
    }

    try {
      await apiClient.markAsRead(userId, notificationId);
      
      // Update local state
      setNotifications(prev => prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true }
          : notification
      ));
      
      setSummary(prev => ({
        ...prev,
        unread: Math.max(0, prev.unread - 1)
      }));

      console.log(`[NotificationsContext] Marked notification ${notificationId} as read`);
      return true;

    } catch (err) {
      console.error('[NotificationsContext] Error marking notification as read:', err);
      showError('Failed to mark as read', err instanceof Error ? err.message : 'Unknown error', 3000);
      return false;
    }
  }, [getUserId, apiClient, showError]);

  /**
   * Mark notification as unread
   */
  const markAsUnread = useCallback(async (notificationId: string): Promise<boolean> => {
    const userId = getUserId();
    if (!userId || userId === 'anonymous') {
      return false;
    }

    try {
      await apiClient.markAsUnread(userId, notificationId);
      
      // Update local state
      setNotifications(prev => prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: false }
          : notification
      ));
      
      setSummary(prev => ({
        ...prev,
        unread: prev.unread + 1
      }));

      console.log(`[NotificationsContext] Marked notification ${notificationId} as unread`);
      return true;

    } catch (err) {
      console.error('[NotificationsContext] Error marking notification as unread:', err);
      showError('Failed to mark as unread', err instanceof Error ? err.message : 'Unknown error', 3000);
      return false;
    }
  }, [getUserId, apiClient, showError]);

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = useCallback(async (): Promise<boolean> => {
    const userId = getUserId();
    if (!userId || userId === 'anonymous') {
      return false;
    }

    try {
      await apiClient.markAllAsRead(userId);
      
      // Update local state
      setNotifications(prev => prev.map(notification => ({ ...notification, read: true })));
      setSummary(prev => ({ ...prev, unread: 0 }));

      showSuccess('All notifications marked as read', '', 2000);
      console.log(`[NotificationsContext] Marked all notifications as read`);
      return true;

    } catch (err) {
      console.error('[NotificationsContext] Error marking all as read:', err);
      showError('Failed to mark all as read', err instanceof Error ? err.message : 'Unknown error', 3000);
      return false;
    }
  }, [getUserId, apiClient, showError, showSuccess]);

  /**
   * Delete notification
   */
  const deleteNotification = useCallback(async (notificationId: string): Promise<boolean> => {
    const userId = getUserId();
    if (!userId || userId === 'anonymous') {
      return false;
    }

    try {
      await apiClient.deleteNotification(userId, notificationId);
      
      // Update local state
      const deletedNotification = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(notification => notification.id !== notificationId));
      setTotalNotifications(prev => prev - 1);
      setSummary(prev => ({
        ...prev,
        total: prev.total - 1,
        unread: deletedNotification && !deletedNotification.read ? prev.unread - 1 : prev.unread
      }));

      showSuccess('Notification deleted', '', 2000);
      console.log(`[NotificationsContext] Deleted notification ${notificationId}`);
      return true;

    } catch (err) {
      console.error('[NotificationsContext] Error deleting notification:', err);
      showError('Failed to delete notification', err instanceof Error ? err.message : 'Unknown error', 3000);
      return false;
    }
  }, [getUserId, apiClient, notifications, showError, showSuccess]);

  /**
   * Clear all notifications
   */
  const clearAllNotifications = useCallback(async (): Promise<boolean> => {
    const userId = getUserId();
    if (!userId || userId === 'anonymous') {
      return false;
    }

    try {
      await apiClient.clearAllNotifications(userId);
      
      // Update local state
      setNotifications([]);
      setTotalNotifications(0);
      setSummary({
        total: 0,
        unread: 0,
        byType: {},
        byPriority: {}
      });

      showSuccess('All notifications cleared', '', 2000);
      console.log(`[NotificationsContext] Cleared all notifications`);
      return true;

    } catch (err) {
      console.error('[NotificationsContext] Error clearing notifications:', err);
      showError('Failed to clear notifications', err instanceof Error ? err.message : 'Unknown error', 3000);
      return false;
    }
  }, [getUserId, apiClient, showError, showSuccess]);

  /**
   * Batch mark as read
   */
  const batchMarkAsRead = useCallback(async (notificationIds: string[]): Promise<{ success: number; failed: number }> => {
    const userId = getUserId();
    if (!userId || userId === 'anonymous') {
      return { success: 0, failed: notificationIds.length };
    }

    try {
      const result = await apiClient.batchMarkAsRead(userId, notificationIds);
      
      // Update local state for successful operations
      if (result.success > 0) {
        setNotifications(prev => prev.map(notification => 
          notificationIds.includes(notification.id) 
            ? { ...notification, read: true }
            : notification
        ));
        
        setSummary(prev => ({
          ...prev,
          unread: Math.max(0, prev.unread - result.success)
        }));

        showSuccess(`Marked ${result.success} notifications as read`, '', 2000);
      }

      if (result.failed > 0) {
        showError(`Failed to mark ${result.failed} notifications as read`, '', 3000);
      }

      return { success: result.success, failed: result.failed };

    } catch (err) {
      console.error('[NotificationsContext] Error in batch mark as read:', err);
      showError('Batch operation failed', err instanceof Error ? err.message : 'Unknown error', 3000);
      return { success: 0, failed: notificationIds.length };
    }
  }, [getUserId, apiClient, showError, showSuccess]);

  /**
   * Batch delete
   */
  const batchDelete = useCallback(async (notificationIds: string[]): Promise<{ success: number; failed: number }> => {
    const userId = getUserId();
    if (!userId || userId === 'anonymous') {
      return { success: 0, failed: notificationIds.length };
    }

    try {
      const result = await apiClient.batchDelete(userId, notificationIds);
      
      // Update local state for successful deletions
      if (result.success > 0) {
        const deletedNotifications = notifications.filter(n => notificationIds.includes(n.id));
        const unreadDeleted = deletedNotifications.filter(n => !n.read).length;
        
        setNotifications(prev => prev.filter(notification => !notificationIds.includes(notification.id)));
        setTotalNotifications(prev => prev - result.success);
        setSummary(prev => ({
          ...prev,
          total: prev.total - result.success,
          unread: Math.max(0, prev.unread - unreadDeleted)
        }));

        showSuccess(`Deleted ${result.success} notifications`, '', 2000);
      }

      if (result.failed > 0) {
        showError(`Failed to delete ${result.failed} notifications`, '', 3000);
      }

      return { success: result.success, failed: result.failed };

    } catch (err) {
      console.error('[NotificationsContext] Error in batch delete:', err);
      showError('Batch operation failed', err instanceof Error ? err.message : 'Unknown error', 3000);
      return { success: 0, failed: notificationIds.length };
    }
  }, [getUserId, apiClient, notifications, showError, showSuccess]);

  /**
   * Set filters and reload notifications
   */
  const setFilters = useCallback((filters: NotificationFilters) => {
    const newFilters = { limit: 50, offset: 0, ...filters };
    setCurrentFilters(newFilters);
    loadNotifications(newFilters);
  }, [loadNotifications]);

  /**
   * Get unread count
   */
  const getUnreadCount = useCallback((): number => {
    return summary.unread;
  }, [summary.unread]);

  /**
   * Get notifications by type
   */
  const getNotificationsByType = useCallback((type: string): StoredNotification[] => {
    return notifications.filter(n => n.type === type);
  }, [notifications]);

  /**
   * Get notifications by priority
   */
  const getNotificationsByPriority = useCallback((priority: string): StoredNotification[] => {
    return notifications.filter(n => n.priority === priority);
  }, [notifications]);

  // Load initial notifications when user changes
  useEffect(() => {
    const userId = getUserId();
    if (userId && userId !== 'anonymous') {
      loadNotifications();
    }
  }, [getUserId, loadNotifications]);

  const contextValue: NotificationsContextType = {
    // State
    notifications,
    loading,
    error,
    summary,
    hasMore,
    totalNotifications,
    currentFilters,
    
    // Methods
    loadNotifications,
    loadMoreNotifications,
    refreshNotifications,
    createNotification,
    
    // Lifecycle methods
    markAsRead,
    markAsUnread,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    
    // Batch operations
    batchMarkAsRead,
    batchDelete,
    
    // Filtering
    setFilters,
    getUnreadCount,
    getNotificationsByType,
    getNotificationsByPriority,
  };

  return (
    <NotificationsContext.Provider value={contextValue}>
      {children}
    </NotificationsContext.Provider>
  );
}

/**
 * Hook to use the notifications context
 */
export function useNotificationsData() {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotificationsData must be used within a NotificationsProvider');
  }
  return context;
}
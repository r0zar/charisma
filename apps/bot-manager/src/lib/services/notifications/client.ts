/**
 * Type-safe Notifications API Client
 * 
 * Provides a clean interface for interacting with notification endpoints
 * with proper error handling, retry logic, and TypeScript support
 */

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

export interface NotificationsPaginatedResponse {
  notifications: StoredNotification[];
  pagination: {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  filters: NotificationFilters;
  summary: NotificationSummary;
  source: string;
  timestamp: string;
}

export interface CreateNotificationData {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  priority?: 'high' | 'medium' | 'low';
  category?: string;
  metadata?: Record<string, any>;
}

export interface NotificationResponse {
  notification: StoredNotification;
  message: string;
  timestamp: string;
}

export interface ApiError {
  error: string;
  message: string;
  timestamp: string;
}

/**
 * Configuration for the notifications API client
 */
export interface NotificationsApiConfig {
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * Type-safe notifications API client
 */
export class NotificationsApiClient {
  private baseUrl: string;
  private timeout: number;
  private retryAttempts: number;
  private retryDelay: number;

  constructor(config: NotificationsApiConfig = {}) {
    this.baseUrl = config.baseUrl || '/api/v1';
    this.timeout = config.timeout || 10000;
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  /**
   * Make HTTP request with retry logic and error handling
   */
  private async makeRequest<T>(
    url: string,
    options: RequestInit = {},
    attempt: number = 1
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData: ApiError = await response.json().catch(() => ({
          error: 'Network Error',
          message: `HTTP ${response.status}: ${response.statusText}`,
          timestamp: new Date().toISOString(),
        }));

        throw new Error(`API Error: ${errorData.message}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      // Retry on network errors or timeouts
      if (attempt < this.retryAttempts &&
        (error instanceof TypeError || (error as any).name === 'AbortError')) {
        console.warn(`Request failed (attempt ${attempt}), retrying...`, error);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
        return this.makeRequest<T>(url, options, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Build query string from filters
   */
  private buildQueryString(params: Record<string, any>): string {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    return searchParams.toString();
  }

  /**
   * Get notifications for a user with optional filtering
   */
  async getNotifications(
    userId: string,
    filters: NotificationFilters = {}
  ): Promise<NotificationsPaginatedResponse> {
    const queryParams = this.buildQueryString({
      userId,
      unread: filters.unread,
      type: filters.type,
      category: filters.category,
      priority: filters.priority,
      limit: filters.limit || 50,
      offset: filters.offset || 0,
    });

    const url = `${this.baseUrl}/notifications?${queryParams}`;

    return this.makeRequest<NotificationsPaginatedResponse>(url, {
      method: 'GET',
    });
  }

  /**
   * Create a new notification
   */
  async createNotification(
    userId: string,
    data: CreateNotificationData
  ): Promise<NotificationResponse> {
    const url = `${this.baseUrl}/notifications?userId=${encodeURIComponent(userId)}`;

    return this.makeRequest<NotificationResponse>(url, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(userId: string, notificationId: string): Promise<{ success: boolean; message: string }> {
    const url = `${this.baseUrl}/notifications?userId=${encodeURIComponent(userId)}&id=${encodeURIComponent(notificationId)}&action=read`;

    const response = await this.makeRequest<{ message: string; notificationId: string; timestamp: string }>(url, {
      method: 'PATCH',
      body: JSON.stringify({}),
    });

    return {
      success: true,
      message: response.message,
    };
  }

  /**
   * Mark a notification as unread
   */
  async markAsUnread(userId: string, notificationId: string): Promise<{ success: boolean; message: string }> {
    const url = `${this.baseUrl}/notifications?userId=${encodeURIComponent(userId)}&id=${encodeURIComponent(notificationId)}&action=unread`;

    const response = await this.makeRequest<{ message: string; notificationId: string; timestamp: string }>(url, {
      method: 'PATCH',
      body: JSON.stringify({}),
    });

    return {
      success: true,
      message: response.message,
    };
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<{ success: boolean; message: string }> {
    const url = `${this.baseUrl}/notifications?userId=${encodeURIComponent(userId)}&action=mark-all-read`;

    const response = await this.makeRequest<{ message: string; timestamp: string }>(url, {
      method: 'PATCH',
      body: JSON.stringify({}),
    });

    return {
      success: true,
      message: response.message,
    };
  }

  /**
   * Update a notification
   */
  async updateNotification(
    userId: string,
    notificationId: string,
    updates: Partial<CreateNotificationData>
  ): Promise<NotificationResponse> {
    const url = `${this.baseUrl}/notifications?userId=${encodeURIComponent(userId)}&id=${encodeURIComponent(notificationId)}&action=update`;

    return this.makeRequest<NotificationResponse>(url, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete a notification
   */
  async deleteNotification(userId: string, notificationId: string): Promise<{ success: boolean; message: string }> {
    const url = `${this.baseUrl}/notifications?userId=${encodeURIComponent(userId)}&id=${encodeURIComponent(notificationId)}`;

    const response = await this.makeRequest<{ message: string; notificationId: string; timestamp: string }>(url, {
      method: 'DELETE',
    });

    return {
      success: true,
      message: response.message,
    };
  }

  /**
   * Delete all notifications for a user
   */
  async clearAllNotifications(userId: string): Promise<{ success: boolean; message: string }> {
    const url = `${this.baseUrl}/notifications?userId=${encodeURIComponent(userId)}&action=clear-all`;

    const response = await this.makeRequest<{ message: string; timestamp: string }>(url, {
      method: 'DELETE',
    });

    return {
      success: true,
      message: response.message,
    };
  }

  /**
   * Get notification counts and summary
   */
  async getNotificationSummary(userId: string): Promise<NotificationSummary> {
    const response = await this.getNotifications(userId, { limit: 1 });
    return response.summary;
  }

  /**
   * Batch mark notifications as read
   */
  async batchMarkAsRead(userId: string, notificationIds: string[]): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Process in batches to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < notificationIds.length; i += batchSize) {
      const batch = notificationIds.slice(i, i + batchSize);

      const promises = batch.map(async (id) => {
        try {
          await this.markAsRead(userId, id);
          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Failed to mark ${id} as read: ${error instanceof Error ? error.message : String(error)}`);
        }
      });

      await Promise.all(promises);
    }

    return results;
  }

  /**
   * Batch delete notifications
   */
  async batchDelete(userId: string, notificationIds: string[]): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Process in batches to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < notificationIds.length; i += batchSize) {
      const batch = notificationIds.slice(i, i + batchSize);

      const promises = batch.map(async (id) => {
        try {
          await this.deleteNotification(userId, id);
          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Failed to delete ${id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      });

      await Promise.all(promises);
    }

    return results;
  }
}

/**
 * Default notifications API client instance
 */
export const notificationsApi = new NotificationsApiClient();
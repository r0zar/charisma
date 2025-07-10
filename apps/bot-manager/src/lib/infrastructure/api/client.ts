/**
 * API Client Functions for Data Loading
 * Provides typed API client functions for each data segment
 */

import { type AppMetadata } from '@/schemas/app-metadata.schema';
import { type AppState } from '@/schemas/app-state.schema';
// Simple result interface for API calls
interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  validationErrors?: string[];
}

// API client configuration
interface ApiClientConfig {
  baseUrl: string;
  timeout?: number;
  retries?: number;
}

// Default configuration - detect server vs client environment
const getDefaultBaseUrl = () => {
  // Server-side: use environment-aware URL for internal requests
  if (typeof window === 'undefined') {
    // In production, use VERCEL_URL or fallback to localhost for dev
    const host = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL || 'localhost:3420';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    return `${protocol}://${host}/api/v1`;
  }
  // Client-side: use relative URL
  return '/api/v1';
};

const DEFAULT_CONFIG: ApiClientConfig = {
  baseUrl: getDefaultBaseUrl(),
  timeout: 5000,
  retries: 2,
};

// Create API client with configuration
export class ApiClient {
  private config: ApiClientConfig;

  constructor(config: Partial<ApiClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generic fetch with error handling and retries
   */
  private async fetchWithRetries(url: string, options: RequestInit = {}, retries = this.config.retries!): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (retries > 0 && error instanceof Error) {
        // Retry on network errors, but not on aborts
        if (error.name !== 'AbortError') {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
          return this.fetchWithRetries(url, options, retries - 1);
        }
      }
      
      throw error;
    }
  }

  /**
   * Fetch metadata from API
   */
  async fetchMetadata(useDefault = false): Promise<ApiResult<AppMetadata>> {
    try {
      const url = new URL(`${this.config.baseUrl}/metadata`);
      if (useDefault) {
        url.searchParams.set('default', 'true');
      }

      const response = await this.fetchWithRetries(url.toString());
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: `API error: ${response.status} ${response.statusText}`,
          validationErrors: [errorData.message || 'Unknown API error'],
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Fetch user data from API
   */
  async fetchUser(useDefault = false, section?: 'settings' | 'wallet' | 'preferences', userId?: string): Promise<ApiResult<AppState['user']>> {
    try {
      const url = new URL(`${this.config.baseUrl}/user`);
      
      // Use provided userId or default system userId
      const effectiveUserId = userId || process.env.NEXT_PUBLIC_DEFAULT_USER_ID || 'system';
      url.searchParams.set('userId', effectiveUserId);
      
      if (useDefault) {
        url.searchParams.set('default', 'true');
      }
      if (section) {
        url.searchParams.set('section', section);
      }

      const response = await this.fetchWithRetries(url.toString());
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: `API error: ${response.status} ${response.statusText}`,
          validationErrors: [errorData.message || 'Unknown API error'],
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: section ? { [section]: data[section] } as any : data,
      };
    } catch (error) {
      return {
        success: false,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Fetch bots data from API
   */
  async fetchBots(params: {
    useDefault?: boolean;
    section?: 'list' | 'stats' | 'activities';
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<ApiResult<AppState['bots']>> {
    try {
      const url = new URL(`${this.config.baseUrl}/bots`);
      
      if (params.useDefault) {
        url.searchParams.set('default', 'true');
      }
      if (params.section) {
        url.searchParams.set('section', params.section);
      }
      if (params.status) {
        url.searchParams.set('status', params.status);
      }
      if (params.limit) {
        url.searchParams.set('limit', params.limit.toString());
      }
      if (params.offset) {
        url.searchParams.set('offset', params.offset.toString());
      }

      const response = await this.fetchWithRetries(url.toString());
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: `API error: ${response.status} ${response.statusText}`,
          validationErrors: [errorData.message || 'Unknown API error'],
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: params.section ? { [params.section]: data[params.section] } as any : data,
      };
    } catch (error) {
      return {
        success: false,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Market data API method removed

  /**
   * Fetch notifications from API
   */
  async fetchNotifications(params: {
    useDefault?: boolean;
    unread?: boolean;
    type?: 'success' | 'error' | 'warning' | 'info';
    limit?: number;
    offset?: number;
    userId?: string;
  } = {}): Promise<ApiResult<AppState['notifications']>> {
    try {
      const baseUrl = `${this.config.baseUrl}/notifications`;
      const url = new URL(baseUrl);
      
      // Use provided userId or default system userId
      const effectiveUserId = params.userId || process.env.NEXT_PUBLIC_DEFAULT_USER_ID || 'system';
      url.searchParams.set('userId', effectiveUserId);
      
      if (params.useDefault) {
        url.searchParams.set('default', 'true');
      }
      if (params.unread) {
        url.searchParams.set('unread', 'true');
      }
      if (params.type) {
        url.searchParams.set('type', params.type);
      }
      if (params.limit) {
        url.searchParams.set('limit', params.limit.toString());
      }
      if (params.offset) {
        url.searchParams.set('offset', params.offset.toString());
      }

      const response = await this.fetchWithRetries(url.toString());
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: `API error: ${response.status} ${response.statusText}`,
          validationErrors: [errorData.message || 'Unknown API error'],
        };
      }

      const data = await response.json();
      
      // Transform KV notifications to match static schema
      const transformedNotifications = data.notifications.map((notification: any) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        timestamp: notification.timestamp,
        read: notification.read,
        persistent: notification.metadata?.persistent || false,
        actionUrl: notification.metadata?.actionUrl,
      }));
      
      return {
        success: true,
        data: transformedNotifications,
      };
    } catch (error) {
      return {
        success: false,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Test API availability
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.fetchWithRetries(`${this.config.baseUrl}/metadata`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

// Create default API client instance
export const apiClient = new ApiClient();

// Helper function to create API client with custom config
export function createApiClient(config: Partial<ApiClientConfig>): ApiClient {
  return new ApiClient(config);
}

// Export types for external use
export type { ApiClientConfig };
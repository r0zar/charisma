/**
 * Cached Analytics Client
 * Fetches pre-computed analytics data from API endpoints
 * Replaces real-time processing with fast cached data access
 */

import type {
  AnalyticsSummary,
  PerformanceMetrics,
  PortfolioHolding,
  ProcessedTransaction,
  YieldFarmingAnalytics,
  MarketOpportunity,
  AnalyticsConfig,
  CacheStats
} from './analytics-types';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    cached: boolean;
    lastUpdated: number | null;
    source: string;
    timestamp?: number;
  };
}

/**
 * Analytics client that serves cached data from API endpoints
 * No real-time processing - all heavy computation done via cron jobs
 */
export class CachedAnalyticsClient {
  private baseUrl: string;
  private requestCount = 0;

  constructor() {
    this.baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000' 
      : (process.env.NEXT_PUBLIC_APP_URL || '');
  }

  /**
   * Get analytics summary from cache
   */
  async getAnalyticsSummary(walletAddress: string): Promise<ApiResponse<AnalyticsSummary>> {
    this.requestCount++;
    
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/analytics/${walletAddress}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // Always get fresh cache data
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
          metadata: {
            cached: false,
            lastUpdated: null,
            source: 'api-error'
          }
        };
      }

      const result = await response.json() as ApiResponse<AnalyticsSummary>;
      return result;

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          cached: false,
          lastUpdated: null,
          source: 'network-error'
        }
      };
    }
  }

  /**
   * Get performance metrics from cache
   */
  async getPerformanceMetrics(walletAddress: string): Promise<ApiResponse<PerformanceMetrics>> {
    this.requestCount++;
    
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/analytics/${walletAddress}/performance`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
          metadata: {
            cached: false,
            lastUpdated: null,
            source: 'api-error'
          }
        };
      }

      return await response.json() as ApiResponse<PerformanceMetrics>;

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          cached: false,
          lastUpdated: null,
          source: 'network-error'
        }
      };
    }
  }

  /**
   * Get portfolio holdings from cache
   */
  async getPortfolioHoldings(walletAddress: string): Promise<ApiResponse<PortfolioHolding[]>> {
    this.requestCount++;
    
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/analytics/${walletAddress}/holdings`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
          metadata: {
            cached: false,
            lastUpdated: null,
            source: 'api-error'
          }
        };
      }

      return await response.json() as ApiResponse<PortfolioHolding[]>;

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          cached: false,
          lastUpdated: null,
          source: 'network-error'
        }
      };
    }
  }

  /**
   * Request manual refresh (queues for next cron run)
   */
  async requestRefresh(walletAddress: string): Promise<ApiResponse<any>> {
    this.requestCount++;
    
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/analytics/${walletAddress}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
          metadata: {
            cached: false,
            lastUpdated: null,
            source: 'api-error'
          }
        };
      }

      return await response.json();

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          cached: false,
          lastUpdated: null,
          source: 'network-error'
        }
      };
    }
  }

  /**
   * Placeholder methods for compatibility (not implemented for cached client)
   */
  async getProcessedTransactions(walletAddress: string): Promise<ProcessedTransaction[]> {
    // Not implemented - transactions are included in analytics summary
    return [];
  }

  async getYieldFarmingAnalytics(walletAddress: string): Promise<ApiResponse<YieldFarmingAnalytics>> {
    // Not implemented - yield analytics included in summary
    return {
      success: false,
      error: 'Yield farming analytics included in main analytics summary',
      metadata: {
        cached: false,
        lastUpdated: null,
        source: 'not-implemented'
      }
    };
  }

  async getMarketOpportunities(walletAddress: string): Promise<ApiResponse<MarketOpportunity[]>> {
    // Not implemented - market opportunities included in summary
    return {
      success: false,
      error: 'Market opportunities included in main analytics summary',
      metadata: {
        cached: false,
        lastUpdated: null,
        source: 'not-implemented'
      }
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    return {
      hitRate: 100, // All requests are cache hits since we serve from KV
      missRate: 0,
      totalRequests: this.requestCount,
      cacheSize: 0, // Not applicable for API client
      lastClearTime: null,
      averageResponseTime: 50 // Estimated fast cache response time
    };
  }

  /**
   * Clear cache (not applicable for cached client)
   */
  async clearCache(): Promise<void> {
    // Not applicable for API client - cache is managed server-side
  }
}

// Export singleton instance
export const cachedAnalyticsClient = new CachedAnalyticsClient();
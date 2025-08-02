/**
 * Light client for lakehouse API
 * Provides a clean interface for fetching token prices and historical data
 */

import { getHostUrl } from '@modules/discovery';

// API Response Types
interface LakehousePricePoint {
  token_contract_id: string;
  sbtc_price: number;
  usd_price: number;
  price_source: string;
  iterations_to_converge: number;
  final_convergence_percent: number;
  calculated_at: string;
}

interface LakehouseHistoryPoint {
  timestamp: string;
  sbtc_price: number;
  usd_price: number;
  min_usd_price: number;
  max_usd_price: number;
  data_points: number;
}

interface CurrentPricesResponse {
  prices: LakehousePricePoint[];
  summary: {
    total_tokens: number;
    min_price: number;
    max_price: number;
    avg_price: number;
    last_updated: string;
  };
}

interface PriceHistoryResponse {
  price_history: LakehouseHistoryPoint[];
  summary: {
    token_contract_id: string;
    total_days: number;
    data_range: {
      start: string;
      end: string;
    };
    price_statistics: {
      all_time_min: number;
      all_time_max: number;
      average_price: number;
    };
    total_data_points: number;
  };
}

// Client Configuration
interface LakehouseClientConfig {
  timeout?: number;
}

export class LakehouseClient {
  private timeout: number;

  constructor(config: LakehouseClientConfig = {}) {
    this.timeout = config.timeout || 10000;
  }

  private getBaseUrl(): string {
    return getHostUrl('lakehouse');
  }

  /**
   * Fetch current prices for all tokens
   */
  async getCurrentPrices(options: {
    limit?: number;
    minPrice?: number;
    token?: string;
  } = {}): Promise<LakehousePricePoint[]> {
    const params = new URLSearchParams();
    
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.minPrice) params.set('minPrice', options.minPrice.toString());
    if (options.token) params.set('token', options.token);

    const url = `${this.getBaseUrl()}/api/token-prices?${params.toString()}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: CurrentPricesResponse = await response.json();
      return data.prices;
    } catch (error) {
      console.error(`[LakehouseClient] Failed to fetch current prices:`, error);
      throw error;
    }
  }

  /**
   * Fetch historical price data for a specific token
   */
  async getPriceHistory(tokenId: string, options: {
    start?: string; // ISO date string
    end?: string;
    interval?: 'hour' | 'day' | 'week';
    limit?: number;
  } = {}): Promise<LakehouseHistoryPoint[]> {
    const params = new URLSearchParams();
    params.set('token', tokenId);
    
    if (options.start) params.set('start', options.start);
    if (options.end) params.set('end', options.end);
    if (options.interval) params.set('interval', options.interval);
    if (options.limit) params.set('limit', options.limit.toString());

    const url = `${this.getBaseUrl()}/api/token-prices/history?${params.toString()}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: PriceHistoryResponse = await response.json();
      return data.price_history;
    } catch (error) {
      console.error(`[LakehouseClient] Failed to fetch price history for ${tokenId}:`, error);
      throw error;
    }
  }

  /**
   * Get current price for a specific token
   */
  async getTokenPrice(tokenId: string): Promise<LakehousePricePoint | null> {
    try {
      const prices = await this.getCurrentPrices({ token: tokenId, limit: 1 });
      return prices.length > 0 ? prices[0] : null;
    } catch (error) {
      console.error(`[LakehouseClient] Failed to fetch price for ${tokenId}:`, error);
      return null;
    }
  }

  // Removed createFallbackChartData - never provide fake sample data

  /**
   * Get price history - returns empty array if no real data available
   */
  async getPriceHistoryWithFallback(tokenId: string, options: {
    interval?: 'hour' | 'day' | 'week';
    limit?: number;
  } = {}): Promise<LakehouseHistoryPoint[]> {
    try {
      const history = await this.getPriceHistory(tokenId, {
        interval: options.interval || 'hour',
        limit: options.limit || 24
      });
      
      return history;
    } catch (error) {
      console.warn(`[LakehouseClient] Historical data unavailable for ${tokenId}:`, error);
      return [];
    }
  }
}

// Export types for external use
export type { LakehousePricePoint, LakehouseHistoryPoint };

// Singleton instance
export const lakehouseClient = new LakehouseClient();
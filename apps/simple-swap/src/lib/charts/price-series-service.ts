import { type LineData } from 'lightweight-charts';
import { lakehouseClient, type LakehouseHistoryPoint } from '@repo/tokens';

export interface ChartPriceSeriesData {
  [contractId: string]: LineData[];
}

/**
 * Simple, working service for fetching price series data
 * Replaces the overcomplicated stub with real functionality
 */
export class PriceSeriesService {
  private cache = new Map<string, { data: LineData[]; timestamp: number }>();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  private convertToLineData(history: LakehouseHistoryPoint[]): LineData[] {
    return history
      .map(point => ({
        time: Math.floor(new Date(point.timestamp).getTime() / 1000) as any,
        value: point.usd_price
      }))
      .filter(point => point.value > 0 && !isNaN(point.value))
      .sort((a, b) => Number(a.time) - Number(b.time));
  }

  private getCacheKey(contractId: string, timeframe: string): string {
    return `${contractId}-${timeframe}`;
  }

  private isValidCached(timestamp: number): boolean {
    return Date.now() - timestamp < this.cacheTTL;
  }

  /**
   * Fetch price series for a single contract with simple caching
   */
  async fetchSingleSeries(
    contractId: string,
    timeframe: string = '24h'
  ): Promise<LineData[]> {
    const cacheKey = this.getCacheKey(contractId, timeframe);
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && this.isValidCached(cached.timestamp)) {
      console.log(`[PRICE-SERVICE] Cache hit for ${contractId.substring(0, 10)}`);
      return cached.data;
    }

    try {
      console.log(`[PRICE-SERVICE] Fetching ${timeframe} data for ${contractId.substring(0, 10)}`);
      
      // Map timeframe to lakehouse intervals
      const intervalMap: Record<string, 'hour' | 'day' | 'week'> = {
        '1h': 'hour',
        '24h': 'hour',
        '7d': 'day',
        '30d': 'day',
        '1y': 'week'
      };
      
      const interval = intervalMap[timeframe] || 'hour';
      const limit = timeframe === '1h' ? 24 : timeframe === '24h' ? 24 : timeframe === '7d' ? 7 * 24 : 30;
      
      // Use lakehouse client (no fake fallback data)
      const history = await lakehouseClient.getPriceHistoryWithFallback(contractId, {
        interval,
        limit
      });
      
      const lineData = this.convertToLineData(history);
      
      // Cache the result
      this.cache.set(cacheKey, { data: lineData, timestamp: Date.now() });
      
      console.log(`[PRICE-SERVICE] Fetched ${lineData.length} points for ${contractId.substring(0, 10)}`);
      console.log(`[PRICE-SERVICE] Sample data points:`, lineData.slice(0, 3));
      return lineData;

    } catch (error) {
      console.error(`[PRICE-SERVICE] Error fetching ${contractId}:`, error);
      return [];
    }
  }

  /**
   * Fetch price series for multiple contract IDs with simple parallel processing
   */
  async fetchBulkPriceSeries(
    contractIds: string[],
    timeframe: string = '24h'
  ): Promise<ChartPriceSeriesData> {
    if (contractIds.length === 0) return {};

    console.log(`[PRICE-SERVICE] Bulk fetching ${contractIds.length} series`);
    
    const promises = contractIds.map(async contractId => {
      try {
        const data = await this.fetchSingleSeries(contractId, timeframe);
        return { contractId, data };
      } catch (error) {
        console.warn(`[PRICE-SERVICE] Failed to fetch ${contractId}:`, error);
        return { contractId, data: [] };
      }
    });

    const results = await Promise.all(promises);
    const seriesData: ChartPriceSeriesData = {};
    
    results.forEach(({ contractId, data }) => {
      seriesData[contractId] = data;
    });

    console.log(`[PRICE-SERVICE] Bulk fetch completed: ${Object.keys(seriesData).length} series`);
    return seriesData;
  }

  /**
   * Get current price for a token
   */
  async getCurrentPrice(contractId: string): Promise<number | null> {
    try {
      const priceData = await lakehouseClient.getTokenPrice(contractId);
      return priceData?.usd_price || null;
    } catch (error) {
      console.error(`[PRICE-SERVICE] Error fetching current price for ${contractId}:`, error);
      return null;
    }
  }

  /**
   * Get all available tokens with current prices
   */
  async getAllTokens(): Promise<Array<{ tokenId: string; symbol: string; usdPrice: number }>> {
    try {
      const prices = await lakehouseClient.getCurrentPrices({ limit: 100 });
      return prices.map(p => ({
        tokenId: p.token_contract_id,
        symbol: p.token_contract_id.split('.').pop() || p.token_contract_id,
        usdPrice: p.usd_price
      }));
    } catch (error) {
      console.error('[PRICE-SERVICE] Error fetching all tokens:', error);
      return [];
    }
  }
}

// Singleton instance
export const priceSeriesService = new PriceSeriesService();

/**
 * Hook for using price series data
 */
export function usePriceSeriesService() {
  return priceSeriesService;
}
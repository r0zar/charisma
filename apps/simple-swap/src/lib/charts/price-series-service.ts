import { type LineData } from 'lightweight-charts';
import { pricesClient, type PriceCandle, type PriceInterval } from '@repo/tokens';

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

  private convertToLineData(candles: PriceCandle[]): LineData[] {
    return candles
      .map(c => ({
        time: c.time as any,
        value: c.close
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
      
      // Candle size and count for each timeframe: 5-minute points up to a day, then hourly and 4-hourly
      const spans: Record<string, { interval: PriceInterval; limit: number }> = {
        '1h': { interval: '5m', limit: 12 },
        '24h': { interval: '5m', limit: 288 },
        '7d': { interval: '1h', limit: 7 * 24 },
        '30d': { interval: '4h', limit: 30 * 6 },
      };
      const { interval, limit } = spans[timeframe] ?? spans['24h'];
      const days = { '5m': 1, '1h': 7, '4h': 30, '1d': 365, '1w': 365 }[interval];
      const candles = await pricesClient.history(contractId, { interval, limit, from: new Date(Date.now() - days * 86400_000) });
      
      const lineData = this.convertToLineData(candles);
      
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
      return (await pricesClient.get(contractId)).usd;
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
      const { tokens } = await pricesClient.list();
      return tokens.map(t => ({ tokenId: t.contractId, symbol: t.symbol, usdPrice: t.usd }));
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
import { type LineData } from 'lightweight-charts';
import { TimeSeriesAdapter } from './time-series-adapter';

// Local types to replace missing @services/prices
interface PriceHistoryEntry {
  timestamp: number;
  usdPrice?: number;
  price?: number;
}

interface PriceHistoryResponse {
  success: boolean;
  data?: PriceHistoryEntry[];
  error?: string;
}

interface CurrentPriceData {
  usdPrice: number;
}

interface CurrentPriceResponse {
  success: boolean;
  data?: CurrentPriceData;
  error?: string;
}

interface TokenData {
  tokenId: string;
  symbol: string;
  usdPrice: number;
}

interface AllTokensResponse {
  success: boolean;
  data?: TokenData[];
  error?: string;
}

// Simple storage implementation
class PriceSeriesStorage {
  // Stub implementation - could be extended later
}

// API implementation using external price service
class PriceSeriesAPI {
  constructor(private storage: PriceSeriesStorage) {}

  async getPriceHistory(params: {
    tokenId: string;
    timeframe: string;
    limit: number;
    endTime: number;
  }): Promise<PriceHistoryResponse> {
    // Stub implementation - returns empty data for now
    // Could be extended to call external price APIs
    return {
      success: true,
      data: []
    };
  }

  async getCurrentPrice(contractId: string): Promise<CurrentPriceResponse> {
    // Stub implementation - returns mock data
    return {
      success: true,
      data: { usdPrice: 0 }
    };
  }

  async getAllTokens(): Promise<AllTokensResponse> {
    // Stub implementation - returns empty array
    return {
      success: true,
      data: []
    };
  }
}

export interface PriceSeriesData {
  [contractId: string]: LineData[];
}

// Enhanced caching with LRU eviction
class LRUCache<T> {
  private cache = new Map<string, { data: T; timestamp: number; accessCount: number }>();
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize: number = 100, ttl: number = 300000) { // 5 minutes default TTL
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    const now = Date.now();
    if (now - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Update access count and timestamp for LRU
    item.accessCount++;
    item.timestamp = now;
    this.cache.set(key, item);
    return item.data;
  }

  set(key: string, data: T): void {
    const now = Date.now();
    
    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const lruKey = this.findLRUKey();
      if (lruKey) this.cache.delete(lruKey);
    }

    this.cache.set(key, { data, timestamp: now, accessCount: 1 });
  }

  private findLRUKey(): string | null {
    let lruKey: string | null = null;
    let lruTime = Infinity;
    let lruCount = Infinity;

    for (const [key, item] of this.cache.entries()) {
      if (item.accessCount < lruCount || (item.accessCount === lruCount && item.timestamp < lruTime)) {
        lruKey = key;
        lruTime = item.timestamp;
        lruCount = item.accessCount;
      }
    }

    return lruKey;
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * Enhanced service for efficiently fetching price series data with advanced caching
 * and performance optimizations
 */
export class PriceSeriesService {
  private priceSeriesAPI: PriceSeriesAPI;
  private cache = new LRUCache<LineData[]>(150, 300000); // Cache 150 series for 5 minutes
  private inflightRequests = new Map<string, Promise<LineData[]>>();

  constructor() {
    // Initialize with PriceSeriesStorage
    const storage = new PriceSeriesStorage();
    this.priceSeriesAPI = new PriceSeriesAPI(storage);
  }

  /**
   * Fetch price series for a single contract with caching and deduplication
   */
  private async fetchSingleSeries(
    contractId: string,
    timeframe: string = '5m',
    limit: number = 1000
  ): Promise<LineData[]> {
    const cacheKey = `${contractId}-${timeframe}-${limit}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`[PRICE-SERVICE] Cache hit for ${contractId.substring(0, 10)}`);
      return cached;
    }

    // Check if request is already in flight
    if (this.inflightRequests.has(cacheKey)) {
      console.log(`[PRICE-SERVICE] Joining inflight request for ${contractId.substring(0, 10)}`);
      return this.inflightRequests.get(cacheKey)!;
    }

    // Create new request
    const requestPromise = this.doFetchSingleSeries(contractId, timeframe, limit);
    this.inflightRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      this.cache.set(cacheKey, result);
      return result;
    } finally {
      this.inflightRequests.delete(cacheKey);
    }
  }

  /**
   * Actual data fetching implementation
   */
  private async doFetchSingleSeries(
    contractId: string,
    timeframe: string,
    limit: number
  ): Promise<LineData[]> {
    try {
      const response = await this.priceSeriesAPI.getPriceHistory({
        tokenId: contractId,
        timeframe,
        limit,
        endTime: Date.now()
      });

      if (!response.success || !response.data) {
        console.warn(`[PRICE-SERVICE] Failed to fetch data for ${contractId}:`, response.error);
        return [];
      }

      // Convert to LineData format with proper sorting and deduplication
      const lineData: LineData[] = response.data
        .map((entry: any) => ({
          time: Math.floor(entry.timestamp / 1000) as any,
          value: entry.usdPrice || entry.price || 0
        }))
        .filter((point: LineData) => point.value > 0 && !isNaN(point.value))
        .sort((a, b) => Number(a.time) - Number(b.time));

      // Remove duplicates
      const deduplicated: LineData[] = [];
      let lastTime = -1;
      
      for (const point of lineData) {
        if (Number(point.time) !== lastTime) {
          deduplicated.push(point);
          lastTime = Number(point.time);
        }
      }

      console.log(`[PRICE-SERVICE] Fetched ${deduplicated.length} points for ${contractId.substring(0, 10)}`);
      return deduplicated;

    } catch (error) {
      console.error(`[PRICE-SERVICE] Error fetching ${contractId}:`, error);
      return [];
    }
  }

  /**
   * Fetch price series for multiple contract IDs with enhanced performance
   */
  async fetchBulkPriceSeries(
    contractIds: string[],
    from?: number,
    to?: number
  ): Promise<PriceSeriesData> {
    if (contractIds.length === 0) return {};

    console.log(`[PRICE-SERVICE] Bulk fetching ${contractIds.length} series`);
    
    const result: PriceSeriesData = {};
    
    // Process requests with controlled concurrency
    const maxConcurrency = 5;
    const chunks = [];
    
    for (let i = 0; i < contractIds.length; i += maxConcurrency) {
      chunks.push(contractIds.slice(i, i + maxConcurrency));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(contractId => 
        this.fetchSingleSeries(contractId)
          .then(data => ({ contractId, data }))
          .catch(error => {
            console.warn(`[PRICE-SERVICE] Failed to fetch ${contractId}:`, error);
            return { contractId, data: [] };
          })
      );

      const chunkResults = await Promise.all(promises);
      
      for (const { contractId, data } of chunkResults) {
        // Apply time filtering if specified
        if (from || to) {
          const filtered = data.filter(point => {
            const time = Number(point.time);
            return (!from || time >= from) && (!to || time <= to);
          });
          result[contractId] = filtered;
        } else {
          result[contractId] = data;
        }
      }
    }

    console.log(`[PRICE-SERVICE] Bulk fetch completed:`, {
      requested: contractIds.length,
      received: Object.keys(result).length,
      totalPoints: Object.values(result).reduce((sum, data) => sum + data.length, 0)
    });

    return result;
  }

  /**
   * Get current price for a token
   */
  async getCurrentPrice(contractId: string): Promise<number | null> {
    try {
      const response = await this.priceSeriesAPI.getCurrentPrice(contractId);
      if (response.success && response.data) {
        return response.data.usdPrice;
      }
    } catch (error) {
      console.error(`[PRICE-SERVICE] Error fetching current price for ${contractId}:`, error);
    }
    return null;
  }

  /**
   * Get all available tokens
   */
  async getAllTokens(): Promise<Array<{ tokenId: string; symbol: string; usdPrice: number }>> {
    try {
      const response = await this.priceSeriesAPI.getAllTokens();
      if (response.success && response.data) {
        return response.data;
      }
    } catch (error) {
      console.error('[PRICE-SERVICE] Error fetching all tokens:', error);
    }
    return [];
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
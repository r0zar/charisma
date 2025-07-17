import { type LineData } from 'lightweight-charts';

export interface PriceSeriesData {
  [contractId: string]: LineData[];
}

/**
 * Service for efficiently fetching price series data for multiple tokens
 */
interface CacheEntry {
  data: LineData[];
  timestamp: number;
  lastUpdate: number;
}

export class PriceSeriesService {
  private cache = new Map<string, CacheEntry>();
  private pendingRequests = new Map<string, Promise<PriceSeriesData>>();
  private requestCoalescing = new Map<string, Promise<LineData[]>>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL
  private readonly UPDATE_THRESHOLD = 60 * 1000; // 1 minute minimum between updates

  /**
   * Fetch price series for multiple contract IDs using the bulk endpoint
   */
  async fetchBulkPriceSeries(
    contractIds: string[],
    from?: number,
    to?: number
  ): Promise<PriceSeriesData> {
    if (contractIds.length === 0) return {};

    // Create cache key for this request
    const cacheKey = `${contractIds.sort().join(',')}:${from || 'all'}:${to || 'all'}`;

    // Check if we already have a pending request for this combination
    if (this.pendingRequests.has(cacheKey)) {
      console.log('[PRICE-SERVICE] Reusing pending request for', contractIds.length, 'tokens');
      return this.pendingRequests.get(cacheKey)!;
    }

    // Check cache hits with TTL validation
    const now = Date.now();
    const cacheHits = contractIds.filter(id => {
      const entry = this.cache.get(id);
      return entry && (now - entry.timestamp) < this.CACHE_TTL;
    });

    if (cacheHits.length > 0) {
      console.log('[PRICE-SERVICE] Cache hits:', cacheHits.length, '/', contractIds.length);

      // If all tokens are cached and fresh, return from cache
      if (cacheHits.length === contractIds.length) {
        const result: PriceSeriesData = {};
        contractIds.forEach(id => {
          const entry = this.cache.get(id);
          if (entry) {
            result[id] = entry.data;
          }
        });
        return result;
      }
    }

    // Create the request
    const requestPromise = this.executeBulkRequest(contractIds, from, to);
    this.pendingRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;

      console.log('[BULK-PRICE-SERVICE] Returning processed data to chart:', {
        requestedTokens: contractIds.length,
        resultKeys: Object.keys(result),
        resultSummary: Object.entries(result).reduce((acc, [contractId, data]) => {
          acc[contractId.substring(0, 12) + '...'] = {
            isArray: Array.isArray(data),
            length: Array.isArray(data) ? data.length : 'N/A',
            samplePoint: Array.isArray(data) && data.length > 0 ? data[0] : null,
            timeRange: Array.isArray(data) && data.length > 1 ? {
              first: data[0]?.time,
              last: data[data.length - 1]?.time
            } : null
          };
          return acc;
        }, {} as any)
      });

      // Cache individual results with timestamp
      const now = Date.now();
      let cachedTokens = 0;
      Object.entries(result).forEach(([contractId, data]) => {
        if (Array.isArray(data)) {
          this.cache.set(contractId, {
            data,
            timestamp: now,
            lastUpdate: now
          });
          cachedTokens++;
        }
      });

      console.log('[BULK-PRICE-SERVICE] Caching complete:', {
        cachedTokens,
        totalRequested: contractIds.length
      });

      return result;
    } finally {
      // Clean up pending request
      this.pendingRequests.delete(cacheKey);
    }
  }

  /**
   * Get cached price series for a contract ID with TTL validation
   */
  getCachedPriceSeries(contractId: string): LineData[] | null {
    const entry = this.cache.get(contractId);
    if (!entry) return null;

    const now = Date.now();
    if ((now - entry.timestamp) > this.CACHE_TTL) {
      // Cache expired, remove it
      this.cache.delete(contractId);
      return null;
    }

    return entry.data;
  }

  /**
   * Fetch price series for a single contract ID with caching
   */
  async fetchPriceSeries(contractId: string, from?: number, to?: number): Promise<LineData[]> {
    // Check cache first (only if no specific time range requested)
    if (!from && !to) {
      const cached = this.getCachedPriceSeries(contractId);
      if (cached) {
        return cached;
      }
    }

    // Use bulk endpoint even for single token
    const result = await this.fetchBulkPriceSeries([contractId], from, to);
    return result[contractId] || [];
  }

  /**
   * Execute the actual bulk request to the API
   */
  private async executeBulkRequest(
    contractIds: string[],
    from?: number,
    to?: number
  ): Promise<PriceSeriesData> {
    // Default to last 30 days if no time range specified
    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60); // 30 days ago in seconds

    const params = new URLSearchParams({
      contractIds: contractIds.join(','),
      from: (from || thirtyDaysAgo).toString(),
      to: (to || now).toString(),
    });

    console.log('[BULK-PRICE-API] Requesting bulk price series:', {
      tokens: contractIds.length,
      contractIds: contractIds.map(id => id.substring(0, 12) + '...'),
      timeRange: {
        from: from || thirtyDaysAgo,
        to: to || now,
        daysAgo: Math.round((now - (from || thirtyDaysAgo)) / (24 * 60 * 60))
      },
      url: `/api/price-series/bulk?${params.toString()}`
    });

    const response = await fetch(`/api/price-series/bulk?${params.toString()}`);

    if (!response.ok) {
      console.error('[BULK-PRICE-API] Request failed:', {
        status: response.status,
        statusText: response.statusText,
        url: response.url
      });
      throw new Error(`Failed to fetch bulk price series: ${response.status}`);
    }

    const data = await response.json();

    console.log('[BULK-PRICE-API] Raw response received:', {
      responseKeys: Object.keys(data),
      responseStructure: Object.entries(data).reduce((acc, [contractId, seriesData]) => {
        acc[contractId.substring(0, 12) + '...'] = {
          isArray: Array.isArray(seriesData),
          length: Array.isArray(seriesData) ? seriesData.length : 'N/A',
          samplePoint: Array.isArray(seriesData) && seriesData.length > 0 ? seriesData[0] : null
        };
        return acc;
      }, {} as any)
    });

    // Convert the response to the expected format
    const result: PriceSeriesData = {};
    let totalPointsProcessed = 0;
    let conversionIssues = 0;

    Object.entries(data).forEach(([contractId, seriesData]) => {
      if (Array.isArray(seriesData)) {
        // Convert to LineData format if needed
        const convertedData = seriesData.map((point: any, index: number) => {
          const time = point.time || point.start;
          const value = point.value || point.average;

          // Validate conversion
          if (!time || !value || isNaN(Number(time)) || isNaN(Number(value))) {
            if (index < 3) { // Only log first few issues to avoid spam
              console.warn('[BULK-PRICE-API] Data conversion issue:', {
                contractId: contractId.substring(0, 12) + '...',
                pointIndex: index,
                originalPoint: point,
                convertedTime: time,
                convertedValue: value
              });
            }
            conversionIssues++;
          }

          return {
            time: time,
            value: value,
          };
        });

        result[contractId] = convertedData;
        totalPointsProcessed += convertedData.length;

        console.log('[BULK-PRICE-API] Converted data for token:', {
          contractId: contractId.substring(0, 12) + '...',
          originalPoints: seriesData.length,
          convertedPoints: convertedData.length,
          sampleOriginal: seriesData[0],
          sampleConverted: convertedData[0],
          timeRange: convertedData.length > 1 ? {
            first: convertedData[0]?.time,
            last: convertedData[convertedData.length - 1]?.time
          } : null
        });
      } else {
        console.warn('[BULK-PRICE-API] Non-array data received for token:', {
          contractId: contractId.substring(0, 12) + '...',
          dataType: typeof seriesData,
          data: seriesData
        });
      }
    });

    console.log('[BULK-PRICE-API] Bulk conversion complete:', {
      tokensRequested: contractIds.length,
      tokensReceived: Object.keys(result).length,
      totalPointsProcessed,
      conversionIssues,
      avgPointsPerToken: totalPointsProcessed / Math.max(Object.keys(result).length, 1)
    });

    return result;
  }

  /**
   * Set cached price series data (used for pre-loading)
   */
  setCachedPriceSeries(contractId: string, data: LineData[]): void {
    const now = Date.now();
    this.cache.set(contractId, {
      data,
      timestamp: now,
      lastUpdate: now
    });
  }

  /**
   * Bulk set cached price series data
   */
  bulkSetCachedPriceSeries(data: PriceSeriesData): void {
    let cachedTokens = 0;
    let totalPoints = 0;
    const now = Date.now();

    Object.entries(data).forEach(([contractId, seriesData]) => {
      if (Array.isArray(seriesData)) {
        this.cache.set(contractId, {
          data: seriesData,
          timestamp: now,
          lastUpdate: now
        });
        cachedTokens++;
        totalPoints += seriesData.length;
      }
    });
  }

  /**
   * Add incremental data point to cached series (for real-time updates)
   */
  addIncrementalDataPoint(contractId: string, dataPoint: LineData): boolean {
    const entry = this.cache.get(contractId);
    if (!entry) return false;

    const now = Date.now();

    // Check if enough time has passed since last update to avoid spam
    if ((now - entry.lastUpdate) < this.UPDATE_THRESHOLD) {
      return false;
    }

    // Check if data point is newer than the last one
    const lastPoint = entry.data[entry.data.length - 1];
    if (lastPoint && Number(dataPoint.time) <= Number(lastPoint.time)) {
      return false;
    }

    // Add the new data point
    entry.data.push(dataPoint);
    entry.lastUpdate = now;

    return true;
  }

  /**
   * Update last data point in cached series (for real-time price updates)
   */
  updateLastDataPoint(contractId: string, dataPoint: LineData): boolean {
    const entry = this.cache.get(contractId);
    if (!entry || entry.data.length === 0) return false;

    const now = Date.now();

    // Update the last data point
    entry.data[entry.data.length - 1] = dataPoint;
    entry.lastUpdate = now;

    return true;
  }

  /**
   * Clear cache for specific contract IDs or all
   */
  clearCache(contractIds?: string[]): void {
    if (contractIds) {
      contractIds.forEach(id => this.cache.delete(id));
    } else {
      this.cache.clear();
    }
  }

  /**
   * Pre-fetch price series for common tokens to warm the cache
   */
  async warmCache(contractIds: string[]): Promise<void> {
    try {
      await this.fetchBulkPriceSeries(contractIds);
    } catch (error) {
      console.warn('Failed to warm price series cache:', error);
    }
  }
}

// Singleton instance
export const priceSeriesService = new PriceSeriesService();

/**
 * Hook for using price series data with caching
 */
export function usePriceSeriesService() {
  return priceSeriesService;
}
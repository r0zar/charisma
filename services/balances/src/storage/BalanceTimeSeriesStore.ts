/**
 * Vercel Blob storage implementation for balance time series data
 */

import { BlobMonitor } from '@modules/blob-monitor';
import type { 
  TimeSeriesStore,
  BalancePoint,
  MonthlyTimeSeriesData,
  DailySnapshotData,
  HistoryQueryOptions,
  CachedBlob
} from '../types';
import type { BalanceSnapshot } from '../types/snapshot-types';
import { StorageError } from '../types';
import { 
  getMonthKey, 
  getMonthRange, 
  downsample,
  createDailySnapshot,
  validateTimeSeries
} from '../utils/time-series';

export class BalanceTimeSeriesStore implements TimeSeriesStore {
  private monthlyCache = new Map<string, CachedBlob<MonthlyTimeSeriesData>>();
  private snapshotCache = new Map<string, CachedBlob<DailySnapshotData>>();
  private blobMonitor: BlobMonitor;
  
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour
  private readonly MAX_POINTS_PER_MONTH = 1000;
  private readonly CACHE_CONTROL_MAX_AGE = 3600; // 1 hour

  constructor() {
    this.blobMonitor = new BlobMonitor({
      serviceName: 'balances-timeseries',
      enforcementLevel: 'warn', // Default to warning mode
      enableCostTracking: true,
      enableCapacityTracking: true
    });
  }

  /**
   * Append a new balance point to time series
   */
  async appendBalancePoint(
    address: string, 
    contractId: string, 
    point: BalancePoint
  ): Promise<void> {
    try {
      const monthKey = getMonthKey(point.timestamp);
      
      // Load current month's data
      const monthlyData = await this.getMonthlyData(address, monthKey);
      
      if (!monthlyData.data[contractId]) {
        monthlyData.data[contractId] = {
          contractId,
          points: [],
          metadata: {
            firstSeen: point.timestamp,
            lastUpdated: point.timestamp
          }
        };
      }
      
      // Append point and maintain max size
      const series = monthlyData.data[contractId];
      series.points.push(point);
      series.metadata.lastUpdated = point.timestamp;
      
      // Keep only the most recent points if we exceed the limit
      if (series.points.length > this.MAX_POINTS_PER_MONTH) {
        series.points = series.points.slice(-this.MAX_POINTS_PER_MONTH);
      }
      
      // Validate and sort points
      series.points.sort((a, b) => a.timestamp - b.timestamp);
      const validation = validateTimeSeries(series.points);
      if (!validation.isValid) {
        console.warn(`Time series validation failed for ${address}/${contractId}:`, validation.errors);
      }
      
      // Write back to blob storage
      await this.writeMonthlyData(address, monthKey, monthlyData);
      
    } catch (error) {
      throw new StorageError(`Failed to append balance point: ${error}`);
    }
  }

  /**
   * Get balance history for charting and analysis
   */
  async getBalanceHistory(
    address: string,
    contractId: string,
    options: HistoryQueryOptions
  ): Promise<BalancePoint[]> {
    try {
      const { from, to, granularity = 'day', limit = 100 } = options;
      
      // Determine which months to fetch
      const months = getMonthRange(from, to);
      const allPoints: BalancePoint[] = [];
      
      // Fetch relevant months in parallel
      const monthlyDataPromises = months.map(month =>
        this.getMonthlyData(address, month)
      );
      
      const monthlyResults = await Promise.all(monthlyDataPromises);
      
      // Collect all points for the contract
      for (const monthData of monthlyResults) {
        const series = monthData.data[contractId];
        if (series) {
          allPoints.push(...series.points);
        }
      }
      
      // Filter by time range
      const filtered = allPoints
        .filter(p => (!from || p.timestamp >= from) && (!to || p.timestamp <= to))
        .sort((a, b) => a.timestamp - b.timestamp);
      
      // Downsample if needed
      return downsample(filtered, granularity, limit);
      
    } catch (error) {
      console.warn(`Failed to get balance history for ${address}/${contractId}:`, error);
      return [];
    }
  }

  /**
   * Get daily snapshots for portfolio tracking
   */
  async getDailySnapshots(
    address: string,
    from: number,
    to: number
  ): Promise<BalanceSnapshot[]> {
    try {
      const fromYear = new Date(from).getFullYear();
      const toYear = new Date(to).getFullYear();
      const snapshots: BalanceSnapshot[] = [];
      
      // Fetch all relevant years
      for (let year = fromYear; year <= toYear; year++) {
        const yearlyData = await this.getYearlySnapshots(address, year);
        
        for (const [dateKey, balances] of Object.entries(yearlyData.dailySnapshots)) {
          const timestamp = new Date(dateKey).getTime();
          
          if (timestamp >= from && timestamp <= to) {
            snapshots.push({
              timestamp,
              totalAddresses: 1,
              totalContracts: Object.keys(balances).length,
              balances: {
                [address]: Object.entries(balances).reduce((acc, [contractId, balance]) => {
                  acc[contractId] = {
                    balance,
                    lastUpdated: timestamp
                  };
                  return acc;
                }, {} as Record<string, any>)
              },
              metadata: {
                createdAt: timestamp,
                processingTime: 0,
                compressionRatio: 0,
                originalSize: 0,
                compressedSize: 0,
                version: '1.0.0'
              }
            });
          }
        }
      }
      
      return snapshots.sort((a, b) => a.timestamp - b.timestamp);
      
    } catch (error) {
      console.warn(`Failed to get daily snapshots for ${address}:`, error);
      return [];
    }
  }

  /**
   * Create a snapshot of all balances at a specific time
   */
  async createSnapshot(address: string, timestamp: number): Promise<void> {
    try {
      const date = new Date(timestamp);
      const year = date.getFullYear();
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Get all time series data up to this point
      const months = getMonthRange(0, timestamp);
      const allTokenBalances: Record<string, string> = {};
      
      // Process each month
      for (const month of months) {
        const monthlyData = await this.getMonthlyData(address, month);
        
        for (const [contractId, series] of Object.entries(monthlyData.data)) {
          const snapshotPoint = createDailySnapshot((series as any).points, timestamp);
          if (snapshotPoint) {
            allTokenBalances[contractId] = snapshotPoint.balance;
          }
        }
      }
      
      // Load yearly snapshot data
      const yearlyData = await this.getYearlySnapshots(address, year);
      
      // Add this snapshot
      yearlyData.dailySnapshots[dateKey] = allTokenBalances;
      
      // Write back to storage
      await this.writeYearlySnapshots(address, year, yearlyData);
      
    } catch (error) {
      throw new StorageError(`Failed to create snapshot: ${error}`);
    }
  }

  // === Private Helper Methods ===

  /**
   * Get monthly time series data with caching
   */
  private async getMonthlyData(address: string, monthKey: string): Promise<MonthlyTimeSeriesData> {
    const cacheKey = `${address}-${monthKey}`;
    
    // Check cache first
    const cached = this.monthlyCache.get(cacheKey);
    if (cached && !this.isExpired(cached)) {
      return cached.data;
    }

    try {
      const blobUrl = `https://blob.vercel-storage.com/balances/series/${address}/${monthKey}.json`;
      const response = await this.blobMonitor.fetch(blobUrl);
      
      if (!response.ok) {
        return this.createEmptyMonthlyData(address, monthKey);
      }

      const data = await response.json() as MonthlyTimeSeriesData;
      
      // Cache the result
      this.monthlyCache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        expires: Date.now() + this.CACHE_TTL
      });
      
      return data;
    } catch (error) {
      console.warn(`Failed to load monthly data for ${address}/${monthKey}:`, error);
      return this.createEmptyMonthlyData(address, monthKey);
    }
  }

  /**
   * Write monthly data to blob storage
   */
  private async writeMonthlyData(
    address: string, 
    monthKey: string, 
    data: MonthlyTimeSeriesData
  ): Promise<void> {
    const blobUrl = `balances/series/${address}/${monthKey}.json`;
    
    await this.blobMonitor.put(blobUrl, JSON.stringify(data), {
      access: 'public',
      cacheControlMaxAge: this.CACHE_CONTROL_MAX_AGE
    });

    // Update cache
    const cacheKey = `${address}-${monthKey}`;
    this.monthlyCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      expires: Date.now() + this.CACHE_TTL
    });
  }

  /**
   * Get yearly snapshot data with caching
   */
  private async getYearlySnapshots(address: string, year: number): Promise<DailySnapshotData> {
    const cacheKey = `${address}-${year}`;
    
    // Check cache first
    const cached = this.snapshotCache.get(cacheKey);
    if (cached && !this.isExpired(cached)) {
      return cached.data;
    }

    try {
      const blobUrl = `https://blob.vercel-storage.com/balances/snapshots/${address}/daily-${year}.json`;
      const response = await this.blobMonitor.fetch(blobUrl);
      
      if (!response.ok) {
        return this.createEmptyYearlyData(address, year);
      }

      const data = await response.json() as DailySnapshotData;
      
      // Cache the result
      this.snapshotCache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        expires: Date.now() + this.CACHE_TTL
      });
      
      return data;
    } catch (error) {
      console.warn(`Failed to load yearly snapshots for ${address}/${year}:`, error);
      return this.createEmptyYearlyData(address, year);
    }
  }

  /**
   * Write yearly snapshot data to blob storage
   */
  private async writeYearlySnapshots(
    address: string, 
    year: number, 
    data: DailySnapshotData
  ): Promise<void> {
    const blobUrl = `balances/snapshots/${address}/daily-${year}.json`;
    
    await this.blobMonitor.put(blobUrl, JSON.stringify(data), {
      access: 'public',
      cacheControlMaxAge: this.CACHE_CONTROL_MAX_AGE
    });

    // Update cache
    const cacheKey = `${address}-${year}`;
    this.snapshotCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      expires: Date.now() + this.CACHE_TTL
    });
  }

  /**
   * Create empty monthly data structure
   */
  private createEmptyMonthlyData(address: string, monthKey: string): MonthlyTimeSeriesData {
    return {
      address,
      period: monthKey,
      data: {}
    };
  }

  /**
   * Create empty yearly data structure
   */
  private createEmptyYearlyData(address: string, year: number): DailySnapshotData {
    return {
      address,
      year,
      dailySnapshots: {}
    };
  }

  /**
   * Check if cached data is expired
   */
  private isExpired(cached: CachedBlob): boolean {
    return Date.now() > cached.expires;
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.monthlyCache.clear();
    this.snapshotCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { monthlySize: number; snapshotSize: number } {
    return {
      monthlySize: this.monthlyCache.size,
      snapshotSize: this.snapshotCache.size
    };
  }

  /**
   * Get blob monitoring statistics
   */
  getBlobMonitorStats() {
    return this.blobMonitor.getStats();
  }

  /**
   * Get recent blob operations
   */
  getRecentBlobOperations(limit: number = 10) {
    return this.blobMonitor.getRecentOperations(limit);
  }

  /**
   * Get active blob alerts
   */
  getBlobAlerts() {
    return this.blobMonitor.getAlerts();
  }
}
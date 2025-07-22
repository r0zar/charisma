/**
 * Historical Price Service - Collects and stores price history
 */

import { blobStorageService } from '../../storage/blob-storage-service';
import { oraclePriceService } from './oracle-price-service';
import type { PriceServiceResult, HistoricalPriceData, CollectionResult, HistoricalStats } from '../types';


/**
 * Service for collecting and managing historical price data
 */
class HistoricalPriceService {
  private readonly HISTORICAL_BLOB_PREFIX = 'prices/historical';
  private readonly MAX_5MIN_POINTS = 288; // 24 hours of 5min data
  private readonly MAX_1HOUR_POINTS = 168; // 7 days of 1hour data  
  private readonly MAX_1DAY_POINTS = 365; // 1 year of 1day data

  /**
   * Collect current prices and add them to historical data
   * This should be called by the cron job every 5 minutes
   */
  async collectCurrentPrices(): Promise<{ success: boolean; collected: number; errors: string[] }> {
    const startTime = Date.now();
    const errors: string[] = [];
    let collected = 0;

    try {
      console.log('[HistoricalPriceService] Starting price collection...');

      // Get all current prices from oracle service
      const currentPrices = await oraclePriceService.getAllPrices();

      if (Object.keys(currentPrices).length === 0) {
        const error = 'No current prices available from oracle service';
        console.warn(`[HistoricalPriceService] ${error}`);
        errors.push(error);
        return { success: false, collected: 0, errors };
      }

      console.log(`[HistoricalPriceService] Collected ${Object.keys(currentPrices).length} current prices`);

      // Process each token's price data
      for (const [tokenId, priceData] of Object.entries(currentPrices)) {
        try {
          await this.addPricePoint(tokenId, priceData);
          collected++;
        } catch (error) {
          const errorMsg = `Failed to store price for ${tokenId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`[HistoricalPriceService] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      const processingTime = Date.now() - startTime;
      console.log(`[HistoricalPriceService] Collection completed: ${collected} prices in ${processingTime}ms`);

      return {
        success: true,
        collected,
        errors
      };

    } catch (error) {
      const errorMsg = `Price collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`[HistoricalPriceService] ${errorMsg}`);
      errors.push(errorMsg);

      return {
        success: false,
        collected,
        errors
      };
    }
  }

  /**
   * Add a price point to historical data for a specific token
   */
  private async addPricePoint(tokenId: string, priceData: PriceServiceResult): Promise<void> {
    const pricePoint: HistoricalPricePoint = {
      timestamp: Date.now(),
      usdPrice: priceData.usdPrice,
      change24h: priceData.change24h,
      volume24h: priceData.volume24h,
      marketCap: priceData.marketCap,
      source: priceData.source,
      confidence: priceData.confidence
    };

    // Store in 5-minute timeframe
    await this.addPriceToTimeframe(tokenId, '5m', pricePoint);

    // Aggregate to hourly if it's the right time (every 12th 5-min interval)
    const minutesInHour = Math.floor(Date.now() / (1000 * 60)) % 60;
    if (minutesInHour % 60 === 0) {
      await this.aggregateToHourly(tokenId);
    }

    // Aggregate to daily if it's the right time (every 24th hour)
    const hoursInDay = Math.floor(Date.now() / (1000 * 60 * 60)) % 24;
    if (hoursInDay === 0 && minutesInHour % 60 === 0) {
      await this.aggregateToDaily(tokenId);
    }
  }

  /**
   * Add price point to specific timeframe
   */
  private async addPriceToTimeframe(tokenId: string, timeframe: string, pricePoint: HistoricalPricePoint): Promise<void> {
    const blobKey = `${this.HISTORICAL_BLOB_PREFIX}/${timeframe}/${tokenId}`;

    try {
      // Get existing historical data
      let historicalData: HistoricalPriceData;

      try {
        const existing = await blobStorageService.get(blobKey);
        historicalData = existing as HistoricalPriceData;

        // Validate structure
        if (!historicalData.prices || !Array.isArray(historicalData.prices)) {
          throw new Error('Invalid historical data structure');
        }
      } catch (error) {
        // Create new historical data structure
        historicalData = {
          tokenId,
          prices: [],
          lastUpdated: Date.now(),
          dataPoints: 0,
          timeframe
        };
      }

      // Add new price point
      historicalData.prices.push(pricePoint);
      historicalData.lastUpdated = Date.now();
      historicalData.dataPoints = historicalData.prices.length;

      // Trim old data based on timeframe
      const maxPoints = this.getMaxPointsForTimeframe(timeframe);
      if (historicalData.prices.length > maxPoints) {
        historicalData.prices = historicalData.prices.slice(-maxPoints);
        historicalData.dataPoints = historicalData.prices.length;
      }

      // Save back to blob storage
      await blobStorageService.put(blobKey, historicalData);

      console.log(`[HistoricalPriceService] Added price point for ${tokenId} (${timeframe}) - ${historicalData.dataPoints} total points`);

    } catch (error) {
      console.error(`[HistoricalPriceService] Error adding price point for ${tokenId}:`, error);
      throw error;
    }
  }

  /**
   * Aggregate 5-minute data to hourly
   */
  private async aggregateToHourly(tokenId: string): Promise<void> {
    try {
      const fiveMinData = await this.getHistoricalData(tokenId, '5m');
      if (!fiveMinData || fiveMinData.prices.length < 12) {
        return; // Need at least 12 5-min points for 1 hour
      }

      // Get last 12 points (1 hour)
      const lastHourPoints = fiveMinData.prices.slice(-12);

      // Create hourly aggregate
      const hourlyPoint: HistoricalPricePoint = {
        timestamp: Math.floor(Date.now() / (1000 * 60 * 60)) * (1000 * 60 * 60), // Round to hour
        usdPrice: lastHourPoints[lastHourPoints.length - 1].usdPrice, // Close price
        volume24h: this.calculateAverage(lastHourPoints, 'volume24h'),
        marketCap: this.calculateAverage(lastHourPoints, 'marketCap'),
        source: 'aggregated-5m',
        confidence: this.calculateAverage(lastHourPoints, 'confidence')
      };

      await this.addPriceToTimeframe(tokenId, '1h', hourlyPoint);
      console.log(`[HistoricalPriceService] Aggregated hourly data for ${tokenId}`);

    } catch (error) {
      console.error(`[HistoricalPriceService] Error aggregating hourly data for ${tokenId}:`, error);
    }
  }

  /**
   * Aggregate hourly data to daily
   */
  private async aggregateToDaily(tokenId: string): Promise<void> {
    try {
      const hourlyData = await this.getHistoricalData(tokenId, '1h');
      if (!hourlyData || hourlyData.prices.length < 24) {
        return; // Need at least 24 hourly points for 1 day
      }

      // Get last 24 points (1 day)
      const lastDayPoints = hourlyData.prices.slice(-24);

      // Create daily aggregate
      const dailyPoint: HistoricalPricePoint = {
        timestamp: Math.floor(Date.now() / (1000 * 60 * 60 * 24)) * (1000 * 60 * 60 * 24), // Round to day
        usdPrice: lastDayPoints[lastDayPoints.length - 1].usdPrice, // Close price
        volume24h: this.calculateSum(lastDayPoints, 'volume24h'),
        marketCap: this.calculateAverage(lastDayPoints, 'marketCap'),
        source: 'aggregated-1h',
        confidence: this.calculateAverage(lastDayPoints, 'confidence')
      };

      await this.addPriceToTimeframe(tokenId, '1d', dailyPoint);
      console.log(`[HistoricalPriceService] Aggregated daily data for ${tokenId}`);

    } catch (error) {
      console.error(`[HistoricalPriceService] Error aggregating daily data for ${tokenId}:`, error);
    }
  }

  /**
   * Get historical data for a token and timeframe
   */
  async getHistoricalData(tokenId: string, timeframe: string, limit?: number): Promise<HistoricalPriceData | null> {
    try {
      const blobKey = `${this.HISTORICAL_BLOB_PREFIX}/${timeframe}/${tokenId}`;
      const data = await blobStorageService.get(blobKey) as HistoricalPriceData;

      if (!data) {
        return null;
      }

      // Apply limit if specified
      if (limit && data.prices.length > limit) {
        return {
          ...data,
          prices: data.prices.slice(-limit),
          dataPoints: limit
        };
      }

      return data;
    } catch (error) {
      console.error(`[HistoricalPriceService] Error getting historical data for ${tokenId}:`, error);
      return null;
    }
  }

  /**
   * Get all tokens with historical data
   */
  async getAvailableTokens(timeframe: string = '5m'): Promise<string[]> {
    try {
      // This is a simplified approach - in production you might want to maintain an index
      const tokens: string[] = [];

      // Try to get current prices to know what tokens we should have historical data for
      const currentPrices = await oraclePriceService.getAllPrices();

      for (const tokenId of Object.keys(currentPrices)) {
        const historicalData = await this.getHistoricalData(tokenId, timeframe);
        if (historicalData && historicalData.dataPoints > 0) {
          tokens.push(tokenId);
        }
      }

      return tokens;
    } catch (error) {
      console.error('[HistoricalPriceService] Error getting available tokens:', error);
      return [];
    }
  }

  /**
   * Helper: Get max points for timeframe
   */
  private getMaxPointsForTimeframe(timeframe: string): number {
    switch (timeframe) {
      case '5m': return this.MAX_5MIN_POINTS;
      case '1h': return this.MAX_1HOUR_POINTS;
      case '1d': return this.MAX_1DAY_POINTS;
      default: return 100;
    }
  }

  /**
   * Helper: Calculate average of a numeric field
   */
  private calculateAverage(points: HistoricalPricePoint[], field: keyof HistoricalPricePoint): number {
    const values = points.map(p => p[field]).filter(v => typeof v === 'number') as number[];
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  /**
   * Helper: Calculate sum of a numeric field
   */
  private calculateSum(points: HistoricalPricePoint[], field: keyof HistoricalPricePoint): number {
    const values = points.map(p => p[field]).filter(v => typeof v === 'number') as number[];
    return values.reduce((a, b) => a + b, 0);
  }

  /**
   * Get collection statistics
   */
  async getStats(): Promise<{
    totalTokens: number;
    dataPoints5m: number;
    dataPoints1h: number;
    dataPoints1d: number;
    oldestDataPoint?: number;
    newestDataPoint?: number;
  }> {
    try {
      const tokens5m = await this.getAvailableTokens('5m');
      const tokens1h = await this.getAvailableTokens('1h');
      const tokens1d = await this.getAvailableTokens('1d');

      let totalDataPoints5m = 0;
      let totalDataPoints1h = 0;
      let totalDataPoints1d = 0;
      let oldestDataPoint = Date.now();
      let newestDataPoint = 0;

      // Calculate stats for 5m data
      for (const tokenId of tokens5m) {
        const data = await this.getHistoricalData(tokenId, '5m');
        if (data) {
          totalDataPoints5m += data.dataPoints;
          const prices = data.prices;
          if (prices.length > 0) {
            oldestDataPoint = Math.min(oldestDataPoint, prices[0].timestamp);
            newestDataPoint = Math.max(newestDataPoint, prices[prices.length - 1].timestamp);
          }
        }
      }

      // Calculate stats for 1h data
      for (const tokenId of tokens1h) {
        const data = await this.getHistoricalData(tokenId, '1h');
        if (data) {
          totalDataPoints1h += data.dataPoints;
        }
      }

      // Calculate stats for 1d data
      for (const tokenId of tokens1d) {
        const data = await this.getHistoricalData(tokenId, '1d');
        if (data) {
          totalDataPoints1d += data.dataPoints;
        }
      }

      return {
        totalTokens: tokens5m.length,
        dataPoints5m: totalDataPoints5m,
        dataPoints1h: totalDataPoints1h,
        dataPoints1d: totalDataPoints1d,
        oldestDataPoint: oldestDataPoint < Date.now() ? oldestDataPoint : undefined,
        newestDataPoint: newestDataPoint > 0 ? newestDataPoint : undefined
      };
    } catch (error) {
      console.error('[HistoricalPriceService] Error getting stats:', error);
      return {
        totalTokens: 0,
        dataPoints5m: 0,
        dataPoints1h: 0,
        dataPoints1d: 0
      };
    }
  }
}

// Export singleton instance
export const historicalPriceService = new HistoricalPriceService();
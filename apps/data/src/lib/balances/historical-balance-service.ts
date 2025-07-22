/**
 * Historical Balance Service - Collects and stores balance history for known users
 */

import { blobStorageService } from '../storage/blob-storage-service';
import { balanceService } from './balance-service';

export interface HistoricalBalancePoint {
  timestamp: number;
  stxBalance: string;
  stxLocked: string;
  fungibleTokens: Record<string, string>; // contractId -> balance
  nftCounts: Record<string, string>; // contractId -> count
  totalUsdValue?: number; // If we have price data
  source: string;
}

export interface HistoricalBalanceData {
  address: string;
  balances: HistoricalBalancePoint[];
  lastUpdated: number;
  dataPoints: number;
  timeframe: string; // '5m', '1h', '1d'
}

/**
 * Service for collecting and managing historical balance data
 */
class HistoricalBalanceService {
  private readonly HISTORICAL_BLOB_PREFIX = 'addresses';
  private readonly KNOWN_ADDRESSES_BLOB = 'balances/known-addresses';
  private readonly MAX_5MIN_POINTS = 288; // 24 hours of 5min data
  private readonly MAX_1HOUR_POINTS = 168; // 7 days of 1hour data  
  private readonly MAX_1DAY_POINTS = 365; // 1 year of 1day data

  /**
   * Collect current balances for all known addresses and add them to historical data
   * This should be called by the cron job every 5 minutes
   */
  async collectCurrentBalances(): Promise<{ success: boolean; collected: number; errors: string[] }> {
    const startTime = Date.now();
    const errors: string[] = [];
    let collected = 0;

    try {
      console.log('[HistoricalBalanceService] Starting balance collection...');

      // Get list of known addresses to track
      const knownAddresses = await this.getKnownAddresses();

      if (knownAddresses.length === 0) {
        const error = 'No known addresses to track';
        console.warn(`[HistoricalBalanceService] ${error}`);
        errors.push(error);
        return { success: false, collected: 0, errors };
      }

      console.log(`[HistoricalBalanceService] Collecting balances for ${knownAddresses.length} addresses`);

      // Process each address's balance data
      for (const address of knownAddresses) {
        try {
          await this.collectAddressBalances(address);
          collected++;
        } catch (error) {
          const errorMsg = `Failed to collect balance for ${address}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`[HistoricalBalanceService] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      const processingTime = Date.now() - startTime;
      console.log(`[HistoricalBalanceService] Collection completed: ${collected} addresses in ${processingTime}ms`);

      return {
        success: true,
        collected,
        errors
      };

    } catch (error) {
      const errorMsg = `Balance collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`[HistoricalBalanceService] ${errorMsg}`);
      errors.push(errorMsg);

      return {
        success: false,
        collected,
        errors
      };
    }
  }

  /**
   * Collect balance data for a specific address
   */
  private async collectAddressBalances(address: string): Promise<void> {
    try {
      // Get current balance data from balance service
      const balanceData = await balanceService.getAddressBalances(address);

      if (!balanceData) {
        throw new Error(`No balance data available for ${address}`);
      }

      // Convert to historical balance point format
      const balancePoint: HistoricalBalancePoint = {
        timestamp: Date.now(),
        stxBalance: balanceData.stx.balance,
        stxLocked: balanceData.stx.locked || '0',
        fungibleTokens: {},
        nftCounts: {},
        source: 'balance-service'
      };

      // Add fungible token balances
      if (balanceData.fungible_tokens) {
        Object.entries(balanceData.fungible_tokens).forEach(([contractId, tokenData]) => {
          balancePoint.fungibleTokens[contractId] = tokenData.balance;
        });
      }

      // Add NFT counts
      if (balanceData.non_fungible_tokens) {
        Object.entries(balanceData.non_fungible_tokens).forEach(([contractId, nftData]) => {
          balancePoint.nftCounts[contractId] = nftData.count;
        });
      }

      // Store in 5-minute timeframe
      await this.addBalanceToTimeframe(address, '5m', balancePoint);

      // Aggregate to hourly if it's the right time (every 12th 5-min interval)
      const minutesInHour = Math.floor(Date.now() / (1000 * 60)) % 60;
      if (minutesInHour % 60 === 0) {
        await this.aggregateToHourly(address);
      }

      // Aggregate to daily if it's the right time (every 24th hour)
      const hoursInDay = Math.floor(Date.now() / (1000 * 60 * 60)) % 24;
      if (hoursInDay === 0 && minutesInHour % 60 === 0) {
        await this.aggregateToDaily(address);
      }

    } catch (error) {
      console.error(`[HistoricalBalanceService] Error collecting balances for ${address}:`, error);
      throw error;
    }
  }

  /**
   * Add balance point to specific timeframe
   */
  private async addBalanceToTimeframe(address: string, timeframe: string, balancePoint: HistoricalBalancePoint): Promise<void> {
    const blobKey = `${this.HISTORICAL_BLOB_PREFIX}/${address}/historical/${timeframe}`;

    try {
      // Get existing historical data
      let historicalData: HistoricalBalanceData;

      try {
        const existing = await blobStorageService.get(blobKey);
        historicalData = existing as HistoricalBalanceData;

        // Validate structure
        if (!historicalData.balances || !Array.isArray(historicalData.balances)) {
          throw new Error('Invalid historical balance data structure');
        }
      } catch (error) {
        // Create new historical data structure
        historicalData = {
          address,
          balances: [],
          lastUpdated: Date.now(),
          dataPoints: 0,
          timeframe
        };
      }

      // Add new balance point
      historicalData.balances.push(balancePoint);
      historicalData.lastUpdated = Date.now();
      historicalData.dataPoints = historicalData.balances.length;

      // Trim old data based on timeframe
      const maxPoints = this.getMaxPointsForTimeframe(timeframe);
      if (historicalData.balances.length > maxPoints) {
        historicalData.balances = historicalData.balances.slice(-maxPoints);
        historicalData.dataPoints = historicalData.balances.length;
      }

      // Save back to blob storage
      await blobStorageService.put(blobKey, historicalData);

      console.log(`[HistoricalBalanceService] Added balance point for ${address} (${timeframe}) - ${historicalData.dataPoints} total points`);

    } catch (error) {
      console.error(`[HistoricalBalanceService] Error adding balance point for ${address}:`, error);
      throw error;
    }
  }

  /**
   * Aggregate 5-minute data to hourly
   */
  private async aggregateToHourly(address: string): Promise<void> {
    try {
      const fiveMinData = await this.getHistoricalBalances(address, '5m');
      if (!fiveMinData || fiveMinData.balances.length < 12) {
        return; // Need at least 12 5-min points for 1 hour
      }

      // Get last 12 points (1 hour) and use the latest as the hourly snapshot
      const lastHourPoints = fiveMinData.balances.slice(-12);
      const latestPoint = lastHourPoints[lastHourPoints.length - 1];

      // Create hourly aggregate (use latest balances)
      const hourlyPoint: HistoricalBalancePoint = {
        timestamp: Math.floor(Date.now() / (1000 * 60 * 60)) * (1000 * 60 * 60), // Round to hour
        stxBalance: latestPoint.stxBalance,
        stxLocked: latestPoint.stxLocked,
        fungibleTokens: { ...latestPoint.fungibleTokens },
        nftCounts: { ...latestPoint.nftCounts },
        totalUsdValue: latestPoint.totalUsdValue,
        source: 'aggregated-5m'
      };

      await this.addBalanceToTimeframe(address, '1h', hourlyPoint);
      console.log(`[HistoricalBalanceService] Aggregated hourly balance data for ${address}`);

    } catch (error) {
      console.error(`[HistoricalBalanceService] Error aggregating hourly data for ${address}:`, error);
    }
  }

  /**
   * Aggregate hourly data to daily
   */
  private async aggregateToDaily(address: string): Promise<void> {
    try {
      const hourlyData = await this.getHistoricalBalances(address, '1h');
      if (!hourlyData || hourlyData.balances.length < 24) {
        return; // Need at least 24 hourly points for 1 day
      }

      // Get last 24 points (1 day) and use the latest as the daily snapshot
      const lastDayPoints = hourlyData.balances.slice(-24);
      const latestPoint = lastDayPoints[lastDayPoints.length - 1];

      // Create daily aggregate (use latest balances)
      const dailyPoint: HistoricalBalancePoint = {
        timestamp: Math.floor(Date.now() / (1000 * 60 * 60 * 24)) * (1000 * 60 * 60 * 24), // Round to day
        stxBalance: latestPoint.stxBalance,
        stxLocked: latestPoint.stxLocked,
        fungibleTokens: { ...latestPoint.fungibleTokens },
        nftCounts: { ...latestPoint.nftCounts },
        totalUsdValue: latestPoint.totalUsdValue,
        source: 'aggregated-1h'
      };

      await this.addBalanceToTimeframe(address, '1d', dailyPoint);
      console.log(`[HistoricalBalanceService] Aggregated daily balance data for ${address}`);

    } catch (error) {
      console.error(`[HistoricalBalanceService] Error aggregating daily data for ${address}:`, error);
    }
  }

  /**
   * Get historical balance data for an address and timeframe
   */
  async getHistoricalBalances(address: string, timeframe: string, limit?: number): Promise<HistoricalBalanceData | null> {
    try {
      const blobKey = `${this.HISTORICAL_BLOB_PREFIX}/${address}/historical/${timeframe}`;
      const data = await blobStorageService.get(blobKey) as HistoricalBalanceData;

      if (!data) {
        return null;
      }

      // Apply limit if specified
      if (limit && data.balances.length > limit) {
        return {
          ...data,
          balances: data.balances.slice(-limit),
          dataPoints: limit
        };
      }

      return data;
    } catch (error) {
      console.error(`[HistoricalBalanceService] Error getting historical balance data for ${address}:`, error);
      return null;
    }
  }

  /**
   * Get known addresses to track
   */
  async getKnownAddresses(): Promise<string[]> {
    try {
      // Try to get from known addresses blob first
      const knownAddressesData = await blobStorageService.get(this.KNOWN_ADDRESSES_BLOB);

      if (knownAddressesData && Array.isArray(knownAddressesData)) {
        return knownAddressesData;
      }

      // Fallback: try to get from root blob addresses
      const rootBlob = await blobStorageService.getRoot();
      if (rootBlob.addresses && typeof rootBlob.addresses === 'object') {
        const addresses = Object.keys(rootBlob.addresses);
        console.log(`[HistoricalBalanceService] Found ${addresses.length} addresses from root blob`);

        // Cache these addresses for future use
        await this.updateKnownAddresses(addresses);

        return addresses;
      }

      // If no addresses found, return some default ones for development
      const defaultAddresses = [
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS', // Charisma deployer
        'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G', // Welsh deployer
        'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR'  // USDA deployer
      ];

      console.log(`[HistoricalBalanceService] Using default addresses for tracking: ${defaultAddresses.length}`);
      return defaultAddresses;

    } catch (error) {
      console.error('[HistoricalBalanceService] Error getting known addresses:', error);

      // Return minimal set for fallback
      return ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS'];
    }
  }

  /**
   * Update the list of known addresses to track
   */
  async updateKnownAddresses(addresses: string[]): Promise<void> {
    try {
      await blobStorageService.put(this.KNOWN_ADDRESSES_BLOB, addresses);
      console.log(`[HistoricalBalanceService] Updated known addresses list with ${addresses.length} addresses`);
    } catch (error) {
      console.error('[HistoricalBalanceService] Error updating known addresses:', error);
    }
  }

  /**
   * Get all addresses with historical data
   */
  async getAvailableAddresses(timeframe: string = '5m'): Promise<string[]> {
    try {
      const addresses: string[] = [];

      // Try to get known addresses
      const knownAddresses = await this.getKnownAddresses();

      for (const address of knownAddresses) {
        const historicalData = await this.getHistoricalBalances(address, timeframe);
        if (historicalData && historicalData.dataPoints > 0) {
          addresses.push(address);
        }
      }

      return addresses;
    } catch (error) {
      console.error('[HistoricalBalanceService] Error getting available addresses:', error);
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
   * Get collection statistics
   */
  async getStats(): Promise<{
    totalAddresses: number;
    dataPoints5m: number;
    dataPoints1h: number;
    dataPoints1d: number;
    oldestDataPoint?: number;
    newestDataPoint?: number;
  }> {
    try {
      const addresses5m = await this.getAvailableAddresses('5m');
      const addresses1h = await this.getAvailableAddresses('1h');
      const addresses1d = await this.getAvailableAddresses('1d');

      let totalDataPoints5m = 0;
      let totalDataPoints1h = 0;
      let totalDataPoints1d = 0;
      let oldestDataPoint = Date.now();
      let newestDataPoint = 0;

      // Calculate stats for 5m data
      for (const address of addresses5m) {
        const data = await this.getHistoricalBalances(address, '5m');
        if (data) {
          totalDataPoints5m += data.dataPoints;
          const balances = data.balances;
          if (balances.length > 0) {
            oldestDataPoint = Math.min(oldestDataPoint, balances[0].timestamp);
            newestDataPoint = Math.max(newestDataPoint, balances[balances.length - 1].timestamp);
          }
        }
      }

      // Calculate stats for 1h data
      for (const address of addresses1h) {
        const data = await this.getHistoricalBalances(address, '1h');
        if (data) {
          totalDataPoints1h += data.dataPoints;
        }
      }

      // Calculate stats for 1d data
      for (const address of addresses1d) {
        const data = await this.getHistoricalBalances(address, '1d');
        if (data) {
          totalDataPoints1d += data.dataPoints;
        }
      }

      return {
        totalAddresses: addresses5m.length,
        dataPoints5m: totalDataPoints5m,
        dataPoints1h: totalDataPoints1h,
        dataPoints1d: totalDataPoints1d,
        oldestDataPoint: oldestDataPoint < Date.now() ? oldestDataPoint : undefined,
        newestDataPoint: newestDataPoint > 0 ? newestDataPoint : undefined
      };
    } catch (error) {
      console.error('[HistoricalBalanceService] Error getting stats:', error);
      return {
        totalAddresses: 0,
        dataPoints5m: 0,
        dataPoints1h: 0,
        dataPoints1d: 0
      };
    }
  }
}

// Export singleton instance
export const historicalBalanceService = new HistoricalBalanceService();
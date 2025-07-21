/**
 * Simplified Balance Series API
 * Bulk time series requests for balance data with cache optimization
 */

import { BlobMonitor } from '@modules/blob-monitor';
import type {
  BalancePoint,
  TimePeriod,
  BalanceSeriesRequest,
  BalanceSeriesResponse,
  BulkBalanceRequest,
  BulkBalanceResponse
} from '../types';
import type { BalanceSnapshot } from '../types/snapshot-types';
import {
  periodToTimeRange,
  getMonthRange
} from '../utils/time-series';
import { KVBalanceStore } from '../storage/KVBalanceStore';
import { BalanceTimeSeriesStore } from '../storage/BalanceTimeSeriesStore';
import { BalanceService } from '../service/BalanceService';

export class BalanceSeriesAPI {
  private currentStore: KVBalanceStore;
  private timeSeriesStore: BalanceTimeSeriesStore;
  private blobMonitor: BlobMonitor;
  private balanceService: BalanceService;
  
  constructor(balanceService?: BalanceService) {
    this.currentStore = new KVBalanceStore();
    this.timeSeriesStore = new BalanceTimeSeriesStore();
    this.balanceService = balanceService || new BalanceService();
    this.blobMonitor = new BlobMonitor({
      serviceName: 'balance-series-api',
      enforcementLevel: 'warn',
      enableCostTracking: true,
      enableCapacityTracking: true
    });
  }

  /**
   * Get bulk balance time series data
   */
  async getBalanceSeries(request: BalanceSeriesRequest): Promise<BalanceSeriesResponse> {
    const startTime = Date.now();
    let blobsAccessed = 0;
    let cacheHits = 0;
    let cacheMisses = 0;

    try {
      const { addresses, contractIds, period, granularity = 'day', includeSnapshots = false, limit = 100 } = request;
      
      // Validate inputs
      if (!addresses.length || !contractIds.length) {
        throw new Error('Addresses and contract IDs are required');
      }

      const timeRange = periodToTimeRange(period);
      const timeSeries: Record<string, Record<string, BalancePoint[]>> = {};
      const snapshots: Record<string, BalanceSnapshot[]> = {};
      
      // Process each address
      for (const address of addresses) {
        timeSeries[address] = {};
        
        // Get time series for each contract
        for (const contractId of contractIds) {
          try {
            const history = await this.timeSeriesStore.getBalanceHistory(address, contractId, {
              from: timeRange.from,
              to: timeRange.to,
              granularity: timeRange.granularity,
              limit
            });
            
            timeSeries[address][contractId] = history;
            
            // Count blobs accessed (estimate based on months)
            const months = getMonthRange(timeRange.from, timeRange.to);
            blobsAccessed += months.length;
            
            // Assume cache hit if we got data quickly
            if (history.length > 0) {
              cacheHits++;
            } else {
              cacheMisses++;
            }
          } catch (error) {
            console.warn(`Failed to get history for ${address}/${contractId}:`, error);
            timeSeries[address][contractId] = [];
            cacheMisses++;
          }
        }
        
        // Get snapshots if requested
        if (includeSnapshots) {
          try {
            const addressSnapshots = await this.timeSeriesStore.getDailySnapshots(
              address,
              timeRange.from,
              timeRange.to
            );
            snapshots[address] = addressSnapshots;
            
            // Count additional blobs for snapshots
            const years = Math.ceil((timeRange.to - timeRange.from) / (365 * 24 * 60 * 60 * 1000));
            blobsAccessed += years;
          } catch (error) {
            console.warn(`Failed to get snapshots for ${address}:`, error);
            snapshots[address] = [];
          }
        }
      }

      return {
        success: true,
        data: {
          timeSeries,
          snapshots: includeSnapshots ? snapshots : undefined,
          metadata: {
            totalRequests: addresses.length * contractIds.length,
            cacheHits,
            cacheMisses,
            executionTime: Date.now() - startTime,
            blobsAccessed
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get bulk current balances
   */
  async getBulkBalances(request: BulkBalanceRequest): Promise<BulkBalanceResponse> {
    const startTime = Date.now();
    let cacheHits = 0;

    try {
      const { addresses, contractIds, includeZeroBalances = false } = request;
      
      const results: Record<string, Record<string, string>> = {};
      
      // Process each address
      for (const address of addresses) {
        try {
          const balances = await this.currentStore.getAddressBalances(address);
          
          // Filter to requested contracts if specified
          if (contractIds) {
            const filtered: Record<string, string> = {};
            for (const contractId of contractIds) {
              const balance = balances[contractId] || '0';
              if (includeZeroBalances || BigInt(balance) > 0) {
                filtered[contractId] = balance;
              }
            }
            results[address] = filtered;
          } else {
            // Return all balances
            if (includeZeroBalances) {
              results[address] = balances;
            } else {
              const filtered: Record<string, string> = {};
              for (const [contractId, balance] of Object.entries(balances)) {
                if (BigInt(balance) > 0) {
                  filtered[contractId] = balance;
                }
              }
              results[address] = filtered;
            }
          }
          
          cacheHits++;
        } catch (error) {
          console.warn(`Failed to get balances for ${address}:`, error);
          results[address] = {};
        }
      }

      return {
        success: true,
        data: results,
        metadata: {
          totalAddresses: addresses.length,
          totalContracts: contractIds?.length || 0,
          executionTime: Date.now() - startTime,
          cacheHits
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          totalAddresses: request.addresses.length,
          totalContracts: request.contractIds?.length || 0,
          executionTime: Date.now() - startTime,
          cacheHits: 0
        }
      };
    }
  }

}
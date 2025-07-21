/**
 * Coverage tests for BalanceService uncovered methods
 * Simple tests to maximize coverage of core functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BalanceService } from '../service/BalanceService';
import { SAMPLE_ADDRESSES, SAMPLE_CONTRACTS } from './test-fixtures';

describe('BalanceService - Coverage Tests', () => {
  let balanceService: BalanceService;
  let mockCurrentStore: any;
  let mockTimeSeriesStore: any;

  beforeEach(() => {
    // Create simple mocks
    mockCurrentStore = {
      setBalance: vi.fn().mockResolvedValue(undefined),
      setBalancesBatch: vi.fn().mockResolvedValue(undefined),
      getLastSync: vi.fn().mockResolvedValue(new Date()),
      getStats: vi.fn().mockResolvedValue({
        totalAddresses: 1,
        totalContracts: 1,
        lastUpdated: Date.now()
      })
    };

    mockTimeSeriesStore = {
      appendBalancePoint: vi.fn().mockResolvedValue(undefined),
      getBalanceHistory: vi.fn().mockResolvedValue([]),
      getDailySnapshots: vi.fn().mockResolvedValue([]),
      createSnapshot: vi.fn().mockResolvedValue(undefined),
      getBlobMonitorStats: vi.fn().mockReturnValue({}),
      getRecentBlobOperations: vi.fn().mockReturnValue([]),
      getBlobAlerts: vi.fn().mockReturnValue([])
    };

    balanceService = new BalanceService(mockCurrentStore, mockTimeSeriesStore);
  });

  describe('Time Series Methods', () => {
    it('should get balance history', async () => {
      const result = await balanceService.getBalanceHistory(
        SAMPLE_ADDRESSES.mainnet.alice,
        SAMPLE_CONTRACTS.stx
      );

      expect(result).toEqual([]);
      expect(mockTimeSeriesStore.getBalanceHistory).toHaveBeenCalledWith(
        SAMPLE_ADDRESSES.mainnet.alice,
        SAMPLE_CONTRACTS.stx,
        expect.objectContaining({
          from: expect.any(Number),
          to: expect.any(Number),
          granularity: expect.any(String),
          limit: 100
        })
      );
    });

    it('should get bulk balance history', async () => {
      const result = await balanceService.getBulkBalanceHistory(
        [SAMPLE_ADDRESSES.mainnet.alice],
        [SAMPLE_CONTRACTS.stx]
      );

      expect(result).toEqual({
        [SAMPLE_ADDRESSES.mainnet.alice]: {
          [SAMPLE_CONTRACTS.stx]: []
        }
      });
    });

    it('should get balance snapshots', async () => {
      const result = await balanceService.getBalanceSnapshots(
        SAMPLE_ADDRESSES.mainnet.alice
      );

      expect(result).toEqual([]);
      expect(mockTimeSeriesStore.getDailySnapshots).toHaveBeenCalled();
    });
  });



  describe('Utility Methods', () => {
    it('should clear cache', () => {
      // Add clearCache method to mocks
      mockCurrentStore.clearCache = vi.fn();
      mockTimeSeriesStore.clearCache = vi.fn();

      balanceService.clearCache();

      expect(mockCurrentStore.clearCache).toHaveBeenCalled();
      expect(mockTimeSeriesStore.clearCache).toHaveBeenCalled();
    });

    it('should get stats', async () => {
      const stats = await balanceService.getStats();

      expect(stats).toEqual({
        currentStore: {
          totalAddresses: 1,
          totalContracts: 1,
          lastUpdated: expect.any(Number)
        },
        timeSeriesStore: undefined,
        blobMonitoring: expect.any(Object)
      });
    });

    it('should get blob monitoring stats', () => {
      const stats = balanceService.getBlobMonitoringStats();

      expect(stats).toEqual({
        currentStore: undefined,
        timeSeriesStore: {},
        recentOperations: [],
        activeAlerts: []
      });
    });

    it('should get recent blob operations', () => {
      const operations = balanceService.getRecentBlobOperations(5);

      expect(operations).toEqual([]);
      expect(mockTimeSeriesStore.getRecentBlobOperations).toHaveBeenCalledWith(5);
    });

    it('should get blob alerts', () => {
      const alerts = balanceService.getBlobAlerts();

      expect(alerts).toEqual([]);
      expect(mockTimeSeriesStore.getBlobAlerts).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle time series errors gracefully', async () => {
      mockTimeSeriesStore.getBalanceHistory.mockImplementation(() => {
        throw new Error('Time series error');
      });

      const result = await balanceService.getBalanceHistory(
        SAMPLE_ADDRESSES.mainnet.alice,
        SAMPLE_CONTRACTS.stx
      );

      expect(result).toEqual([]);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get balance history'),
        expect.any(Error)
      );
    });

    it('should handle snapshot errors gracefully', async () => {
      mockTimeSeriesStore.getDailySnapshots.mockImplementation(() => {
        throw new Error('Snapshot error');
      });

      const result = await balanceService.getBalanceSnapshots(
        SAMPLE_ADDRESSES.mainnet.alice
      );

      expect(result).toEqual([]);
    });

    it('should handle bulk history errors gracefully', async () => {
      mockTimeSeriesStore.getBalanceHistory.mockImplementation(() => {
        throw new Error('History error');
      });

      const result = await balanceService.getBulkBalanceHistory(
        [SAMPLE_ADDRESSES.mainnet.alice],
        [SAMPLE_CONTRACTS.stx]
      );

      // Returns empty arrays for failed requests, not empty object
      expect(result).toEqual({
        [SAMPLE_ADDRESSES.mainnet.alice]: {
          [SAMPLE_CONTRACTS.stx]: []
        }
      });
    });
  });
});
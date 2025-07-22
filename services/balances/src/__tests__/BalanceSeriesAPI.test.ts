/**
 * Simple coverage tests for BalanceSeriesAPI
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BalanceSeriesAPI } from '../balance-series/balance-series-api';
import { SAMPLE_ADDRESSES, SAMPLE_CONTRACTS } from './test-fixtures';

// Mock dependencies
vi.mock('../storage/KVBalanceStore', () => ({
  KVBalanceStore: vi.fn().mockImplementation(() => ({
    getAddressBalances: vi.fn().mockResolvedValue({}),
    getBalance: vi.fn().mockResolvedValue('0'),
    setBalance: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('../storage/BalanceTimeSeriesStore', () => ({
  BalanceTimeSeriesStore: vi.fn().mockImplementation(() => ({
    getBalanceHistory: vi.fn().mockResolvedValue([]),
    getDailySnapshots: vi.fn().mockResolvedValue([]),
    appendBalancePoint: vi.fn().mockResolvedValue(undefined),
    createSnapshot: vi.fn().mockResolvedValue(undefined),
    getBlobMonitorStats: vi.fn().mockReturnValue({}),
    getRecentBlobOperations: vi.fn().mockReturnValue([]),
    getBlobAlerts: vi.fn().mockReturnValue([])
  }))
}));


describe('BalanceSeriesAPI - Coverage Tests', () => {
  let api: BalanceSeriesAPI;

  beforeEach(() => {
    vi.clearAllMocks();
    api = new BalanceSeriesAPI();
  });

  describe('Constructor', () => {
    it('should create instance with default stores', () => {
      expect(api).toBeInstanceOf(BalanceSeriesAPI);
    });
  });

  describe('Balance Series Methods', () => {
    it('should get balance series', async () => {
      const request = {
        addresses: [SAMPLE_ADDRESSES.mainnet.alice],
        contractIds: [SAMPLE_CONTRACTS.stx],
        period: '30d' as const
      };

      const result = await api.getBalanceSeries(request);

      expect(result).toEqual({
        success: true,
        data: {
          timeSeries: {
            [SAMPLE_ADDRESSES.mainnet.alice]: {
              [SAMPLE_CONTRACTS.stx]: []
            }
          },
          metadata: expect.objectContaining({
            totalRequests: 1,
            executionTime: expect.any(Number)
          })
        }
      });
    });

    it('should handle invalid requests', async () => {
      const request = {
        addresses: [],
        contractIds: [],
        period: '30d' as const
      };

      const result = await api.getBalanceSeries(request);

      expect(result).toEqual({
        success: false,
        error: 'Addresses and contract IDs are required'
      });
    });

    it('should get bulk balances', async () => {
      const request = {
        addresses: [SAMPLE_ADDRESSES.mainnet.alice],
        contractIds: [SAMPLE_CONTRACTS.stx]
      };

      const result = await api.getBulkBalances(request);

      expect(result).toEqual({
        success: true,
        data: {
          [SAMPLE_ADDRESSES.mainnet.alice]: {}
        },
        metadata: expect.objectContaining({
          totalAddresses: 1,
          executionTime: expect.any(Number)
        })
      });
    });

  });


});
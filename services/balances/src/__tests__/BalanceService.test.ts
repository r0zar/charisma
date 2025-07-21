/**
 * Unit tests for BalanceService - Main access patterns
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BalanceService } from '../service/BalanceService';
import { KVBalanceStore } from '../storage/KVBalanceStore';
import { BalanceTimeSeriesStore } from '../storage/BalanceTimeSeriesStore';
import { ValidationError } from '../types';
import {
  SAMPLE_ADDRESSES,
  SAMPLE_CONTRACTS,
  SAMPLE_BALANCES,
  SAMPLE_BULK_REQUEST,
  createMockKVStore
} from './test-fixtures';

// Mock the KV store
const mockKV = createMockKVStore();

describe('BalanceService - Main Access Patterns', () => {
  let balanceService: BalanceService;
  let mockKVStore: KVBalanceStore;
  let mockTimeSeriesStore: BalanceTimeSeriesStore;

  beforeEach(() => {
    // Create mock stores
    mockKVStore = {
      getBalance: vi.fn(),
      setBalance: vi.fn(),
      getAddressBalances: vi.fn(),
      setBalancesBatch: vi.fn(),
      invalidateAddress: vi.fn(),
      getLastSync: vi.fn(),
      getAllAddresses: vi.fn(),
      getAddressContracts: vi.fn(),
      getAllCurrentBalances: vi.fn(),
      getStats: vi.fn()
    } as any;

    mockTimeSeriesStore = {
      getBalanceHistory: vi.fn(),
      appendBalancePoint: vi.fn(),
      getDailySnapshots: vi.fn(),
      createSnapshot: vi.fn(),
      getCacheStats: vi.fn(),
      getBlobMonitorStats: vi.fn(),
      getRecentBlobOperations: vi.fn(),
      getBlobAlerts: vi.fn()
    } as any;

    balanceService = new BalanceService(mockKVStore, mockTimeSeriesStore);
  });

  describe('Single Balance Requests (getBalance)', () => {
    it('should return balance for valid address and contract', async () => {
      const address = SAMPLE_ADDRESSES.mainnet.alice;
      const contractId = SAMPLE_CONTRACTS.stx;
      const expectedBalance = SAMPLE_BALANCES.alice[contractId];

      mockKVStore.getBalance = vi.fn().mockResolvedValue(expectedBalance);

      const result = await balanceService.getBalance(address, contractId);

      expect(result).toBe(expectedBalance);
      expect(mockKVStore.getBalance).toHaveBeenCalledWith(address, contractId);
    });

    it('should return "0" for non-existent balance', async () => {
      const address = SAMPLE_ADDRESSES.mainnet.alice;
      const contractId = SAMPLE_CONTRACTS.diko;

      mockKVStore.getBalance = vi.fn().mockResolvedValue(null);

      const result = await balanceService.getBalance(address, contractId);

      expect(result).toBe('0');
      expect(mockKVStore.getBalance).toHaveBeenCalledWith(address, contractId);
    });

    it('should return "0" when KV store throws error', async () => {
      const address = SAMPLE_ADDRESSES.mainnet.alice;
      const contractId = SAMPLE_CONTRACTS.stx;

      mockKVStore.getBalance = vi.fn().mockRejectedValue(new Error('KV error'));

      const result = await balanceService.getBalance(address, contractId);

      expect(result).toBe('0');
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get balance'),
        expect.any(Error)
      );
    });

    it('should throw ValidationError for invalid address', async () => {
      const invalidAddress = 'invalid-address';
      const contractId = SAMPLE_CONTRACTS.stx;

      await expect(
        balanceService.getBalance(invalidAddress, contractId)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid contract ID', async () => {
      const address = SAMPLE_ADDRESSES.mainnet.alice;
      const invalidContractId = 'invalid-contract';

      await expect(
        balanceService.getBalance(address, invalidContractId)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Multiple Balance Requests (getBalances)', () => {
    it('should return all balances for address when no contract IDs specified', async () => {
      const address = SAMPLE_ADDRESSES.mainnet.alice;
      const expectedBalances = SAMPLE_BALANCES.alice;

      mockKVStore.getAddressBalances = vi.fn().mockResolvedValue(expectedBalances);

      const result = await balanceService.getBalances(address);

      expect(result).toEqual(expectedBalances);
      expect(mockKVStore.getAddressBalances).toHaveBeenCalledWith(address);
    });

    it('should return filtered balances for specific contract IDs', async () => {
      const address = SAMPLE_ADDRESSES.mainnet.alice;
      const contractIds = [SAMPLE_CONTRACTS.stx, SAMPLE_CONTRACTS.usdc];
      const allBalances = SAMPLE_BALANCES.alice;

      mockKVStore.getAddressBalances = vi.fn().mockResolvedValue(allBalances);

      const result = await balanceService.getBalances(address, contractIds);

      expect(result).toEqual({
        [SAMPLE_CONTRACTS.stx]: allBalances[SAMPLE_CONTRACTS.stx],
        [SAMPLE_CONTRACTS.usdc]: allBalances[SAMPLE_CONTRACTS.usdc]
      });
    });

    it('should return "0" for non-existent contracts in filtered request', async () => {
      const address = SAMPLE_ADDRESSES.mainnet.alice;
      const contractIds = [SAMPLE_CONTRACTS.stx, SAMPLE_CONTRACTS.diko]; // Alice doesn't have DIKO
      const allBalances = SAMPLE_BALANCES.alice;

      mockKVStore.getAddressBalances = vi.fn().mockResolvedValue(allBalances);

      const result = await balanceService.getBalances(address, contractIds);

      expect(result).toEqual({
        [SAMPLE_CONTRACTS.stx]: allBalances[SAMPLE_CONTRACTS.stx],
        [SAMPLE_CONTRACTS.diko]: '0'
      });
    });

    it('should return empty object when address has no balances', async () => {
      const address = SAMPLE_ADDRESSES.mainnet.charlie;

      mockKVStore.getAddressBalances = vi.fn().mockResolvedValue({});

      const result = await balanceService.getBalances(address);

      expect(result).toEqual({});
    });

    it('should return empty object when KV store throws error', async () => {
      const address = SAMPLE_ADDRESSES.mainnet.alice;

      mockKVStore.getAddressBalances = vi.fn().mockRejectedValue(new Error('KV error'));

      const result = await balanceService.getBalances(address);

      expect(result).toEqual({});
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get balances'),
        expect.any(Error)
      );
    });
  });

  describe('Enhanced Balance Requests (getAllBalances)', () => {
    it('should return BalanceResult array with metadata', async () => {
      const address = SAMPLE_ADDRESSES.mainnet.alice;
      const balances = SAMPLE_BALANCES.alice;
      const lastSync = new Date(Date.now() - 60000);

      mockKVStore.getAddressBalances = vi.fn().mockResolvedValue(balances);
      mockKVStore.getLastSync = vi.fn().mockResolvedValue(lastSync);

      const result = await balanceService.getAllBalances(address);

      expect(result).toHaveLength(Object.keys(balances).length);
      expect(result[0]).toMatchObject({
        address,
        contractId: expect.any(String),
        balance: expect.any(String),
        lastUpdated: lastSync.getTime()
      });
    });

    it('should filter out zero balances', async () => {
      const address = SAMPLE_ADDRESSES.mainnet.alice;
      const balances = {
        [SAMPLE_CONTRACTS.stx]: '1000000000',
        [SAMPLE_CONTRACTS.usdc]: '0', // Zero balance
        [SAMPLE_CONTRACTS.alex]: '500000000'
      };

      mockKVStore.getAddressBalances = vi.fn().mockResolvedValue(balances);
      mockKVStore.getLastSync = vi.fn().mockResolvedValue(new Date());

      const result = await balanceService.getAllBalances(address);

      expect(result).toHaveLength(2); // Only non-zero balances
      expect(result.every(r => BigInt(r.balance) > 0)).toBe(true);
    });

    it('should return empty array when no balances exist', async () => {
      const address = SAMPLE_ADDRESSES.mainnet.charlie;

      mockKVStore.getAddressBalances = vi.fn().mockResolvedValue({});

      const result = await balanceService.getAllBalances(address);

      expect(result).toEqual([]);
    });

    it('should handle missing lastSync gracefully', async () => {
      const address = SAMPLE_ADDRESSES.mainnet.alice;
      const balances = SAMPLE_BALANCES.alice;

      mockKVStore.getAddressBalances = vi.fn().mockResolvedValue(balances);
      mockKVStore.getLastSync = vi.fn().mockResolvedValue(null);

      const result = await balanceService.getAllBalances(address);

      expect(result.every(r => r.lastUpdated === 0)).toBe(true);
    });
  });

  describe('Bulk Balance Requests (getBulkBalances)', () => {
    it('should return bulk balance data with metadata', async () => {
      const request = SAMPLE_BULK_REQUEST;
      
      mockKVStore.getAddressBalances = vi.fn()
        .mockResolvedValueOnce(SAMPLE_BALANCES.alice)
        .mockResolvedValueOnce(SAMPLE_BALANCES.bob)
        .mockResolvedValueOnce(SAMPLE_BALANCES.charlie);

      const result = await balanceService.getBulkBalances(request);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.metadata).toMatchObject({
        totalAddresses: request.addresses.length,
        totalContracts: request.contractIds?.length || 0,
        executionTime: expect.any(Number),
        cacheHits: expect.any(Number)
      });
    });

    it('should filter zero balances by default', async () => {
      const request = {
        ...SAMPLE_BULK_REQUEST,
        includeZeroBalances: false
      };

      const balancesWithZeros = {
        [SAMPLE_CONTRACTS.stx]: '1000000000',
        [SAMPLE_CONTRACTS.usdc]: '0', // Zero balance
        [SAMPLE_CONTRACTS.alex]: '500000000'
      };

      mockKVStore.getAddressBalances = vi.fn()
        .mockResolvedValue(balancesWithZeros);

      const result = await balanceService.getBulkBalances(request);

      expect(result.success).toBe(true);
      
      // Check that zero balances are filtered out
      for (const addressData of Object.values(result.data || {})) {
        for (const balance of Object.values(addressData)) {
          expect(BigInt(balance)).toBeGreaterThan(0n);
        }
      }
    });

    it('should include zero balances when requested', async () => {
      const request = {
        ...SAMPLE_BULK_REQUEST,
        includeZeroBalances: true
      };

      const balancesWithZeros = {
        [SAMPLE_CONTRACTS.stx]: '1000000000',
        [SAMPLE_CONTRACTS.usdc]: '0', // Zero balance
        [SAMPLE_CONTRACTS.alex]: '500000000'
      };

      mockKVStore.getAddressBalances = vi.fn()
        .mockResolvedValue(balancesWithZeros);

      const result = await balanceService.getBulkBalances(request);

      expect(result.success).toBe(true);
      
      // Check that zero balances are included
      const firstAddress = Object.keys(result.data || {})[0];
      expect(result.data?.[firstAddress]?.[SAMPLE_CONTRACTS.usdc]).toBe('0');
    });

    it('should handle invalid addresses gracefully', async () => {
      const request = {
        addresses: ['invalid-address', SAMPLE_ADDRESSES.mainnet.alice],
        contractIds: [SAMPLE_CONTRACTS.stx],
        includeZeroBalances: false
      };

      mockKVStore.getAddressBalances = vi.fn().mockResolvedValue(SAMPLE_BALANCES.alice);

      const result = await balanceService.getBulkBalances(request);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should handle large batch requests efficiently', async () => {
      const largeRequest = {
        addresses: Array.from({ length: 100 }, (_, i) => 
          `SP${i.toString().padStart(38, '0')}Q6VF78`
        ),
        contractIds: [SAMPLE_CONTRACTS.stx],
        includeZeroBalances: false
      };

      mockKVStore.getAddressBalances = vi.fn().mockResolvedValue({
        [SAMPLE_CONTRACTS.stx]: '1000000000'
      });

      const startTime = Date.now();
      const result = await balanceService.getBulkBalances(largeRequest);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.metadata.totalAddresses).toBe(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Batch Balance Requests (getBalancesBatch)', () => {
    it('should process batch requests efficiently', async () => {
      const requests = [
        { address: SAMPLE_ADDRESSES.mainnet.alice, contractId: SAMPLE_CONTRACTS.stx },
        { address: SAMPLE_ADDRESSES.mainnet.alice, contractId: SAMPLE_CONTRACTS.usdc },
        { address: SAMPLE_ADDRESSES.mainnet.bob, contractId: SAMPLE_CONTRACTS.stx }
      ];

      mockKVStore.getAddressBalances = vi.fn()
        .mockResolvedValueOnce(SAMPLE_BALANCES.alice)
        .mockResolvedValueOnce(SAMPLE_BALANCES.bob);
      
      mockKVStore.getLastSync = vi.fn().mockResolvedValue(new Date(Date.now() - 60000));

      const result = await balanceService.getBalancesBatch(requests);

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        address: SAMPLE_ADDRESSES.mainnet.alice,
        contractId: SAMPLE_CONTRACTS.stx,
        balance: SAMPLE_BALANCES.alice[SAMPLE_CONTRACTS.stx],
        lastUpdated: expect.any(Number)
      });
    });

    it('should group requests by address for efficiency', async () => {
      const requests = [
        { address: SAMPLE_ADDRESSES.mainnet.alice, contractId: SAMPLE_CONTRACTS.stx },
        { address: SAMPLE_ADDRESSES.mainnet.alice, contractId: SAMPLE_CONTRACTS.usdc },
        { address: SAMPLE_ADDRESSES.mainnet.bob, contractId: SAMPLE_CONTRACTS.stx }
      ];

      mockKVStore.getAddressBalances = vi.fn()
        .mockResolvedValueOnce(SAMPLE_BALANCES.alice)
        .mockResolvedValueOnce(SAMPLE_BALANCES.bob);
      
      mockKVStore.getLastSync = vi.fn().mockResolvedValue(new Date());

      await balanceService.getBalancesBatch(requests);

      // Should only call getAddressBalances twice (once per unique address)
      expect(mockKVStore.getAddressBalances).toHaveBeenCalledTimes(2);
    });

    it('should handle empty batch requests', async () => {
      const result = await balanceService.getBalancesBatch([]);

      expect(result).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      const requests = [
        { address: SAMPLE_ADDRESSES.mainnet.alice, contractId: SAMPLE_CONTRACTS.stx }
      ];

      mockKVStore.getAddressBalances = vi.fn().mockRejectedValue(new Error('KV error'));

      const result = await balanceService.getBalancesBatch(requests);

      // Should return partial results with graceful degradation
      expect(result).toEqual([{
        address: SAMPLE_ADDRESSES.mainnet.alice,
        contractId: SAMPLE_CONTRACTS.stx,
        balance: '0',
        lastUpdated: 0
      }]);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get balances for'),
        expect.any(Error)
      );
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent requests efficiently', async () => {
      const address = SAMPLE_ADDRESSES.mainnet.alice;
      const contractId = SAMPLE_CONTRACTS.stx;
      const expectedBalance = SAMPLE_BALANCES.alice[contractId];

      mockKVStore.getBalance = vi.fn().mockResolvedValue(expectedBalance);

      const concurrentRequests = Array.from({ length: 50 }, () => 
        balanceService.getBalance(address, contractId)
      );

      const startTime = Date.now();
      const results = await Promise.all(concurrentRequests);
      const endTime = Date.now();

      expect(results.every(r => r === expectedBalance)).toBe(true);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should process large bulk requests within reasonable time', async () => {
      const largeRequest = {
        addresses: Array.from({ length: 1000 }, (_, i) => 
          `SP${i.toString().padStart(38, '0')}Q6VF78`
        ),
        contractIds: [SAMPLE_CONTRACTS.stx, SAMPLE_CONTRACTS.usdc],
        includeZeroBalances: false
      };

      mockKVStore.getAddressBalances = vi.fn().mockResolvedValue({
        [SAMPLE_CONTRACTS.stx]: '1000000000'
      });

      const startTime = Date.now();
      const result = await balanceService.getBulkBalances(largeRequest);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.metadata.totalAddresses).toBe(1000);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});
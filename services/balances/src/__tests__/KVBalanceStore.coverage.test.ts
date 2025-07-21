/**
 * Coverage tests for KVBalanceStore uncovered methods
 * Simple tests to fill remaining coverage gaps
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KVBalanceStore } from '../storage/KVBalanceStore';
import { kv } from '@vercel/kv';
import { SAMPLE_ADDRESSES, SAMPLE_CONTRACTS } from './test-fixtures';

describe('KVBalanceStore - Coverage Tests', () => {
  let kvStore: KVBalanceStore;

  beforeEach(() => {
    kvStore = new KVBalanceStore();
    vi.clearAllMocks();

    // Basic mock setup
    (kv.get as any).mockResolvedValue(null);
    (kv.set as any).mockResolvedValue('OK');
    (kv.keys as any).mockResolvedValue([]);
  });

  describe('Address Management', () => {
    it('should get all addresses', async () => {
      (kv.get as any).mockResolvedValue(['address1', 'address2']);

      const addresses = await kvStore.getAllAddresses();

      expect(addresses).toEqual(['address1', 'address2']);
      expect(kv.get).toHaveBeenCalledWith('balance:addresses:index');
    });

    it('should handle empty address index', async () => {
      (kv.get as any).mockResolvedValue(null);

      const addresses = await kvStore.getAllAddresses();

      expect(addresses).toEqual([]);
    });

    it('should handle address index errors', async () => {
      (kv.get as any).mockRejectedValue(new Error('Index error'));

      const addresses = await kvStore.getAllAddresses();

      expect(addresses).toEqual([]);
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to get all addresses:',
        expect.any(Error)
      );
    });
  });

  describe('Contract Management', () => {
    it('should get address contracts', async () => {
      (kv.get as any).mockResolvedValue({
        contracts: [SAMPLE_CONTRACTS.stx, SAMPLE_CONTRACTS.usdc]
      });

      const contracts = await kvStore.getAddressContracts(SAMPLE_ADDRESSES.mainnet.alice);

      expect(contracts).toEqual([SAMPLE_CONTRACTS.stx, SAMPLE_CONTRACTS.usdc]);
    });

    it('should handle missing contract metadata', async () => {
      (kv.get as any).mockResolvedValue(null);

      const contracts = await kvStore.getAddressContracts(SAMPLE_ADDRESSES.mainnet.alice);

      expect(contracts).toEqual([]);
    });
  });

  describe('Bulk Operations', () => {
    it('should get all current balances', async () => {
      (kv.get as any).mockImplementation(async (key) => {
        if (key === 'balance:addresses:index') {
          return [SAMPLE_ADDRESSES.mainnet.alice];
        }
        if (key.startsWith('balance:meta:')) {
          return { contracts: [SAMPLE_CONTRACTS.stx] };
        }
        if (key.startsWith('balance:')) {
          return { balance: '1000000000', lastUpdated: Date.now() };
        }
        return null;
      });

      const balances = await kvStore.getAllCurrentBalances();

      expect(balances).toEqual({
        [SAMPLE_ADDRESSES.mainnet.alice]: {
          [SAMPLE_CONTRACTS.stx]: {
            balance: '1000000000',
            lastUpdated: expect.any(Number)
          }
        }
      });
    });

    it('should handle getAllCurrentBalances errors', async () => {
      (kv.get as any).mockRejectedValue(new Error('Bulk error'));

      const balances = await kvStore.getAllCurrentBalances();

      expect(balances).toEqual({});
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate address cache', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

      await kvStore.invalidateAddress(SAMPLE_ADDRESSES.mainnet.alice);

      expect(consoleSpy).toHaveBeenCalledWith(
        `Invalidate address ${SAMPLE_ADDRESSES.mainnet.alice} - no-op for KV store`
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle getAddressBalances errors gracefully', async () => {
      (kv.get as any).mockRejectedValue(new Error('Get error'));

      const balances = await kvStore.getAddressBalances(SAMPLE_ADDRESSES.mainnet.alice);

      expect(balances).toEqual({});
      expect(console.warn).toHaveBeenCalledWith(
        `Failed to get contracts for ${SAMPLE_ADDRESSES.mainnet.alice}:`,
        expect.any(Error)
      );
    });

    it('should handle getStats errors gracefully', async () => {
      (kv.get as any).mockRejectedValue(new Error('Stats error'));

      const stats = await kvStore.getStats();

      expect(stats).toMatchObject({
        totalSnapshots: 0,
        totalAddresses: 0,
        totalTokens: 0,
      });
    });
  });
});
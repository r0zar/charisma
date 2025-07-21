/**
 * Unit tests for KVBalanceStore - Storage layer access patterns
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KVBalanceStore } from '../storage/KVBalanceStore';
import { StorageError } from '../types';
import {
  SAMPLE_ADDRESSES,
  SAMPLE_CONTRACTS,
  SAMPLE_BALANCES,
  SAMPLE_KV_DATA
} from './test-fixtures';

// Import the actual mock that's used by the module
import { kv } from '@vercel/kv';

describe('KVBalanceStore - Storage Layer Access Patterns', () => {
  let kvStore: KVBalanceStore;

  beforeEach(() => {
    kvStore = new KVBalanceStore();
    vi.clearAllMocks();

    // Set up mock implementations
    (kv.get as any).mockImplementation(async (key: string) => {
      return SAMPLE_KV_DATA[key] || null;
    });

    (kv.set as any).mockResolvedValue('OK');
    (kv.mget as any).mockImplementation(async (keys: string[]) => {
      return keys.map(key => SAMPLE_KV_DATA[key] || null);
    });
    (kv.keys as any).mockImplementation(async (pattern: string) => {
      return Object.keys(SAMPLE_KV_DATA).filter(key => key.includes(pattern));
    });
  });

  describe('Individual Operations', () => {
    describe('getBalance', () => {
      it('should retrieve balance for valid address and contract', async () => {
        const address = SAMPLE_ADDRESSES.mainnet.alice;
        const contractId = SAMPLE_CONTRACTS.stx;
        const expectedBalance = SAMPLE_BALANCES.alice[contractId];

        kv.get.mockResolvedValue({
          balance: expectedBalance,
          lastUpdated: Date.now(),
          symbol: 'STX',
          decimals: 6
        });

        const result = await kvStore.getBalance(address, contractId);

        expect(result).toBe(expectedBalance);
        expect(kv.get).toHaveBeenCalledWith(`balance:${address}:${contractId}`);
      });

      it('should return null for non-existent balance', async () => {
        const address = SAMPLE_ADDRESSES.mainnet.alice;
        const contractId = SAMPLE_CONTRACTS.diko;

        kv.get.mockResolvedValue(null);

        const result = await kvStore.getBalance(address, contractId);

        expect(result).toBeNull();
      });

      it('should handle KV errors gracefully', async () => {
        const address = SAMPLE_ADDRESSES.mainnet.alice;
        const contractId = SAMPLE_CONTRACTS.stx;

        (kv.get as any).mockRejectedValue(new Error('KV connection error'));

        const result = await kvStore.getBalance(address, contractId);

        expect(result).toBeNull();
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('Failed to get balance'),
          expect.any(Error)
        );
      });
    });

    describe('setBalance', () => {
      it('should store balance with metadata', async () => {
        const address = SAMPLE_ADDRESSES.mainnet.alice;
        const contractId = SAMPLE_CONTRACTS.stx;
        const balance = '1000000000';

        kv.get.mockResolvedValue(null); // No existing data
        kv.set.mockResolvedValue('OK');

        await kvStore.setBalance(address, contractId, balance);

        // Should make 3 calls: balance data, address metadata, address index
        expect(kv.set).toHaveBeenCalledTimes(3);
        expect(kv.set).toHaveBeenCalledWith(
          `balance:${address}:${contractId}`,
          expect.objectContaining({
            balance,
            lastUpdated: expect.any(Number),
            blockHeight: undefined
          })
        );
      });

      it('should preserve existing metadata when updating balance', async () => {
        const address = SAMPLE_ADDRESSES.mainnet.alice;
        const contractId = SAMPLE_CONTRACTS.stx;
        const newBalance = '2000000000';
        const existingData = {
          balance: '1000000000',
          lastUpdated: Date.now() - 60000,
          blockHeight: 150000,
          symbol: 'STX',
          decimals: 6
        };

        kv.get.mockResolvedValue(existingData);
        kv.set.mockResolvedValue('OK');

        await kvStore.setBalance(address, contractId, newBalance);

        // Should make 2 calls: balance data, address metadata (no new index entry)
        expect(kv.set).toHaveBeenCalledTimes(2);
        expect(kv.set).toHaveBeenCalledWith(
          `balance:${address}:${contractId}`,
          expect.objectContaining({
            balance: newBalance,
            lastUpdated: expect.any(Number),
            blockHeight: existingData.blockHeight
          })
        );
      });

      it('should throw StorageError on KV failure', async () => {
        const address = SAMPLE_ADDRESSES.mainnet.alice;
        const contractId = SAMPLE_CONTRACTS.stx;
        const balance = '1000000000';

        (kv.get as any).mockResolvedValue(null);
        (kv.set as any).mockRejectedValue(new Error('KV write error'));

        await expect(
          kvStore.setBalance(address, contractId, balance)
        ).rejects.toThrow(StorageError);
      });
    });

    describe('Key Generation', () => {
      it('should generate consistent keys for same address/contract', async () => {
        const address = SAMPLE_ADDRESSES.mainnet.alice;
        const contractId = SAMPLE_CONTRACTS.stx;
        const expectedKey = `balance:${address}:${contractId}`;

        kv.get.mockResolvedValue(null);

        await kvStore.getBalance(address, contractId);

        expect(kv.get).toHaveBeenCalledWith(expectedKey);
      });

      it('should generate different keys for different addresses', async () => {
        const contractId = SAMPLE_CONTRACTS.stx;
        const alice = SAMPLE_ADDRESSES.mainnet.alice;
        const bob = SAMPLE_ADDRESSES.mainnet.bob;

        kv.get.mockResolvedValue(null);

        await kvStore.getBalance(alice, contractId);
        await kvStore.getBalance(bob, contractId);

        expect(kv.get).toHaveBeenCalledWith(`balance:${alice}:${contractId}`);
        expect(kv.get).toHaveBeenCalledWith(`balance:${bob}:${contractId}`);
      });
    });
  });

  describe('Batch Operations', () => {
    describe('setBalancesBatch', () => {
      it('should process multiple balance updates efficiently', async () => {
        const updates = [
          {
            address: SAMPLE_ADDRESSES.mainnet.alice,
            contractId: SAMPLE_CONTRACTS.stx,
            balance: '1000000000',
            decimals: 6,
            symbol: 'STX',
            timestamp: Date.now()
          },
          {
            address: SAMPLE_ADDRESSES.mainnet.alice,
            contractId: SAMPLE_CONTRACTS.usdc,
            balance: '500000000',
            decimals: 6,
            symbol: 'USDC',
            timestamp: Date.now()
          }
        ];

        kv.set.mockResolvedValue('OK');

        await kvStore.setBalancesBatch(updates);

        // Should make 3 calls per update (balance + metadata + index)
        expect(kv.set).toHaveBeenCalledTimes(updates.length * 3);
        expect(kv.set).toHaveBeenCalledWith(
          `balance:${updates[0].address}:${updates[0].contractId}`,
          expect.objectContaining({
            balance: updates[0].balance,
            lastUpdated: expect.any(Number),
            blockHeight: updates[0].blockHeight
          })
        );
      });

      it('should handle batch update errors', async () => {
        const updates = [
          {
            address: SAMPLE_ADDRESSES.mainnet.alice,
            contractId: SAMPLE_CONTRACTS.stx,
            balance: '1000000000',
            decimals: 6,
            symbol: 'STX',
            timestamp: Date.now()
          }
        ];

        kv.set.mockRejectedValue(new Error('Batch update failed'));

        await expect(
          kvStore.setBalancesBatch(updates)
        ).rejects.toThrow(StorageError);
      });

      it('should process large batches efficiently', async () => {
        const largeUpdates = Array.from({ length: 1000 }, (_, i) => ({
          address: SAMPLE_ADDRESSES.mainnet.alice,
          contractId: `SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.token-${i}`,
          balance: (Math.random() * 1000000000).toFixed(0),
          decimals: 6,
          symbol: `TOKEN${i}`,
          timestamp: Date.now()
        }));

        kv.set.mockResolvedValue('OK');

        const startTime = Date.now();
        await kvStore.setBalancesBatch(largeUpdates);
        const endTime = Date.now();

        expect(kv.set).toHaveBeenCalledTimes(1000 * 3); // 3 calls per update
        expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      });
    });

    describe('getAddressBalances', () => {
      it('should retrieve all balances for an address', async () => {
        const address = SAMPLE_ADDRESSES.mainnet.alice;
        const contracts = [SAMPLE_CONTRACTS.stx, SAMPLE_CONTRACTS.usdc];
        const expectedBalances = {
          [SAMPLE_CONTRACTS.stx]: '1000000000',
          [SAMPLE_CONTRACTS.usdc]: '500000000'
        };

        // Mock getting contracts for address
        kv.get.mockImplementation((key) => {
          if (key === `balance:meta:${address}`) {
            return Promise.resolve({ contracts });
          }
          return Promise.resolve({ balance: expectedBalances[key.split(':')[2]] });
        });

        const result = await kvStore.getAddressBalances(address);

        expect(result).toEqual(expectedBalances);
      });

      it('should filter out zero balances', async () => {
        const address = SAMPLE_ADDRESSES.mainnet.alice;
        const contracts = [SAMPLE_CONTRACTS.stx, SAMPLE_CONTRACTS.usdc];

        kv.get.mockImplementation((key) => {
          if (key === `balance:meta:${address}`) {
            return Promise.resolve({ contracts });
          }
          if (key === `balance:${address}:${SAMPLE_CONTRACTS.stx}`) {
            return Promise.resolve({ balance: '1000000000' });
          }
          if (key === `balance:${address}:${SAMPLE_CONTRACTS.usdc}`) {
            return Promise.resolve({ balance: '0' });
          }
          return Promise.resolve(null);
        });

        const result = await kvStore.getAddressBalances(address);

        expect(result).toEqual({
          [SAMPLE_CONTRACTS.stx]: '1000000000'
        });
        expect(result[SAMPLE_CONTRACTS.usdc]).toBeUndefined();
      });

      it('should handle addresses with no balances', async () => {
        const address = SAMPLE_ADDRESSES.mainnet.charlie;

        kv.get.mockImplementation((key) => {
          if (key === `balance:meta:${address}`) {
            return Promise.resolve(null);
          }
          return Promise.resolve(null);
        });

        const result = await kvStore.getAddressBalances(address);

        expect(result).toEqual({});
      });
    });

    describe('getAllCurrentBalances', () => {
      it('should retrieve all current balances for snapshot creation', async () => {
        const addresses = [SAMPLE_ADDRESSES.mainnet.alice, SAMPLE_ADDRESSES.mainnet.bob];
        const expectedResult = {
          [SAMPLE_ADDRESSES.mainnet.alice]: {
            [SAMPLE_CONTRACTS.stx]: {
              balance: '1000000000',
              lastUpdated: Date.now(),
              symbol: 'STX',
              decimals: 6
            }
          },
          [SAMPLE_ADDRESSES.mainnet.bob]: {
            [SAMPLE_CONTRACTS.stx]: {
              balance: '2500000000',
              lastUpdated: Date.now(),
              symbol: 'STX',
              decimals: 6
            }
          }
        };

        // Mock address index
        kv.get.mockImplementation((key) => {
          if (key === 'balance:addresses:index') {
            return Promise.resolve(addresses);
          }
          if (key === `balance:meta:${SAMPLE_ADDRESSES.mainnet.alice}`) {
            return Promise.resolve({ contracts: [SAMPLE_CONTRACTS.stx] });
          }
          if (key === `balance:meta:${SAMPLE_ADDRESSES.mainnet.bob}`) {
            return Promise.resolve({ contracts: [SAMPLE_CONTRACTS.stx] });
          }
          if (key === `balance:${SAMPLE_ADDRESSES.mainnet.alice}:${SAMPLE_CONTRACTS.stx}`) {
            return Promise.resolve(expectedResult[SAMPLE_ADDRESSES.mainnet.alice][SAMPLE_CONTRACTS.stx]);
          }
          if (key === `balance:${SAMPLE_ADDRESSES.mainnet.bob}:${SAMPLE_CONTRACTS.stx}`) {
            return Promise.resolve(expectedResult[SAMPLE_ADDRESSES.mainnet.bob][SAMPLE_CONTRACTS.stx]);
          }
          return Promise.resolve(null);
        });

        const result = await kvStore.getAllCurrentBalances();

        expect(result).toEqual(expectedResult);
      });

      it('should handle empty database', async () => {
        kv.get.mockImplementation((key) => {
          if (key === 'balance:addresses:index') {
            return Promise.resolve([]);
          }
          return Promise.resolve(null);
        });

        const result = await kvStore.getAllCurrentBalances();

        expect(result).toEqual({});
      });
    });
  });

  describe('Index Management', () => {
    describe('Address Index', () => {
      it('should update address index when setting balance', async () => {
        const address = SAMPLE_ADDRESSES.mainnet.alice;
        const contractId = SAMPLE_CONTRACTS.stx;
        const balance = '1000000000';

        kv.get.mockImplementation((key) => {
          if (key === `balance:meta:${address}`) {
            return Promise.resolve({ contracts: [], lastSync: Date.now() });
          }
          if (key === 'balance:addresses:index') {
            return Promise.resolve([]);
          }
          return Promise.resolve(null);
        });
        kv.set.mockResolvedValue('OK');

        await kvStore.setBalance(address, contractId, balance);

        // Should update metadata
        expect(kv.set).toHaveBeenCalledWith(
          `balance:meta:${address}`,
          expect.objectContaining({
            contracts: [contractId],
            lastSync: expect.any(Number)
          })
        );

        // Should update address index
        expect(kv.set).toHaveBeenCalledWith(
          'balance:addresses:index',
          [address]
        );
      });

      it('should not duplicate addresses in index', async () => {
        const address = SAMPLE_ADDRESSES.mainnet.alice;
        const contractId = SAMPLE_CONTRACTS.stx;
        const balance = '1000000000';

        kv.get.mockImplementation((key) => {
          if (key === `balance:meta:${address}`) {
            return Promise.resolve({ contracts: [], lastSync: Date.now() });
          }
          if (key === 'balance:addresses:index') {
            return Promise.resolve([address]); // Address already exists
          }
          return Promise.resolve(null);
        });
        kv.set.mockResolvedValue('OK');

        await kvStore.setBalance(address, contractId, balance);

        // Should make 2 calls: balance data + metadata (no index update since address exists)
        expect(kv.set).toHaveBeenCalledTimes(2);

        // Should NOT update index since address already exists
        expect(kv.set).not.toHaveBeenCalledWith(
          'balance:addresses:index',
          expect.any(Array)
        );
      });
    });

    describe('Contract Tracking', () => {
      it('should track contracts per address', async () => {
        const address = SAMPLE_ADDRESSES.mainnet.alice;
        const contractId = SAMPLE_CONTRACTS.stx;
        const balance = '1000000000';

        kv.get.mockImplementation((key) => {
          if (key === `balance:meta:${address}`) {
            return Promise.resolve({ contracts: [], lastSync: Date.now() });
          }
          if (key === 'balance:addresses:index') {
            return Promise.resolve([]);
          }
          return Promise.resolve(null);
        });
        kv.set.mockResolvedValue('OK');

        await kvStore.setBalance(address, contractId, balance);

        expect(kv.set).toHaveBeenCalledWith(
          `balance:meta:${address}`,
          expect.objectContaining({
            contracts: [contractId]
          })
        );
      });

      it('should not duplicate contracts in tracking', async () => {
        const address = SAMPLE_ADDRESSES.mainnet.alice;
        const contractId = SAMPLE_CONTRACTS.stx;
        const balance = '1000000000';

        kv.get.mockImplementation((key) => {
          if (key === `balance:meta:${address}`) {
            return Promise.resolve({ contracts: [contractId], lastSync: Date.now() });
          }
          if (key === 'balance:addresses:index') {
            return Promise.resolve([address]);
          }
          return Promise.resolve(null);
        });
        kv.set.mockResolvedValue('OK');

        await kvStore.setBalance(address, contractId, balance);

        expect(kv.set).toHaveBeenCalledWith(
          `balance:meta:${address}`,
          expect.objectContaining({
            contracts: [contractId] // Should not duplicate
          })
        );
      });
    });
  });

  describe('Statistics and Metadata', () => {
    describe('getStats', () => {
      it('should return storage statistics', async () => {
        const addresses = [SAMPLE_ADDRESSES.mainnet.alice, SAMPLE_ADDRESSES.mainnet.bob];
        const aliceContracts = [SAMPLE_CONTRACTS.stx, SAMPLE_CONTRACTS.usdc];
        const bobContracts = [SAMPLE_CONTRACTS.stx];

        kv.get.mockImplementation((key) => {
          if (key === 'balance:addresses:index') {
            return Promise.resolve(addresses);
          }
          if (key === `balance:meta:${SAMPLE_ADDRESSES.mainnet.alice}`) {
            return Promise.resolve({ contracts: aliceContracts, lastSync: Date.now() });
          }
          if (key === `balance:meta:${SAMPLE_ADDRESSES.mainnet.bob}`) {
            return Promise.resolve({ contracts: bobContracts, lastSync: Date.now() - 60000 });
          }
          return Promise.resolve(null);
        });

        const result = await kvStore.getStats();

        expect(result).toMatchObject({
          totalAddresses: 2,
          totalTokens: 3,
        });
      });

      it('should handle empty database gracefully', async () => {
        kv.get.mockImplementation((key) => {
          if (key === 'balance:addresses:index') {
            return Promise.resolve([]);
          }
          return Promise.resolve(null);
        });

        const result = await kvStore.getStats();

        expect(result).toMatchObject({
          totalAddresses: 0,
          totalTokens: 0,
        });
      });
    });

    describe('getLastSync', () => {
      it('should return last sync time for specific contract', async () => {
        const address = SAMPLE_ADDRESSES.mainnet.alice;
        const contractId = SAMPLE_CONTRACTS.stx;
        const lastUpdated = Date.now() - 60000;

        kv.get.mockResolvedValue({
          balance: '1000000000',
          lastUpdated,
          symbol: 'STX',
          decimals: 6
        });

        const result = await kvStore.getLastSync(address, contractId);

        expect(result).toEqual(new Date(lastUpdated));
      });

      it('should return last sync time for address', async () => {
        const address = SAMPLE_ADDRESSES.mainnet.alice;
        const lastSync = Date.now() - 60000;

        kv.get.mockResolvedValue({
          contracts: [SAMPLE_CONTRACTS.stx],
          lastSync
        });

        const result = await kvStore.getLastSync(address);

        expect(result).toEqual(new Date(lastSync));
      });

      it('should return null for non-existent data', async () => {
        const address = SAMPLE_ADDRESSES.mainnet.alice;
        const contractId = SAMPLE_CONTRACTS.stx;

        kv.get.mockResolvedValue(null);

        const result = await kvStore.getLastSync(address, contractId);

        expect(result).toBeNull();
      });
    });
  });
});
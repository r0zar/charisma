/**
 * Unit tests for BalanceService - Input validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BalanceService } from '../service/BalanceService';
import { KVBalanceStore } from '../storage/KVBalanceStore';
import { BalanceTimeSeriesStore } from '../storage/BalanceTimeSeriesStore';
import { ValidationError } from '../types';
import {
  SAMPLE_ADDRESSES,
  SAMPLE_CONTRACTS,
  INVALID_DATA,
  createMockKVStore
} from './test-fixtures';

// Mock the KV store  
const mockKV = createMockKVStore();

describe('BalanceService - Input Validation', () => {
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

  describe('Address Validation', () => {
    describe('Valid Addresses', () => {
      it('should accept valid mainnet addresses', async () => {
        const validAddresses = [
          SAMPLE_ADDRESSES.mainnet.alice,
          SAMPLE_ADDRESSES.mainnet.bob,
          SAMPLE_ADDRESSES.mainnet.charlie
        ];

        mockKVStore.getBalance = vi.fn().mockResolvedValue('1000000000');

        for (const address of validAddresses) {
          await expect(
            balanceService.getBalance(address, SAMPLE_CONTRACTS.stx)
          ).resolves.not.toThrow();
        }
      });

      it('should accept valid testnet addresses', async () => {
        const validAddresses = [
          SAMPLE_ADDRESSES.testnet.alice,
          SAMPLE_ADDRESSES.testnet.bob,
          SAMPLE_ADDRESSES.testnet.charlie
        ];

        mockKVStore.getBalance = vi.fn().mockResolvedValue('1000000000');

        for (const address of validAddresses) {
          await expect(
            balanceService.getBalance(address, SAMPLE_CONTRACTS.stx)
          ).resolves.not.toThrow();
        }
      });

      it('should handle addresses with different case patterns', async () => {
        const validAddresses = [
          'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE',
          'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR',
          'SP1WTA0YBPC5R6GDMPPJCEDEA6Z2ZEPNMQ4C39W6M'
        ];

        mockKVStore.getBalance = vi.fn().mockResolvedValue('1000000000');

        for (const address of validAddresses) {
          await expect(
            balanceService.getBalance(address, SAMPLE_CONTRACTS.stx)
          ).resolves.not.toThrow();
        }
      });
    });

    describe('Invalid Addresses', () => {
      it('should reject empty addresses', async () => {
        await expect(
          balanceService.getBalance(INVALID_DATA.addresses.empty, SAMPLE_CONTRACTS.stx)
        ).rejects.toThrow(ValidationError);
      });

      it('should reject null addresses', async () => {
        await expect(
          balanceService.getBalance(INVALID_DATA.addresses.null as any, SAMPLE_CONTRACTS.stx)
        ).rejects.toThrow(ValidationError);
      });

      it('should reject undefined addresses', async () => {
        await expect(
          balanceService.getBalance(INVALID_DATA.addresses.undefined as any, SAMPLE_CONTRACTS.stx)
        ).rejects.toThrow(ValidationError);
      });

      it('should reject addresses with wrong format', async () => {
        await expect(
          balanceService.getBalance(INVALID_DATA.addresses.wrongFormat, SAMPLE_CONTRACTS.stx)
        ).rejects.toThrow(ValidationError);
      });

      it('should reject addresses with wrong prefix', async () => {
        await expect(
          balanceService.getBalance(INVALID_DATA.addresses.wrongPrefix, SAMPLE_CONTRACTS.stx)
        ).rejects.toThrow(ValidationError);
      });

      it('should reject addresses that are too short', async () => {
        await expect(
          balanceService.getBalance(INVALID_DATA.addresses.tooShort, SAMPLE_CONTRACTS.stx)
        ).rejects.toThrow(ValidationError);
      });

      it('should reject addresses that are too long', async () => {
        await expect(
          balanceService.getBalance(INVALID_DATA.addresses.tooLong, SAMPLE_CONTRACTS.stx)
        ).rejects.toThrow(ValidationError);
      });

      it('should provide meaningful error messages for invalid addresses', async () => {
        try {
          await balanceService.getBalance(INVALID_DATA.addresses.wrongFormat, SAMPLE_CONTRACTS.stx);
          expect.fail('Should have thrown ValidationError');
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect(error.message).toContain('Invalid Stacks address format');
        }
      });
    });
  });

  describe('Contract ID Validation', () => {
    describe('Valid Contract IDs', () => {
      it('should accept valid contract IDs', async () => {
        const validContracts = [
          SAMPLE_CONTRACTS.stx,
          SAMPLE_CONTRACTS.usdc,
          SAMPLE_CONTRACTS.alex,
          SAMPLE_CONTRACTS.diko,
          SAMPLE_CONTRACTS.wrapped_bitcoin
        ];

        mockKVStore.getBalance = vi.fn().mockResolvedValue('1000000000');

        for (const contractId of validContracts) {
          await expect(
            balanceService.getBalance(SAMPLE_ADDRESSES.mainnet.alice, contractId)
          ).resolves.not.toThrow();
        }
      });

      it('should accept contract IDs with various naming patterns', async () => {
        const validContracts = [
          'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.token-name',
          'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.token_name',
          'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.tokenname',
          'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.TokenName',
          'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.token-name-v2'
        ];

        mockKVStore.getBalance = vi.fn().mockResolvedValue('1000000000');

        for (const contractId of validContracts) {
          await expect(
            balanceService.getBalance(SAMPLE_ADDRESSES.mainnet.alice, contractId)
          ).resolves.not.toThrow();
        }
      });
    });

    describe('Invalid Contract IDs', () => {
      it('should reject empty contract IDs', async () => {
        await expect(
          balanceService.getBalance(SAMPLE_ADDRESSES.mainnet.alice, INVALID_DATA.contractIds.empty)
        ).rejects.toThrow(ValidationError);
      });

      it('should reject null contract IDs', async () => {
        await expect(
          balanceService.getBalance(SAMPLE_ADDRESSES.mainnet.alice, INVALID_DATA.contractIds.null as any)
        ).rejects.toThrow(ValidationError);
      });

      it('should reject undefined contract IDs', async () => {
        await expect(
          balanceService.getBalance(SAMPLE_ADDRESSES.mainnet.alice, INVALID_DATA.contractIds.undefined as any)
        ).rejects.toThrow(ValidationError);
      });

      it('should reject contract IDs without dot separator', async () => {
        await expect(
          balanceService.getBalance(SAMPLE_ADDRESSES.mainnet.alice, INVALID_DATA.contractIds.noDot)
        ).rejects.toThrow(ValidationError);
      });

      it('should reject contract IDs with empty contract name', async () => {
        await expect(
          balanceService.getBalance(SAMPLE_ADDRESSES.mainnet.alice, INVALID_DATA.contractIds.emptyContract)
        ).rejects.toThrow(ValidationError);
      });

      it('should reject contract IDs with empty address', async () => {
        await expect(
          balanceService.getBalance(SAMPLE_ADDRESSES.mainnet.alice, INVALID_DATA.contractIds.emptyAddress)
        ).rejects.toThrow(ValidationError);
      });

      it('should provide meaningful error messages for invalid contract IDs', async () => {
        try {
          await balanceService.getBalance(SAMPLE_ADDRESSES.mainnet.alice, INVALID_DATA.contractIds.noDot);
          expect.fail('Should have thrown ValidationError');
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect(error.message).toContain('Invalid contract ID format');
        }
      });
    });
  });


  describe('Bulk Request Validation', () => {
    it('should validate all addresses in bulk requests', async () => {
      const invalidBulkRequest = {
        addresses: [
          SAMPLE_ADDRESSES.mainnet.alice,
          INVALID_DATA.addresses.wrongFormat, // Invalid address
          SAMPLE_ADDRESSES.mainnet.bob
        ],
        contractIds: [SAMPLE_CONTRACTS.stx],
        includeZeroBalances: false
      };

      const result = await balanceService.getBulkBalances(invalidBulkRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Invalid Stacks address format');
    });

    it('should handle empty address arrays', async () => {
      const emptyRequest = {
        addresses: [],
        contractIds: [SAMPLE_CONTRACTS.stx],
        includeZeroBalances: false
      };

      const result = await balanceService.getBulkBalances(emptyRequest);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({});
      expect(result.metadata.totalAddresses).toBe(0);
    });

    it('should handle empty contract ID arrays', async () => {
      const emptyContractRequest = {
        addresses: [SAMPLE_ADDRESSES.mainnet.alice],
        contractIds: [],
        includeZeroBalances: false
      };

      mockKVStore.getAddressBalances = vi.fn().mockResolvedValue({
        [SAMPLE_CONTRACTS.stx]: '1000000000'
      });

      const result = await balanceService.getBulkBalances(emptyContractRequest);

      expect(result.success).toBe(true);
      expect(result.metadata.totalContracts).toBe(0);
    });

    it('should handle undefined contract IDs gracefully', async () => {
      const undefinedContractRequest = {
        addresses: [SAMPLE_ADDRESSES.mainnet.alice],
        contractIds: undefined,
        includeZeroBalances: false
      };

      mockKVStore.getAddressBalances = vi.fn().mockResolvedValue({
        [SAMPLE_CONTRACTS.stx]: '1000000000'
      });

      const result = await balanceService.getBulkBalances(undefinedContractRequest);

      expect(result.success).toBe(true);
      expect(result.metadata.totalContracts).toBe(0);
    });
  });


  describe('Error Message Quality', () => {
    it('should provide specific error messages for different validation failures', async () => {
      const testCases = [
        {
          input: { address: '', contractId: SAMPLE_CONTRACTS.stx },
          expectedError: 'Invalid address: must be a non-empty string'
        },
        {
          input: { address: 'invalid-format', contractId: SAMPLE_CONTRACTS.stx },
          expectedError: 'Invalid Stacks address format'
        },
        {
          input: { address: SAMPLE_ADDRESSES.mainnet.alice, contractId: '' },
          expectedError: 'Invalid contract ID: must be a non-empty string'
        },
        {
          input: { address: SAMPLE_ADDRESSES.mainnet.alice, contractId: 'no-dot' },
          expectedError: 'Invalid contract ID format'
        }
      ];

      for (const testCase of testCases) {
        try {
          await balanceService.getBalance(testCase.input.address, testCase.input.contractId);
          expect.fail(`Should have thrown ValidationError for ${JSON.stringify(testCase.input)}`);
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect(error.message).toContain(testCase.expectedError);
        }
      }
    });

  });

  describe('Edge Cases', () => {
    it('should handle very long valid addresses', async () => {
      // Maximum length valid address
      const longValidAddress = 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE';
      
      mockKVStore.getBalance = vi.fn().mockResolvedValue('1000000000');

      await expect(
        balanceService.getBalance(longValidAddress, SAMPLE_CONTRACTS.stx)
      ).resolves.not.toThrow();
    });

    it('should handle very long contract names', async () => {
      const longContractName = 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.very-long-contract-name-that-is-still-valid-according-to-stacks-protocol';
      
      mockKVStore.getBalance = vi.fn().mockResolvedValue('1000000000');

      await expect(
        balanceService.getBalance(SAMPLE_ADDRESSES.mainnet.alice, longContractName)
      ).resolves.not.toThrow();
    });

  });
});
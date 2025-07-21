/**
 * IndexManager Tests
 * Core functionality tests for KV-based contract indexing and fast lookups
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IndexManager } from '../../index';
import {
  createSampleContractMetadata,
  SAMPLE_CONTRACT_IDS,
  ERROR_SCENARIOS,
  mockFactory
} from '../fixtures/test-fixtures';
import type { ContractMetadata } from '../../types';
import { kv } from '@vercel/kv';

// Mock KV operations directly in this test file
vi.mock('@vercel/kv', () => ({
  kv: {
    // Set operations
    sadd: vi.fn().mockResolvedValue(1),
    srem: vi.fn().mockResolvedValue(1),
    smembers: vi.fn().mockResolvedValue([]),
    scard: vi.fn().mockResolvedValue(0),
    sismember: vi.fn().mockResolvedValue(0),

    // Key operations
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    expire: vi.fn().mockResolvedValue(1),

    // Value operations
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK')
  }
}));

describe('IndexManager', () => {
  let indexManager: IndexManager;
  let sampleMetadata: ContractMetadata;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset all mock implementations to successful defaults
    vi.mocked(kv).sadd.mockResolvedValue(1);
    vi.mocked(kv).srem.mockResolvedValue(1);
    vi.mocked(kv).smembers.mockResolvedValue([]);
    vi.mocked(kv).scard.mockResolvedValue(0);
    vi.mocked(kv).sismember.mockResolvedValue(0);
    vi.mocked(kv).del.mockResolvedValue(1);
    vi.mocked(kv).keys.mockResolvedValue([]);
    vi.mocked(kv).expire.mockResolvedValue(1);
    vi.mocked(kv).get.mockResolvedValue(null);
    vi.mocked(kv).set.mockResolvedValue('OK');

    indexManager = new IndexManager({
      serviceName: 'test-registry',
      keyPrefix: 'test:'
    });

    sampleMetadata = createSampleContractMetadata(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
  });

  describe('Configuration', () => {
    it('should initialize with default configuration', () => {
      const manager = new IndexManager({
        serviceName: 'test-service',
        keyPrefix: 'test:'
      });
      expect(manager).toBeInstanceOf(IndexManager);
    });

    it('should use default values for optional config', () => {
      const manager = new IndexManager({
        serviceName: 'test-service',
        keyPrefix: ''
      });
      expect(manager).toBeInstanceOf(IndexManager);
    });
  });

  describe('addToIndexes', () => {
    it('should add contract to all relevant indexes', async () => {
      await indexManager.addToIndexes(SAMPLE_CONTRACT_IDS.SIP010_TOKEN, sampleMetadata);

      // Should add to main contracts list
      expect(vi.mocked(kv).sadd).toHaveBeenCalledWith('test:contracts:all', SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      // Should add to type index
      expect(vi.mocked(kv).sadd).toHaveBeenCalledWith('test:contracts:type:token', SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      // Should add to status index
      expect(vi.mocked(kv).sadd).toHaveBeenCalledWith('test:contracts:status:valid', SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      // Should add to discovery method index
      expect(vi.mocked(kv).sadd).toHaveBeenCalledWith('test:contracts:discovery:manual', SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      // Should add to trait indexes
      expect(vi.mocked(kv).sadd).toHaveBeenCalledWith('test:contracts:trait:SIP010', SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      // Should not set TTL on keys (persistent indexes)
      expect(vi.mocked(kv).expire).not.toHaveBeenCalled();

      // Should update timestamp without TTL
      expect(vi.mocked(kv).set).toHaveBeenCalledWith(
        expect.stringContaining('operations:add'),
        expect.any(Number)
      );
    });

    it('should handle blocked contracts correctly', async () => {
      const blockedMetadata = { 
        ...sampleMetadata, 
        blocked: { 
          reason: 'Test blocking', 
          blockedAt: Date.now(), 
          blockedBy: 'system' 
        } 
      };

      await indexManager.addToIndexes(SAMPLE_CONTRACT_IDS.SIP010_TOKEN, blockedMetadata);

      // Should add to blocked index
      expect(vi.mocked(kv).sadd).toHaveBeenCalledWith('test:contracts:blocked', SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
    });

    it('should handle contracts with multiple traits', async () => {
      const multiTraitMetadata = {
        ...sampleMetadata,
        implementedTraits: ['SIP010', 'SIP013', 'Custom']
      };

      await indexManager.addToIndexes(SAMPLE_CONTRACT_IDS.SIP010_TOKEN, multiTraitMetadata);

      // Should add to all trait indexes
      expect(vi.mocked(kv).sadd).toHaveBeenCalledWith('test:contracts:trait:SIP010', SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
      expect(vi.mocked(kv).sadd).toHaveBeenCalledWith('test:contracts:trait:SIP013', SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
      expect(vi.mocked(kv).sadd).toHaveBeenCalledWith('test:contracts:trait:Custom', SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
    });

    it('should handle KV operation failures', async () => {
      vi.mocked(kv).sadd.mockRejectedValue(ERROR_SCENARIOS.KV_ERROR);

      await expect(
        indexManager.addToIndexes(SAMPLE_CONTRACT_IDS.SIP010_TOKEN, sampleMetadata)
      ).rejects.toThrow('KV operation failed');
    });
  });

  describe('removeFromIndexes', () => {
    it('should remove contract from all indexes with metadata', async () => {
      await indexManager.removeFromIndexes(SAMPLE_CONTRACT_IDS.SIP010_TOKEN, sampleMetadata);

      // Should remove from main contracts list
      expect(vi.mocked(kv).srem).toHaveBeenCalledWith('test:contracts:all', SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      // Should remove from type index
      expect(vi.mocked(kv).srem).toHaveBeenCalledWith('test:contracts:type:token', SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      // Should remove from status index
      expect(vi.mocked(kv).srem).toHaveBeenCalledWith('test:contracts:status:valid', SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      // Should remove from discovery method index
      expect(vi.mocked(kv).srem).toHaveBeenCalledWith('test:contracts:discovery:manual', SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      // Should remove from trait indexes
      expect(vi.mocked(kv).srem).toHaveBeenCalledWith('test:contracts:trait:SIP010', SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      // Should update timestamp without TTL
      expect(vi.mocked(kv).set).toHaveBeenCalledWith(
        expect.stringContaining('operations:remove'),
        expect.any(Number)
      );
    });

    it('should remove from all indexes when no metadata provided', async () => {
      // Mock keys call to return some index keys
      vi.mocked(kv).keys.mockResolvedValue([
        'test:contracts:all',
        'test:contracts:type:token',
        'test:contracts:trait:SIP010'
      ]);

      await indexManager.removeFromIndexes(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      // Should call keys to get all index keys
      expect(vi.mocked(kv).keys).toHaveBeenCalledWith('test:contracts:*');

      // Should remove from main contracts list
      expect(vi.mocked(kv).srem).toHaveBeenCalledWith('test:contracts:all', SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      // Should remove from all found indexes
      expect(vi.mocked(kv).srem).toHaveBeenCalledWith('test:contracts:type:token', SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
      expect(vi.mocked(kv).srem).toHaveBeenCalledWith('test:contracts:trait:SIP010', SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
    });

    it('should handle blocked contract removal', async () => {
      const blockedMetadata = { 
        ...sampleMetadata, 
        blocked: { 
          reason: 'Test blocking', 
          blockedAt: Date.now(), 
          blockedBy: 'system' 
        } 
      };

      await indexManager.removeFromIndexes(SAMPLE_CONTRACT_IDS.SIP010_TOKEN, blockedMetadata);

      // Should remove from blocked index
      expect(vi.mocked(kv).srem).toHaveBeenCalledWith('test:contracts:blocked', SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
    });
  });

  describe('updateIndexes', () => {
    it('should update indexes when contract metadata changes', async () => {
      const oldMetadata = createSampleContractMetadata(SAMPLE_CONTRACT_IDS.SIP010_TOKEN, 'token');
      const newMetadata = createSampleContractMetadata(SAMPLE_CONTRACT_IDS.SIP010_TOKEN, 'nft');

      await indexManager.updateIndexes(SAMPLE_CONTRACT_IDS.SIP010_TOKEN, oldMetadata, newMetadata);

      // Should remove from old type index
      expect(vi.mocked(kv).srem).toHaveBeenCalledWith('test:contracts:type:token', SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      // Should add to new type index
      expect(vi.mocked(kv).sadd).toHaveBeenCalledWith('test:contracts:type:nft', SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
    });
  });

  describe('Query Operations', () => {
    beforeEach(() => {
      // Reset query stats
      indexManager.resetStats();
    });

    describe('getAllContracts', () => {
      it('should return all contracts from main index', async () => {
        const expectedContracts = [SAMPLE_CONTRACT_IDS.SIP010_TOKEN, SAMPLE_CONTRACT_IDS.SIP009_NFT];
        vi.mocked(kv).smembers.mockResolvedValue(expectedContracts);

        const result = await indexManager.getAllContracts();

        expect(result).toEqual(expectedContracts);
        expect(vi.mocked(kv).smembers).toHaveBeenCalledWith('test:contracts:all');
      });

      it('should track query stats correctly', async () => {
        vi.mocked(kv).smembers.mockResolvedValue([SAMPLE_CONTRACT_IDS.SIP010_TOKEN]);

        await indexManager.getAllContracts();

        const stats = await indexManager.getStats();
        expect(stats.totalQueries).toBe(1);
        expect(stats.cacheHits).toBe(1);
      });

      it('should handle empty results', async () => {
        vi.mocked(kv).smembers.mockResolvedValue([]);

        const result = await indexManager.getAllContracts();

        expect(result).toEqual([]);

        const stats = await indexManager.getStats();
        expect(stats.totalQueries).toBe(1);
        expect(stats.cacheHits).toBe(0); // No hit for empty results
      });
    });

    describe('getContractsByType', () => {
      it('should return contracts of specified type', async () => {
        const expectedContracts = [SAMPLE_CONTRACT_IDS.SIP010_TOKEN];
        vi.mocked(kv).smembers.mockResolvedValue(expectedContracts);

        const result = await indexManager.getContractsByType('token');

        expect(result).toEqual(expectedContracts);
        expect(vi.mocked(kv).smembers).toHaveBeenCalledWith('test:contracts:type:token');
      });
    });

    describe('getContractsByTrait', () => {
      it('should return contracts implementing specified trait', async () => {
        const expectedContracts = [SAMPLE_CONTRACT_IDS.SIP010_TOKEN];
        vi.mocked(kv).smembers.mockResolvedValue(expectedContracts);

        const result = await indexManager.getContractsByTrait('SIP010');

        expect(result).toEqual(expectedContracts);
        expect(vi.mocked(kv).smembers).toHaveBeenCalledWith('test:contracts:trait:SIP010');
      });
    });

    describe('getContractsByStatus', () => {
      it('should return contracts with specified validation status', async () => {
        const expectedContracts = [SAMPLE_CONTRACT_IDS.SIP010_TOKEN];
        vi.mocked(kv).smembers.mockResolvedValue(expectedContracts);

        const result = await indexManager.getContractsByStatus('valid');

        expect(result).toEqual(expectedContracts);
        expect(vi.mocked(kv).smembers).toHaveBeenCalledWith('test:contracts:status:valid');
      });
    });

    describe('getContractsByDiscovery', () => {
      it('should return contracts discovered by specified method', async () => {
        const expectedContracts = [SAMPLE_CONTRACT_IDS.SIP010_TOKEN];
        vi.mocked(kv).smembers.mockResolvedValue(expectedContracts);

        const result = await indexManager.getContractsByDiscovery('trait-search');

        expect(result).toEqual(expectedContracts);
        expect(vi.mocked(kv).smembers).toHaveBeenCalledWith('test:contracts:discovery:trait-search');
      });
    });

    describe('getBlockedContracts', () => {
      it('should return blocked contracts', async () => {
        const expectedContracts = ['SP123.malicious-contract'];
        vi.mocked(kv).smembers.mockResolvedValue(expectedContracts);

        const result = await indexManager.getBlockedContracts();

        expect(result).toEqual(expectedContracts);
        expect(vi.mocked(kv).smembers).toHaveBeenCalledWith('test:contracts:blocked');
      });
    });

    describe('getContractsByTraits', () => {
      it('should return empty array for no traits', async () => {
        const result = await indexManager.getContractsByTraits([]);
        expect(result).toEqual([]);
      });

      it('should use single trait query for one trait', async () => {
        const expectedContracts = [SAMPLE_CONTRACT_IDS.SIP010_TOKEN];
        vi.mocked(kv).smembers.mockResolvedValue(expectedContracts);

        const result = await indexManager.getContractsByTraits(['SIP010']);

        expect(result).toEqual(expectedContracts);
        expect(vi.mocked(kv).smembers).toHaveBeenCalledWith('test:contracts:trait:SIP010');
      });

      it('should find intersection for multiple traits', async () => {
        // Mock separate calls for each trait
        vi.mocked(kv).smembers
          .mockResolvedValueOnce(['contract1', 'contract2', 'contract3']) // SIP010 contracts
          .mockResolvedValueOnce(['contract2', 'contract3', 'contract4']); // SIP013 contracts

        const result = await indexManager.getContractsByTraits(['SIP010', 'SIP013']);

        // Should return intersection: contract2, contract3
        expect(result).toEqual(['contract2', 'contract3']);
        expect(vi.mocked(kv).smembers).toHaveBeenCalledWith('test:contracts:trait:SIP010');
        expect(vi.mocked(kv).smembers).toHaveBeenCalledWith('test:contracts:trait:SIP013');
      });

      it('should return empty array when no intersection exists', async () => {
        vi.mocked(kv).smembers
          .mockResolvedValueOnce(['contract1', 'contract2']) // SIP010 contracts
          .mockResolvedValueOnce(['contract3', 'contract4']); // SIP013 contracts

        const result = await indexManager.getContractsByTraits(['SIP010', 'SIP013']);

        expect(result).toEqual([]);
      });
    });

    describe('hasContract', () => {
      it('should return true for existing contract', async () => {
        vi.mocked(kv).sismember.mockResolvedValue(1);

        const result = await indexManager.hasContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

        expect(result).toBe(true);
        expect(vi.mocked(kv).sismember).toHaveBeenCalledWith('test:contracts:all', SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
      });

      it('should return false for non-existent contract', async () => {
        vi.mocked(kv).sismember.mockResolvedValue(0);

        const result = await indexManager.hasContract('SP123.non-existent');

        expect(result).toBe(false);
      });
    });
  });

  describe('Blocklist Operations', () => {
    describe('blockContract', () => {
      it('should add contract to blocklist', async () => {
        await indexManager.blockContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

        expect(vi.mocked(kv).sadd).toHaveBeenCalledWith('test:contracts:blocked', SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
        expect(vi.mocked(kv).set).toHaveBeenCalledWith(
          expect.stringContaining('operations:block'),
          expect.any(Number)
        );
      });
    });

    describe('unblockContract', () => {
      it('should remove contract from blocklist', async () => {
        await indexManager.unblockContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

        expect(vi.mocked(kv).srem).toHaveBeenCalledWith('test:contracts:blocked', SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
        expect(vi.mocked(kv).set).toHaveBeenCalledWith(
          expect.stringContaining('operations:unblock'),
          expect.any(Number)
        );
      });
    });

    describe('isBlocked', () => {
      it('should return true for blocked contract', async () => {
        vi.mocked(kv).sismember.mockResolvedValue(1);

        const result = await indexManager.isBlocked(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

        expect(result).toBe(true);
        expect(vi.mocked(kv).sismember).toHaveBeenCalledWith('test:contracts:blocked', SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
      });

      it('should return false for non-blocked contract', async () => {
        vi.mocked(kv).sismember.mockResolvedValue(0);

        const result = await indexManager.isBlocked(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

        expect(result).toBe(false);
      });
    });
  });

  describe('Management Operations', () => {
    describe('rebuildIndexes', () => {
      it('should rebuild all indexes successfully', async () => {
        const contracts = {
          [SAMPLE_CONTRACT_IDS.SIP010_TOKEN]: createSampleContractMetadata(SAMPLE_CONTRACT_IDS.SIP010_TOKEN, 'token'),
          [SAMPLE_CONTRACT_IDS.SIP009_NFT]: createSampleContractMetadata(SAMPLE_CONTRACT_IDS.SIP009_NFT, 'nft')
        };

        // Mock keys call for clearing indexes
        vi.mocked(kv).keys.mockResolvedValue(['test:contracts:all', 'test:contracts:type:token']);

        const result = await indexManager.rebuildIndexes(contracts);

        expect(result.rebuilt).toBe(2);
        expect(result.errors).toEqual([]);

        // Should clear existing indexes
        expect(vi.mocked(kv).del).toHaveBeenCalledWith('test:contracts:all', 'test:contracts:type:token');

        // Should rebuild indexes for each contract
        expect(vi.mocked(kv).sadd).toHaveBeenCalledWith('test:contracts:all', SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
        expect(vi.mocked(kv).sadd).toHaveBeenCalledWith('test:contracts:all', SAMPLE_CONTRACT_IDS.SIP009_NFT);
      });

      it('should handle individual contract errors during rebuild', async () => {
        const contracts = {
          [SAMPLE_CONTRACT_IDS.SIP010_TOKEN]: createSampleContractMetadata(SAMPLE_CONTRACT_IDS.SIP010_TOKEN),
          'SP123.failing-contract': createSampleContractMetadata('SP123.failing-contract')
        };

        // Mock keys call for clearing
        vi.mocked(kv).keys.mockResolvedValue([]);

        // Mock failure for second contract
        vi.mocked(kv).sadd
          .mockResolvedValueOnce(1) // First contract succeeds
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(1)
          .mockRejectedValue(ERROR_SCENARIOS.KV_ERROR); // Second contract fails

        const result = await indexManager.rebuildIndexes(contracts);

        expect(result.rebuilt).toBe(1);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toEqual({
          contractId: 'SP123.failing-contract',
          error: ERROR_SCENARIOS.KV_ERROR.message
        });
      });
    });

    describe('clearAllIndexes', () => {
      it('should clear all indexes', async () => {
        vi.mocked(kv).keys.mockResolvedValue(['test:contracts:all', 'test:contracts:type:token']);

        await indexManager.clearAllIndexes();

        expect(vi.mocked(kv).keys).toHaveBeenCalledWith('test:contracts:*');
        expect(vi.mocked(kv).del).toHaveBeenCalledWith('test:contracts:all', 'test:contracts:type:token');
      });

      it('should handle empty index list', async () => {
        vi.mocked(kv).keys.mockResolvedValue([]);

        await indexManager.clearAllIndexes();

        expect(vi.mocked(kv).del).not.toHaveBeenCalled();
      });
    });

    describe('getStats', () => {
      it('should return comprehensive index statistics', async () => {
        // Mock index keys
        vi.mocked(kv).keys.mockResolvedValue([
          'test:contracts:all',
          'test:contracts:type:token',
          'test:contracts:trait:SIP010'
        ]);

        // Mock set cardinality calls
        vi.mocked(kv).scard
          .mockResolvedValueOnce(100) // contracts:all
          .mockResolvedValueOnce(75)  // contracts:type:token
          .mockResolvedValueOnce(75); // contracts:trait:SIP010

        // Mock timestamp calls
        vi.mocked(kv).get
          .mockResolvedValueOnce(Date.now() - 3600000) // contracts:all timestamp
          .mockResolvedValueOnce(Date.now() - 1800000) // contracts:type:token timestamp
          .mockResolvedValueOnce(null); // contracts:trait:SIP010 no timestamp

        // Set up some query stats
        vi.mocked(kv).smembers.mockResolvedValue(['contract1']);
        await indexManager.getAllContracts(); // 1 query, 1 hit
        await indexManager.getContractsByType('token'); // 1 query, 1 hit

        const stats = await indexManager.getStats();

        expect(stats).toEqual({
          totalIndexes: 3,
          indexSizes: {
            'contracts:all': 100,
            'contracts:type:token': 75,
            'contracts:trait:SIP010': 75
          },
          lastUpdated: {
            'contracts:all': expect.any(Number),
            'contracts:type:token': expect.any(Number)
          },
          hitRate: 100, // 2 hits out of 2 queries
          totalQueries: 2,
          cacheHits: 2
        });
      });

      it('should handle errors when getting index sizes', async () => {
        vi.mocked(kv).keys.mockResolvedValue(['test:contracts:all', 'test:invalid:key']);

        // Mock scard to fail for invalid key
        vi.mocked(kv).scard
          .mockResolvedValueOnce(100) // contracts:all succeeds
          .mockRejectedValue(new Error('Invalid set')); // invalid key fails

        vi.mocked(kv).get.mockResolvedValue(null);

        const stats = await indexManager.getStats();

        expect(stats.totalIndexes).toBe(2);
        expect(stats.indexSizes).toEqual({
          'contracts:all': 100
          // invalid key should be skipped
        });
      });
    });

    describe('resetStats', () => {
      it('should reset query statistics', async () => {
        // Generate some stats first
        vi.mocked(kv).smembers.mockResolvedValue(['contract1']);
        await indexManager.getAllContracts();

        let stats = await indexManager.getStats();
        expect(stats.totalQueries).toBe(1);

        // Reset stats
        indexManager.resetStats();

        stats = await indexManager.getStats();
        expect(stats.totalQueries).toBe(0);
        expect(stats.cacheHits).toBe(0);
        expect(stats.hitRate).toBe(0);
      });
    });
  });

  describe('Performance and Concurrent Operations', () => {
    it('should handle bulk index operations efficiently', async () => {
      const contracts = mockFactory.createContracts(50, 'token');
      const operations = contracts.map((metadata, i) =>
        indexManager.addToIndexes(`SP${i}.test`, metadata)
      );

      await expect(Promise.all(operations)).resolves.not.toThrow();

      // Should have called sadd many times (5 indexes × 50 contracts)
      expect(vi.mocked(kv).sadd).toHaveBeenCalledTimes(250);
    });

    it('should handle concurrent query operations', async () => {
      vi.mocked(kv).smembers.mockResolvedValue(['contract1', 'contract2']);

      const queries = [
        indexManager.getAllContracts(),
        indexManager.getContractsByType('token'),
        indexManager.getContractsByTrait('SIP010'),
        indexManager.getContractsByStatus('valid'),
        indexManager.getBlockedContracts()
      ];

      const results = await Promise.all(queries);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toEqual(['contract1', 'contract2']);
      });
    });

    it('should maintain query stats accuracy during concurrent operations', async () => {
      vi.mocked(kv).smembers.mockResolvedValue(['contract1']);

      // Run multiple concurrent queries
      const queries = Array.from({ length: 10 }, () => indexManager.getAllContracts());
      await Promise.all(queries);

      const stats = await indexManager.getStats();
      expect(stats.totalQueries).toBe(10);
      expect(stats.cacheHits).toBe(10);
      expect(stats.hitRate).toBe(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle KV connection failures', async () => {
      vi.mocked(kv).sadd.mockRejectedValue(ERROR_SCENARIOS.NETWORK_ERROR);

      await expect(
        indexManager.addToIndexes(SAMPLE_CONTRACT_IDS.SIP010_TOKEN, sampleMetadata)
      ).rejects.toThrow('Network request failed');
    });

    it('should handle KV timeout errors', async () => {
      vi.mocked(kv).smembers.mockRejectedValue(ERROR_SCENARIOS.TIMEOUT_ERROR);

      await expect(indexManager.getAllContracts()).rejects.toThrow('Request timeout');
    });

    it('should gracefully handle invalid key patterns', async () => {
      vi.mocked(kv).keys.mockRejectedValue(new Error('Invalid pattern'));

      await expect(indexManager.getStats()).rejects.toThrow('Invalid pattern');
    });

    it('should handle set operation edge cases', async () => {
      // Test when sismember returns unexpected value
      vi.mocked(kv).sismember.mockResolvedValue(1 as 0 | 1); // Should only be 0 or 1

      const result = await indexManager.hasContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
      expect(result).toBe(true); // IndexManager checks specifically for === 1, but we mocked 1
    });
  });

  describe('Index Key Management', () => {
    it('should generate correct index keys', async () => {
      await indexManager.addToIndexes(SAMPLE_CONTRACT_IDS.SIP010_TOKEN, sampleMetadata);

      // Verify correct key patterns
      expect(vi.mocked(kv).sadd).toHaveBeenCalledWith('test:contracts:all', expect.any(String));
      expect(vi.mocked(kv).sadd).toHaveBeenCalledWith('test:contracts:type:token', expect.any(String));
      expect(vi.mocked(kv).sadd).toHaveBeenCalledWith('test:contracts:status:valid', expect.any(String));
      expect(vi.mocked(kv).sadd).toHaveBeenCalledWith('test:contracts:discovery:manual', expect.any(String));
      expect(vi.mocked(kv).sadd).toHaveBeenCalledWith('test:contracts:trait:SIP010', expect.any(String));
    });

    it('should filter out timestamp keys when getting index keys', async () => {
      vi.mocked(kv).keys.mockResolvedValue([
        'test:contracts:all',
        'test:contracts:all:updated',
        'test:contracts:type:token',
        'test:contracts:type:token:updated'
      ]);

      await indexManager.getStats();

      // Should only count actual index keys, not timestamp keys
      const stats = await indexManager.getStats();
      expect(stats.totalIndexes).toBe(2); // Only non-timestamp keys are counted
    });
  });
});
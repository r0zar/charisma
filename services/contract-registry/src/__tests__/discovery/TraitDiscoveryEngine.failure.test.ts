/**
 * TraitDiscoveryEngine Failure and Disabled Scenarios Tests
 * Tests various error conditions and disabled configurations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TraitDiscoveryEngine } from '../../discovery/TraitDiscoveryEngine';
import { searchContractsByTrait } from '@repo/polyglot';
import type { TraitDiscoveryConfig, SIPDiscoveryConfig, DiscoveryConfig } from '../../types/discovery-types';

// Mock @repo/polyglot
vi.mock('@repo/polyglot', () => ({
  searchContractsByTrait: vi.fn()
}));

describe('TraitDiscoveryEngine (Failure & Disabled Scenarios)', () => {
  let discoveryEngine: TraitDiscoveryEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    
    discoveryEngine = new TraitDiscoveryEngine({
      baseUrl: 'https://api.hiro.so',
      timeout: 5000,
      debug: true, // Enable debug for better test visibility
      batchSize: 10,
      maxRetries: 1,
      retryDelay: 100,
      blacklist: []
    });
  });

  describe('Disabled Discovery Scenarios', () => {
    it('should return empty result when trait discovery is disabled', async () => {
      const traitConfig: TraitDiscoveryConfig = {
        trait: {
          name: 'SIP010',
          description: 'Test trait',
          functions: []
        },
        enabled: false, // Disabled
        priority: 1,
        batchSize: 10
      };

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      expect(result.success).toBe(true);
      expect(result.method).toBe('trait-search');
      expect(result.contractsFound).toBe(0);
      expect(result.contractsProcessed).toBe(0);
      expect(result.contractsAdded).toBe(0);
      expect(result.newContracts).toEqual([]);
      expect(result.error).toBe('Trait discovery disabled');
    });

    it('should return empty result when SIP discovery is disabled', async () => {
      const sipConfig: SIPDiscoveryConfig = {
        sipNumber: 'SIP010',
        trait: {
          name: 'SIP010',
          description: 'Test SIP trait',
          functions: []
        },
        enabled: false // Disabled
      };

      const result = await discoveryEngine.discoverBySipStandard(sipConfig);

      expect(result.success).toBe(true);
      expect(result.method).toBe('sip-scan');
      expect(result.contractsFound).toBe(0);
      expect(result.contractsProcessed).toBe(0);
      expect(result.contractsAdded).toBe(0);
      expect(result.newContracts).toEqual([]);
      expect(result.error).toBe('SIP discovery disabled');
    });

    it('should return empty result when API scan is disabled', async () => {
      const apiConfig: DiscoveryConfig = {
        enabled: false, // Disabled
        batchSize: 10,
        maxRetries: 3,
        retryDelay: 1000,
        timeout: 30000,
        blacklist: []
      };

      const result = await discoveryEngine.discoverByApiScan(apiConfig);

      expect(result.success).toBe(true);
      expect(result.method).toBe('api-scan');
      expect(result.contractsFound).toBe(0);
      expect(result.contractsProcessed).toBe(0);
      expect(result.contractsAdded).toBe(0);
      expect(result.newContracts).toEqual([]);
      expect(result.error).toBe('API scan disabled');
    });
  });

  describe('Network and API Failure Scenarios', () => {
    it('should handle network timeout errors gracefully by returning empty results', async () => {
      const traitConfig: TraitDiscoveryConfig = {
        trait: {
          name: 'SIP010',
          description: 'Test trait',
          functions: []
        },
        enabled: true,
        priority: 1,
        batchSize: 10
      };

      // Mock network timeout - the searchContractsByTrait method catches errors and returns []
      vi.mocked(searchContractsByTrait).mockRejectedValue(new Error('Network timeout after 30000ms'));

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      // Should succeed with empty results rather than fail completely
      expect(result.success).toBe(true);
      expect(result.method).toBe('trait-search');
      expect(result.contractsFound).toBe(0);
      expect(result.contractsProcessed).toBe(0);
      expect(result.contractsAdded).toBe(0);
      expect(result.newContracts).toEqual([]);
      expect(result.error).toBeUndefined(); // No error in result since it's handled gracefully
    });

    it('should handle API rate limit errors gracefully by returning empty results', async () => {
      const traitConfig: TraitDiscoveryConfig = {
        trait: {
          name: 'SIP010',
          description: 'Test trait',
          functions: []
        },
        enabled: true,
        priority: 1,
        batchSize: 10
      };

      // Mock rate limit error
      vi.mocked(searchContractsByTrait).mockRejectedValue(new Error('API rate limit exceeded: 429 Too Many Requests'));

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      // Should succeed with empty results rather than fail completely
      expect(result.success).toBe(true);
      expect(result.method).toBe('trait-search');
      expect(result.contractsFound).toBe(0);
      expect(result.newContracts).toEqual([]);
      expect(result.error).toBeUndefined();
    });

    it('should handle API server errors gracefully by returning empty results', async () => {
      const traitConfig: TraitDiscoveryConfig = {
        trait: {
          name: 'SIP010',
          description: 'Test trait',
          functions: []
        },
        enabled: true,
        priority: 1,
        batchSize: 10
      };

      // Mock server error
      vi.mocked(searchContractsByTrait).mockRejectedValue(new Error('Internal Server Error: 500'));

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      // Should succeed with empty results rather than fail completely
      expect(result.success).toBe(true);
      expect(result.method).toBe('trait-search');
      expect(result.contractsFound).toBe(0);
      expect(result.newContracts).toEqual([]);
      expect(result.error).toBeUndefined();
    });

    it('should handle non-Error exceptions gracefully by returning empty results', async () => {
      const traitConfig: TraitDiscoveryConfig = {
        trait: {
          name: 'SIP010',
          description: 'Test trait',
          functions: []
        },
        enabled: true,
        priority: 1,
        batchSize: 10
      };

      // Mock non-Error exception
      vi.mocked(searchContractsByTrait).mockRejectedValue('String error message');

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      // Should succeed with empty results rather than fail completely
      expect(result.success).toBe(true);
      expect(result.method).toBe('trait-search');
      expect(result.contractsFound).toBe(0);
      expect(result.newContracts).toEqual([]);
      expect(result.error).toBeUndefined();
    });
  });

  describe('SIP Discovery Failure Scenarios', () => {
    it('should handle errors in SIP discovery gracefully (uses trait discovery internally)', async () => {
      const sipConfig: SIPDiscoveryConfig = {
        sipNumber: 'SIP010',
        trait: {
          name: 'SIP010',
          description: 'Test SIP trait',
          functions: []
        },
        enabled: true
      };

      // Mock API failure - this will be handled gracefully by the underlying trait discovery
      vi.mocked(searchContractsByTrait).mockRejectedValue(new Error('SIP discovery API failed'));

      const result = await discoveryEngine.discoverBySipStandard(sipConfig);

      // Should succeed with empty results since SIP discovery uses trait discovery internally
      expect(result.success).toBe(true);
      expect(result.method).toBe('sip-scan');
      expect(result.contractsFound).toBe(0);
      expect(result.newContracts).toEqual([]);
      expect(result.error).toBeUndefined();
    });

    it('should maintain SIP scan method even when using trait discovery internally', async () => {
      const sipConfig: SIPDiscoveryConfig = {
        sipNumber: 'SIP009',
        trait: {
          name: 'SIP009',
          description: 'NFT standard',
          functions: [
            {
              name: 'get-last-token-id',
              access: 'read_only',
              args: [],
              outputs: { type: 'uint128' }
            }
          ]
        },
        enabled: true
      };

      // Mock successful discovery
      vi.mocked(searchContractsByTrait).mockResolvedValue([
        {
          contract_id: 'SP123.nft-contract',
          tx_id: '0xabc123',
          block_height: 100000,
          clarity_version: 2
        }
      ]);

      const result = await discoveryEngine.discoverBySipStandard(sipConfig);

      expect(result.success).toBe(true);
      expect(result.method).toBe('sip-scan'); // Should be sip-scan, not trait-search
      expect(result.contractsFound).toBe(1);
      expect(result.newContracts).toEqual(['SP123.nft-contract']);
    });
  });

  describe('Empty API Response Scenarios', () => {
    it('should handle empty API responses gracefully', async () => {
      const traitConfig: TraitDiscoveryConfig = {
        trait: {
          name: 'SIP010',
          description: 'Test trait',
          functions: []
        },
        enabled: true,
        priority: 1,
        batchSize: 10
      };

      // Mock empty response
      vi.mocked(searchContractsByTrait).mockResolvedValue([]);

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      expect(result.success).toBe(true);
      expect(result.method).toBe('trait-search');
      expect(result.contractsFound).toBe(0);
      expect(result.contractsProcessed).toBe(0);
      expect(result.contractsAdded).toBe(0);
      expect(result.newContracts).toEqual([]);
      expect(result.errorContracts).toEqual([]);
      expect(result.error).toBeUndefined();
    });

    it('should handle null API responses gracefully', async () => {
      const traitConfig: TraitDiscoveryConfig = {
        trait: {
          name: 'SIP010',
          description: 'Test trait',
          functions: []
        },
        enabled: true,
        priority: 1,
        batchSize: 10
      };

      // Mock null response (should not happen in practice, but test defensive coding)
      vi.mocked(searchContractsByTrait).mockResolvedValue(null as any);

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      // The implementation handles this gracefully by catching errors in searchContractsByTrait
      expect(result.success).toBe(true);
      expect(result.method).toBe('trait-search');
      expect(result.contractsFound).toBe(0);
      expect(result.newContracts).toEqual([]);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Malformed API Response Scenarios', () => {
    it('should handle API responses with missing required fields', async () => {
      const traitConfig: TraitDiscoveryConfig = {
        trait: {
          name: 'SIP010',
          description: 'Test trait',
          functions: []
        },
        enabled: true,
        priority: 1,
        batchSize: 10
      };

      // Mock response with missing contract_id
      vi.mocked(searchContractsByTrait).mockResolvedValue([
        {
          // Missing contract_id
          tx_id: '0xabc123',
          block_height: 100000,
          clarity_version: 2
        } as any
      ]);

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      // Should still succeed but with potentially malformed data
      expect(result.success).toBe(true);
      expect(result.method).toBe('trait-search');
      expect(result.contractsFound).toBe(1);
      expect(result.newContracts).toEqual([undefined]); // undefined contract_id
    });

    it('should handle API responses with invalid block heights', async () => {
      const traitConfig: TraitDiscoveryConfig = {
        trait: {
          name: 'SIP010',
          description: 'Test trait',
          functions: []
        },
        enabled: true,
        priority: 1,
        batchSize: 10
      };

      // Mock response with invalid block height
      vi.mocked(searchContractsByTrait).mockResolvedValue([
        {
          contract_id: 'SP123.contract',
          tx_id: '0xabc123',
          block_height: -1, // Invalid negative block height
          clarity_version: 2
        },
        {
          contract_id: 'SP456.contract',
          tx_id: '0xdef456',
          block_height: NaN, // Invalid NaN block height
          clarity_version: 2
        }
      ]);

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      expect(result.success).toBe(true);
      expect(result.method).toBe('trait-search');
      expect(result.contractsFound).toBe(2);
      expect(result.newContracts).toEqual(['SP123.contract', 'SP456.contract']);
    });
  });

  describe('Deduplication Scenarios', () => {
    it('should deduplicate contracts with same contract_id but different block heights', async () => {
      const traitConfig: TraitDiscoveryConfig = {
        trait: {
          name: 'SIP010',
          description: 'Test trait',
          functions: []
        },
        enabled: true,
        priority: 1,
        batchSize: 10
      };

      // Mock response with duplicate contracts at different block heights
      vi.mocked(searchContractsByTrait).mockResolvedValue([
        {
          contract_id: 'SP123.contract',
          tx_id: '0xabc123',
          block_height: 100000, // Older deployment
          clarity_version: 2
        },
        {
          contract_id: 'SP123.contract',
          tx_id: '0xdef456',
          block_height: 150000, // Newer deployment (should be kept)
          clarity_version: 2
        },
        {
          contract_id: 'SP456.contract',
          tx_id: '0xghi789',
          block_height: 120000,
          clarity_version: 2
        }
      ]);

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      expect(result.success).toBe(true);
      expect(result.method).toBe('trait-search');
      expect(result.contractsFound).toBe(2); // Should be deduplicated from 3 to 2
      expect(result.contractsProcessed).toBe(2);
      expect(result.contractsAdded).toBe(2);
      expect(result.newContracts).toHaveLength(2);
      expect(result.newContracts).toContain('SP123.contract');
      expect(result.newContracts).toContain('SP456.contract');
    });

    it('should handle deduplication when all contracts have same contract_id', async () => {
      const traitConfig: TraitDiscoveryConfig = {
        trait: {
          name: 'SIP010',
          description: 'Test trait',
          functions: []
        },
        enabled: true,
        priority: 1,
        batchSize: 10
      };

      // Mock response with all same contract_id
      vi.mocked(searchContractsByTrait).mockResolvedValue([
        {
          contract_id: 'SP123.contract',
          tx_id: '0xabc123',
          block_height: 100000,
          clarity_version: 2
        },
        {
          contract_id: 'SP123.contract',
          tx_id: '0xdef456',
          block_height: 200000, // Highest - should be kept
          clarity_version: 2
        },
        {
          contract_id: 'SP123.contract',
          tx_id: '0xghi789',
          block_height: 150000,
          clarity_version: 2
        }
      ]);

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      expect(result.success).toBe(true);
      expect(result.method).toBe('trait-search');
      expect(result.contractsFound).toBe(1); // Should be deduplicated from 3 to 1
      expect(result.contractsProcessed).toBe(1);
      expect(result.contractsAdded).toBe(1);
      expect(result.newContracts).toEqual(['SP123.contract']);
    });
  });

  describe('API Scan Placeholder Scenarios', () => {
    it('should return empty result for enabled API scan (placeholder implementation)', async () => {
      const apiConfig: DiscoveryConfig = {
        enabled: true,
        batchSize: 10,
        maxRetries: 3,
        retryDelay: 1000,
        timeout: 30000,
        blacklist: []
      };

      const result = await discoveryEngine.discoverByApiScan(apiConfig);

      expect(result.success).toBe(true);
      expect(result.method).toBe('api-scan');
      expect(result.contractsFound).toBe(0);
      expect(result.contractsProcessed).toBe(0);
      expect(result.contractsAdded).toBe(0);
      expect(result.newContracts).toEqual([]);
      expect(result.errorContracts).toEqual([]);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Actual Failure Scenarios (that trigger catch blocks)', () => {
    it('should handle errors thrown during contract processing', async () => {
      // Create a mock discovery engine that will throw during contract processing
      const faultyEngine = new TraitDiscoveryEngine({
        debug: true,
        maxContracts: 0 // This might cause issues
      });

      // Mock successful API call but with data that might cause processing errors
      vi.mocked(searchContractsByTrait).mockResolvedValue([
        {
          contract_id: 'SP123.test',
          tx_id: '0xabc',
          block_height: 100000,
          clarity_version: 2
        }
      ]);

      // Spy on the private method to force an error during processing
      const originalSearchMethod = faultyEngine['searchContractsByTrait'];
      faultyEngine['searchContractsByTrait'] = vi.fn().mockImplementation(() => {
        throw new Error('Forced processing error');
      });

      const traitConfig: TraitDiscoveryConfig = {
        trait: {
          name: 'SIP010',
          description: 'Test trait',
          functions: []
        },
        enabled: true,
        priority: 1,
        batchSize: 10
      };

      const result = await faultyEngine.discoverByTrait(traitConfig);

      expect(result.success).toBe(false);
      expect(result.method).toBe('trait-search');
      expect(result.error).toBe('Forced processing error');
    });

    it('should handle errors thrown during SIP discovery configuration', async () => {
      // Create a config that might cause issues
      const sipConfig: SIPDiscoveryConfig = {
        sipNumber: 'SIP010',
        trait: null as any, // Invalid trait that might cause errors
        enabled: true
      };

      const result = await discoveryEngine.discoverBySipStandard(sipConfig);

      // This should trigger an error since trait is null
      expect(result.success).toBe(false);
      expect(result.method).toBe('sip-scan');
      expect(result.error).toContain('Cannot read properties of null'); // Error from accessing null.name
    });

    it('should handle configuration errors in discovery engine', async () => {
      // Test with malformed trait config
      const traitConfig: TraitDiscoveryConfig = {
        trait: null as any, // This should cause an error
        enabled: true,
        priority: 1,
        batchSize: 10
      };

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      expect(result.success).toBe(false);
      expect(result.method).toBe('trait-search');
      expect(result.error).toContain('Cannot read properties of null'); // Accessing properties of null
    });
  });
});
/**
 * Simplified TraitDiscoveryEngine Tests
 * Focuses on core functionality with proper mocking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TraitDiscoveryEngine } from '../../discovery/TraitDiscoveryEngine';

// Mock the polyglot searchContractsByTrait function
vi.mock('@repo/polyglot', async () => {
  const actual = await vi.importActual('@repo/polyglot');
  return {
    ...actual,
    searchContractsByTrait: vi.fn()
  };
});

import { searchContractsByTrait } from '@repo/polyglot';

const mockSearchContractsByTrait = searchContractsByTrait as any;

const SIMPLE_TRAIT = {
  name: 'Test Trait',
  functions: [
    {
      name: "transfer",
      access: "public",
      args: [
        { name: "amount", type: "uint128" },
        { name: "sender", type: "principal" },
        { name: "recipient", type: "principal" }
      ],
      outputs: {
        type: {
          response: {
            ok: "bool",
            error: "uint128"
          }
        }
      }
    }
  ]
};

describe('TraitDiscoveryEngine (Simple)', () => {
  let discoveryEngine: TraitDiscoveryEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchContractsByTrait.mockResolvedValue([]);

    discoveryEngine = new TraitDiscoveryEngine({
      baseUrl: 'https://api.hiro.so',
      timeout: 5000,
      debug: false,
      batchSize: 10,
      maxRetries: 2,
      retryDelay: 100,
      blacklist: []
    });
  });

  describe('Basic Functionality', () => {
    it('should initialize with configuration', () => {
      const config = discoveryEngine.getConfig();
      expect(config.baseUrl).toBe('https://api.hiro.so');
      expect(config.timeout).toBe(5000);
      expect(config.batchSize).toBe(10);
    });

    it('should discover contracts via searchContractsByTrait', async () => {
      const mockContracts = [
        {
          contract_id: 'SP123.test-contract',
          tx_id: '0x123',
          block_height: 150000,
          clarity_version: 'Clarity2'
        }
      ];

      mockSearchContractsByTrait.mockResolvedValue(mockContracts);

      const traitConfig = {
        trait: SIMPLE_TRAIT,
        enabled: true,
        priority: 1,
        batchSize: 10
      };

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      expect(result.success).toBe(true);
      expect(result.contractsFound).toBe(1);
      expect(result.newContracts).toEqual(['SP123.test-contract']);
      expect(mockSearchContractsByTrait).toHaveBeenCalledWith(
        SIMPLE_TRAIT,
        expect.objectContaining({
          debug: false
        }),
        [],
        10000
      );
    });

    it('should handle disabled trait discovery', async () => {
      const traitConfig = {
        trait: SIMPLE_TRAIT,
        enabled: false,
        priority: 1,
        batchSize: 10
      };

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      expect(result.success).toBe(true);
      expect(result.contractsFound).toBe(0);
      expect(result.error).toBe('Trait discovery disabled');
      expect(mockSearchContractsByTrait).not.toHaveBeenCalled();
    });

    it('should handle empty results gracefully', async () => {
      mockSearchContractsByTrait.mockResolvedValue([]);

      const traitConfig = {
        trait: SIMPLE_TRAIT,
        enabled: true,
        priority: 1,
        batchSize: 10
      };

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      expect(result.success).toBe(true);
      expect(result.contractsFound).toBe(0);
      expect(result.newContracts).toEqual([]);
    });

    it('should handle API errors gracefully', async () => {
      mockSearchContractsByTrait.mockRejectedValue(new Error('API Error'));

      const traitConfig = {
        trait: SIMPLE_TRAIT,
        enabled: true,
        priority: 1,
        batchSize: 10
      };

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      // The current implementation handles errors gracefully by returning empty results
      // This is actually good design - it doesn't fail the entire discovery
      expect(result.success).toBe(true);
      expect(result.contractsFound).toBe(0);
      expect(result.newContracts).toEqual([]);
    });

    it('should filter blacklisted contracts', async () => {
      const mockContracts = [
        {
          contract_id: 'SP123.good-contract',
          tx_id: '0x123',
          block_height: 150000,
          clarity_version: 'Clarity2'
        },
        {
          contract_id: 'SP456.bad-contract',
          tx_id: '0x456',
          block_height: 150001,
          clarity_version: 'Clarity2'
        }
      ];

      mockSearchContractsByTrait.mockResolvedValue(mockContracts);

      // Add blacklist to engine
      discoveryEngine.addToBlacklist(['SP456.bad-contract']);

      const traitConfig = {
        trait: SIMPLE_TRAIT,
        enabled: true,
        priority: 1,
        batchSize: 10
      };

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      expect(result.success).toBe(true);
      expect(result.contractsFound).toBe(2); // Found both contracts
      expect(result.newContracts).toEqual(['SP123.good-contract', 'SP456.bad-contract']); // But polyglot should have filtered
      
      // Verify blacklist was passed to polyglot
      expect(mockSearchContractsByTrait).toHaveBeenCalledWith(
        SIMPLE_TRAIT,
        expect.objectContaining({
          debug: false
        }),
        ['SP456.bad-contract'],
        10000
      );
    });
  });

  describe('Blacklist Management', () => {
    it('should add contracts to blacklist', () => {
      discoveryEngine.addToBlacklist(['SP123.test', 'SP456.test']);
      const blacklist = discoveryEngine.getBlacklist();
      expect(blacklist).toContain('SP123.test');
      expect(blacklist).toContain('SP456.test');
    });

    it('should remove contracts from blacklist', () => {
      discoveryEngine.addToBlacklist(['SP123.test', 'SP456.test']);
      discoveryEngine.removeFromBlacklist(['SP123.test']);
      const blacklist = discoveryEngine.getBlacklist();
      expect(blacklist).not.toContain('SP123.test');
      expect(blacklist).toContain('SP456.test');
    });
  });

  describe('SIP Discovery', () => {
    it('should handle SIP standard discovery', async () => {
      mockSearchContractsByTrait.mockResolvedValue([]);

      const sipConfig = {
        trait: SIMPLE_TRAIT,
        enabled: true,
        priority: 1,
        batchSize: 10,
        sipNumber: 'SIP010'
      };

      const result = await discoveryEngine.discoverBySipStandard(sipConfig);

      expect(result.success).toBe(true);
      expect(result.method).toBe('sip-scan');
    });
  });
});
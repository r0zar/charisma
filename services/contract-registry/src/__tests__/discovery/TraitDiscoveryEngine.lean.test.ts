/**
 * TraitDiscoveryEngine Lean Tests
 * Essential async functionality tests with minimal memory footprint
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

// Minimal trait and mock data - using correct API format
const MINIMAL_TRAIT = {
  name: 'Transfer Function',
  description: 'Minimal transfer function trait',
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
const SAMPLE_CONTRACT_ID = 'SP123.token';

describe('TraitDiscoveryEngine (Lean)', () => {
  let discoveryEngine: TraitDiscoveryEngine;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    mockSearchContractsByTrait.mockResolvedValue([]);

    // Create engine with minimal config
    discoveryEngine = new TraitDiscoveryEngine({
      baseUrl: 'https://api.hiro.so',
      timeout: 1000,
      debug: false,
      batchSize: 1,
      maxRetries: 1,
      retryDelay: 10,
      blacklist: []
    });
  });

  describe('Trait Discovery', () => {
    it('should handle successful trait discovery', async () => {
      const mockContracts = [{
        contract_id: SAMPLE_CONTRACT_ID,
        tx_id: '0x123',
        block_height: 150000,
        clarity_version: 'Clarity2'
      }];

      mockSearchContractsByTrait.mockResolvedValue(mockContracts);

      const traitConfig = {
        trait: MINIMAL_TRAIT,
        enabled: true,
        priority: 1,
        batchSize: 1
      };

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      expect(result.success).toBe(true);
      expect(result.contractsFound).toBe(1);
      expect(result.newContracts).toEqual([SAMPLE_CONTRACT_ID]);
    });

    it('should handle disabled trait discovery', async () => {
      const traitConfig = {
        trait: MINIMAL_TRAIT,
        enabled: false,
        priority: 1,
        batchSize: 1
      };

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      expect(result.success).toBe(true);
      expect(result.error).toBe('Trait discovery disabled');
      expect(mockSearchContractsByTrait).not.toHaveBeenCalled();
    });

    it('should handle empty API response', async () => {
      mockSearchContractsByTrait.mockResolvedValue([]);

      const traitConfig = {
        trait: MINIMAL_TRAIT,
        enabled: true,
        priority: 1,
        batchSize: 1
      };

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      expect(result.success).toBe(true);
      expect(result.contractsFound).toBe(0);
      expect(result.newContracts).toEqual([]);
    });

    it('should handle API errors gracefully', async () => {
      mockSearchContractsByTrait.mockRejectedValue(new Error('Network error'));

      const traitConfig = {
        trait: MINIMAL_TRAIT,
        enabled: true,
        priority: 1,
        batchSize: 1
      };

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      // TraitDiscoveryEngine catches errors in searchContractsByTrait and continues
      // This results in an empty results array but success: true
      expect(result.success).toBe(true);
      expect(result.contractsFound).toBe(0);
      expect(result.newContracts).toEqual([]);
    });
  });

  describe('SIP Discovery', () => {
    it('should handle SIP discovery', async () => {
      mockSearchContractsByTrait.mockResolvedValue([]);

      const sipConfig = {
        sipNumber: 'SIP010',
        trait: MINIMAL_TRAIT,
        enabled: true
      };

      const result = await discoveryEngine.discoverBySipStandard(sipConfig);

      expect(result.success).toBe(true);
      expect(result.method).toBe('sip-scan');
    });
  });

  describe('API Scan', () => {
    it('should handle API scan', async () => {
      const config = {
        enabled: true,
        batchSize: 1,
        maxRetries: 1,
        retryDelay: 10,
        timeout: 1000,
        blacklist: []
      };

      const result = await discoveryEngine.discoverByApiScan(config);

      expect(result.success).toBe(true);
      expect(result.method).toBe('api-scan');
    });
  });
});
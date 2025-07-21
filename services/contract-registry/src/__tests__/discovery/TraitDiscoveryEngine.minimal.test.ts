/**
 * TraitDiscoveryEngine Minimal Tests
 * Essential functionality tests to avoid memory issues
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TraitDiscoveryEngine } from '../../discovery/TraitDiscoveryEngine';
import { SAMPLE_CONTRACT_IDS, ERROR_SCENARIOS } from '../fixtures/test-fixtures';

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

// Very minimal ABI for testing - using correct API format
const MINIMAL_ABI = {
  name: 'Minimal Transfer Trait',
  description: 'Basic transfer function for testing',
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

describe('TraitDiscoveryEngine (Essential)', () => {
  let discoveryEngine: TraitDiscoveryEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchContractsByTrait.mockResolvedValue([]);

    discoveryEngine = new TraitDiscoveryEngine({
      baseUrl: 'https://api.hiro.so',
      timeout: 5000,
      debug: false,
      batchSize: 2, // Very small batch size
      maxRetries: 1,
      retryDelay: 100,
      blacklist: []
    });
  });

  describe('Core Functionality', () => {
    it('should initialize with configuration', () => {
      const engine = new TraitDiscoveryEngine();
      expect(engine.getConfig().baseUrl).toBe('https://api.hiro.so');
    });

    it('should discover contracts via trait search', async () => {
      const mockContracts = [{
        contract_id: SAMPLE_CONTRACT_IDS.SIP010_TOKEN,
        tx_id: '0x123',
        block_height: 150000,
        clarity_version: 'Clarity2'
      }];

      mockSearchContractsByTrait.mockResolvedValue(mockContracts);

      const traitConfig = {
        trait: MINIMAL_ABI,
        enabled: true,
        priority: 1,
        batchSize: 2
      };

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      expect(result.success).toBe(true);
      expect(result.contractsFound).toBe(1);
      expect(result.newContracts).toEqual([SAMPLE_CONTRACT_IDS.SIP010_TOKEN]);
    });

    it('should handle disabled discovery', async () => {
      const traitConfig = {
        trait: MINIMAL_ABI,
        enabled: false,
        priority: 1,
        batchSize: 2
      };

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      expect(result.success).toBe(true);
      expect(result.error).toBe('Trait discovery disabled');
      expect(mockSearchContractsByTrait).not.toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      mockSearchContractsByTrait.mockRejectedValue(ERROR_SCENARIOS.NETWORK_ERROR);

      const traitConfig = {
        trait: MINIMAL_ABI,
        enabled: true,
        priority: 1,
        batchSize: 2
      };

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      // New resilient behavior: API errors are handled gracefully
      expect(result.success).toBe(true);
      expect(result.contractsFound).toBe(0);
      expect(result.newContracts).toEqual([]);
    });

    it('should manage blacklist', () => {
      discoveryEngine.addToBlacklist(['SP123.malicious']);
      const blacklist = discoveryEngine.getBlacklist();
      expect(blacklist).toEqual(['SP123.malicious']);

      discoveryEngine.removeFromBlacklist(['SP123.malicious']);
      const updatedBlacklist = discoveryEngine.getBlacklist();
      expect(updatedBlacklist).toEqual([]);
    });

    it('should handle SIP discovery', async () => {
      mockSearchContractsByTrait.mockResolvedValue([]);

      const sipConfig = {
        sipNumber: 'SIP010',
        trait: MINIMAL_ABI,
        enabled: true
      };

      const result = await discoveryEngine.discoverBySipStandard(sipConfig);

      expect(result.success).toBe(true);
      expect(result.method).toBe('sip-scan');
    });

    it('should handle API scan', async () => {
      const config = {
        enabled: true,
        batchSize: 2,
        maxRetries: 1,
        retryDelay: 100,
        timeout: 5000,
        blacklist: []
      };

      const result = await discoveryEngine.discoverByApiScan(config);

      expect(result.success).toBe(true);
      expect(result.method).toBe('api-scan');
    });
  });
});
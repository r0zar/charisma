/**
 * TraitDiscoveryEngine Integration Tests
 * Tests real API interactions with Hiro blockchain API
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TraitDiscoveryEngine } from '../../discovery/TraitDiscoveryEngine';
import { integrationUtils, integrationConfig } from '../setup';
import { isValidContractId } from '../../utils/validators';

// Real SIP-010 trait for testing - using correct API format discovered through testing
const SIP010_TRAIT = {
  name: 'SIP010',
  description: 'Standard Fungible Token (SIP010)',
  functions: [
    {
      name: "transfer",
      access: "public",
      args: [
        { name: "amount", type: "uint128" },
        { name: "sender", type: "principal" },
        { name: "recipient", type: "principal" },
        { name: "memo", type: { optional: { buffer: { length: 34 } } } }
      ],
      outputs: {
        type: {
          response: {
            ok: "bool",
            error: "uint128"
          }
        }
      }
    },
    {
      name: "get-name",
      access: "read_only",
      args: [],
      outputs: {
        type: {
          response: {
            ok: { "string-ascii": { length: 32 } },
            error: "none"
          }
        }
      }
    },
    {
      name: "get-symbol",
      access: "read_only",
      args: [],
      outputs: {
        type: {
          response: {
            ok: { "string-ascii": { length: 32 } },
            error: "none"
          }
        }
      }
    },
    {
      name: "get-decimals",
      access: "read_only",
      args: [],
      outputs: {
        type: {
          response: {
            ok: "uint128",
            error: "none"
          }
        }
      }
    },
    {
      name: "get-balance",
      access: "read_only",
      args: [{ name: "account", type: "principal" }],
      outputs: {
        type: {
          response: {
            ok: "uint128",
            error: "none"
          }
        }
      }
    },
    {
      name: "get-total-supply",
      access: "read_only",
      args: [],
      outputs: {
        type: {
          response: {
            ok: "uint128",
            error: "none"
          }
        }
      }
    }
  ]
};

describe('TraitDiscoveryEngine Integration Tests', () => {
  let discoveryEngine: TraitDiscoveryEngine;

  beforeEach(() => {
    // Skip if missing required environment variables
    if (integrationUtils.shouldSkipIntegrationTest(['HIRO_API_KEY'])) {
      console.warn('⏭️  Skipping TraitDiscoveryEngine integration tests - HIRO_API_KEY not set');
      return;
    }

    discoveryEngine = new TraitDiscoveryEngine({
      apiKey: integrationConfig.hiro.apiKey,
      baseUrl: integrationConfig.hiro.baseUrl,
      timeout: 30000,
      debug: true,
      batchSize: 5, // Small batch for testing
      maxRetries: 3,
      retryDelay: 2000,
      blacklist: [],
      maxContracts: 20 // Limit for testing
    });
  });

  describe('Real API Discovery', () => {
    it('should discover actual SIP-010 token contracts from mainnet', async () => {
      integrationUtils.skipIfMissingEnv(['HIRO_API_KEY'], 'SIP-010 discovery');

      const traitConfig = {
        trait: SIP010_TRAIT,
        enabled: true,
        priority: 1,
        batchSize: 5
      };

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      // Should find real contracts
      expect(result.success).toBe(true);
      expect(result.method).toBe('trait-search');
      expect(result.contractsFound).toBeGreaterThan(0);
      expect(result.newContracts.length).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);

      // Validate contract ID format
      result.newContracts.forEach((contractId: string) => {
        console.log(`Discovered contract: ${contractId}`);
        expect(isValidContractId(contractId)).toBe(true);
      });

      console.log(`✅ Found ${result.contractsFound} SIP-010 contracts in ${result.duration}ms`);
      console.log(`📜 Sample contracts:`, result.newContracts.slice(0, 3));
    }, 60000);

    it('should discover real SIP standard implementations', async () => {
      integrationUtils.skipIfMissingEnv(['HIRO_API_KEY'], 'SIP standard discovery');

      const sipConfig = {
        sipNumber: 'SIP010',
        trait: SIP010_TRAIT,
        enabled: true
      };

      const result = await integrationUtils.retryOperation(async () => {
        return await discoveryEngine.discoverBySipStandard(sipConfig);
      });

      expect(result.success).toBe(true);
      expect(result.method).toBe('sip-scan');
      expect(result.contractsFound).toBeGreaterThan(0);

      console.log(`✅ SIP-010 scan found ${result.contractsFound} contracts`);
    }, 60000);

    it('should respect maxContracts limit with real data', async () => {
      integrationUtils.skipIfMissingEnv(['HIRO_API_KEY'], 'contract limit test');

      // Create engine with very low contract limit
      const limitedEngine = new TraitDiscoveryEngine({
        apiKey: integrationConfig.hiro.apiKey,
        baseUrl: integrationConfig.hiro.baseUrl,
        timeout: 30000,
        debug: true,
        batchSize: 5,
        maxContracts: 3 // Very low limit
      });

      const traitConfig = {
        trait: SIP010_TRAIT,
        enabled: true,
        priority: 1,
        batchSize: 5
      };

      const result = await limitedEngine.discoverByTrait(traitConfig);

      expect(result.success).toBe(true);
      expect(result.contractsProcessed).toBeLessThanOrEqual(3);
      expect(result.newContracts.length).toBeLessThanOrEqual(3);

      console.log(`✅ Contract limit respected: processed ${result.contractsProcessed}/3 max`);
    }, 60000);
  });

  describe('Real API Error Handling', () => {
    it('should handle invalid API key gracefully', async () => {
      const invalidEngine = new TraitDiscoveryEngine({
        apiKey: 'invalid-api-key',
        baseUrl: integrationConfig.hiro.baseUrl,
        timeout: 10000,
        debug: true,
        batchSize: 1
      });

      const traitConfig = {
        trait: SIP010_TRAIT,
        enabled: true,
        priority: 1,
        batchSize: 1
      };

      const result = await invalidEngine.discoverByTrait(traitConfig);

      // Should handle auth error gracefully
      expect(result.success).toBe(true); // Resilient error handling

      console.log(`✅ Invalid API key handled gracefully`);
    }, 30000);

    it('should handle invalid API endpoint', async () => {
      const invalidEngine = new TraitDiscoveryEngine({
        apiKey: integrationConfig.hiro.apiKey,
        baseUrl: 'https://invalid-api-endpoint.com',
        timeout: 5000,
        debug: true,
        batchSize: 1
      });

      const traitConfig = {
        trait: SIP010_TRAIT,
        enabled: true,
        priority: 1,
        batchSize: 1
      };

      const result = await invalidEngine.discoverByTrait(traitConfig);

      // Should handle network error gracefully
      expect(result.success).toBe(true); // Resilient error handling

      console.log(`✅ Invalid endpoint handled gracefully`);
    }, 15000);
  });

  describe('Real Data Validation', () => {
    it('should validate real contract data structure', async () => {
      integrationUtils.skipIfMissingEnv(['HIRO_API_KEY'], 'data validation');

      const traitConfig = {
        trait: SIP010_TRAIT,
        enabled: true,
        priority: 1,
        batchSize: 3
      };

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      if (result.contractsFound > 0) {
        // Validate that we get real contract IDs
        expect(isValidContractId(result.newContracts[0])).toBe(true);

        // Check result structure
        expect(result).toMatchObject({
          success: true,
          method: 'trait-search',
          timestamp: expect.any(Number),
          duration: expect.any(Number),
          contractsFound: expect.any(Number),
          contractsProcessed: expect.any(Number),
          contractsAdded: expect.any(Number),
          contractsUpdated: expect.any(Number),
          contractsSkipped: expect.any(Number),
          contractsErrored: expect.any(Number),
          newContracts: expect.any(Array),
          errorContracts: expect.any(Array)
        });

        console.log(`✅ Real data validation passed for ${result.contractsFound} contracts`);
      } else {
        console.log(`⚠️  No contracts found for validation (API might be empty)`);
      }
    }, 45000);
  });
});
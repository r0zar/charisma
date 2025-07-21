/**
 * Integration tests for specific trait search patterns
 * 
 * Tests various function patterns like transfers, token URIs, minting, etc.
 * to understand the Stacks ecosystem and validate our trait discovery capabilities.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TraitDiscoveryEngine } from '../../discovery/TraitDiscoveryEngine';
import { integrationUtils, integrationConfig } from '../setup';

// Trait definitions for specific function patterns
const TRAIT_PATTERNS = {
  // Standard transfer function (core of most token contracts)
  TRANSFER_ONLY: {
    name: 'Transfer Function',
    description: 'Contracts with standard transfer functionality',
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
      }
    ]
  },

  // Token URI functionality (common in NFT-like contracts)
  TOKEN_URI: {
    name: 'Token URI Functions',
    description: 'Contracts with token URI getter/setter functionality',
    functions: [
      {
        name: "get-token-uri",
        access: "read_only",
        args: [],
        outputs: {
          type: {
            response: {
              ok: { optional: { "string-utf8": { length: 256 } } },
              error: "none"
            }
          }
        }
      },
      {
        name: "set-token-uri",
        access: "public",
        args: [
          { name: "value", type: { "string-utf8": { length: 256 } } }
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
  },

  // Basic metadata functions
  METADATA_BASICS: {
    name: 'Basic Metadata Functions',
    description: 'Contracts with name and symbol getters',
    functions: [
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
      }
    ]
  },

  // Minting functionality
  MINT_FUNCTION: {
    name: 'Mint Functions',
    description: 'Contracts with minting capabilities',
    functions: [
      {
        name: "mint",
        access: "public",
        args: [
          { name: "amount", type: "uint128" },
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
  },

  // Burning functionality
  BURN_FUNCTION: {
    name: 'Burn Functions',
    description: 'Contracts with burning capabilities',
    functions: [
      {
        name: "burn",
        access: "public",
        args: [
          { name: "amount", type: "uint128" },
          { name: "sender", type: "principal" }
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
  },

  // NFT-style ownership functions
  NFT_OWNERSHIP: {
    name: 'NFT Ownership Functions',
    description: 'Contracts with NFT-style get-owner functionality',
    functions: [
      {
        name: "get-owner",
        access: "read_only",
        args: [{ name: "id", type: "uint128" }],
        outputs: {
          type: {
            response: {
              ok: { optional: "principal" },
              error: "uint128"
            }
          }
        }
      }
    ]
  },

  // Staking functionality
  STAKING_FUNCTIONS: {
    name: 'Staking Functions',
    description: 'Contracts with staking/unstaking functionality',
    functions: [
      {
        name: "stake",
        access: "public",
        args: [
          { name: "amount", type: "uint128" }
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
        name: "unstake",
        access: "public",
        args: [
          { name: "amount", type: "uint128" }
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
  }
};

describe('Specific Trait Searches Integration Tests', () => {
  let discoveryEngine: TraitDiscoveryEngine;

  beforeEach(() => {
    // Skip if missing required environment variables
    if (integrationUtils.shouldSkipIntegrationTest(['HIRO_API_KEY'])) {
      console.warn('⏭️  Skipping specific trait search integration tests - HIRO_API_KEY not set');
      return;
    }

    discoveryEngine = new TraitDiscoveryEngine({
      apiKey: integrationConfig.hiro.apiKey,
      baseUrl: integrationConfig.hiro.baseUrl,
      timeout: 15000, // Shorter timeout for faster tests
      debug: false, // Reduce logging for faster tests
      batchSize: 10, // Smaller batches for faster responses
      maxContracts: 5 // Very small limit for faster testing
    });
  });

  describe('Token Contract Patterns', () => {
    it.concurrent('should discover contracts with transfer functionality', async () => {
      const traitConfig = {
        trait: TRAIT_PATTERNS.TRANSFER_ONLY,
        enabled: true,
        priority: 1,
        batchSize: 10
      };

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      expect(result.success).toBe(true);
      expect(result.method).toBe('trait-search');
      expect(result.contractsFound).toBeGreaterThan(0);
      expect(result.newContracts.length).toBeGreaterThan(0);
      
      console.log(`✅ Transfer pattern: Found ${result.contractsFound} contracts`);
      console.log(`📄 Sample contracts: ${result.newContracts.slice(0, 3).join(', ')}`);
    }, 30000);

    it.concurrent('should discover contracts with token URI functionality', async () => {
      const traitConfig = {
        trait: TRAIT_PATTERNS.TOKEN_URI,
        enabled: true,
        priority: 1,
        batchSize: 10
      };

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      expect(result.success).toBe(true);
      expect(result.contractsFound).toBeGreaterThan(0);
      
      console.log(`✅ Token URI pattern: Found ${result.contractsFound} contracts`);
      console.log(`📄 Sample contracts: ${result.newContracts.slice(0, 3).join(', ')}`);
    }, 30000);

    it.concurrent('should discover contracts with basic metadata functions', async () => {
      const traitConfig = {
        trait: TRAIT_PATTERNS.METADATA_BASICS,
        enabled: true,
        priority: 1,
        batchSize: 10
      };

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      expect(result.success).toBe(true);
      expect(result.contractsFound).toBeGreaterThan(0);
      
      console.log(`✅ Metadata basics pattern: Found ${result.contractsFound} contracts`);
      console.log(`📄 Sample contracts: ${result.newContracts.slice(0, 3).join(', ')}`);
    }, 30000);
  });

  describe('DeFi Contract Patterns', () => {
    it.concurrent('should discover contracts with minting functionality', async () => {
      const traitConfig = {
        trait: TRAIT_PATTERNS.MINT_FUNCTION,
        enabled: true,
        priority: 1,
        batchSize: 10
      };

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      expect(result.success).toBe(true);
      
      if (result.contractsFound > 0) {
        console.log(`✅ Mint pattern: Found ${result.contractsFound} contracts`);
        console.log(`📄 Sample contracts: ${result.newContracts.slice(0, 3).join(', ')}`);
      } else {
        console.log(`ℹ️  No contracts found with exact mint function signature`);
      }
    }, 30000);

    it.concurrent('should discover contracts with burning functionality', async () => {
      const traitConfig = {
        trait: TRAIT_PATTERNS.BURN_FUNCTION,
        enabled: true,
        priority: 1,
        batchSize: 10
      };

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      expect(result.success).toBe(true);
      
      if (result.contractsFound > 0) {
        console.log(`✅ Burn pattern: Found ${result.contractsFound} contracts`);
        console.log(`📄 Sample contracts: ${result.newContracts.slice(0, 3).join(', ')}`);
      } else {
        console.log(`ℹ️  No contracts found with exact burn function signature`);
      }
    }, 30000);

    it.concurrent('should discover contracts with staking functionality', async () => {
      const traitConfig = {
        trait: TRAIT_PATTERNS.STAKING_FUNCTIONS,
        enabled: true,
        priority: 1,
        batchSize: 10
      };

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      expect(result.success).toBe(true);
      
      if (result.contractsFound > 0) {
        console.log(`✅ Staking pattern: Found ${result.contractsFound} contracts`);
        console.log(`📄 Sample contracts: ${result.newContracts.slice(0, 3).join(', ')}`);
      } else {
        console.log(`ℹ️  No contracts found with exact staking function signatures`);
      }
    }, 30000);
  });

  describe('NFT Contract Patterns', () => {
    it.concurrent('should discover contracts with NFT ownership functions', async () => {
      const traitConfig = {
        trait: TRAIT_PATTERNS.NFT_OWNERSHIP,
        enabled: true,
        priority: 1,
        batchSize: 10
      };

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      expect(result.success).toBe(true);
      
      if (result.contractsFound > 0) {
        console.log(`✅ NFT ownership pattern: Found ${result.contractsFound} contracts`);
        console.log(`📄 Sample contracts: ${result.newContracts.slice(0, 3).join(', ')}`);
      } else {
        console.log(`ℹ️  No contracts found with exact NFT ownership function signature`);
      }
    }, 30000);
  });

  describe('Pattern Comparison and Analysis', () => {
    it('should compare different trait patterns and provide ecosystem insights', async () => {
      const patterns = [
        { name: 'Transfer', trait: TRAIT_PATTERNS.TRANSFER_ONLY },
        { name: 'Metadata', trait: TRAIT_PATTERNS.METADATA_BASICS },
        { name: 'Token URI', trait: TRAIT_PATTERNS.TOKEN_URI },
        { name: 'Mint', trait: TRAIT_PATTERNS.MINT_FUNCTION }
      ];

      // Run all pattern searches concurrently for much faster execution
      const searchPromises = patterns.map(async pattern => {
        const traitConfig = {
          trait: pattern.trait,
          enabled: true,
          priority: 1,
          batchSize: 10
        };

        const result = await discoveryEngine.discoverByTrait(traitConfig);
        
        return {
          name: pattern.name,
          count: result.contractsFound,
          contracts: result.newContracts.slice(0, 2) // Top 2 for comparison
        };
      });

      const results = await Promise.all(searchPromises);

      // Sort by count (most to least)
      results.sort((a, b) => b.count - a.count);

      console.log('\n📊 ECOSYSTEM TRAIT ANALYSIS');
      console.log('=' .repeat(50));
      
      for (const result of results) {
        const percentage = results[0].count > 0 ? ((result.count / results[0].count) * 100).toFixed(1) : '0';
        console.log(`${result.name.padEnd(12)} | ${result.count.toString().padStart(6)} contracts (${percentage}%)`);
      }

      console.log('\n🎯 INSIGHTS:');
      
      const transferCount = results.find(r => r.name === 'Transfer')?.count || 0;
      const metadataCount = results.find(r => r.name === 'Metadata')?.count || 0;
      const uriCount = results.find(r => r.name === 'Token URI')?.count || 0;
      const mintCount = results.find(r => r.name === 'Mint')?.count || 0;

      if (transferCount > 5) {
        console.log('  ✅ Active token ecosystem');
      }
      
      if (uriCount > 3) {
        console.log('  ✅ NFT/metadata ecosystem present');
      }

      if (mintCount > 1) {
        console.log('  ✅ Minting/DeFi ecosystem present');
      }

      const metadataRatio = metadataCount > 0 ? transferCount / metadataCount : 0;
      if (metadataRatio < 5) {
        console.log('  ✅ Good metadata adoption rate');
      }

      // Ensure we found some contracts
      expect(transferCount).toBeGreaterThan(0);
      expect(results.length).toBe(4);
      
    }, 60000); // 1 minute timeout for parallel analysis
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle trait patterns with no matches gracefully', async () => {
      // Create a very specific trait that likely won't match anything
      const impossibleTrait = {
        name: 'Impossible Trait',
        description: 'A trait that should not match any contracts',
        functions: [
          {
            name: "this-function-does-not-exist-anywhere",
            access: "public",
            args: [
              { name: "impossible-arg", type: "impossible-type" }
            ],
            outputs: {
              type: {
                response: {
                  ok: "impossible-return-type",
                  error: "uint128"
                }
              }
            }
          }
        ]
      };

      const traitConfig = {
        trait: impossibleTrait,
        enabled: true,
        priority: 1,
        batchSize: 50
      };

      const result = await discoveryEngine.discoverByTrait(traitConfig);

      expect(result.success).toBe(true);
      expect(result.contractsFound).toBe(0);
      expect(result.newContracts.length).toBe(0);
      
      console.log(`✅ Impossible trait correctly returned 0 contracts`);
    }, 60000);

    it('should respect maxContracts limit', async () => {
      // Use a limited discovery engine
      const limitedEngine = new TraitDiscoveryEngine({
        apiKey: integrationConfig.hiro.apiKey,
        baseUrl: integrationConfig.hiro.baseUrl,
        timeout: 60000,
        debug: true,
        batchSize: 50,
        maxContracts: 10 // Very small limit
      });

      const traitConfig = {
        trait: TRAIT_PATTERNS.TRANSFER_ONLY, // Known to have many results
        enabled: true,
        priority: 1,
        batchSize: 50
      };

      const result = await limitedEngine.discoverByTrait(traitConfig);

      expect(result.success).toBe(true);
      expect(result.contractsProcessed).toBeLessThanOrEqual(10);
      expect(result.newContracts.length).toBeLessThanOrEqual(10);
      
      console.log(`✅ Contract limit respected: processed ${result.contractsProcessed}/10 max`);
    }, 60000);
  });
});
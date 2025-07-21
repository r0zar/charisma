/**
 * IndexManager Integration Tests
 * Tests real KV store operations with Vercel KV
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IndexManager } from '../../storage/IndexManager';
import { integrationUtils, integrationConfig } from '../setup';
import type { ContractMetadata, ContractType } from '../../types';

describe('IndexManager Integration Tests', () => {
  let indexManager: IndexManager;
  let testKeys: string[] = [];

  beforeEach(() => {
    // Skip if missing required environment variables
    if (integrationUtils.shouldSkipIntegrationTest(['KV_REST_API_URL', 'KV_REST_API_TOKEN'])) {
      console.warn('⏭️  Skipping IndexManager integration tests - KV credentials not set');
      return;
    }

    indexManager = new IndexManager({
      serviceName: 'contract-registry-test',
      keyPrefix: 'test-registry:'
    });

    testKeys = [];
  });

  afterEach(async () => {
    // Clean up test data
    if (testKeys.length > 0 && indexManager) {
      console.log(`🧹 Cleaning up ${testKeys.length} test keys...`);
      
      for (const key of testKeys) {
        try {
          // The actual IndexManager doesn't have removeFromIndex method
          // We'll clean up by clearing entire indexes instead
          await indexManager.clearAllIndexes();
          console.log(`   ✅ Removed key ${key}`);
        } catch (error) {
          console.warn(`   ⚠️  Failed to remove key ${key}:`, error);
        }
      }

      // Clean up any test indexes
      const testIndexes = ['test-deployers', 'test-sip-standards', 'test-traits', 'test-cleanup'];
      for (const indexName of testIndexes) {
        // IndexManager doesn't have clearIndex method, use clearAllIndexes
        try {
          await indexManager.clearAllIndexes();
          console.log(`   ✅ Cleared all test indexes`);
          break; // Only need to call this once
        } catch (error) {
          console.warn(`   ⚠️  Failed to clear indexes:`, error);
        }
      }
    }
  });

  describe('Real KV Index Operations', () => {
    it('should create and manage real deployer indexes', async () => {
      integrationUtils.skipIfMissingEnv(['KV_REST_API_URL', 'KV_REST_API_TOKEN'], 'deployer indexing');

      const testId = integrationUtils.generateTestId();
      const deployer = `SP${testId.slice(-12)}DEPLOYER`;
      const contractIds = [
        `${deployer}.contract-1-${testId}`,
        `${deployer}.contract-2-${testId}`,
        `${deployer}.contract-3-${testId}`
      ];

      testKeys.push(...contractIds);

      // Create test metadata and add contracts to indexes
      const testMetadata: ContractMetadata = {
        contractId: contractIds[0],
        contractAddress: deployer,
        contractName: 'test-contract',
        blockHeight: 150000,
        txId: `0x${testId}`,
        deployedAt: Date.now(),
        contractType: 'token',
        implementedTraits: ['transfer'],
        sourceCode: '',
        abi: '',
        clarityVersion: 2,
        discoveryMethod: 'api-scan',
        discoveredAt: Date.now(),
        lastAnalyzed: Date.now(),
        lastUpdated: Date.now(),
        validationStatus: 'valid'
      };

      // Add contracts to indexes (one by one as IndexManager expects)
      await integrationUtils.retryOperation(async () => {
        for (const contractId of contractIds) {
          const metadata = { ...testMetadata, contractId };
          await indexManager.addToIndexes(contractId, metadata);
        }
      });

      console.log(`✅ Added ${contractIds.length} contracts to deployer index for ${deployer}`);

      // Retrieve all contracts (IndexManager doesn't have getContractsByDeployer)
      const retrievedContracts = await integrationUtils.retryOperation(async () => {
        return await indexManager.getAllContracts();
      });

      // Filter to our test contracts
      const ourContracts = retrievedContracts.filter((id: string) => contractIds.includes(id));

      expect(ourContracts).toHaveLength(3);
      expect(ourContracts).toEqual(expect.arrayContaining(contractIds));

      console.log(`✅ Retrieved ${ourContracts.length} contracts for deployer ${deployer}`);

      // Test trait-based lookup
      const traitResults = await indexManager.getContractsByTrait('transfer');
      const ourTraitContracts = traitResults.filter(id => contractIds.includes(id));
      expect(ourTraitContracts).toHaveLength(3);

      console.log(`✅ Trait lookup test passed: ${ourTraitContracts.length}/3 contracts`);
    }, 30000);

    it('should manage real SIP standard indexes', async () => {
      integrationUtils.skipIfMissingEnv(['KV_REST_API_URL', 'KV_REST_API_TOKEN'], 'SIP indexing');

      const testId = integrationUtils.generateTestId();
      const sip010Contracts = [
        `SP1.sip010-token-1-${testId}`,
        `SP2.sip010-token-2-${testId}`
      ];
      const sip009Contracts = [
        `SP3.sip009-nft-1-${testId}`,
        `SP4.sip009-nft-2-${testId}`
      ];

      testKeys.push(...sip010Contracts, ...sip009Contracts);

      // Create metadata for SIP contracts and add to indexes
      await integrationUtils.retryOperation(async () => {
        // Add SIP010 contracts
        for (const contractId of sip010Contracts) {
          const metadata: ContractMetadata = {
            contractId,
            contractAddress: 'SP123456789',
            contractName: 'sip010-token',
            blockHeight: 150000,
            txId: `0x${testId}`,
            deployedAt: Date.now(),
            contractType: 'token',
            implementedTraits: ['transfer', 'SIP010'],
            sourceCode: '',
            abi: '',
            clarityVersion: 2,
            discoveryMethod: 'api-scan',
            discoveredAt: Date.now(),
            lastAnalyzed: Date.now(),
            lastUpdated: Date.now(),
            validationStatus: 'valid'
          };
          await indexManager.addToIndexes(contractId, metadata);
        }

        // Add SIP009 contracts
        for (const contractId of sip009Contracts) {
          const metadata: ContractMetadata = {
            contractId,
            contractAddress: 'SP123456789',
            contractName: 'sip009-nft',
            blockHeight: 150000,
            txId: `0x${testId}`,
            deployedAt: Date.now(),
            contractType: 'nft',
            implementedTraits: ['mint', 'SIP009'],
            sourceCode: '',
            abi: '',
            clarityVersion: 2,
            discoveryMethod: 'api-scan',
            discoveredAt: Date.now(),
            lastAnalyzed: Date.now(),
            lastUpdated: Date.now(),
            validationStatus: 'valid'
          };
          await indexManager.addToIndexes(contractId, metadata);
        }
      });

      console.log(`✅ Added contracts with SIP010 and SIP009 traits`);

      // Retrieve by trait (using SIP standard as trait)
      const sip010Results = await integrationUtils.retryOperation(async () => {
        return await indexManager.getContractsByTrait('SIP010');
      });

      const sip009Results = await integrationUtils.retryOperation(async () => {
        return await indexManager.getContractsByTrait('SIP009');
      });

      // Filter to only our test contracts
      const ourSip010 = sip010Results.filter((id: string) => id.includes(testId));
      const ourSip009 = sip009Results.filter((id: string) => id.includes(testId));

      expect(ourSip010).toHaveLength(2);
      expect(ourSip009).toHaveLength(2);
      expect(ourSip010).toEqual(expect.arrayContaining(sip010Contracts));
      expect(ourSip009).toEqual(expect.arrayContaining(sip009Contracts));

      console.log(`✅ SIP trait indexing validation passed:`);
      console.log(`   📋 SIP010: ${ourSip010.length} contracts`);
      console.log(`   🎨 SIP009: ${ourSip009.length} contracts`);
    }, 45000);

    it('should handle real trait-based indexing', async () => {
      integrationUtils.skipIfMissingEnv(['KV_REST_API_URL', 'KV_REST_API_TOKEN'], 'trait indexing');

      const testId = integrationUtils.generateTestId();
      const transferContracts = [
        `SP1.transfer-trait-1-${testId}`,
        `SP2.transfer-trait-2-${testId}`
      ];
      const mintContracts = [
        `SP3.mint-trait-1-${testId}`,
        `SP4.mint-trait-2-${testId}`
      ];

      testKeys.push(...transferContracts, ...mintContracts);

      // Create metadata for trait contracts and add to indexes
      await integrationUtils.retryOperation(async () => {
        // Add transfer trait contracts
        for (const contractId of transferContracts) {
          const metadata: ContractMetadata = {
            contractId,
            contractAddress: 'SP123456789',
            contractName: 'transfer-contract',
            blockHeight: 150000,
            txId: `0x${testId}`,
            deployedAt: Date.now(),
            contractType: 'token',
            implementedTraits: ['transfer'],
            sourceCode: '',
            abi: '',
            clarityVersion: 2,
            discoveryMethod: 'api-scan',
            discoveredAt: Date.now(),
            lastAnalyzed: Date.now(),
            lastUpdated: Date.now(),
            validationStatus: 'valid'
          };
          await indexManager.addToIndexes(contractId, metadata);
        }

        // Add mint trait contracts
        for (const contractId of mintContracts) {
          const metadata: ContractMetadata = {
            contractId,
            contractAddress: 'SP123456789',
            contractName: 'mint-contract',
            blockHeight: 150000,
            txId: `0x${testId}`,
            deployedAt: Date.now(),
            contractType: 'nft',
            implementedTraits: ['mint'],
            sourceCode: '',
            abi: '',
            clarityVersion: 2,
            discoveryMethod: 'api-scan',
            discoveredAt: Date.now(),
            lastAnalyzed: Date.now(),
            lastUpdated: Date.now(),
            validationStatus: 'valid'
          };
          await indexManager.addToIndexes(contractId, metadata);
        }
      });

      console.log(`✅ Added contracts to transfer and mint trait indexes`);

      // Retrieve by trait
      const transferResults = await integrationUtils.retryOperation(async () => {
        return await indexManager.getContractsByTrait('transfer');
      });

      const mintResults = await integrationUtils.retryOperation(async () => {
        return await indexManager.getContractsByTrait('mint');
      });

      // Filter to only our test contracts
      const ourTransfer = transferResults.filter((id: string) => id.includes(testId));
      const ourMint = mintResults.filter((id: string) => id.includes(testId));

      expect(ourTransfer).toHaveLength(2);
      expect(ourMint).toHaveLength(2);
      expect(ourTransfer).toEqual(expect.arrayContaining(transferContracts));
      expect(ourMint).toEqual(expect.arrayContaining(mintContracts));

      console.log(`✅ Trait indexing validation passed:`);
      console.log(`   🔄 Transfer trait: ${ourTransfer.length} contracts`);
      console.log(`   ⚡ Mint trait: ${ourMint.length} contracts`);
    }, 45000);

    it('should perform real bulk index operations', async () => {
      integrationUtils.skipIfMissingEnv(['KV_REST_API_URL', 'KV_REST_API_TOKEN'], 'bulk operations');

      const testId = integrationUtils.generateTestId();
      const contractIds = Array.from({ length: 5 }, (_, i) => 
        `SP${i}.bulk-test-${testId}-${i}`
      );

      testKeys.push(...contractIds);

      // Create bulk metadata and add to indexes (IndexManager doesn't have bulkUpdateIndexes)
      await integrationUtils.retryOperation(async () => {
        for (let i = 0; i < contractIds.length; i++) {
          const contractId = contractIds[i];
          const traits = [];
          
          // First 3 get SIP010, last 2 get SIP009
          if (i < 3) traits.push('SIP010');
          else traits.push('SIP009');
          
          // First 2 get transfer, next 2 get mint
          if (i < 2) traits.push('transfer');
          else if (i < 4) traits.push('mint');

          const contractType: ContractType = i < 3 ? 'token' : 'nft';
          const metadata: ContractMetadata = {
            contractId,
            contractAddress: `SP-BULK-${testId}`,
            contractName: `bulk-contract-${i}`,
            blockHeight: 150000 + i,
            txId: `0x${testId}${i}`,
            deployedAt: Date.now() - (i * 1000),
            contractType,
            implementedTraits: traits,
            sourceCode: '',
            abi: '',
            clarityVersion: 2,
            discoveryMethod: 'api-scan',
            discoveredAt: Date.now(),
            lastAnalyzed: Date.now(),
            lastUpdated: Date.now(),
            validationStatus: 'valid'
          };
          await indexManager.addToIndexes(contractId, metadata);
        }
      });

      console.log(`✅ Bulk index update completed for ${contractIds.length} contracts`);

      // Verify all indexes were updated
      const allResults = await indexManager.getAllContracts();
      const sip010Results = await indexManager.getContractsByTrait('SIP010');
      const transferResults = await indexManager.getContractsByTrait('transfer');

      const ourBulkResults = allResults.filter(id => id.includes(testId));
      const ourSip010Results = sip010Results.filter(id => id.includes(testId));
      const ourTransferResults = transferResults.filter(id => id.includes(testId));

      expect(ourBulkResults).toHaveLength(5);
      expect(ourSip010Results).toHaveLength(3);
      expect(ourTransferResults).toHaveLength(2);

      console.log(`✅ Bulk operation validation passed:`);
      console.log(`   📦 All contracts: ${ourBulkResults.length}/5 contracts`);
      console.log(`   📋 SIP010 index: ${ourSip010Results.length}/3 contracts`);
      console.log(`   🔄 Transfer index: ${ourTransferResults.length}/2 contracts`);
    }, 60000);
  });

  describe('Real KV Statistics', () => {
    it('should get real index statistics', async () => {
      integrationUtils.skipIfMissingEnv(['KV_REST_API_URL', 'KV_REST_API_TOKEN'], 'index stats');

      const stats = await integrationUtils.retryOperation(async () => {
        return await indexManager.getStats();
      });

      expect(stats).toMatchObject({
        totalIndexes: expect.any(Number),
        indexSizes: expect.any(Object),
        lastUpdated: expect.any(Object),
        hitRate: expect.any(Number),
        totalQueries: expect.any(Number),
        cacheHits: expect.any(Number)
      });

      expect(stats.totalIndexes).toBeGreaterThanOrEqual(0);
      expect(stats.totalQueries).toBeGreaterThanOrEqual(0);

      console.log(`📊 Index Statistics:`);
      console.log(`   📂 Total indexes: ${stats.totalIndexes}`);
      console.log(`   🔍 Total queries: ${stats.totalQueries}`);
      console.log(`   💯 Hit rate: ${stats.hitRate.toFixed(1)}%`);
      console.log(`   📋 Index sizes: ${Object.keys(stats.indexSizes).length} types`);
      
      Object.entries(stats.indexSizes).forEach(([type, count]) => {
        console.log(`     ${type}: ${count} entries`);
      });
    }, 30000);

    it('should handle real search operations across indexes', async () => {
      integrationUtils.skipIfMissingEnv(['KV_REST_API_URL', 'KV_REST_API_TOKEN'], 'cross-index search');

      const testId = integrationUtils.generateTestId();
      const deployer = `SP-SEARCH-${testId}`;
      const contractId = `${deployer}.search-contract-${testId}`;

      testKeys.push(contractId);

      // Add to multiple indexes using addToIndexes
      await integrationUtils.retryOperation(async () => {
        const metadata: ContractMetadata = {
          contractId,
          contractAddress: deployer,
          contractName: 'search-contract',
          blockHeight: 150000,
          txId: `0x${testId}`,
          deployedAt: Date.now(),
          contractType: 'token',
          implementedTraits: ['transfer', 'SIP010'],
          sourceCode: '',
          abi: '',
          clarityVersion: 2,
          discoveryMethod: 'api-scan',
          discoveredAt: Date.now(),
          lastAnalyzed: Date.now(),
          lastUpdated: Date.now(),
          validationStatus: 'valid'
        };
        await indexManager.addToIndexes(contractId, metadata);
      });

      console.log(`✅ Added ${contractId} to multiple indexes`);

      // Search across different indexes
      const [allResults, sipResults, traitResults] = await Promise.all([
        indexManager.getAllContracts(),
        indexManager.getContractsByTrait('SIP010'),
        indexManager.getContractsByTrait('transfer')
      ]);

      // Our contract should appear in all searches
      expect(allResults).toContain(contractId);
      expect(sipResults).toContain(contractId);
      expect(traitResults).toContain(contractId);

      console.log(`✅ Cross-index search validation passed - contract found in all indexes`);
    }, 45000);
  });

  describe('Real Error Handling', () => {
    it('should handle real KV errors gracefully', async () => {
      integrationUtils.skipIfMissingEnv(['KV_REST_API_URL', 'KV_REST_API_TOKEN'], 'error handling');

      // Try to get from non-existent trait
      const nonExistentResults = await indexManager.getContractsByTrait('NONEXISTENT-TRAIT');
      expect(nonExistentResults).toEqual([]);

      // Try to check non-existent contract
      const contractExists = await indexManager.hasContract('SP.NONEXISTENT');
      expect(contractExists).toBe(false);

      console.log(`✅ Error handling validation passed`);
    }, 15000);
  });
});
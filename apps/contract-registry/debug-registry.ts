#!/usr/bin/env node --import tsx

/**
 * Debug script for Contract Registry Service
 * 
 * This script creates a ContractRegistry instance using the same config as the UI
 * and tests different methods to identify discrepancies between getStats() and searchContracts().
 */

import 'dotenv/config';
import { config as dotenvConfig } from 'dotenv';
import { ContractRegistry, type ContractRegistryConfig } from '@services/contract-registry';

// Load environment variables from .env.local
dotenvConfig({ path: '.env.local' });

// Check environment variables
console.log('Environment variables:');
console.log(`BLOB_READ_WRITE_TOKEN: ${process.env.BLOB_READ_WRITE_TOKEN ? 'SET' : 'NOT SET'}`);
console.log(`KV_REST_API_URL: ${process.env.KV_REST_API_URL ? 'SET' : 'NOT SET'}`);
console.log(`KV_REST_API_TOKEN: ${process.env.KV_REST_API_TOKEN ? 'SET' : 'NOT SET'}`);

// Use the same configuration as the UI
const config: ContractRegistryConfig = {
  serviceName: 'contract-registry-debug',
  blobStoragePrefix: 'contracts/',
  enableAnalysis: true,
  enableDiscovery: true,
  analysisTimeout: 30000,
  blobStorage: {},
  indexManager: {},
  traitAnalyzer: {},
  discoveryEngine: {}
};

interface DebugResults {
  stats: any;
  searchResults: any;
  allContracts: string[];
  contractSamples: any[];
  discrepancies: string[];
}

async function runDebugTests(): Promise<DebugResults> {
  console.log('🔍 Creating ContractRegistry instance...');
  const registry = new ContractRegistry(config);

  const results: DebugResults = {
    stats: null,
    searchResults: null,
    allContracts: [],
    contractSamples: [],
    discrepancies: []
  };

  try {
    console.log('\n📊 Testing getStats()...');
    const startStats = Date.now();
    results.stats = await registry.getStats();
    const statsTime = Date.now() - startStats;
    console.log(`✅ getStats() completed in ${statsTime}ms`);
    console.log('Stats result:', JSON.stringify(results.stats, null, 2));

    console.log('\n🔍 Testing searchContracts() with minimal query...');
    const startSearch = Date.now();
    results.searchResults = await registry.searchContracts({
      offset: 0,
      limit: 5
    });
    const searchTime = Date.now() - startSearch;
    console.log(`✅ searchContracts() completed in ${searchTime}ms`);
    console.log('Search result:', JSON.stringify({
      total: results.searchResults.total,
      returned: results.searchResults.contracts.length,
      offset: results.searchResults.offset,
      limit: results.searchResults.limit,
      queryTime: results.searchResults.queryTime
    }, null, 2));

    console.log('\n📝 Testing getAllContracts()...');
    const startAll = Date.now();
    results.allContracts = await registry.getAllContracts();
    const allTime = Date.now() - startAll;
    console.log(`✅ getAllContracts() completed in ${allTime}ms`);
    console.log(`Found ${results.allContracts.length} contract IDs`);

    // Sample a few contract IDs
    if (results.allContracts.length > 0) {
      console.log('Sample contract IDs:');
      results.allContracts.slice(0, 5).forEach((id, index) => {
        console.log(`  ${index + 1}. ${id}`);
      });
    }

    console.log('\n🔍 Sampling contract metadata...');
    const sampleSize = Math.min(3, results.allContracts.length);
    for (let i = 0; i < sampleSize; i++) {
      const contractId = results.allContracts[i];
      console.log(`\nFetching metadata for: ${contractId}`);
      try {
        const metadata = await registry.getContract(contractId);
        if (metadata) {
          results.contractSamples.push({
            contractId,
            contractType: metadata.contractType,
            validationStatus: metadata.validationStatus,
            discoveryMethod: metadata.discoveryMethod,
            implementedTraits: metadata.implementedTraits,
            hasSourceCode: !!metadata.sourceCode,
            hasAbi: !!metadata.abi,
            lastAnalyzed: metadata.lastAnalyzed,
            lastUpdated: metadata.lastUpdated
          });
          console.log(`  ✅ Type: ${metadata.contractType}, Status: ${metadata.validationStatus}`);
          console.log(`  📅 Analyzed: ${new Date(metadata.lastAnalyzed).toISOString()}`);
          console.log(`  🏷️  Traits: ${metadata.implementedTraits.join(', ') || 'none'}`);
        } else {
          console.log(`  ❌ No metadata found`);
          results.contractSamples.push({
            contractId,
            error: 'No metadata found'
          });
        }
      } catch (error) {
        console.log(`  ❌ Error: ${error}`);
        results.contractSamples.push({
          contractId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    console.log('\n🔍 Analyzing discrepancies...');

    // Compare total counts
    const statsTotal = results.stats.totalContracts;
    const searchTotal = results.searchResults.total;
    const getAllTotal = results.allContracts.length;

    console.log('\n📊 Total contract counts:');
    console.log(`  getStats(): ${statsTotal}`);
    console.log(`  searchContracts(): ${searchTotal}`);
    console.log(`  getAllContracts(): ${getAllTotal}`);

    if (statsTotal !== searchTotal) {
      results.discrepancies.push(`getStats() reports ${statsTotal} contracts, but searchContracts() reports ${searchTotal}`);
    }

    if (statsTotal !== getAllTotal) {
      results.discrepancies.push(`getStats() reports ${statsTotal} contracts, but getAllContracts() returns ${getAllTotal} IDs`);
    }

    if (searchTotal !== getAllTotal) {
      results.discrepancies.push(`searchContracts() reports ${searchTotal} contracts, but getAllContracts() returns ${getAllTotal} IDs`);
    }

    // Check if search results contain valid contracts
    const searchContractsReturned = results.searchResults.contracts.length;
    if (searchContractsReturned === 0 && searchTotal > 0) {
      results.discrepancies.push(`searchContracts() reports ${searchTotal} total but returned 0 contracts`);
    }

    // Analyze contract types from stats vs samples
    if (results.contractSamples.length > 0 && results.stats.contractsByType) {
      console.log('\n🏷️  Contract type breakdown from stats:');
      Object.entries(results.stats.contractsByType).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });

      console.log('\n🏷️  Contract types from samples:');
      const sampleTypes = results.contractSamples
        .filter(sample => !sample.error)
        .map(sample => sample.contractType);
      sampleTypes.forEach(type => console.log(`  Sample type: ${type}`));
    }

    // Test specific type queries
    console.log('\n🔍 Testing specific contract type queries...');
    try {
      const tokenContracts = await registry.getContractsByType('token');
      const nftContracts = await registry.getContractsByType('nft');
      const vaultContracts = await registry.getContractsByType('vault');
      const unknownContracts = await registry.getContractsByType('unknown');

      console.log(`  Token contracts: ${tokenContracts.length}`);
      console.log(`  NFT contracts: ${nftContracts.length}`);
      console.log(`  Vault contracts: ${vaultContracts.length}`);
      console.log(`  Unknown contracts: ${unknownContracts.length}`);

      const typeTotal = tokenContracts.length + nftContracts.length + vaultContracts.length + unknownContracts.length;
      console.log(`  Total from type queries: ${typeTotal}`);

      if (typeTotal !== statsTotal) {
        results.discrepancies.push(`Sum of type queries (${typeTotal}) doesn't match getStats() total (${statsTotal})`);
      }
    } catch (error) {
      results.discrepancies.push(`Error querying by type: ${error}`);
    }

    console.log('\n🔧 Investigating storage layers...');
    try {
      // Access internal storage components
      const blobStorage = (registry as any).blobStorage;
      const indexManager = (registry as any).indexManager;

      if (blobStorage) {
        console.log('📦 Blob Storage:');
        const blobStats = await blobStorage.getStats();
        console.log(`  Total contracts in blob: ${blobStats.totalContracts}`);
        console.log(`  Total size: ${blobStats.totalSize} bytes`);
        console.log(`  Average size: ${blobStats.averageSize} bytes`);

        // Try to list some blob keys if possible
        try {
          const listMethod = blobStorage.listContracts || blobStorage.listKeys || blobStorage.list;
          if (listMethod) {
            const contracts = await listMethod.call(blobStorage);
            console.log(`  Blob keys available: ${contracts?.length || 'unknown'}`);
            if (contracts && contracts.length > 0) {
              console.log(`  Sample blob keys: ${contracts.slice(0, 3).join(', ')}`);
            }
          }
        } catch (listError) {
          console.log(`  Could not list blob keys: ${listError}`);
        }
      }

      if (indexManager) {
        console.log('\n🗂️  Index Manager:');
        const indexStats = await indexManager.getStats();
        console.log(`  Total indexes: ${indexStats.totalIndexes}`);
        console.log(`  Hit rate: ${indexStats.hitRate}`);

        // Check specific indexes
        try {
          const allContractsSet = await indexManager.getSetMembers('all-contracts');
          console.log(`  'all-contracts' index has ${allContractsSet?.length || 0} entries`);

          const typeIndexes = await Promise.all([
            indexManager.getSetMembers('type:token').catch(() => []),
            indexManager.getSetMembers('type:nft').catch(() => []),
            indexManager.getSetMembers('type:vault').catch(() => []),
            indexManager.getSetMembers('type:unknown').catch(() => [])
          ]);

          console.log(`  Type indexes: token=${typeIndexes[0]?.length || 0}, nft=${typeIndexes[1]?.length || 0}, vault=${typeIndexes[2]?.length || 0}, unknown=${typeIndexes[3]?.length || 0}`);
        } catch (indexError) {
          console.log(`  Could not check indexes: ${indexError}`);
        }
      }
    } catch (storageError) {
      console.log(`❌ Error investigating storage: ${storageError}`);
      results.discrepancies.push(`Storage investigation error: ${storageError}`);
    }

  } catch (error) {
    console.error('❌ Error during debug tests:', error);
    results.discrepancies.push(`Test execution error: ${error}`);
  }

  return results;
}

async function main() {
  console.log('🚀 Contract Registry Debug Script');
  console.log('='.repeat(50));

  try {
    const results = await runDebugTests();

    console.log('\n' + '='.repeat(50));
    console.log('📋 SUMMARY');
    console.log('='.repeat(50));

    if (results.discrepancies.length === 0) {
      console.log('✅ No discrepancies found! All methods return consistent results.');
    } else {
      console.log(`❌ Found ${results.discrepancies.length} discrepancy(ies):`);
      results.discrepancies.forEach((discrepancy, index) => {
        console.log(`  ${index + 1}. ${discrepancy}`);
      });
    }

    console.log('\n📊 Quick Stats:');
    console.log(`  Total contracts: ${results.stats?.totalContracts || 'N/A'}`);
    console.log(`  Search total: ${results.searchResults?.total || 'N/A'}`);
    console.log(`  getAllContracts length: ${results.allContracts.length}`);
    console.log(`  Contract samples: ${results.contractSamples.length}`);

    if (results.stats?.contractsByType) {
      console.log('\n🏷️  Contract types:');
      Object.entries(results.stats.contractsByType).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
    }

    if (results.stats?.contractsByStatus) {
      console.log('\n📋 Contract status:');
      Object.entries(results.stats.contractsByStatus).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });
    }

    console.log('\n🔧 Debug completed successfully!');

  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

// Run the debug script
if (require.main === module) {
  main().catch(console.error);
}

export { runDebugTests };
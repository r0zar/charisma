#!/usr/bin/env tsx

/**
 * Discover All SIPs - High throughput discovery of SIP009/SIP010 contracts
 */

import { ContractRegistry, createDefaultConfig } from '../src/index';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function discoverAllSips() {
  console.log('🚀 DISCOVERING ALL SIP CONTRACTS - HIGH THROUGHPUT');
  console.log('='.repeat(60));

  const config = createDefaultConfig('mainnet-contract-registry');
  config.enableDiscovery = true;
  const registry = new ContractRegistry(config);

  console.log('✅ Registry initialized with enhanced signature validation\n');

  // High throughput discovery configuration  
  const discoveryConfig = {
    traits: [
      {
        trait: {
          name: 'SIP010',
          description: 'Standard Fungible Token (SIP010)', 
          functions: [
            // Minimal syntax for discovery - signature validation happens after
            { name: "transfer", access: "public", args: [] },
            { name: "get-name", access: "read_only", args: [] },
            { name: "get-symbol", access: "read_only", args: [] },
            { name: "get-decimals", access: "read_only", args: [] },
            { name: "get-balance", access: "read_only", args: [] },
            { name: "get-total-supply", access: "read_only", args: [] }
          ]
        },
        enabled: true,
        priority: 1,
        batchSize: 25 // High throughput batch size
      },
      {
        trait: {
          name: 'SIP009',
          description: 'Standard Non-Fungible Token (SIP009)',
          functions: [
            // Minimal syntax for discovery - signature validation happens after
            { name: "get-last-token-id", access: "read_only", args: [] },
            { name: "get-token-uri", access: "read_only", args: [] },
            { name: "get-owner", access: "read_only", args: [] },
            { name: "transfer", access: "public", args: [] }
          ]
        },
        enabled: true,
        priority: 2,
        batchSize: 25 // High throughput batch size
      }
    ],
    sipStandards: [], // Using traits instead for better control
    apiScan: {
      enabled: false, // Focus on trait discovery only
      batchSize: 50,
      maxRetries: 2,
      retryDelay: 100,
      timeout: 3000,
      blacklist: []
    }
  };

  console.log('🔍 Starting high-throughput SIP discovery...');
  console.log('   • SIP010: Fungible Token discovery');
  console.log('   • SIP009: NFT discovery');
  console.log('   • Enhanced signature validation enabled');
  console.log('   • High batch sizes for faster throughput\n');

  const startTime = Date.now();

  try {
    const result = await registry.discoverContracts(discoveryConfig);
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log('📊 DISCOVERY RESULTS:');
    console.log('='.repeat(40));
    console.log(`⏱️  Total Duration: ${duration.toFixed(2)}s`);
    console.log(`🔍 Total Contracts Found: ${result.totalContractsFound}`);
    console.log(`✅ Total Contracts Added: ${result.totalContractsAdded}`);
    console.log(`🔄 Total Contracts Processed: ${result.totalContractsProcessed}`);
    console.log(`⏭️  Total Contracts Skipped: ${result.totalContractsSkipped}`);
    console.log(`❌ Total Contracts Errored: ${result.totalContractsErrored}`);

    if (result.totalContractsFound > 0) {
      console.log(`\n📈 Discovery Rate: ${(result.totalContractsFound / duration).toFixed(1)} contracts/second`);
    }

    // Show results by discovery method
    if (result.results && result.results.length > 0) {
      console.log('\n🎯 RESULTS BY METHOD:');
      
      for (const methodResult of result.results) {
        console.log(`\n${methodResult.method.toUpperCase()}:`);
        console.log(`   Found: ${methodResult.contractsFound} contracts`);
        console.log(`   Added: ${methodResult.contractsAdded} contracts`);
        console.log(`   Duration: ${(methodResult.duration / 1000).toFixed(2)}s`);

        // Show discovered contracts
        if (methodResult.newContracts && methodResult.newContracts.length > 0) {
          console.log(`   📝 New Contracts Discovered:`);
          
          // Show first 10 contracts, then summary
          const displayLimit = 10;
          const contracts = methodResult.newContracts.slice(0, displayLimit);
          
          for (let i = 0; i < contracts.length; i++) {
            console.log(`      ${i + 1}. ${contracts[i]}`);
          }
          
          if (methodResult.newContracts.length > displayLimit) {
            console.log(`      ... and ${methodResult.newContracts.length - displayLimit} more`);
          }
        }

        // Show any errors
        if (methodResult.errorContracts && methodResult.errorContracts.length > 0) {
          console.log(`   ⚠️  Error Contracts: ${methodResult.errorContracts.length}`);
          console.log(`      First few: ${methodResult.errorContracts.slice(0, 3).join(', ')}`);
        }
      }
    }

    // Show overall errors
    if (result.errors && result.errors.length > 0) {
      console.log('\n⚠️  DISCOVERY ERRORS:');
      result.errors.slice(0, 5).forEach((error, i) => {
        console.log(`   ${i + 1}. ${error}`);
      });
      if (result.errors.length > 5) {
        console.log(`   ... and ${result.errors.length - 5} more errors`);
      }
    }

    // Get updated counts from registry
    console.log('\n🏦 UPDATED REGISTRY STATUS:');
    try {
      const sip010Count = await registry.searchContracts({ implementedTraits: ['SIP010'], limit: 1 });
      const sip009Count = await registry.searchContracts({ implementedTraits: ['SIP009'], limit: 1 });
      
      console.log(`   📊 Total SIP010 contracts: ${sip010Count.total}`);
      console.log(`   📊 Total SIP009 contracts: ${sip009Count.total}`);
    } catch (error) {
      console.log(`   ⚠️  Could not get updated counts: ${error instanceof Error ? error.message : error}`);
    }

    // Success summary
    if (result.totalContractsAdded > 0) {
      console.log(`\n🎉 SUCCESS! Discovered and validated ${result.totalContractsAdded} new SIP-compliant contracts`);
      console.log(`   • All contracts passed enhanced signature validation`);
      console.log(`   • Contracts are now available in the registry with proper SIP tags`);
    } else if (result.totalContractsFound > 0) {
      console.log(`\n💡 Found ${result.totalContractsFound} contracts, but they were already in the registry`);
    } else {
      console.log(`\n🔍 No new SIP contracts discovered in this run`);
      console.log(`   • This could mean the registry is already comprehensive`);
      console.log(`   • Or the discovery patterns need adjustment`);
    }

  } catch (error) {
    console.error('\n❌ DISCOVERY FAILED:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack.split('\n').slice(0, 10).join('\n'));
    }
    process.exit(1);
  }

  console.log('\n✅ High-throughput SIP discovery completed');
}

// Run the discovery
discoverAllSips().then(() => {
  console.log('\n🎯 All discovery operations completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('❌ Discovery script failed:', error);
  process.exit(1);
});
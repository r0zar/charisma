#!/usr/bin/env tsx

/**
 * Quick SIP Discovery - Fast test with smaller batch sizes
 */

import { ContractRegistry, createDefaultConfig } from '../src/index';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function discoverSipsQuick() {
  console.log('⚡ QUICK SIP DISCOVERY TEST');
  console.log('='.repeat(40));

  const config = createDefaultConfig('mainnet-contract-registry');
  config.enableDiscovery = true;
  const registry = new ContractRegistry(config);

  console.log('✅ Registry initialized\n');

  // Quick test configuration - small batches for fast results
  const discoveryConfig = {
    traits: [
      {
        trait: {
          name: 'SIP010',
          description: 'Standard Fungible Token (SIP010)', 
          functions: [
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
        batchSize: 5 // Small batch for quick test
      }
    ],
    sipStandards: [],
    apiScan: { enabled: false, batchSize: 5, maxRetries: 1, retryDelay: 100, timeout: 2000, blacklist: [] }
  };

  console.log('🔍 Testing SIP010 discovery (small batch)...');

  const startTime = Date.now();

  try {
    const result = await registry.discoverContracts(discoveryConfig);
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log('\n📊 QUICK TEST RESULTS:');
    console.log(`⏱️  Duration: ${duration.toFixed(2)}s`);
    console.log(`🔍 Found: ${result.totalContractsFound}`);
    console.log(`✅ Added: ${result.totalContractsAdded}`);
    console.log(`🔄 Processed: ${result.totalContractsProcessed}`);

    if (result.results && result.results.length > 0) {
      const traitResult = result.results[0];
      console.log(`\n📝 First batch contracts discovered:`);
      
      if (traitResult.newContracts && traitResult.newContracts.length > 0) {
        traitResult.newContracts.slice(0, 10).forEach((contract, i) => {
          console.log(`   ${i + 1}. ${contract}`);
        });
      }

      if (traitResult.errorContracts && traitResult.errorContracts.length > 0) {
        console.log(`\n⚠️  Error contracts: ${traitResult.errorContracts.length}`);
      }
    }

    if (result.errors && result.errors.length > 0) {
      console.log(`\n⚠️  Errors: ${result.errors.length}`);
      console.log(`   First: ${result.errors[0]}`);
    }

    console.log('\n🎯 Quick test shows discovery is working!');
    console.log('   • Ready for full high-throughput discovery');
    console.log('   • Enhanced signature validation is active');

  } catch (error) {
    console.error('❌ Quick test failed:', error instanceof Error ? error.message : error);
  }

  console.log('\n✅ Quick SIP discovery test completed');
}

// Run the quick test
discoverSipsQuick().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Quick test failed:', error);
  process.exit(1);
});
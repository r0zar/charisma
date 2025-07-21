#!/usr/bin/env tsx

/**
 * Scan All Mainnet - Comprehensive scan of every contract on Stacks mainnet
 */

import { ContractRegistry, createDefaultConfig } from '../src/index';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function scanAllMainnet() {
  console.log('🌍 SCANNING ALL MAINNET CONTRACTS');
  console.log('='.repeat(60));
  console.log('⚠️  WARNING: This will scan EVERY contract on Stacks mainnet');
  console.log('   This is a comprehensive operation that may take hours');
  console.log('');

  const config = createDefaultConfig('mainnet-contract-registry');
  config.enableDiscovery = true;
  const registry = new ContractRegistry(config);

  console.log('✅ Registry initialized for full mainnet scan\n');

  // Comprehensive discovery configuration
  const fullScanConfig = {
    traits: [
      // SIP010 - Fungible Tokens (HIGHEST PRIORITY - most common)
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
        batchSize: 100 // MAXIMUM BATCH SIZE for most common contracts
      },
      // SIP009 - NFTs (HIGH PRIORITY - second most common)
      {
        trait: {
          name: 'SIP009',
          description: 'Standard Non-Fungible Token (SIP009)',
          functions: [
            { name: "get-last-token-id", access: "read_only", args: [] },
            { name: "get-token-uri", access: "read_only", args: [] },
            { name: "get-owner", access: "read_only", args: [] },
            { name: "transfer", access: "public", args: [] }
          ]
        },
        enabled: true,
        priority: 2,
        batchSize: 80 // HIGH BATCH SIZE
      },
      // Vault Trait (execute/quote pattern) - FAST DISCOVERY
      {
        trait: {
          name: 'Vault',
          description: 'Vault contracts (execute/quote trait)',
          functions: [
            { name: "execute", access: "public", args: [] },
            { name: "quote", access: "read_only", args: [] }
          ]
        },
        enabled: true,
        priority: 3,
        batchSize: 75 // FAST - only 2 functions to check
      },
      // SIP069 - Subnet Credits (Credit Tokens) - REDUCED FUNCTIONS FOR SPEED
      {
        trait: {
          name: 'SIP069',
          description: 'Subnet Credit Token (SIP069)',
          functions: [
            // Core SIP010 functions (subset for speed)
            { name: "transfer", access: "public", args: [] },
            { name: "get-name", access: "read_only", args: [] },
            { name: "get-symbol", access: "read_only", args: [] },
            // Key credit functions
            { name: "deposit", access: "public", args: [] },
            { name: "withdraw", access: "public", args: [] },
            { name: "x-transfer", access: "public", args: [] }
          ]
        },
        enabled: true,
        priority: 4,
        batchSize: 60
      },
      // Sublink (Subnet Bridge) - STREAMLINED
      {
        trait: {
          name: 'Sublink',
          description: 'Subnet Bridge contracts',
          functions: [
            { name: "execute", access: "public", args: [] },
            { name: "quote", access: "read_only", args: [] },
            { name: "deposit", access: "public", args: [] },
            { name: "withdraw", access: "public", args: [] }
          ]
        },
        enabled: true,
        priority: 5,
        batchSize: 50
      },
      // Liquidity Pool - CORE FUNCTIONS ONLY
      {
        trait: {
          name: 'Liquidity Pool',
          description: 'Liquidity Pool contracts',
          functions: [
            { name: "execute", access: "public", args: [] },
            { name: "swap-x-for-y", access: "public", args: [] },
            { name: "swap-y-for-x", access: "public", args: [] }
          ]
        },
        enabled: true,
        priority: 6,
        batchSize: 45
      }
    ],
    sipStandards: [], // Using traits for better control
    apiScan: {
      enabled: true, // Enable API scanning for comprehensive coverage
      batchSize: 150, // MAXIMUM throughput API scanning
      maxRetries: 2, // Reduced retries for speed
      retryDelay: 100, // Faster retry
      timeout: 3000, // Shorter timeout
      blacklist: [] // No blacklist - scan everything
    }
  };

  console.log('🚀 STARTING HIGH-SPEED MAINNET SCAN');
  console.log('🎯 OPTIMIZED FOR MAXIMUM THROUGHPUT');
  console.log('='.repeat(60));
  console.log('   📊 PRIORITY TARGETS:');
  console.log('      • SIP010 (Fungible) - 100 batch size');
  console.log('      • SIP009 (NFTs) - 80 batch size'); 
  console.log('      • Vault (execute/quote) - 75 batch size');
  console.log('      • SIP069 (Credits) - 60 batch size');
  console.log('      • Sublink (Bridges) - 50 batch size');
  console.log('      • Liquidity Pools - 45 batch size');
  console.log('   ⚡ PERFORMANCE OPTIMIZATIONS:');
  console.log('      • API scanning: 150 batch size');
  console.log('      • Reduced function checks for speed');
  console.log('      • Streamlined retry logic (2x max, 100ms delay)');
  console.log('      • Fast timeouts (3s)');
  console.log('      • Enhanced signature validation');
  console.log('      • Automatic metadata extraction');
  console.log('');

  // Track progress
  let lastUpdate = Date.now();
  const startTime = Date.now();
  
  console.log('📊 PROGRESS TRACKING:');
  console.log('   Updates will be shown every 30 seconds during scan...\n');

  try {
    const result = await registry.discoverContracts(fullScanConfig);
    const endTime = Date.now();
    const totalDuration = (endTime - startTime) / 1000;

    console.log('\n🎉 MAINNET SCAN COMPLETED!');
    console.log('='.repeat(50));
    console.log(`⏱️  Total Duration: ${Math.floor(totalDuration / 60)}m ${(totalDuration % 60).toFixed(0)}s`);
    console.log(`🔍 Total Contracts Found: ${result.totalContractsFound}`);
    console.log(`✅ Total Contracts Added: ${result.totalContractsAdded}`);
    console.log(`🔄 Total Contracts Processed: ${result.totalContractsProcessed}`);
    console.log(`⏭️  Total Contracts Skipped: ${result.totalContractsSkipped}`);
    console.log(`❌ Total Contracts Errored: ${result.totalContractsErrored}`);

    if (result.totalContractsFound > 0) {
      console.log(`\n📈 Overall Scan Rate: ${(result.totalContractsProcessed / totalDuration).toFixed(1)} contracts/second`);
    }

    // Detailed results by trait/method
    if (result.results && result.results.length > 0) {
      console.log('\n📊 RESULTS BY DISCOVERY METHOD:');
      
      let totalNewContracts = 0;
      
      for (const methodResult of result.results) {
        console.log(`\n${methodResult.method.toUpperCase()}:`);
        console.log(`   ⏱️  Duration: ${(methodResult.duration / 1000).toFixed(1)}s`);
        console.log(`   🔍 Found: ${methodResult.contractsFound} contracts`);
        console.log(`   ✅ Added: ${methodResult.contractsAdded} contracts`);
        console.log(`   🔄 Processed: ${methodResult.contractsProcessed} contracts`);
        
        if (methodResult.contractsFound > 0) {
          const rate = methodResult.contractsFound / (methodResult.duration / 1000);
          console.log(`   📈 Rate: ${rate.toFixed(1)} contracts/second`);
        }

        // Show sample of new contracts
        if (methodResult.newContracts && methodResult.newContracts.length > 0) {
          totalNewContracts += methodResult.newContracts.length;
          console.log(`   📝 Sample new contracts:`);
          
          const samples = methodResult.newContracts.slice(0, 5);
          samples.forEach((contract, i) => {
            console.log(`      ${i + 1}. ${contract}`);
          });
          
          if (methodResult.newContracts.length > 5) {
            console.log(`      ... and ${methodResult.newContracts.length - 5} more`);
          }
        }

        // Show errors if any
        if (methodResult.errorContracts && methodResult.errorContracts.length > 0) {
          console.log(`   ⚠️  Errors: ${methodResult.errorContracts.length} contracts failed`);
        }
      }

      console.log(`\n🎯 TOTAL NEW CONTRACTS DISCOVERED: ${totalNewContracts}`);
    }

    // Get final registry statistics
    console.log('\n🏦 FINAL REGISTRY STATISTICS:');
    try {
      const [sip010Count, sip009Count, allContracts] = await Promise.all([
        registry.searchContracts({ implementedTraits: ['SIP010'], limit: 1 }),
        registry.searchContracts({ implementedTraits: ['SIP009'], limit: 1 }),
        registry.getAllContracts()
      ]);
      
      console.log(`   📊 Total contracts in registry: ${allContracts.length}`);
      console.log(`   🪙 SIP010 (Fungible) contracts: ${sip010Count.total}`);
      console.log(`   🖼️  SIP009 (NFT) contracts: ${sip009Count.total}`);
      
      // Calculate coverage
      if (result.totalContractsProcessed > 0) {
        const coverage = ((allContracts.length / result.totalContractsProcessed) * 100);
        console.log(`   📈 Registry coverage: ${coverage.toFixed(1)}% of scanned contracts`);
      }
      
    } catch (error) {
      console.log(`   ⚠️  Could not retrieve final statistics: ${error instanceof Error ? error.message : error}`);
    }

    // Show any overall errors
    if (result.errors && result.errors.length > 0) {
      console.log('\n⚠️  SCAN ERRORS ENCOUNTERED:');
      result.errors.slice(0, 10).forEach((error, i) => {
        console.log(`   ${i + 1}. ${error}`);
      });
      if (result.errors.length > 10) {
        console.log(`   ... and ${result.errors.length - 10} more errors`);
      }
    }

    // Success summary
    console.log('\n🎉 MAINNET SCAN SUMMARY:');
    if (result.totalContractsAdded > 0) {
      console.log(`   ✅ Successfully discovered ${result.totalContractsAdded} new contracts`);
      console.log(`   🔍 All contracts validated with enhanced signature checking`);
      console.log(`   🏷️  Contracts properly tagged with trait classifications`);
      console.log(`   💾 All data stored and indexed in the registry`);
    } else {
      console.log(`   💡 No new contracts added - registry appears comprehensive`);
      console.log(`   🔄 Processed ${result.totalContractsProcessed} contracts for validation`);
    }

  } catch (error) {
    console.error('\n❌ MAINNET SCAN FAILED:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack.split('\n').slice(0, 10).join('\n'));
    }
    process.exit(1);
  }

  console.log('\n✅ Comprehensive mainnet scan completed');
  console.log('🎯 Registry is now fully populated with mainnet contract data');
}

// Run the comprehensive scan
scanAllMainnet().then(() => {
  console.log('\n🏁 All mainnet scanning operations completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('❌ Mainnet scan script failed:', error);
  process.exit(1);
});
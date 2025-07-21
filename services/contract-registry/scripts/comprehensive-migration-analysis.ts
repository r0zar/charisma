#!/usr/bin/env tsx

/**
 * Comprehensive Migration Analysis - Deep dive into token metadata migration status
 */

import { ContractRegistry, createDefaultConfig } from '../src/index';
import { listTokens } from '@repo/tokens';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function comprehensiveMigrationAnalysis() {
  console.log('🔍 COMPREHENSIVE MIGRATION ANALYSIS');
  console.log('='.repeat(50));

  const config = createDefaultConfig('mainnet-contract-registry');
  const registry = new ContractRegistry(config);

  console.log('✅ Registry initialized\n');

  // 1. Get tokens from cache
  console.log('📊 STEP 1: ANALYZING TOKEN CACHE');
  console.log('-'.repeat(30));
  
  const tokens = await listTokens();
  console.log(`📦 Total tokens in cache: ${tokens.length}`);

  // 2. Get contracts from registry
  console.log('\n📊 STEP 2: ANALYZING CONTRACT REGISTRY');
  console.log('-'.repeat(30));
  
  const stats = await registry.getStats();
  console.log(`📊 Total contracts in registry: ${stats.totalContracts}`);
  console.log(`🪙 Token contracts: ${stats.contractsByType.token}`);

  // 3. Check overlap - how many cache tokens are in registry?
  console.log('\n📊 STEP 3: CHECKING CACHE → REGISTRY OVERLAP');
  console.log('-'.repeat(30));

  let foundInRegistry = 0;
  let hasTokenMetadata = 0;
  let missingFromRegistry: string[] = [];
  let inRegistryNoMetadata: string[] = [];

  console.log('🔍 Checking first 50 cache tokens in registry...');

  for (let i = 0; i < Math.min(50, tokens.length); i++) {
    const token = tokens[i];
    
    try {
      const contract = await registry.getContract(token.contractId);
      
      if (contract) {
        foundInRegistry++;
        if (contract.tokenMetadata) {
          hasTokenMetadata++;
        } else {
          inRegistryNoMetadata.push(token.contractId);
        }
      } else {
        missingFromRegistry.push(token.contractId);
      }
      
      // Progress indicator
      if ((i + 1) % 10 === 0) {
        console.log(`   Checked ${i + 1}/50...`);
      }
    } catch (error) {
      console.log(`   ❌ Error checking ${token.contractId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`\n📈 Cache → Registry Analysis (sample of 50):`);
  console.log(`   ✅ Found in registry: ${foundInRegistry}/50`);
  console.log(`   🪙 Have token metadata: ${hasTokenMetadata}/50`);
  console.log(`   ❌ Missing from registry: ${missingFromRegistry.length}`);
  console.log(`   ⚠️  In registry but no metadata: ${inRegistryNoMetadata.length}`);

  // 4. Check reverse - registry tokens with metadata
  console.log('\n📊 STEP 4: CHECKING REGISTRY → METADATA COVERAGE');
  console.log('-'.repeat(30));

  const tokenContracts = await registry.searchContracts({ 
    contractType: 'token',
    limit: 100
  });

  let registryTokensWithMetadata = 0;
  let registryTokensWithoutMetadata = 0;

  for (const contract of tokenContracts.contracts) {
    if (contract.tokenMetadata) {
      registryTokensWithMetadata++;
    } else {
      registryTokensWithoutMetadata++;
    }
  }

  console.log(`📈 Registry Token Analysis (sample of ${tokenContracts.contracts.length}):`);
  console.log(`   🪙 With token metadata: ${registryTokensWithMetadata}`);
  console.log(`   ❌ Without token metadata: ${registryTokensWithoutMetadata}`);
  
  const metadataCoverage = tokenContracts.contracts.length > 0 
    ? (registryTokensWithMetadata / tokenContracts.contracts.length * 100).toFixed(1)
    : '0.0';
  console.log(`   📊 Coverage: ${metadataCoverage}%`);

  // 5. Show examples of missing metadata
  if (inRegistryNoMetadata.length > 0) {
    console.log('\n🔍 EXAMPLES OF REGISTRY CONTRACTS WITHOUT METADATA:');
    console.log('-'.repeat(30));
    
    for (let i = 0; i < Math.min(5, inRegistryNoMetadata.length); i++) {
      const contractId = inRegistryNoMetadata[i];
      console.log(`❌ ${contractId}`);
      
      // Check if it's in token cache
      const tokenInCache = tokens.find(t => t.contractId === contractId);
      if (tokenInCache) {
        console.log(`   📦 IS in token cache: ${tokenInCache.name} (${tokenInCache.symbol})`);
      } else {
        console.log(`   📦 NOT in token cache`);
      }
    }
  }

  // 6. Show examples of successful metadata
  console.log('\n✅ EXAMPLES OF SUCCESSFUL METADATA MIGRATION:');
  console.log('-'.repeat(30));
  
  const successfulContracts = tokenContracts.contracts.filter(c => c.tokenMetadata).slice(0, 5);
  
  for (const contract of successfulContracts) {
    console.log(`✅ ${contract.contractId}`);
    console.log(`   📝 Name: ${contract.tokenMetadata?.name}`);
    console.log(`   🔤 Symbol: ${contract.tokenMetadata?.symbol}`);
    console.log(`   📅 Last Updated: ${contract.tokenMetadata?.lastUpdated ? new Date(contract.tokenMetadata.lastUpdated).toISOString() : 'N/A'}`);
    console.log('');
  }

  // 7. Check specific well-known tokens that should exist
  console.log('🎯 STEP 5: TESTING WELL-KNOWN TOKENS');
  console.log('-'.repeat(30));
  
  const wellKnownTokens = [
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
    'SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ.nope',
    'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststx-token',  // From our search results
    'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token'  // Known Welsh token
  ];

  for (const contractId of wellKnownTokens) {
    console.log(`🔍 ${contractId}`);
    
    const contract = await registry.getContract(contractId);
    const tokenInCache = tokens.find(t => t.contractId === contractId);
    
    console.log(`   📦 In cache: ${tokenInCache ? '✅' : '❌'}`);
    console.log(`   🏛️ In registry: ${contract ? '✅' : '❌'}`);
    console.log(`   🪙 Has metadata: ${contract?.tokenMetadata ? '✅' : '❌'}`);
    
    if (tokenInCache && contract && !contract.tokenMetadata) {
      console.log(`   ⚠️  SYNC ISSUE: Token exists in cache and registry but metadata not populated`);
    }
    console.log('');
  }

  console.log('📊 FINAL ASSESSMENT');
  console.log('='.repeat(50));
  
  // Calculate overall success rate
  const overallSuccessRate = foundInRegistry > 0 ? (hasTokenMetadata / foundInRegistry * 100).toFixed(1) : '0.0';
  
  console.log(`📈 Migration Success Metrics:`);
  console.log(`   Cache tokens found in registry: ${foundInRegistry}/50 (${(foundInRegistry/50*100).toFixed(1)}%)`);
  console.log(`   Registry tokens with metadata: ${registryTokensWithMetadata}/${tokenContracts.contracts.length} (${metadataCoverage}%)`);
  console.log(`   Overall sync success rate: ${overallSuccessRate}%`);

  // Determine migration status
  if (parseFloat(overallSuccessRate) >= 80) {
    console.log('\n🎯 ✅ MIGRATION STATUS: SUCCESS');
    console.log('   Most tokens have been successfully migrated with metadata');
  } else if (parseFloat(overallSuccessRate) >= 50) {
    console.log('\n⚠️  MIGRATION STATUS: PARTIAL SUCCESS');
    console.log('   Some tokens migrated but significant gaps remain');
  } else {
    console.log('\n❌ MIGRATION STATUS: NEEDS ATTENTION');
    console.log('   Migration appears incomplete or failed');
  }

  console.log('\n💡 RECOMMENDATIONS:');
  if (inRegistryNoMetadata.length > 0) {
    console.log('   1. Re-run syncWithTokenCache() to populate missing metadata');
    console.log('   2. Check sync process logs for errors');
  }
  if (missingFromRegistry.length > 0) {
    console.log('   3. Add missing cache tokens to registry');
  }
  console.log('   4. Set up automated sync to keep metadata current');

  return {
    cacheTokens: tokens.length,
    registryTokens: stats.contractsByType.token,
    foundInRegistry,
    hasTokenMetadata,
    metadataCoverage: parseFloat(metadataCoverage),
    overallSuccessRate: parseFloat(overallSuccessRate)
  };
}

// Run the analysis
comprehensiveMigrationAnalysis().then((result) => {
  console.log('\n✅ Comprehensive migration analysis completed');
  
  // Exit with appropriate status
  if (result.overallSuccessRate >= 70) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Migration analysis failed:', error);
  process.exit(1);
});
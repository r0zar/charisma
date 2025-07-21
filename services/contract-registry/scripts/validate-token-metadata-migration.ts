#!/usr/bin/env tsx

/**
 * Validate Token Metadata Migration - Check if contracts now have tokenMetadata populated
 * 
 * This script validates that the token metadata migration worked correctly by:
 * 1. Checking specific well-known token contracts
 * 2. Verifying they exist in contract-registry 
 * 3. Confirming the tokenMetadata field is populated
 * 4. Analyzing sync issues if metadata is missing
 */

import { ContractRegistry, createDefaultConfig } from '../src/index';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Well-known contracts to test
const TEST_CONTRACTS = [
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
  'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-wstx',
  'SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ.nope'
];

async function validateTokenMetadataMigration() {
  console.log('🔍 VALIDATING TOKEN METADATA MIGRATION');
  console.log('='.repeat(50));

  const config = createDefaultConfig('mainnet-contract-registry');
  const registry = new ContractRegistry(config);

  console.log('✅ Registry initialized\n');

  console.log('🪙 Testing specific well-known token contracts...');
  console.log(`📊 Checking ${TEST_CONTRACTS.length} contracts\n`);

  const results: {
    contractId: string;
    exists: boolean;
    hasTokenMetadata: boolean;
    tokenMetadata?: any;
    contractType?: string;
    implementedTraits?: string[];
    error?: string;
  }[] = [];

  // Check each test contract
  for (const contractId of TEST_CONTRACTS) {
    console.log(`🔍 Checking: ${contractId}`);
    
    try {
      const contract = await registry.getContract(contractId);
      
      if (!contract) {
        console.log('   ❌ Contract not found in registry');
        results.push({
          contractId,
          exists: false,
          hasTokenMetadata: false,
          error: 'Contract not found in registry'
        });
        continue;
      }

      console.log('   ✅ Contract found');
      console.log(`   📝 Type: ${contract.contractType}`);
      console.log(`   🏷️  Traits: ${contract.implementedTraits.join(', ') || 'none'}`);

      const hasTokenMetadata = !!(contract.tokenMetadata);
      console.log(`   🪙 Token Metadata: ${hasTokenMetadata ? '✅ Present' : '❌ Missing'}`);

      if (hasTokenMetadata) {
        console.log(`   📊 Token Name: ${contract.tokenMetadata?.name || 'N/A'}`);
        console.log(`   🔤 Symbol: ${contract.tokenMetadata?.symbol || 'N/A'}`);
        console.log(`   🔢 Decimals: ${contract.tokenMetadata?.decimals ?? 'N/A'}`);
        console.log(`   💰 Price (USD): ${contract.tokenMetadata?.usdPrice ?? 'N/A'}`);
        console.log(`   📅 Last Updated: ${contract.tokenMetadata?.lastUpdated ? new Date(contract.tokenMetadata.lastUpdated).toISOString() : 'N/A'}`);
      }

      results.push({
        contractId,
        exists: true,
        hasTokenMetadata,
        tokenMetadata: contract.tokenMetadata,
        contractType: contract.contractType,
        implementedTraits: contract.implementedTraits
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`   ❌ Error: ${errorMessage}`);
      results.push({
        contractId,
        exists: false,
        hasTokenMetadata: false,
        error: errorMessage
      });
    }
    
    console.log('');
  }

  // Summary analysis
  console.log('📊 MIGRATION VALIDATION SUMMARY');
  console.log('='.repeat(50));

  const existingContracts = results.filter(r => r.exists);
  const contractsWithMetadata = results.filter(r => r.hasTokenMetadata);
  const missingContracts = results.filter(r => !r.exists);
  const contractsWithoutMetadata = results.filter(r => r.exists && !r.hasTokenMetadata);

  console.log(`📈 Found in registry: ${existingContracts.length}/${TEST_CONTRACTS.length}`);
  console.log(`🪙 Have token metadata: ${contractsWithMetadata.length}/${TEST_CONTRACTS.length}`);
  console.log(`❌ Missing from registry: ${missingContracts.length}`);
  console.log(`⚠️  Missing metadata: ${contractsWithoutMetadata.length}`);
  
  if (missingContracts.length > 0) {
    console.log('\n🚨 MISSING CONTRACTS:');
    for (const result of missingContracts) {
      console.log(`   ❌ ${result.contractId}: ${result.error}`);
    }
  }
  
  if (contractsWithoutMetadata.length > 0) {
    console.log('\n⚠️  CONTRACTS WITHOUT TOKEN METADATA:');
    for (const result of contractsWithoutMetadata) {
      console.log(`   🔍 ${result.contractId}`);
      console.log(`      Type: ${result.contractType}`);
      console.log(`      Traits: ${result.implementedTraits?.join(', ') || 'none'}`);
    }
  }

  // Check broader sample from registry
  console.log('\n🔍 CHECKING BROADER TOKEN SAMPLE');
  console.log('='.repeat(50));

  try {
    const tokenContracts = await registry.searchContracts({ 
      contractType: 'token',
      limit: 20
    });

    console.log(`📊 Found ${tokenContracts.contracts.length} token contracts in registry`);
    
    let hasMetadataCount = 0;
    let sampleChecked = 0;
    
    for (const contract of tokenContracts.contracts.slice(0, 10)) {
      sampleChecked++;
      if (contract.tokenMetadata) {
        hasMetadataCount++;
        console.log(`   ✅ ${contract.contractId}: ${contract.tokenMetadata.name} (${contract.tokenMetadata.symbol})`);
      } else {
        console.log(`   ❌ ${contract.contractId}: No token metadata`);
      }
    }
    
    console.log(`\n📈 Metadata coverage in sample: ${hasMetadataCount}/${sampleChecked} (${((hasMetadataCount/sampleChecked)*100).toFixed(1)}%)`);

  } catch (error) {
    console.error('❌ Error checking broader sample:', error);
  }

  // Check sync status
  console.log('\n🔄 SYNC STATUS ANALYSIS');
  console.log('='.repeat(50));

  try {
    const stats = await registry.getStats();
    console.log(`📊 Total contracts: ${stats.totalContracts}`);
    console.log(`🪙 Token contracts: ${stats.contractsByType.token}`);
    console.log(`📅 Last discovery: ${stats.lastDiscovery ? new Date(stats.lastDiscovery).toISOString() : 'Never'}`);
    console.log(`📅 Last analysis: ${stats.lastAnalysis ? new Date(stats.lastAnalysis).toISOString() : 'Never'}`);

    // Check if sync was recent
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    if (stats.lastAnalysis > oneHourAgo) {
      console.log('✅ Recent analysis activity (within 1 hour)');
    } else if (stats.lastAnalysis > oneDayAgo) {
      console.log('⚠️  Analysis activity within 24 hours');
    } else {
      console.log('❌ No recent analysis activity (over 24 hours old)');
    }

  } catch (error) {
    console.error('❌ Error checking sync status:', error);
  }

  // Recommendations
  console.log('\n💡 RECOMMENDATIONS');
  console.log('='.repeat(50));

  const successRate = contractsWithMetadata.length / TEST_CONTRACTS.length;

  if (successRate === 1.0) {
    console.log('🎯 ✅ Migration appears SUCCESSFUL');
    console.log('   All test contracts have token metadata populated');
  } else if (successRate >= 0.7) {
    console.log('⚠️  Migration PARTIALLY SUCCESSFUL');
    console.log('   Most contracts have metadata, but some issues remain');
    console.log('   Recommend re-running sync for missing contracts');
  } else {
    console.log('❌ Migration appears to have FAILED or is INCOMPLETE');
    console.log('   Most test contracts lack token metadata');
    console.log('   Recommend investigating sync process and re-running migration');
  }

  if (missingContracts.length > 0) {
    console.log('\n🔧 For missing contracts:');
    console.log('   1. Check if they exist in the @repo/tokens cache');
    console.log('   2. Run sync process to add them to registry');
    console.log('   3. Verify contract IDs are correct');
  }

  if (contractsWithoutMetadata.length > 0) {
    console.log('\n🔧 For contracts without metadata:');
    console.log('   1. Re-run syncWithTokenCache() for these specific contracts');
    console.log('   2. Check if they exist in @repo/tokens');
    console.log('   3. Verify the sync process is updating existing contracts');
  }

  console.log('\n✅ Token metadata migration validation completed');
  
  return {
    totalTested: TEST_CONTRACTS.length,
    found: existingContracts.length,
    withMetadata: contractsWithMetadata.length,
    successRate,
    results
  };
}

// Run the validation
validateTokenMetadataMigration().then((result) => {
  console.log(`\n📊 Final Results: ${result.withMetadata}/${result.totalTested} contracts have token metadata`);
  
  // Exit with appropriate code
  if (result.successRate >= 0.7) {
    console.log('✅ Validation passed');
    process.exit(0);
  } else {
    console.log('❌ Validation failed - migration needs attention');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Validation script failed:', error);
  process.exit(1);
});
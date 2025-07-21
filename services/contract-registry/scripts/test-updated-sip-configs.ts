#!/usr/bin/env tsx

/**
 * Test Updated SIP Configs - Test the corrected SIP009/SIP010 discovery configurations
 */

import { ContractRegistry, createDefaultConfig } from '../src/index';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function testUpdatedSipConfigs() {
  console.log('🧪 TESTING UPDATED SIP CONFIGURATIONS');
  console.log('='.repeat(60));

  const config = createDefaultConfig('mainnet-contract-registry');
  config.enableDiscovery = true;
  const registry = new ContractRegistry(config);

  console.log('✅ Registry initialized with updated SIP configs\n');

  // Test SIP010 discovery with minimal patterns
  console.log('🪙 Testing SIP010 Discovery (Fungible Tokens)...');
  const sip010Config = {
    traits: [],
    sipStandards: [{
      sipNumber: 'SIP010',
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
      enabled: true
    }],
    apiScan: { enabled: false, batchSize: 3, maxRetries: 1, retryDelay: 50, timeout: 1000, blacklist: [] }
  };

  let startTime = Date.now();
  const sip010Result = await registry.discoverContracts(sip010Config);
  let endTime = Date.now();
  
  console.log(`   ⏱️  ${(endTime - startTime)/1000}s | 📊 Found: ${sip010Result.totalContractsFound} | Added: ${sip010Result.totalContractsAdded}`);
  if (sip010Result.totalContractsFound > 0) {
    console.log(`   🎯 SUCCESS! SIP010 discovery found contracts!`);
    if (sip010Result.results?.[0]?.newContracts) {
      const samples = sip010Result.results[0].newContracts.slice(0, 3);
      console.log(`   📝 Sample contracts: ${samples.join(', ')}`);
    }
  } else {
    console.log(`   ❌ No SIP010 contracts discovered`);
  }

  // Test SIP009 discovery with minimal patterns
  console.log('\n🖼️  Testing SIP009 Discovery (NFTs)...');
  const sip009Config = {
    traits: [],
    sipStandards: [{
      sipNumber: 'SIP009',
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
      enabled: true
    }],
    apiScan: { enabled: false, batchSize: 3, maxRetries: 1, retryDelay: 50, timeout: 1000, blacklist: [] }
  };

  startTime = Date.now();
  const sip009Result = await registry.discoverContracts(sip009Config);
  endTime = Date.now();
  
  console.log(`   ⏱️  ${(endTime - startTime)/1000}s | 📊 Found: ${sip009Result.totalContractsFound} | Added: ${sip009Result.totalContractsAdded}`);
  if (sip009Result.totalContractsFound > 0) {
    console.log(`   🎯 SUCCESS! SIP009 discovery found contracts!`);
    if (sip009Result.results?.[0]?.newContracts) {
      const samples = sip009Result.results[0].newContracts.slice(0, 3);
      console.log(`   📝 Sample contracts: ${samples.join(', ')}`);
    }
  } else {
    console.log(`   ❌ No SIP009 contracts discovered`);
  }

  // Test individual function discovery to validate our findings
  console.log('\n🔍 Testing Individual Function Discovery...');
  
  const transferOnlyConfig = {
    traits: [{
      trait: {
        name: 'Transfer Function',
        description: 'Any transfer function',
        functions: [{ name: "transfer", access: "public", args: [] }]
      },
      enabled: true,
      priority: 1,
      batchSize: 2
    }],
    sipStandards: [],
    apiScan: { enabled: false, batchSize: 2, maxRetries: 1, retryDelay: 50, timeout: 500, blacklist: [] }
  };

  startTime = Date.now();
  const transferResult = await registry.discoverContracts(transferOnlyConfig);
  endTime = Date.now();
  
  console.log(`   Transfer functions: ${(endTime - startTime)/1000}s | Found: ${transferResult.totalContractsFound}`);

  // Summary
  console.log('\n📊 DISCOVERY RESULTS SUMMARY:');
  console.log(`   • SIP010 (Fungible): Found ${sip010Result.totalContractsFound}, Added ${sip010Result.totalContractsAdded}`);
  console.log(`   • SIP009 (NFT): Found ${sip009Result.totalContractsFound}, Added ${sip009Result.totalContractsAdded}`);
  console.log(`   • Transfer functions: Found ${transferResult.totalContractsFound}`);
  
  console.log('\n🔑 KEY INSIGHTS:');
  console.log('   • Discovery uses minimal args: [] patterns to FIND contracts');
  console.log('   • Compliance validation happens separately via ABI analysis');
  console.log('   • This two-step approach allows effective automated discovery');

  // Show any errors
  const allResults = [
    { name: 'SIP010', result: sip010Result },
    { name: 'SIP009', result: sip009Result },
    { name: 'Transfer', result: transferResult }
  ];

  for (const { name, result } of allResults) {
    if (result.errors && result.errors.length > 0) {
      console.log(`\n⚠️ ${name} Errors:`)
      result.errors.slice(0, 2).forEach(error => {
        console.log(`   • ${error}`);
      });
    }
  }

  console.log('\n✅ Updated SIP configuration testing completed');
}

// Run the test
testUpdatedSipConfigs().then(() => {
  console.log('\n✅ All SIP configuration tests completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
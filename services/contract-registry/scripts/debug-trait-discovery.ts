#!/usr/bin/env tsx

/**
 * Debug Trait Discovery - Minimal test to understand what's happening
 */

import { ContractRegistry, createDefaultConfig } from '../src/index';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function debugTraitDiscovery() {
  console.log('🔬 DEBUG TRAIT DISCOVERY');
  console.log('='.repeat(50));

  try {
    const config = createDefaultConfig('mainnet-contract-registry');
    config.enableDiscovery = true;
    const registry = new ContractRegistry(config);

    console.log('✅ Registry initialized with discovery enabled');

    // Test 1: Try to match the exact SIP010 pattern that's working
    console.log('\n🧪 Test 1: SIP010-like transfer function...');
    const sip010Config = {
      traits: [{
        trait: {
          name: 'SIP010 Transfer',
          description: 'SIP010 transfer function',
          functions: [{
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
          }]
        },
        enabled: true,
        priority: 1,
        batchSize: 5
      }],
      sipStandards: [],
      apiScan: { enabled: false, batchSize: 100, maxRetries: 1, retryDelay: 50, timeout: 1000, blacklist: [] }
    };

    console.log('⏳ Starting SIP010 discovery...');
    let startTime = Date.now();
    
    const sip010Result = await registry.discoverContracts(sip010Config);
    
    let endTime = Date.now();
    console.log(`✅ SIP010 test completed in ${(endTime - startTime)/1000}s`);
    console.log(`   Found: ${sip010Result.totalContractsFound} | Processed: ${sip010Result.totalContractsProcessed} | Added: ${sip010Result.totalContractsAdded}`);

    // Test 2: Try SIP Standard discovery instead of custom traits
    console.log('\n🧪 Test 2: Using built-in SIP010 standard...');
    const sipStandardConfig = {
      traits: [],
      sipStandards: [{
        sipNumber: 'SIP010',
        trait: {
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
            }
          ]
        },
        enabled: true
      }],
      apiScan: { enabled: false, batchSize: 100, maxRetries: 1, retryDelay: 50, timeout: 1000, blacklist: [] }
    };

    console.log('⏳ Starting SIP standard discovery...');
    startTime = Date.now();
    
    const sipStandardResult = await registry.discoverContracts(sipStandardConfig);
    
    endTime = Date.now();
    console.log(`✅ SIP standard test completed in ${(endTime - startTime)/1000}s`);
    console.log(`   Found: ${sipStandardResult.totalContractsFound} | Processed: ${sipStandardResult.totalContractsProcessed} | Added: ${sipStandardResult.totalContractsAdded}`);

    // Test 3: Try a very simple transfer function  
    console.log('\n🧪 Test 3: Simple transfer function...');
    const simpleConfig = {
      traits: [{
        trait: {
          name: 'Simple Transfer',
          description: 'Any transfer function',
          functions: [{
            name: "transfer",
            access: "public",
            args: [],
            outputs: { type: "*" }  // Match any output
          }]
        },
        enabled: true,
        priority: 1,
        batchSize: 5
      }],
      sipStandards: [],
      apiScan: { enabled: false, batchSize: 100, maxRetries: 1, retryDelay: 50, timeout: 1000, blacklist: [] }
    };

    console.log('⏳ Starting simple discovery...');
    startTime = Date.now();
    
    const result = await registry.discoverContracts(simpleConfig);
    
    endTime = Date.now();
    console.log(`✅ Simple test completed in ${(endTime - startTime)/1000}s`);
    console.log(`   Found: ${result.totalContractsFound} | Processed: ${result.totalContractsProcessed} | Added: ${result.totalContractsAdded}`);

    // Summary
    console.log('\n📊 SUMMARY:');
    console.log(`   SIP010 Trait: Found ${sip010Result.totalContractsFound}, Added ${sip010Result.totalContractsAdded}`);
    console.log(`   SIP Standard: Found ${sipStandardResult.totalContractsFound}, Added ${sipStandardResult.totalContractsAdded}`);
    console.log(`   Simple Trait: Found ${result.totalContractsFound}, Added ${result.totalContractsAdded}`);

    // Show details for any successful discovery
    const allResults = [
      { name: 'SIP010 Trait', result: sip010Result },
      { name: 'SIP Standard', result: sipStandardResult },
      { name: 'Simple Trait', result }
    ];

    for (const { name, result: testResult } of allResults) {
      if (testResult.totalContractsFound > 0) {
        console.log(`\n🎯 ${name} SUCCESS!`);
        if (testResult.results && testResult.results[0] && testResult.results[0].newContracts) {
          const sample = testResult.results[0].newContracts.slice(0, 3);
          console.log(`   Sample contracts: ${sample.join(', ')}`);
        }
      }
      if (testResult.errors && testResult.errors.length > 0) {
        console.log(`\n⚠️ ${name} Errors:`);
        testResult.errors.slice(0, 2).forEach(error => {
          console.log(`   • ${error}`);
        });
      }
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('Stack:', error.stack.split('\n').slice(0, 10).join('\n'));
    }
  }
}

// Run the debug
debugTraitDiscovery().then(() => {
  console.log('\n✅ Debug completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Debug failed:', error);
  process.exit(1);
});
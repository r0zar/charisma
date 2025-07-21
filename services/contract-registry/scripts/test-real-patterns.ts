#!/usr/bin/env tsx

/**
 * Test Real Patterns - Test trait discovery based on actual contract patterns
 */

import { ContractRegistry, createDefaultConfig } from '../src/index';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function testRealPatterns() {
  console.log('🧪 TESTING REAL CONTRACT PATTERNS');
  console.log('='.repeat(60));

  try {
    const config = createDefaultConfig('mainnet-contract-registry');
    config.enableDiscovery = true;
    const registry = new ContractRegistry(config);

    console.log('✅ Registry initialized with discovery enabled');

    // Pattern 1: Match the actual transfer function we saw: (amount uint) not (amount uint128)
    console.log('\n🧪 Pattern 1: Real SIP010 transfer with uint...');
    const realPattern = {
      traits: [{
        trait: {
          name: 'Real Transfer Pattern',
          description: 'Transfer function with uint type',
          functions: [{
            name: "transfer",
            access: "public",
            args: [
              { name: "amount", type: "uint" },  // Key: uint not uint128
              { name: "sender", type: "principal" },
              { name: "recipient", type: "principal" }
            ],
            outputs: {
              type: {
                response: {
                  ok: "bool",
                  error: "uint"
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
      apiScan: { enabled: false, batchSize: 5, maxRetries: 1, retryDelay: 50, timeout: 1000, blacklist: [] }
    };

    let startTime = Date.now();
    const result1 = await registry.discoverContracts(realPattern);
    let endTime = Date.now();
    console.log(`   ⏱️  ${(endTime - startTime)/1000}s | Found: ${result1.totalContractsFound} | Added: ${result1.totalContractsAdded}`);

    // Pattern 2: Even simpler - just match function name and access
    console.log('\n🧪 Pattern 2: Just function name "transfer"...');
    const nameOnlyPattern = {
      traits: [{
        trait: {
          name: 'Transfer Name Only',
          description: 'Match any public transfer function',
          functions: [{
            name: "transfer",
            access: "public"
            // No args or outputs - just name and access
          }]
        },
        enabled: true,
        priority: 1,
        batchSize: 5
      }],
      sipStandards: [],
      apiScan: { enabled: false, batchSize: 5, maxRetries: 1, retryDelay: 50, timeout: 1000, blacklist: [] }
    };

    startTime = Date.now();
    const result2 = await registry.discoverContracts(nameOnlyPattern);
    endTime = Date.now();
    console.log(`   ⏱️  ${(endTime - startTime)/1000}s | Found: ${result2.totalContractsFound} | Added: ${result2.totalContractsAdded}`);

    // Pattern 3: Try with alternative parameter names (from/to instead of sender/recipient)
    console.log('\n🧪 Pattern 3: Transfer with from/to parameters...');
    const fromToPattern = {
      traits: [{
        trait: {
          name: 'Transfer From To',
          description: 'Transfer with from/to parameter names',
          functions: [{
            name: "transfer",
            access: "public",
            args: [
              { name: "amount", type: "uint" },
              { name: "from", type: "principal" },  // Different param name
              { name: "to", type: "principal" }     // Different param name
            ],
            outputs: {
              type: {
                response: {
                  ok: "bool",
                  error: "uint"
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
      apiScan: { enabled: false, batchSize: 5, maxRetries: 1, retryDelay: 50, timeout: 1000, blacklist: [] }
    };

    startTime = Date.now();
    const result3 = await registry.discoverContracts(fromToPattern);
    endTime = Date.now();
    console.log(`   ⏱️  ${(endTime - startTime)/1000}s | Found: ${result3.totalContractsFound} | Added: ${result3.totalContractsAdded}`);

    // Pattern 4: Try common get-name function
    console.log('\n🧪 Pattern 4: get-name function...');
    const getNamePattern = {
      traits: [{
        trait: {
          name: 'Get Name Function',
          description: 'SIP010 get-name function',
          functions: [{
            name: "get-name",
            access: "read_only"
            // No args or specific outputs
          }]
        },
        enabled: true,
        priority: 1,
        batchSize: 5
      }],
      sipStandards: [],
      apiScan: { enabled: false, batchSize: 5, maxRetries: 1, retryDelay: 50, timeout: 1000, blacklist: [] }
    };

    startTime = Date.now();
    const result4 = await registry.discoverContracts(getNamePattern);
    endTime = Date.now();
    console.log(`   ⏱️  ${(endTime - startTime)/1000}s | Found: ${result4.totalContractsFound} | Added: ${result4.totalContractsAdded}`);

    // Pattern 5: Try wildcard/any function
    console.log('\n🧪 Pattern 5: Wildcard function match...');
    const wildcardPattern = {
      traits: [{
        trait: {
          name: 'Any Function',
          description: 'Match any function',
          functions: [{
            name: "*",
            access: "*"
          }]
        },
        enabled: true,
        priority: 1,
        batchSize: 2  // Smaller batch for wildcard
      }],
      sipStandards: [],
      apiScan: { enabled: false, batchSize: 2, maxRetries: 1, retryDelay: 50, timeout: 1000, blacklist: [] }
    };

    startTime = Date.now();
    const result5 = await registry.discoverContracts(wildcardPattern);
    endTime = Date.now();
    console.log(`   ⏱️  ${(endTime - startTime)/1000}s | Found: ${result5.totalContractsFound} | Added: ${result5.totalContractsAdded}`);

    // Summary
    console.log('\n📊 RESULTS SUMMARY:');
    const patterns = [
      { name: 'Real uint pattern', result: result1 },
      { name: 'Name only', result: result2 },
      { name: 'From/To params', result: result3 },
      { name: 'Get-name function', result: result4 },
      { name: 'Wildcard', result: result5 }
    ];

    patterns.forEach(({ name, result }) => {
      console.log(`   • ${name}: Found ${result.totalContractsFound}, Added ${result.totalContractsAdded}`);
      if (result.totalContractsFound > 0) {
        console.log(`     🎯 SUCCESS! This pattern works!`);
        if (result.results?.[0]?.newContracts?.length > 0) {
          const samples = result.results[0].newContracts.slice(0, 2);
          console.log(`     📝 Sample contracts: ${samples.join(', ')}`);
        }
      }
      if (result.errors && result.errors.length > 0) {
        console.log(`     ⚠️ Errors: ${result.errors.slice(0, 1).join('')}`);
      }
    });

  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : String(error));
  }
}

// Run the test
testRealPatterns().then(() => {
  console.log('\n✅ Real pattern testing completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
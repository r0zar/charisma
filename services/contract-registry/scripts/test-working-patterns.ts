#!/usr/bin/env tsx

/**
 * Test Working Patterns - Focus on patterns that show promise
 */

import { ContractRegistry, createDefaultConfig } from '../src/index';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function testWorkingPatterns() {
  console.log('🎯 TESTING WORKING PATTERNS');
  console.log('='.repeat(50));

  const config = createDefaultConfig('mainnet-contract-registry');
  config.enableDiscovery = true;
  const registry = new ContractRegistry(config);

  console.log('✅ Registry initialized\n');

  // Test the pattern that was working: "Name + access + empty args"
  const workingPattern = {
    name: "Transfer: name + access + empty args",
    trait: {
      name: 'Transfer',
      description: 'Transfer function',
      functions: [{
        name: "transfer",
        access: "public",
        args: []
      }]
    }
  };

  console.log(`🧪 Testing: ${workingPattern.name}`);
  
  try {
    const config = {
      traits: [{
        trait: workingPattern.trait,
        enabled: true,
        priority: 1,
        batchSize: 2  // Small batch for quick test
      }],
      sipStandards: [],
      apiScan: { enabled: false, batchSize: 2, maxRetries: 1, retryDelay: 50, timeout: 1000, blacklist: [] }
    };

    const startTime = Date.now();
    const result = await registry.discoverContracts(config);
    const duration = Date.now() - startTime;
    
    console.log(`   ⏱️  ${(duration/1000).toFixed(2)}s | 📊 Found: ${result.totalContractsFound} | Added: ${result.totalContractsAdded}`);
    
    if (result.totalContractsFound > 0) {
      console.log(`   🎯 SUCCESS! Found contracts!`);
      if (result.results?.[0]?.newContracts) {
        const samples = result.results[0].newContracts.slice(0, 5);
        console.log(`   📝 Sample contracts: ${samples.join(', ')}`);
      }
    }
    
    if (result.errors && result.errors.length > 0) {
      console.log(`   ⚠️  First error: ${result.errors[0]}`);
    }
    
  } catch (error) {
    console.log(`   ❌ Exception: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log('\n✅ Working pattern test completed');
}

// Run the test
testWorkingPatterns().then(() => {
  console.log('\n✅ Pattern testing completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
#!/usr/bin/env tsx

/**
 * Confirm Syntax - Test the confirmed working patterns with other functions
 */

import { ContractRegistry, createDefaultConfig } from '../src/index';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function confirmSyntax() {
  console.log('✅ CONFIRMING WORKING SYNTAX');
  console.log('='.repeat(50));

  const config = createDefaultConfig('mainnet-contract-registry');
  config.enableDiscovery = true;
  const registry = new ContractRegistry(config);

  console.log('✅ Registry initialized\n');

  // Test patterns that should work based on our discovery
  const patterns = [
    {
      name: "transfer (working pattern)",
      trait: {
        name: 'Transfer',
        description: 'Transfer function',
        functions: [{
          name: "transfer",
          access: "public",
          args: []  // KEY: empty args array required
        }]
      }
    },
    {
      name: "get-name (read_only)",
      trait: {
        name: 'GetName',
        description: 'Get name function',
        functions: [{
          name: "get-name",
          access: "read_only",
          args: []  // KEY: empty args array required
        }]
      }
    },
    {
      name: "get-balance (read_only)",
      trait: {
        name: 'GetBalance',
        description: 'Get balance function',
        functions: [{
          name: "get-balance",
          access: "read_only", 
          args: []
        }]
      }
    }
  ];

  console.log(`🧪 Testing ${patterns.length} confirmed patterns...\n`);

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    console.log(`${i+1}. ${pattern.name}`);
    
    try {
      const discoveryConfig = {
        traits: [{
          trait: pattern.trait,
          enabled: true,
          priority: 1,
          batchSize: 1  // Minimal batch for speed
        }],
        sipStandards: [],
        apiScan: { enabled: false, batchSize: 1, maxRetries: 1, retryDelay: 50, timeout: 500, blacklist: [] }
      };

      const startTime = Date.now();
      const result = await registry.discoverContracts(discoveryConfig);
      const duration = Date.now() - startTime;
      
      console.log(`   ⏱️  ${(duration/1000).toFixed(2)}s | 📊 Found: ${result.totalContractsFound}`);
      
      if (result.totalContractsFound > 0) {
        console.log(`   🎯 WORKS! This syntax is correct`);
      } else {
        console.log(`   ❌ No matches found`);
      }
      
    } catch (error) {
      console.log(`   ❌ Exception: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    console.log('');
  }

  console.log('📋 CONFIRMED WORKING SYNTAX:');
  console.log('   {');
  console.log('     name: "function-name",');
  console.log('     access: "public" | "read_only",');
  console.log('     args: []  // REQUIRED: empty array');
  console.log('   }');
  console.log('');
  console.log('🔑 KEY INSIGHT: The args: [] field is REQUIRED for pattern matching,');
  console.log('   even when empty. Without it, 0 contracts are found.');

  console.log('\n✅ Syntax confirmation completed');
}

// Run the test
confirmSyntax().then(() => {
  console.log('\n✅ All syntax tests completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
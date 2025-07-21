#!/usr/bin/env tsx

/**
 * Debug Minimal Transfer - Test the absolute minimum transfer function patterns
 */

import { ContractRegistry, createDefaultConfig } from '../src/index';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function debugMinimalTransfer() {
  console.log('🔬 DEBUG MINIMAL TRANSFER PATTERNS');
  console.log('='.repeat(50));

  const config = createDefaultConfig('mainnet-contract-registry');
  config.enableDiscovery = true;
  const registry = new ContractRegistry(config);

  console.log('✅ Registry initialized\n');

  // Test different minimal transfer function definitions
  const transferVariations = [
    {
      name: "1. Just name",
      trait: {
        name: 'Transfer',
        description: 'Transfer function',
        functions: [{
          name: "transfer"
        }]
      }
    },
    {
      name: "2. Name + access",
      trait: {
        name: 'Transfer',
        description: 'Transfer function',
        functions: [{
          name: "transfer",
          access: "public"
        }]
      }
    },
    {
      name: "3. Name + access + empty args",
      trait: {
        name: 'Transfer',
        description: 'Transfer function', 
        functions: [{
          name: "transfer",
          access: "public",
          args: []
        }]
      }
    },
    {
      name: "4. Name + access + undefined args",
      trait: {
        name: 'Transfer',
        description: 'Transfer function',
        functions: [{
          name: "transfer",
          access: "public",
          args: undefined
        }]
      }
    },
    {
      name: "5. Name + access + null outputs",
      trait: {
        name: 'Transfer',
        description: 'Transfer function',
        functions: [{
          name: "transfer", 
          access: "public",
          outputs: null
        }]
      }
    },
    {
      name: "6. Name + access + undefined outputs",
      trait: {
        name: 'Transfer',
        description: 'Transfer function',
        functions: [{
          name: "transfer",
          access: "public", 
          outputs: undefined
        }]
      }
    },
    {
      name: "7. Name + access + empty object outputs",
      trait: {
        name: 'Transfer',
        description: 'Transfer function',
        functions: [{
          name: "transfer",
          access: "public",
          outputs: {}
        }]
      }
    },
    {
      name: "8. Name + access + any type outputs",
      trait: {
        name: 'Transfer',
        description: 'Transfer function',
        functions: [{
          name: "transfer",
          access: "public",
          outputs: { type: "any" }
        }]
      }
    },
    {
      name: "9. Name + access + wildcard outputs",
      trait: {
        name: 'Transfer',
        description: 'Transfer function',
        functions: [{
          name: "transfer",
          access: "public",
          outputs: { type: "*" }
        }]
      }
    },
    {
      name: "10. Name + access + string outputs",
      trait: {
        name: 'Transfer',
        description: 'Transfer function',
        functions: [{
          name: "transfer",
          access: "public",
          outputs: "any"
        }]
      }
    },
    {
      name: "11. Just name (no access)",
      trait: {
        name: 'Transfer',
        description: 'Transfer function',
        functions: [{
          name: "transfer",
          args: [],
          outputs: {}
        }]
      }
    },
    {
      name: "12. Name + any access",
      trait: {
        name: 'Transfer',
        description: 'Transfer function',
        functions: [{
          name: "transfer",
          access: "*"
        }]
      }
    }
  ];

  console.log(`🧪 Testing ${transferVariations.length} minimal transfer variations...\n`);

  for (let i = 0; i < transferVariations.length; i++) {
    const variation = transferVariations[i];
    console.log(`${variation.name}`);
    
    try {
      const config = {
        traits: [{
          trait: variation.trait,
          enabled: true,
          priority: 1,
          batchSize: 3
        }],
        sipStandards: [],
        apiScan: { enabled: false, batchSize: 3, maxRetries: 1, retryDelay: 100, timeout: 2000, blacklist: [] }
      };

      const startTime = Date.now();
      const result = await registry.discoverContracts(config);
      const duration = Date.now() - startTime;
      
      console.log(`   ⏱️  ${(duration/1000).toFixed(2)}s | 📊 Found: ${result.totalContractsFound} | Added: ${result.totalContractsAdded}`);
      
      if (result.totalContractsFound > 0) {
        console.log(`   🎯 SUCCESS! Found contracts!`);
        if (result.results?.[0]?.newContracts) {
          const samples = result.results[0].newContracts.slice(0, 2);
          console.log(`   📝 Samples: ${samples.join(', ')}`);
        }
      }
      
      if (result.errors && result.errors.length > 0) {
        console.log(`   ⚠️  Error: ${result.errors[0]}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Exception: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    console.log('');
  }

  // Also test some get-name variations since that's very common
  console.log('🧪 Testing get-name variations...\n');
  
  const getNameVariations = [
    {
      name: "get-name (just name)",
      trait: {
        name: 'GetName',
        description: 'Get name function',
        functions: [{ name: "get-name" }]
      }
    },
    {
      name: "get-name (name + read_only)",
      trait: {
        name: 'GetName', 
        description: 'Get name function',
        functions: [{ name: "get-name", access: "read_only" }]
      }
    }
  ];

  for (const variation of getNameVariations) {
    console.log(`${variation.name}`);
    
    try {
      const config = {
        traits: [{
          trait: variation.trait,
          enabled: true,
          priority: 1,
          batchSize: 3
        }],
        sipStandards: [],
        apiScan: { enabled: false, batchSize: 3, maxRetries: 1, retryDelay: 100, timeout: 2000, blacklist: [] }
      };

      const startTime = Date.now();
      const result = await registry.discoverContracts(config);
      const duration = Date.now() - startTime;
      
      console.log(`   ⏱️  ${(duration/1000).toFixed(2)}s | 📊 Found: ${result.totalContractsFound} | Added: ${result.totalContractsAdded}`);
      
      if (result.totalContractsFound > 0) {
        console.log(`   🎯 SUCCESS! Found contracts!`);
      }
      
    } catch (error) {
      console.log(`   ❌ Exception: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    console.log('');
  }

  console.log('✅ All minimal pattern tests completed');
}

// Run the debug
debugMinimalTransfer().then(() => {
  console.log('\n✅ Minimal transfer debugging completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Debug failed:', error);
  process.exit(1);
});
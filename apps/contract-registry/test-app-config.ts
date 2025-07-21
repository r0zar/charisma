#!/usr/bin/env tsx

/**
 * Test the app's contract registry configuration
 */

import { getContractRegistry } from './src/lib/contract-registry';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function testAppConfig() {
  console.log('🧪 Testing app contract registry configuration...\n');
  
  try {
    console.log('1. Creating registry using app config...');
    const registry = getContractRegistry();
    console.log('   ✅ Registry created successfully\n');

    console.log('2. Testing getAllContracts()...');
    const allContracts = await registry.getAllContracts();
    console.log(`   ✅ Found ${allContracts.length} contracts total\n`);

    console.log('3. Testing searchContracts()...');
    const searchResult = await registry.searchContracts({ offset: 0, limit: 5 });
    console.log(`   ✅ Search found ${searchResult.total} contracts, returning ${searchResult.contracts.length}`);
    console.log(`   📄 First few contracts:`);
    searchResult.contracts.forEach((contract, idx) => {
      console.log(`     ${idx + 1}. ${contract.contractId} (${contract.contractType})`);
    });
    console.log();

    console.log('4. Testing getStats()...');
    const stats = await registry.getStats();
    console.log(`   ✅ Stats: ${stats.totalContracts} total contracts`);
    console.log(`   📊 By type: ${JSON.stringify(stats.contractsByType)}`);
    console.log();

    if (allContracts.length > 0 && searchResult.total > 0) {
      console.log('🎉 App configuration is working correctly!');
      console.log(`The app should be able to display ${searchResult.total} contracts.`);
    } else {
      console.log('❌ App configuration has issues:');
      console.log(`  getAllContracts(): ${allContracts.length}`);
      console.log(`  searchContracts(): ${searchResult.total}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAppConfig();
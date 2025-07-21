#!/usr/bin/env node

// Simple performance test for bulk operations without vitest overhead
import { ContractRegistry, createDefaultConfig } from '../../index.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function testBulkPerformance() {
  console.log('🚀 Testing bulk performance with new concurrency settings...');
  
  const config = createDefaultConfig('mainnet-contract-registry');
  const registry = new ContractRegistry(config);

  try {
    // Get a small sample of contracts for testing
    console.log('📊 Getting contract list...');
    const allContracts = await registry.getAllContracts();
    console.log(`Found ${allContracts.length} total contracts`);
    
    if (allContracts.length === 0) {
      console.log('❌ No contracts found in registry');
      return;
    }

    // Test with small batch first
    const testContracts = allContracts.slice(0, 5);
    console.log(`\n🧪 Testing bulk retrieval of ${testContracts.length} contracts...`);
    
    const startTime = performance.now();
    const result = await registry.getContracts(testContracts);
    const endTime = performance.now();
    
    const duration = endTime - startTime;
    const throughput = testContracts.length / (duration / 1000);
    
    console.log(`\n✅ Results:`);
    console.log(`   Duration: ${duration.toFixed(1)}ms`);
    console.log(`   Successful: ${result.successful.length}`);
    console.log(`   Failed: ${result.failed.length}`);
    console.log(`   Throughput: ${throughput.toFixed(1)} contracts/second`);
    
    // Test with larger batch if first succeeds
    if (allContracts.length >= 20) {
      const largerTestContracts = allContracts.slice(0, 20);
      console.log(`\n🚀 Testing larger batch of ${largerTestContracts.length} contracts...`);
      
      const startTime2 = performance.now();
      const result2 = await registry.getContracts(largerTestContracts);
      const endTime2 = performance.now();
      
      const duration2 = endTime2 - startTime2;
      const throughput2 = largerTestContracts.length / (duration2 / 1000);
      
      console.log(`\n✅ Larger batch results:`);
      console.log(`   Duration: ${duration2.toFixed(1)}ms`);
      console.log(`   Successful: ${result2.successful.length}`);
      console.log(`   Failed: ${result2.failed.length}`);
      console.log(`   Throughput: ${throughput2.toFixed(1)} contracts/second`);
      
      // Compare with old sequential approach (simulate)
      const oldThroughput = 12; // Previous measured throughput
      const improvement = throughput2 / oldThroughput;
      console.log(`\n📈 Performance comparison:`);
      console.log(`   Previous throughput: ~${oldThroughput} contracts/second`);
      console.log(`   New throughput: ${throughput2.toFixed(1)} contracts/second`);
      console.log(`   Improvement: ${improvement.toFixed(1)}x faster`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : String(error));
  }
}

// Set debug performance logging
process.env.DEBUG_PERFORMANCE = 'true';

// Run test
testBulkPerformance()
  .then(() => {
    console.log('\n🎉 Performance test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Performance test failed:', error);
    process.exit(1);
  });
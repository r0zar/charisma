#!/usr/bin/env tsx

/**
 * Test the batch update fix to ensure all data persists
 */

import { blobStorageService } from '../services/blob-storage-service';

async function testBatchUpdate() {
  try {
    console.log('🧪 TESTING BATCH UPDATE FIX');
    console.log('='.repeat(40));

    // Create test data similar to the seeding script
    const testAddresses = {
      'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9': {
        balances: { stx: { balance: '1000000000000' } }
      },
      'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS': {
        balances: { stx: { balance: '2000000000000' } }
      },
      'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1': {
        balances: { stx: { balance: '500000000000' } }
      }
    };

    const testContracts = {
      'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token': {
        metadata: { name: 'charisma-token', symbol: 'CHA' }
      },
      'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token': {
        metadata: { name: 'welshcorgicoin-token', symbol: 'WELSH' }
      }
    };

    const testPrices = {
      'CHA-USDA': {
        current: { price: '1.25', timestamp: new Date().toISOString() }
      },
      'WELSH-USDA': {
        current: { price: '0.0001', timestamp: new Date().toISOString() }
      }
    };

    console.log('📊 Test data prepared:');
    console.log(`  - ${Object.keys(testAddresses).length} addresses`);
    console.log(`  - ${Object.keys(testContracts).length} contracts`);
    console.log(`  - ${Object.keys(testPrices).length} price pairs`);

    // Clear existing data first
    console.log('\n🧹 Clearing existing data...');
    blobStorageService.clearCache();

    // Method 1: Test batch update
    console.log('\n🔄 Testing batch update...');
    await blobStorageService.putBatch([
      { path: 'addresses', data: testAddresses },
      { path: 'contracts', data: testContracts },
      { path: 'prices', data: testPrices }
    ]);

    console.log('✅ Batch update completed');

    // Verify all data persisted
    console.log('\n🔍 Verifying data persistence...');
    blobStorageService.clearCache(); // Clear cache to force fresh fetch
    
    const rootBlob = await blobStorageService.getRoot();
    
    const addressCount = Object.keys(rootBlob.addresses || {}).length;
    const contractCount = Object.keys(rootBlob.contracts || {}).length;
    const priceCount = Object.keys(rootBlob.prices || {}).length;

    console.log(`📊 Retrieved data counts:`);
    console.log(`  - Addresses: ${addressCount} (expected: 3)`);
    console.log(`  - Contracts: ${contractCount} (expected: 2)`);
    console.log(`  - Prices: ${priceCount} (expected: 2)`);

    // Test individual retrieval
    console.log('\n🔍 Testing individual path retrieval...');
    
    try {
      const addresses = await blobStorageService.get('addresses');
      console.log(`✅ Addresses: ${Object.keys(addresses).length} items`);
    } catch (error) {
      console.log(`❌ Failed to get addresses: ${error}`);
    }

    try {
      const contracts = await blobStorageService.get('contracts');
      console.log(`✅ Contracts: ${Object.keys(contracts).length} items`);
    } catch (error) {
      console.log(`❌ Failed to get contracts: ${error}`);
    }

    try {
      const prices = await blobStorageService.get('prices');
      console.log(`✅ Prices: ${Object.keys(prices).length} items`);
    } catch (error) {
      console.log(`❌ Failed to get prices: ${error}`);
    }

    // Success check
    const success = addressCount === 3 && contractCount === 2 && priceCount === 2;
    console.log(`\n${success ? '✅' : '❌'} Test ${success ? 'PASSED' : 'FAILED'}`);
    
    if (success) {
      console.log('🎉 Batch update fix is working correctly!');
    } else {
      console.log('💥 Batch update still has issues - data is being lost');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testBatchUpdate();
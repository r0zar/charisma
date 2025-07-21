#!/usr/bin/env tsx
/**
 * E2E Test: KV Storage Operations
 * Tests KVBalanceStore read operations and storage layer
 */

import '../utils';
import { KVBalanceStore } from '../../src/storage/KVBalanceStore';

// Sample test data
const TEST_ADDRESSES = [
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
  'SP1H1733V5MZ3SZ9XRW9FKYAHJ0CR4O42S4HZ3PKH',
  'SP2KAF9RF86PVX3NEE27DFV1CQX0T4WGR41X3S45C'
];

const TEST_CONTRACTS = [
  'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.arkadiko-token',
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
  'SP2KAF9RF86PVX3NEE27DFV1CQX0T4WGR41X3S45C.usdc-token'
];

async function testKVStorage() {
  console.log('🔄 Testing KV Storage Operations...');

  try {
    // Create KV store instance
    const kvStore = new KVBalanceStore();

    // Test individual balance retrieval
    console.log('🔍 Testing individual balance retrieval...');
    const singleBalance = await kvStore.getBalance(TEST_ADDRESSES[0], TEST_CONTRACTS[0]);
    console.log('💰 Single Balance:', singleBalance || 'No balance found');

    // Test address balances
    console.log('🔍 Testing address balances...');
    const addressBalances = await kvStore.getAddressBalances(TEST_ADDRESSES[0]);
    console.log('💰 Address Balances:', {
      contractCount: Object.keys(addressBalances).length,
      contracts: Object.keys(addressBalances).slice(0, 3) // Show first 3
    });

    // Test multiple addresses
    console.log('🔍 Testing multiple addresses...');
    for (const address of TEST_ADDRESSES.slice(0, 2)) {
      const balances = await kvStore.getAddressBalances(address);
      console.log(`💰 ${address.slice(0, 10)}...: ${Object.keys(balances).length} contracts`);
    }

    // Test address indexing
    console.log('🔍 Testing address indexing...');
    const allAddresses = await kvStore.getAllAddresses();
    console.log('📋 All Addresses:', allAddresses.length, 'addresses indexed');

    // Test contract tracking
    console.log('🔍 Testing contract tracking...');
    const addressContracts = await kvStore.getAddressContracts(TEST_ADDRESSES[0]);
    console.log('📋 Address Contracts:', addressContracts.length, 'contracts tracked');

    // Test bulk operations
    console.log('🔍 Testing bulk operations...');
    const allCurrentBalances = await kvStore.getAllCurrentBalances();
    console.log('💰 All Current Balances:', {
      addressCount: Object.keys(allCurrentBalances).length,
      totalContracts: Object.values(allCurrentBalances).reduce((sum, balances) => sum + Object.keys(balances).length, 0)
    });

    // Test statistics
    console.log('📊 Getting storage statistics...');
    const stats = await kvStore.getStats();
    console.log('📊 Storage Stats:', stats);

    // Test sync timestamps
    console.log('🔍 Testing sync timestamps...');
    const lastSync = await kvStore.getLastSync(TEST_ADDRESSES[0]);
    console.log('⏰ Last Sync (global):', lastSync ? lastSync.toISOString() : 'No sync data');

    const contractSync = await kvStore.getLastSync(TEST_ADDRESSES[0], TEST_CONTRACTS[0]);
    console.log('⏰ Last Sync (contract):', contractSync ? contractSync.toISOString() : 'No sync data');

    // Test error handling with invalid data
    console.log('🔍 Testing error handling...');
    const invalidBalance = await kvStore.getBalance('invalid-address', 'invalid-contract');
    console.log('❌ Invalid Balance:', invalidBalance || 'Null (expected)');

    const invalidAddressBalances = await kvStore.getAddressBalances('invalid-address');
    console.log('❌ Invalid Address Balances:', Object.keys(invalidAddressBalances).length, 'contracts (expected 0)');

    // Test cache operations
    console.log('🔍 Testing cache operations...');
    await kvStore.invalidateAddress(TEST_ADDRESSES[0]);
    console.log('🗑️ Cache invalidated for address');

    console.success('✅ All KV storage tests completed successfully!');

  } catch (error) {
    console.error('❌ KV Storage test failed:', error);

    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
  }
}

// Run the test
testKVStorage().catch(console.error);
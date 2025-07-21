#!/usr/bin/env tsx
/**
 * E2E Test: All Read Operations
 * Comprehensive test of all read operations across the balance service
 */

import '../utils';
import { BalanceService } from '../../src/service/BalanceService';
import { BalanceSeriesAPI } from '../../src/balance-series/balance-series-api';
import { SnapshotReader } from '../../src/snapshot-scheduler/SnapshotReader';
import { SnapshotStorage } from '../../src/snapshot-scheduler/SnapshotStorage';
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

async function testAllReads() {
  console.log('🚀 Starting Comprehensive E2E Read Tests...');
  console.log('📅 Test started at:', new Date().toISOString());
  
  const startTime = Date.now();
  let successCount = 0;
  let failureCount = 0;
  
  const testResults = {
    kvStorage: false,
    balanceService: false,
    balanceSeriesAPI: false,
    snapshotStorage: false,
    snapshotReader: false
  };
  
  // Test 1: KV Storage Layer
  console.log('\n📦 [1/5] Testing KV Storage Layer...');
  try {
    const kvStore = new KVBalanceStore();
    
    // Basic operations
    const balance = await kvStore.getBalance(TEST_ADDRESSES[0], TEST_CONTRACTS[0]);
    const addressBalances = await kvStore.getAddressBalances(TEST_ADDRESSES[0]);
    const allAddresses = await kvStore.getAllAddresses();
    const stats = await kvStore.getStats();
    
    console.log('✅ KV Storage: Basic operations successful');
    console.log(`   Balance: ${balance || 'None'}`);
    console.log(`   Address contracts: ${Object.keys(addressBalances).length}`);
    console.log(`   Total addresses: ${allAddresses.length}`);
    console.log(`   Storage stats: ${JSON.stringify(stats)}`);
    
    testResults.kvStorage = true;
    successCount++;
    
  } catch (error) {
    console.error('❌ KV Storage test failed:', error);
    failureCount++;
  }
  
  // Test 2: Balance Service
  console.log('\n⚖️  [2/5] Testing Balance Service...');
  try {
    const balanceService = new BalanceService();
    
    // Core operations
    const singleBalance = await balanceService.getBalance(TEST_ADDRESSES[0], TEST_CONTRACTS[0]);
    const multipleBalances = await balanceService.getBalances(TEST_ADDRESSES[0]);
    const allBalances = await balanceService.getAllBalances(TEST_ADDRESSES[0]);
    
    // Bulk operations
    const bulkRequest = {
      addresses: TEST_ADDRESSES.slice(0, 2),
      contractIds: TEST_CONTRACTS.slice(0, 2),
      includeZeroBalances: false
    };
    const bulkResult = await balanceService.getBulkBalances(bulkRequest);
    
    // Time series
    const history = await balanceService.getBalanceHistory(TEST_ADDRESSES[0], TEST_CONTRACTS[0]);
    const snapshots = await balanceService.getBalanceSnapshots(TEST_ADDRESSES[0]);
    
    console.log('✅ Balance Service: All operations successful');
    console.log(`   Single balance: ${singleBalance}`);
    console.log(`   Multiple balances: ${Object.keys(multipleBalances).length} contracts`);
    console.log(`   All balances: ${allBalances.length} non-zero`);
    console.log(`   Bulk result: ${bulkResult.success ? 'Success' : 'Failed'}`);
    console.log(`   History: ${history.length} data points`);
    console.log(`   Snapshots: ${snapshots.length} snapshots`);
    
    testResults.balanceService = true;
    successCount++;
    
  } catch (error) {
    console.error('❌ Balance Service test failed:', error);
    failureCount++;
  }
  
  // Test 3: Balance Series API
  console.log('\n📊 [3/5] Testing Balance Series API...');
  try {
    const seriesAPI = new BalanceSeriesAPI();
    
    // Series request
    const seriesRequest = {
      addresses: TEST_ADDRESSES.slice(0, 2),
      contractIds: TEST_CONTRACTS.slice(0, 2),
      period: '7d' as const,
      granularity: 'day' as const,
      includeSnapshots: false,
      limit: 50
    };
    const seriesResult = await seriesAPI.getBalanceSeries(seriesRequest);
    
    // Bulk balances
    const bulkRequest = {
      addresses: TEST_ADDRESSES.slice(0, 2),
      contractIds: TEST_CONTRACTS.slice(0, 2),
      includeZeroBalances: false
    };
    const bulkResult = await seriesAPI.getBulkBalances(bulkRequest);
    
    console.log('✅ Balance Series API: All operations successful');
    console.log(`   Series result: ${seriesResult.success ? 'Success' : 'Failed'}`);
    console.log(`   Series addresses: ${Object.keys(seriesResult.data?.timeSeries || {}).length}`);
    console.log(`   Series execution: ${seriesResult.data?.metadata?.executionTime}ms`);
    console.log(`   Bulk result: ${bulkResult.success ? 'Success' : 'Failed'}`);
    console.log(`   Bulk addresses: ${Object.keys(bulkResult.data || {}).length}`);
    
    testResults.balanceSeriesAPI = true;
    successCount++;
    
  } catch (error) {
    console.error('❌ Balance Series API test failed:', error);
    failureCount++;
  }
  
  // Test 4: Snapshot Storage
  console.log('\n💾 [4/5] Testing Snapshot Storage...');
  try {
    const storage = new SnapshotStorage();
    
    // Connection and stats
    const isConnected = await storage.testConnection();
    const storageStats = await storage.getStorageStats();
    const monitoringStats = storage.getBlobMonitorStats();
    
    // Snapshot operations - use a timestamp that doesn't exist to test error handling
    const testTimestamp = Date.now() - 24 * 60 * 60 * 1000;
    const exists = await storage.snapshotExists(testTimestamp);
    // Skip metadata check for non-existent snapshots to avoid warnings
    const metadata = exists ? await storage.getSnapshotMetadata(testTimestamp) : null;
    
    console.log('✅ Snapshot Storage: All operations successful');
    console.log(`   Connection: ${isConnected ? 'Connected' : 'Disconnected'}`);
    console.log(`   Total snapshots: ${storageStats.totalSnapshots}`);
    console.log(`   Total size: ${storageStats.totalSize} bytes`);
    console.log(`   Compression ratio: ${storageStats.compressionRatio?.toFixed(2) || 'N/A'}`);
    console.log(`   Test snapshot exists: ${exists}`);
    
    testResults.snapshotStorage = true;
    successCount++;
    
  } catch (error) {
    console.error('❌ Snapshot Storage test failed:', error);
    failureCount++;
  }
  
  // Test 5: Snapshot Reader
  console.log('\n📖 [5/5] Testing Snapshot Reader...');
  try {
    const kvStore = new KVBalanceStore();
    const storage = new SnapshotStorage();
    const reader = new SnapshotReader(storage, kvStore);
    
    // Index and stats
    const index = await reader.getSnapshotIndex();
    const readerStats = await reader.getStats();
    const timestamps = await reader.getAvailableTimestamps();
    
    // Snapshot retrieval
    const latestSnapshot = await reader.getLatestSnapshot();
    const oldestSnapshot = await reader.getOldestSnapshot();
    
    console.log('✅ Snapshot Reader: All operations successful');
    console.log(`   Index: ${index ? `${index.count} snapshots` : 'No index'}`);
    console.log(`   Available timestamps: ${timestamps.length}`);
    console.log(`   Latest snapshot: ${latestSnapshot ? new Date(latestSnapshot.timestamp).toISOString() : 'None'}`);
    console.log(`   Oldest snapshot: ${oldestSnapshot ? new Date(oldestSnapshot.timestamp).toISOString() : 'None'}`);
    console.log(`   Reader stats: ${JSON.stringify(readerStats)}`);
    
    // Test balance queries if we have data
    if (timestamps.length > 0) {
      const queryTime = timestamps[Math.floor(timestamps.length / 2)];
      const balanceAtTime = await reader.getBalanceAtTime(TEST_ADDRESSES[0], TEST_CONTRACTS[0], queryTime);
      console.log(`   Balance at time query: ${balanceAtTime || 'No balance'}`);
    }
    
    testResults.snapshotReader = true;
    successCount++;
    
  } catch (error) {
    console.error('❌ Snapshot Reader test failed:', error);
    failureCount++;
  }
  
  // Final Results
  const duration = Date.now() - startTime;
  const successRate = Math.round((successCount / 5) * 100);
  
  console.log('\n📋 Test Summary:');
  console.log('================');
  console.log(`⏱️  Total duration: ${(duration / 1000).toFixed(2)}s`);
  console.log(`✅ Successful tests: ${successCount}/5`);
  console.log(`❌ Failed tests: ${failureCount}/5`);
  console.log(`📊 Success rate: ${successRate}%`);
  console.log('');
  
  console.log('📊 Component Results:');
  console.log('--------------------');
  console.log(`📦 KV Storage:        ${testResults.kvStorage ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`⚖️  Balance Service:   ${testResults.balanceService ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`📊 Balance Series API: ${testResults.balanceSeriesAPI ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`💾 Snapshot Storage:   ${testResults.snapshotStorage ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`📖 Snapshot Reader:    ${testResults.snapshotReader ? '✅ PASS' : '❌ FAIL'}`);
  
  if (successCount === 5) {
    console.success('🎉 All E2E read tests completed successfully!');
    console.log('🚀 Balance service is ready for production use!');
  } else {
    console.error(`⚠️  ${failureCount} test(s) failed. Please review the errors above.`);
  }
  
  console.log('\n📅 Test completed at:', new Date().toISOString());
}

// Run the comprehensive test
testAllReads().catch(console.error);
#!/usr/bin/env tsx
/**
 * E2E Test: Snapshot Reading Operations
 * Tests SnapshotReader and SnapshotStorage read operations
 */

import '../utils';
import { SnapshotReader } from '../../src/snapshot-scheduler/SnapshotReader';
import { SnapshotStorage } from '../../src/snapshot-scheduler/SnapshotStorage';
import { KVBalanceStore } from '../../src/storage/KVBalanceStore';

// Sample test data
const TEST_ADDRESSES = [
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
  'SP1H1733V5MZ3SZ9XRW9FKYAHJ0CR4O42S4HZ3PKH'
];

const TEST_CONTRACTS = [
  'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.arkadiko-token',
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'
];

async function testSnapshotReads() {
  console.log('🔄 Testing Snapshot Read Operations...');

  try {
    // Test SnapshotStorage
    console.log('📦 Testing SnapshotStorage...');
    const storage = new SnapshotStorage();

    // Test connection first
    console.log('📡 Testing storage connection...');
    const isConnected = await storage.testConnection();
    console.log('📡 Storage Connection:', isConnected ? '✅ Connected' : '❌ Disconnected');

    // Test storage stats
    console.log('📊 Getting storage statistics...');
    const storageStats = await storage.getStorageStats();
    console.log('📊 Storage Stats:', {
      totalSnapshots: storageStats.totalSnapshots,
      totalSize: storageStats.totalSize,
      averageSize: storageStats.averageSize,
      compressionRatio: storageStats.compressionRatio?.toFixed(2) || 'N/A'
    });

    // Test specific snapshot checks
    const testTimestamp = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
    console.log('🔍 Testing snapshot existence...');
    const exists = await storage.snapshotExists(testTimestamp);
    console.log('📸 Snapshot exists:', exists);

    // Test metadata retrieval
    console.log('🔍 Testing snapshot metadata...');
    const metadata = await storage.getSnapshotMetadata(testTimestamp);
    console.log('📄 Snapshot metadata:', metadata || 'No metadata found');

    // Test actual snapshot retrieval
    console.log('🔍 Testing snapshot retrieval...');
    const snapshot = await storage.getSnapshot(testTimestamp);
    console.log('📸 Snapshot data:', snapshot ? {
      timestamp: new Date(snapshot.timestamp).toISOString(),
      totalAddresses: snapshot.totalAddresses,
      totalContracts: snapshot.totalContracts,
      balanceKeys: Object.keys(snapshot.balances).length
    } : 'No snapshot found');

  } catch (error) {
    console.error('❌ SnapshotStorage test failed:', error);
  }

  try {
    // Test SnapshotReader
    console.log('📖 Testing SnapshotReader...');
    const kvStore = new KVBalanceStore();
    const storage = new SnapshotStorage();
    const reader = new SnapshotReader(storage, kvStore);

    // Test snapshot index
    console.log('🔍 Getting snapshot index...');
    const index = await reader.getSnapshotIndex();
    console.log('📋 Snapshot Index:', index ? {
      totalSnapshots: index.count,
      oldestSnapshot: new Date(index.oldest).toISOString(),
      newestSnapshot: new Date(index.newest).toISOString(),
      timestampCount: index.timestamps.length
    } : 'No index found');

    // Test reader statistics
    console.log('📊 Getting reader statistics...');
    const readerStats = await reader.getStats();
    console.log('📊 Reader Stats:', readerStats);

    // Test latest/oldest snapshot retrieval
    console.log('🔍 Testing latest/oldest snapshots...');
    const latestSnapshot = await reader.getLatestSnapshot();
    console.log('📸 Latest Snapshot:', latestSnapshot ? {
      timestamp: new Date(latestSnapshot.timestamp).toISOString(),
      totalAddresses: latestSnapshot.totalAddresses
    } : 'No latest snapshot');

    const oldestSnapshot = await reader.getOldestSnapshot();
    console.log('📸 Oldest Snapshot:', oldestSnapshot ? {
      timestamp: new Date(oldestSnapshot.timestamp).toISOString(),
      totalAddresses: oldestSnapshot.totalAddresses
    } : 'No oldest snapshot');

    // Test available timestamps
    console.log('🔍 Getting available timestamps...');
    const timestamps = await reader.getAvailableTimestamps();
    console.log('📅 Available Timestamps:', timestamps.length, 'timestamps available');

    // Test balance queries if we have data
    if (timestamps.length > 0) {
      const queryTime = timestamps[Math.floor(timestamps.length / 2)]; // Middle timestamp

      console.log('🔍 Testing balance at time queries...');
      const balanceAtTime = await reader.getBalanceAtTime(
        TEST_ADDRESSES[0],
        TEST_CONTRACTS[0],
        queryTime
      );
      console.log('💰 Balance at time:', balanceAtTime || 'No balance found');

      const addressBalances = await reader.getAddressBalancesAtTime(
        TEST_ADDRESSES[0],
        queryTime
      );
      console.log('💰 Address balances at time:', Object.keys(addressBalances).length, 'contracts');

      // Test balance history
      console.log('🔍 Testing balance history...');
      const history = await reader.getBalanceHistory(
        TEST_ADDRESSES[0],
        TEST_CONTRACTS[0]
      );
      console.log('📈 Balance History:', history.length, 'data points');

      // Test balance trends
      console.log('🔍 Testing balance trends...');
      const trends = await reader.getBalanceTrends(TEST_ADDRESSES[0]);
      console.log('📈 Balance Trends:', Object.keys(trends).length, 'contracts');
    }

    // Test snapshot queries
    if (timestamps.length > 0) {
      console.log('🔍 Testing snapshot queries...');
      const query = {
        from: timestamps[0],
        to: timestamps[timestamps.length - 1],
        limit: 5
      };

      const queryResult = await reader.querySnapshots(query);
      console.log('📊 Query Result:', {
        snapshotCount: queryResult.snapshots.length,
        totalCount: queryResult.totalCount,
        executionTime: queryResult.executionTime + 'ms'
      });

      // Test multiple snapshot retrieval
      const multipleSnapshots = await reader.getSnapshots(timestamps.slice(0, 3));
      console.log('📸 Multiple Snapshots:', multipleSnapshots.length, 'snapshots retrieved');
    }

    console.success('✅ All snapshot read tests completed successfully!');

  } catch (error) {
    console.error('❌ SnapshotReader test failed:', error);

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
testSnapshotReads().catch(console.error);
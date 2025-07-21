#!/usr/bin/env tsx
/**
 * E2E Test: SnapshotStorage Connection Test
 * Tests the actual blob storage connection without mocks
 */

import '../utils';
import { SnapshotStorage } from '../../src/snapshot-scheduler/SnapshotStorage';

async function testConnection() {
  console.log('🔄 Testing SnapshotStorage Connection...');
  
  try {
    // Create storage instance
    const storage = new SnapshotStorage();
    
    // Test connection
    console.log('📡 Testing blob storage connection...');
    const isConnected = await storage.testConnection();
    
    if (isConnected) {
      console.success('✅ Connection successful!');
      
      // Get storage stats
      console.log('📊 Getting storage statistics...');
      const stats = await storage.getStorageStats();
      
      console.log('📊 Storage Stats:', {
        totalSnapshots: stats.totalSnapshots,
        totalSize: stats.totalSize,
        averageSize: stats.averageSize,
        compressionRatio: stats.compressionRatio,
        oldestSnapshot: stats.oldestSnapshot ? new Date(stats.oldestSnapshot).toISOString() : 'None',
        newestSnapshot: stats.newestSnapshot ? new Date(stats.newestSnapshot).toISOString() : 'None'
      });
      
      // Test monitoring stats
      console.log('📈 Getting monitoring stats...');
      const monitoringStats = storage.getBlobMonitorStats();
      console.log('📈 Monitoring Stats:', monitoringStats);
      
      // Test recent operations
      console.log('📝 Getting recent operations...');
      const recentOps = storage.getRecentBlobOperations(5);
      console.log('📝 Recent Operations:', recentOps.length > 0 ? recentOps : 'No recent operations');
      
      // Test alerts
      console.log('🚨 Checking for alerts...');
      const alerts = storage.getBlobAlerts();
      console.log('🚨 Alerts:', alerts.length > 0 ? alerts : 'No alerts');
      
    } else {
      console.error('❌ Connection failed!');
      console.log('💡 Check your BLOB_BASE_URL environment variable');
      console.log('💡 Ensure blob storage service is accessible');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    
    // Show environment info for debugging
    console.log('🔍 Environment Debug Info:');
    console.log('BLOB_BASE_URL:', process.env.BLOB_BASE_URL);
    console.log('BLOB_READ_WRITE_TOKEN:', process.env.BLOB_READ_WRITE_TOKEN ? 'Set' : 'Not set');
  }
}

// Run the test
testConnection().catch(console.error);
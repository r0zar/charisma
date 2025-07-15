#!/usr/bin/env node

/**
 * Debugging script to test metrics collection and storage
 * Usage: pnpm script scripts/debug-metrics-collection.ts
 */

import { logger } from './logger';
import { storeMetricsSnapshot, getQueueStats, getMetricsHistory } from '../src/lib/transaction-monitor';
import { getActivityStats } from '../src/lib/activity-storage';
import { kv } from '@vercel/kv';
import type { MetricsSnapshot } from '../src/lib/types';

async function debugMetricsCollection() {
  await logger.info('🔬 Starting metrics collection debug');
  
  try {
    // Step 1: Check current state before collection
    await logger.info('📊 Checking current state...');
    
    const queueStats = await getQueueStats();
    const activityStats = await getActivityStats();
    
    await logger.info(`📊 Current Queue Stats:
      📈 Total Processed: ${queueStats.totalProcessed}
      ✅ Total Successful: ${queueStats.totalSuccessful}
      ❌ Total Failed: ${queueStats.totalFailed}
      📊 Queue Size: ${queueStats.queueSize}`);
    
    await logger.info(`📊 Current Activity Stats:
      📈 Total: ${activityStats.total}
      ✅ Completed: ${activityStats.byStatus.completed}
      🕒 Pending: ${activityStats.byStatus.pending}
      ❌ Failed: ${activityStats.byStatus.failed}
      🚫 Cancelled: ${activityStats.byStatus.cancelled}
      🔄 Processing: ${activityStats.byStatus.processing}`);
    
    // Step 2: Check existing cumulative data
    await logger.info('📊 Checking existing cumulative data...');
    const existingCumulative = await kv.get('tx:metrics:cumulative');
    
    if (existingCumulative) {
      await logger.info(`📊 Existing Cumulative Data:
        📈 Processed: ${(existingCumulative as any).processed}
        ✅ Successful: ${(existingCumulative as any).successful}
        ❌ Failed: ${(existingCumulative as any).failed}
        📋 Activities: ${(existingCumulative as any).activities ? 'Present' : 'Missing'}`);
      
      if ((existingCumulative as any).activities) {
        const activities = (existingCumulative as any).activities;
        await logger.info(`📊 Existing Activity Cumulative:
          ✅ Completed: ${activities.completed}
          🕒 Pending: ${activities.pending}
          ❌ Failed: ${activities.failed}
          🚫 Cancelled: ${activities.cancelled}
          🔄 Processing: ${activities.processing}`);
      }
    } else {
      await logger.info('📊 No existing cumulative data found');
    }
    
    // Step 3: Manually trigger metrics collection
    await logger.info('🔄 Triggering metrics snapshot collection...');
    
    const beforeSnapshot = Date.now();
    await storeMetricsSnapshot();
    const afterSnapshot = Date.now();
    
    await logger.success(`✅ Metrics snapshot completed in ${afterSnapshot - beforeSnapshot}ms`);
    
    // Step 4: Check what was stored
    await logger.info('🔍 Checking what was stored...');
    
    const currentHour = Math.floor(Date.now() / (60 * 60 * 1000));
    const storedSnapshot = await kv.get(`tx:metrics:${currentHour}`) as MetricsSnapshot;
    
    if (storedSnapshot) {
      await logger.info(`📊 Stored Metrics Snapshot:
        🕒 Timestamp: ${new Date(storedSnapshot.timestamp).toLocaleString()}
        📊 Queue Size: ${storedSnapshot.queueSize}
        📈 Processed: ${storedSnapshot.processed}
        ✅ Successful: ${storedSnapshot.successful}
        ❌ Failed: ${storedSnapshot.failed}
        🏥 Processing Health: ${storedSnapshot.processingHealth}`);
      
      if (storedSnapshot.activities) {
        await logger.info(`📊 Stored Activity Metrics:
          ✅ Completed: ${storedSnapshot.activities.completed}
          🕒 Pending: ${storedSnapshot.activities.pending}
          ❌ Failed: ${storedSnapshot.activities.failed}
          🚫 Cancelled: ${storedSnapshot.activities.cancelled}
          🔄 Processing: ${storedSnapshot.activities.processing}`);
        
        // Check if activity metrics are incremental values
        const activityTotal = storedSnapshot.activities.completed + storedSnapshot.activities.pending + 
                            storedSnapshot.activities.failed + storedSnapshot.activities.cancelled + 
                            storedSnapshot.activities.processing;
        
        await logger.info(`📊 Activity Metrics Analysis:
          📈 Total Activity Points: ${activityTotal}
          📊 Expected to be incremental (usually small numbers)`);
        
        if (activityTotal > 100) {
          await logger.warn('⚠️ Activity metrics seem high - might be cumulative instead of incremental');
        }
      } else {
        await logger.error('❌ No activity metrics in stored snapshot!');
      }
    } else {
      await logger.error('❌ No snapshot found in storage!');
    }
    
    // Step 5: Check updated cumulative data
    await logger.info('📊 Checking updated cumulative data...');
    const updatedCumulative = await kv.get('tx:metrics:cumulative');
    
    if (updatedCumulative) {
      await logger.info(`📊 Updated Cumulative Data:
        📈 Processed: ${(updatedCumulative as any).processed}
        ✅ Successful: ${(updatedCumulative as any).successful}
        ❌ Failed: ${(updatedCumulative as any).failed}`);
      
      if ((updatedCumulative as any).activities) {
        const activities = (updatedCumulative as any).activities;
        await logger.info(`📊 Updated Activity Cumulative:
          ✅ Completed: ${activities.completed}
          🕒 Pending: ${activities.pending}
          ❌ Failed: ${activities.failed}
          🚫 Cancelled: ${activities.cancelled}
          🔄 Processing: ${activities.processing}`);
      }
    }
    
    // Step 6: Test metrics history retrieval
    await logger.info('📈 Testing metrics history retrieval...');
    
    const metricsHistory = await getMetricsHistory(6);
    await logger.info(`📊 Metrics History:
      📋 Total Records: ${metricsHistory.total}
      🕒 Period: ${metricsHistory.period}
      📊 Array Length: ${metricsHistory.metrics.length}`);
    
    // Check if the new snapshot is in the history
    const newSnapshotInHistory = metricsHistory.metrics.find(m => 
      Math.abs(m.timestamp - storedSnapshot.timestamp) < 60000 // Within 1 minute
    );
    
    if (newSnapshotInHistory) {
      await logger.success('✅ New snapshot found in metrics history');
      
      if (newSnapshotInHistory.activities) {
        await logger.success('✅ New snapshot contains activity data in history');
      } else {
        await logger.error('❌ New snapshot missing activity data in history');
      }
    } else {
      await logger.warn('⚠️ New snapshot not found in metrics history (might be timing issue)');
    }
    
    // Step 7: Create a second snapshot to test incremental calculation
    await logger.info('🔄 Creating second snapshot to test incremental calculation...');
    
    // Wait a moment to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await storeMetricsSnapshot();
    
    const secondSnapshot = await kv.get(`tx:metrics:${currentHour}`) as MetricsSnapshot;
    
    if (secondSnapshot && storedSnapshot) {
      await logger.info(`📊 Second Snapshot Comparison:
        🕒 Time Difference: ${secondSnapshot.timestamp - storedSnapshot.timestamp}ms
        📈 Processed Diff: ${secondSnapshot.processed - storedSnapshot.processed}
        ✅ Successful Diff: ${secondSnapshot.successful - storedSnapshot.successful}
        ❌ Failed Diff: ${secondSnapshot.failed - storedSnapshot.failed}`);
      
      if (secondSnapshot.activities && storedSnapshot.activities) {
        await logger.info(`📊 Activity Metrics Comparison:
          ✅ Completed Diff: ${secondSnapshot.activities.completed - storedSnapshot.activities.completed}
          🕒 Pending Diff: ${secondSnapshot.activities.pending - storedSnapshot.activities.pending}
          ❌ Failed Diff: ${secondSnapshot.activities.failed - storedSnapshot.activities.failed}`);
      }
    }
    
    await logger.success('✅ Metrics collection debug completed');
    
  } catch (error) {
    await logger.error(`❌ Metrics collection debug failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    // Log the full error for debugging
    if (error instanceof Error) {
      await logger.error(`📋 Error Details: ${error.stack}`);
    }
    
    throw error;
  }
}

// Run the debug
debugMetricsCollection().catch(async (error) => {
  await logger.error(`💥 Script failed: ${error}`);
  process.exit(1);
});
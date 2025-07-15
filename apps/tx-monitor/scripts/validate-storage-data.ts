#!/usr/bin/env node

/**
 * Debugging script to validate KV storage data for metrics and activities
 * Usage: pnpm script scripts/validate-storage-data.ts
 */

import { logger } from './logger';
import { kv } from '@vercel/kv';
import { getActivityStats } from '../src/lib/activity-storage';
import { getQueueStats, getMetricsHistory } from '../src/lib/transaction-monitor';
import type { MetricsSnapshot } from '../src/lib/types';

async function validateStorageData() {
  await logger.info('🔍 Starting storage data validation');
  
  try {
    // Test KV connectivity
    await logger.info('Testing KV connectivity...');
    await kv.ping();
    await logger.success('KV connection successful');
    
    // Check activity statistics
    await logger.info('📊 Checking activity statistics...');
    const activityStats = await getActivityStats();
    
    await logger.info(`Activity Stats Summary:
      📈 Total Activities: ${activityStats.total}
      🕒 Oldest Activity Age: ${activityStats.oldestActivityAge ? `${Math.round(activityStats.oldestActivityAge / (60 * 1000))} minutes` : 'N/A'}
      
      📋 By Type:
      ${Object.entries(activityStats.byType).map(([type, count]) => `        ${type}: ${count}`).join('\n')}
      
      📊 By Status:
      ${Object.entries(activityStats.byStatus).map(([status, count]) => `        ${status}: ${count}`).join('\n')}`);
    
    // Check queue statistics
    await logger.info('🚀 Checking queue statistics...');
    const queueStats = await getQueueStats();
    
    await logger.info(`Queue Stats Summary:
      📊 Queue Size: ${queueStats.queueSize}
      📈 Total Processed: ${queueStats.totalProcessed}
      ✅ Total Successful: ${queueStats.totalSuccessful}
      ❌ Total Failed: ${queueStats.totalFailed}
      🕒 Oldest Transaction Age: ${queueStats.oldestTransactionAge ? `${Math.round(queueStats.oldestTransactionAge / (60 * 1000))} minutes` : 'N/A'}
      🏥 Processing Health: ${queueStats.processingHealth}`);
    
    // Check recent metrics snapshots
    await logger.info('📸 Checking recent metrics snapshots...');
    const now = Date.now();
    const currentHour = Math.floor(now / (60 * 60 * 1000));
    
    const recentSnapshots: MetricsSnapshot[] = [];
    for (let i = 0; i < 5; i++) {
      const hourKey = currentHour - i;
      const snapshot = await kv.get(`tx:metrics:${hourKey}`);
      if (snapshot) {
        recentSnapshots.push(snapshot as MetricsSnapshot);
      }
    }
    
    await logger.info(`📊 Found ${recentSnapshots.length} recent metrics snapshots`);
    
    if (recentSnapshots.length === 0) {
      await logger.warn('⚠️ No recent metrics snapshots found in KV storage');
    } else {
      // Analyze the most recent snapshot
      const latest = recentSnapshots[0];
      const snapshotTime = new Date(latest.timestamp);
      
      await logger.info(`🔍 Latest Metrics Snapshot (${snapshotTime.toLocaleString()}):
        📊 Queue Size: ${latest.queueSize}
        📈 Processed: ${latest.processed}
        ✅ Successful: ${latest.successful}
        ❌ Failed: ${latest.failed}
        🏥 Processing Health: ${latest.processingHealth}
        
        📋 Activity Metrics:
        ${latest.activities ? `
          ✅ Completed: ${latest.activities.completed}
          🕒 Pending: ${latest.activities.pending}
          ❌ Failed: ${latest.activities.failed}
          🚫 Cancelled: ${latest.activities.cancelled}
          🔄 Processing: ${latest.activities.processing}
        ` : '❌ No activity metrics found'}`);
      
      // Check if activity metrics are missing
      if (!latest.activities) {
        await logger.error('❌ Activity metrics are missing from metrics snapshot! This is the likely cause of chart issues.');
      } else {
        await logger.success('✅ Activity metrics are present in metrics snapshot');
      }
    }
    
    // Check metrics history API
    await logger.info('📈 Testing metrics history retrieval...');
    const metricsHistory = await getMetricsHistory(6);
    
    await logger.info(`📊 Metrics History Summary:
      📋 Total Records: ${metricsHistory.total}
      🕒 Period: ${metricsHistory.period}
      📊 Metrics Array Length: ${metricsHistory.metrics.length}`);
    
    // Check if metrics contain activity data
    const metricsWithActivities = metricsHistory.metrics.filter(m => m.activities);
    await logger.info(`📊 Metrics with activity data: ${metricsWithActivities.length}/${metricsHistory.metrics.length}`);
    
    if (metricsWithActivities.length === 0) {
      await logger.error('❌ No metrics records contain activity data! Charts will show empty activity lines.');
    } else {
      await logger.success(`✅ ${metricsWithActivities.length} metrics records contain activity data`);
      
      // Sample the first record with activity data
      const sample = metricsWithActivities[0];
      await logger.info(`📋 Sample Activity Metrics:
        ✅ Completed: ${sample.activities?.completed || 0}
        🕒 Pending: ${sample.activities?.pending || 0}
        ❌ Failed: ${sample.activities?.failed || 0}
        🚫 Cancelled: ${sample.activities?.cancelled || 0}
        🔄 Processing: ${sample.activities?.processing || 0}`);
    }
    
    // Check cumulative data
    await logger.info('📊 Checking cumulative metrics data...');
    const cumulativeData = await kv.get('tx:metrics:cumulative');
    
    if (cumulativeData) {
      await logger.info(`📊 Cumulative Metrics Found:
        📈 Processed: ${(cumulativeData as any).processed}
        ✅ Successful: ${(cumulativeData as any).successful}
        ❌ Failed: ${(cumulativeData as any).failed}
        📋 Activities: ${(cumulativeData as any).activities ? 'Present' : 'Missing'}`);
    } else {
      await logger.warn('⚠️ No cumulative metrics data found');
    }
    
    await logger.success('✅ Storage data validation completed');
    
  } catch (error) {
    await logger.error(`❌ Storage validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

// Run the validation
validateStorageData().catch(async (error) => {
  await logger.error(`💥 Script failed: ${error}`);
  process.exit(1);
});
#!/usr/bin/env node

/**
 * Debugging script to analyze activity status and identify why activities are pending
 * Usage: pnpm script scripts/analyze-activity-status.ts
 */

import { logger } from './logger';
import { getActivityStats, getActivityTimeline, getActivity } from '../src/lib/activity-storage';
import { getCachedStatus, checkTransactionStatus } from '../src/lib/transaction-monitor';
import { kv } from '@vercel/kv';

async function analyzeActivityStatus() {
  await logger.info('🔍 Starting activity status analysis');
  
  try {
    // Step 1: Get overview of all activities
    await logger.info('📊 Step 1: Getting activity overview...');
    
    const stats = await getActivityStats();
    const timeline = await getActivityTimeline({ limit: 50 });
    
    await logger.info(`📊 Activity Overview:
      📈 Total Activities: ${stats.total}
      📊 By Status:
      ${Object.entries(stats.byStatus).map(([status, count]) => `        ${status}: ${count}`).join('\n')}
      
      📊 By Type:
      ${Object.entries(stats.byType).map(([type, count]) => `        ${type}: ${count}`).join('\n')}`);
    
    // Step 2: Analyze individual activities
    await logger.info('🔍 Step 2: Analyzing individual activities...');
    
    const activities = timeline.activities;
    
    for (const activity of activities) {
      await logger.info(`\n📋 Activity: ${activity.id}
        📊 Type: ${activity.type}
        📊 Status: ${activity.status}
        🕒 Created: ${new Date(activity.timestamp).toLocaleString()}
        👤 Owner: ${activity.owner}
        🔗 TXID: ${activity.txid || 'N/A'}
        📈 From: ${activity.fromToken.amount} ${activity.fromToken.symbol}
        📉 To: ${activity.toToken.amount} ${activity.toToken.symbol}`);
      
      // Check if this activity has a transaction ID
      if (activity.txid) {
        await logger.info(`  🔍 Checking transaction status for ${activity.txid}...`);
        
        try {
          // Check cached status first
          const cachedStatus = await getCachedStatus(activity.txid);
          if (cachedStatus) {
            await logger.info(`  💾 Cached Status: ${cachedStatus.status}`);
            await logger.info(`  📊 Block Height: ${cachedStatus.blockHeight || 'N/A'}`);
            await logger.info(`  🕒 Last Checked: ${new Date(cachedStatus.lastChecked).toLocaleString()}`);
            
            // Check if activity status matches transaction status
            const shouldBeCompleted = cachedStatus.status === 'success';
            const shouldBeFailed = cachedStatus.status === 'abort_by_response' || cachedStatus.status === 'abort_by_post_condition';
            
            if (shouldBeCompleted && activity.status !== 'completed') {
              await logger.error(`  ❌ MISMATCH: Transaction is ${cachedStatus.status} but activity is ${activity.status}`);
            } else if (shouldBeFailed && activity.status !== 'failed') {
              await logger.error(`  ❌ MISMATCH: Transaction is ${cachedStatus.status} but activity is ${activity.status}`);
            } else if (cachedStatus.status === 'pending' && activity.status === 'pending') {
              await logger.info(`  ✅ MATCH: Both transaction and activity are pending`);
            } else {
              await logger.success(`  ✅ MATCH: Activity status ${activity.status} matches transaction status ${cachedStatus.status}`);
            }
          } else {
            await logger.warn(`  ⚠️ No cached status found for transaction ${activity.txid}`);
            
            // Try to check transaction status directly
            try {
              const txStatus = await checkTransactionStatus(activity.txid);
              await logger.info(`  🔍 Direct Status Check: ${txStatus.status}`);
              
              if (txStatus.status === 'success' && activity.status !== 'completed') {
                await logger.error(`  ❌ CRITICAL: Transaction succeeded but activity is still ${activity.status}`);
              } else if ((txStatus.status === 'abort_by_response' || txStatus.status === 'abort_by_post_condition') && activity.status !== 'failed') {
                await logger.error(`  ❌ CRITICAL: Transaction failed but activity is still ${activity.status}`);
              }
            } catch (error) {
              await logger.error(`  ❌ Error checking transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }
        } catch (error) {
          await logger.error(`  ❌ Error checking transaction status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else {
        await logger.warn(`  ⚠️ No transaction ID found for activity ${activity.id}`);
      }
      
      // Check activity metadata for additional clues
      if (activity.metadata) {
        await logger.info(`  📋 Metadata: ${JSON.stringify(activity.metadata, null, 2)}`);
      }
    }
    
    // Step 3: Check for status update patterns
    await logger.info('\n📊 Step 3: Analyzing status update patterns...');
    
    const statusBreakdown = activities.reduce((acc, activity) => {
      const ageMinutes = Math.floor((Date.now() - activity.timestamp) / (60 * 1000));
      const ageGroup = ageMinutes < 60 ? 'recent' : ageMinutes < 1440 ? 'hours' : 'days';
      
      if (!acc[ageGroup]) acc[ageGroup] = {};
      if (!acc[ageGroup][activity.status]) acc[ageGroup][activity.status] = 0;
      acc[ageGroup][activity.status]++;
      
      return acc;
    }, {} as Record<string, Record<string, number>>);
    
    await logger.info(`📊 Status by Age:
      ${Object.entries(statusBreakdown).map(([ageGroup, statuses]) => 
        `${ageGroup}: ${Object.entries(statuses).map(([status, count]) => `${status}=${count}`).join(', ')}`
      ).join('\n      ')}`);
    
    // Step 4: Check for transaction monitoring queue issues
    await logger.info('\n🔍 Step 4: Checking transaction monitoring system...');
    
    const queuedTxids = await kv.smembers('tx:queue');
    const activityTxids = activities.filter(a => a.txid).map(a => a.txid).filter((txid): txid is string => txid !== undefined);
    
    await logger.info(`📊 Transaction Monitoring:
      📈 Queued Transactions: ${queuedTxids?.length || 0}
      📈 Activities with TXIDs: ${activityTxids.length}
      📊 Activities without TXIDs: ${activities.length - activityTxids.length}`);
    
    // Check if activity transaction IDs are in the monitoring queue
    const queuedActivityTxids = activityTxids.filter(txid => queuedTxids?.includes(txid));
    const notQueuedActivityTxids = activityTxids.filter(txid => !queuedTxids?.includes(txid));
    
    await logger.info(`📊 Transaction Queue Analysis:
      📈 Activity TXIDs in queue: ${queuedActivityTxids.length}
      📈 Activity TXIDs not in queue: ${notQueuedActivityTxids.length}`);
    
    if (notQueuedActivityTxids.length > 0) {
      await logger.info(`📋 TXIDs not in monitoring queue:
        ${notQueuedActivityTxids.slice(0, 5).join('\n        ')}`);
    }
    
    // Step 5: Check for status update mechanism
    await logger.info('\n🔍 Step 5: Checking status update mechanism...');
    
    // Check if there's a mechanism to update activity status based on transaction status
    const recentPendingActivities = activities.filter(a => 
      a.status === 'pending' && 
      a.txid && 
      (Date.now() - a.timestamp) > 5 * 60 * 1000 // More than 5 minutes old
    );
    
    await logger.info(`📊 Status Update Analysis:
      📈 Recent pending activities (>5min old): ${recentPendingActivities.length}
      📊 These might need status updates based on transaction completion`);
    
    // Step 6: Recommendations
    await logger.info('\n💡 Step 6: Recommendations...');
    
    const pendingCount = stats.byStatus.pending || 0;
    const totalCount = stats.total;
    const pendingPercentage = totalCount > 0 ? (pendingCount / totalCount * 100).toFixed(1) : 0;
    
    await logger.info(`📊 Status Analysis Summary:
      📈 Pending Activities: ${pendingCount}/${totalCount} (${pendingPercentage}%)
      📊 Activities with TXIDs: ${activityTxids.length}
      📊 Activities without TXIDs: ${activities.length - activityTxids.length}`);
    
    if (pendingCount > 0) {
      await logger.warn('💡 High number of pending activities detected');
      
      if (notQueuedActivityTxids.length > 0) {
        await logger.warn('💡 Some activity transactions are not in the monitoring queue');
        await logger.warn('💡 This could prevent status updates from occurring');
      }
      
      if (recentPendingActivities.length > 0) {
        await logger.warn('💡 Some activities have been pending for >5 minutes');
        await logger.warn('💡 Consider checking if transaction monitoring is working correctly');
      }
    }
    
    // Step 7: Check for activity update mechanism
    await logger.info('\n🔍 Step 7: Checking activity update mechanism...');
    
    // Look for any activity update patterns in the code
    const activitiesWithUpdates = activities.filter(a => 
      a.metadata && 
      (a.metadata.lastUpdated || a.metadata.statusUpdated || a.metadata.txStatusChecked)
    );
    
    await logger.info(`📊 Activity Update Tracking:
      📈 Activities with update metadata: ${activitiesWithUpdates.length}
      📊 Activities without update metadata: ${activities.length - activitiesWithUpdates.length}`);
    
    if (activitiesWithUpdates.length === 0) {
      await logger.warn('💡 No activities have update metadata - status updates might not be implemented');
    }
    
    await logger.success('✅ Activity status analysis completed');
    
  } catch (error) {
    await logger.error(`❌ Activity status analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    // Log the full error for debugging
    if (error instanceof Error) {
      await logger.error(`📋 Error Details: ${error.stack}`);
    }
    
    throw error;
  }
}

// Run the analysis
analyzeActivityStatus().catch(async (error) => {
  await logger.error(`💥 Script failed: ${error}`);
  process.exit(1);
});
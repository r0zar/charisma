#!/usr/bin/env node

/**
 * Debugging script to test activity statistics functionality
 * Usage: pnpm script scripts/debug-activity-stats.ts
 */

import { logger } from './logger';
import { getActivityStats, getActivityTimeline, getActivity } from '../src/lib/activity-storage';
import { kv } from '@vercel/kv';

async function debugActivityStats() {
  await logger.info('🎯 Starting activity statistics debug');
  
  try {
    // Step 1: Test basic activity stats
    await logger.info('📊 Testing basic activity statistics...');
    
    const stats = await getActivityStats();
    
    await logger.info(`📊 Activity Statistics:
      📈 Total Activities: ${stats.total}
      🕒 Oldest Activity Age: ${stats.oldestActivityAge ? `${Math.round(stats.oldestActivityAge / (60 * 1000))} minutes` : 'N/A'}
      
      📋 By Type:
      ${Object.entries(stats.byType).map(([type, count]) => `        ${type}: ${count}`).join('\n')}
      
      📊 By Status:
      ${Object.entries(stats.byStatus).map(([status, count]) => `        ${status}: ${count}`).join('\n')}`);
    
    // Step 2: Check raw activity storage
    await logger.info('🔍 Checking raw activity storage...');
    
    const totalActivities = await kv.hlen('activity_timeline');
    await logger.info(`📊 Raw Activity Count in KV: ${totalActivities}`);
    
    if (totalActivities !== stats.total) {
      await logger.error(`❌ Activity count mismatch! KV: ${totalActivities}, Stats: ${stats.total}`);
    } else {
      await logger.success(`✅ Activity count matches between KV and stats`);
    }
    
    // Step 3: Test activity timeline retrieval
    await logger.info('📋 Testing activity timeline retrieval...');
    
    const timeline = await getActivityTimeline({ limit: 10 });
    
    await logger.info(`📋 Activity Timeline:
      📊 Total Found: ${timeline.total}
      📊 Returned: ${timeline.activities.length}
      📊 Has More: ${timeline.hasMore}`);
    
    if (timeline.activities.length > 0) {
      const firstActivity = timeline.activities[0];
      await logger.info(`📋 First Activity Sample:
        🆔 ID: ${firstActivity.id}
        📋 Type: ${firstActivity.type}
        📊 Status: ${firstActivity.status}
        🕒 Timestamp: ${new Date(firstActivity.timestamp).toLocaleString()}
        👤 Owner: ${firstActivity.owner}
        🔗 TXID: ${firstActivity.txid || 'N/A'}`);
      
      // Test individual activity retrieval
      const retrievedActivity = await getActivity(firstActivity.id);
      if (retrievedActivity) {
        await logger.success(`✅ Successfully retrieved individual activity: ${firstActivity.id}`);
      } else {
        await logger.error(`❌ Failed to retrieve individual activity: ${firstActivity.id}`);
      }
    } else {
      await logger.warn('⚠️ No activities found in timeline');
    }
    
    // Step 4: Test oldest activity calculation
    await logger.info('🕒 Testing oldest activity calculation...');
    
    if (stats.oldestActivityAge && timeline.activities.length > 0) {
      // Get the oldest activity ID from sorted set
      const oldestActivityIds = await kv.zrange('activity_timeline:by_time', 0, 0);
      
      if (oldestActivityIds && oldestActivityIds.length > 0) {
        const oldestActivity = await getActivity(oldestActivityIds[0] as string);
        
        if (oldestActivity) {
          const calculatedAge = Date.now() - oldestActivity.timestamp;
          
          await logger.info(`🕒 Oldest Activity Analysis:
            🆔 ID: ${oldestActivity.id}
            🕒 Timestamp: ${new Date(oldestActivity.timestamp).toLocaleString()}
            📊 Calculated Age: ${Math.round(calculatedAge / (60 * 1000))} minutes
            📊 Reported Age: ${Math.round(stats.oldestActivityAge / (60 * 1000))} minutes
            📊 Age Difference: ${Math.abs(calculatedAge - stats.oldestActivityAge)}ms`);
          
          if (Math.abs(calculatedAge - stats.oldestActivityAge) < 1000) {
            await logger.success('✅ Oldest activity age calculation is accurate');
          } else {
            await logger.error('❌ Oldest activity age calculation is inaccurate');
          }
        } else {
          await logger.error('❌ Could not retrieve oldest activity');
        }
      } else {
        await logger.error('❌ No oldest activity ID found in sorted set');
      }
    } else {
      await logger.warn('⚠️ No oldest activity age available for testing');
    }
    
    // Step 5: Test activity status breakdown
    await logger.info('📊 Testing activity status breakdown...');
    
    const statusCounts = {
      completed: 0,
      pending: 0,
      failed: 0,
      cancelled: 0,
      processing: 0
    };
    
    // Count activities by status manually
    for (const activity of timeline.activities) {
      if (activity.status in statusCounts) {
        statusCounts[activity.status as keyof typeof statusCounts]++;
      }
    }
    
    await logger.info(`📊 Manual Status Count (from ${timeline.activities.length} activities):
      ✅ Completed: ${statusCounts.completed}
      🕒 Pending: ${statusCounts.pending}
      ❌ Failed: ${statusCounts.failed}
      🚫 Cancelled: ${statusCounts.cancelled}
      🔄 Processing: ${statusCounts.processing}`);
    
    // Step 6: Test activity type breakdown
    await logger.info('📋 Testing activity type breakdown...');
    
    const typeCounts = {
      instant_swap: 0,
      order_filled: 0,
      order_cancelled: 0,
      dca_update: 0,
      twitter_trigger: 0
    };
    
    for (const activity of timeline.activities) {
      if (activity.type in typeCounts) {
        typeCounts[activity.type as keyof typeof typeCounts]++;
      }
    }
    
    await logger.info(`📋 Manual Type Count (from ${timeline.activities.length} activities):
      🔄 Instant Swap: ${typeCounts.instant_swap}
      ✅ Order Filled: ${typeCounts.order_filled}
      🚫 Order Cancelled: ${typeCounts.order_cancelled}
      📊 DCA Update: ${typeCounts.dca_update}
      🐦 Twitter Trigger: ${typeCounts.twitter_trigger}`);
    
    // Step 7: Test activity storage keys
    await logger.info('🔑 Testing activity storage keys...');
    
    const storageKeys = [
      'activity_timeline',
      'activity_timeline:by_time',
      'activity_replies'
    ];
    
    for (const key of storageKeys) {
      try {
        const keyType = await kv.type(key);
        let count = 0;
        
        if (keyType === 'hash') {
          count = await kv.hlen(key);
        } else if (keyType === 'zset') {
          count = await kv.zcard(key);
        } else if (keyType === 'set') {
          count = await kv.scard(key);
        }
        
        await logger.info(`🔑 ${key}: ${keyType} with ${count} items`);
      } catch (error) {
        await logger.error(`❌ Error checking key ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Step 8: Test activity data structure
    await logger.info('📋 Testing activity data structure...');
    
    if (timeline.activities.length > 0) {
      const sample = timeline.activities[0];
      
      const requiredFields = ['id', 'type', 'timestamp', 'status', 'owner', 'fromToken', 'toToken'];
      const missingFields = requiredFields.filter(field => !(field in sample));
      
      if (missingFields.length > 0) {
        await logger.error(`❌ Activity missing required fields: ${missingFields.join(', ')}`);
      } else {
        await logger.success('✅ Activity has all required fields');
      }
      
      // Check token structure
      if (sample.fromToken && sample.toToken) {
        const tokenFields = ['symbol', 'amount', 'contractId'];
        const fromTokenMissing = tokenFields.filter(field => !(field in sample.fromToken));
        const toTokenMissing = tokenFields.filter(field => !(field in sample.toToken));
        
        if (fromTokenMissing.length > 0 || toTokenMissing.length > 0) {
          await logger.error(`❌ Token missing fields - From: ${fromTokenMissing.join(', ')}, To: ${toTokenMissing.join(', ')}`);
        } else {
          await logger.success('✅ Token structures are complete');
        }
      }
    }
    
    await logger.success('✅ Activity statistics debug completed');
    
  } catch (error) {
    await logger.error(`❌ Activity statistics debug failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    // Log the full error for debugging
    if (error instanceof Error) {
      await logger.error(`📋 Error Details: ${error.stack}`);
    }
    
    throw error;
  }
}

// Run the debug
debugActivityStats().catch(async (error) => {
  await logger.error(`💥 Script failed: ${error}`);
  process.exit(1);
});
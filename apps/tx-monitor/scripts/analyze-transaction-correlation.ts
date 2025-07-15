#!/usr/bin/env node

/**
 * Script to analyze if test activities have corresponding transaction data
 * This helps identify why test activities are being regenerated
 * Usage: pnpm script scripts/analyze-transaction-correlation.ts
 */

import { logger } from './logger';
import { getActivityTimeline } from '../src/lib/activity-storage';
import { kv } from '@vercel/kv';

async function analyzeTransactionCorrelation() {
  await logger.info('🔍 Analyzing transaction data correlation for activities');
  
  try {
    // Get all activities
    const timeline = await getActivityTimeline({ limit: 1000 });
    
    await logger.info(`📊 Found ${timeline.activities.length} total activities`);
    
    const results = {
      testActivities: [] as any[],
      realActivities: [] as any[],
      activitiesWithTxQueue: [] as any[],
      activitiesWithTxMapping: [] as any[],
      activitiesWithTxStatus: [] as any[],
      activitiesInSwapRecords: [] as any[],
      activitiesInOrderRecords: [] as any[]
    };
    
    for (const activity of timeline.activities) {
      // Identify test/fake activities
      const isTest = 
        activity.id.includes('test-') ||
        activity.txid?.includes('test-') ||
        activity.owner.includes('test') ||
        activity.owner === 'SP1234567890ABCDEF' ||
        activity.owner.includes('TEST') ||
        activity.fromToken.symbol === 'TEST' ||
        activity.toToken.symbol === 'TEST' ||
        activity.metadata?.notes?.includes('test') ||
        activity.metadata?.notes?.includes('dummy') ||
        activity.owner === 'unknown';
      
      const activityInfo = {
        id: activity.id,
        type: activity.type,
        owner: activity.owner,
        txid: activity.txid,
        timestamp: activity.timestamp,
        status: activity.status
      };
      
      if (isTest) {
        results.testActivities.push(activityInfo);
      } else {
        results.realActivities.push(activityInfo);
      }
      
      // Check if transaction ID exists in various Redis structures
      if (activity.txid) {
        // Check if in transaction queue
        const inQueue = await kv.sismember('tx:queue', activity.txid);
        if (inQueue) {
          results.activitiesWithTxQueue.push({
            ...activityInfo,
            queueStatus: 'in_queue'
          });
        }
        
        // Check if has transaction mapping
        const mapping = await kv.get(`tx_mapping:${activity.txid}`);
        if (mapping) {
          results.activitiesWithTxMapping.push({
            ...activityInfo,
            mapping: mapping
          });
        }
        
        // Check if has cached transaction status
        const txStatus = await kv.get(`tx:status:${activity.txid}`);
        if (txStatus) {
          results.activitiesWithTxStatus.push({
            ...activityInfo,
            txStatus: txStatus
          });
        }
        
        // Check if exists in swap records
        const swapRecord = await kv.hget('swap-records', activity.txid);
        if (swapRecord) {
          results.activitiesInSwapRecords.push({
            ...activityInfo,
            swapRecord: typeof swapRecord === 'string' ? JSON.parse(swapRecord) : swapRecord
          });
        }
        
        // Check if exists in order records
        const orderRecord = await kv.hget('orders', activity.txid);
        if (orderRecord) {
          results.activitiesInOrderRecords.push({
            ...activityInfo,
            orderRecord: typeof orderRecord === 'string' ? JSON.parse(orderRecord) : orderRecord
          });
        }
      }
    }
    
    // Log summary
    await logger.info(`\n📊 ANALYSIS RESULTS:`);
    await logger.info(`   Test activities: ${results.testActivities.length}`);
    await logger.info(`   Real activities: ${results.realActivities.length}`);
    await logger.info(`   Activities in tx queue: ${results.activitiesWithTxQueue.length}`);
    await logger.info(`   Activities with tx mapping: ${results.activitiesWithTxMapping.length}`);
    await logger.info(`   Activities with tx status cache: ${results.activitiesWithTxStatus.length}`);
    await logger.info(`   Activities in swap records: ${results.activitiesInSwapRecords.length}`);
    await logger.info(`   Activities in order records: ${results.activitiesInOrderRecords.length}`);
    
    // Detailed analysis of test activities
    const testActivitiesInQueue = results.activitiesWithTxQueue.filter(a => 
      results.testActivities.some(t => t.id === a.id)
    );
    
    const testActivitiesWithMapping = results.activitiesWithTxMapping.filter(a => 
      results.testActivities.some(t => t.id === a.id)
    );
    
    const testActivitiesWithStatus = results.activitiesWithTxStatus.filter(a => 
      results.testActivities.some(t => t.id === a.id)
    );
    
    const testActivitiesInSwapRecords = results.activitiesInSwapRecords.filter(a => 
      results.testActivities.some(t => t.id === a.id)
    );
    
    const testActivitiesInOrderRecords = results.activitiesInOrderRecords.filter(a => 
      results.testActivities.some(t => t.id === a.id)
    );
    
    if (results.testActivities.length > 0) {
      await logger.info(`\n🔍 TEST ACTIVITY DETAILS:`);
      
      await logger.info(`   Test activities in tx queue: ${testActivitiesInQueue.length}`);
      await logger.info(`   Test activities with mapping: ${testActivitiesWithMapping.length}`);
      await logger.info(`   Test activities with status: ${testActivitiesWithStatus.length}`);
      await logger.info(`   Test activities in swap records: ${testActivitiesInSwapRecords.length}`);
      await logger.info(`   Test activities in order records: ${testActivitiesInOrderRecords.length}`);
      
      // Show details of problematic test activities
      if (testActivitiesInQueue.length > 0) {
        await logger.info(`\n⚠️  TEST ACTIVITIES IN TRANSACTION QUEUE:`);
        for (const activity of testActivitiesInQueue) {
          await logger.info(`     ${activity.id} - ${activity.txid} - ${activity.owner}`);
        }
      }
      
      if (testActivitiesWithMapping.length > 0) {
        await logger.info(`\n⚠️  TEST ACTIVITIES WITH TRANSACTION MAPPINGS:`);
        for (const activity of testActivitiesWithMapping) {
          await logger.info(`     ${activity.id} - ${activity.txid} - Mapping: ${JSON.stringify(activity.mapping)}`);
        }
      }
      
      if (testActivitiesInSwapRecords.length > 0) {
        await logger.info(`\n⚠️  TEST ACTIVITIES IN SWAP RECORDS:`);
        for (const activity of testActivitiesInSwapRecords) {
          await logger.info(`     ${activity.id} - ${activity.txid}`);
        }
      }
      
      if (testActivitiesInOrderRecords.length > 0) {
        await logger.info(`\n⚠️  TEST ACTIVITIES IN ORDER RECORDS:`);
        for (const activity of testActivitiesInOrderRecords) {
          await logger.info(`     ${activity.id} - ${activity.txid}`);
        }
      }
    }
    
    // Check for orphaned transaction data
    await logger.info(`\n🔍 CHECKING FOR ORPHANED TRANSACTION DATA:`);
    
    // Get all items in tx queue
    const queueMembers = await kv.smembers('tx:queue');
    await logger.info(`   Total items in tx queue: ${queueMembers?.length || 0}`);
    
    if (queueMembers && queueMembers.length > 0) {
      const orphanedQueueItems = [];
      for (const txid of queueMembers) {
        const hasActivity = timeline.activities.some(a => a.txid === txid);
        if (!hasActivity) {
          orphanedQueueItems.push(txid);
        }
      }
      
      await logger.info(`   Orphaned queue items (no activity): ${orphanedQueueItems.length}`);
      if (orphanedQueueItems.length > 0 && orphanedQueueItems.length <= 10) {
        await logger.info(`   Orphaned txids: ${orphanedQueueItems.join(', ')}`);
      }
    }
    
    // Check recent transaction mappings
    const mappingPattern = 'tx_mapping:*';
    // Note: Redis SCAN would be better but kv client may not support it
    await logger.info(`\n💡 RECOMMENDATIONS:`);
    
    if (testActivitiesInQueue.length > 0) {
      await logger.warn(`   ⚠️  Remove ${testActivitiesInQueue.length} test transaction(s) from queue`);
    }
    
    if (testActivitiesWithMapping.length > 0) {
      await logger.warn(`   ⚠️  Clear ${testActivitiesWithMapping.length} test transaction mapping(s)`);
    }
    
    if (testActivitiesInSwapRecords.length > 0) {
      await logger.warn(`   ⚠️  Remove ${testActivitiesInSwapRecords.length} test swap record(s)`);
    }
    
    if (testActivitiesInOrderRecords.length > 0) {
      await logger.warn(`   ⚠️  Remove ${testActivitiesInOrderRecords.length} test order record(s)`);
    }
    
    if (results.testActivities.length === 0) {
      await logger.success(`   ✅ No test activities found in system`);
    } else {
      await logger.warn(`   ⚠️  Consider running cleanup to remove test data from all Redis structures`);
    }
    
    await logger.success('✅ Transaction correlation analysis completed');
    
  } catch (error) {
    await logger.error('❌ Error during analysis: ' + String(error));
    throw error;
  }
}

async function main() {
  try {
    await analyzeTransactionCorrelation();
  } catch (error) {
    await logger.error('Script failed: ' + String(error));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { analyzeTransactionCorrelation };
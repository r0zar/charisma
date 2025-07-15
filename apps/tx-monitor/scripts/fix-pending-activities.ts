#!/usr/bin/env node

/**
 * Script to fix pending activities by syncing with their transaction statuses
 * Usage: pnpm script scripts/fix-pending-activities.ts
 */

import { logger } from './logger';
import { getActivityTimeline, updateActivity } from '../src/lib/activity-storage';
import { checkTransactionStatus, addToQueue } from '../src/lib/transaction-monitor';
import { mapTransactionStatusToActivity } from '../src/lib/activity-adapters';

async function fixPendingActivities() {
  await logger.info('🔧 Starting pending activity fix process');
  
  try {
    // Step 1: Get all activities with transaction IDs
    await logger.info('📊 Step 1: Getting activities with transaction IDs...');
    
    const timeline = await getActivityTimeline({ limit: 100 });
    const activitiesWithTxids = timeline.activities.filter(activity => activity.txid);
    
    await logger.info(`📊 Found ${activitiesWithTxids.length} activities with transaction IDs`);
    
    // Step 2: Add all transaction IDs to monitoring queue
    await logger.info('📈 Step 2: Adding transaction IDs to monitoring queue...');
    
    const txidsToAdd = activitiesWithTxids.map(activity => activity.txid!);
    const queueResult = await addToQueue(txidsToAdd);
    
    await logger.info(`📈 Queue Result: added=${queueResult.added.length}, already_monitored=${queueResult.alreadyMonitored.length}`);
    
    // Step 3: Check and fix pending activities
    await logger.info('🔍 Step 3: Checking and fixing pending activities...');
    
    const pendingActivities = activitiesWithTxids.filter(activity => 
      activity.status === 'pending' && activity.txid
    );
    
    await logger.info(`🔍 Found ${pendingActivities.length} pending activities to check`);
    
    let fixed = 0;
    let stillPending = 0;
    let errors = 0;
    
    for (const activity of pendingActivities) {
      try {
        await logger.info(`🔍 Checking activity ${activity.id} (txid: ${activity.txid})`);
        
        const txStatus = await checkTransactionStatus(activity.txid!);
        
        await logger.info(`  📊 Transaction status: ${txStatus.status}`);
        
        if (txStatus.status === 'success') {
          // Update to completed
          await updateActivity(activity.id, {
            status: 'completed',
            metadata: {
              ...activity.metadata,
              lastStatusUpdate: Date.now(),
              txStatus: txStatus.status,
              fixedByScript: true
            }
          });
          
          await logger.success(`  ✅ Fixed: ${activity.id} -> completed`);
          fixed++;
          
        } else if (txStatus.status === 'abort_by_response' || txStatus.status === 'abort_by_post_condition') {
          // Update to failed
          await updateActivity(activity.id, {
            status: 'failed',
            metadata: {
              ...activity.metadata,
              lastStatusUpdate: Date.now(),
              txStatus: txStatus.status,
              fixedByScript: true
            }
          });
          
          await logger.success(`  ✅ Fixed: ${activity.id} -> failed`);
          fixed++;
          
        } else if (txStatus.status === 'pending') {
          await logger.info(`  🕒 Still pending: ${activity.id}`);
          stillPending++;
          
        } else {
          await logger.warn(`  ⚠️ Unknown status: ${txStatus.status} for ${activity.id}`);
        }
        
      } catch (error) {
        await logger.error(`  ❌ Error checking ${activity.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        errors++;
      }
    }
    
    // Step 4: Summary
    await logger.info('📊 Step 4: Fix Summary...');
    
    await logger.info(`📊 Fix Summary:
      ✅ Fixed Activities: ${fixed}
      🕒 Still Pending: ${stillPending}
      ❌ Errors: ${errors}
      📈 Total Checked: ${pendingActivities.length}`);
    
    if (fixed > 0) {
      await logger.success(`🎉 Successfully fixed ${fixed} activities!`);
    }
    
    if (stillPending > 0) {
      await logger.info(`🕒 ${stillPending} activities are still legitimately pending`);
    }
    
    if (errors > 0) {
      await logger.warn(`⚠️ ${errors} activities had errors during checking`);
    }
    
    await logger.success('✅ Pending activity fix process completed');
    
  } catch (error) {
    await logger.error(`❌ Fix process failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    if (error instanceof Error) {
      await logger.error(`📋 Error Details: ${error.stack}`);
    }
    
    throw error;
  }
}

// Run the fix
fixPendingActivities().catch(async (error) => {
  await logger.error(`💥 Script failed: ${error}`);
  process.exit(1);
});
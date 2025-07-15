#!/usr/bin/env node

/**
 * Automated script to detect and clean up test activities
 * Can be run as a cron job to maintain clean production data
 * Usage: pnpm script scripts/auto-cleanup-test-activities.ts
 */

import { logger } from './logger';
import { getActivityTimeline, deleteActivity } from '../src/lib/activity-storage';
import { isTestActivity } from '../src/lib/activity-validation';

async function autoCleanupTestActivities() {
  await logger.info('🔄 Auto-cleanup: Checking for test activities');
  
  try {
    const timeline = await getActivityTimeline({ limit: 100 });
    
    // Find test activities using the validation function
    const testActivities = timeline.activities.filter(isTestActivity);
    const realActivities = timeline.activities.filter(activity => !isTestActivity(activity));
    
    await logger.info(`📊 Found ${timeline.activities.length} total activities`);
    await logger.info(`📊 Real activities: ${realActivities.length}`);
    await logger.info(`📊 Test activities: ${testActivities.length}`);
    
    if (testActivities.length === 0) {
      await logger.success('✅ No test activities found - system is clean');
      return;
    }
    
    await logger.warn(`⚠️  Found ${testActivities.length} test activities to remove`);
    
    // Show what will be preserved
    await logger.info('\n✅ Real activities to preserve:');
    realActivities.forEach((activity, index) => {
      logger.info(`  ${index + 1}. ${activity.id} - ${activity.owner} - ${activity.txid || 'no txid'}`);
    });
    
    let deletedCount = 0;
    let errorCount = 0;
    
    // Delete test activities
    for (const activity of testActivities) {
      try {
        await deleteActivity(activity.id);
        deletedCount++;
        await logger.info(`🗑️  Removed test activity: ${activity.id}`);
        
      } catch (error) {
        errorCount++;
        await logger.error(`❌ Error removing activity ${activity.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    await logger.info('\n📊 CLEANUP RESULTS:');
    await logger.info(`  Removed: ${deletedCount} test activities`);
    await logger.info(`  Errors: ${errorCount} activities`);
    await logger.info(`  Remaining: ${realActivities.length} real activities`);
    
    if (deletedCount > 0) {
      await logger.success(`✅ Auto-cleanup completed: removed ${deletedCount} test activities`);
    }
    
    if (errorCount > 0) {
      await logger.warn(`⚠️  ${errorCount} activities had deletion errors`);
    }
    
  } catch (error) {
    await logger.error(`❌ Auto-cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

// Run the auto-cleanup
autoCleanupTestActivities().catch(async (error) => {
  await logger.error(`💥 Auto-cleanup script failed: ${error}`);
  process.exit(1);
});
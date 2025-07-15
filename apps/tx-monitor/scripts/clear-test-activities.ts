#!/usr/bin/env node

/**
 * Script to clear out fake/test activities and keep only real ones
 * Usage: pnpm script scripts/clear-test-activities.ts
 */

import { logger } from './logger';
import { getActivityTimeline, deleteActivity } from '../src/lib/activity-storage';

async function clearTestActivities() {
  await logger.info('🧹 Clearing fake/test activities from storage');
  
  try {
    const timeline = await getActivityTimeline({ limit: 1000 });
    
    await logger.info(`📊 Found ${timeline.activities.length} total activities`);
    
    const testActivities = [];
    const realActivities = [];
    
    for (const activity of timeline.activities) {
      // Identify test/fake activities by common patterns
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
      
      if (isTest) {
        testActivities.push(activity);
      } else {
        realActivities.push(activity);
      }
    }
    
    await logger.info(`📊 Identified ${testActivities.length} test activities to remove`);
    await logger.info(`📊 Will preserve ${realActivities.length} real activities`);
    
    if (testActivities.length === 0) {
      await logger.success('✅ No test activities found to remove');
      return;
    }
    
    // Confirm deletion
    await logger.warn(`⚠️  About to delete ${testActivities.length} test activities`);
    await logger.info('Real activities to preserve:');
    realActivities.forEach((activity, index) => {
      logger.info(`  ${index + 1}. ${activity.id} - ${activity.type} - ${activity.owner} - ${activity.txid || 'no txid'}`);
    });
    
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const activity of testActivities) {
      try {
        await deleteActivity(activity.id);
        deletedCount++;
        
        if (deletedCount % 10 === 0) {
          await logger.info(`🗑️  Deleted ${deletedCount}/${testActivities.length} test activities...`);
        }
        
      } catch (error) {
        errorCount++;
        await logger.error(`❌ Error deleting activity ${activity.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    await logger.info('\n📊 CLEANUP RESULTS:');
    await logger.info(`  Deleted: ${deletedCount} test activities`);
    await logger.info(`  Errors: ${errorCount} activities`);
    await logger.info(`  Preserved: ${realActivities.length} real activities`);
    
    if (deletedCount > 0) {
      await logger.success(`✅ Successfully removed ${deletedCount} test activities`);
    }
    
    if (errorCount > 0) {
      await logger.warn(`⚠️  ${errorCount} activities had deletion errors`);
    }
    
    // Verify cleanup
    const newTimeline = await getActivityTimeline({ limit: 1000 });
    await logger.info(`📊 After cleanup: ${newTimeline.activities.length} activities remaining`);
    
    await logger.success('✅ Test activity cleanup completed');
    
  } catch (error) {
    await logger.error(`❌ Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    if (error instanceof Error) {
      await logger.error(`📋 Error Details: ${error.stack}`);
    }
    
    throw error;
  }
}

// Run the cleanup
clearTestActivities().catch(async (error) => {
  await logger.error(`💥 Script failed: ${error}`);
  process.exit(1);
});
#!/usr/bin/env node

/**
 * Script to monitor and prevent test activity creation
 * Usage: pnpm script scripts/monitor-activity-creation.ts
 */

import { logger } from './logger';
import { getActivityTimeline } from '../src/lib/activity-storage';

async function monitorActivityCreation() {
  await logger.info('👀 Monitoring activity creation patterns');
  
  try {
    const timeline = await getActivityTimeline({ limit: 50 });
    
    await logger.info(`📊 Found ${timeline.activities.length} total activities`);
    
    // Analyze activity creation patterns
    const testActivities = timeline.activities.filter(activity => 
      activity.id.includes('test-') ||
      activity.txid?.includes('test-') ||
      activity.owner.includes('test') ||
      activity.owner === 'unknown' ||
      activity.fromToken.symbol === 'unknown' ||
      activity.toToken.symbol === 'unknown'
    );
    
    const realActivities = timeline.activities.filter(activity => !testActivities.includes(activity));
    
    await logger.info(`📊 Current status:`);
    await logger.info(`  Real activities: ${realActivities.length}`);
    await logger.info(`  Test activities: ${testActivities.length}`);
    
    if (testActivities.length > 0) {
      await logger.warn(`⚠️  Found ${testActivities.length} test activities that need cleanup!`);
      
      // Show recent test activity creation timestamps
      const sortedTestActivities = testActivities.sort((a, b) => b.timestamp - a.timestamp);
      await logger.info('\n🕒 Recent test activity creation times:');
      sortedTestActivities.slice(0, 5).forEach((activity, index) => {
        const date = new Date(activity.timestamp);
        logger.info(`  ${index + 1}. ${activity.id} - ${date.toISOString()}`);
      });
      
      // Check if activities are being created in rapid succession
      if (sortedTestActivities.length >= 2) {
        const timeDiff = sortedTestActivities[0].timestamp - sortedTestActivities[1].timestamp;
        if (timeDiff < 60000) { // Less than 1 minute apart
          await logger.warn(`⚠️  Activities being created rapidly (${timeDiff}ms apart) - possible automated generation!`);
        }
      }
    } else {
      await logger.success(`✅ No test activities found - system is clean`);
    }
    
    // Show the 4 real activities we want to keep
    await logger.info('\n✅ Real activities to preserve:');
    realActivities.forEach((activity, index) => {
      logger.info(`  ${index + 1}. ${activity.id} - ${activity.owner} - ${activity.txid || 'no txid'}`);
    });
    
    // Provide recommendations
    if (testActivities.length > 0) {
      await logger.info('\n💡 RECOMMENDATIONS:');
      await logger.info('  1. Run clear-test-activities.ts to clean up test activities');
      await logger.info('  2. Check if any dev/test processes are running that create activities');
      await logger.info('  3. Look for any cron jobs or background processes creating test data');
      await logger.info('  4. Consider adding validation to prevent test activity creation in production');
    }
    
    await logger.success('✅ Activity monitoring completed');
    
  } catch (error) {
    await logger.error(`❌ Monitoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    if (error instanceof Error) {
      await logger.error(`📋 Error Details: ${error.stack}`);
    }
    
    throw error;
  }
}

// Run the monitoring
monitorActivityCreation().catch(async (error) => {
  await logger.error(`💥 Script failed: ${error}`);
  process.exit(1);
});
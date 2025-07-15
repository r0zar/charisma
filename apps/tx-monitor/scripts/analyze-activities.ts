#!/usr/bin/env node

/**
 * Script to analyze existing activities and identify fake/test data
 * Usage: pnpm script scripts/analyze-activities.ts
 */

import { logger } from './logger';
import { getActivityTimeline } from '../src/lib/activity-storage';

async function analyzeActivities() {
  await logger.info('🔍 Analyzing existing activities to identify fake/test data');
  
  try {
    const timeline = await getActivityTimeline({ limit: 1000 });
    
    await logger.info(`📊 Found ${timeline.activities.length} total activities`);
    
    const realActivities = [];
    const testActivities = [];
    
    for (const activity of timeline.activities) {
      // Identify test/fake activities by common patterns
      const isTest = 
        activity.id.includes('test-') ||
        activity.txid?.includes('test-') ||
        activity.owner.includes('test') ||
        activity.owner === 'SP1234567890ABCDEF' ||
        activity.fromToken.symbol === 'TEST' ||
        activity.toToken.symbol === 'TEST' ||
        activity.metadata?.notes?.includes('test') ||
        activity.metadata?.notes?.includes('dummy');
      
      if (isTest) {
        testActivities.push(activity);
      } else {
        realActivities.push(activity);
      }
    }
    
    await logger.info('\n📊 ACTIVITY ANALYSIS:');
    await logger.info(`  Real activities: ${realActivities.length}`);
    await logger.info(`  Test activities: ${testActivities.length}`);
    
    if (testActivities.length > 0) {
      await logger.info('\n🧪 TEST ACTIVITIES TO REMOVE:');
      testActivities.forEach((activity, index) => {
        logger.info(`  ${index + 1}. ${activity.id} - ${activity.type} - ${activity.owner} - ${activity.txid || 'no txid'}`);
      });
    }
    
    if (realActivities.length > 0) {
      await logger.info('\n✅ REAL ACTIVITIES TO KEEP:');
      realActivities.forEach((activity, index) => {
        logger.info(`  ${index + 1}. ${activity.id} - ${activity.type} - ${activity.owner} - ${activity.txid || 'no txid'}`);
        if (activity.metadata?.transactionAnalysis) {
          logger.info(`      ✅ Has transaction analysis`);
        } else {
          logger.info(`      ⚠️  Missing transaction analysis`);
        }
      });
    }
    
    await logger.success('✅ Activity analysis completed');
    
  } catch (error) {
    await logger.error(`❌ Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    if (error instanceof Error) {
      await logger.error(`📋 Error Details: ${error.stack}`);
    }
    
    throw error;
  }
}

// Run the analysis
analyzeActivities().catch(async (error) => {
  await logger.error(`💥 Script failed: ${error}`);
  process.exit(1);
});
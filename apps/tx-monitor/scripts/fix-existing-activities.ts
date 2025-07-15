#!/usr/bin/env node

/**
 * Script to update existing activities with transaction analysis data
 * Usage: pnpm script scripts/fix-existing-activities.ts
 */

import { logger } from './logger';
import { getActivityTimeline, updateActivity } from '../src/lib/activity-storage';
import { analyzeTransaction, extractActualOutputAmount } from '../src/lib/extract-actual-amounts';

async function fixExistingActivities() {
  await logger.info('🔧 Fixing existing activities with transaction analysis data');
  
  try {
    // Get all activities
    await logger.info('📊 Fetching all activities...');
    const timeline = await getActivityTimeline({ limit: 1000 });
    
    await logger.info(`📊 Found ${timeline.activities.length} total activities`);
    
    // Filter for completed instant swaps that have txids but no transaction analysis
    const activitiesToFix = timeline.activities.filter(activity => 
      activity.type === 'instant_swap' &&
      activity.status === 'completed' &&
      activity.txid &&
      activity.owner &&
      !activity.metadata?.transactionAnalysis
    );
    
    await logger.info(`🎯 Found ${activitiesToFix.length} activities to fix`);
    
    if (activitiesToFix.length === 0) {
      await logger.success('✅ No activities need fixing');
      return;
    }
    
    let fixedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const activity of activitiesToFix) {
      try {
        await logger.info(`\n🔄 Processing activity ${activity.id} (${activity.txid})`);
        
        // Extract actual output amount
        const actualAmount = await extractActualOutputAmount(
          activity.txid!,
          activity.owner,
          activity.toToken.contractId
        );
        
        if (!actualAmount) {
          await logger.warn(`⚠️  Could not extract actual amount for ${activity.txid}, skipping`);
          skippedCount++;
          continue;
        }
        
        await logger.info(`💰 Extracted actual amount: ${actualAmount}`);
        
        // Get quoted amount for slippage calculation
        const quotedAmount = activity.toToken.amount;
        
        // Perform comprehensive analysis
        const analysis = await analyzeTransaction(
          activity.txid!,
          activity.owner,
          activity.toToken.contractId,
          quotedAmount
        );
        
        if (!analysis) {
          await logger.warn(`⚠️  Could not analyze transaction ${activity.txid}, skipping`);
          skippedCount++;
          continue;
        }
        
        // Update activity with transaction analysis
        await updateActivity(activity.id, {
          metadata: {
            ...activity.metadata,
            transactionAnalysis: analysis,
            lastStatusUpdate: Date.now(),
            fixedAt: Date.now()
          }
        });
        
        fixedCount++;
        await logger.success(`✅ Fixed activity ${activity.id}`);
        
        if (analysis.analysis.slippage) {
          await logger.info(`  📊 Slippage: ${analysis.analysis.slippage.slippagePercent.toFixed(2)}%`);
        }
        
        // Rate limiting to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        errorCount++;
        await logger.error(`❌ Error processing activity ${activity.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    await logger.info('\n📊 FINAL RESULTS:');
    await logger.info(`  Fixed: ${fixedCount} activities`);
    await logger.info(`  Skipped: ${skippedCount} activities`);
    await logger.info(`  Errors: ${errorCount} activities`);
    
    if (fixedCount > 0) {
      await logger.success(`✅ Successfully enhanced ${fixedCount} activities with transaction analysis data`);
    }
    
    if (errorCount > 0) {
      await logger.warn(`⚠️  ${errorCount} activities had errors and may need manual review`);
    }
    
    await logger.success('✅ Activity fixing process completed');
    
  } catch (error) {
    await logger.error(`❌ Script failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    if (error instanceof Error) {
      await logger.error(`📋 Error Details: ${error.stack}`);
    }
    
    throw error;
  }
}

// Run the fix script
fixExistingActivities().catch(async (error) => {
  await logger.error(`💥 Script failed: ${error}`);
  process.exit(1);
});
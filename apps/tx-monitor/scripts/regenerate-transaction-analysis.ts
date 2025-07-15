#!/usr/bin/env node

/**
 * Script to force regenerate transaction analysis with updated slippage calculations
 * Usage: pnpm script scripts/regenerate-transaction-analysis.ts
 */

import { logger } from './logger';
import { getActivityTimeline, updateActivity } from '../src/lib/activity-storage';
import { analyzeTransaction } from '../src/lib/extract-actual-amounts';

async function regenerateTransactionAnalysis() {
  await logger.info('🔄 Regenerating transaction analysis with updated slippage calculations');
  
  try {
    const timeline = await getActivityTimeline({ limit: 100 });
    
    await logger.info(`📊 Found ${timeline.activities.length} total activities`);
    
    // Filter for completed instant swaps that have txids
    const activitiesToRegenerate = timeline.activities.filter(activity => 
      activity.type === 'instant_swap' &&
      activity.status === 'completed' &&
      activity.txid &&
      activity.owner
    );
    
    await logger.info(`🎯 Found ${activitiesToRegenerate.length} activities to regenerate`);
    
    if (activitiesToRegenerate.length === 0) {
      await logger.success('✅ No activities need regeneration');
      return;
    }
    
    let regeneratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const activity of activitiesToRegenerate) {
      try {
        await logger.info(`\n🔄 Regenerating analysis for activity ${activity.id} (${activity.txid})`);
        
        // Get quoted amount for slippage calculation
        const quotedAmount = activity.toToken.amount;
        
        // Perform fresh comprehensive analysis
        const analysis = await analyzeTransaction(
          activity.txid!,
          activity.owner,
          activity.toToken.contractId,
          quotedAmount
        );
        
        if (!analysis) {
          await logger.warn(`⚠️  Could not regenerate analysis for ${activity.txid}, skipping`);
          skippedCount++;
          continue;
        }
        
        // Update activity with regenerated transaction analysis
        await updateActivity(activity.id, {
          metadata: {
            ...activity.metadata,
            transactionAnalysis: analysis,
            lastStatusUpdate: Date.now(),
            regeneratedAt: Date.now()
          }
        });
        
        regeneratedCount++;
        await logger.success(`✅ Regenerated analysis for activity ${activity.id}`);
        
        if (analysis.analysis.slippage) {
          await logger.info(`  📊 Slippage: ${analysis.analysis.slippage.slippagePercent.toFixed(2)}%`);
          await logger.info(`  💰 Actual: ${analysis.analysis.slippage.actualAmount}, Quoted: ${analysis.analysis.slippage.quotedAmount}`);
        } else {
          await logger.info(`  📊 No valid slippage calculation (quoted amount may be 0)`);
        }
        
        // Rate limiting to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        errorCount++;
        await logger.error(`❌ Error regenerating analysis for activity ${activity.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    await logger.info('\n📊 REGENERATION RESULTS:');
    await logger.info(`  Regenerated: ${regeneratedCount} activities`);
    await logger.info(`  Skipped: ${skippedCount} activities`);
    await logger.info(`  Errors: ${errorCount} activities`);
    
    if (regeneratedCount > 0) {
      await logger.success(`✅ Successfully regenerated ${regeneratedCount} activities with updated transaction analysis`);
    }
    
    if (errorCount > 0) {
      await logger.warn(`⚠️  ${errorCount} activities had errors and may need manual review`);
    }
    
    await logger.success('✅ Transaction analysis regeneration completed');
    
  } catch (error) {
    await logger.error(`❌ Script failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    if (error instanceof Error) {
      await logger.error(`📋 Error Details: ${error.stack}`);
    }
    
    throw error;
  }
}

// Run the regeneration script
regenerateTransactionAnalysis().catch(async (error) => {
  await logger.error(`💥 Script failed: ${error}`);
  process.exit(1);
});
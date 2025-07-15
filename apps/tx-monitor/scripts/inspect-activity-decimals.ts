#!/usr/bin/env node

/**
 * Script to inspect activity token decimals and transaction analysis data
 * Usage: pnpm script scripts/inspect-activity-decimals.ts
 */

import { logger } from './logger';
import { getActivityTimeline } from '../src/lib/activity-storage';

async function inspectActivityDecimals() {
  await logger.info('🔍 Inspecting activity token decimals and transaction analysis data');
  
  try {
    const timeline = await getActivityTimeline({ limit: 10 });
    
    await logger.info(`📊 Found ${timeline.activities.length} activities`);
    
    for (const activity of timeline.activities) {
      await logger.info(`\n📋 Activity: ${activity.id}`);
      await logger.info(`  Type: ${activity.type}`);
      await logger.info(`  Status: ${activity.status}`);
      await logger.info(`  TXID: ${activity.txid || 'N/A'}`);
      
      await logger.info(`  From Token:`);
      await logger.info(`    Symbol: ${activity.fromToken.symbol}`);
      await logger.info(`    Contract: ${activity.fromToken.contractId}`);
      await logger.info(`    Decimals: ${activity.fromToken.decimals || 'undefined'}`);
      await logger.info(`    Amount: ${activity.fromToken.amount}`);
      
      await logger.info(`  To Token:`);
      await logger.info(`    Symbol: ${activity.toToken.symbol}`);
      await logger.info(`    Contract: ${activity.toToken.contractId}`);
      await logger.info(`    Decimals: ${activity.toToken.decimals || 'undefined'}`);
      await logger.info(`    Amount: ${activity.toToken.amount}`);
      
      if (activity.metadata?.transactionAnalysis) {
        const analysis = activity.metadata.transactionAnalysis;
        await logger.info(`  Transaction Analysis:`);
        await logger.info(`    Final Output Amount: ${analysis.analysis.finalOutputAmount || 'N/A'}`);
        
        if (analysis.analysis.slippage) {
          await logger.info(`    Slippage Data:`);
          await logger.info(`      Quoted: ${analysis.analysis.slippage.quotedAmount}`);
          await logger.info(`      Actual: ${analysis.analysis.slippage.actualAmount}`);
          await logger.info(`      Difference: ${analysis.analysis.slippage.difference}`);
          await logger.info(`      Percentage: ${analysis.analysis.slippage.slippagePercent}%`);
        }
      } else {
        await logger.info(`  No transaction analysis data`);
      }
    }
    
    await logger.success('✅ Activity inspection completed');
    
  } catch (error) {
    await logger.error(`❌ Inspection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    if (error instanceof Error) {
      await logger.error(`📋 Error Details: ${error.stack}`);
    }
    
    throw error;
  }
}

// Run the inspection
inspectActivityDecimals().catch(async (error) => {
  await logger.error(`💥 Script failed: ${error}`);
  process.exit(1);
});
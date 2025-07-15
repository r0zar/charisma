#!/usr/bin/env node

/**
 * Test script for comprehensive transaction analysis
 * Usage: pnpm script scripts/test-transaction-analysis.ts
 */

import { logger } from './logger';
import { analyzeTransaction, type TransactionAnalysis } from '../src/lib/extract-actual-amounts';

async function testTransactionAnalysis() {
  await logger.info('🧪 Testing comprehensive transaction analysis');
  
  try {
    // Test with the known real transaction
    const txid = '76fa8467d784479b0bb3d0b31255b7418d55bff76a35bb57c11edf06fb2ddb61';
    const userAddress = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
    const expectedOutputToken = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';
    const quotedAmount = '775707'; // From route metadata
    
    await logger.info(`📊 Analyzing transaction: ${txid}`);
    
    const analysis = await analyzeTransaction(txid, userAddress, expectedOutputToken, quotedAmount);
    
    if (!analysis) {
      await logger.error('❌ Analysis failed - no data returned');
      return;
    }
    
    await logger.success('✅ Analysis completed successfully!');
    
    // Display the analysis results
    await logger.info('\n📊 TRANSACTION ANALYSIS RESULTS:');
    await logger.info(`Transaction ID: ${analysis.txid}`);
    await logger.info(`User Address: ${analysis.userAddress}`);
    await logger.info(`Total Events: ${analysis.totalEvents}`);
    await logger.info(`Block Height: ${analysis.metadata.blockHeight}`);
    await logger.info(`Transaction Status: ${analysis.metadata.txStatus}`);
    
    await logger.info('\n🔄 INPUT TOKENS (sent by user):');
    if (analysis.analysis.inputTokens.length === 0) {
      await logger.info('  No direct input tokens found (tokens sent from user)');
    } else {
      analysis.analysis.inputTokens.forEach((token, index) => {
        logger.info(`  ${index + 1}. ${token.assetId}: ${token.amount} (event ${token.eventIndex})`);
      });
    }
    
    await logger.info('\n📥 OUTPUT TOKENS (received by user):');
    analysis.analysis.outputTokens.forEach((token, index) => {
      logger.info(`  ${index + 1}. ${token.assetId}: ${token.amount} (event ${token.eventIndex})`);
      logger.info(`      Sent from: ${token.sender}`);
    });
    
    await logger.info('\n🎯 FINAL OUTPUT ANALYSIS:');
    await logger.info(`Expected Output Token: ${analysis.analysis.expectedOutputToken}`);
    await logger.info(`Final Output Amount: ${analysis.analysis.finalOutputAmount || 'Not found'}`);
    
    if (analysis.analysis.slippage) {
      await logger.info('\n📊 SLIPPAGE ANALYSIS:');
      await logger.info(`Quoted Amount: ${analysis.analysis.slippage.quotedAmount}`);
      await logger.info(`Actual Amount: ${analysis.analysis.slippage.actualAmount}`);
      await logger.info(`Difference: ${analysis.analysis.slippage.difference} tokens`);
      await logger.info(`Slippage: ${analysis.analysis.slippage.slippagePercent.toFixed(2)}%`);
      
      if (analysis.analysis.slippage.slippagePercent > 0) {
        await logger.warn(`⚠️  User received ${analysis.analysis.slippage.slippagePercent.toFixed(2)}% less than quoted`);
      } else {
        await logger.success(`🎉 User received more than quoted!`);
      }
    }
    
    // Show how this would be stored in activity metadata
    await logger.info('\n💾 STORAGE FORMAT:');
    await logger.info('This analysis data can be stored in activity metadata as:');
    await logger.info(JSON.stringify({
      transactionAnalysis: analysis
    }, null, 2));
    
    await logger.success('✅ Transaction analysis testing completed');
    
  } catch (error) {
    await logger.error(`❌ Testing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    if (error instanceof Error) {
      await logger.error(`📋 Error Details: ${error.stack}`);
    }
    
    throw error;
  }
}

// Run the test
testTransactionAnalysis().catch(async (error) => {
  await logger.error(`💥 Script failed: ${error}`);
  process.exit(1);
});
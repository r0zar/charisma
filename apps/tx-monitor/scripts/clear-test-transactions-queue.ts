#!/usr/bin/env node

/**
 * Script to clear test transactions from the monitoring queue
 * Usage: pnpm script scripts/clear-test-transactions-queue.ts
 */

import { logger } from './logger';
import { kv } from '@vercel/kv';

async function clearTestTransactionQueue() {
  await logger.info('🧹 Clearing test transactions from monitoring queue');
  
  try {
    // Get all transaction IDs from the queue
    const queuedTxids = await kv.smembers('tx_queue');
    
    await logger.info(`📊 Found ${queuedTxids.length} transactions in queue`);
    
    if (queuedTxids.length === 0) {
      await logger.success('✅ No transactions in queue to clean');
      return;
    }
    
    const testTxids = [];
    const realTxids = [];
    
    // Categorize transactions
    for (const txid of queuedTxids) {
      if (txid.includes('test-') || txid.startsWith('test') || txid.length < 20) {
        testTxids.push(txid);
      } else {
        realTxids.push(txid);
      }
    }
    
    await logger.info(`📊 Analysis:`);
    await logger.info(`  Test TXIDs to remove: ${testTxids.length}`);
    await logger.info(`  Real TXIDs to keep: ${realTxids.length}`);
    
    if (testTxids.length > 0) {
      await logger.info('\n🧪 Test TXIDs to remove:');
      testTxids.forEach((txid, index) => {
        logger.info(`  ${index + 1}. ${txid}`);
      });
    }
    
    if (realTxids.length > 0) {
      await logger.info('\n✅ Real TXIDs to preserve:');
      realTxids.forEach((txid, index) => {
        logger.info(`  ${index + 1}. ${txid}`);
      });
    }
    
    let removedCount = 0;
    let errorCount = 0;
    
    // Remove test transactions from queue
    for (const testTxid of testTxids) {
      try {
        await kv.srem('tx_queue', testTxid);
        removedCount++;
        
        // Also clean up any transaction status data
        await kv.del(`tx_status:${testTxid}`);
        await kv.del(`tx_mapping:${testTxid}`);
        
        await logger.info(`🗑️  Removed ${testTxid} from queue and cleaned up metadata`);
        
      } catch (error) {
        errorCount++;
        await logger.error(`❌ Error removing ${testTxid}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Verify queue cleanup
    const remainingTxids = await kv.smembers('tx_queue');
    
    await logger.info('\n📊 CLEANUP RESULTS:');
    await logger.info(`  Removed: ${removedCount} test transactions`);
    await logger.info(`  Errors: ${errorCount} transactions`);
    await logger.info(`  Remaining in queue: ${remainingTxids.length} transactions`);
    
    if (remainingTxids.length > 0) {
      await logger.info('\n📋 Remaining transactions in queue:');
      remainingTxids.forEach((txid, index) => {
        logger.info(`  ${index + 1}. ${txid}`);
      });
    }
    
    if (removedCount > 0) {
      await logger.success(`✅ Successfully removed ${removedCount} test transactions from queue`);
    }
    
    if (errorCount > 0) {
      await logger.warn(`⚠️  ${errorCount} transactions had removal errors`);
    }
    
    await logger.success('✅ Transaction queue cleanup completed');
    
  } catch (error) {
    await logger.error(`❌ Queue cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    if (error instanceof Error) {
      await logger.error(`📋 Error Details: ${error.stack}`);
    }
    
    throw error;
  }
}

// Run the cleanup
clearTestTransactionQueue().catch(async (error) => {
  await logger.error(`💥 Script failed: ${error}`);
  process.exit(1);
});
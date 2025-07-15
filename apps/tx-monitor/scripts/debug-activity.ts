#!/usr/bin/env node

/**
 * Script to debug activity data structure
 * Usage: pnpm script scripts/debug-activity.ts
 */

import { logger } from './logger';
import { getActivity } from '../src/lib/activity-storage';

async function debugActivity() {
  await logger.info('🔍 Starting activity data structure debug');
  
  try {
    const activityId = '6392b34b-b611-4dbc-b075-49cbf8470e27';
    
    await logger.info(`📊 Fetching activity: ${activityId}`);
    
    const activity = await getActivity(activityId);
    
    if (!activity) {
      await logger.error(`❌ Activity not found: ${activityId}`);
      return;
    }
    
    await logger.info('📋 Complete Activity Data Structure:');
    await logger.info(JSON.stringify(activity, null, 2));
    
    await logger.info('\n🔍 Detailed Field Analysis:');
    
    // Analyze fromToken
    await logger.info('\n📈 FROM TOKEN:');
    await logger.info(`  Symbol: ${activity.fromToken.symbol}`);
    await logger.info(`  Amount: ${activity.fromToken.amount} (type: ${typeof activity.fromToken.amount})`);
    await logger.info(`  Decimals: ${activity.fromToken.decimals} (type: ${typeof activity.fromToken.decimals})`);
    await logger.info(`  USD Value: ${activity.fromToken.usdValue} (type: ${typeof activity.fromToken.usdValue})`);
    await logger.info(`  Contract ID: ${activity.fromToken.contractId}`);
    
    if (activity.fromToken.priceSnapshot) {
      await logger.info(`  Price Snapshot: ${JSON.stringify(activity.fromToken.priceSnapshot, null, 2)}`);
    } else {
      await logger.info(`  Price Snapshot: Not present`);
    }
    
    // Analyze toToken
    await logger.info('\n📉 TO TOKEN:');
    await logger.info(`  Symbol: ${activity.toToken.symbol}`);
    await logger.info(`  Amount: ${activity.toToken.amount} (type: ${typeof activity.toToken.amount})`);
    await logger.info(`  Decimals: ${activity.toToken.decimals} (type: ${typeof activity.toToken.decimals})`);
    await logger.info(`  USD Value: ${activity.toToken.usdValue} (type: ${typeof activity.toToken.usdValue})`);
    await logger.info(`  Contract ID: ${activity.toToken.contractId}`);
    
    if (activity.toToken.priceSnapshot) {
      await logger.info(`  Price Snapshot: ${JSON.stringify(activity.toToken.priceSnapshot, null, 2)}`);
    } else {
      await logger.info(`  Price Snapshot: Not present`);
    }
    
    // Activity metadata
    await logger.info('\n📋 ACTIVITY METADATA:');
    await logger.info(`  ID: ${activity.id}`);
    await logger.info(`  Type: ${activity.type}`);
    await logger.info(`  Status: ${activity.status}`);
    await logger.info(`  Owner: ${activity.owner}`);
    await logger.info(`  TXID: ${activity.txid}`);
    await logger.info(`  Timestamp: ${activity.timestamp} (${new Date(activity.timestamp).toLocaleString()})`);
    
    if (activity.metadata) {
      await logger.info(`  Metadata: ${JSON.stringify(activity.metadata, null, 2)}`);
    }
    
    // Conditional checks for UI display
    await logger.info('\n🎨 UI DISPLAY CONDITIONS:');
    await logger.info(`  Status === 'completed': ${activity.status === 'completed'}`);
    await logger.info(`  Type === 'instant_swap': ${activity.type === 'instant_swap'}`);
    await logger.info(`  fromToken.usdValue exists: ${!!activity.fromToken.usdValue}`);
    await logger.info(`  toToken.usdValue exists: ${!!activity.toToken.usdValue}`);
    await logger.info(`  fromToken.amount exists: ${!!activity.fromToken.amount}`);
    await logger.info(`  toToken.amount exists: ${!!activity.toToken.amount}`);
    
    const shouldShowTraded = activity.status === 'completed' && 
                            activity.type === 'instant_swap' && 
                            activity.fromToken.usdValue && 
                            activity.toToken.usdValue;
    
    const shouldShowReceived = activity.toToken.amount && activity.fromToken.amount;
    
    await logger.info(`  Should show "Traded" section: ${shouldShowTraded}`);
    await logger.info(`  Should show "Received" section: ${shouldShowReceived}`);
    
    await logger.success('✅ Activity data structure debug completed');
    
  } catch (error) {
    await logger.error(`❌ Debug failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    if (error instanceof Error) {
      await logger.error(`📋 Error Details: ${error.stack}`);
    }
    
    throw error;
  }
}

// Run the debug
debugActivity().catch(async (error) => {
  await logger.error(`💥 Script failed: ${error}`);
  process.exit(1);
});
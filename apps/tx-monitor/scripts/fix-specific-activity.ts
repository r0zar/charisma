#!/usr/bin/env node

/**
 * Script to fix a specific activity with route data
 * Usage: pnpm script scripts/fix-specific-activity.ts
 */

import { logger } from './logger';
import { getActivity, updateActivity } from '../src/lib/activity-storage';
import { kv } from '@vercel/kv';

async function fixSpecificActivity() {
  await logger.info('🔧 Starting specific activity fix');
  
  try {
    const activityId = '6392b34b-b611-4dbc-b075-49cbf8470e27';
    
    await logger.info(`📊 Fetching activity: ${activityId}`);
    
    const activity = await getActivity(activityId);
    
    if (!activity) {
      await logger.error(`❌ Activity not found: ${activityId}`);
      return;
    }
    
    await logger.info(`📊 Current activity state:`);
    await logger.info(`  From: ${activity.fromToken.amount} ${activity.fromToken.symbol}`);
    await logger.info(`  To: ${activity.toToken.amount} ${activity.toToken.symbol}`);
    await logger.info(`  USD Values: From=$${activity.fromToken.usdValue || 'N/A'}, To=$${activity.toToken.usdValue || 'N/A'}`);
    
    // Get the swap record
    const swapData = await kv.hget('swap-records', activityId);
    
    if (!swapData) {
      await logger.error(`❌ No swap record found for ${activityId}`);
      return;
    }
    
    const swap = typeof swapData === 'string' ? JSON.parse(swapData) : swapData;
    
    if (!swap.metadata?.route || !Array.isArray(swap.metadata.route)) {
      await logger.error(`❌ No route metadata found for ${activityId}`);
      return;
    }
    
    // Extract the final output amount from the last route step
    const route = swap.metadata.route;
    const lastStep = route[route.length - 1];
    
    if (!lastStep?.quote?.amountOut) {
      await logger.error(`❌ No final amount found in route for ${activityId}`);
      return;
    }
    
    const finalOutputAmount = lastStep.quote.amountOut;
    const outputToken = lastStep.tokenOut;
    
    await logger.info(`📊 Route analysis:`);
    await logger.info(`  Expected final output: ${finalOutputAmount} ${outputToken?.symbol || 'tokens'}`);
    await logger.info(`  Current stored amount: ${activity.toToken.amount}`);
    
    // Calculate proper USD value for fromToken (aeUSDC should be ~$1)
    const fromAmountDecimal = parseFloat(activity.fromToken.amount.toString()) / Math.pow(10, activity.fromToken.decimals || 6);
    const fromUsdValue = fromAmountDecimal * 1.0; // aeUSDC ≈ $1
    
    // Calculate USD value for toToken (rough estimate for CHA)
    const toAmountDecimal = finalOutputAmount / Math.pow(10, activity.toToken.decimals || 6);
    const chaEstimatedPrice = 0.003; // Very rough estimate
    const toUsdValue = toAmountDecimal * chaEstimatedPrice;
    
    // Prepare the update
    const updates = {
      fromToken: {
        ...activity.fromToken,
        usdValue: fromUsdValue
      },
      toToken: {
        ...activity.toToken,
        amount: finalOutputAmount.toString(),
        usdValue: toUsdValue
      },
      metadata: {
        ...activity.metadata,
        actualOutputAmount: finalOutputAmount,
        fixedByScript: true,
        lastDataFix: Date.now(),
        priceEstimates: {
          aeUSDC: 1.0,
          CHA: chaEstimatedPrice
        }
      }
    };
    
    await logger.info(`📊 Proposed updates:`);
    await logger.info(`  From USD: ${activity.fromToken.usdValue || 'N/A'} → $${fromUsdValue.toFixed(2)}`);
    await logger.info(`  To Amount: ${activity.toToken.amount} → ${finalOutputAmount}`);
    await logger.info(`  To USD: ${activity.toToken.usdValue || 'N/A'} → $${toUsdValue.toFixed(2)}`);
    
    // Apply the update
    await updateActivity(activityId, updates);
    
    await logger.success(`✅ Successfully fixed activity ${activityId}!`);
    
    // Verify the fix
    const updatedActivity = await getActivity(activityId);
    if (updatedActivity) {
      await logger.info(`📊 Verification - Updated activity state:`);
      await logger.info(`  From: ${updatedActivity.fromToken.amount} ${updatedActivity.fromToken.symbol} ($${updatedActivity.fromToken.usdValue?.toFixed(2) || 'N/A'})`);
      await logger.info(`  To: ${updatedActivity.toToken.amount} ${updatedActivity.toToken.symbol} ($${updatedActivity.toToken.usdValue?.toFixed(2) || 'N/A'})`);
    }
    
    await logger.success('✅ Specific activity fix completed successfully');
    
  } catch (error) {
    await logger.error(`❌ Fix failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    if (error instanceof Error) {
      await logger.error(`📋 Error Details: ${error.stack}`);
    }
    
    throw error;
  }
}

// Run the fix
fixSpecificActivity().catch(async (error) => {
  await logger.error(`💥 Script failed: ${error}`);
  process.exit(1);
});
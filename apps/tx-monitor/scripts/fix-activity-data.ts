#!/usr/bin/env node

/**
 * Script to fix activity data by extracting actual amounts from swap route metadata
 * Usage: pnpm script scripts/fix-activity-data.ts
 */

import { logger } from './logger';
import { getActivityTimeline, updateActivity } from '../src/lib/activity-storage';
import { kv } from '@vercel/kv';

interface RouteQuote {
  amountIn: number;
  amountOut: number;
}

interface RouteStep {
  quote: RouteQuote;
  tokenOut?: {
    contractId: string;
    symbol?: string;
    decimals?: number;
  };
}

async function fixActivityData() {
  await logger.info('🔧 Starting activity data fix process');
  
  try {
    // Step 1: Get activities that might need fixing
    await logger.info('📊 Step 1: Getting activities to fix...');
    
    const timeline = await getActivityTimeline({ limit: 50 });
    const activitiesToFix = timeline.activities.filter(activity => 
      activity.type === 'instant_swap' && 
      (!activity.toToken.amount || activity.toToken.amount === '0' || activity.toToken.amount === 0)
    );
    
    await logger.info(`📊 Found ${activitiesToFix.length} activities that might need fixing`);
    
    if (activitiesToFix.length === 0) {
      await logger.info('✅ No activities need fixing');
      return;
    }
    
    let fixed = 0;
    let skipped = 0;
    let errors = 0;
    
    // Step 2: Fix each activity
    for (const activity of activitiesToFix) {
      try {
        await logger.info(`🔍 Analyzing activity ${activity.id}`);
        
        // Get the swap record to extract route information
        const swapData = await kv.hget('swap-records', activity.id);
        
        if (!swapData) {
          await logger.warn(`  ⚠️ No swap record found for ${activity.id}`);
          skipped++;
          continue;
        }
        
        const swap = typeof swapData === 'string' ? JSON.parse(swapData) : swapData;
        
        if (!swap.metadata?.route || !Array.isArray(swap.metadata.route)) {
          await logger.warn(`  ⚠️ No route metadata found for ${activity.id}`);
          skipped++;
          continue;
        }
        
        // Extract the final output amount from the last route step
        const route = swap.metadata.route as RouteStep[];
        const lastStep = route[route.length - 1];
        
        if (!lastStep?.quote?.amountOut) {
          await logger.warn(`  ⚠️ No final amount found in route for ${activity.id}`);
          skipped++;
          continue;
        }
        
        const finalOutputAmount = lastStep.quote.amountOut;
        const outputToken = lastStep.tokenOut;
        
        await logger.info(`  📊 Found final output: ${finalOutputAmount} ${outputToken?.symbol || 'tokens'}`);
        
        // Prepare the update
        const updates: any = {
          toToken: {
            ...activity.toToken,
            amount: finalOutputAmount.toString()
          },
          metadata: {
            ...activity.metadata,
            actualOutputAmount: finalOutputAmount,
            fixedByScript: true,
            lastDataFix: Date.now()
          }
        };
        
        // Update token info if we have better data
        if (outputToken) {
          if (outputToken.symbol && outputToken.symbol !== activity.toToken.symbol) {
            updates.toToken.symbol = outputToken.symbol;
          }
          if (outputToken.decimals && outputToken.decimals !== activity.toToken.decimals) {
            updates.toToken.decimals = outputToken.decimals;
          }
        }
        
        // Try to calculate USD value if we can estimate the price
        if (finalOutputAmount > 0) {
          // For CHA tokens, we can try to estimate based on context
          if (activity.toToken.contractId === 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token') {
            // Very rough estimate - could be improved with actual price data
            const chaAmount = finalOutputAmount / Math.pow(10, activity.toToken.decimals || 6);
            const estimatedPrice = 0.003; // Very rough estimate
            updates.toToken.usdValue = chaAmount * estimatedPrice;
            
            await logger.info(`  💰 Estimated USD value: $${updates.toToken.usdValue.toFixed(2)}`);
          }
        }
        
        // Apply the update
        await updateActivity(activity.id, updates);
        
        await logger.success(`  ✅ Fixed activity ${activity.id}: amount ${activity.toToken.amount} → ${finalOutputAmount}`);
        fixed++;
        
      } catch (error) {
        await logger.error(`  ❌ Error fixing ${activity.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        errors++;
      }
    }
    
    // Step 3: Summary
    await logger.info('📊 Step 3: Fix Summary...');
    
    await logger.info(`📊 Fix Results:
      ✅ Fixed Activities: ${fixed}
      ⏭️ Skipped (no data): ${skipped}
      ❌ Errors: ${errors}
      📈 Total Processed: ${activitiesToFix.length}`);
    
    if (fixed > 0) {
      await logger.success(`🎉 Successfully fixed ${fixed} activities with actual swap results!`);
    }
    
    if (skipped > 0) {
      await logger.info(`⏭️ ${skipped} activities were skipped due to missing route data`);
    }
    
    if (errors > 0) {
      await logger.warn(`⚠️ ${errors} activities had errors during fixing`);
    }
    
    await logger.success('✅ Activity data fix process completed');
    
  } catch (error) {
    await logger.error(`❌ Fix process failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    if (error instanceof Error) {
      await logger.error(`📋 Error Details: ${error.stack}`);
    }
    
    throw error;
  }
}

// Run the fix
fixActivityData().catch(async (error) => {
  await logger.error(`💥 Script failed: ${error}`);
  process.exit(1);
});
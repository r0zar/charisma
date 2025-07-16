#!/usr/bin/env tsx

import { getActivity, getActivityTimeline } from '../src/lib/activity-storage';
import { calculateTradeProfitability } from '../src/lib/profitability-service';
import { logger } from './logger';

async function debugProfitabilityCalculation() {
  logger.info('🔍 Starting profitability calculation debug...');

  try {
    // Get recent completed instant swaps
    const activities = await getActivityTimeline({
      limit: 10,
      types: ['instant_swap'],
      statuses: ['completed']
    });

    logger.info(`📊 Found ${activities.activities.length} completed instant swaps`);

    if (activities.activities.length === 0) {
      logger.warn('❌ No completed instant swaps found to test');
      return;
    }

    // Test profitability calculation on each activity
    for (const activity of activities.activities.slice(0, 3)) { // Test first 3
      logger.info(`\n🔄 Testing activity: ${activity.id}`);
      
      // Log detailed activity data
      logger.info('📋 Activity details:', {
        id: activity.id,
        status: activity.status,
        type: activity.type,
        timestamp: new Date(activity.timestamp).toISOString(),
        fromToken: {
          symbol: activity.fromToken.symbol,
          amount: activity.fromToken.amount,
          decimals: activity.fromToken.decimals,
          usdValue: activity.fromToken.usdValue,
          priceSnapshot: activity.fromToken.priceSnapshot ? {
            price: activity.fromToken.priceSnapshot.price,
            timestamp: new Date(activity.fromToken.priceSnapshot.timestamp).toISOString(),
            source: activity.fromToken.priceSnapshot.source
          } : null
        },
        toToken: {
          symbol: activity.toToken.symbol,
          amount: activity.toToken.amount,
          decimals: activity.toToken.decimals,
          usdValue: activity.toToken.usdValue,
          priceSnapshot: activity.toToken.priceSnapshot ? {
            price: activity.toToken.priceSnapshot.price,
            timestamp: new Date(activity.toToken.priceSnapshot.timestamp).toISOString(),
            source: activity.toToken.priceSnapshot.source
          } : null
        }
      });

      // Test profitability calculation
      try {
        const profitabilityData = await calculateTradeProfitability(activity);
        
        if (profitabilityData) {
          logger.info('✅ Profitability calculation successful:', {
            metrics: profitabilityData.metrics,
            chartDataPoints: profitabilityData.chartData.length,
            tokenBreakdown: profitabilityData.tokenBreakdown
          });
        } else {
          logger.warn('❌ Profitability calculation returned null');
        }
      } catch (error) {
        logger.error('💥 Error in profitability calculation:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    }

    // Test entry price detection strategies
    logger.info('\n🎯 Testing entry price detection strategies...');
    
    const testActivity = activities.activities[0];
    if (testActivity) {
      logger.info('🔍 Entry price analysis for activity:', { activityId: testActivity.id });
      
      // Strategy 1: Price snapshots
      const hasFromSnapshot = !!testActivity.fromToken.priceSnapshot;
      const hasToSnapshot = !!testActivity.toToken.priceSnapshot;
      logger.info('📸 Price snapshot availability:', {
        fromToken: hasFromSnapshot,
        toToken: hasToSnapshot,
        both: hasFromSnapshot && hasToSnapshot
      });

      // Strategy 2: USD values
      const hasFromUsd = !!testActivity.fromToken.usdValue;
      const hasToUsd = !!testActivity.toToken.usdValue;
      const hasFromAmount = !!testActivity.fromToken.amount && parseFloat(testActivity.fromToken.amount) > 0;
      const hasToAmount = !!testActivity.toToken.amount && parseFloat(testActivity.toToken.amount) > 0;
      logger.info('💰 USD value calculation possibility:', {
        fromUsdValue: hasFromUsd,
        toUsdValue: hasToUsd,
        fromAmount: hasFromAmount,
        toAmount: hasToAmount,
        canCalculate: hasFromUsd && hasToUsd && hasFromAmount && hasToAmount
      });

      // Strategy 3: Price snapshots
      const hasFromPriceSnapshot = !!testActivity.fromToken.priceSnapshot;
      const hasToPriceSnapshot = !!testActivity.toToken.priceSnapshot;
      logger.info('💹 Price snapshot availability:', {
        fromToken: hasFromPriceSnapshot,
        toToken: hasToPriceSnapshot,
        both: hasFromPriceSnapshot && hasToPriceSnapshot
      });

      // Calculate actual entry prices if possible
      if (hasFromUsd && hasToUsd && hasFromAmount && hasToAmount) {
        const fromEntryPrice = testActivity.fromToken.usdValue! / parseFloat(testActivity.fromToken.amount);
        const toEntryPrice = testActivity.toToken.usdValue! / parseFloat(testActivity.toToken.amount);
        logger.info('🧮 Calculated entry prices from USD values:', {
          fromToken: {
            symbol: testActivity.fromToken.symbol,
            entryPrice: fromEntryPrice,
            usdValue: testActivity.fromToken.usdValue,
            amount: testActivity.fromToken.amount
          },
          toToken: {
            symbol: testActivity.toToken.symbol,
            entryPrice: toEntryPrice,
            usdValue: testActivity.toToken.usdValue,
            amount: testActivity.toToken.amount
          }
        });
      }
    }

    logger.info('\n✅ Profitability debug completed');

  } catch (error) {
    logger.error('💥 Error during profitability debug:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

// Run the debug
debugProfitabilityCalculation().catch(console.error);
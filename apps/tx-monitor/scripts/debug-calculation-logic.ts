#!/usr/bin/env tsx

import { getActivity } from '../src/lib/activity-storage';
import { logger } from './logger';

async function debugCalculationLogic() {
  logger.info('🔍 Debugging profitability calculation logic...');

  const testActivityId = '6392b34b-b611-4dbc-b075-49cbf8470e27'; // The one returning extreme values

  try {
    const activity = await getActivity(testActivityId);
    if (!activity) {
      logger.error('❌ Activity not found:', { activityId: testActivityId });
      return;
    }

    logger.info('📋 Raw activity data:');
    logger.info(`ID: ${activity.id}`);
    logger.info(`Status: ${activity.status}`);
    logger.info(`Type: ${activity.type}`);
    logger.info(`Timestamp: ${activity.timestamp} Date: ${new Date(activity.timestamp).toISOString()}`);
    logger.info('FromToken:', {
      symbol: activity.fromToken.symbol,
      amount: activity.fromToken.amount,
      amountType: typeof activity.fromToken.amount,
      decimals: activity.fromToken.decimals,
      usdValue: activity.fromToken.usdValue,
      price: activity.fromToken.priceSnapshot?.price,
      priceSnapshot: activity.fromToken.priceSnapshot
    });
    logger.info('ToToken:', {
      symbol: activity.toToken.symbol,
      amount: activity.toToken.amount,
      amountType: typeof activity.toToken.amount,
      decimals: activity.toToken.decimals,
      usdValue: activity.toToken.usdValue,
      price: activity.toToken.priceSnapshot?.price,
      priceSnapshot: activity.toToken.priceSnapshot
    });

    // Test different decimal conversion scenarios
    logger.info('🧮 Testing decimal conversions:');
    
    // Parse amounts
    const fromAmountRaw = activity.fromToken.amount;
    const toAmountRaw = activity.toToken.amount;
    const fromAmountFloat = parseFloat(fromAmountRaw);
    const toAmountFloat = parseFloat(toAmountRaw);
    
    logger.info('Amount parsing:', {
      fromAmountRaw,
      toAmountRaw,
      fromAmountFloat,
      toAmountFloat
    });

    // Test with different decimal assumptions
    const fromDecimals = activity.fromToken.decimals || 6;
    const toDecimals = activity.toToken.decimals || 6;
    
    const fromAmountDecimalAdjusted = fromAmountFloat / Math.pow(10, fromDecimals);
    const toAmountDecimalAdjusted = toAmountFloat / Math.pow(10, toDecimals);
    
    logger.info('Decimal-adjusted amounts:', {
      fromDecimals,
      toDecimals,
      fromAmountDecimalAdjusted,
      toAmountDecimalAdjusted
    });

    // Test price calculations
    if (activity.fromToken.usdValue && activity.toToken.usdValue) {
      // Current calculation (likely wrong)
      const currentFromPrice = activity.fromToken.usdValue / fromAmountFloat;
      const currentToPrice = activity.toToken.usdValue / toAmountFloat;
      
      // Corrected calculation with decimals
      const correctedFromPrice = activity.fromToken.usdValue / fromAmountDecimalAdjusted;
      const correctedToPrice = activity.toToken.usdValue / toAmountDecimalAdjusted;
      
      logger.info('Price calculations:', {
        current: {
          fromPrice: currentFromPrice,
          toPrice: currentToPrice
        },
        corrected: {
          fromPrice: correctedFromPrice,
          toPrice: correctedToPrice
        }
      });

      // Test original trade value calculations
      const currentOriginalValue = fromAmountFloat * currentFromPrice;
      const correctedOriginalValue = fromAmountDecimalAdjusted * correctedFromPrice;
      
      logger.info('Original trade value:', {
        current: currentOriginalValue,
        corrected: correctedOriginalValue,
        expectedUsdValue: activity.fromToken.usdValue
      });

      // Test P&L calculation
      const currentPositionValue = toAmountFloat * currentToPrice;
      const correctedPositionValue = toAmountDecimalAdjusted * correctedToPrice;
      
      const currentPnL = ((currentPositionValue - currentOriginalValue) / currentOriginalValue) * 100;
      const correctedPnL = ((correctedPositionValue - correctedOriginalValue) / correctedOriginalValue) * 100;
      
      logger.info('P&L calculations:', {
        current: {
          positionValue: currentPositionValue,
          originalValue: currentOriginalValue,
          pnlPercentage: currentPnL
        },
        corrected: {
          positionValue: correctedPositionValue,
          originalValue: correctedOriginalValue,
          pnlPercentage: correctedPnL
        }
      });
    }

    // Test realistic scenarios
    logger.info('🎯 Testing realistic scenario:');
    
    // Assume this is a $0.25 USDC to CHA trade
    // 250000 microUSDC = 0.25 USDC (6 decimals)
    // 775707 microCHA = 775.707 CHA (3 decimals? or 6?)
    
    const assumedFromUSDC = 0.25; // $0.25
    const assumedFromAmount = 0.25; // 0.25 USDC
    const assumedFromPrice = 1.0; // $1 per USDC
    
    // If CHA has 6 decimals: 775707 / 1e6 = 0.775707 CHA
    // If CHA has 3 decimals: 775707 / 1e3 = 775.707 CHA
    
    const chaAmount6Decimals = toAmountFloat / 1e6;
    const chaAmount3Decimals = toAmountFloat / 1e3;
    
    logger.info('CHA amount scenarios:', {
      raw: toAmountFloat,
      with6Decimals: chaAmount6Decimals,
      with3Decimals: chaAmount3Decimals,
      usdValue: activity.toToken.usdValue
    });

    if (activity.toToken.usdValue) {
      const chaPrice6Dec = activity.toToken.usdValue / chaAmount6Decimals;
      const chaPrice3Dec = activity.toToken.usdValue / chaAmount3Decimals;
      
      logger.info('CHA price scenarios:', {
        with6Decimals: chaPrice6Dec,
        with3Decimals: chaPrice3Dec
      });

      // Calculate realistic P&L
      const originalValue = assumedFromUSDC;
      const currentValue6Dec = chaAmount6Decimals * chaPrice6Dec;
      const currentValue3Dec = chaAmount3Decimals * chaPrice3Dec;
      
      const pnl6Dec = ((currentValue6Dec - originalValue) / originalValue) * 100;
      const pnl3Dec = ((currentValue3Dec - originalValue) / originalValue) * 100;
      
      logger.info('Realistic P&L scenarios:', {
        originalValue,
        scenario6Decimals: {
          currentValue: currentValue6Dec,
          pnlPercentage: pnl6Dec
        },
        scenario3Decimals: {
          currentValue: currentValue3Dec,
          pnlPercentage: pnl3Dec
        }
      });
    }

  } catch (error) {
    logger.error('💥 Debug failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

// Run the debug
debugCalculationLogic().catch(console.error);
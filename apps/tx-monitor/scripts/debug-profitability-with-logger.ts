/**
 * Debug script to analyze profitability calculation logic using proper logger
 */

import { logger } from './logger'; // This also imports dotenv
import { getActivity } from '../src/lib/activity-storage';

async function debugProfitabilityCalculations() {
  logger.info('🔍 Debugging Profitability Calculation Logic');

  try {
    // Test the specific activity with suspicious stats
    const activityId = 'a970bbc2-3750-42fd-bd25-92bf65b2f046';
    const activity = await getActivity(activityId);
    
    if (!activity) {
      logger.error('❌ Activity not found');
      return;
    }

    logger.info('📋 Activity Data', {
      input: `${activity.fromToken.amount} ${activity.fromToken.symbol}`,
      output: `${activity.toToken.amount} ${activity.toToken.symbol}`,
      inputUsdValue: activity.fromToken.usdValue,
      outputUsdValue: activity.toToken.usdValue
    });
    
    // Calculate what the REAL entry price should be
    const inputAmount = parseFloat(activity.fromToken.amount) / Math.pow(10, activity.fromToken.decimals || 6);
    const outputAmount = parseFloat(activity.toToken.amount) / Math.pow(10, activity.toToken.decimals || 6);
    const realEntryPricePerCHA = inputAmount / outputAmount;
    
    logger.info('💡 REAL Entry Price Calculation', {
      inputAmount: `${inputAmount} ${activity.fromToken.symbol}`,
      outputAmount: `${outputAmount} ${activity.toToken.symbol}`,
      realEntryPrice: `$${realEntryPricePerCHA.toFixed(6)} per ${activity.toToken.symbol}`
    });

    // Entry Price Logic Analysis
    logger.info('🔍 Entry Price Logic Analysis');
    
    // Strategy 1: Price snapshots
    logger.info('Strategy 1 - Price Snapshots', {
      fromTokenSnapshot: activity.fromToken.priceSnapshot?.price || 'N/A',
      toTokenSnapshot: activity.toToken.priceSnapshot?.price || 'N/A'
    });
    
    // Strategy 2: USD values
    if (activity.fromToken.usdValue && activity.toToken.usdValue) {
      const inputPrice = activity.fromToken.usdValue / inputAmount;
      const outputPrice = activity.toToken.usdValue / outputAmount;
      
      logger.info('Strategy 2 - USD Values (Available)', {
        inputPrice: `$${inputPrice.toFixed(6)} per ${activity.fromToken.symbol}`,
        outputPrice: `$${outputPrice.toFixed(6)} per ${activity.toToken.symbol}`,
        status: '✅ Strategy 2 should work'
      });
    } else {
      logger.warn('Strategy 2 - USD Values', {
        status: '❌ Strategy 2 failed - missing USD values'
      });
    }
    
    // Strategy 3: Stablecoin fallback
    const stablecoins = ['USDC', 'aeUSDC', 'USDT', 'DAI', 'BUSD'];
    const isFromStable = stablecoins.some(stable => activity.fromToken.symbol.includes(stable));
    const isToStable = stablecoins.some(stable => activity.toToken.symbol.includes(stable));
    
    logger.warn('Strategy 3 - Stablecoin Fallback', {
      fromTokenIsStable: `${activity.fromToken.symbol}: ${isFromStable}`,
      toTokenIsStable: `${activity.toToken.symbol}: ${isToStable}`,
      fallbackUsed: isFromStable || isToStable,
      problem: isFromStable || isToStable ? 
        `🚨 USING FALLBACK: inputToken: 1.0, outputToken: 1.0 - This is WRONG for ${activity.toToken.symbol}!` : 
        'No fallback needed'
    });

    // Test current price fetching
    logger.info('💰 Current Price Analysis', {
      inputContract: activity.fromToken.contractId,
      outputContract: activity.toToken.contractId
    });

    // Get actual current prices and calculate real P&L
    try {
      const { listPrices } = await import('@repo/tokens');
      const priceData = await listPrices({
        strategy: 'fallback',
        sources: { kraxel: false, stxtools: true, internal: true }
      });
      
      const aeUSDCPrice = priceData[activity.fromToken.contractId];
      const chaPrice = priceData[activity.toToken.contractId];
      
      logger.info('Current Prices', {
        aeUSDCPrice: aeUSDCPrice ? `$${aeUSDCPrice}` : 'N/A',
        chaPrice: chaPrice ? `$${chaPrice}` : 'N/A'
      });
      
      if (chaPrice) {
        const currentPositionValue = outputAmount * chaPrice;
        const realPnL = ((currentPositionValue - inputAmount) / inputAmount) * 100;
        
        logger.info('📊 Real P&L Calculation', {
          originalInvestment: `$${inputAmount}`,
          currentPositionValue: `${outputAmount} CHA × $${chaPrice} = $${currentPositionValue.toFixed(4)}`,
          realPnL: `${realPnL.toFixed(2)}%`,
          realUsdChange: `$${(currentPositionValue - inputAmount).toFixed(4)}`,
          analysis: realPnL < -50 ? '🚨 This should show a MAJOR LOSS!' : 'Normal movement'
        });
      }
      
    } catch (error) {
      logger.error('Error fetching current prices', { error: error.message });
    }
    
    // System vs Reality Comparison
    logger.warn('🔍 System vs Reality Comparison', {
      systemEntryPrice: '$1.00 per CHA (WRONG!)',
      realEntryPrice: `$${realEntryPricePerCHA.toFixed(6)} per CHA`,
      differenceMultiplier: `${((1.0 / realEntryPricePerCHA)).toFixed(1)}x higher than reality`,
      conclusion: 'This explains the impossible +197% gains in the chart!'
    });

  } catch (error) {
    logger.error('❌ Error during debugging', { error: error.message });
  }
}

// Run the debug script
debugProfitabilityCalculations().then(() => {
  logger.info('✅ Debug script completed');
  process.exit(0);
}).catch((error) => {
  logger.error('❌ Script failed', { error: error.message });
  process.exit(1);
});
/**
 * Verify the entry price calculation issue using proper logging
 */

import { logger } from './logger'; // This imports dotenv and handles env vars
import { getActivity } from '../src/lib/activity-storage';

async function verifyEntryPriceCalculation() {
  logger.info('Starting entry price verification analysis');

  try {
    // Test the specific activity with suspicious stats
    const activityId = 'a970bbc2-3750-42fd-bd25-92bf65b2f046';
    const activity = await getActivity(activityId);
    
    if (!activity) {
      logger.error('Activity not found', { activityId });
      return;
    }

    // Log trade details
    logger.info('Trade Details', {
      inputRaw: activity.fromToken.amount,
      inputSymbol: activity.fromToken.symbol,
      outputRaw: activity.toToken.amount,
      outputSymbol: activity.toToken.symbol,
      inputDecimals: activity.fromToken.decimals,
      outputDecimals: activity.toToken.decimals
    });
    
    // Convert to actual token amounts
    const inputAmount = parseFloat(activity.fromToken.amount) / Math.pow(10, activity.fromToken.decimals || 6);
    const outputAmount = parseFloat(activity.toToken.amount) / Math.pow(10, activity.toToken.decimals || 6);
    
    logger.info('Converted Amounts', {
      input: `${inputAmount} ${activity.fromToken.symbol}`,
      output: `${outputAmount} ${activity.toToken.symbol}`
    });
    
    // Calculate real entry price
    const realEntryPrice = inputAmount / outputAmount;
    logger.info('Real Entry Price Calculation', {
      calculation: `${inputAmount} ÷ ${outputAmount}`,
      realEntryPrice: `$${realEntryPrice.toFixed(6)} per CHA`
    });
    
    // Check fallback logic that's causing the problem
    const stablecoins = ['USDC', 'aeUSDC', 'USDT', 'DAI', 'BUSD'];
    const isFromStable = stablecoins.some(stable => activity.fromToken.symbol.includes(stable));
    const isToStable = stablecoins.some(stable => activity.toToken.symbol.includes(stable));
    
    logger.warn('Fallback Logic Analysis', {
      fromTokenStable: `${activity.fromToken.symbol}: ${isFromStable}`,
      toTokenStable: `${activity.toToken.symbol}: ${isToStable}`,
      willUseFallback: isFromStable || isToStable,
      problem: isFromStable || isToStable ? 'System will incorrectly use $1.00 for both tokens' : 'No fallback used'
    });
    
    if (isFromStable || isToStable) {
      const errorFactor = 1.0 / realEntryPrice;
      logger.error('Critical Entry Price Error', {
        systemAssumption: '1 CHA = $1.00',
        reality: `1 CHA = $${realEntryPrice.toFixed(6)}`,
        errorFactor: `${errorFactor.toFixed(1)}x too high`,
        impact: 'This creates impossible +197% gains in charts'
      });
    }
    
    // Get current prices and calculate real P&L
    try {
      const { listPrices } = await import('@repo/tokens');
      const priceData = await listPrices({
        strategy: 'fallback',
        sources: { kraxel: false, stxtools: true, internal: true }
      });
      
      const chaPrice = priceData[activity.toToken.contractId];
      
      if (chaPrice) {
        const priceChange = ((chaPrice - realEntryPrice) / realEntryPrice) * 100;
        const currentValue = outputAmount * chaPrice;
        const realPnL = ((currentValue - inputAmount) / inputAmount) * 100;
        
        logger.info('Real P&L Calculation', {
          currentChaPrice: `$${chaPrice}`,
          entryPrice: `$${realEntryPrice.toFixed(6)}`,
          priceChange: `${priceChange.toFixed(2)}%`,
          originalInvestment: `$${inputAmount}`,
          currentValue: `$${currentValue.toFixed(4)}`,
          realPnL: `${realPnL.toFixed(2)}%`
        });
        
        // Compare with system's wrong calculation
        const systemPriceChange = ((chaPrice - 1.0) / 1.0) * 100;
        logger.error('System vs Reality Comparison', {
          systemEntryPrice: '$1.00 per CHA (WRONG)',
          systemPriceChange: `${systemPriceChange.toFixed(2)}%`,
          realEntryPrice: `$${realEntryPrice.toFixed(6)} per CHA`,
          realPriceChange: `${priceChange.toFixed(2)}%`,
          conclusion: 'System error creates impossible gains by assuming wrong entry price'
        });
      }
      
    } catch (error) {
      logger.error('Error fetching current prices', { error: error instanceof Error ? error.message : String(error) });
    }

  } catch (error) {
    logger.error('Verification failed', { error: error instanceof Error ? error.message : String(error) });
  }
}

// Run the verification
verifyEntryPriceCalculation().then(() => {
  logger.info('Entry price verification completed');
}).catch(error => {
  logger.error('Script execution failed', { error: error.message });
});
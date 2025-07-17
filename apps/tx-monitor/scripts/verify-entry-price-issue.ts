/**
 * Simple script to verify the entry price calculation issue
 */

import { logger } from './logger'; // This also imports dotenv
import { getActivity } from '../src/lib/activity-storage';

async function verifyEntryPriceIssue() {
  try {
    // Test the specific activity with suspicious stats
    const activityId = 'a970bbc2-3750-42fd-bd25-92bf65b2f046';
    const activity = await getActivity(activityId);

    if (!activity) {
      logger.info('❌ Activity not found');
      return;
    }

    logger.info('=== TRADE ANALYSIS ===');
    logger.info(`Input: ${activity.fromToken.amount} raw units of ${activity.fromToken.symbol}`);
    logger.info(`Output: ${activity.toToken.amount} raw units of ${activity.toToken.symbol}`);

    // Convert to actual token amounts
    const inputAmount = parseFloat(activity.fromToken.amount) / Math.pow(10, activity.fromToken.decimals || 6);
    const outputAmount = parseFloat(activity.toToken.amount) / Math.pow(10, activity.toToken.decimals || 6);

    logger.info(`\nConverted amounts:`);
    logger.info(`Input: ${inputAmount} ${activity.fromToken.symbol}`);
    logger.info(`Output: ${outputAmount} ${activity.toToken.symbol}`);

    // Calculate real entry price
    const realEntryPrice = inputAmount / outputAmount;
    logger.info(`\nReal Entry Price: $${realEntryPrice.toFixed(6)} per CHA`);

    // Check fallback logic
    const stablecoins = ['USDC', 'aeUSDC', 'USDT', 'DAI', 'BUSD'];
    const isFromStable = stablecoins.some(stable => activity.fromToken.symbol.includes(stable));
    const isToStable = stablecoins.some(stable => activity.toToken.symbol.includes(stable));

    logger.info(`\n=== FALLBACK LOGIC ===`);
    logger.info(`From token (${activity.fromToken.symbol}) is stable: ${isFromStable}`);
    logger.info(`To token (${activity.toToken.symbol}) is stable: ${isToStable}`);
    logger.info(`Will use fallback: ${isFromStable || isToStable}`);

    if (isFromStable || isToStable) {
      logger.info(`🚨 PROBLEM: System will use $1.00 for both tokens!`);
      logger.info(`   System thinks: 1 CHA = $1.00`);
      logger.info(`   Reality: 1 CHA = $${realEntryPrice.toFixed(6)}`);
      logger.info(`   Error factor: ${(1.0 / realEntryPrice).toFixed(1)}x too high`);
    }

    // Get current prices
    try {
      const { listPrices } = await import('@repo/tokens');
      const priceData = await listPrices({
        strategy: 'fallback',
        sources: { stxtools: true, internal: true }
      });

      const chaPrice = priceData[activity.toToken.contractId];

      if (chaPrice) {
        logger.info(`\n=== REAL P&L CALCULATION ===`);
        logger.info(`Current CHA price: $${chaPrice}`);
        logger.info(`Entry price: $${realEntryPrice.toFixed(6)} per CHA`);
        logger.info(`Price change: ${(((chaPrice - realEntryPrice) / realEntryPrice) * 100).toFixed(2)}%`);

        const currentValue = outputAmount * chaPrice;
        const realPnL = ((currentValue - inputAmount) / inputAmount) * 100;

        logger.info(`Original investment: $${inputAmount}`);
        logger.info(`Current value: $${currentValue.toFixed(4)}`);
        logger.info(`REAL P&L: ${realPnL.toFixed(2)}%`);

        logger.info(`\n=== WHAT SYSTEM CALCULATES ===`);
        logger.info(`System entry price: $1.00 per CHA (WRONG)`);
        logger.info(`System current price: $${chaPrice} per CHA`);
        logger.info(`System thinks price changed: ${(((chaPrice - 1.0) / 1.0) * 100).toFixed(2)}%`);
        logger.info(`This creates the impossible +197% gains we see!`);
      }

    } catch (error) {
      logger.info('Error fetching prices:', error as Error);
    }

  } catch (error) {
    logger.info('Error:', error as Error);
  }
}

verifyEntryPriceIssue();
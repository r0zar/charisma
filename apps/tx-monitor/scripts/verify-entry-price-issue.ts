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
      console.log('❌ Activity not found');
      return;
    }

    console.log('=== TRADE ANALYSIS ===');
    console.log(`Input: ${activity.fromToken.amount} raw units of ${activity.fromToken.symbol}`);
    console.log(`Output: ${activity.toToken.amount} raw units of ${activity.toToken.symbol}`);
    
    // Convert to actual token amounts
    const inputAmount = parseFloat(activity.fromToken.amount) / Math.pow(10, activity.fromToken.decimals || 6);
    const outputAmount = parseFloat(activity.toToken.amount) / Math.pow(10, activity.toToken.decimals || 6);
    
    console.log(`\nConverted amounts:`);
    console.log(`Input: ${inputAmount} ${activity.fromToken.symbol}`);
    console.log(`Output: ${outputAmount} ${activity.toToken.symbol}`);
    
    // Calculate real entry price
    const realEntryPrice = inputAmount / outputAmount;
    console.log(`\nReal Entry Price: $${realEntryPrice.toFixed(6)} per CHA`);
    
    // Check fallback logic
    const stablecoins = ['USDC', 'aeUSDC', 'USDT', 'DAI', 'BUSD'];
    const isFromStable = stablecoins.some(stable => activity.fromToken.symbol.includes(stable));
    const isToStable = stablecoins.some(stable => activity.toToken.symbol.includes(stable));
    
    console.log(`\n=== FALLBACK LOGIC ===`);
    console.log(`From token (${activity.fromToken.symbol}) is stable: ${isFromStable}`);
    console.log(`To token (${activity.toToken.symbol}) is stable: ${isToStable}`);
    console.log(`Will use fallback: ${isFromStable || isToStable}`);
    
    if (isFromStable || isToStable) {
      console.log(`🚨 PROBLEM: System will use $1.00 for both tokens!`);
      console.log(`   System thinks: 1 CHA = $1.00`);
      console.log(`   Reality: 1 CHA = $${realEntryPrice.toFixed(6)}`);
      console.log(`   Error factor: ${(1.0 / realEntryPrice).toFixed(1)}x too high`);
    }
    
    // Get current prices
    try {
      const { listPrices } = await import('@repo/tokens');
      const priceData = await listPrices({
        strategy: 'fallback',
        sources: { kraxel: false, stxtools: true, internal: true }
      });
      
      const chaPrice = priceData[activity.toToken.contractId];
      
      if (chaPrice) {
        console.log(`\n=== REAL P&L CALCULATION ===`);
        console.log(`Current CHA price: $${chaPrice}`);
        console.log(`Entry price: $${realEntryPrice.toFixed(6)} per CHA`);
        console.log(`Price change: ${(((chaPrice - realEntryPrice) / realEntryPrice) * 100).toFixed(2)}%`);
        
        const currentValue = outputAmount * chaPrice;
        const realPnL = ((currentValue - inputAmount) / inputAmount) * 100;
        
        console.log(`Original investment: $${inputAmount}`);
        console.log(`Current value: $${currentValue.toFixed(4)}`);
        console.log(`REAL P&L: ${realPnL.toFixed(2)}%`);
        
        console.log(`\n=== WHAT SYSTEM CALCULATES ===`);
        console.log(`System entry price: $1.00 per CHA (WRONG)`);
        console.log(`System current price: $${chaPrice} per CHA`);
        console.log(`System thinks price changed: ${(((chaPrice - 1.0) / 1.0) * 100).toFixed(2)}%`);
        console.log(`This creates the impossible +197% gains we see!`);
      }
      
    } catch (error) {
      console.error('Error fetching prices:', error.message);
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

verifyEntryPriceIssue();
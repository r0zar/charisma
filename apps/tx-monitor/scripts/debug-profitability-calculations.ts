/**
 * Debug script to analyze profitability calculation logic and verify theories
 */

import './logger'; // Import logger which also imports dotenv
import { getActivity } from '../src/lib/activity-storage';

async function debugProfitabilityCalculations() {
  console.log('🔍 Debugging Profitability Calculation Logic\n');

  try {
    // Test the specific activity with suspicious stats
    const activityId = 'a970bbc2-3750-42fd-bd25-92bf65b2f046';
    const activity = await getActivity(activityId);
    
    if (!activity) {
      console.log('❌ Activity not found');
      return;
    }

    console.log('📋 Activity Data:');
    console.log(`   Input: ${activity.fromToken.amount} ${activity.fromToken.symbol}`);
    console.log(`   Output: ${activity.toToken.amount} ${activity.toToken.symbol}`);
    console.log(`   Input USD Value: ${activity.fromToken.usdValue}`);
    console.log(`   Output USD Value: ${activity.toToken.usdValue}`);
    
    // Calculate what the REAL entry price should be
    if (activity.fromToken.usdValue && activity.toToken.amount) {
      const inputUsdValue = activity.fromToken.usdValue;
      const outputTokenAmount = parseFloat(activity.toToken.amount) / Math.pow(10, activity.toToken.decimals || 6);
      const realEntryPrice = inputUsdValue / outputTokenAmount;
      
      console.log(`\n💡 REAL Entry Price Calculation:`);
      console.log(`   Input USD Value: $${inputUsdValue}`);
      console.log(`   Output Token Amount: ${outputTokenAmount} ${activity.toToken.symbol}`);
      console.log(`   Real Entry Price: $${realEntryPrice.toFixed(6)} per ${activity.toToken.symbol}`);
    }

    // Now let's manually trace through the entry price logic
    console.log(`\n🔍 Entry Price Logic Analysis:`);
    
    // Strategy 1: Price snapshots
    console.log(`   Strategy 1 - Price Snapshots:`);
    console.log(`     From Token Snapshot: ${activity.fromToken.priceSnapshot?.price || 'N/A'}`);
    console.log(`     To Token Snapshot: ${activity.toToken.priceSnapshot?.price || 'N/A'}`);
    
    // Strategy 2: USD values
    console.log(`   Strategy 2 - USD Values:`);
    if (activity.fromToken.usdValue && activity.toToken.usdValue) {
      const inputAmountRaw = parseFloat(activity.fromToken.amount);
      const outputAmountRaw = parseFloat(activity.toToken.amount);
      const inputDecimals = Math.max(0, Math.min(18, activity.fromToken.decimals || 6));
      const outputDecimals = Math.max(0, Math.min(18, activity.toToken.decimals || 6));
      const inputAmount = inputAmountRaw / Math.pow(10, inputDecimals);
      const outputAmount = outputAmountRaw / Math.pow(10, outputDecimals);
      
      if (activity.fromToken.usdValue > 0 && activity.toToken.usdValue > 0 && inputAmount > 0 && outputAmount > 0) {
        const inputPrice = activity.fromToken.usdValue / inputAmount;
        const outputPrice = activity.toToken.usdValue / outputAmount;
        
        console.log(`     Input Price: $${inputPrice.toFixed(6)} per ${activity.fromToken.symbol}`);
        console.log(`     Output Price: $${outputPrice.toFixed(6)} per ${activity.toToken.symbol}`);
        console.log(`     ✅ Strategy 2 should work`);
      } else {
        console.log(`     ❌ Strategy 2 failed - invalid values`);
      }
    } else {
      console.log(`     ❌ Strategy 2 failed - missing USD values`);
    }
    
    // Strategy 3: Stablecoin fallback
    console.log(`   Strategy 3 - Stablecoin Fallback:`);
    const stablecoins = ['USDC', 'aeUSDC', 'USDT', 'DAI', 'BUSD'];
    const isFromStable = stablecoins.some(stable => activity.fromToken.symbol.includes(stable));
    const isToStable = stablecoins.some(stable => activity.toToken.symbol.includes(stable));
    
    console.log(`     From Token (${activity.fromToken.symbol}) is stable: ${isFromStable}`);
    console.log(`     To Token (${activity.toToken.symbol}) is stable: ${isToStable}`);
    
    if (isFromStable || isToStable) {
      console.log(`     🚨 USING FALLBACK: inputToken: 1.0, outputToken: 1.0`);
      console.log(`     This is WRONG for ${activity.toToken.symbol} which is NOT a stablecoin!`);
    }

    // Test current price fetching (using main profitability function)
    console.log(`\n💰 Current Price Analysis:`);
    console.log(`   Contract analysis:`);
    console.log(`     Input: ${activity.fromToken.contractId}`);
    console.log(`     Output: ${activity.toToken.contractId}`);

    // Calculate what the real P&L should be
    if (activity.fromToken.usdValue && activity.toToken.amount) {
      console.log(`\n📊 Real P&L Calculation:`);
      const inputUsdValue = activity.fromToken.usdValue;
      const outputTokenAmount = parseFloat(activity.toToken.amount) / Math.pow(10, activity.toToken.decimals || 6);
      const realEntryPrice = inputUsdValue / outputTokenAmount;
      
      // Assuming current CHA price is around $0.003 (from previous observations)
      const estimatedCurrentPrice = 0.003;
      const currentPositionValue = outputTokenAmount * estimatedCurrentPrice;
      const realPnL = ((currentPositionValue - inputUsdValue) / inputUsdValue) * 100;
      
      console.log(`   Original Investment: $${inputUsdValue}`);
      console.log(`   Tokens Received: ${outputTokenAmount} ${activity.toToken.symbol}`);
      console.log(`   Entry Price: $${realEntryPrice.toFixed(6)} per token`);
      console.log(`   Current Price (est): $${estimatedCurrentPrice} per token`);
      console.log(`   Current Value: $${currentPositionValue.toFixed(4)}`);
      console.log(`   Real P&L: ${realPnL.toFixed(2)}%`);
      console.log(`   🚨 This should be a massive LOSS, not a small loss!`);
    }

  } catch (error) {
    console.error('❌ Error during debugging:', error);
  }
}

// Run the debug script
debugProfitabilityCalculations().then(() => {
  console.log('\n✅ Debug script completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
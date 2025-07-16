/**
 * Calculate what the real entry price should be for the suspicious trade
 */

import './logger'; // Import logger which also imports dotenv
import { getActivity } from '../src/lib/activity-storage';

async function calculateRealEntryPrice() {
  console.log('💰 Calculating Real Entry Price for Suspicious Trade\n');

  try {
    const activityId = 'a970bbc2-3750-42fd-bd25-92bf65b2f046';
    const activity = await getActivity(activityId);
    
    if (!activity) {
      console.log('❌ Activity not found');
      return;
    }

    console.log('📋 Trade Details:');
    console.log(`   Input: ${activity.fromToken.amount} raw units of ${activity.fromToken.symbol}`);
    console.log(`   Output: ${activity.toToken.amount} raw units of ${activity.toToken.symbol}`);
    console.log(`   Input Decimals: ${activity.fromToken.decimals}`);
    console.log(`   Output Decimals: ${activity.toToken.decimals}`);
    
    // Convert to actual token amounts
    const inputAmount = parseFloat(activity.fromToken.amount) / Math.pow(10, activity.fromToken.decimals || 6);
    const outputAmount = parseFloat(activity.toToken.amount) / Math.pow(10, activity.toToken.decimals || 6);
    
    console.log(`\n🔢 Converted Amounts:`);
    console.log(`   Input: ${inputAmount} ${activity.fromToken.symbol}`);
    console.log(`   Output: ${outputAmount} ${activity.toToken.symbol}`);
    
    // Since aeUSDC ≈ $1, the real entry price is:
    const realEntryPricePerCHA = inputAmount / outputAmount; // $1 aeUSDC / CHA tokens received
    
    console.log(`\n💡 Real Entry Price Calculation:`);
    console.log(`   Entry Price = Input Amount ÷ Output Amount`);
    console.log(`   Entry Price = ${inputAmount} aeUSDC ÷ ${outputAmount} CHA`);
    console.log(`   Entry Price = $${realEntryPricePerCHA.toFixed(6)} per CHA`);
    
    // Now let's see what the current price fetching gives us
    console.log(`\n🔍 Testing Current Price Fetching:`);
    
    try {
      // Import listPrices to check current prices
      const { listPrices } = await import('@repo/tokens');
      const priceData = await listPrices({
        strategy: 'fallback',
        sources: { kraxel: false, stxtools: true, internal: true }
      });
      
      const aeUSDCPrice = priceData[activity.fromToken.contractId];
      const chaPrice = priceData[activity.toToken.contractId];
      
      console.log(`   Current aeUSDC Price: $${aeUSDCPrice || 'N/A'}`);
      console.log(`   Current CHA Price: $${chaPrice || 'N/A'}`);
      
      if (chaPrice) {
        const currentPositionValue = outputAmount * chaPrice;
        const realPnL = ((currentPositionValue - inputAmount) / inputAmount) * 100;
        
        console.log(`\n📊 Real P&L Calculation:`);
        console.log(`   Original Investment: $${inputAmount} (assuming aeUSDC ≈ $1)`);
        console.log(`   Current Position Value: ${outputAmount} CHA × $${chaPrice} = $${currentPositionValue.toFixed(4)}`);
        console.log(`   Real P&L: ${realPnL.toFixed(2)}%`);
        console.log(`   Real USD Change: $${(currentPositionValue - inputAmount).toFixed(4)}`);
        
        if (realPnL < -50) {
          console.log(`   🚨 This should show a MAJOR LOSS, not the small loss currently displayed!`);
        }
      }
      
    } catch (error) {
      console.error('Error fetching current prices:', error);
    }
    
    // Compare with what the system is calculating
    console.log(`\n🔍 System vs Reality Comparison:`);
    console.log(`   System Entry Price (fallback): $1.00 per CHA (WRONG!)`);
    console.log(`   Real Entry Price: $${realEntryPricePerCHA.toFixed(6)} per CHA`);
    console.log(`   Difference: ${((1.0 / realEntryPricePerCHA) * 100).toFixed(1)}x higher than reality`);
    console.log(`   This explains the impossible +197% gains in the chart!`);

  } catch (error) {
    console.error('❌ Error during calculation:', error);
  }
}

// Run the calculation
calculateRealEntryPrice().then(() => {
  console.log('\n✅ Calculation completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
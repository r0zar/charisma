/**
 * Debug script to inspect activity data and profitability calculation issues
 */

import './logger'; // Import logger which also imports dotenv
import { getActivity, getActivityTimeline } from '../src/lib/activity-storage';
import { calculateTradeProfitability } from '../src/lib/profitability-service';

async function debugActivityData() {
  console.log('🔍 Debugging Activity Data and Profitability Calculation\n');

  try {
    // Get recent activities
    console.log('📋 Fetching recent activities...');
    const activities = await getActivityTimeline({
      limit: 10,
      sortOrder: 'desc'
    });

    console.log(`Found ${activities.activities.length} activities\n`);

    for (const activity of activities.activities) {
      console.log(`\n🔹 Activity: ${activity.id}`);
      console.log(`   Type: ${activity.type}`);
      console.log(`   Status: ${activity.status}`);
      console.log(`   Timestamp: ${new Date(activity.timestamp).toISOString()}`);
      console.log(`   Owner: ${activity.owner}`);
      
      // Check token data
      console.log(`\n   📊 Token Data:`);
      console.log(`   From Token:`);
      console.log(`     - Symbol: ${activity.fromToken?.symbol}`);
      console.log(`     - Amount: ${activity.fromToken?.amount}`);
      console.log(`     - Contract ID: ${activity.fromToken?.contractId}`);
      console.log(`     - Decimals: ${activity.fromToken?.decimals}`);
      console.log(`     - USD Value: ${activity.fromToken?.usdValue}`);
      console.log(`     - Price Snapshot: ${activity.fromToken?.priceSnapshot?.price || 'N/A'}`);

      console.log(`   To Token:`);
      console.log(`     - Symbol: ${activity.toToken?.symbol}`);
      console.log(`     - Amount: ${activity.toToken?.amount}`);
      console.log(`     - Contract ID: ${activity.toToken?.contractId}`);
      console.log(`     - Decimals: ${activity.toToken?.decimals}`);
      console.log(`     - USD Value: ${activity.toToken?.usdValue}`);
      console.log(`     - Price Snapshot: ${activity.toToken?.priceSnapshot?.price || 'N/A'}`);

      // Check if it's eligible for profitability calculation
      const isEligible = activity.type === 'instant_swap' && activity.status === 'completed';
      console.log(`\n   ✅ Eligible for profitability: ${isEligible}`);

      if (isEligible) {
        console.log(`\n   🧮 Attempting profitability calculation...`);
        try {
          const profitabilityData = await calculateTradeProfitability(activity);
          if (profitabilityData) {
            console.log(`   ✅ Profitability calculation successful!`);
            console.log(`   Current P&L: ${profitabilityData.metrics.currentPnL.percentage.toFixed(2)}%`);
            console.log(`   USD Value: $${profitabilityData.metrics.currentPnL.usdValue.toFixed(2)}`);
            console.log(`   Chart data points: ${profitabilityData.chartData.length}`);
          } else {
            console.log(`   ❌ Profitability calculation returned null`);
          }
        } catch (error) {
          console.log(`   ❌ Profitability calculation failed:`, error.message);
        }
      }

      // Check for common issues
      console.log(`\n   🔍 Issue Detection:`);
      const issues = [];
      
      if (!activity.fromToken?.contractId) issues.push('Missing fromToken contractId');
      if (!activity.toToken?.contractId) issues.push('Missing toToken contractId');
      if (!activity.fromToken?.amount || activity.fromToken.amount === '0') issues.push('Invalid fromToken amount');
      if (!activity.toToken?.amount || activity.toToken.amount === '0') issues.push('Invalid toToken amount');
      if (!activity.timestamp || activity.timestamp <= 0) issues.push('Invalid timestamp');
      if (activity.timestamp > Date.now() + 60000) issues.push('Timestamp in future');

      if (issues.length > 0) {
        console.log(`   ⚠️  Issues found: ${issues.join(', ')}`);
      } else {
        console.log(`   ✅ No obvious issues detected`);
      }

      console.log('\n' + '─'.repeat(80));
    }

    // Test a specific activity if provided
    if (process.argv[2]) {
      const activityId = process.argv[2];
      console.log(`\n🎯 Testing specific activity: ${activityId}`);
      
      const specificActivity = await getActivity(activityId);
      if (specificActivity) {
        console.log('✅ Activity found');
        const profitabilityData = await calculateTradeProfitability(specificActivity);
        console.log('Profitability result:', profitabilityData ? 'Success' : 'Failed');
      } else {
        console.log('❌ Activity not found');
      }
    }

  } catch (error) {
    console.error('❌ Error during debugging:', error);
  }
}

// Run the debug script
debugActivityData().then(() => {
  console.log('\n✅ Debug script completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
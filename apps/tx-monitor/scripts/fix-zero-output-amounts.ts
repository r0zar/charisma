/**
 * Fix activities with zero output amounts by extracting correct amounts from transaction analysis
 */

import './logger'; // Import logger which also imports dotenv
import { getActivity, getActivityTimeline, updateActivity } from '../src/lib/activity-storage';

async function fixZeroOutputAmounts() {
  console.log('🔧 Fixing Activities with Zero Output Amounts\n');

  try {
    // Get all activities
    console.log('📋 Fetching all activities...');
    const activities = await getActivityTimeline({
      limit: 100,
      sortOrder: 'desc'
    });

    console.log(`Found ${activities.activities.length} activities\n`);

    let fixedCount = 0;
    let alreadyCorrectCount = 0;
    let noAnalysisCount = 0;

    for (const activity of activities.activities) {
      console.log(`\n🔹 Processing Activity: ${activity.id}`);
      
      // Check if toToken amount is zero
      const hasZeroOutput = !activity.toToken?.amount || activity.toToken.amount === '0';
      
      if (!hasZeroOutput) {
        console.log(`   ✅ Already has valid output amount: ${activity.toToken.amount}`);
        alreadyCorrectCount++;
        continue;
      }

      console.log(`   ⚠️  Has zero output amount: ${activity.toToken.amount}`);
      
      // Check if we have transaction analysis with the correct amount
      const transactionAnalysis = activity.metadata?.transactionAnalysis;
      if (!transactionAnalysis?.analysis?.finalOutputAmount) {
        console.log(`   ❌ No transaction analysis or finalOutputAmount found`);
        noAnalysisCount++;
        continue;
      }

      const correctAmount = transactionAnalysis.analysis.finalOutputAmount;
      console.log(`   💡 Found correct amount in transaction analysis: ${correctAmount}`);

      // Update the activity
      try {
        await updateActivity(activity.id, {
          toToken: {
            ...activity.toToken,
            amount: correctAmount
          }
        });

        console.log(`   ✅ Fixed! Updated toToken amount from ${activity.toToken.amount} to ${correctAmount}`);
        fixedCount++;
      } catch (error) {
        console.log(`   ❌ Failed to update activity: ${error.message}`);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Fixed activities: ${fixedCount}`);
    console.log(`   ✅ Already correct: ${alreadyCorrectCount}`);
    console.log(`   ❌ No analysis data: ${noAnalysisCount}`);
    console.log(`   📝 Total processed: ${activities.activities.length}`);

  } catch (error) {
    console.error('❌ Error during fix process:', error);
  }
}

// Run the fix script
fixZeroOutputAmounts().then(() => {
  console.log('\n✅ Fix script completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
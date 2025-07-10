// Simple Strategy Example - No functions, exports, or returns needed!
// The 'bot' variable is available globally with full typing

console.log('🚀 Starting strategy for', bot.name);
console.log('📊 Bot ID:', bot.id);
console.log('💰 STX Balance:', bot.balance.STX);

// Check if we have enough balance to do something
if (bot.balance.STX > 1000000) {
  console.log('✅ Sufficient balance for trading');
  
  // Example: Swap some STX for USDA
  console.log('🔄 Swapping 500k STX for USDA...');
  const swapResult = await bot.swap('STX', 'USDA', 500000);
  
  console.log('Swap result:', JSON.stringify(swapResult, null, 2));
  
  if (swapResult.success) {
    console.log('✅ Trade completed successfully!');
    console.log('📈 Received:', swapResult.amountReceived, 'USDA');
  } else {
    console.log('❌ Trade failed:', swapResult.error);
  }
  
} else {
  console.log('⚠️ Insufficient STX balance for trading');
  console.log('💡 Need at least 1 STX (1000000 microSTX)');
}

// Example: Check for rewards
console.log('🎁 Checking for claimable rewards...');
const rewardResult = await bot.claimRewards('example-pool');
console.log('Reward claim result:', JSON.stringify(rewardResult, null, 2));

// Example: Log all available balances
console.log('💼 All balances:');
for (const [token, balance] of Object.entries(bot.balance)) {
  console.log(`  ${token}: ${balance}`);
}

console.log('🏁 Strategy execution completed');
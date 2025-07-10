// Beginner's Guide to Bot Strategies
// No complex syntax - just write JavaScript!

// 1. The 'bot' object is always available
console.log('🤖 Bot Name:', bot.name);
console.log('📍 Bot ID:', bot.id);
console.log('👛 Wallet:', bot.wallet_address);

// 2. Check your balances (all tokens in one object)
console.log('💰 Available Balances:');
console.log('STX:', bot.balance.STX);
console.log('All tokens:', bot.balance);

// 3. Trading is simple - just await bot.method()
console.log('📈 Let\'s try some trades...');

// Swap tokens
console.log('🔄 Swapping 1000 STX for USDA');
const swap1 = await bot.swap('STX', 'USDA', 1000);
console.log('Result:', swap1);

// Add liquidity
console.log('💧 Adding liquidity');
const lp = await bot.addLiquidity('STX', 'USDA', 500, 500);
console.log('LP Result:', lp);

// Stake tokens
console.log('🥩 Staking tokens');
const stake = await bot.stake('some-pool', 1000);
console.log('Stake Result:', stake);

// Claim rewards
console.log('🎁 Claiming rewards');
const rewards = await bot.claimRewards('reward-pool');
console.log('Rewards:', rewards);

// 4. Add your own logic with if/else, loops, etc.
if (bot.balance.STX > 5000000) {
  console.log('🚀 High balance detected - executing advanced strategy');
  // Your advanced logic here
} else {
  console.log('💡 Low balance - conservative approach');
  // Conservative logic here
}

// 5. No return statement needed - just let it run!
console.log('✅ Strategy complete - that\'s it!');
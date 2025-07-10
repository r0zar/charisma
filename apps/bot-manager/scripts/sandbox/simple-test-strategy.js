/**
 * Simple Test Strategy
 * 
 * Minimal example for testing console.log output and basic functionality
 */

async function execute({ bot }) {
  console.log('🚀 Starting custom strategy...');
  console.log('Bot ID:', bot.id);
  console.log('Bot Name:', bot.name);
  console.log('Wallet Address:', bot.wallet_address);
  
  console.log('💰 Current Balances:');
  for (const [token, balance] of Object.entries(bot.balance)) {
    console.log(`  ${token}: ${balance}`);
  }
  
  console.log('🧪 Testing mock trading functions...');
  
  // Test a simple swap
  console.log('🔄 Testing swap: 1000 STX -> USDA');
  const swapResult = await bot.swap('STX', 'USDA', 1000);
  console.log('Swap result:', JSON.stringify(swapResult, null, 2));
  
  // Test staking
  console.log('🥩 Testing stake: 500 STX');
  const stakeResult = await bot.stake('test-pool', 500);
  console.log('Stake result:', JSON.stringify(stakeResult, null, 2));
  
  console.log('✅ Strategy execution completed successfully!');
  
  return {
    success: true,
    message: 'Simple test strategy completed',
    trades_executed: 2,
    final_balance: bot.balance
  };
}
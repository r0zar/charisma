/**
 * Example Bot Strategy for Sandbox Execution
 * 
 * This demonstrates the expected format for bot strategy code.
 * The strategy code should define an async `execute` function that
 * receives a `bot` context object with trading methods.
 */

// Example strategy: Simple DCA (Dollar Cost Averaging) with yield farming
async function execute({ bot }) {
  console.log('🚀 Starting custom strategy for bot:', bot.name);
  console.log('📊 Current STX balance:', bot.balance.STX);
  
  // Strategy metadata (required)
  const strategy = {
    name: 'DCA Yield Farmer',
    description: 'Dollar cost averaging with yield farming',
    version: '1.0.0',
    author: 'Bot Manager',
    riskLevel: 'medium'
  };

  console.log(`💡 Running strategy: ${strategy.name} v${strategy.version}`);

  // Example strategy logic
  const results = {
    trades: [],
    totalProfit: 0,
    errors: []
  };

  try {
    // Check if we have enough STX to trade
    if (bot.balance.STX < 100000) { // 0.1 STX minimum
      console.log('⚠️  Insufficient STX balance for trading');
      return {
        success: false,
        error: 'Insufficient balance',
        strategy,
        results
      };
    }

    // Example trade: Swap 50% of STX for USDA
    const swapAmount = bot.balance.STX * 0.5;
    console.log(`🔄 Attempting to swap ${swapAmount} STX for USDA`);
    
    const swapResult = await bot.swap('STX', 'USDA', swapAmount, 0.5);
    console.log('✅ Swap result:', JSON.stringify(swapResult, null, 2));
    
    if (swapResult.success) {
      results.trades.push({
        type: 'swap',
        from: 'STX',
        to: 'USDA',
        amountIn: swapAmount,
        amountOut: swapResult.amountReceived,
        txid: swapResult.txid
      });
      
      // Example: Add liquidity with remaining STX and received USDA
      const liquiditySTX = bot.balance.STX * 0.3;
      const liquidityUSDA = swapResult.amountReceived * 0.8;
      
      console.log(`💧 Adding liquidity: ${liquiditySTX} STX + ${liquidityUSDA} USDA`);
      
      const liquidityResult = await bot.addLiquidity('STX', 'USDA', liquiditySTX, liquidityUSDA, 0.5);
      console.log('✅ Liquidity result:', JSON.stringify(liquidityResult, null, 2));
      
      if (liquidityResult.success) {
        results.trades.push({
          type: 'add_liquidity',
          token1: 'STX',
          token2: 'USDA',
          amount1: liquiditySTX,
          amount2: liquidityUSDA,
          lpTokensReceived: liquidityResult.lpTokensReceived,
          txid: liquidityResult.txid
        });
        
        results.totalProfit = liquidityResult.lpTokensReceived * 0.05; // Estimated 5% APY
      }
    }

    // Example: Claim any available rewards
    console.log('🎁 Checking for claimable rewards...');
    const rewardResult = await bot.claimRewards('STX-USDA-LP-POOL');
    console.log('✅ Reward claim result:', JSON.stringify(rewardResult, null, 2));
    
    if (rewardResult.success) {
      results.totalProfit += rewardResult.amountClaimed;
    }

    console.log(`📈 Strategy execution completed. Total estimated profit: ${results.totalProfit}`);
    
    return {
      success: true,
      strategy,
      results,
      summary: `Executed ${results.trades.length} trades with estimated profit of ${results.totalProfit.toFixed(2)} tokens`
    };

  } catch (error) {
    console.error('❌ Strategy execution error:', error.message);
    results.errors.push(error.message);
    
    return {
      success: false,
      error: error.message,
      strategy,
      results
    };
  }
}

// Simple strategy example
async function executeSimple({ bot }) {
  console.log('🤖 Simple strategy starting...');
  console.log('Bot name:', bot.name);
  console.log('STX Balance:', bot.balance.STX);
  
  // Just log some info and return
  return {
    success: true,
    message: 'Simple strategy completed',
    balance: bot.balance
  };
}

// The execute function is called by the sandbox wrapper
// Use either execute or executeSimple depending on your needs
// Quick test to verify burn-swapper integration
const { createBurnSwapper } = require('./packages/dexterity/dist/cjs/index.cjs');

console.log('Testing burn-swapper creation...');

// Mock router
const mockRouter = {
  findBestRoute: async (from, to, amount) => {
    console.log(`Mock router called: ${from} -> ${to}, amount: ${amount}`);
    return { amountOut: amount * 0.95, hops: [] }; // Mock 5% slippage
  }
};

// Mock quote function (simulates backend API)
const mockGetQuote = async (fromToken, toToken, amount) => {
  console.log(`Mock getQuote called: ${fromToken} -> ${toToken}, amount: ${amount}`);
  return {
    success: true,
    data: {
      amountOut: parseFloat(amount) * 0.95, // Mock 5% slippage
      hops: []
    }
  };
};

// Mock LP removal quote
const mockGetLPRemovalQuote = async (lpVault, lpAmount) => {
  console.log(`Mock LP removal quote called: ${lpVault.contractId}, amount: ${lpAmount}`);
  return {
    dx: lpAmount * 0.5, // 50% token A
    dy: lpAmount * 0.5, // 50% token B
    dk: lpAmount
  };
};

try {
  const burnSwapper = createBurnSwapper(
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.burn-swapper',
    mockRouter,
    {
      debug: true,
      getQuote: mockGetQuote,
      getLPRemovalQuote: mockGetLPRemovalQuote
    }
  );

  console.log('✅ BurnSwapper created successfully');
  console.log('✅ Configuration includes backend quote functions');
  
  // Test finding routes
  const testVault = {
    contractId: 'SP123.test-lp',
    tokenA: { contractId: 'SP123.token-a', symbol: 'A', identifier: 'a' },
    tokenB: { contractId: 'SP123.token-b', symbol: 'B', identifier: 'b' },
    identifier: 'test-lp'
  };

  console.log('\n🧪 Testing route finding...');
  burnSwapper.findBurnSwapRoutes(testVault, 1000000, 'SP123.target-token')
    .then(result => {
      console.log('✅ findBurnSwapRoutes completed');
      console.log('Result:', JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.error('❌ findBurnSwapRoutes failed:', error);
    });

} catch (error) {
  console.error('❌ Failed to create BurnSwapper:', error);
}
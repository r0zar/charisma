// Test for updated burn-swapper with 0-4 hop support
const { createBurnSwapper } = require('./packages/dexterity/dist/cjs/index.cjs');

console.log('🧪 Testing BurnSwapper v3 (0-4 hops support)...');

// Mock router
const mockRouter = {
  findBestRoute: async (from, to, amount) => {
    // Simulate different hop counts for testing
    const hopCount = Math.floor(Math.random() * 5); // 0-4 hops
    console.log(`  Router: ${from} -> ${to}, ${hopCount} hops`);
    
    const hops = [];
    for (let i = 0; i < hopCount; i++) {
      hops.push({
        vault: { contractId: `SP123.pool-${i}` },
        opcode: 0x00
      });
    }
    
    return { 
      amountOut: amount * (0.95 - hopCount * 0.02), // More hops = more slippage
      hops
    };
  }
};

// Mock quote function
const mockGetQuote = async (fromToken, toToken, amount) => {
  const hopCount = Math.floor(Math.random() * 5); // 0-4 hops
  console.log(`  API: ${fromToken} -> ${toToken}, ${hopCount} hops`);
  
  const hops = [];
  for (let i = 0; i < hopCount; i++) {
    hops.push({
      vault: { contractId: `SP123.pool-${i}` },
      opcode: 0x00
    });
  }
  
  return {
    success: true,
    data: {
      amountOut: parseFloat(amount) * (0.95 - hopCount * 0.02),
      hops
    }
  };
};

// Mock LP removal quote
const mockGetLPRemovalQuote = async (lpVault, lpAmount) => {
  console.log(`  LP Quote: ${lpVault.contractId}, amount: ${lpAmount}`);
  return {
    dx: lpAmount * 0.5, // 50% token A
    dy: lpAmount * 0.5, // 50% token B
    dk: lpAmount
  };
};

async function testBurnSwapper() {
  try {
    const burnSwapper = createBurnSwapper(
      'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.burn-swapper-v3',
      mockRouter,
      {
        debug: true,
        getQuote: mockGetQuote,
        getLPRemovalQuote: mockGetLPRemovalQuote
      }
    );

    console.log('✅ BurnSwapper v3 created successfully');
    
    const testVault = {
      contractId: 'SP123.test-lp',
      tokenA: { contractId: 'SP123.token-a', symbol: 'A', identifier: 'a' },
      tokenB: { contractId: 'SP123.token-b', symbol: 'B', identifier: 'b' },
      identifier: 'test-lp'
    };

    console.log('\n🔄 Finding burn-swap routes...');
    const result = await burnSwapper.findBurnSwapRoutes(testVault, 1000000, 'SP123.target-token');
    
    if (result) {
      console.log('✅ Routes found!');
      console.log(`📊 Pattern: ${result.pattern}`);
      console.log(`💰 Total Output: ${result.totalOutput}`);
      
      if (result.tokenA) {
        console.log(`🟢 Token A: ${result.tokenA.hops.length} hops, ${result.tokenA.finalAmount} output`);
      }
      if (result.tokenB) {
        console.log(`🔵 Token B: ${result.tokenB.hops.length} hops, ${result.tokenB.finalAmount} output`);
      }
      
      // Test pattern validation
      const [aHops, bHops] = result.pattern.split('-').map(Number);
      if (aHops >= 0 && aHops <= 4 && bHops >= 0 && bHops <= 4) {
        console.log('✅ Pattern is valid (0-4 hops each)');
      } else {
        console.log('❌ Invalid pattern detected');
      }
      
    } else {
      console.log('❌ No routes found');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testBurnSwapper();
/**
 * Debug script to compare token availability between API sources and BlazeProvider
 * Run this in the browser console on the Portfolio page to analyze token data
 */

// Function to fetch token data from the API (same as charisma-party uses)
async function fetchApiTokens() {
  try {
    const response = await fetch('https://invest.charisma.rocks/api/v1/tokens/all?includePricing=true');
    const data = await response.json();
    console.log('🔍 API Token Summary:');
    console.log(`Total tokens: ${data.tradeableTokens?.length + data.lpTokens?.length || 'Unknown'}`);
    console.log(`Tradeable tokens: ${data.tradeableTokens?.length || 0}`);
    console.log(`LP tokens: ${data.lpTokens?.length || 0}`);
    
    // Extract LP tokens for analysis
    const lpTokens = data.lpTokens || [];
    console.log('\n📊 LP Token Analysis:');
    console.log(`LP tokens with metadata:`, lpTokens.filter(t => t.lpMetadata).length);
    console.log('Sample LP tokens:', lpTokens.slice(0, 5).map(t => ({
      contractId: t.contractId,
      symbol: t.symbol,
      name: t.name,
      hasLpMetadata: !!t.lpMetadata
    })));
    
    return data;
  } catch (error) {
    console.error('❌ Failed to fetch API tokens:', error);
    return null;
  }
}

// Function to analyze BlazeProvider data (must be run on Portfolio page)
function analyzeBlazeData() {
  // Check if we're on the Portfolio page and can access BlazeProvider data
  const debugButton = document.querySelector('button:has([data-lucide="info"])');
  if (!debugButton) {
    console.log('⚠️  Please run this on the Portfolio page (/settings/portfolio)');
    return null;
  }
  
  // Click debug button to open modal
  debugButton.click();
  
  setTimeout(() => {
    // Try to extract balance data from the debug modal
    const debugModal = document.querySelector('[role="dialog"] pre');
    if (debugModal) {
      try {
        const balanceData = JSON.parse(debugModal.textContent);
        console.log('\n🔍 BlazeProvider Balance Data:');
        console.log(`Total balance entries: ${Object.keys(balanceData).length}`);
        
        // Analyze token types
        const tokenAnalysis = {};
        Object.entries(balanceData).forEach(([key, balance]) => {
          const tokenType = balance.metadata?.type || balance.type || 'Unknown';
          tokenAnalysis[tokenType] = (tokenAnalysis[tokenType] || 0) + 1;
        });
        
        console.log('Token types in BlazeProvider:', tokenAnalysis);
        
        // Find LP tokens specifically
        const lpTokens = Object.entries(balanceData).filter(([key, balance]) => {
          return balance.metadata?.type === 'LP' || 
                 balance.type === 'LP' ||
                 balance.tokenAContract ||
                 balance.metadata?.tokenAContract;
        });
        
        console.log(`LP tokens in BlazeProvider: ${lpTokens.length}`);
        console.log('Sample LP tokens:', lpTokens.slice(0, 5).map(([key, balance]) => ({
          contractId: key.split(':')[1],
          symbol: balance.symbol || balance.metadata?.symbol,
          name: balance.name || balance.metadata?.name,
          type: balance.metadata?.type || balance.type
        })));
        
        return balanceData;
      } catch (error) {
        console.error('❌ Failed to parse balance data:', error);
      }
    }
    
    // Close modal
    const closeButton = document.querySelector('[role="dialog"] button');
    if (closeButton) closeButton.click();
  }, 1000);
}

// Main comparison function
async function compareTokenSources() {
  console.log('🚀 Starting Token Source Comparison...\n');
  
  // Fetch API data
  const apiData = await fetchApiTokens();
  
  // Analyze BlazeProvider data
  const blazeData = analyzeBlazeData();
  
  if (apiData) {
    // Create comparison report
    setTimeout(() => {
      console.log('\n📋 COMPARISON REPORT:');
      console.log('===================');
      
      const apiLpCount = apiData.lpTokens?.length || 0;
      console.log(`API LP tokens available: ${apiLpCount}`);
      
      // This will be populated after the BlazeProvider analysis completes
      console.log('Check console output above for BlazeProvider LP token count');
      
      if (apiLpCount > 0) {
        console.log('\n💡 Next steps:');
        console.log('1. Compare the LP token counts between API and BlazeProvider');
        console.log('2. If BlazeProvider has fewer LP tokens, investigate the balance fetching logic');
        console.log('3. Check if users actually have balances for the missing LP tokens');
        console.log('4. Verify the token metadata merging process in BlazeProvider');
      }
    }, 2000);
  }
}

// Run the comparison
compareTokenSources();

console.log(`
📖 Usage Instructions:
====================
1. Open the Portfolio page (/settings/portfolio) in simple-swap
2. Open browser developer console
3. Copy and paste this entire script
4. The script will automatically analyze both data sources and provide a comparison

🔍 What this script does:
- Fetches token data from the same API that charisma-party uses
- Analyzes the BlazeProvider data visible in the debug modal
- Compares LP token availability between both sources
- Identifies potential gaps in token coverage
`);
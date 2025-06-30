/**
 * Test script for the comprehensive token metadata library
 * Run this to validate that the library correctly aggregates tokens from all sources
 */

const { loadAllTokenMetadata, getTokenStats, getLPTokens, getSubnetTokens } = require('./src/lib/token-metadata');

async function testTokenMetadata() {
  console.log('🧪 Testing comprehensive token metadata library...\n');
  
  try {
    // Load all token metadata
    console.log('⏳ Loading token metadata from all sources...');
    const startTime = Date.now();
    const allTokens = await loadAllTokenMetadata();
    const loadTime = Date.now() - startTime;
    
    console.log(`✅ Loaded metadata in ${loadTime}ms\n`);
    
    // Get comprehensive statistics
    const stats = getTokenStats(allTokens);
    console.log('📊 COMPREHENSIVE TOKEN STATISTICS:');
    console.log('=================================');
    console.log(`Total tokens: ${stats.total}`);
    console.log(`Regular tokens: ${stats.regular}`);
    console.log(`LP tokens: ${stats.lp}`);
    console.log(`Subnet tokens: ${stats.subnet}`);
    console.log(`Verified tokens: ${stats.verified}`);
    console.log(`Tokens with pricing: ${stats.withPricing}`);
    console.log(`Data sources: ${stats.sources.join(', ')}\n`);
    
    // Analyze LP tokens specifically
    const lpTokens = getLPTokens(allTokens);
    console.log('🔍 LP TOKEN ANALYSIS:');
    console.log('====================');
    console.log(`Total LP tokens found: ${lpTokens.length}`);
    
    // Group LP tokens by source
    const lpBySource = {};
    lpTokens.forEach(token => {
      const source = token.source || 'unknown';
      lpBySource[source] = (lpBySource[source] || 0) + 1;
    });
    
    console.log('LP tokens by source:');
    Object.entries(lpBySource).forEach(([source, count]) => {
      console.log(`  ${source}: ${count} LP tokens`);
    });
    
    // Show sample LP tokens
    console.log('\nSample LP tokens:');
    lpTokens.slice(0, 5).forEach(token => {
      console.log(`  ${token.symbol} (${token.name})`);
      console.log(`    Contract: ${token.contractId}`);
      console.log(`    TokenA: ${token.tokenAContract || 'N/A'}`);
      console.log(`    TokenB: ${token.tokenBContract || 'N/A'}`);
      console.log(`    Source: ${token.source}`);
      console.log('');
    });
    
    // Analyze subnet tokens
    const subnetTokens = getSubnetTokens(allTokens);
    console.log('🏗️ SUBNET TOKEN ANALYSIS:');
    console.log('========================');
    console.log(`Total subnet tokens: ${subnetTokens.length}`);
    
    console.log('Subnet token mappings:');
    subnetTokens.forEach(token => {
      console.log(`  ${token.symbol}: ${token.contractId} → ${token.base}`);
    });
    
    // Validate critical findings
    console.log('\n✅ VALIDATION RESULTS:');
    console.log('=====================');
    
    const hasSTX = allTokens.has('.stx');
    const hasCHA = allTokens.has('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token');
    
    console.log(`STX token present: ${hasSTX ? '✅' : '❌'}`);
    console.log(`CHA token present: ${hasCHA ? '✅' : '❌'}`);
    console.log(`LP tokens found: ${lpTokens.length > 0 ? '✅' : '❌'} (${lpTokens.length})`);
    console.log(`Subnet tokens found: ${subnetTokens.length > 0 ? '✅' : '❌'} (${subnetTokens.length})`);
    
    const expectedLPCount = 49; // From production API analysis
    const lpCoveragePercentage = Math.round((lpTokens.length / expectedLPCount) * 100);
    console.log(`LP token coverage: ${lpCoveragePercentage}% (${lpTokens.length}/${expectedLPCount})`);
    
    if (lpTokens.length >= expectedLPCount) {
      console.log('🎉 SUCCESS: All expected LP tokens are available!');
    } else {
      console.log('⚠️  WARNING: Some LP tokens may be missing');
    }
    
    // Compare with old system
    console.log('\n📈 IMPROVEMENT ANALYSIS:');
    console.log('=======================');
    const oldSystemLPCount = 1; // From localhost:3002 analysis
    const improvement = lpTokens.length - oldSystemLPCount;
    console.log(`Old system LP tokens: ${oldSystemLPCount}`);
    console.log(`New system LP tokens: ${lpTokens.length}`);
    console.log(`Improvement: +${improvement} LP tokens (${Math.round((improvement / oldSystemLPCount) * 100)}% increase)`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testTokenMetadata().then(() => {
  console.log('\n🏁 Test completed successfully!');
}).catch(error => {
  console.error('\n💥 Test failed:', error);
  process.exit(1);
});
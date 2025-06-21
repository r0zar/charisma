// Test script for pricing system
import { getBtcPrice, getOracleHealth } from './btc-oracle';
import { getPriceGraph } from './price-graph';
import { getTokenPrice } from './price-calculator';

export async function testPricingSystem() {
    console.log('🧪 Testing Pricing System...\n');
    
    try {
        // Test 1: BTC Oracle
        console.log('1️⃣ Testing BTC Oracle...');
        const btcPrice = await getBtcPrice();
        const oracleHealth = await getOracleHealth();
        
        if (btcPrice) {
            console.log(`✅ BTC Price: $${btcPrice.price.toFixed(2)} (${btcPrice.source})`);
            console.log(`   Confidence: ${(btcPrice.confidence * 100).toFixed(1)}%`);
        } else {
            console.log('❌ BTC Price fetch failed');
        }
        
        console.log(`   Oracle Health: ${oracleHealth.consecutiveFailures} failures`);
        console.log('');

        // Test 2: Price Graph
        console.log('2️⃣ Testing Price Graph...');
        const graph = await getPriceGraph();
        const stats = graph.getStats();
        
        console.log(`✅ Graph Stats:`);
        console.log(`   - ${stats.totalTokens} tokens`);
        console.log(`   - ${stats.totalPools} pools`);
        console.log(`   - ${stats.sbtcPairCount} sBTC pairs`);
        console.log(`   - ${stats.avgPoolsPerToken} avg pools per token`);
        console.log(`   - ${Math.floor(stats.ageMs / 60000)} minutes old`);
        console.log('');

        // Test 3: Price Calculation for a few tokens
        console.log('3️⃣ Testing Price Calculation...');
        
        // Find some test tokens
        const allTokens = graph.getAllTokens();
        const testTokens = allTokens
            .filter(token => token.poolCount > 0)
            .slice(0, 5);

        if (testTokens.length === 0) {
            console.log('❌ No tokens with liquidity found for testing');
            return;
        }

        for (const token of testTokens) {
            try {
                console.log(`🔍 Testing ${token.symbol} (${token.contractId})...`);
                const priceData = await getTokenPrice(token.contractId);
                
                if (priceData) {
                    console.log(`✅ Price: $${priceData.usdPrice.toFixed(8)}`);
                    console.log(`   sBTC Ratio: ${priceData.sbtcRatio.toFixed(8)}`);
                    console.log(`   Confidence: ${(priceData.confidence * 100).toFixed(1)}%`);
                    
                    if (priceData.primaryPath) {
                        console.log(`   Path: ${priceData.primaryPath.tokens.map(t => {
                            const node = graph.getNode(t);
                            return node?.symbol || t.slice(-8);
                        }).join(' → ')}`);
                    }
                } else {
                    console.log(`❌ Failed to calculate price`);
                }
                console.log('');
            } catch (error) {
                console.log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                console.log('');
            }
        }

        // Test 4: Path Finding
        console.log('4️⃣ Testing Path Finding...');
        if (testTokens.length > 0) {
            const testToken = testTokens[0];
            const paths = graph.findPathsToSbtc(testToken.contractId);
            
            console.log(`🔍 Paths from ${testToken.symbol} to sBTC:`);
            console.log(`   Found ${paths.length} paths`);
            
            paths.slice(0, 3).forEach((path, i) => {
                const tokenSymbols = path.tokens.map(t => {
                    const node = graph.getNode(t);
                    return node?.symbol || t.slice(-8);
                });
                console.log(`   ${i + 1}. ${tokenSymbols.join(' → ')} (${path.pools.length} hops, ${(path.confidence * 100).toFixed(1)}% confidence)`);
            });
        }

        console.log('\n🎉 Pricing System Test Complete!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Export for use in API endpoints or scripts
export default testPricingSystem;
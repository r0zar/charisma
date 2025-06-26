#!/usr/bin/env tsx

/**
 * Test enhanced confidence scoring with market vs intrinsic deviation
 * Usage: pnpm script validate-confidence-scoring
 */

import { PriceCalculator } from '../src/lib/pricing/price-calculator';
import { listVaultTokens } from '../src/lib/pool-service';
import { getBtcPrice } from '../src/lib/pricing/btc-oracle';

async function testConfidenceScoring() {
    console.log('🔍 Testing enhanced confidence scoring...');

    try {
        const calculator = PriceCalculator.getInstance();
        const allTokens = await listVaultTokens();
        const btcPrice = await getBtcPrice();
        
        if (!btcPrice) {
            throw new Error('Failed to get BTC price for testing');
        }

        console.log(`Current BTC price: $${btcPrice.price} (confidence: ${btcPrice.confidence})`);

        // Test different token types for confidence scoring
        const testTokens = [];

        // Find LP token
        const lpToken = allTokens.find(token => 
            token.contractId.includes('lp-token') || 
            token.contractId.includes('amm-lp') ||
            token.symbol.toLowerCase().includes('lp')
        );
        if (lpToken) testTokens.push({ token: lpToken, type: 'LP' });

        // Find regular tokens with different characteristics
        const regularTokens = allTokens.filter(token => 
            !token.contractId.includes('lp-token') && 
            !token.contractId.includes('amm-lp') &&
            !token.symbol.toLowerCase().includes('lp')
        ).slice(0, 3); // Take up to 3 regular tokens

        regularTokens.forEach(token => testTokens.push({ token, type: 'Regular' }));

        console.log(`\nTesting confidence scoring for ${testTokens.length} tokens...\n`);

        const confidenceResults: Array<{
            symbol: string;
            type: string;
            confidence: number;
            priceSource: string;
            pathsUsed: number;
            priceVariation: number;
            hasArbitrageOpportunity: boolean;
            details: any;
        }> = [];

        for (const { token, type } of testTokens) {
            console.log(`--- ${type} Token: ${token.symbol} ---`);
            
            const result = await calculator.calculateTokenPrice(token.contractId);
            
            if (result.success && result.price) {
                const price = result.price;
                const details = price.calculationDetails;
                
                console.log(`Price: $${price.usdPrice.toFixed(6)}`);
                console.log(`Confidence: ${price.confidence.toFixed(3)} (${(price.confidence * 100).toFixed(1)}%)`);
                console.log(`Price source: ${details?.priceSource || 'unknown'}`);
                console.log(`BTC confidence factor: ${btcPrice.confidence.toFixed(3)}`);
                
                if (details) {
                    console.log(`Paths used: ${details.pathsUsed || 'N/A'}`);
                    console.log(`Price variation: ${details.priceVariation?.toFixed(4) || 'N/A'}`);
                    console.log(`Total liquidity: ${details.totalLiquidity?.toFixed(0) || 'N/A'}`);
                }
                
                // Check for enhanced pricing fields
                console.log(`Market price: ${price.marketPrice?.toFixed(6) || 'N/A'}`);
                console.log(`Intrinsic value: ${price.intrinsicValue?.toFixed(6) || 'N/A'}`);
                console.log(`Price deviation: ${price.priceDeviation?.toFixed(4) || 'N/A'}`);
                console.log(`Arbitrage opportunity: ${price.isArbitrageOpportunity ? 'Yes' : 'No'}`);
                
                // Calculate expected confidence factors
                if (details && type === 'Regular') {
                    const pathCountScore = Math.min(1, (details.pathsUsed || 1) / 3);
                    const consistencyScore = Math.max(0, 1 - (details.priceVariation || 0));
                    const liquidityScore = Math.min(1, (details.totalLiquidity || 0) / 100000000000000);
                    
                    console.log(`\nConfidence breakdown:`);
                    console.log(`  Path count score: ${pathCountScore.toFixed(3)} (${details.pathsUsed || 0} paths)`);
                    console.log(`  Consistency score: ${consistencyScore.toFixed(3)} (${((details.priceVariation || 0) * 100).toFixed(2)}% variation)`);
                    console.log(`  Liquidity score: ${liquidityScore.toFixed(3)} ($${(details.totalLiquidity || 0).toFixed(0)} atomic units)`);
                    
                    const expectedBaseConfidence = (consistencyScore * 0.4 + liquidityScore * 0.4 + pathCountScore * 0.2);
                    const expectedFinalConfidence = expectedBaseConfidence * btcPrice.confidence;
                    
                    console.log(`  Expected base confidence: ${expectedBaseConfidence.toFixed(3)}`);
                    console.log(`  Expected final confidence: ${expectedFinalConfidence.toFixed(3)}`);
                    console.log(`  Actual confidence: ${price.confidence.toFixed(3)}`);
                    
                    const confidenceDiff = Math.abs(price.confidence - expectedFinalConfidence);
                    if (confidenceDiff < 0.1) {
                        console.log(`  ✅ Confidence calculation appears correct (diff: ${confidenceDiff.toFixed(3)})`);
                    } else {
                        console.log(`  ⚠️ Confidence calculation may be off (diff: ${confidenceDiff.toFixed(3)})`);
                    }
                }
                
                // Test arbitrage detection logic
                if (price.marketPrice && price.intrinsicValue) {
                    const deviation = (price.marketPrice - price.intrinsicValue) / price.intrinsicValue;
                    const expectedArbitrage = Math.abs(deviation) > 0.05; // 5% threshold
                    
                    console.log(`\nArbitrage analysis:`);
                    console.log(`  Market: $${price.marketPrice.toFixed(6)}`);
                    console.log(`  Intrinsic: $${price.intrinsicValue.toFixed(6)}`);
                    console.log(`  Deviation: ${(deviation * 100).toFixed(2)}%`);
                    console.log(`  Expected arbitrage: ${expectedArbitrage ? 'Yes' : 'No'}`);
                    console.log(`  Detected arbitrage: ${price.isArbitrageOpportunity ? 'Yes' : 'No'}`);
                    
                    if (expectedArbitrage === price.isArbitrageOpportunity) {
                        console.log(`  ✅ Arbitrage detection correct`);
                    } else {
                        console.log(`  ⚠️ Arbitrage detection may be incorrect`);
                    }
                }
                
                confidenceResults.push({
                    symbol: token.symbol,
                    type,
                    confidence: price.confidence,
                    priceSource: details?.priceSource || 'unknown',
                    pathsUsed: details?.pathsUsed || 0,
                    priceVariation: details?.priceVariation || 0,
                    hasArbitrageOpportunity: price.isArbitrageOpportunity || false,
                    details: {
                        usdPrice: price.usdPrice,
                        marketPrice: price.marketPrice,
                        intrinsicValue: price.intrinsicValue,
                        priceDeviation: price.priceDeviation
                    }
                });
                
            } else {
                console.log(`❌ Failed to get price: ${result.error}`);
            }
            
            console.log(''); // Empty line for readability
        }

        // Analyze confidence patterns
        console.log('--- Confidence Analysis Summary ---');
        
        const lpResults = confidenceResults.filter(r => r.type === 'LP');
        const regularResults = confidenceResults.filter(r => r.type === 'Regular');
        
        if (lpResults.length > 0) {
            const avgLpConfidence = lpResults.reduce((sum, r) => sum + r.confidence, 0) / lpResults.length;
            console.log(`LP Token Confidence: ${avgLpConfidence.toFixed(3)} (${lpResults.length} tokens)`);
            
            lpResults.forEach(r => {
                console.log(`  ${r.symbol}: ${r.confidence.toFixed(3)} (${r.priceSource})`);
            });
        }
        
        if (regularResults.length > 0) {
            const avgRegularConfidence = regularResults.reduce((sum, r) => sum + r.confidence, 0) / regularResults.length;
            console.log(`Regular Token Confidence: ${avgRegularConfidence.toFixed(3)} (${regularResults.length} tokens)`);
            
            regularResults.forEach(r => {
                console.log(`  ${r.symbol}: ${r.confidence.toFixed(3)} (${r.pathsUsed} paths, ${(r.priceVariation * 100).toFixed(2)}% var)`);
            });
        }
        
        // Check for arbitrage opportunities
        const arbitrageTokens = confidenceResults.filter(r => r.hasArbitrageOpportunity);
        if (arbitrageTokens.length > 0) {
            console.log(`\nArbitrage Opportunities Found: ${arbitrageTokens.length}`);
            arbitrageTokens.forEach(r => {
                const market = r.details.marketPrice;
                const intrinsic = r.details.intrinsicValue;
                if (market && intrinsic) {
                    const deviation = ((market - intrinsic) / intrinsic * 100);
                    console.log(`  ${r.symbol}: ${deviation.toFixed(2)}% deviation`);
                }
            });
        } else {
            console.log('\nNo arbitrage opportunities detected');
        }

        // Validate confidence score ranges
        const validConfidences = confidenceResults.filter(r => r.confidence >= 0 && r.confidence <= 1);
        console.log(`\nConfidence Validation:`);
        console.log(`  Valid confidence scores: ${validConfidences.length}/${confidenceResults.length}`);
        console.log(`  Confidence range: ${Math.min(...confidenceResults.map(r => r.confidence)).toFixed(3)} - ${Math.max(...confidenceResults.map(r => r.confidence)).toFixed(3)}`);
        
        if (validConfidences.length === confidenceResults.length) {
            console.log('  ✅ All confidence scores within valid range [0, 1]');
        } else {
            console.log('  ⚠️ Some confidence scores outside valid range');
        }

        console.log('\n✅ Confidence scoring validation complete');
        return true;
    } catch (error) {
        console.error('❌ Confidence scoring test failed:', error);
        return false;
    }
}

// Show usage information
function showUsage() {
    console.log('Usage: pnpm script validate-confidence-scoring');
    console.log('\nDescription:');
    console.log('  Tests enhanced confidence scoring system including:');
    console.log('  - Base confidence calculation factors (paths, liquidity, consistency)');
    console.log('  - BTC price confidence integration');
    console.log('  - Market vs intrinsic price deviation penalties');
    console.log('  - Arbitrage opportunity detection (>5% deviation)');
    console.log('  - Confidence score validation and analysis');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsage();
    process.exit(0);
}

testConfidenceScoring().catch(console.error);
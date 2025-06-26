#!/usr/bin/env tsx

/**
 * Test fallback pricing logic when market pricing fails
 * Usage: pnpm script validate-fallback-logic
 */

import { PriceCalculator } from '../src/lib/pricing/price-calculator';
import { listVaultTokens } from '../src/lib/pool-service';

async function testFallbackLogic() {
    console.log('🔍 Testing fallback pricing logic...');

    try {
        const calculator = PriceCalculator.getInstance();
        const allTokens = await listVaultTokens();
        
        // Find test tokens for different scenarios
        const lpToken = allTokens.find(token => 
            token.contractId.includes('lp-token') || 
            token.contractId.includes('amm-lp') ||
            token.symbol.toLowerCase().includes('lp')
        );

        const regularToken = allTokens.find(token => 
            !token.contractId.includes('lp-token') && 
            !token.contractId.includes('amm-lp') &&
            !token.symbol.toLowerCase().includes('lp')
        );

        console.log('--- Testing Normal Pricing Flow ---');
        
        // Test normal pricing flow
        if (regularToken) {
            console.log(`Testing normal pricing: ${regularToken.symbol}`);
            const normalResult = await calculator.calculateTokenPrice(regularToken.contractId);
            
            if (normalResult.success) {
                console.log('✅ Normal pricing successful');
                console.log(`Price: $${normalResult.price?.usdPrice?.toFixed(6) || 'N/A'}`);
                console.log(`Confidence: ${normalResult.price?.confidence?.toFixed(3) || 'N/A'}`);
                console.log(`Source: ${normalResult.price?.calculationDetails?.priceSource || 'unknown'}`);
            } else {
                console.log('⚠️ Normal pricing failed:', normalResult.error);
            }
        }

        console.log('\n--- Testing LP Token Intrinsic Fallback ---');
        
        // Test LP token intrinsic pricing (should fallback to intrinsic when market fails)
        if (lpToken) {
            console.log(`Testing LP intrinsic fallback: ${lpToken.symbol}`);
            const lpResult = await calculator.calculateTokenPrice(lpToken.contractId);
            
            if (lpResult.success) {
                console.log('✅ LP token pricing successful');
                console.log(`Price: $${lpResult.price?.usdPrice?.toFixed(6) || 'N/A'}`);
                console.log(`Confidence: ${lpResult.price?.confidence?.toFixed(3) || 'N/A'}`);
                console.log(`Source: ${lpResult.price?.calculationDetails?.priceSource || 'unknown'}`);
                console.log(`Has intrinsic value: ${!!lpResult.price?.intrinsicValue}`);
                console.log(`Used intrinsic pricing: ${!!lpResult.debugInfo?.usedIntrinsicPricing}`);
                
                // Validate LP token uses intrinsic source
                if (lpResult.price?.calculationDetails?.priceSource === 'intrinsic') {
                    console.log('✅ LP token correctly fell back to intrinsic pricing');
                } else if (lpResult.price?.calculationDetails?.priceSource === 'market') {
                    console.log('ℹ️ LP token used market pricing (market paths available)');
                } else {
                    console.log('⚠️ LP token used unknown pricing source');
                }
            } else {
                console.log('⚠️ LP token pricing failed:', lpResult.error);
                
                // Check if error indicates fallback was attempted
                if (lpResult.error?.includes('intrinsic pricing failed')) {
                    console.log('✅ LP token attempted intrinsic pricing fallback');
                } else {
                    console.log('⚠️ LP token may not have attempted intrinsic fallback');
                }
            }
        } else {
            console.log('⚠️ No LP tokens found for fallback testing');
        }

        console.log('\n--- Testing Confidence Scoring ---');
        
        // Test confidence scoring factors
        const testTokens = [regularToken, lpToken].filter(Boolean);
        
        for (const token of testTokens) {
            if (!token) continue;
            
            console.log(`\nAnalyzing confidence for: ${token.symbol}`);
            const result = await calculator.calculateTokenPrice(token.contractId);
            
            if (result.success && result.price) {
                const price = result.price;
                console.log(`Base confidence: ${price.confidence?.toFixed(3) || 'N/A'}`);
                
                // Check confidence factors
                if (price.calculationDetails) {
                    const details = price.calculationDetails;
                    console.log(`BTC price: $${details.btcPrice?.toFixed(2) || 'N/A'}`);
                    console.log(`Paths used: ${details.pathsUsed || 'N/A'}`);
                    console.log(`Price variation: ${details.priceVariation?.toFixed(3) || 'N/A'}`);
                    console.log(`Total liquidity: ${details.totalLiquidity?.toFixed(0) || 'N/A'}`);
                }
                
                // Check for arbitrage opportunities
                if (price.priceDeviation !== undefined) {
                    console.log(`Price deviation: ${price.priceDeviation?.toFixed(3) || 'N/A'}`);
                    console.log(`Arbitrage opportunity: ${price.isArbitrageOpportunity ? 'Yes' : 'No'}`);
                }
                
                // Validate confidence is reasonable (between 0 and 1)
                if (price.confidence >= 0 && price.confidence <= 1) {
                    console.log('✅ Confidence score within valid range');
                } else {
                    console.log(`⚠️ Confidence score out of range: ${price.confidence}`);
                }
            }
        }

        console.log('\n--- Testing Cache Behavior ---');
        
        // Test cache behavior with fallback
        if (regularToken) {
            console.log(`Testing cache behavior: ${regularToken.symbol}`);
            
            // First call (should calculate)
            const start1 = Date.now();
            const result1 = await calculator.calculateTokenPrice(regularToken.contractId);
            const time1 = Date.now() - start1;
            
            // Second call (should use cache)
            const start2 = Date.now();
            const result2 = await calculator.calculateTokenPrice(regularToken.contractId);
            const time2 = Date.now() - start2;
            
            console.log(`First call: ${time1}ms`);
            console.log(`Second call: ${time2}ms`);
            
            if (time2 < time1 * 0.5) {
                console.log('✅ Cache appears to be working (significant speedup)');
            } else {
                console.log('⚠️ Cache may not be working (no speedup detected)');
            }
            
            // Check if prices are consistent
            if (result1.success && result2.success && 
                result1.price?.usdPrice === result2.price?.usdPrice) {
                console.log('✅ Cached prices are consistent');
            } else {
                console.log('⚠️ Cached prices may be inconsistent');
            }
        }

        console.log('\n✅ Fallback logic validation complete');
        return true;
    } catch (error) {
        console.error('❌ Fallback logic test failed:', error);
        return false;
    }
}

// Show usage information
function showUsage() {
    console.log('Usage: pnpm script validate-fallback-logic');
    console.log('\nDescription:');
    console.log('  Tests fallback pricing logic when market pricing fails or is unavailable.');
    console.log('  Validates that LP tokens fall back to intrinsic pricing and confidence scoring works.');
    console.log('  Also tests cache behavior and price consistency.');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsage();
    process.exit(0);
}

testFallbackLogic().catch(console.error);
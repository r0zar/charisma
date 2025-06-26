#!/usr/bin/env tsx

/**
 * Test LP token pricing directly using the main calculateTokenPrice method
 * Usage: pnpm script test-lp-pricing-direct
 */

import { PriceCalculator } from '@/lib/pricing/price-calculator';

async function main() {
    console.log('🔍 Testing LP token pricing directly...\n');
    
    try {
        const calculator = PriceCalculator.getInstance();
        
        // Test specific LP tokens
        const lpTokens = [
            'SP15WAVKQNT241YVCGQMJS777E17H9TS96M21Q5DX.sexy-pepe',
            'SP1KMAA7TPZ5AZZ4W67X74MJNFKMN576604CWNBQS.dmghoot-lp-token',
            'SP1KMAA7TPZ5AZZ4W67X74MJNFKMN576604CWNBQS.stxshark'
        ];
        
        for (const tokenId of lpTokens) {
            console.log(`\n=== Testing ${tokenId} ===`);
            
            const result = await calculator.calculateTokenPrice(tokenId, false); // Force fresh calculation
            
            if (result.success && result.price) {
                console.log(`✅ Success!`);
                console.log(`  USD Price: $${result.price.usdPrice.toFixed(6)}`);
                console.log(`  sBTC Ratio: ${result.price.sbtcRatio.toFixed(8)}`);
                console.log(`  Confidence: ${result.price.confidence.toFixed(1)}%`);
                console.log(`  Source: ${result.price.calculationDetails?.priceSource || 'unknown'}`);
                
                if (result.price.intrinsicValue) {
                    console.log(`  Intrinsic Value: $${result.price.intrinsicValue.toFixed(6)}`);
                }
                if (result.price.marketPrice) {
                    console.log(`  Market Price: $${result.price.marketPrice.toFixed(6)}`);
                }
                if (result.price.priceDeviation) {
                    console.log(`  Price Deviation: ${result.price.priceDeviation.toFixed(2)}%`);
                }
                if (result.price.isArbitrageOpportunity) {
                    console.log(`  🚨 Arbitrage Opportunity Detected!`);
                }
                
                if (result.debugInfo) {
                    console.log(`  Debug Info:`);
                    console.log(`    Calculation Time: ${result.debugInfo.calculationTimeMs}ms`);
                    console.log(`    Used Hybrid Pricing: ${result.debugInfo.usedHybridPricing}`);
                    console.log(`    Has Market Price: ${result.debugInfo.hasMarketPrice}`);
                    console.log(`    Has Intrinsic Price: ${result.debugInfo.hasIntrinsicPrice}`);
                }
            } else {
                console.log(`❌ Failed: ${result.error}`);
                if (result.debugInfo) {
                    console.log(`  Debug Info:`, result.debugInfo);
                }
            }
        }
        
    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        console.error('Full error:', error);
    }
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage: pnpm script test-lp-pricing-direct');
    console.log('\nTests LP token pricing directly using calculateTokenPrice');
    process.exit(0);
}

// Run the script
main().catch(console.error);
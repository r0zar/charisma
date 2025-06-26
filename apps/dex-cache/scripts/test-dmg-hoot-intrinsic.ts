#!/usr/bin/env tsx

/**
 * Test intrinsic calculation specifically for DMG-HOOT
 * Usage: pnpm script test-dmg-hoot-intrinsic
 */

import { calculateLpIntrinsicValue } from '@/lib/pricing/lp-token-calculator';
import { getMultipleTokenPrices } from '@/lib/pricing/price-calculator';

async function main() {
    console.log('🔍 Testing DMG-HOOT intrinsic calculation...\n');

    const dmgHootId = 'SP1KMAA7TPZ5AZZ4W67X74MJNFKMN576604CWNBQS.dmghoot-lp-token';

    try {
        // Step 1: Get current prices for context
        console.log('=== STEP 1: GET CURRENT PRICES ===');
        const priceMap = await getMultipleTokenPrices([dmgHootId]);
        const dmgHootPrice = priceMap.get(dmgHootId);
        
        console.log('DMG-HOOT price data:');
        console.log(`  USD Price: ${dmgHootPrice?.usdPrice}`);
        console.log(`  Confidence: ${dmgHootPrice?.confidence}`);
        console.log(`  isLpToken: ${dmgHootPrice?.isLpToken}`);
        console.log(`  intrinsicValue: ${dmgHootPrice?.intrinsicValue}`);
        console.log(`  marketPrice: ${dmgHootPrice?.marketPrice}`);

        // Step 2: Calculate prices for underlying assets
        console.log('\n=== STEP 2: GET UNDERLYING ASSET PRICES ===');
        const underlyingTokens = ['SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dme000-governance-token', 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-the-owl'];
        const underlyingPriceMap = await getMultipleTokenPrices(underlyingTokens);
        
        const currentPrices: Record<string, number> = {};
        underlyingPriceMap.forEach((priceData, tokenId) => {
            if (priceData.usdPrice > 0) {
                currentPrices[tokenId] = priceData.usdPrice;
                console.log(`  ${tokenId}: $${priceData.usdPrice}`);
            }
        });

        console.log('\nCurrent prices object:');
        console.log(JSON.stringify(currentPrices, null, 2));

        // Step 3: Test direct intrinsic calculation
        console.log('\n=== STEP 3: DIRECT INTRINSIC CALCULATION ===');
        try {
            const intrinsicResult = await calculateLpIntrinsicValue(dmgHootId, currentPrices);
            console.log('Intrinsic calculation result:');
            if (intrinsicResult) {
                console.log(`  USD Price: $${intrinsicResult.usdPrice}`);
                console.log(`  sBTC Ratio: ${intrinsicResult.sbtcRatio}`);
                console.log(`  Confidence: ${intrinsicResult.confidence}`);
            } else {
                console.log('  Result: null');
            }
        } catch (error) {
            console.error('Error in intrinsic calculation:');
            console.error(error instanceof Error ? error.message : error);
            console.error('Full error:', error);
        }

        // Step 4: Test with minimal price set
        console.log('\n=== STEP 4: MINIMAL PRICE SET TEST ===');
        const minimalPrices = {
            'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dme000-governance-token': 0.003260,
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-the-owl': 0.000026
        };
        
        console.log('Using minimal prices:');
        console.log(JSON.stringify(minimalPrices, null, 2));
        
        try {
            const intrinsicResult = await calculateLpIntrinsicValue(dmgHootId, minimalPrices);
            console.log('Minimal prices intrinsic result:');
            if (intrinsicResult) {
                console.log(`  USD Price: $${intrinsicResult.usdPrice}`);
                console.log(`  sBTC Ratio: ${intrinsicResult.sbtcRatio}`);
                console.log(`  Confidence: ${intrinsicResult.confidence}`);
            } else {
                console.log('  Result: null');
            }
        } catch (error) {
            console.error('Error with minimal prices:');
            console.error(error instanceof Error ? error.message : error);
        }

    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        console.error('Full error:', error);
    }
}

// Run the script
main().catch(console.error);
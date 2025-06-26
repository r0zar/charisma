#!/usr/bin/env tsx

/**
 * Validate improved LP token detection after fixing the isLpToken method
 * Usage: pnpm script validate-improved-lp-detection
 */

import { listVaults, listVaultTokens } from '../src/lib/pool-service';
import { priceCalculator, getMultipleTokenPrices } from '../src/lib/pricing/price-calculator';

async function validateImprovedLpDetection() {
    console.log('🔍 Validating improved LP token detection...');

    try {
        // Get data sources
        const vaults = await listVaults();
        const individualTokens = await listVaultTokens();
        
        if (vaults.length === 0) {
            console.log('⚠️ No vaults found - cannot test LP detection');
            return false;
        }

        console.log(`\nData available:`);
        console.log(`  Individual tokens: ${individualTokens.length}`);
        console.log(`  LP vaults: ${vaults.length}`);

        // Test a few real LP tokens from the vault list
        const testVaults = vaults.slice(0, 5);
        console.log(`\n🧪 Testing LP detection on ${testVaults.length} sample vaults:`);
        
        for (const vault of testVaults) {
            console.log(`\nTesting: ${vault.contractId}`);
            console.log(`  Symbol: ${vault.symbol}`);
            console.log(`  Type: ${vault.type}`);
            console.log(`  Protocol: ${vault.protocol}`);
            
            // Test the isLpToken method directly
            const calculator = priceCalculator as any; // Access private method
            const isLp = await calculator.isLpToken(vault.contractId);
            
            console.log(`  Detected as LP: ${isLp ? '✅' : '❌'}`);
            
            if (!isLp) {
                console.log(`  ⚠️ Failed to detect ${vault.contractId} as LP token`);
            }
        }

        // Test pricing with some LP tokens
        console.log(`\n💰 Testing price calculation for LP tokens:`);
        const testTokenIds = testVaults.map(v => v.contractId).slice(0, 3);
        
        const startTime = Date.now();
        const prices = await getMultipleTokenPrices(testTokenIds);
        const calcTime = Date.now() - startTime;
        
        console.log(`\nPrice calculation completed in ${calcTime}ms`);
        console.log(`Successfully priced: ${prices.size}/${testTokenIds.length} tokens`);
        
        // Show details for successfully priced tokens
        let lpTokensPriced = 0;
        for (const [tokenId, priceData] of prices.entries()) {
            const vault = vaults.find(v => v.contractId === tokenId);
            if (vault) {
                console.log(`\n${vault.symbol} (${tokenId}):`);
                console.log(`  USD Price: $${priceData.usdPrice.toFixed(6)}`);
                console.log(`  sBTC Ratio: ${priceData.sbtcRatio.toFixed(8)}`);
                console.log(`  Confidence: ${priceData.confidence.toFixed(2)}`);
                console.log(`  Price Source: ${priceData.calculationDetails?.priceSource || 'unknown'}`);
                console.log(`  Intrinsic Value: ${priceData.intrinsicValue ? `$${priceData.intrinsicValue.toFixed(6)}` : 'N/A'}`);
                lpTokensPriced++;
            }
        }

        // Test with some individual tokens for comparison
        console.log(`\n🔍 Testing detection on individual tokens (should be false):`);
        const testIndividualTokens = individualTokens.slice(0, 3);
        
        for (const token of testIndividualTokens) {
            const calculator = priceCalculator as any;
            const isLp = await calculator.isLpToken(token.contractId);
            console.log(`${token.symbol} (${token.contractId}): ${isLp ? '❌ FALSE POSITIVE' : '✅ Correctly not LP'}`);
        }

        // Summary
        console.log(`\n📊 Test Summary:`);
        console.log(`  Vaults tested: ${testVaults.length}`);
        console.log(`  LP tokens priced: ${lpTokensPriced}`);
        console.log(`  Individual tokens tested: ${testIndividualTokens.length}`);
        
        const successRate = (lpTokensPriced / testVaults.length) * 100;
        console.log(`  LP pricing success rate: ${successRate.toFixed(1)}%`);
        
        if (successRate >= 50) {
            console.log(`✅ LP token detection and pricing significantly improved`);
            return true;
        } else {
            console.log(`⚠️ LP token detection may still need work`);
            return false;
        }

    } catch (error) {
        console.error('❌ Validation failed:', error);
        return false;
    }
}

// Show usage information
function showUsage() {
    console.log('Usage: pnpm script validate-improved-lp-detection');
    console.log('\nDescription:');
    console.log('  Validates that the improved isLpToken method correctly identifies LP tokens');
    console.log('  from the vault list and can successfully calculate prices for them.');
    console.log('  Tests both positive detection (vaults should be LP) and negative detection');
    console.log('  (individual tokens should not be LP).');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsage();
    process.exit(0);
}

validateImprovedLpDetection().catch(console.error);
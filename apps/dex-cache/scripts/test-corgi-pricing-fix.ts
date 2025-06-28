#!/usr/bin/env tsx

/**
 * Test script to verify CORGI LP pricing improvements with new calculation method
 * Usage: pnpm script test-corgi-pricing-fix
 */

import { calculateLpIntrinsicValueFromVault } from '@/lib/pricing/lp-token-calculator';
import { getAllVaultData } from '@/lib/pool-service';
import { getRemoveLiquidityQuote } from '@/app/actions';

// CORGI LP token contract ID
const CORGI_LP_CONTRACT = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-corgi-liquidity';

async function testCorgiPricing() {
    console.log('🐕 CORGI LP Token Pricing Test');
    console.log('=============================');
    console.log('');
    
    try {
        // Get CORGI vault data
        const allVaults = await getAllVaultData();
        const corgiVault = allVaults.find(v => v.contractId === CORGI_LP_CONTRACT);
        
        if (!corgiVault) {
            console.error(`❌ CORGI vault not found: ${CORGI_LP_CONTRACT}`);
            return;
        }
        
        console.log(`✅ Found CORGI vault: ${corgiVault.symbol}`);
        console.log(`🔗 Contract: ${corgiVault.contractId}`);
        console.log(`💎 Token A: ${corgiVault.tokenA?.symbol} (${corgiVault.tokenA?.contractId})`);
        console.log(`💎 Token B: ${corgiVault.tokenB?.symbol} (${corgiVault.tokenB?.contractId})`);
        console.log(`📊 Reserves A: ${corgiVault.reservesA}`);
        console.log(`📊 Reserves B: ${corgiVault.reservesB}`);
        console.log(`🔧 Decimals: ${corgiVault.decimals}`);
        
        if (!corgiVault.tokenA || !corgiVault.tokenB) {
            console.error('❌ Missing token information');
            return;
        }
        
        // Use realistic prices for CORGI pair
        const prices: Record<string, number> = {
            [corgiVault.tokenA.contractId]: 0.01, // Assume CHA is $0.01
            [corgiVault.tokenB.contractId]: 100000, // Assume sBTC is $100k
            'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token': 100000, // sBTC reference
        };
        
        console.log(`\n💰 Using test prices:`);
        console.log(`  ${corgiVault.tokenA.symbol}: $${prices[corgiVault.tokenA.contractId]}`);
        console.log(`  ${corgiVault.tokenB.symbol}: $${prices[corgiVault.tokenB.contractId]}`);
        
        // Test direct remove liquidity quote
        console.log(`\n🔍 Testing direct remove liquidity quote...`);
        const lpAmount = 1; // 1 LP token
        const lpDecimals = corgiVault.decimals || 6;
        const lpAmountMicroUnits = Math.round(lpAmount * Math.pow(10, lpDecimals));
        
        console.log(`📋 Querying remove liquidity for ${lpAmount} LP token (${lpAmountMicroUnits} microunits)`);
        
        const quoteResult = await getRemoveLiquidityQuote(CORGI_LP_CONTRACT, lpAmountMicroUnits);
        
        if (quoteResult.success && quoteResult.quote) {
            const { dx, dy } = quoteResult.quote;
            
            console.log(`\n📈 Remove Liquidity Quote Results:`);
            console.log(`  dx (Token A raw): ${dx}`);
            console.log(`  dy (Token B raw): ${dy}`);
            
            // Convert to display units
            const tokenADecimals = corgiVault.tokenA.decimals || 6;
            const tokenBDecimals = corgiVault.tokenB.decimals || 6;
            
            const tokenAAmount = dx / Math.pow(10, tokenADecimals);
            const tokenBAmount = dy / Math.pow(10, tokenBDecimals);
            
            console.log(`  Token A amount: ${tokenAAmount.toFixed(6)} ${corgiVault.tokenA.symbol}`);
            console.log(`  Token B amount: ${tokenBAmount.toFixed(6)} ${corgiVault.tokenB.symbol}`);
            
            // Calculate values
            const tokenAValue = tokenAAmount * prices[corgiVault.tokenA.contractId];
            const tokenBValue = tokenBAmount * prices[corgiVault.tokenB.contractId];
            const totalValue = tokenAValue + tokenBValue;
            
            console.log(`\n💵 Value Breakdown:`);
            console.log(`  Token A value: $${tokenAValue.toFixed(6)}`);
            console.log(`  Token B value: $${tokenBValue.toFixed(6)}`);
            console.log(`  Total value: $${totalValue.toFixed(6)}`);
            console.log(`  Per LP token: $${totalValue.toFixed(6)}`);
            
        } else {
            console.error(`❌ Remove liquidity quote failed: ${quoteResult.error}`);
            return;
        }
        
        // Test new calculation method
        console.log(`\n🧮 Testing new calculation method...`);
        const newResult = await calculateLpIntrinsicValueFromVault(corgiVault, prices, 1);
        
        if (newResult !== null) {
            console.log(`✅ New method result: $${newResult.toFixed(6)} per LP token`);
        } else {
            console.error(`❌ New method failed`);
        }
        
        // Test with different amounts
        console.log(`\n🔢 Testing with different LP amounts:`);
        for (const amount of [0.1, 1, 10, 100]) {
            const result = await calculateLpIntrinsicValueFromVault(corgiVault, prices, amount);
            if (result !== null) {
                console.log(`  ${amount} LP tokens = $${result.toFixed(6)} total ($${(result/amount).toFixed(6)} per token)`);
            } else {
                console.log(`  ${amount} LP tokens = FAILED`);
            }
        }
        
        // Test pricing consistency
        console.log(`\n🎯 Testing pricing consistency (should scale linearly):`);
        const baseResult = await calculateLpIntrinsicValueFromVault(corgiVault, prices, 1);
        const doubleResult = await calculateLpIntrinsicValueFromVault(corgiVault, prices, 2);
        
        if (baseResult && doubleResult) {
            const expectedDouble = baseResult * 2;
            const difference = Math.abs(doubleResult - expectedDouble);
            const percentDiff = (difference / expectedDouble) * 100;
            
            console.log(`  1 LP token: $${baseResult.toFixed(6)}`);
            console.log(`  2 LP tokens: $${doubleResult.toFixed(6)}`);
            console.log(`  Expected 2x: $${expectedDouble.toFixed(6)}`);
            console.log(`  Difference: $${difference.toFixed(6)} (${percentDiff.toFixed(4)}%)`);
            
            if (percentDiff < 0.01) {
                console.log(`  ✅ Scaling is consistent (<0.01% difference)`);
            } else {
                console.log(`  ⚠️  Scaling issue detected (${percentDiff.toFixed(4)}% difference)`);
            }
        }
        
    } catch (error) {
        console.error(`❌ Error testing CORGI pricing:`, error);
        console.error('Full error details:', error);
    }
}

async function main() {
    console.log('Starting CORGI LP pricing validation...\n');
    
    await testCorgiPricing();
    
    console.log('\n🎉 CORGI pricing test complete!');
    console.log('');
    console.log('📝 Summary:');
    console.log('• This test validates that the new remove liquidity quote method');
    console.log('  works correctly for the CORGI LP token');
    console.log('• It should show consistent, linear scaling for different amounts');
    console.log('• The prices should be more accurate than geometric mean estimation');
}

// Show usage information
function showUsage() {
    console.log('CORGI LP Pricing Test');
    console.log('====================');
    console.log('');
    console.log('Usage: pnpm script test-corgi-pricing-fix');
    console.log('');
    console.log('This script tests the new remove liquidity quote-based pricing');
    console.log('method specifically with the CORGI LP token to verify that the');
    console.log('calculation improvements are working correctly.');
    console.log('');
    console.log('The test checks:');
    console.log('• Direct remove liquidity quotes');
    console.log('• New calculation method results');
    console.log('• Consistency across different LP amounts');
    console.log('• Linear scaling validation');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsage();
    process.exit(0);
}

// Run the script
main().catch(console.error);
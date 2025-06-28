#!/usr/bin/env tsx

/**
 * Debug LP token intrinsic value calculation failures
 * Usage: pnpm script debug-lp-intrinsic-calculation
 */

import { PriceCalculator } from '@/lib/pricing/price-calculator';
import { listVaults } from '@/lib/pool-service';
import { calculateLpIntrinsicValue } from '@/lib/pricing/lp-token-calculator';

async function main() {
    console.log('🔍 Debugging LP token intrinsic value calculation failures...\n');
    
    try {
        const calculator = PriceCalculator.getInstance();
        
        // Get sample LP tokens
        const vaults = await listVaults();
        const lpVaults = vaults.filter(v => v.type === 'POOL').slice(0, 3);
        
        console.log(`Found ${lpVaults.length} LP vaults to test:\n`);
        
        // Get current price data for comparison
        const tokenIds = lpVaults.map(v => v.contractId);
        const priceResults = await calculator.calculateMultipleTokenPrices(tokenIds);
        
        // Get all individual tokens that might be needed for pricing
        const allTokens = new Set<string>();
        lpVaults.forEach(vault => {
            if (vault.tokenA?.contractId) allTokens.add(vault.tokenA.contractId);
            if (vault.tokenB?.contractId) allTokens.add(vault.tokenB.contractId);
        });
        
        console.log(`\n📊 Need prices for ${allTokens.size} underlying tokens:`);
        Array.from(allTokens).forEach(token => console.log(`  ${token}`));
        
        // Try to get prices for all underlying tokens
        const underlyingPrices = await calculator.calculateMultipleTokenPrices(Array.from(allTokens));
        
        console.log(`\n💰 Raw underlying prices result:`);
        console.log(JSON.stringify(underlyingPrices, null, 2));
        
        const successfulPrices = Object.entries(underlyingPrices).filter(([_, priceData]) => priceData !== null);
        console.log(`\n💰 Got prices for ${successfulPrices.length} underlying tokens:`);
        successfulPrices.forEach(([token, priceData]) => {
            console.log(`  ${token}: $${priceData!.usdPrice.toFixed(6)}`);
        });
        
        // Show failed tokens
        const failedTokens = Object.entries(underlyingPrices).filter(([_, priceData]) => priceData === null);
        if (failedTokens.length > 0) {
            console.log(`\n❌ Failed to price ${failedTokens.length} tokens:`);
            failedTokens.forEach(([token, _]) => {
                console.log(`  ${token}: FAILED`);
            });
        }
        
        // Convert to simple price map for LP calculator
        const simplePrices: Record<string, number> = {};
        Object.entries(underlyingPrices).forEach(([token, priceData]) => {
            if (priceData) {
                simplePrices[token] = priceData.usdPrice;
            }
        });
        
        console.log(`\n🔬 Testing LP intrinsic value calculation for each vault:\n`);
        
        for (const vault of lpVaults) {
            console.log(`\n=== ${vault.contractId} (${vault.symbol}) ===`);
            console.log(`Token A: ${vault.tokenA?.symbol} (${vault.tokenA?.contractId})`);
            console.log(`Token B: ${vault.tokenB?.symbol} (${vault.tokenB?.contractId})`);
            console.log(`Reserves A: ${vault.reservesA}`);
            console.log(`Reserves B: ${vault.reservesB}`);
            console.log(`Decimals: ${vault.decimals}`);
            
            // Check if we have required prices
            const priceA = vault.tokenA?.contractId ? simplePrices[vault.tokenA.contractId] : undefined;
            const priceB = vault.tokenB?.contractId ? simplePrices[vault.tokenB.contractId] : undefined;
            
            console.log(`Price A: ${priceA ? `$${priceA.toFixed(6)}` : '❌ MISSING'}`);
            console.log(`Price B: ${priceB ? `$${priceB.toFixed(6)}` : '❌ MISSING'}`);
            
            // Check for missing data
            const issues: string[] = [];
            if (!vault.tokenA?.contractId) issues.push('tokenA.contractId missing');
            if (!vault.tokenB?.contractId) issues.push('tokenB.contractId missing');
            if (vault.reservesA === undefined || vault.reservesA === null) issues.push('reservesA missing');
            if (vault.reservesB === undefined || vault.reservesB === null) issues.push('reservesB missing');
            if (!priceA) issues.push('priceA missing');
            if (!priceB) issues.push('priceB missing');
            if (vault.reservesA === 0) issues.push('reservesA is zero');
            if (vault.reservesB === 0) issues.push('reservesB is zero');
            
            if (issues.length > 0) {
                console.log(`❌ Issues preventing calculation:`);
                issues.forEach(issue => console.log(`   - ${issue}`));
            }
            
            // Try the calculation
            const intrinsicValue = calculateLpIntrinsicValue(vault, simplePrices);
            
            if (intrinsicValue !== null) {
                console.log(`✅ Intrinsic Value: $${intrinsicValue.toFixed(6)}`);
                
                // Show detailed calculation
                if (vault.tokenA && vault.tokenB && priceA && priceB) {
                    const tokenADecimals = vault.tokenA.decimals || 6;
                    const tokenBDecimals = vault.tokenB.decimals || 6;
                    const lpDecimals = vault.decimals || 6;
                    
                    const tokenAAmount = vault.reservesA / Math.pow(10, tokenADecimals);
                    const tokenBAmount = vault.reservesB / Math.pow(10, tokenBDecimals);
                    const poolValueA = tokenAAmount * priceA;
                    const poolValueB = tokenBAmount * priceB;
                    const totalPoolValue = poolValueA + poolValueB;
                    const estimatedTotalSupply = Math.sqrt(vault.reservesA * vault.reservesB) / Math.pow(10, lpDecimals);
                    
                    console.log(`\n📈 Calculation Details:`);
                    console.log(`   Token A Amount: ${tokenAAmount.toLocaleString()} ${vault.tokenA.symbol}`);
                    console.log(`   Token B Amount: ${tokenBAmount.toLocaleString()} ${vault.tokenB.symbol}`);
                    console.log(`   Pool Value A: $${poolValueA.toLocaleString()}`);
                    console.log(`   Pool Value B: $${poolValueB.toLocaleString()}`);
                    console.log(`   Total Pool Value: $${totalPoolValue.toLocaleString()}`);
                    console.log(`   Estimated LP Supply: ${estimatedTotalSupply.toLocaleString()}`);
                    console.log(`   Value per LP: $${(totalPoolValue / estimatedTotalSupply).toFixed(6)}`);
                }
            } else {
                console.log(`❌ Intrinsic Value: null (calculation failed)`);
            }
        }
        
    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        console.error('Full error:', error);
    }
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage: pnpm script debug-lp-intrinsic-calculation');
    console.log('\nDebugs why LP token intrinsic value calculations are failing');
    process.exit(0);
}

// Run the script
main().catch(console.error);
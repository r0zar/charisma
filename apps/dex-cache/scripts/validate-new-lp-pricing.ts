#!/usr/bin/env tsx

/**
 * Validation script to compare old vs new LP pricing calculations
 * Usage: pnpm script validate-new-lp-pricing [contractId]
 */

import { calculateLpIntrinsicValueFromVault } from '@/lib/pricing/lp-token-calculator';
import { getAllVaultData } from '@/lib/pool-service';
import { getRemoveLiquidityQuote } from '@/app/actions';

// Old geometric mean calculation for comparison
const calculateLpIntrinsicValueOldMethod = (
    vault: any,
    prices: Record<string, number>,
    lpTokenAmount: number = 1
): number | null => {
    if (!vault.tokenA || !vault.tokenB || vault.reservesA === undefined || vault.reservesB === undefined) {
        return null;
    }

    const priceA = prices[vault.tokenA.contractId];
    const priceB = prices[vault.tokenB.contractId];

    if (!priceA || !priceB || vault.reservesA === 0 || vault.reservesB === 0) {
        return null;
    }

    // Calculate token amounts in proper decimal representation
    const tokenADecimals = vault.tokenA.decimals || 6;
    const tokenBDecimals = vault.tokenB.decimals || 6;
    
    const tokenAAmount = vault.reservesA / Math.pow(10, tokenADecimals);
    const tokenBAmount = vault.reservesB / Math.pow(10, tokenBDecimals);

    // Calculate total pool value in USD
    const poolValueA = tokenAAmount * priceA;
    const poolValueB = tokenBAmount * priceB;
    const totalPoolValue = poolValueA + poolValueB;

    // OLD METHOD: geometric mean estimation
    const lpDecimals = vault.decimals || 6;
    const estimatedTotalSupply = Math.sqrt(vault.reservesA * vault.reservesB) / Math.pow(10, lpDecimals);
    
    if (estimatedTotalSupply === 0 || totalPoolValue === 0) {
        return null;
    }

    // Calculate intrinsic value per LP token
    return (totalPoolValue / estimatedTotalSupply) * lpTokenAmount;
};

async function testLpPricing(contractId: string) {
    console.log(`\n=== Testing LP Pricing for ${contractId} ===`);
    
    try {
        // Get vault data
        const allVaults = await getAllVaultData();
        const vault = allVaults.find(v => v.contractId === contractId);
        
        if (!vault) {
            console.error(`❌ Vault not found: ${contractId}`);
            return;
        }
        
        if (!vault.tokenA || !vault.tokenB) {
            console.error(`❌ Vault missing token info: ${contractId}`);
            return;
        }
        
        console.log(`📊 Vault: ${vault.symbol} (${vault.tokenA.symbol}/${vault.tokenB.symbol})`);
        console.log(`📈 Reserves: ${vault.reservesA} / ${vault.reservesB}`);
        
        // Mock prices for testing (in real use, these would come from price feeds)
        const mockPrices: Record<string, number> = {
            [vault.tokenA.contractId]: 1.0, // Assume $1 for tokenA
            [vault.tokenB.contractId]: 100000.0, // Assume $100k for tokenB (e.g., sBTC)
            'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token': 100000.0, // sBTC reference price
        };
        
        console.log(`💰 Test Prices: ${vault.tokenA.symbol}=$${mockPrices[vault.tokenA.contractId]}, ${vault.tokenB.symbol}=$${mockPrices[vault.tokenB.contractId]}`);
        
        // Test both methods
        console.log(`\n📊 Calculating intrinsic value for 1 LP token...`);
        
        // Old method
        const startTimeOld = Date.now();
        const oldResult = calculateLpIntrinsicValueOldMethod(vault, mockPrices, 1);
        const oldTime = Date.now() - startTimeOld;
        
        // New method
        const startTimeNew = Date.now();
        const newResult = await calculateLpIntrinsicValueFromVault(vault, mockPrices, 1);
        const newTime = Date.now() - startTimeNew;
        
        console.log(`\n🔍 RESULTS:`);
        console.log(`📐 Old Method (Geometric Mean): $${oldResult?.toFixed(6) || 'FAILED'} (${oldTime}ms)`);
        console.log(`📋 New Method (Remove Quote): $${newResult?.toFixed(6) || 'FAILED'} (${newTime}ms)`);
        
        if (oldResult && newResult) {
            const difference = Math.abs(newResult - oldResult);
            const percentDiff = (difference / oldResult) * 100;
            
            console.log(`\n📈 COMPARISON:`);
            console.log(`💵 Absolute Difference: $${difference.toFixed(6)}`);
            console.log(`📊 Percentage Difference: ${percentDiff.toFixed(2)}%`);
            
            if (percentDiff > 10) {
                console.log(`⚠️  SIGNIFICANT DIFFERENCE DETECTED (>10%)`);
            } else if (percentDiff > 1) {
                console.log(`⚡ Notable difference (>1%)`);
            } else {
                console.log(`✅ Results are close (<1% difference)`);
            }
        }
        
        // Test with different LP amounts
        console.log(`\n🔢 Testing with different LP amounts...`);
        for (const amount of [0.1, 10, 100]) {
            const oldAmountResult = calculateLpIntrinsicValueOldMethod(vault, mockPrices, amount);
            const newAmountResult = await calculateLpIntrinsicValueFromVault(vault, mockPrices, amount);
            
            console.log(`${amount} LP tokens:`);
            console.log(`  Old: $${oldAmountResult?.toFixed(6) || 'FAILED'}`);
            console.log(`  New: $${newAmountResult?.toFixed(6) || 'FAILED'}`);
            
            if (oldAmountResult && newAmountResult) {
                const diff = Math.abs(newAmountResult - oldAmountResult);
                console.log(`  Diff: $${diff.toFixed(6)} (${((diff / oldAmountResult) * 100).toFixed(2)}%)`);
            }
        }
        
    } catch (error) {
        console.error(`❌ Error testing ${contractId}:`, error);
    }
}

async function main() {
    const contractId = process.argv[2];
    
    if (!contractId) {
        console.log('Usage: pnpm script validate-new-lp-pricing <contractId>');
        console.log('');
        console.log('Example:');
        console.log('  pnpm script validate-new-lp-pricing SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-corgi-liquidity');
        console.log('');
        console.log('This script compares the old geometric mean calculation with the new remove liquidity quote method.');
        return;
    }
    
    console.log('🧪 LP Pricing Validation Script');
    console.log('===============================');
    console.log('');
    console.log('This script compares:');
    console.log('• Old Method: Geometric mean estimation of LP supply');
    console.log('• New Method: Actual remove liquidity quotes from contracts');
    console.log('');
    
    await testLpPricing(contractId);
    
    console.log('\n✅ Validation complete!');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('LP Pricing Validation Script');
    console.log('===========================');
    console.log('');
    console.log('Usage: pnpm script validate-new-lp-pricing <contractId>');
    console.log('');
    console.log('This script compares the old geometric mean calculation method');
    console.log('with the new remove liquidity quote method for LP token pricing.');
    console.log('');
    console.log('The new method should be more accurate because it uses actual');
    console.log('contract logic instead of mathematical estimations.');
    console.log('');
    console.log('Examples:');
    console.log('  pnpm script validate-new-lp-pricing SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-corgi-liquidity');
    process.exit(0);
}

// Run the script
main().catch(console.error);
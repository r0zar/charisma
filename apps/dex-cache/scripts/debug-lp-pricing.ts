#!/usr/bin/env tsx

/**
 * Debug why LP tokens aren't being priced successfully
 * Usage: pnpm script debug-lp-pricing
 */

import { listVaults } from '../src/lib/pool-service';
import { priceCalculator } from '../src/lib/pricing/price-calculator';

async function debugLpPricing() {
    console.log('🔍 Debugging LP token pricing issues...');

    try {
        const vaults = await listVaults();
        if (vaults.length === 0) {
            console.log('⚠️ No vaults found');
            return;
        }

        // Test a single LP token
        const testVault = vaults[0];
        console.log(`\nTesting single LP token: ${testVault.contractId}`);
        console.log(`Symbol: ${testVault.symbol}, Type: ${testVault.type}`);

        // Calculate price for this LP token
        const startTime = Date.now();
        const result = await priceCalculator.calculateTokenPrice(testVault.contractId);
        const calcTime = Date.now() - startTime;

        console.log(`\nPrice calculation completed in ${calcTime}ms`);
        console.log(`Success: ${result.success}`);
        
        if (result.success && result.price) {
            console.log(`Price found: $${result.price.usdPrice.toFixed(6)}`);
            console.log(`Price source: ${result.price.calculationDetails?.priceSource || 'unknown'}`);
            console.log(`Intrinsic value: ${result.price.intrinsicValue ? `$${result.price.intrinsicValue.toFixed(6)}` : 'N/A'}`);
        } else {
            console.log(`❌ Failed to price LP token: ${result.error}`);
            if (result.debugInfo) {
                console.log(`Debug info:`, result.debugInfo);
            }
        }

        // Test a few more LP tokens to see if it's specific or general
        console.log(`\n🧪 Testing ${Math.min(3, vaults.length)} more LP tokens:`);
        const testVaults = vaults.slice(1, 4);
        
        for (const vault of testVaults) {
            console.log(`\nTesting: ${vault.symbol} (${vault.contractId})`);
            const result = await priceCalculator.calculateTokenPrice(vault.contractId, false); // Skip cache
            
            if (result.success && result.price) {
                console.log(`✅ Priced: $${result.price.usdPrice.toFixed(6)}`);
            } else {
                console.log(`❌ Failed: ${result.error}`);
            }
        }

        // Check if there are any individual tokens that work for comparison
        console.log(`\n🔍 Testing one individual token for comparison:`);
        
        // Let's just test with sBTC which should always work
        const sbtcResult = await priceCalculator.calculateTokenPrice('SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sbtc-token');
        if (sbtcResult.success) {
            console.log(`✅ sBTC priced successfully: $${sbtcResult.price?.usdPrice.toFixed(6)}`);
        } else {
            console.log(`❌ Even sBTC failed: ${sbtcResult.error}`);
        }

    } catch (error) {
        console.error('❌ Debug failed:', error);
    }
}

// Show usage information
function showUsage() {
    console.log('Usage: pnpm script debug-lp-pricing');
    console.log('\nDescription:');
    console.log('  Debugs why LP tokens are not being priced successfully.');
    console.log('  Tests individual LP token pricing and compares with regular tokens.');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsage();
    process.exit(0);
}

debugLpPricing().catch(console.error);
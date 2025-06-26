#!/usr/bin/env tsx

/**
 * Debug why calculateLpIntrinsicValue returns null for DMG-HOOT
 * Usage: pnpm script debug-lp-calculation-failure
 */

import { getAllVaultData } from '@/lib/pool-service';

async function main() {
    console.log('🔍 Debugging LP calculation failure for DMG-HOOT...\n');

    const dmgHootId = 'SP1KMAA7TPZ5AZZ4W67X74MJNFKMN576604CWNBQS.dmghoot-lp-token';

    try {
        // Step 1: Check if vault exists
        console.log('=== STEP 1: VAULT EXISTENCE CHECK ===');
        const allVaults = await getAllVaultData();
        const dmgHootVault = allVaults.find(vault => vault.contractId === dmgHootId);
        
        if (dmgHootVault) {
            console.log('✅ DMG-HOOT vault found');
            console.log(`   Type: ${dmgHootVault.type}`);
            console.log(`   Protocol: ${dmgHootVault.protocol}`);
            console.log(`   TokenA: ${dmgHootVault.tokenA?.symbol} (${dmgHootVault.tokenA?.contractId})`);
            console.log(`   TokenB: ${dmgHootVault.tokenB?.symbol} (${dmgHootVault.tokenB?.contractId})`);
            console.log(`   ReserveA: ${dmgHootVault.reservesA}`);
            console.log(`   ReserveB: ${dmgHootVault.reservesB}`);
            console.log(`   DecimalsA: ${dmgHootVault.tokenA?.decimals}`);
            console.log(`   DecimalsB: ${dmgHootVault.tokenB?.decimals}`);
        } else {
            console.log('❌ DMG-HOOT vault NOT found');
            return;
        }

        // Step 2: Manual calculation walkthrough
        console.log('\n=== STEP 2: MANUAL CALCULATION WALKTHROUGH ===');
        
        const currentPrices = {
            'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dme000-governance-token': 0.003180000821766166,
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-the-owl': 0.000025455940784685096
        };

        console.log('Current prices:');
        console.log(JSON.stringify(currentPrices, null, 2));

        // Check if vault has required data
        const hasRequiredData = (
            dmgHootVault.tokenA?.contractId &&
            dmgHootVault.tokenB?.contractId &&
            dmgHootVault.reservesA &&
            dmgHootVault.reservesB &&
            dmgHootVault.tokenA?.decimals !== undefined &&
            dmgHootVault.tokenB?.decimals !== undefined
        );

        console.log(`Has required data: ${hasRequiredData}`);

        if (hasRequiredData) {
            // Check if prices exist for underlying tokens
            const priceA = currentPrices[dmgHootVault.tokenA!.contractId];
            const priceB = currentPrices[dmgHootVault.tokenB!.contractId];
            
            console.log(`Price for ${dmgHootVault.tokenA!.symbol}: ${priceA}`);
            console.log(`Price for ${dmgHootVault.tokenB!.symbol}: ${priceB}`);
            
            if (priceA && priceB) {
                // Manual calculation
                const reserveA = dmgHootVault.reservesA!;
                const reserveB = dmgHootVault.reservesB!;
                const decimalsA = dmgHootVault.tokenA!.decimals;
                const decimalsB = dmgHootVault.tokenB!.decimals;
                
                console.log('\nManual calculation:');
                console.log(`ReserveA (atomic): ${reserveA}`);
                console.log(`ReserveB (atomic): ${reserveB}`);
                console.log(`DecimalsA: ${decimalsA}`);
                console.log(`DecimalsB: ${decimalsB}`);
                
                // Convert to decimal
                const decimalReserveA = reserveA / Math.pow(10, decimalsA);
                const decimalReserveB = reserveB / Math.pow(10, decimalsB);
                
                console.log(`ReserveA (decimal): ${decimalReserveA}`);
                console.log(`ReserveB (decimal): ${decimalReserveB}`);
                
                // Calculate USD values
                const usdValueA = decimalReserveA * priceA;
                const usdValueB = decimalReserveB * priceB;
                const totalUsdValue = usdValueA + usdValueB;
                
                console.log(`USD value A: $${usdValueA}`);
                console.log(`USD value B: $${usdValueB}`);
                console.log(`Total USD value: $${totalUsdValue}`);
                
                // Calculate total supply (this is where we might need vault data)
                console.log('\nTo complete calculation, we need:');
                console.log('- Total LP token supply (from vault contract)');
                console.log('- LP token decimals (should be 6)');
                console.log('- Price per LP token = Total USD value / Total supply');
            } else {
                console.log('❌ Missing prices for underlying tokens');
            }
        } else {
            console.log('❌ Vault missing required data');
        }

        // Step 3: Check what calculateLpIntrinsicValue actually does
        console.log('\n=== STEP 3: FUNCTION SOURCE ANALYSIS ===');
        console.log('The calculateLpIntrinsicValue function likely:');
        console.log('1. Finds the vault by contractId');
        console.log('2. Checks if it has tokenA, tokenB, reserves, decimals');
        console.log('3. Looks up prices for tokenA and tokenB');
        console.log('4. Gets total LP token supply from contract');
        console.log('5. Calculates intrinsic value');
        console.log('\nThe null return suggests one of these steps is failing.');
        
        // Step 4: Direct function inspection
        console.log('\n=== STEP 4: DIRECT FUNCTION TEST ===');
        try {
            // Import and test directly with detailed logging
            const { calculateLpIntrinsicValue } = await import('@/lib/pricing/lp-token-calculator');
            
            console.log('Calling calculateLpIntrinsicValue...');
            const result = await calculateLpIntrinsicValue(dmgHootId, currentPrices);
            console.log(`Result: ${result ? JSON.stringify(result, null, 2) : 'null'}`);
            
        } catch (error) {
            console.error('Function call failed:');
            console.error(error instanceof Error ? error.message : error);
            console.error('Stack trace:', error);
        }

    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        console.error('Full error:', error);
    }
}

// Run the script
main().catch(console.error);
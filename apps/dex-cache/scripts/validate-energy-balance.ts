#!/usr/bin/env ts-node

import { callReadOnlyFunction } from '@repo/polyglot';
import { principalCV } from '@stacks/transactions';
import { calculateRealTimeEnergyStatus } from '../src/lib/energy/real-time';
import { kv } from '@vercel/kv';

/**
 * Validate energy balance for a specific user
 * This script checks multiple sources to debug energy balance discrepancies
 */

async function validateEnergyBalance() {
    // Default to a test address, or get from environment
    const userAddress = process.env.USER_ADDRESS || 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';

    console.log(`🔍 Validating energy balance for: ${userAddress}\n`);

    try {
        // 1. Direct blockchain call to energy token contract
        console.log('📞 1. Direct blockchain call to energy contract...');
        const energyBalance = await callReadOnlyFunction(
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
            'energy',
            'get-balance',
            [principalCV(userAddress)]
        );
        console.log(`   Raw balance: ${JSON.stringify(energyBalance)}`);
        
        // Handle both direct numbers and Clarity response objects
        let energyBalanceNumber = 0;
        if (typeof energyBalance === 'object' && energyBalance !== null && 'value' in energyBalance) {
            energyBalanceNumber = Number(energyBalance.value) || 0;
        } else {
            energyBalanceNumber = Number(energyBalance) || 0;
        }
        
        console.log(`   Converted: ${energyBalanceNumber} micro-units`);
        console.log(`   Human readable: ${(energyBalanceNumber / 1000000).toFixed(6)} Energy\n`);

        // 2. Check power-cells max capacity
        console.log('🔋 2. Checking max capacity from power-cells...');
        try {
            const maxCapacity = await callReadOnlyFunction(
                'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
                'power-cells',
                'get-max-capacity',
                [principalCV(userAddress)]
            );
            const maxCapacityNumber = Number(maxCapacity) || 100000000;
            console.log(`   Raw capacity: ${maxCapacity}`);
            console.log(`   Converted: ${maxCapacityNumber} micro-units`);
            console.log(`   Human readable: ${(maxCapacityNumber / 1000000).toFixed(6)} Energy\n`);
        } catch (error) {
            console.log(`   ❌ Error getting max capacity: ${error}`);
            console.log(`   Using default: 100 Energy\n`);
        }

        // 3. Check if user has any token holdings that generate energy
        console.log('💰 3. Checking token holdings...');
        const tokenContracts = [
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-pool-v1',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-flow-v2',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.perseverantia-omnia-vincit-v2'
        ];

        for (const contract of tokenContracts) {
            try {
                const [contractAddress, contractName] = contract.split('.');
                const balance = await callReadOnlyFunction(
                    contractAddress,
                    contractName,
                    'get-balance',
                    [principalCV(userAddress)]
                );
                const balanceNumber = Number(balance) || 0;
                console.log(`   ${contractName}: ${balanceNumber} units (${(balanceNumber / 1000000).toFixed(6)})`);
            } catch (error) {
                console.log(`   ${contract}: Error - ${error}`);
            }
        }
        console.log();

        // 4. Get real-time energy status calculation
        console.log('⚡ 4. Real-time energy status calculation...');
        const realTimeStatus = await calculateRealTimeEnergyStatus(userAddress);
        console.log('   Full real-time status:');
        console.log(`   - currentEnergyBalance: ${realTimeStatus.currentEnergyBalance} (${(realTimeStatus.currentEnergyBalance / 1000000).toFixed(6)} Energy)`);
        console.log(`   - accumulatedSinceLastHarvest: ${realTimeStatus.accumulatedSinceLastHarvest} (${(realTimeStatus.accumulatedSinceLastHarvest / 1000000).toFixed(6)} Energy)`);
        console.log(`   - totalHarvestableEnergy: ${realTimeStatus.totalHarvestableEnergy} (${(realTimeStatus.totalHarvestableEnergy / 1000000).toFixed(6)} Energy)`);
        console.log(`   - energyRatePerSecond: ${realTimeStatus.energyRatePerSecond} (${(realTimeStatus.energyRatePerSecond / 1000000).toFixed(6)} Energy/sec)`);
        console.log(`   - maxCapacity: ${realTimeStatus.maxCapacity} (${(realTimeStatus.maxCapacity / 1000000).toFixed(6)} Energy)`);
        console.log(`   - capacityPercentage: ${realTimeStatus.capacityPercentage.toFixed(2)}%`);
        console.log(`   - capacityStatus: ${realTimeStatus.capacityStatus}`);
        console.log(`   - lastHarvestTimestamp: ${new Date(realTimeStatus.lastHarvestTimestamp).toISOString()}`);
        console.log(`   - timeSinceLastHarvest: ${realTimeStatus.timeSinceLastHarvest} seconds`);
        console.log(`   - dataQuality: ${realTimeStatus.dataQuality}`);
        console.log(`   - isHarvestNeeded: ${realTimeStatus.isHarvestNeeded}`);
        console.log();

        // 5. Check KV cache data
        console.log('💾 5. Checking KV cache data...');
        const analyticsKey = 'energy:analytics:SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dexterity-hold-to-earn';
        const analyticsData = await kv.get(analyticsKey);
        if (analyticsData) {
            console.log(`   ✅ Analytics data found in cache`);
            console.log(`   - Cache key: ${analyticsKey}`);
            // @ts-ignore
            console.log(`   - Logs count: ${analyticsData.logs?.length || 0}`);
            // @ts-ignore
            console.log(`   - Last updated: ${analyticsData.lastUpdated ? new Date(analyticsData.lastUpdated).toISOString() : 'Unknown'}`);
        } else {
            console.log(`   ❌ No analytics data found in cache`);
        }
        console.log();

        // 6. Comparison and analysis
        console.log('🔬 6. Analysis...');
        const directBalance = energyBalanceNumber;
        const realTimeBalance = realTimeStatus.currentEnergyBalance;

        if (directBalance !== realTimeBalance) {
            console.log(`   ⚠️  DISCREPANCY DETECTED!`);
            console.log(`   - Direct blockchain call: ${directBalance}`);
            console.log(`   - Real-time calculation: ${realTimeBalance}`);
            console.log(`   - Difference: ${directBalance - realTimeBalance}`);
        } else {
            console.log(`   ✅ Balance values match: ${directBalance} micro-units`);
        }

        if (realTimeStatus.currentEnergyBalance === 0 && realTimeStatus.accumulatedSinceLastHarvest > 0) {
            console.log(`   🎯 User has 0 spendable energy but ${(realTimeStatus.accumulatedSinceLastHarvest / 1000000).toFixed(6)} Energy ready to harvest`);
        }

        if (realTimeStatus.energyRatePerSecond === 0) {
            console.log(`   ⚠️  User has 0 energy generation rate - check token holdings`);
        }

        console.log('\n🏁 Validation complete!');

    } catch (error) {
        console.error('❌ Validation failed:', error);
        process.exit(1);
    }
}

// Run the validation
validateEnergyBalance().catch(console.error);

export { validateEnergyBalance };
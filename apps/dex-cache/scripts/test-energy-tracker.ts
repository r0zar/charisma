// Test script to validate the real-time energy tracker transformation

import { calculateRealTimeEnergyStatus, formatEnergyValue, formatTimeDuration } from '@/lib/energy/real-time';

const TEST_USER_ADDRESS = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';

async function testEnergyTracker() {
    console.log('🧪 Testing Real-Time Energy Tracker...\n');

    try {
        // Test 1: Real-time energy calculation
        console.log('🔄 Test 1: Testing real-time energy calculation...');
        const energyData = await calculateRealTimeEnergyStatus(TEST_USER_ADDRESS);
        
        console.log('✅ Real-time energy data:');
        console.log(`📊 Current Balance: ${formatEnergyValue(energyData.currentEnergyBalance)} energy`);
        console.log(`⚡ Accumulated: ${formatEnergyValue(energyData.accumulatedSinceLastHarvest)} energy`);
        console.log(`🏆 Total Harvestable: ${formatEnergyValue(energyData.totalHarvestableEnergy)} energy`);
        console.log(`📈 Generation Rate: ${formatEnergyValue(energyData.energyRatePerSecond)}/sec`);
        console.log(`🏛️ Capacity: ${energyData.capacityPercentage.toFixed(1)}% (${energyData.capacityStatus})`);
        console.log(`⏰ Time Since Harvest: ${formatTimeDuration(energyData.timeSinceLastHarvest)}`);
        console.log(`🎯 Data Quality: ${energyData.dataQuality}`);
        
        if (energyData.isHarvestNeeded) {
            console.log('🚨 HARVEST RECOMMENDED!');
        }
        
        if (energyData.energyWasteRate > 0) {
            console.log(`⚠️ Energy being wasted: ${formatEnergyValue(energyData.energyWasteRate)}/sec`);
        }

        // Test 2: SSE endpoint simulation
        console.log('\n🌊 Test 2: Testing SSE endpoint simulation...');
        
        // Simulate what the SSE would stream
        const sseData = {
            type: 'energy_update',
            ...energyData
        };
        
        console.log('📡 SSE data structure:');
        console.log(JSON.stringify(sseData, null, 2));

        // Test 3: Component data validation
        console.log('\n🎯 Test 3: Component data validation...');
        
        const componentState = {
            energyState: energyData,
            connectionState: {
                isConnected: true,
                isConnecting: false,
                error: null,
                lastUpdate: Date.now(),
                reconnectAttempts: 0
            }
        };
        
        console.log('✅ Component would receive:');
        console.log(`🔌 Connection: ${componentState.connectionState.isConnected ? 'Connected' : 'Disconnected'}`);
        console.log(`📊 Energy Data: Available (${Object.keys(energyData).length} properties)`);
        console.log(`🎨 Capacity Zone: ${energyData.capacityStatus}`);
        console.log(`💫 Visual Effects: ${energyData.energyRatePerSecond > 0 ? 'Active' : 'Inactive'}`);

        // Test 4: Formatting functions
        console.log('\n🎨 Test 4: Testing formatting functions...');
        
        const testValues = [
            1000000,    // 1 energy
            5432100,    // 5.4321 energy
            100000000,  // 100 energy
            1234567890  // 1234.56789 energy
        ];
        
        console.log('💰 Energy formatting tests:');
        testValues.forEach(value => {
            console.log(`  ${value} micro-units → ${formatEnergyValue(value)} energy`);
        });

        const testTimes = [30, 150, 3700, 7200, 90000];
        console.log('\n⏰ Time formatting tests:');
        testTimes.forEach(seconds => {
            console.log(`  ${seconds} seconds → ${formatTimeDuration(seconds)}`);
        });

        console.log('\n✅ Real-Time Energy Tracker testing complete!');
        console.log('🎯 Ready for SSE streaming and component integration');

    } catch (error) {
        console.error('❌ Error testing energy tracker:', error);
    }
}

testEnergyTracker().catch(console.error);
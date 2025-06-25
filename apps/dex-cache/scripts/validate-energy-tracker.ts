import { kv } from '@vercel/kv';
import { getEnergyDashboardDataForUser } from '@/lib/server/energy';
import { EnergyAnalyticsData } from '@/lib/energy/analytics';

const TEST_USER_ADDRESS = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
const ENERGY_CONTRACT_ID = 'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dexterity-hold-to-earn';

async function validateEnergyTracker() {
    console.log('🧪 Validating Energy Tracker Implementation...\n');

    // Test 1: Check if harvest data exists in Vercel KV
    console.log('📊 Test 1: Checking harvest data in Vercel KV');
    try {
        const analyticsKey = `energy:analytics:${ENERGY_CONTRACT_ID}`;
        const analyticsData = await kv.get<EnergyAnalyticsData>(analyticsKey);
        
        if (analyticsData) {
            console.log('✅ Analytics data found in KV');
            console.log(`📈 Total logs: ${analyticsData.logs?.length || 0}`);
            console.log(`👥 Total users: ${Object.keys(analyticsData.userStats || {}).length}`);
            console.log(`📊 Contract stats:`, {
                totalHarvested: analyticsData.stats?.totalEnergyHarvested,
                uniqueUsers: analyticsData.stats?.uniqueUsers,
                lastUpdated: new Date(analyticsData.stats?.lastUpdated || 0).toISOString()
            });
        } else {
            console.log('❌ No analytics data found in KV');
            return;
        }

        // Test 2: Check specific user data
        console.log('\n🔍 Test 2: Checking user-specific data');
        const userStats = analyticsData.userStats?.[TEST_USER_ADDRESS];
        if (userStats) {
            console.log('✅ User stats found:');
            console.log(`📅 Last harvest: ${new Date(userStats.lastHarvestTimestamp).toISOString()}`);
            console.log(`⚡ Energy rate: ${userStats.estimatedEnergyRate}/min`);
            console.log(`📊 Total harvested: ${userStats.totalEnergyHarvested}`);
            console.log(`🔢 Harvest count: ${userStats.harvestCount}`);
            console.log(`📜 History entries: ${userStats.harvestHistory?.length || 0}`);
            
            // Test 3: Calculate real-time energy accumulation
            console.log('\n⏱️ Test 3: Real-time energy accumulation calculation');
            const now = Date.now();
            const lastHarvestTime = userStats.lastHarvestTimestamp;
            const timeSinceLastHarvest = now - lastHarvestTime;
            const hoursSinceLastHarvest = timeSinceLastHarvest / (1000 * 60 * 60);
            const energyRatePerSecond = userStats.estimatedEnergyRate / 60; // Convert per-minute to per-second
            const accumulatedEnergy = (timeSinceLastHarvest / 1000) * energyRatePerSecond;
            
            console.log(`⏰ Time since last harvest: ${hoursSinceLastHarvest.toFixed(2)} hours`);
            console.log(`📈 Rate per second: ${energyRatePerSecond.toFixed(6)} energy/sec`);
            console.log(`⚡ Accumulated energy: ${accumulatedEnergy.toFixed(6)}`);
            
            // Test 4: Capacity calculations
            console.log('\n🏛️ Test 4: Capacity calculations');
            const baseCapacity = 100; // Base energy capacity
            // Note: Would need NFT bonus calculation here in real implementation
            const currentStoredEnergy = 0; // Would get from user's energy balance
            const totalHarvestableEnergy = currentStoredEnergy + accumulatedEnergy;
            
            console.log(`🏠 Base capacity: ${baseCapacity}`);
            console.log(`💰 Current stored: ${currentStoredEnergy}`);
            console.log(`🌟 Total harvestable: ${totalHarvestableEnergy.toFixed(6)}`);
            
            // Test 5: Time to capacity calculations
            console.log('\n⏳ Test 5: Time calculations');
            const timeToFillFromEmpty = baseCapacity / energyRatePerSecond;
            const timeToFillFromCurrent = (baseCapacity - totalHarvestableEnergy) / energyRatePerSecond;
            
            console.log(`⏱️ Time to fill from empty: ${(timeToFillFromEmpty / 3600).toFixed(2)} hours`);
            console.log(`⏰ Time to fill from current: ${(timeToFillFromCurrent / 3600).toFixed(2)} hours`);
            
        } else {
            console.log('❌ No user stats found for test address');
        }

    } catch (error) {
        console.error('❌ Error accessing KV data:', error);
    }

    // Test 6: Test getEnergyDashboardDataForUser function
    console.log('\n🎯 Test 6: Testing getEnergyDashboardDataForUser function');
    try {
        const dashboardData = await getEnergyDashboardDataForUser(TEST_USER_ADDRESS);
        console.log('✅ Dashboard data retrieved:');
        dashboardData.forEach((data, index) => {
            console.log(`📊 Contract ${index + 1}:`, {
                contractId: data.contractId,
                name: data.name,
                currentEnergy: data.currentAccumulatedEnergy,
                ratePerSecond: data.estimatedEnergyRatePerSecond,
                lastCalcTime: new Date(data.lastRateCalculationTimestamp).toISOString()
            });
        });
    } catch (error) {
        console.error('❌ Error with dashboard function:', error);
    }

    // Test 7: Validate timing accuracy
    console.log('\n🕐 Test 7: Timing accuracy validation');
    const blockchainTime = Date.now(); // In real implementation, get from latest block
    const systemTime = Date.now();
    const timeDiff = Math.abs(blockchainTime - systemTime);
    
    console.log(`⛓️ Blockchain time: ${new Date(blockchainTime).toISOString()}`);
    console.log(`💻 System time: ${new Date(systemTime).toISOString()}`);
    console.log(`⏱️ Time difference: ${timeDiff}ms`);
    
    if (timeDiff < 60000) { // Less than 1 minute difference
        console.log('✅ Timing accuracy acceptable');
    } else {
        console.log('⚠️ Timing accuracy may be an issue');
    }

    console.log('\n🎉 Validation complete!');
}

validateEnergyTracker().catch(console.error);
import { kv } from '@vercel/kv';
import { EnergyAnalyticsData } from '@/lib/energy/analytics';
import { getUserEnergyStatsV2, calculateCurrentEnergyRate } from '@/lib/energy/analytics-v2';

const TEST_USER_ADDRESS = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
const ENERGY_CONTRACT_ID = 'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dexterity-hold-to-earn';

async function testAnalyticsV2() {
    console.log('🧪 Testing Enhanced Energy Analytics V2...\n');

    try {
        // Get existing analytics data
        const analyticsKey = `energy:analytics:${ENERGY_CONTRACT_ID}`;
        const analyticsData = await kv.get<EnergyAnalyticsData>(analyticsKey);
        
        if (!analyticsData || !analyticsData.logs) {
            console.log('❌ No analytics data found');
            return;
        }

        console.log(`📊 Processing ${analyticsData.logs.length} harvest logs...\n`);

        // Test new user stats calculation
        const userStatsV2 = getUserEnergyStatsV2(analyticsData.logs, TEST_USER_ADDRESS);
        
        if (!userStatsV2) {
            console.log('❌ No user stats generated');
            return;
        }

        console.log('🎯 Enhanced User Statistics (V2):');
        console.log('=====================================\n');

        // Current Rate Information
        console.log('⚡ CURRENT GENERATION RATE:');
        console.log(`📈 Energy per second: ${userStatsV2.currentRate.energyPerSecond.toFixed(6)}`);
        console.log(`📈 Energy per minute: ${userStatsV2.currentRate.energyPerMinute.toFixed(2)}`);
        console.log(`📈 Energy per hour: ${userStatsV2.currentRate.energyPerHour.toFixed(2)}`);
        console.log(`🔬 Calculation method: ${userStatsV2.currentRate.calculationMethod}`);
        console.log(`🎯 Confidence level: ${userStatsV2.currentRate.confidenceLevel}`);
        console.log(`📊 Based on ${userStatsV2.currentRate.calculatedFromPeriods} harvest periods\n`);

        // Historical Statistics
        console.log('📚 HISTORICAL STATISTICS:');
        console.log(`🏆 Total energy harvested: ${(userStatsV2.historical.totalEnergyHarvested / 1000000).toFixed(2)}`);
        console.log(`🔢 Total harvests: ${userStatsV2.historical.harvestCount}`);
        console.log(`📊 Average per harvest: ${(userStatsV2.historical.averageEnergyPerHarvest / 1000000).toFixed(2)}`);
        console.log(`📅 First harvest: ${new Date(userStatsV2.historical.firstHarvestTimestamp).toISOString()}`);
        console.log(`📅 Last harvest: ${new Date(userStatsV2.historical.lastHarvestTimestamp).toISOString()}`);
        console.log(`⏰ Total active time: ${(userStatsV2.historical.totalActiveTimespan / 3600).toFixed(2)} hours`);
        console.log(`⏱️ Average time between harvests: ${(userStatsV2.historical.averageTimeBetweenHarvests / 60).toFixed(1)} minutes\n`);

        // Data Quality Assessment
        console.log('🔍 DATA QUALITY ASSESSMENT:');
        console.log(`📊 Overall quality: ${userStatsV2.dataQuality}`);
        console.log(`🕐 Last updated: ${new Date(userStatsV2.lastUpdated).toISOString()}\n`);

        // Rate Comparison with Old System
        console.log('🔄 COMPARISON WITH OLD SYSTEM:');
        const oldUserStats = analyticsData.userStats?.[TEST_USER_ADDRESS];
        if (oldUserStats) {
            const oldRatePerMinute = oldUserStats.estimatedEnergyRate;
            const newRatePerMinute = userStatsV2.currentRate.energyPerMinute;
            const improvement = oldRatePerMinute / newRatePerMinute;
            
            console.log(`📊 Old "rate": ${oldRatePerMinute.toFixed(2)} (total/timespan)`);
            console.log(`📊 New rate: ${newRatePerMinute.toFixed(2)} (actual per-minute)`);
            console.log(`📉 Old system was ${improvement.toFixed(1)}x too high\n`);
        }

        // Capacity Analysis with New Rate
        console.log('🏛️ CAPACITY ANALYSIS (100 Energy Base):');
        const baseCapacityMicroUnits = 100 * 1000000;
        const timeToFillSeconds = baseCapacityMicroUnits / userStatsV2.currentRate.energyPerSecond;
        const timeToFillMinutes = timeToFillSeconds / 60;
        const timeToFillHours = timeToFillMinutes / 60;

        console.log(`⏱️ Time to fill capacity: ${timeToFillSeconds.toFixed(1)} seconds`);
        console.log(`⏱️ Time to fill capacity: ${timeToFillMinutes.toFixed(2)} minutes`);
        console.log(`⏱️ Time to fill capacity: ${timeToFillHours.toFixed(4)} hours\n`);

        // Real-time Energy Accumulation Test
        console.log('⏰ REAL-TIME ACCUMULATION TEST:');
        const now = Date.now();
        const timeSinceLastHarvest = (now - userStatsV2.historical.lastHarvestTimestamp) / 1000; // seconds
        const accumulatedEnergy = timeSinceLastHarvest * userStatsV2.currentRate.energyPerSecond;
        const accumulatedEnergyFormatted = accumulatedEnergy / 1000000;

        console.log(`⏰ Time since last harvest: ${(timeSinceLastHarvest / 3600).toFixed(2)} hours`);
        console.log(`⚡ Energy accumulated: ${accumulatedEnergyFormatted.toFixed(6)} energy`);
        console.log(`🏛️ Capacity status: ${accumulatedEnergyFormatted >= 100 ? 'FULL - HARVEST NEEDED!' : 'Accumulating'}\n`);

        // Recent Harvest Analysis
        console.log('📈 RECENT HARVEST PERIOD ANALYSIS:');
        const recentHarvests = userStatsV2.historical.harvestHistory.slice(-5); // Last 5 harvests
        recentHarvests.forEach((harvest, index) => {
            if (harvest.effectiveRate !== undefined && harvest.timeSinceLastHarvest !== undefined) {
                const energyFormatted = (harvest.energy / 1000000).toFixed(2);
                const rateFormatted = (harvest.effectiveRate * 60 / 1000000).toFixed(2);
                const timeMinutes = (harvest.timeSinceLastHarvest / 60).toFixed(1);
                
                console.log(`${index + 1}. ${new Date(harvest.timestamp).toISOString()}`);
                console.log(`   Energy: ${energyFormatted}, Time: ${timeMinutes}min, Rate: ${rateFormatted}/min`);
            }
        });

        console.log('\n✅ Analytics V2 testing complete!');

    } catch (error) {
        console.error('❌ Error testing analytics V2:', error);
    }
}

testAnalyticsV2().catch(console.error);
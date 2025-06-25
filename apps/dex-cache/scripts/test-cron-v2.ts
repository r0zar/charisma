import { runEnergyDataProcessingForAllContracts } from '@/lib/server/energy';
import { kv } from '@vercel/kv';
import { EnergyAnalyticsData } from '@/lib/energy/analytics';

const TEST_USER_ADDRESS = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
const ENERGY_CONTRACT_ID = 'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dexterity-hold-to-earn';

async function testCronV2() {
    console.log('🧪 Testing Enhanced Cron System V2...\n');

    try {
        // Test 1: Run the enhanced cron processing
        console.log('🔄 Test 1: Running enhanced energy data processing...');
        const processingResult = await runEnergyDataProcessingForAllContracts();
        
        console.log('✅ Processing result:');
        console.log(`📊 Success: ${processingResult.success}`);
        console.log(`⏰ Duration: ${processingResult.duration}ms`);
        console.log(`📈 Processed contracts: ${processingResult.results.length}`);
        
        processingResult.results.forEach((result, index) => {
            console.log(`${index + 1}. ${result.contractId}: ${result.success ? '✅' : '❌'} ${result.logsCount ? `(${result.logsCount} logs)` : ''}`);
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
        });

        // Test 2: Verify the updated data in KV
        console.log('\n🔍 Test 2: Verifying updated data in KV...');
        const analyticsKey = `energy:analytics:${ENERGY_CONTRACT_ID}`;
        const analyticsData = await kv.get<EnergyAnalyticsData>(analyticsKey);
        
        if (analyticsData) {
            console.log('✅ Analytics data found in KV');
            console.log(`📈 Total logs: ${analyticsData.logs?.length || 0}`);
            console.log(`👥 Total users: ${Object.keys(analyticsData.userStats || {}).length}`);
            
            // Test 3: Check if user rates are now corrected
            console.log('\n⚡ Test 3: Checking corrected user rates...');
            const userStats = analyticsData.userStats?.[TEST_USER_ADDRESS];
            if (userStats) {
                console.log('✅ User stats found:');
                console.log(`📈 Energy rate (corrected): ${userStats.estimatedEnergyRate.toFixed(2)}/min`);
                console.log(`📊 Total harvested: ${(userStats.totalEnergyHarvested / 1000000).toFixed(2)} energy`);
                console.log(`🔢 Harvest count: ${userStats.harvestCount}`);
                console.log(`📅 Last harvest: ${new Date(userStats.lastHarvestTimestamp).toISOString()}`);
                
                // Calculate capacity fill time with corrected rate
                const energyRatePerSecond = userStats.estimatedEnergyRate / 60;
                const baseCapacity = 100 * 1000000; // 100 energy in micro-units
                const timeToFillSeconds = baseCapacity / energyRatePerSecond;
                
                console.log(`\n🏛️ Capacity Analysis (with corrected rates):`);
                console.log(`⏱️ Time to fill 100 energy: ${timeToFillSeconds.toFixed(1)} seconds`);
                console.log(`⏱️ Time to fill capacity: ${(timeToFillSeconds / 60).toFixed(2)} minutes`);
                
                if (timeToFillSeconds < 60) {
                    console.log('⚠️ Very fast capacity fill - great for harvesting!');
                } else if (timeToFillSeconds < 3600) {
                    console.log('✅ Reasonable capacity fill time');
                } else {
                    console.log('⏰ Slow capacity fill - might want to check rates');
                }
                
                // Test 4: Real-time accumulation with corrected rates
                console.log('\n⏰ Test 4: Real-time accumulation calculation...');
                const now = Date.now();
                const timeSinceLastHarvest = (now - userStats.lastHarvestTimestamp) / 1000; // seconds
                const accumulatedEnergy = timeSinceLastHarvest * energyRatePerSecond;
                const accumulatedEnergyFormatted = accumulatedEnergy / 1000000;
                
                console.log(`⏰ Time since last harvest: ${(timeSinceLastHarvest / 3600).toFixed(2)} hours`);
                console.log(`⚡ Energy accumulated: ${accumulatedEnergyFormatted.toFixed(6)} energy`);
                console.log(`🏛️ Capacity status: ${accumulatedEnergyFormatted >= 100 ? 'FULL - HARVEST NEEDED!' : 'Accumulating'}`);
                
            } else {
                console.log('❌ No user stats found for test address');
            }
            
            // Test 5: Contract-wide statistics
            console.log('\n📊 Test 5: Contract-wide statistics...');
            if (analyticsData.stats) {
                console.log(`🏆 Total energy harvested: ${(analyticsData.stats.totalEnergyHarvested / 1000000).toFixed(2)}`);
                console.log(`👥 Unique users: ${analyticsData.stats.uniqueUsers}`);
                console.log(`📈 Average per harvest: ${(analyticsData.stats.averageEnergyPerHarvest / 1000000).toFixed(2)}`);
                console.log(`📅 Last updated: ${new Date(analyticsData.stats.lastUpdated).toISOString()}`);
            }
            
            if (analyticsData.rates) {
                console.log(`🔥 Overall rate: ${(analyticsData.rates.overallEnergyPerMinute / 1000000).toFixed(2)}/min`);
                console.log(`🏆 Top user rates: ${analyticsData.rates.topUserRates.length} users`);
            }
            
        } else {
            console.log('❌ No analytics data found in KV after processing');
        }

        // Test 6: Cron status verification
        console.log('\n📊 Test 6: Cron status verification...');
        const lastRunTime = await kv.get<number>('energy:cron:last_run');
        if (lastRunTime) {
            console.log(`✅ Last cron run: ${new Date(lastRunTime).toISOString()}`);
            console.log(`⏰ Minutes ago: ${((Date.now() - lastRunTime) / 1000 / 60).toFixed(1)}`);
        } else {
            console.log('❌ No cron run timestamp found');
        }

        console.log('\n✅ Enhanced Cron V2 testing complete!');
        console.log('🎯 The system now uses corrected rate calculations from analytics-v2');

    } catch (error) {
        console.error('❌ Error testing enhanced cron V2:', error);
    }
}

testCronV2().catch(console.error);
import { kv } from '@vercel/kv';
import { EnergyAnalyticsData } from '@/lib/energy/analytics';

const TEST_USER_ADDRESS = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
const ENERGY_CONTRACT_ID = 'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dexterity-hold-to-earn';

async function analyzeEnergyRate() {
    console.log('🔍 Analyzing Energy Generation Rate...\n');

    try {
        const analyticsKey = `energy:analytics:${ENERGY_CONTRACT_ID}`;
        const analyticsData = await kv.get<EnergyAnalyticsData>(analyticsKey);
        
        if (!analyticsData || !analyticsData.logs) {
            console.log('❌ No analytics data found');
            return;
        }

        const userLogs = analyticsData.logs
            .filter(log => log.sender === TEST_USER_ADDRESS)
            .sort((a, b) => (a.block_time || 0) - (b.block_time || 0)); // Sort by time ascending

        console.log(`📊 Found ${userLogs.length} harvest logs for user\n`);

        // Analyze individual harvests
        console.log('🏥 Individual Harvest Analysis:');
        userLogs.forEach((log, index) => {
            const date = new Date((log.block_time || 0) * 1000);
            const energyFormatted = (log.energy / 1000000).toFixed(2); // Convert from micro-units
            console.log(`${index + 1}. ${date.toISOString()} - ${energyFormatted} energy`);
        });

        // Calculate actual rate between harvests
        console.log('\n⏱️ Time-based Rate Analysis:');
        for (let i = 1; i < userLogs.length; i++) {
            const prevHarvest = userLogs[i - 1];
            const currentHarvest = userLogs[i];
            
            const timeDiff = (currentHarvest.block_time || 0) - (prevHarvest.block_time || 0); // seconds
            const energyDiff = currentHarvest.energy; // energy accumulated in this period
            
            if (timeDiff > 0) {
                const ratePerSecond = energyDiff / timeDiff;
                const ratePerMinute = ratePerSecond * 60;
                const ratePerHour = ratePerMinute * 60;
                
                const timeFormatted = (timeDiff / 60).toFixed(1); // minutes
                const energyFormatted = (energyDiff / 1000000).toFixed(2);
                const ratePerSecFormatted = (ratePerSecond / 1000000).toFixed(6);
                const ratePerMinFormatted = (ratePerMinute / 1000000).toFixed(2);
                
                console.log(`📈 Period ${i}: ${timeFormatted}min → ${energyFormatted} energy`);
                console.log(`   Rate: ${ratePerSecFormatted}/sec, ${ratePerMinFormatted}/min`);
            }
        }

        // Calculate average rate
        if (userLogs.length >= 2) {
            console.log('\n📊 Average Rate Calculation:');
            const firstHarvest = userLogs[0];
            const lastHarvest = userLogs[userLogs.length - 1];
            
            const totalTime = (lastHarvest.block_time || 0) - (firstHarvest.block_time || 0);
            const totalEnergy = userLogs.reduce((sum, log) => sum + log.energy, 0);
            
            if (totalTime > 0) {
                const avgRatePerSecond = totalEnergy / totalTime;
                const avgRatePerMinute = avgRatePerSecond * 60;
                const avgRatePerHour = avgRatePerMinute * 60;
                
                console.log(`⏰ Total time span: ${(totalTime / 3600).toFixed(2)} hours`);
                console.log(`⚡ Total energy: ${(totalEnergy / 1000000).toFixed(2)}`);
                console.log(`📈 Average rate: ${(avgRatePerSecond / 1000000).toFixed(6)}/sec`);
                console.log(`📈 Average rate: ${(avgRatePerMinute / 1000000).toFixed(2)}/min`);
                console.log(`📈 Average rate: ${(avgRatePerHour / 1000000).toFixed(2)}/hour`);
                
                // Compare with stored rate
                const userStats = analyticsData.userStats?.[TEST_USER_ADDRESS];
                if (userStats) {
                    console.log(`\n🔍 Stored vs Calculated Rate Comparison:`);
                    console.log(`📊 Stored rate: ${userStats.estimatedEnergyRate}`);
                    console.log(`📊 Calculated rate/min: ${(avgRatePerMinute).toFixed(2)}`);
                    console.log(`📊 Ratio: ${(userStats.estimatedEnergyRate / avgRatePerMinute).toFixed(2)}x`);
                    
                    if (userStats.estimatedEnergyRate === userStats.totalEnergyHarvested) {
                        console.log('⚠️ The stored "rate" appears to be total harvested, not a rate!');
                    }
                }
                
                // Calculate capacity implications
                console.log('\n🏛️ Capacity Analysis:');
                const baseCapacity = 100 * 1000000; // 100 energy in micro-units
                const timeToFillCapacity = baseCapacity / avgRatePerSecond;
                
                console.log(`⏱️ Time to fill 100 energy capacity: ${timeToFillCapacity.toFixed(2)} seconds`);
                console.log(`⏱️ Time to fill capacity: ${(timeToFillCapacity / 60).toFixed(2)} minutes`);
                
                if (timeToFillCapacity < 60) {
                    console.log('⚠️ Capacity fills in under 1 minute - very frequent harvesting needed!');
                } else if (timeToFillCapacity < 3600) {
                    console.log('⚠️ Capacity fills in under 1 hour - frequent harvesting recommended');
                } else {
                    console.log('✅ Reasonable time to fill capacity');
                }
            }
        }

    } catch (error) {
        console.error('❌ Error analyzing energy rate:', error);
    }
}

analyzeEnergyRate().catch(console.error);
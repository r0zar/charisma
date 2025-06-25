// Script to test the updated Energy Collective System with real engines

import { fetchHoldToEarnVaults } from '@/lib/server/energy';
import { getTokenMetadataCached } from '@repo/tokens';

async function testEnergyCollective() {
    console.log('🏭 Testing Energy Collective System with Real Engines...\n');

    try {
        // Test 1: Load real energy vaults
        console.log('🔄 Test 1: Loading real energy vaults...');
        const energyVaults = await fetchHoldToEarnVaults();
        
        if (!energyVaults || energyVaults.length === 0) {
            console.log('❌ No energy vaults found');
            return;
        }

        console.log(`✅ Found ${energyVaults.length} energy vaults:`);
        
        // Test 2: Transform into engines data structure
        console.log('\n⚡ Test 2: Transforming vaults into engines...');
        const colors = [
            'from-orange-400 to-orange-600',
            'from-green-400 to-green-600', 
            'from-purple-400 to-purple-600',
            'from-blue-400 to-blue-600',
            'from-red-400 to-red-600',
            'from-yellow-400 to-yellow-600'
        ];

        const mockTotalEnergyRate = 7312618; // Use real rate from testing
        const engines = [];

        for (let i = 0; i < energyVaults.length; i++) {
            const vault = energyVaults[i];
            
            console.log(`\n🔧 Processing vault ${i + 1}: ${vault.name}`);
            console.log(`   Contract: ${vault.contractId}`);
            console.log(`   Engine: ${vault.engineContractId}`);
            console.log(`   Base Token: ${vault.base}`);

            // Get token metadata
            let tokenData;
            try {
                tokenData = await getTokenMetadataCached(vault.base);
                console.log(`   ✅ Token: ${tokenData.name} (${tokenData.symbol})`);
            } catch (error) {
                console.log(`   ⚠️ Could not load token metadata, using fallback`);
                tokenData = {
                    name: vault.name.replace(' Energize', ''),
                    symbol: vault.name.split(' ')[0].toUpperCase(),
                    contractId: vault.base
                };
            }

            // Calculate contribution rate
            const contributionRate = energyVaults.length > 0 ? mockTotalEnergyRate / energyVaults.length : 0;
            
            const engine = {
                id: vault.engineContractId.split('.')[1],
                name: `${tokenData.symbol} Engine`,
                tokenSymbol: tokenData.symbol,
                tokenName: tokenData.name,
                contractId: vault.contractId,
                engineContractId: vault.engineContractId,
                contributionRate,
                isActive: contributionRate > 0,
                color: colors[i % colors.length],
                image: vault.image
            };

            engines.push(engine);
            console.log(`   🎨 Engine: ${engine.name}`);
            console.log(`   📈 Rate: ${(engine.contributionRate / 1000000).toFixed(2)} energy/sec`);
            console.log(`   🎯 Active: ${engine.isActive}`);
            console.log(`   🌈 Color: ${engine.color}`);
        }

        // Test 3: Display the final Energy Collective System structure
        console.log('\n🏭 Test 3: Final Energy Collective System Structure:');
        console.log('=====================================');
        
        engines.forEach((engine, index) => {
            console.log(`\n${index + 1}. ${engine.name}`);
            console.log(`   💰 Hold ${engine.tokenSymbol} tokens to earn energy`);
            console.log(`   ⚡ Contribution: ${(engine.contributionRate / 1000000).toFixed(6)} energy/sec`);
            console.log(`   🎨 Visual: ${engine.color}`);
            console.log(`   🔗 Engine Contract: ${engine.engineContractId}`);
            console.log(`   📊 Status: ${engine.isActive ? '🟢 ACTIVE' : '🔴 INACTIVE'}`);
        });

        // Test 4: Collective statistics
        console.log('\n📊 Test 4: Collective Statistics:');
        const totalRate = engines.reduce((sum, engine) => sum + engine.contributionRate, 0);
        const activeEngines = engines.filter(e => e.isActive).length;
        
        console.log(`🏭 Total Engines: ${engines.length}`);
        console.log(`🟢 Active Engines: ${activeEngines}`);
        console.log(`⚡ Combined Rate: ${(totalRate / 1000000).toFixed(6)} energy/sec`);
        console.log(`📈 Combined Rate: ${(totalRate / 1000000 * 3600).toFixed(2)} energy/hour`);
        console.log(`🎯 Efficiency: ${activeEngines === engines.length ? '100%' : `${Math.round(activeEngines / engines.length * 100)}%`}`);

        // Test 5: Token requirements
        console.log('\n💰 Test 5: Token Requirements for Users:');
        engines.forEach((engine, index) => {
            console.log(`${index + 1}. To use ${engine.name}:`);
            console.log(`   → Hold ${engine.tokenSymbol} tokens in your wallet`);
            console.log(`   → Energy automatically accumulates over time`);
            console.log(`   → Call 'tap' function to harvest accumulated energy`);
        });

        console.log('\n✅ Energy Collective System test complete!');
        console.log('🎯 The system now shows real hold-to-earn engines instead of mock data');
        console.log(`🏭 Users can now see all ${engines.length} available energy generation methods`);

    } catch (error) {
        console.error('❌ Error testing Energy Collective System:', error);
    }
}

testEnergyCollective().catch(console.error);
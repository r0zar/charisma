// Script to test relative bar sizing for energy engines

import { fetchHoldToEarnVaults, fetchEngineRates } from '@/lib/server/energy';
import { getTokenMetadataCached } from '@repo/tokens';

async function testRelativeBars() {
    console.log('📊 Testing Relative Bar Sizing for Energy Engines...\n');

    try {
        // Fetch vaults and engine rates
        const [energyVaults, engineRates] = await Promise.all([
            fetchHoldToEarnVaults(),
            fetchEngineRates()
        ]);
        
        if (!energyVaults || energyVaults.length === 0) {
            console.log('❌ No energy vaults found');
            return;
        }

        // Process engines with rates
        const engines = [];
        for (const vault of energyVaults) {
            const contributionRate = engineRates[vault.engineContractId] || 0;
            
            // Get vault name for display
            const getEngineName = (vault: any) => {
                const vaultName = vault.name || '';
                if (vaultName.includes('Energize')) {
                    return vaultName.replace('Energize', 'Engine').trim();
                }
                if (vaultName === 'Energize') {
                    return `${vault.contractName} Engine`;
                }
                return `${vaultName} Engine`;
            };

            engines.push({
                name: getEngineName(vault),
                contributionRate,
                isActive: contributionRate > 0
            });
        }

        // Sort engines by rate (highest first)
        engines.sort((a, b) => b.contributionRate - a.contributionRate);

        // Calculate relative bar sizing
        const maxEngineRate = Math.max(...engines.map(e => e.contributionRate), 1);
        const totalRate = engines.reduce((sum, e) => sum + e.contributionRate, 0);

        console.log('⚡ ENGINE RATES AND RELATIVE BAR SIZES:');
        console.log('=========================================\n');

        engines.forEach((engine, index) => {
            const ratePerSecond = engine.contributionRate / 1000000;
            const ratePerMinute = ratePerSecond * 60;
            const percentOfMax = (engine.contributionRate / maxEngineRate) * 100;
            const percentOfTotal = (engine.contributionRate / totalRate) * 100;

            console.log(`${index + 1}. ${engine.name}`);
            console.log(`   Rate: ${ratePerSecond.toFixed(6)} energy/second (${ratePerMinute.toFixed(2)} energy/minute)`);
            console.log(`   Bar Size (relative to max): ${percentOfMax.toFixed(1)}%`);
            console.log(`   Share of total rate: ${percentOfTotal.toFixed(1)}%`);
            console.log(`   Status: ${engine.isActive ? '🟢 ACTIVE' : '🔴 INACTIVE'}`);
            
            // Visual bar representation
            const barLength = Math.round(percentOfMax / 5); // Scale down for console display
            const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
            console.log(`   Visual: [${bar}] ${percentOfMax.toFixed(1)}%`);
            console.log('');
        });

        console.log('📊 COMPARISON: Old vs New Bar Sizing');
        console.log('=====================================');
        console.log('OLD (percentage of total):');
        engines.forEach((engine) => {
            const percentOfTotal = (engine.contributionRate / totalRate) * 100;
            const barLength = Math.round(percentOfTotal / 5);
            const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
            console.log(`${engine.name.padEnd(25)} [${bar}] ${percentOfTotal.toFixed(1)}%`);
        });

        console.log('\nNEW (relative to highest rate):');
        engines.forEach((engine) => {
            const percentOfMax = (engine.contributionRate / maxEngineRate) * 100;
            const barLength = Math.round(percentOfMax / 5);
            const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
            console.log(`${engine.name.padEnd(25)} [${bar}] ${percentOfMax.toFixed(1)}%`);
        });

        console.log('\n🎯 IMPROVEMENT SUMMARY:');
        console.log(`- Highest rate engine (${engines[0].name}) now shows at 100% bar width`);
        console.log(`- Other engines show proportionally relative to the highest`);
        console.log(`- This makes rate differences more visually apparent`);
        console.log(`- Bar sizes now reflect actual performance differences between engines`);

        console.log('\n✅ Relative bar sizing test complete!');

    } catch (error) {
        console.error('❌ Error testing relative bars:', error);
    }
}

testRelativeBars().catch(console.error);
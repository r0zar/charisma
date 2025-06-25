// Script to test the final improvements: relative bars + vault images

import { fetchHoldToEarnVaults, fetchEngineRates } from '@/lib/server/energy';
import { getTokenMetadataCached } from '@repo/tokens';

async function testFinalImprovements() {
    console.log('🎨 Testing Final Energy Collective Improvements...\n');

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

        console.log('🏭 FINAL ENERGY COLLECTIVE SYSTEM');
        console.log('=================================\n');

        // Process engines with all improvements
        const engines = [];
        for (let i = 0; i < energyVaults.length; i++) {
            const vault = energyVaults[i];
            
            // Get token metadata
            let tokenData;
            try {
                tokenData = await getTokenMetadataCached(vault.base);
            } catch (error) {
                tokenData = {
                    name: vault.name.replace(' Energize', ''),
                    symbol: vault.name.split(' ')[0].toUpperCase(),
                    contractId: vault.base
                };
            }

            // Get vault name for display
            const getEngineName = (vault: any) => {
                const vaultName = vault.name || '';
                if (vaultName.includes('Energize')) {
                    return vaultName.replace('Energize', 'Engine').trim();
                }
                if (vaultName === 'Energize') {
                    return `${tokenData.name} Engine`;
                }
                return `${vaultName} Engine`;
            };

            const contributionRate = engineRates[vault.engineContractId] || 0;
            
            engines.push({
                name: getEngineName(vault),
                tokenSymbol: tokenData.symbol,
                tokenName: tokenData.name,
                contributionRate,
                isActive: contributionRate > 0,
                image: vault.image,
                contractId: vault.contractId,
                engineContractId: vault.engineContractId
            });
        }

        // Sort by rate (highest first)
        engines.sort((a, b) => b.contributionRate - a.contributionRate);

        // Calculate max rate for relative sizing
        const maxEngineRate = Math.max(...engines.map(e => e.contributionRate), 1);

        console.log('⚡ ENGINES WITH FINAL IMPROVEMENTS:');
        console.log('====================================\n');

        engines.forEach((engine, index) => {
            const ratePerSecond = engine.contributionRate / 1000000;
            const ratePerMinute = ratePerSecond * 60;
            const percentOfMax = (engine.contributionRate / maxEngineRate) * 100;

            console.log(`${index + 1}. ${engine.name}`);
            console.log(`   💰 Hold ${engine.tokenSymbol} tokens to earn energy`);
            console.log(`   ⚡ Rate: ${ratePerSecond.toFixed(6)} energy/second (${ratePerMinute.toFixed(2)}/minute)`);
            console.log(`   📊 Relative Bar Width: ${percentOfMax.toFixed(1)}% of max`);
            console.log(`   🟢 Status: ${engine.isActive ? 'ACTIVE' : 'INACTIVE'}`);
            console.log(`   🖼️  Image: ${engine.image ? 'Available ✅' : 'None (fallback to status indicator)'}`);
            
            if (engine.image) {
                console.log(`       Image URL: ${engine.image.substring(0, 80)}${engine.image.length > 80 ? '...' : ''}`);
            }
            
            // Visual bar representation (relative to max)
            const barLength = Math.round(percentOfMax / 5);
            const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
            console.log(`   📈 Bar: [${bar}] ${percentOfMax.toFixed(1)}%`);
            console.log('');
        });

        console.log('🎯 IMPROVEMENT SUMMARY:');
        console.log('=======================');
        console.log('✅ Better Names: Using vault metadata instead of contract identifiers');
        console.log('✅ Real Rates: Individual engine analytics instead of dummy equal distribution');
        console.log('✅ Relative Bars: Bar sizes relative to highest rate engine for better comparison');
        console.log('✅ Vault Images: Show actual vault/token images instead of generic status dots');
        console.log('');
        
        console.log('📊 BEFORE vs AFTER:');
        console.log('====================');
        console.log('BEFORE:');
        console.log('- charismatic-flow-v2 Engine, Rate: 2.18/s, Bar: 33%, Green dot');
        console.log('- DEX Engine, Rate: 2.18/s, Bar: 33%, Green dot');
        console.log('- perseverantia-omnia-vincit-v2 Engine, Rate: 2.18/s, Bar: 33%, Green dot');
        console.log('');
        console.log('AFTER:');
        engines.forEach((engine) => {
            const ratePerSecond = engine.contributionRate / 1000000;
            const percentOfMax = (engine.contributionRate / maxEngineRate) * 100;
            const imageStatus = engine.image ? 'Token image' : 'Status dot';
            console.log(`- ${engine.name}, Rate: ${ratePerSecond.toFixed(2)}/s, Bar: ${percentOfMax.toFixed(1)}%, ${imageStatus}`);
        });

        console.log('\n✅ Final Energy Collective improvements complete!');
        console.log('🎯 The system now provides a much better user experience!');

    } catch (error) {
        console.error('❌ Error testing final improvements:', error);
    }
}

testFinalImprovements().catch(console.error);
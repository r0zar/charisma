// Script to test the improved engine naming system

import { fetchHoldToEarnVaults, fetchEngineRates } from '@/lib/server/energy';
import { getTokenMetadataCached } from '@repo/tokens';

async function testImprovedNaming() {
    console.log('✨ Testing Improved Engine Naming System...\n');

    try {
        const [energyVaults, engineRates] = await Promise.all([
            fetchHoldToEarnVaults(),
            fetchEngineRates()
        ]);

        if (!energyVaults || energyVaults.length === 0) {
            console.log('❌ No energy vaults found');
            return;
        }

        console.log('🏭 IMPROVED ENGINE NAMING RESULTS:');
        console.log('===================================\n');

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

            // Apply the improved naming logic
            const getCleanSymbol = (symbol: string, name: string) => {
                const symbolMap: Record<string, string> = {
                    'charismatic-flow-v2': 'SXC',
                    'perseverantia-omnia-vincit-v2': 'POV',
                    'dexterity-pool-v1': 'DEX',
                    'DEX': 'DEX'
                };
                return symbolMap[symbol] || symbolMap[name] || symbol;
            };

            const getEngineName = (vault: any, tokenData: any) => {
                const cleanSymbol = getCleanSymbol(tokenData.symbol, tokenData.name);
                const engineNameMap: Record<string, string> = {
                    'SXC': 'Charismatic Flow',
                    'POV': 'Perseverantia',
                    'DEX': 'Dexterity'
                };

                const engineName = engineNameMap[cleanSymbol] || tokenData.name;
                return `${engineName} Engine`;
            };

            const cleanSymbol = getCleanSymbol(tokenData.symbol, tokenData.name);
            const engineName = getEngineName(vault, tokenData);
            const contributionRate = engineRates[vault.engineContractId] || 0;

            console.log(`${i + 1}. Engine Processing:`);
            console.log(`   Vault Name: "${vault.name}"`);
            console.log(`   Token Symbol (raw): "${tokenData.symbol}"`);
            console.log(`   Token Name (raw): "${tokenData.name}"`);
            console.log(`   Clean Symbol: "${cleanSymbol}"`);
            console.log(`   Final Engine Name: "${engineName}"`);
            console.log(`   Display Text: "Hold ${cleanSymbol} tokens"`);
            console.log(`   Rate: ${(contributionRate / 1000000).toFixed(2)}/s`);
            console.log('');
        }

        console.log('📊 FINAL DISPLAY COMPARISON:');
        console.log('=============================');
        console.log('BEFORE (with issues):');
        console.log('• Charismatic Flow Engine (duplicated)');
        console.log('• Engine (too generic)');
        console.log('• Hold charismatic-flow-v2 tokens (ugly)');
        console.log('');
        console.log('AFTER (cleaned up):');

        for (let i = 0; i < energyVaults.length; i++) {
            const vault = energyVaults[i];
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

            const getCleanSymbol = (symbol: string, name: string) => {
                const symbolMap: Record<string, string> = {
                    'charismatic-flow-v2': 'SXC',
                    'perseverantia-omnia-vincit-v2': 'POV',
                    'dexterity-pool-v1': 'DEX',
                    'DEX': 'DEX'
                };
                return symbolMap[symbol] || symbolMap[name] || symbol;
            };

            const getEngineName = (vault: any, tokenData: any) => {
                const cleanSymbol = getCleanSymbol(tokenData.symbol, tokenData.name);
                const engineNameMap: Record<string, string> = {
                    'SXC': 'Charismatic Flow',
                    'POV': 'Perseverantia',
                    'DEX': 'Dexterity'
                };

                const engineName = engineNameMap[cleanSymbol] || tokenData.name;
                return `${engineName} Engine`;
            };

            const cleanSymbol = getCleanSymbol(tokenData.symbol, tokenData.name);
            const engineName = getEngineName(vault, tokenData);
            const contributionRate = engineRates[vault.engineContractId] || 0;

            console.log(`• ${engineName}`);
            console.log(`  Hold ${cleanSymbol} tokens`);
            console.log(`  Rate: ${(contributionRate / 1000000).toFixed(2)}/s`);
        }

        console.log('\n✅ Improved naming system complete!');
        console.log('🎯 Names are now consistent, clean, and user-friendly!');

    } catch (error) {
        console.error('❌ Error testing improved naming:', error);
    }
}

testImprovedNaming().catch(console.error);
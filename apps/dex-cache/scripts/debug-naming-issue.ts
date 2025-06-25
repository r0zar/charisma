// Script to debug the naming issue for the DEX engine

import { fetchHoldToEarnVaults } from '@/lib/server/energy';
import { getTokenMetadataCached } from '@repo/tokens';

async function debugNamingIssue() {
    console.log('🔍 Debugging Engine Naming Issue...\n');

    try {
        const energyVaults = await fetchHoldToEarnVaults();
        
        if (!energyVaults || energyVaults.length === 0) {
            console.log('❌ No energy vaults found');
            return;
        }

        console.log('🏭 DETAILED VAULT AND TOKEN DATA:');
        console.log('==================================\n');

        for (let i = 0; i < energyVaults.length; i++) {
            const vault = energyVaults[i];
            
            console.log(`${i + 1}. Vault Analysis:`);
            console.log(`   🏪 Vault Name: "${vault.name}"`);
            console.log(`   🔗 Contract ID: "${vault.contractId}"`);
            console.log(`   ⚙️  Engine Contract: "${vault.engineContractId}"`);
            console.log(`   💰 Base Token: "${vault.base}"`);

            // Get token metadata
            let tokenData;
            try {
                tokenData = await getTokenMetadataCached(vault.base);
                console.log(`   ✅ Token Metadata Success:`);
                console.log(`      Symbol: "${tokenData.symbol}"`);
                console.log(`      Name: "${tokenData.name}"`);
            } catch (error) {
                console.log(`   ⚠️  Token Metadata Failed, using fallback:`);
                tokenData = {
                    name: vault.name.replace(' Energize', ''),
                    symbol: vault.name.split(' ')[0].toUpperCase(),
                    contractId: vault.base
                };
                console.log(`      Fallback Symbol: "${tokenData.symbol}"`);
                console.log(`      Fallback Name: "${tokenData.name}"`);
            }

            // Test the naming logic step by step
            console.log(`   🧠 Naming Logic Test:`);
            
            // Step 1: Clean symbol mapping
            const symbolMap: Record<string, string> = {
                'charismatic-flow-v2': 'FLOW',
                'perseverantia-omnia-vincit-v2': 'POV',
                'dexterity-pool-v1': 'DEX',
                'DEX': 'DEX'
            };
            
            const cleanSymbol = symbolMap[tokenData.symbol] || symbolMap[tokenData.name] || tokenData.symbol;
            console.log(`      Step 1 - Clean Symbol: "${cleanSymbol}"`);
            
            // Step 2: Engine name mapping
            const engineNameMap: Record<string, string> = {
                'FLOW': 'Charismatic Flow',
                'POV': 'Perseverantia', 
                'DEX': 'Dexterity'
            };
            
            const engineBaseName = engineNameMap[cleanSymbol] || tokenData.name;
            console.log(`      Step 2 - Engine Base Name: "${engineBaseName}"`);
            
            const finalName = `${engineBaseName} Engine`;
            console.log(`      Step 3 - Final Name: "${finalName}"`);
            
            console.log('');
        }

        console.log('🎯 EXPECTED RESULTS:');
        console.log('====================');
        console.log('1. Charismatic Flow Engine');
        console.log('2. Dexterity Engine (NOT just "Engine")');
        console.log('3. Perseverantia Engine');

        console.log('\n✅ Debug analysis complete!');

    } catch (error) {
        console.error('❌ Error debugging naming issue:', error);
    }
}

debugNamingIssue().catch(console.error);
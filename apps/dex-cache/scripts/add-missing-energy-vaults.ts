// Script to add missing energy vaults to the system

import { kv } from '@vercel/kv';
import { getTokenMetadataCached } from '@repo/tokens';

const VAULT_CACHE_KEY_PREFIX = "dex-vault:";

interface EnergyVaultConfig {
    name: string;
    contractId: string;
    engineContractId: string;
    baseToken: string;
    description: string;
}

// Missing energy vaults based on the contract code
const missingEnergyVaults: EnergyVaultConfig[] = [
    {
        name: "Perseverantia Energize",
        contractId: "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.perseverantia-omnia-vincit-energize",
        engineContractId: "SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.perseverantia-omnia-vincit-hold-to-earn",
        baseToken: "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.perseverantia-omnia-vincit-v2", // POV token
        description: "Hold POV tokens to earn energy over time"
    },
    {
        name: "Charismatic Flow Energize",
        contractId: "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-flow-energize",
        engineContractId: "SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.charismatic-flow-hold-to-earn",
        baseToken: "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-flow-v2", // SXC token
        description: "Hold SXC tokens to earn energy over time"
    }
];

async function addMissingEnergyVaults() {
    console.log('🔧 Adding Missing Energy Vaults to System...\n');

    try {
        for (const vaultConfig of missingEnergyVaults) {
            console.log(`⚡ Adding ${vaultConfig.name}...`);

            // Get token metadata for the base token
            let baseTokenMetadata;
            try {
                baseTokenMetadata = await getTokenMetadataCached(vaultConfig.baseToken);
                console.log(`✅ Found base token: ${baseTokenMetadata.name} (${baseTokenMetadata.symbol})`);
            } catch (error) {
                console.warn(`⚠️ Could not load base token metadata for ${vaultConfig.baseToken}:`, error);
                // Use fallback data
                baseTokenMetadata = {
                    contractId: vaultConfig.baseToken,
                    name: vaultConfig.name.split(' ')[0], // Use first word as fallback
                    symbol: vaultConfig.name.split(' ')[0].toUpperCase(),
                    decimals: 6,
                    image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAAEElEQVR4nGIyPxsHCAAA//8CqQFlJ2/m7QAAAABJRU5ErkJggg=='
                };
            }

            // Create the energy vault entry
            const energyVault = {
                type: "ENERGY",
                protocol: "CHARISMA",
                contractId: vaultConfig.contractId,
                contractAddress: vaultConfig.contractId.split('.')[0],
                contractName: vaultConfig.contractId.split('.')[1],
                name: vaultConfig.name,
                symbol: baseTokenMetadata.symbol + "-ENERGY",
                decimals: 6,
                identifier: vaultConfig.contractId,
                description: vaultConfig.description,
                image: baseTokenMetadata.image || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAAEElEQVR4nGIyPxsHCAAA//8CqQFlJ2/m7QAAAABJRU5ErkJggg==',
                fee: 0,
                externalPoolId: "",
                engineContractId: vaultConfig.engineContractId,
                base: vaultConfig.baseToken, // The token users need to hold
                reservesLastUpdatedAt: Date.now()
            };

            // Save to KV cache
            const cacheKey = `${VAULT_CACHE_KEY_PREFIX}${vaultConfig.contractId}`;
            await kv.set(cacheKey, energyVault);

            console.log(`✅ Added ${vaultConfig.name} to vault cache`);
            console.log(`   Contract: ${vaultConfig.contractId}`);
            console.log(`   Engine: ${vaultConfig.engineContractId}`);
            console.log(`   Base Token: ${vaultConfig.baseToken} (${baseTokenMetadata.symbol})`);
            console.log(`   Cache Key: ${cacheKey}`);
            console.log('');
        }

        // Verify the vaults were added by listing all energy vaults
        console.log('🔍 Verifying added vaults...');
        const allKeys = await kv.keys(`${VAULT_CACHE_KEY_PREFIX}*`);
        const energyVaultKeys = [];

        for (const key of allKeys) {
            const vault = await kv.get(key);
            if (vault && (vault as any).type === 'ENERGY') {
                energyVaultKeys.push(key);
                console.log(`✅ Found energy vault: ${(vault as any).name} (${key})`);
            }
        }

        console.log(`\n🎯 Total energy vaults in system: ${energyVaultKeys.length}`);

        // Update the monitored contracts for the cron job
        console.log('\n📊 Updating monitored contracts for cron job...');
        const energyContracts = missingEnergyVaults.map(v => v.engineContractId);

        // Add the existing one
        energyContracts.push('SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dexterity-hold-to-earn');

        // Remove duplicates
        const uniqueContracts = [...new Set(energyContracts)];

        await kv.set('energy:monitored_contracts', uniqueContracts);
        console.log(`✅ Updated monitored contracts: ${uniqueContracts.length} engines`);
        uniqueContracts.forEach(contract => {
            console.log(`   - ${contract}`);
        });

        console.log('\n✅ Missing energy vaults added successfully!');
        console.log('🔄 The system now has access to all 3 hold-to-earn engines');
        console.log('📊 Run the energy cron job to populate analytics data for the new engines');

    } catch (error) {
        console.error('❌ Error adding missing energy vaults:', error);
    }
}

addMissingEnergyVaults().catch(console.error);
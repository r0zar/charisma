// Script to list all available energy vaults/hold-to-earn engines

import { fetchHoldToEarnVaults } from '@/lib/server/energy';
import { getAllVaultData } from '@/lib/pool-service';

async function listEnergyVaults() {
    console.log('🔍 Discovering Real Hold-to-Earn Energy Engines...\n');

    try {
        // Method 1: Using the energy server function
        console.log('📊 Method 1: Using fetchHoldToEarnVaults()');
        const energyVaults = await fetchHoldToEarnVaults();
        
        if (energyVaults && energyVaults.length > 0) {
            console.log(`✅ Found ${energyVaults.length} energy vaults:`);
            energyVaults.forEach((vault, index) => {
                console.log(`${index + 1}. ${vault.name}`);
                console.log(`   Contract: ${vault.contractId}`);
                console.log(`   Engine: ${vault.engineContractId}`);
                console.log(`   Protocol: ${vault.protocol}`);
                console.log(`   Type: ${vault.type}`);
                if (vault.base) console.log(`   Base Token: ${vault.base}`);
                console.log(`   Image: ${vault.image}`);
                console.log('');
            });
        } else {
            console.log('❌ No energy vaults found via fetchHoldToEarnVaults()');
        }

        // Method 2: Direct vault data query
        console.log('\n📊 Method 2: Direct getAllVaultData({ type: "ENERGY" })');
        const directEnergyVaults = await getAllVaultData({ type: 'ENERGY' });
        
        if (directEnergyVaults && directEnergyVaults.length > 0) {
            console.log(`✅ Found ${directEnergyVaults.length} ENERGY-type vaults:`);
            directEnergyVaults.forEach((vault, index) => {
                console.log(`${index + 1}. ${vault.name} (${vault.symbol})`);
                console.log(`   Contract: ${vault.contractId}`);
                console.log(`   Engine: ${vault.engineContractId}`);
                console.log(`   Protocol: ${vault.protocol}`);
                console.log(`   Type: ${vault.type}`);
                console.log(`   Description: ${vault.description}`);
                if (vault.tokenA) console.log(`   Token A: ${vault.tokenA.name} (${vault.tokenA.symbol})`);
                if (vault.tokenB) console.log(`   Token B: ${vault.tokenB.name} (${vault.tokenB.symbol})`);
                console.log(`   Image: ${vault.image}`);
                console.log('');
            });
        } else {
            console.log('❌ No ENERGY-type vaults found');
        }

        // Method 3: Check all vault types to see what's available
        console.log('\n📊 Method 3: Checking all available vault types');
        const allVaults = await getAllVaultData();
        const vaultTypes = new Set(allVaults.map(v => v.type));
        
        console.log(`📈 Available vault types: ${Array.from(vaultTypes).join(', ')}`);
        console.log(`📊 Total vaults: ${allVaults.length}`);
        
        // Group by protocol
        const protocolGroups = allVaults.reduce((acc, vault) => {
            if (!acc[vault.protocol]) acc[vault.protocol] = [];
            acc[vault.protocol].push(vault);
            return acc;
        }, {} as Record<string, any[]>);
        
        console.log('\n🏛️ Vaults by Protocol:');
        Object.entries(protocolGroups).forEach(([protocol, vaults]) => {
            console.log(`  ${protocol}: ${vaults.length} vaults`);
            vaults.forEach(vault => {
                console.log(`    - ${vault.name} (${vault.type})`);
            });
        });

        // Method 4: Look for any vaults that might be energy-related
        console.log('\n🔍 Method 4: Searching for energy-related vaults...');
        const energyRelated = allVaults.filter(vault => 
            vault.name.toLowerCase().includes('energy') ||
            vault.description.toLowerCase().includes('energy') ||
            vault.engineContractId.includes('hold-to-earn') ||
            vault.type === 'ENERGY'
        );
        
        if (energyRelated.length > 0) {
            console.log(`⚡ Found ${energyRelated.length} energy-related vaults:`);
            energyRelated.forEach((vault, index) => {
                console.log(`${index + 1}. ${vault.name}`);
                console.log(`   Type: ${vault.type}`);
                console.log(`   Contract: ${vault.contractId}`);
                console.log(`   Engine: ${vault.engineContractId}`);
                console.log(`   Description: ${vault.description}`);
                console.log('');
            });
        } else {
            console.log('❌ No energy-related vaults found in search');
        }

        console.log('✅ Energy vault discovery complete!');

    } catch (error) {
        console.error('❌ Error discovering energy vaults:', error);
    }
}

listEnergyVaults().catch(console.error);
#!/usr/bin/env tsx

/**
 * Check if CORGI token exists as a vault in the dex-cache
 * 
 * Usage: pnpm script check-corgi-vault
 */

import { listVaults, getManagedVaultIds } from '../src/lib/pool-service';

async function main() {
    console.log('🔍 Checking CORGI Vault Status');
    console.log('='.repeat(80));

    const corgiContractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-corgi-liquidity';
    
    try {
        console.log(`📋 Checking for vault: ${corgiContractId}`);
        console.log('-'.repeat(60));
        
        // Check managed vault IDs
        const managedVaultIds = await getManagedVaultIds();
        console.log(`\n📦 Total managed vaults: ${managedVaultIds.length}`);
        console.log('First 10 vault IDs:');
        managedVaultIds.slice(0, 10).forEach(id => console.log(`  - ${id}`));
        
        const corgiInManaged = managedVaultIds.includes(corgiContractId);
        console.log(`\n🐕 CORGI in managed vaults: ${corgiInManaged}`);
        
        // Check all vaults
        const allVaults = await listVaults();
        console.log(`\n📋 Total vaults from listVaults(): ${allVaults.length}`);
        
        const corgiVault = allVaults.find(vault => vault.contractId === corgiContractId);
        
        if (corgiVault) {
            console.log('\n✅ CORGI found as vault:');
            console.log(JSON.stringify(corgiVault, null, 2));
        } else {
            console.log('\n❌ CORGI not found as vault');
            
            // Look for any corgi-related vaults
            const corgiRelated = allVaults.filter(vault => 
                vault.contractId.toLowerCase().includes('corgi') ||
                vault.name?.toLowerCase().includes('corgi') ||
                vault.symbol?.toLowerCase().includes('corgi')
            );
            
            if (corgiRelated.length > 0) {
                console.log(`\n🔍 Found ${corgiRelated.length} corgi-related vaults:`);
                corgiRelated.forEach(vault => {
                    console.log(`\n📦 ${vault.contractId}`);
                    console.log(`   Name: ${vault.name}`);
                    console.log(`   Symbol: ${vault.symbol}`);
                    console.log(`   Type: ${vault.type}`);
                });
            }
        }
        
        // Check pool vaults specifically
        const poolVaults = allVaults.filter(vault => vault.type === 'POOL');
        console.log(`\n🏊 Total POOL vaults: ${poolVaults.length}`);
        
        const corgiPoolVault = poolVaults.find(vault => vault.contractId === corgiContractId);
        console.log(`🐕 CORGI in POOL vaults: ${!!corgiPoolVault}`);
        
        // Show what the API would return
        console.log('\n=== API SIMULATION ===');
        console.log('What the /api/v1/tokens/all?type=all would return for LP tokens:');
        poolVaults.slice(0, 5).forEach(vault => {
            console.log(`\n📦 ${vault.contractId}`);
            console.log(`   Name: ${vault.name}`);
            console.log(`   Symbol: ${vault.symbol}`);
            console.log(`   Type: ${vault.type}`);
            console.log(`   isLpToken: true (would be set by API)`);
        });
        
    } catch (error) {
        console.error('❌ Error checking CORGI vault:', error);
    }
}

// Show usage information
function showUsage() {
    console.log('Usage: pnpm script check-corgi-vault');
    console.log('\nThis script checks if CORGI token exists as a vault in dex-cache');
    console.log('and shows what the unified API would return for LP tokens.');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsage();
    process.exit(0);
}

// Run the script
main().catch(console.error);
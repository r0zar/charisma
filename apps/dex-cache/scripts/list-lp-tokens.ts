#!/usr/bin/env tsx

import { getAllVaultData } from '../src/lib/pool-service';

async function listLpTokens() {
    console.log('Fetching LP token list...\n');

    try {
        // Get all vaults with POOL type and CHARISMA protocol (LP tokens)
        const vaults = await getAllVaultData({ protocol: 'CHARISMA', type: 'POOL' });
        
        if (vaults.length === 0) {
            console.log('No LP tokens found.');
            return;
        }

        console.log(`Found ${vaults.length} LP tokens:\n`);
        console.log('ContractId\t\t\t\t\t\t\t\tImage');
        console.log('─'.repeat(120));

        for (const vault of vaults) {
            const contractId = vault.contractId || 'N/A';
            const image = vault.image || 'N/A';
            
            // Format for better readability
            const formattedContractId = contractId.padEnd(70, ' ');
            console.log(`${formattedContractId}\t${image}`);
        }

        console.log('\nSummary:');
        console.log(`Total LP tokens: ${vaults.length}`);
        console.log(`With images: ${vaults.filter(v => v.image && v.image !== 'N/A').length}`);
        console.log(`Without images: ${vaults.filter(v => !v.image || v.image === 'N/A').length}`);

    } catch (error) {
        console.error('Error fetching LP tokens:', error);
        process.exit(1);
    }
}

// Run the script
listLpTokens();
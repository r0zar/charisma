#!/usr/bin/env tsx

/**
 * Debug why LP tokens appear as both regular and LP tokens
 * Usage: pnpm script debug-duplicate-tokens
 */

import { listVaultTokens, listVaults, getLpTokenMetadata } from '@/lib/pool-service';

async function main() {
    console.log('🔍 Debugging duplicate token issue...\n');

    try {
        // Get all regular tokens and LP tokens
        const allTokens = await listVaultTokens();
        const allVaults = await listVaults();
        const poolVaults = allVaults.filter(vault => vault.type === 'POOL');
        
        // Generate LP tokens
        const lpTokens = poolVaults.slice(0, 10).map(vault => {
            const lpMeta = getLpTokenMetadata(vault);
            return {
                contractId: vault.contractId,
                symbol: lpMeta.symbol,
                name: lpMeta.name,
                decimals: lpMeta.decimals,
                image: vault.image || '',
                description: vault.description || '',
                isLpToken: true
            };
        });

        console.log('=== CHECKING FOR DUPLICATES ===');
        
        // Check for overlapping contract IDs
        const regularTokenIds = new Set(allTokens.map(t => t.contractId));
        const lpTokenIds = new Set(lpTokens.map(t => t.contractId));
        
        console.log(`Regular tokens: ${regularTokenIds.size}`);
        console.log(`LP tokens: ${lpTokenIds.size}`);
        
        // Find tokens that appear in both lists
        const overlapping = lpTokens.filter(lp => regularTokenIds.has(lp.contractId));
        console.log(`Overlapping tokens: ${overlapping.length}`);
        
        if (overlapping.length > 0) {
            console.log('\nTokens that appear in BOTH lists:');
            overlapping.forEach(token => {
                console.log(`- ${token.contractId} (${token.symbol})`);
                
                // Find the regular token version
                const regularVersion = allTokens.find(t => t.contractId === token.contractId);
                console.log(`  Regular version: isLpToken=${regularVersion?.isLpToken}`);
                console.log(`  LP version: isLpToken=${token.isLpToken}`);
            });
        }

        // Simulate the API combination logic
        console.log('\n=== SIMULATING API COMBINATION ===');
        const combinedTokens = [...allTokens, ...lpTokens];
        console.log(`Combined length: ${combinedTokens.length}`);
        console.log(`Unique contracts: ${new Set(combinedTokens.map(t => t.contractId)).size}`);
        
        // Check what happens to DMG-HOOT specifically
        const dmgHootId = 'SP1KMAA7TPZ5AZZ4W67X74MJNFKMN576604CWNBQS.dmghoot-lp-token';
        const dmgHootEntries = combinedTokens.filter(t => t.contractId === dmgHootId);
        
        console.log(`\nDMG-HOOT entries in combined list: ${dmgHootEntries.length}`);
        dmgHootEntries.forEach((entry, i) => {
            console.log(`${i + 1}. Symbol: ${entry.symbol}, isLpToken: ${entry.isLpToken}`);
        });
        
        // Find which one the API would use (first match)
        const dmgHootApiResult = combinedTokens.find(t => t.contractId === dmgHootId);
        console.log(`API would use: Symbol=${dmgHootApiResult?.symbol}, isLpToken=${dmgHootApiResult?.isLpToken}`);

        console.log('\n=== SOLUTION ===');
        console.log('The issue is that LP tokens can appear as:');
        console.log('1. Regular tokens (when they are tokenA/tokenB in other pools)');
        console.log('2. LP tokens (when they are the vault contract itself)');
        console.log('\nSolutions:');
        console.log('A. Filter out LP token contracts from regular token list');
        console.log('B. Use Map to deduplicate, with LP version taking precedence');
        console.log('C. Add LP tokens first, then regular tokens (so LP version is found first)');

    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        console.error('Full error:', error);
    }
}

// Run the script
main().catch(console.error);
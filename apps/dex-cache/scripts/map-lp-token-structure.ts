#!/usr/bin/env tsx

/**
 * Map the structure of LP tokens and their dependencies
 * Usage: pnpm script map-lp-token-structure
 */

import { listVaults } from '@/lib/pool-service';

async function main() {
    console.log('🔍 Mapping LP token dependency structure...\n');

    try {
        const allVaults = await listVaults();
        console.log(`Total pool vaults: ${allVaults.length}`);

        // Create a map of LP token dependencies
        const lpTokenStructure = new Map<string, {
            symbol: string;
            tokenA: { contractId: string; symbol: string; isLpToken: boolean };
            tokenB: { contractId: string; symbol: string; isLpToken: boolean };
            level: number; // 0 = base tokens, 1 = first level LP, etc.
        }>();

        // First pass: identify which contracts are LP tokens
        const lpTokenContracts = new Set(allVaults.map(vault => vault.contractId));
        console.log(`LP token contracts: ${lpTokenContracts.size}`);

        // Second pass: analyze dependencies
        allVaults.forEach(vault => {
            if (vault.tokenA && vault.tokenB) {
                const tokenAIsLp = lpTokenContracts.has(vault.tokenA.contractId);
                const tokenBIsLp = lpTokenContracts.has(vault.tokenB.contractId);
                
                lpTokenStructure.set(vault.contractId, {
                    symbol: vault.symbol,
                    tokenA: {
                        contractId: vault.tokenA.contractId,
                        symbol: vault.tokenA.symbol,
                        isLpToken: tokenAIsLp
                    },
                    tokenB: {
                        contractId: vault.tokenB.contractId,
                        symbol: vault.tokenB.symbol,
                        isLpToken: tokenBIsLp
                    },
                    level: 0 // Will calculate later
                });
            }
        });

        // Calculate dependency levels
        const calculateLevel = (contractId: string, visited = new Set<string>()): number => {
            if (visited.has(contractId)) {
                console.warn(`Circular dependency detected: ${contractId}`);
                return -1; // Circular dependency
            }
            
            const structure = lpTokenStructure.get(contractId);
            if (!structure) {
                return 0; // Not an LP token
            }

            visited.add(contractId);
            
            const tokenALevel = structure.tokenA.isLpToken 
                ? calculateLevel(structure.tokenA.contractId, visited) + 1 
                : 0;
            const tokenBLevel = structure.tokenB.isLpToken 
                ? calculateLevel(structure.tokenB.contractId, visited) + 1 
                : 0;
            
            visited.delete(contractId);
            return Math.max(tokenALevel, tokenBLevel);
        };

        // Update levels
        lpTokenStructure.forEach((structure, contractId) => {
            structure.level = calculateLevel(contractId);
        });

        // Group by levels
        const byLevel = new Map<number, Array<{ contractId: string; structure: any }>>();
        lpTokenStructure.forEach((structure, contractId) => {
            const level = structure.level;
            if (!byLevel.has(level)) {
                byLevel.set(level, []);
            }
            byLevel.get(level)!.push({ contractId, structure });
        });

        console.log('\n=== LP TOKEN STRUCTURE BY DEPENDENCY LEVEL ===');
        Array.from(byLevel.keys()).sort().forEach(level => {
            const tokens = byLevel.get(level)!;
            console.log(`\nLevel ${level} (${tokens.length} tokens):`);
            tokens.forEach(({ contractId, structure }) => {
                console.log(`  ${structure.symbol} (${contractId})`);
                console.log(`    ${structure.tokenA.symbol}${structure.tokenA.isLpToken ? ' (LP)' : ''} + ${structure.tokenB.symbol}${structure.tokenB.isLpToken ? ' (LP)' : ''}`);
            });
        });

        // Focus on DMG-HOOT specifically
        console.log('\n=== DMG-HOOT ANALYSIS ===');
        const dmgHootId = 'SP1KMAA7TPZ5AZZ4W67X74MJNFKMN576604CWNBQS.dmghoot-lp-token';
        const dmgHootStructure = lpTokenStructure.get(dmgHootId);
        
        if (dmgHootStructure) {
            console.log(`DMG-HOOT is Level ${dmgHootStructure.level}`);
            console.log(`TokenA: ${dmgHootStructure.tokenA.symbol} (${dmgHootStructure.tokenA.contractId}) - LP: ${dmgHootStructure.tokenA.isLpToken}`);
            console.log(`TokenB: ${dmgHootStructure.tokenB.symbol} (${dmgHootStructure.tokenB.contractId}) - LP: ${dmgHootStructure.tokenB.isLpToken}`);
        } else {
            console.log('DMG-HOOT not found in structure!');
        }

        // Check for missing base token prices
        console.log('\n=== PRICING DEPENDENCY ANALYSIS ===');
        const baseTokens = new Set<string>();
        lpTokenStructure.forEach(structure => {
            if (!structure.tokenA.isLpToken) {
                baseTokens.add(structure.tokenA.contractId);
            }
            if (!structure.tokenB.isLpToken) {
                baseTokens.add(structure.tokenB.contractId);
            }
        });

        console.log(`Base tokens needed for LP pricing: ${baseTokens.size}`);
        console.log('Base tokens:');
        Array.from(baseTokens).forEach(token => {
            const vault = allVaults.find(v => v.tokenA?.contractId === token || v.tokenB?.contractId === token);
            const tokenInfo = vault?.tokenA?.contractId === token ? vault.tokenA : vault?.tokenB;
            console.log(`  ${tokenInfo?.symbol || 'Unknown'} (${token})`);
        });

        console.log('\n=== RECOMMENDED PROCESSING ORDER ===');
        console.log('For proper intrinsic pricing:');
        console.log('1. Calculate prices for all base tokens first');
        console.log('2. Process LP tokens level by level (0, 1, 2, ...)');
        console.log('3. Each level can be processed in parallel');
        console.log('4. Higher levels depend on lower levels being complete');

    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        console.error('Full error:', error);
    }
}

// Run the script
main().catch(console.error);
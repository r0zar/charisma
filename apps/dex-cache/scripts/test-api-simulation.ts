#!/usr/bin/env tsx

/**
 * Simulate the exact API logic that simple-swap calls
 * Tests the /api/v1/tokens/all?type=all&nestLevel=0&includePricing=false logic
 * 
 * Usage: pnpm script test-api-simulation
 */

import { listVaultTokens, listVaults, getLpTokenMetadata } from '../src/lib/pool-service';

interface UnifiedToken {
    contractId: string;
    symbol: string;
    name: string;
    decimals: number;
    image?: string;
    isLpToken: boolean;
    nestLevel?: number;
    usdPrice?: number;
    confidence?: number;
    marketPrice?: number;
    intrinsicValue?: number;
}

async function main() {
    console.log('🔍 Simulating DEX Cache API Logic');
    console.log('='.repeat(80));

    console.log('📋 Simulating: /api/v1/tokens/all?type=all&nestLevel=0&includePricing=false');
    console.log('-'.repeat(60));
    
    try {
        const typeFilter = 'all';
        const nestLevelParam = '0';
        const includePricing = false;
        
        let allTokens: UnifiedToken[] = [];

        // Get tradeable tokens (same as API)
        console.log('\n1️⃣ Getting tradeable tokens...');
        if (typeFilter === 'all' || typeFilter === 'tradeable') {
            const tradeableTokens = await listVaultTokens();
            console.log(`   Found ${tradeableTokens.length} tradeable tokens`);
            
            const unifiedTradeableTokens: UnifiedToken[] = tradeableTokens.map(token => ({
                contractId: token.contractId,
                symbol: token.symbol,
                name: token.name,
                decimals: token.decimals,
                image: token.image,
                isLpToken: false,
                nestLevel: undefined
            }));
            allTokens.push(...unifiedTradeableTokens);
        }

        // Get LP tokens (same as API)
        console.log('\n2️⃣ Getting LP tokens...');
        if (typeFilter === 'all' || typeFilter === 'lp') {
            const allVaults = await listVaults();
            console.log(`   Found ${allVaults.length} total vaults`);
            
            const poolVaults = allVaults.filter(vault => vault.type === 'POOL');
            console.log(`   Found ${poolVaults.length} POOL vaults`);
            
            // Check if CORGI is in the pool vaults
            const corgiVault = poolVaults.find(vault => 
                vault.contractId.includes('charismatic-corgi-liquidity')
            );
            
            if (corgiVault) {
                console.log('\n✅ CORGI vault found in POOL vaults:');
                console.log(`   Contract ID: ${corgiVault.contractId}`);
                console.log(`   Name: ${corgiVault.name}`);
                console.log(`   Symbol: ${corgiVault.symbol}`);
                console.log(`   Type: ${corgiVault.type}`);
            } else {
                console.log('\n❌ CORGI vault NOT found in POOL vaults');
            }
            
            const lpTokens: UnifiedToken[] = poolVaults.map(vault => {
                const lpMeta = getLpTokenMetadata(vault);
                const token = {
                    contractId: vault.contractId,
                    symbol: lpMeta.symbol,
                    name: lpMeta.name,
                    decimals: lpMeta.decimals,
                    image: vault.image || undefined,
                    isLpToken: true,
                    nestLevel: 0 // Will be calculated with pricing if needed
                };
                
                // Log CORGI specifically
                if (vault.contractId.includes('charismatic-corgi-liquidity')) {
                    console.log('\n🐕 CORGI LP token created:');
                    console.log(JSON.stringify(token, null, 2));
                }
                
                return token;
            });
            allTokens.push(...lpTokens);
        }

        // Deduplicate tokens by contractId - prefer LP token version over tradeable version (same as API)
        console.log('\n🔄 Deduplicating tokens...');
        const beforeDedup = allTokens.length;
        const tokenMap = new Map<string, UnifiedToken>();
        allTokens.forEach(token => {
            const existing = tokenMap.get(token.contractId);
            if (!existing || (!existing.isLpToken && token.isLpToken)) {
                // Keep this token if no existing token or if this is LP and existing is not
                tokenMap.set(token.contractId, token);
                
                // Log CORGI deduplication specifically
                if (token.contractId.includes('charismatic-corgi-liquidity')) {
                    console.log(`\n🐕 CORGI deduplication:`);
                    console.log(`   Current token isLpToken: ${token.isLpToken}`);
                    console.log(`   Existing token isLpToken: ${existing?.isLpToken || 'none'}`);
                    console.log(`   Action: ${!existing ? 'ADD' : (!existing.isLpToken && token.isLpToken) ? 'REPLACE' : 'SKIP'}`);
                }
            }
        });
        allTokens = Array.from(tokenMap.values());
        console.log(`   Deduplicated from ${beforeDedup} to ${allTokens.length} tokens`);

        // Apply nest level filtering (same as API)
        console.log('\n3️⃣ Applying nest level filtering...');
        const nestLevelFilter = nestLevelParam ? 
            nestLevelParam.split(',').map(level => {
                if (level.endsWith('+')) {
                    return { type: 'gte', value: parseInt(level.slice(0, -1)) };
                }
                return { type: 'lte', value: parseInt(level) };
            }) : null;

        console.log(`   Nest level filter: ${JSON.stringify(nestLevelFilter)}`);

        if (nestLevelFilter && nestLevelFilter.length > 0) {
            const beforeFilter = allTokens.length;
            allTokens = allTokens.filter(token => {
                const effectiveNestLevel = token.isLpToken ? (token.nestLevel ?? 0) : 0;
                
                const included = nestLevelFilter.some(filter => {
                    if (filter.type === 'lte') {
                        return effectiveNestLevel <= filter.value;
                    } else if (filter.type === 'gte') {
                        return effectiveNestLevel >= filter.value;
                    }
                    return false;
                });
                
                // Log CORGI filtering specifically
                if (token.contractId.includes('charismatic-corgi-liquidity')) {
                    console.log(`\n🐕 CORGI filtering check:`);
                    console.log(`   isLpToken: ${token.isLpToken}`);
                    console.log(`   nestLevel: ${token.nestLevel}`);
                    console.log(`   effectiveNestLevel: ${effectiveNestLevel}`);
                    console.log(`   included: ${included}`);
                }
                
                return included;
            });
            console.log(`   Filtered from ${beforeFilter} to ${allTokens.length} tokens`);
        }

        // Final results
        console.log('\n4️⃣ Final Results:');
        const tradeableCount = allTokens.filter(t => !t.isLpToken).length;
        const lpCount = allTokens.filter(t => t.isLpToken).length;
        
        console.log(`   Total tokens: ${allTokens.length}`);
        console.log(`   Tradeable: ${tradeableCount}`);
        console.log(`   LP: ${lpCount}`);
        
        // Check for CORGI in final results
        const finalCorgi = allTokens.find(token => 
            token.contractId.includes('charismatic-corgi-liquidity')
        );
        
        if (finalCorgi) {
            console.log('\n🎉 CORGI in final API results:');
            console.log(JSON.stringify(finalCorgi, null, 2));
        } else {
            console.log('\n❌ CORGI NOT in final API results');
        }
        
        // Show what simple-swap would receive
        console.log('\n5️⃣ What simple-swap would receive:');
        const transformedTokens = allTokens.map((token: any) => {
            const transformedToken = {
                contractId: token.contractId,
                symbol: token.symbol,
                name: token.name,
                decimals: token.decimals,
                image: token.image,
                type: token.isLpToken ? 'POOL' : 'FT',
                nestLevel: token.nestLevel,
                usdPrice: token.usdPrice,
                confidence: token.confidence,
                ...(token.isLpToken && {
                    properties: {
                        isLpToken: true,
                        nestLevel: token.nestLevel
                    }
                })
            };
            
            if (token.contractId.includes('charismatic-corgi-liquidity')) {
                console.log('\n🐕 CORGI after simple-swap transformation:');
                console.log(JSON.stringify(transformedToken, null, 2));
            }
            
            return transformedToken;
        });
        
        const finalCorgiTransformed = transformedTokens.find(token => 
            token.contractId.includes('charismatic-corgi-liquidity')
        );
        
        console.log(`\n🏁 Final Result: CORGI ${finalCorgiTransformed ? 'WILL' : 'WILL NOT'} be available for LP detection`);
        
    } catch (error) {
        console.error('❌ Error simulating API logic:', error);
    }
}

// Show usage information
function showUsage() {
    console.log('Usage: pnpm script test-api-simulation');
    console.log('\nThis script simulates the exact API logic that simple-swap calls');
    console.log('and traces whether CORGI will be included and detected as LP.');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsage();
    process.exit(0);
}

// Run the script
main().catch(console.error);
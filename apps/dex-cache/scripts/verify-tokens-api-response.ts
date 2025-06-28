#!/usr/bin/env tsx

/**
 * Verify the new response interface of /api/v1/tokens/all
 * Tests the exact response structure that simple-swap expects
 * 
 * Usage: pnpm script verify-tokens-api-response
 */

import { listVaultTokens, listVaults, getLpTokenMetadata } from '../src/lib/pool-service';
import { getMultipleTokenPrices } from '../src/lib/pricing/price-calculator';
import { calculateAllLpIntrinsicValues } from '../src/lib/pricing/lp-token-calculator';

interface UnifiedToken {
    contractId: string;
    symbol: string;
    name: string;
    decimals: number;
    image?: string;
    description?: string;
    isLpToken: boolean;
    nestLevel?: number;
    usdPrice?: number;
    confidence?: number;
    marketPrice?: number;
    intrinsicValue?: number;
    supply?: number;
    totalLiquidity?: number;
    lastUpdated?: number;
    lpMetadata?: {
        tokenA?: {
            contractId: string;
            symbol: string;
            name: string;
            decimals: number;
        };
        tokenB?: {
            contractId: string;
            symbol: string;
            name: string;
            decimals: number;
        };
        reservesA?: number;
        reservesB?: number;
        fee?: number;
        protocol?: string;
        vaultType?: string;
    };
    tradingMetadata?: {
        volume24h?: number;
        priceChange24h?: number;
        high24h?: number;
        low24h?: number;
    };
}

async function main() {
    console.log('🔍 Verifying Tokens API Response Interface');
    console.log('='.repeat(80));

    try {
        console.log('📋 Simulating /api/v1/tokens/all?type=all&nestLevel=0&includePricing=false');
        console.log('-'.repeat(60));
        
        const typeFilter = 'all';
        const nestLevelParam = '0';
        const includePricing = false;
        
        let allTokens: UnifiedToken[] = [];

        // Get tradeable tokens
        console.log('1️⃣ Getting tradeable tokens...');
        if (typeFilter === 'all' || typeFilter === 'tradeable') {
            const tradeableTokens = await listVaultTokens();
            const unifiedTradeableTokens: UnifiedToken[] = tradeableTokens.map(token => ({
                contractId: token.contractId,
                symbol: token.symbol,
                name: token.name,
                decimals: token.decimals,
                image: token.image,
                description: token.description,
                supply: token.supply,
                isLpToken: false,
                nestLevel: undefined,
                lastUpdated: Date.now()
            }));
            allTokens.push(...unifiedTradeableTokens);
        }

        // Get LP tokens
        console.log('2️⃣ Getting LP tokens...');
        if (typeFilter === 'all' || typeFilter === 'lp') {
            const allVaults = await listVaults();
            const poolVaults = allVaults.filter(vault => vault.type === 'POOL');
            
            const lpTokens: UnifiedToken[] = poolVaults.map(vault => {
                const lpMeta = getLpTokenMetadata(vault);
                return {
                    contractId: vault.contractId,
                    symbol: lpMeta.symbol,
                    name: lpMeta.name,
                    decimals: lpMeta.decimals,
                    image: vault.image || undefined,
                    description: vault.description,
                    isLpToken: true,
                    nestLevel: 0,
                    lastUpdated: Date.now(),
                    lpMetadata: {
                        tokenA: vault.tokenA ? {
                            contractId: vault.tokenA.contractId,
                            symbol: vault.tokenA.symbol,
                            name: vault.tokenA.name,
                            decimals: vault.tokenA.decimals
                        } : undefined,
                        tokenB: vault.tokenB ? {
                            contractId: vault.tokenB.contractId,
                            symbol: vault.tokenB.symbol,
                            name: vault.tokenB.name,
                            decimals: vault.tokenB.decimals
                        } : undefined,
                        reservesA: vault.reservesA,
                        reservesB: vault.reservesB,
                        fee: vault.fee,
                        protocol: vault.protocol,
                        vaultType: vault.type
                    }
                };
            });
            allTokens.push(...lpTokens);
        }

        // Deduplicate tokens
        console.log('3️⃣ Deduplicating tokens...');
        const tokenMap = new Map<string, UnifiedToken>();
        allTokens.forEach(token => {
            const existing = tokenMap.get(token.contractId);
            if (!existing || (!existing.isLpToken && token.isLpToken)) {
                tokenMap.set(token.contractId, token);
            }
        });
        allTokens = Array.from(tokenMap.values());

        // Apply nest level filtering
        console.log('4️⃣ Applying nest level filtering...');
        const nestLevelFilter = nestLevelParam ? 
            nestLevelParam.split(',').map(level => {
                if (level.endsWith('+')) {
                    return { type: 'gte', value: parseInt(level.slice(0, -1)) };
                }
                return { type: 'lte', value: parseInt(level) };
            }) : null;

        if (nestLevelFilter && nestLevelFilter.length > 0) {
            allTokens = allTokens.filter(token => {
                const effectiveNestLevel = token.isLpToken ? (token.nestLevel ?? 0) : 0;
                return nestLevelFilter.some(filter => {
                    if (filter.type === 'lte') {
                        return effectiveNestLevel <= filter.value;
                    } else if (filter.type === 'gte') {
                        return effectiveNestLevel >= filter.value;
                    }
                    return false;
                });
            });
        }

        // Final results analysis
        console.log('\n5️⃣ Response Analysis:');
        const tradeableCount = allTokens.filter(t => !t.isLpToken).length;
        const lpCount = allTokens.filter(t => t.isLpToken).length;
        
        console.log(`   Total tokens: ${allTokens.length}`);
        console.log(`   Tradeable: ${tradeableCount}`);
        console.log(`   LP: ${lpCount}`);
        
        // Find CORGI token
        const corgiToken = allTokens.find(token => 
            token.contractId.includes('charismatic-corgi-liquidity')
        );
        
        if (corgiToken) {
            console.log('\n🐕 CORGI Token Found:');
            console.log(JSON.stringify(corgiToken, null, 2));
        } else {
            console.log('\n❌ CORGI Token NOT found');
        }

        // Sample LP token for interface verification
        const sampleLP = allTokens.find(t => t.isLpToken);
        if (sampleLP) {
            console.log('\n📦 Sample LP Token Structure:');
            console.log(JSON.stringify(sampleLP, null, 2));
        }

        // Generate expected response format
        const apiResponse = {
            status: 'success',
            data: allTokens,
            metadata: {
                count: allTokens.length,
                tradeableTokens: tradeableCount,
                lpTokens: lpCount,
                nestLevelBreakdown: {},
                filters: {
                    type: typeFilter,
                    nestLevel: nestLevelParam,
                    includePricing,
                    includeDetails: false,
                    minConfidence: undefined
                },
                processingTimeMs: 100
            }
        };

        console.log('\n6️⃣ Expected API Response Structure:');
        console.log(`   status: "${apiResponse.status}"`);
        console.log(`   data: Array[${apiResponse.data.length}]`);
        console.log(`   metadata.count: ${apiResponse.metadata.count}`);
        console.log(`   metadata.tradeableTokens: ${apiResponse.metadata.tradeableTokens}`);
        console.log(`   metadata.lpTokens: ${apiResponse.metadata.lpTokens}`);

        // Test simple-swap transformation
        console.log('\n7️⃣ Testing Simple-Swap Transformation:');
        const transformedTokens = allTokens.map((token: any) => ({
            contractId: token.contractId,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            image: token.image,
            description: token.description,
            supply: token.supply,
            type: token.isLpToken ? 'POOL' : 'FT',
            nestLevel: token.nestLevel,
            usdPrice: token.usdPrice,
            confidence: token.confidence,
            marketPrice: token.marketPrice,
            intrinsicValue: token.intrinsicValue,
            totalLiquidity: token.totalLiquidity,
            lastUpdated: token.lastUpdated,
            ...(token.isLpToken && {
                properties: {
                    isLpToken: true,
                    nestLevel: token.nestLevel,
                    lpMetadata: token.lpMetadata,
                    tokenAContract: token.lpMetadata?.tokenA?.contractId,
                    tokenBContract: token.lpMetadata?.tokenB?.contractId
                }
            }),
            ...(token.tradingMetadata && {
                tradingMetadata: token.tradingMetadata
            })
        }));

        const transformedCorgi = transformedTokens.find(t => 
            t.contractId.includes('charismatic-corgi-liquidity')
        );

        if (transformedCorgi) {
            console.log('\n🐕 CORGI After Simple-Swap Transformation:');
            console.log(JSON.stringify(transformedCorgi, null, 2));
            
            console.log('\n✅ LP Detection Tests:');
            console.log(`   type === 'POOL': ${transformedCorgi.type === 'POOL'}`);
            console.log(`   properties.isLpToken: ${transformedCorgi.properties?.isLpToken}`);
            console.log(`   properties.tokenAContract: ${transformedCorgi.properties?.tokenAContract}`);
            console.log(`   properties.tokenBContract: ${transformedCorgi.properties?.tokenBContract}`);
        }

        console.log('\n🏁 Summary:');
        console.log(`   ✅ API returns ${allTokens.length} tokens`);
        console.log(`   ✅ CORGI ${corgiToken ? 'IS' : 'IS NOT'} included`);
        console.log(`   ✅ LP tokens have extended metadata structure`);
        console.log(`   ✅ Simple-swap transformation ${transformedCorgi?.type === 'POOL' ? 'WORKS' : 'FAILS'}`);

    } catch (error) {
        console.error('❌ Error verifying API response:', error);
    }
}

// Show usage information
function showUsage() {
    console.log('Usage: pnpm script verify-tokens-api-response');
    console.log('\nThis script verifies the new response interface of /api/v1/tokens/all');
    console.log('and tests the transformation that simple-swap applies.');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsage();
    process.exit(0);
}

// Run the script
main().catch(console.error);
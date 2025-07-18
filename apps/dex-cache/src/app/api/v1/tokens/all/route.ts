import { NextResponse } from 'next/server';
import { listVaultTokens, listVaults, getLpTokenMetadata } from '@/lib/pool-service';


const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': '*, X-Requested-With, Content-Type, Authorization',
    'Content-Type': 'application/json',
    // Cache for 2 minutes on CDN, stale-while-revalidate for 10 minutes
    'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600'
};

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
    // Extended metadata
    supply?: number;
    totalLiquidity?: number;
    lastUpdated?: number;
    // LP token specific metadata
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
    // Trading metadata
    tradingMetadata?: {
        volume24h?: number;
        priceChange24h?: number;
        high24h?: number;
        low24h?: number;
    };
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers });
}

export async function GET(request: Request) {
    const startTime = Date.now();

    try {
        const url = new URL(request.url);

        // Parse query parameters
        const typeFilter = url.searchParams.get('type') as 'lp' | 'tradeable' | 'all' || 'all';
        const nestLevelParam = url.searchParams.get('nestLevel');
        const includePricing = url.searchParams.get('includePricing') === 'true';
        const includeDetails = url.searchParams.get('includeDetails') === 'true';
        const minConfidence = parseFloat(url.searchParams.get('minConfidence') || '0');

        // Parse nest level filter - supports "level and down" logic
        const nestLevelFilter = nestLevelParam ?
            nestLevelParam.split(',').map(level => {
                if (level.endsWith('+')) {
                    return { type: 'gte', value: parseInt(level.slice(0, -1)) };
                }
                // Default is "level and down" (lte - less than or equal)
                return { type: 'lte', value: parseInt(level) };
            }) : null;

        console.log(`[Tokens All API] Processing request - type: ${typeFilter}, nestLevel: ${nestLevelParam}, pricing: ${includePricing}`);

        let allTokens: UnifiedToken[] = [];

        // Get tradeable tokens (excluding subnet tokens)
        if (typeFilter === 'all' || typeFilter === 'tradeable') {
            const tradeableTokens = await listVaultTokens();
            // Filter out subnet tokens - only include mainnet tokens
            const mainnetTokens = tradeableTokens.filter(token => (token as any).type !== 'SUBNET');
            const unifiedTradeableTokens: UnifiedToken[] = mainnetTokens.map(token => ({
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
                    nestLevel: 0, // Will be calculated with pricing if needed
                    lastUpdated: Date.now(),
                    // LP-specific metadata
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

        // Deduplicate tokens by contractId - prefer LP token version over tradeable version
        const tokenMap = new Map<string, UnifiedToken>();
        allTokens.forEach(token => {
            const existing = tokenMap.get(token.contractId);
            if (!existing || (!existing.isLpToken && token.isLpToken)) {
                // Keep this token if no existing token or if this is LP and existing is not
                tokenMap.set(token.contractId, token);
            }
        });
        allTokens = Array.from(tokenMap.values());

        // Apply nest level filtering - "level and down" logic
        if (nestLevelFilter && nestLevelFilter.length > 0) {
            allTokens = allTokens.filter(token => {
                // Non-LP tokens are considered "level 0" and included in low-level filters
                const effectiveNestLevel = token.isLpToken ? (token.nestLevel ?? 0) : 0;

                return nestLevelFilter.some(filter => {
                    if (filter.type === 'lte') {
                        // "Level and down" - include tokens at this level or lower
                        return effectiveNestLevel <= filter.value;
                    } else if (filter.type === 'gte') {
                        // "Level and up" - include tokens at this level or higher
                        return effectiveNestLevel >= filter.value;
                    }
                    return false;
                });
            });
        }

        // Apply confidence filtering if pricing is included
        if (includePricing && minConfidence > 0) {
            allTokens = allTokens.filter(token =>
                token.confidence === undefined || token.confidence >= minConfidence
            );
        }

        // Generate metadata breakdown
        const tradeableCount = allTokens.filter(t => !t.isLpToken).length;
        const lpCount = allTokens.filter(t => t.isLpToken).length;
        const nestLevelBreakdown: Record<string, number> = {};

        allTokens.forEach(token => {
            if (token.isLpToken && token.nestLevel !== undefined) {
                const level = token.nestLevel.toString();
                nestLevelBreakdown[level] = (nestLevelBreakdown[level] || 0) + 1;
            }
        });

        const processingTime = Date.now() - startTime;

        console.log(`[Tokens All API] Returning ${allTokens.length} tokens in ${processingTime}ms`);

        return NextResponse.json({
            status: 'success',
            data: allTokens,
            metadata: {
                count: allTokens.length,
                tradeableTokens: tradeableCount,
                lpTokens: lpCount,
                nestLevelBreakdown,
                filters: {
                    type: typeFilter,
                    nestLevel: nestLevelParam,
                    includePricing,
                    includeDetails,
                    minConfidence: minConfidence > 0 ? minConfidence : undefined
                },
                processingTimeMs: processingTime
            }
        }, {
            status: 200,
            headers
        });

    } catch (error: any) {
        console.error('[Tokens All API] Error:', error);

        const processingTime = Date.now() - startTime;

        return NextResponse.json({
            status: 'error',
            error: 'Internal Server Error',
            message: process.env.NODE_ENV === 'development' ? error?.message : undefined,
            metadata: {
                processingTimeMs: processingTime
            }
        }, {
            status: 500,
            headers
        });
    }
}
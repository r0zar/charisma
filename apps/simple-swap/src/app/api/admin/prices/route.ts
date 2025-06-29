export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getTrackedTokensPaginated, getTrackedTokenCount } from '@/lib/price/store';
import { getPriceStats } from '@/lib/price/metrics';
import { ADMIN_CONFIG } from '@/lib/admin-config';

export async function GET(request: NextRequest) {
    try {
        console.log('🔍 Admin prices API called');

        // Get URL parameters for pagination and filtering
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || url.searchParams.get('pageSize') || ADMIN_CONFIG.PAGE_SIZE.toString());
        const cursor = url.searchParams.get('cursor') || '0';
        const page = parseInt(url.searchParams.get('page') || '1');
        const search = url.searchParams.get('search')?.toLowerCase() || '';
        const sortField = url.searchParams.get('sortField') || 'marketcap';
        const sortDirection = url.searchParams.get('sortDirection') || 'desc';
        const showInactive = url.searchParams.get('showInactive') === 'true';
        const showWithoutMarketCap = url.searchParams.get('showWithoutMarketCap') === 'true';

        // Fetch all tokens if searching, otherwise use paginated
        let tokens: any[] = [];
        let nextCursor = '0';
        let total = 0;
        let totalRecords = 0;
        if (search) {
            // Fetch all tokens for search
            const tokensModule = await import('@/lib/price/store');
            const all = await tokensModule.getAllTrackedTokens();
            tokens = all;
            total = tokens.length;
            totalRecords = await getTrackedTokenCount();
        } else {
            const paged = await getTrackedTokensPaginated(limit, cursor);
            tokens = paged.tokens;
            nextCursor = paged.nextCursor;
            total = paged.total;
            totalRecords = await getTrackedTokenCount();
        }

        // Fetch token metadata for enrichment
        const tokenMetadataMap = new Map();
        try {
            const tokensModule = await import('@repo/tokens');
            const allTokens = await tokensModule.listTokens();
            allTokens.forEach((token: any) => {
                tokenMetadataMap.set(token.contractId, {
                    name: token.name,
                    symbol: token.symbol,
                    image: token.image,
                    contractId: token.contractId,
                    total_supply: token.total_supply,
                    decimals: token.decimals || 0,
                    type: token.type
                });
            });
        } catch (error) {
            console.warn('⚠️ Error fetching token metadata:', error);
        }

        // Get price stats for all tokens
        const priceStats = await Promise.all(
            tokens.map(async (token) => { try {
                    const stats = await getPriceStats(token);
                    const metadata = tokenMetadataMap.get(token);
                    let marketcap = null;
                    if (stats.price && metadata?.total_supply) {
                        try {
                            const total_supplyNum = parseFloat(metadata.total_supply);
                            const decimals = metadata.decimals || 0;
                            const adjustedSupply = total_supplyNum / Math.pow(10, decimals);
                            marketcap = stats.price * adjustedSupply;
                        } catch (error) {
                            console.warn(`⚠️ Error calculating marketcap for ${token}:`, error);
                        }
                    }
                    // Use real data insights
                    let dataInsights: {
                        totalDataPoints: number;
                        firstSeen: string | null;
                        lastSeen: string | null;
                        dataQuality: 'no-data' | 'stale' | 'good';
                    } = {
                        totalDataPoints: 0,
                        firstSeen: null,
                        lastSeen: null,
                        dataQuality: 'no-data'
                    };
                    try {
                        const { getPriceHistoryInfo } = await import('@/lib/price/store');
                        const info = await getPriceHistoryInfo(token);
                        dataInsights = {
                            ...info,
                            dataQuality: info.totalDataPoints === 0 ? 'no-data' : (Date.now() - (info.lastSeen ? Date.parse(info.lastSeen) : 0) > 2 * 60 * 60 * 1000 ? 'stale' : 'good')
                        };
                    } catch (e) {
                        // fallback to default
                    }
                    return {
                        ...stats,
                        metadata: metadata || null,
                        marketcap,
                        dataInsights
                    };
                } catch (error) {
                    return {
                        contractId: token,
                        price: null,
                        change1h: null,
                        change24h: null,
                        change7d: null,
                        marketcap: null,
                        metadata: tokenMetadataMap.get(token) || null,
                        dataInsights: {
                            totalDataPoints: 0,
                            firstSeen: null,
                            lastSeen: null,
                            dataQuality: 'no-data' as const
                        }
                    };
                }
            })
        );

        // --- Filtering ---
        let filteredStats = priceStats;
        if (search) {
            filteredStats = filteredStats.filter(t => {
                const symbol = t.metadata?.symbol?.toLowerCase() || '';
                const contractId = t.contractId.toLowerCase();
                return symbol.includes(search) || contractId.includes(search);
            });
        }
        if (!showInactive) {
            filteredStats = filteredStats.filter(t => t.price !== null);
        }
        if (!showWithoutMarketCap) {
            filteredStats = filteredStats.filter(t => t.marketcap !== null && t.marketcap !== undefined);
        }

        // --- Sorting ---
        filteredStats = filteredStats.sort((a, b) => {
            let aVal: number;
            let bVal: number;
            if (sortField === 'marketcap') {
                if ((a.marketcap === null || a.marketcap === undefined) && (b.marketcap === null || b.marketcap === undefined)) return 0;
                if (a.marketcap === null || a.marketcap === undefined) return 1;
                if (b.marketcap === null || b.marketcap === undefined) return -1;
                aVal = a.marketcap as number;
                bVal = b.marketcap as number;
            } else if (sortField === 'price') {
                aVal = a.price ?? -Infinity;
                bVal = b.price ?? -Infinity;
            } else if (sortField === 'change1h' || sortField === 'change24h' || sortField === 'change7d') {
                aVal = a[sortField] ?? -Infinity;
                bVal = b[sortField] ?? -Infinity;
            } else {
                aVal = 0;
                bVal = 0;
            }
            if (sortDirection === 'asc') {
                return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            } else {
                return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
            }
        });

        // --- Paging ---
        const totalFiltered = filteredStats.length;
        let pagedStats = filteredStats;
        if (search) {
            // Use page/pageSize for search
            const start = (page - 1) * limit;
            pagedStats = filteredStats.slice(start, start + limit);
        } else {
            // Use cursor-based paging for default
            pagedStats = filteredStats;
        }

        return NextResponse.json({
            tokens: pagedStats,
            nextCursor: search ? undefined : nextCursor,
            hasMore: search ? page * limit < totalFiltered : nextCursor !== '0',
            total: totalFiltered,
            totalRecords
        });
    } catch (error) {
        return NextResponse.json(
            {
                error: 'Failed to fetch price data',
                details: error instanceof Error ? error.message : 'Unknown error',
                debugInfo: {
                    timestamp: new Date().toISOString(),
                    env: process.env.NODE_ENV
                }
            },
            { status: 500 }
        );
    }
} 
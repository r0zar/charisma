export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getTrackedTokensPaginated } from '@/lib/price/store';
import { getPriceStats } from '@/lib/price/metrics';
import { ADMIN_CONFIG } from '@/lib/admin-config';

export async function GET(request: NextRequest) {
    try {
        console.log('🔍 Admin prices API called');

        // Get URL parameters for pagination
        const url = new URL(request.url);
        const limit = Math.min(parseInt(url.searchParams.get('limit') || ADMIN_CONFIG.PAGE_SIZE.toString()), ADMIN_CONFIG.MAX_PAGES); // Use centralized config
        const cursor = url.searchParams.get('cursor') || '0';

        console.log(`📊 Fetching ${limit} tokens starting from cursor ${cursor}`);

        const { tokens, nextCursor, total } = await getTrackedTokensPaginated(limit, cursor);
        console.log(`📊 Found ${tokens.length} tokens in this batch (total processed: ${total})`);

        if (tokens.length === 0) {
            console.log('⚠️ No tracked tokens found - price data may not have been collected yet');
            return NextResponse.json({
                tokens: [],
                nextCursor: '0',
                hasMore: false,
                total: 0
            });
        }

        // Fetch token metadata for enrichment
        let tokenMetadataMap = new Map();
        try {
            // Dynamic import to handle potential module issues
            const tokensModule = await import('@repo/tokens');
            const allTokens = await tokensModule.listTokens();
            allTokens.forEach((token: any) => {
                tokenMetadataMap.set(token.contractId, {
                    name: token.name,
                    symbol: token.symbol,
                    image: token.image,
                    contractId: token.contractId,
                    totalSupply: token.total_supply,
                    decimals: token.decimals || 0,
                    type: token.type
                });
            });
            console.log(`📋 Loaded metadata for ${allTokens.length} tokens from @repo/tokens`);
        } catch (error) {
            console.warn('⚠️ Error fetching token metadata:', error);
            // No fallback - if tokens package fails, we continue without metadata
        }

        const priceStats = await Promise.all(
            tokens.map(async (token) => {
                try {
                    const stats = await getPriceStats(token);
                    const metadata = tokenMetadataMap.get(token);

                    // Calculate marketcap if we have price and total supply
                    let marketcap = null;
                    if (stats.price && metadata?.totalSupply) {
                        try {
                            const totalSupplyNum = parseFloat(metadata.totalSupply);
                            const decimals = metadata.decimals || 0;
                            const adjustedSupply = totalSupplyNum / Math.pow(10, decimals);
                            marketcap = stats.price * adjustedSupply;
                        } catch (error) {
                            console.warn(`⚠️ Error calculating marketcap for ${token}:`, error);
                        }
                    }

                    // Add mock data insights for now
                    const mockDataInsights = {
                        totalDataPoints: Math.floor(Math.random() * 500) + 10,
                        firstSeen: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
                        lastSeen: new Date(Date.now() - Math.random() * 2 * 60 * 60 * 1000).toISOString(),
                        dataQuality: ['good', 'stale', 'sparse'][Math.floor(Math.random() * 3)] as 'good' | 'stale' | 'sparse'
                    };

                    return {
                        ...stats,
                        metadata: metadata || null,
                        marketcap,
                        dataInsights: mockDataInsights
                    };
                } catch (error) {
                    console.error(`❌ Error getting stats for token ${token}:`, error);
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

        console.log(`💹 Processed ${priceStats.length} price stats`);

        // Sort active tokens first, then by price
        const sortedStats = priceStats.sort((a, b) => {
            if (a.price === null && b.price !== null) return 1;
            if (a.price !== null && b.price === null) return -1;
            return (b.price || 0) - (a.price || 0);
        });

        console.log(`✅ Returning ${sortedStats.length} token stats`);

        return NextResponse.json({
            tokens: sortedStats,
            nextCursor,
            hasMore: nextCursor !== '0',
            total
        });
    } catch (error) {
        console.error('💥 Error in admin prices API:', error);
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
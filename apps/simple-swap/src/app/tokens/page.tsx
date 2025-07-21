import { Metadata } from 'next';
import { Header } from "../../components/layout/header";
import { listTokens as listMetadata } from '@/lib/contract-registry-adapter';
import type { TokenSummary } from "@/types/token-types";
import { calculateMarketCap, findClosestPrice } from "@/lib/utils/token-utils";
import TokensPageClient from "@/components/tokens/tokens-page-client";
import { ComparisonTokenProvider } from '@/contexts/comparison-token-context';
import { PriceSeriesAPI, PriceSeriesStorage } from '@services/prices';

// Use static generation with ISR for better performance
export const revalidate = 300; // Revalidate every 5 minutes (matching price update schedule)

export const metadata: Metadata = {
    title: "Tokens | SimpleSwap - Live Cryptocurrency Prices & Analytics",
    description: "Discover and track live cryptocurrency prices, market data, and analytics. Compare tokens, view price charts, and access detailed token information on SimpleSwap.",
    keywords: "cryptocurrency, token prices, crypto analytics, live prices, market data, SimpleSwap",
    openGraph: {
        title: "Tokens | SimpleSwap",
        description: "Live cryptocurrency prices and analytics",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Tokens | SimpleSwap",
        description: "Live cryptocurrency prices and analytics",
    },
};

interface EnhancedTokenSummary extends TokenSummary {
    // Additional fields from price series
    reliability?: number;
    source?: 'oracle' | 'market' | 'virtual' | 'hybrid';
    arbitrageOpportunity?: {
        marketPrice: number;
        virtualValue: number;
        deviation: number;
        profitable: boolean;
    };
}

async function getTokenSummaries(): Promise<TokenSummary[]> {
    const summaries: TokenSummary[] = [];

    // Step 1: Get all token metadata
    const metaList = await listMetadata();
    const metaMap = new Map(metaList.map((m) => [m.contractId, m]));

    // Step 2: Get price data from Price Series API
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
        console.warn('[getTokenSummaries] No BLOB_READ_WRITE_TOKEN configured');
        // Return tokens with null prices if no price service available
        return metaList.map(meta => ({
            ...meta,
            price: null,
            change1h: null,
            change24h: null,
            change7d: null,
            lastUpdated: null,
            marketCap: null
        }));
    }

    try {
        const storage = new PriceSeriesStorage(blobToken);
        const priceAPI = new PriceSeriesAPI(storage);

        // Get all current prices
        const allTokensResult = await priceAPI.getAllTokens();
        if (!allTokensResult.success || !allTokensResult.data) {
            console.error('[getTokenSummaries] Failed to fetch prices:', allTokensResult.error);
            // Return tokens with null prices
            return metaList.map(meta => ({
                ...meta,
                price: null,
                change1h: null,
                change24h: null,
                change7d: null,
                lastUpdated: null,
                marketCap: null
            }));
        }

        // Create price data map
        const priceDataMap = new Map();
        allTokensResult.data.forEach(token => {
            priceDataMap.set(token.tokenId, token);
        });

        // Get arbitrage opportunities
        let arbitrageMap: Map<string, any> | null = null;
        try {
            const arbitrageResult = await priceAPI.getArbitrageOpportunities({
                minDeviation: 3 // 3% minimum deviation
            });
            if (arbitrageResult.success && arbitrageResult.data) {
                arbitrageMap = new Map();
                arbitrageResult.data.forEach(opp => {
                    arbitrageMap!.set(opp.tokenId, opp);
                });
            }
        } catch (error) {
            console.warn('[getTokenSummaries] Failed to fetch arbitrage data:', error);
        }

        // Step 3: Get efficient percentage changes (1hr and 24hr)
        const tokenIds = Array.from(priceDataMap.keys());
        let percentageChanges: { [tokenId: string]: { change1h: number | null; change24h: number | null } } = {};

        try {
            const changesResult = await priceAPI.getPercentageChanges({
                tokenIds
            });

            if (changesResult.success && changesResult.data) {
                percentageChanges = changesResult.data;
            }
        } catch (error) {
            console.warn('[getTokenSummaries] Failed to fetch percentage changes:', error);
        }

        // Step 4: Combine metadata with price data
        for (const [contractId, meta] of metaMap) {
            const priceData = priceDataMap.get(contractId);

            // Skip tokens without price data
            if (!priceData || !priceData.usdPrice) {
                continue;
            }

            // Get percentage changes from efficient calculation
            const changes = percentageChanges[contractId];
            const change1h = changes?.change1h || null;
            const change24h = changes?.change24h || null;
            const change7d: number | null = null; // Not calculated for now

            // Calculate market cap
            const marketCap = calculateMarketCap(
                priceData.usdPrice,
                meta.total_supply || null,
                meta.decimals || null
            );

            // Get arbitrage data if available
            const arbitrageOpp = arbitrageMap?.get(contractId);

            const summary: TokenSummary = {
                ...meta,
                price: priceData.usdPrice,
                change1h,
                change24h,
                change7d,
                lastUpdated: priceData.lastUpdated || Date.now(),
                marketCap,
                source: priceData.source,
                reliability: priceData.reliability,
                ...(arbitrageOpp && {
                    arbitrageOpportunity: {
                        marketPrice: arbitrageOpp.marketPrice,
                        virtualValue: arbitrageOpp.virtualValue,
                        deviation: arbitrageOpp.deviation,
                        profitable: arbitrageOpp.profitable
                    }
                })
            };

            summaries.push(summary);
        }

        return summaries;

    } catch (error) {
        console.error('[getTokenSummaries] Error fetching data:', error);
        // Return tokens with null prices on error
        return metaList.map(meta => ({
            ...meta,
            price: null,
            change1h: null,
            change24h: null,
            change7d: null,
            lastUpdated: null,
            marketCap: null
        }));
    }
}

export default async function TokensPage() {
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    let enhancedDataAvailable = false;
    let priceHistories: Record<string, any[]> = {};
    let arbitrageOpportunities: any[] = [];

    // First, get the base token data
    let tokens: (TokenSummary | EnhancedTokenSummary)[] = [];

    try {
        console.log('[TokensPage] Fetching token summaries...');
        tokens = await getTokenSummaries();
        console.log(`[TokensPage] Fetched ${tokens.length} tokens`);

        // Log sample token data
        if (tokens.length > 0) {
            console.log('[TokensPage] Sample token:', {
                contractId: tokens[0].contractId,
                symbol: tokens[0].symbol,
                name: tokens[0].name,
                price: tokens[0].price,
                marketCap: tokens[0].marketCap
            });
        }
    } catch (error) {
        console.error('[TokensPage] Failed to fetch token summaries:', error);
    }

    // If we have no tokens from the API, show an error
    if (tokens.length === 0) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 container max-w-7xl mx-auto px-4 py-8">
                    <div className="text-center py-12">
                        <h2 className="text-2xl font-semibold text-white/80 mb-4">No Tokens Available</h2>
                        <p className="text-white/60">Unable to load token data. Please try again later.</p>
                    </div>
                </main>
            </div>
        );
    }

    // Try to enhance with Price Series data if available
    if (blobToken) {
        try {
            console.log('[TokensPage] Attempting to enhance with Price Series data...');
            console.log('[TokensPage] BLOB_READ_WRITE_TOKEN present:', blobToken.substring(0, 20) + '...');

            // Initialize price series API
            const storage = new PriceSeriesStorage(blobToken);
            const priceAPI = new PriceSeriesAPI(storage);

            // Get all current prices from price series
            console.log('[TokensPage] Calling priceAPI.getAllTokens()...');
            const allTokensResult = await priceAPI.getAllTokens();
            console.log(`[TokensPage] Price Series API result:`, {
                success: allTokensResult.success,
                dataLength: allTokensResult.data?.length || 0,
                error: allTokensResult.error,
                cached: allTokensResult.cached
            });

            if (allTokensResult.success && allTokensResult.data && allTokensResult.data.length > 0) {
                enhancedDataAvailable = true;

                console.log('[TokensPage] Sample price series data:', allTokensResult.data[0]);

                // Create price lookup map
                const priceMap = new Map<string, any>();
                let enhancedCount = 0;

                allTokensResult.data.forEach(token => {
                    priceMap.set(token.tokenId, token);
                });

                console.log(`[TokensPage] Created price map with ${priceMap.size} entries`);

                // Get current arbitrage opportunities
                console.log('[TokensPage] Fetching arbitrage opportunities...');
                const arbitrageResult = await priceAPI.getArbitrageOpportunities({
                    minDeviation: 3 // 3% minimum deviation for display
                });

                console.log('[TokensPage] Arbitrage result:', {
                    success: arbitrageResult.success,
                    dataLength: arbitrageResult.data?.length || 0,
                    error: arbitrageResult.error
                });

                const arbitrageMap = new Map<string, any>();
                if (arbitrageResult.success && arbitrageResult.data) {
                    arbitrageOpportunities = arbitrageResult.data;
                    arbitrageResult.data.forEach(opp => {
                        arbitrageMap.set(opp.tokenId, opp);
                    });
                }

                // Enhance token metadata with price series data
                tokens = tokens.map(token => {
                    const priceData = priceMap.get(token.contractId);
                    const arbData = arbitrageMap.get(token.contractId);

                    if (priceData) {
                        enhancedCount++;
                    }

                    const enhanced: EnhancedTokenSummary = {
                        ...token,
                        // Override with latest price data if available
                        price: priceData?.usdPrice ?? token.price,
                        lastUpdated: priceData?.lastUpdated ?? token.lastUpdated,
                        source: priceData?.source,
                        reliability: priceData?.reliability,
                        // Add arbitrage data if available
                        arbitrageOpportunity: arbData ? {
                            marketPrice: arbData.marketPrice,
                            virtualValue: arbData.virtualValue,
                            deviation: arbData.deviation,
                            profitable: arbData.profitable
                        } : undefined
                    };

                    return enhanced;
                });

                console.log(`[TokensPage] Enhanced ${enhancedCount} out of ${tokens.length} tokens with price series data`);

                // Pre-fetch price history for top tokens (for sparklines)
                const topTokenIds = tokens
                    .filter(t => t.marketCap && t.marketCap > 0)
                    .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
                    .slice(0, 20) // Increased to 20 tokens for more sparklines
                    .map(t => t.contractId);

                console.log(`[TokensPage] Fetching sparklines for top ${topTokenIds.length} tokens:`, topTokenIds.map(id => id.substring(0, 15)));

                // Fetch 24h history for sparklines using bulk API
                try {
                    const bulkHistoryResult = await priceAPI.getBulkPriceSeries({
                        tokenIds: topTokenIds,
                        timeframe: '1h',
                        limit: 24 // 24 hours of hourly data
                    });

                    console.log(`[TokensPage] Bulk history result:`, {
                        success: bulkHistoryResult.success,
                        dataKeys: bulkHistoryResult.data ? Object.keys(bulkHistoryResult.data) : [],
                        dataPoints: bulkHistoryResult.data ? Object.values(bulkHistoryResult.data).reduce((sum, arr) => sum + arr.length, 0) : 0,
                        error: bulkHistoryResult.error
                    });

                    if (bulkHistoryResult.success && bulkHistoryResult.data) {
                        Object.entries(bulkHistoryResult.data).forEach(([tokenId, history]) => {
                            if (history && history.length > 0) {
                                priceHistories[tokenId] = history;
                                console.log(`[TokensPage] Added sparkline data for ${tokenId.substring(0, 15)}: ${history.length} points, sample:`, history[0]);
                            } else {
                                console.log(`[TokensPage] No sparkline data for ${tokenId.substring(0, 15)}: length=${history?.length || 0}`);
                            }
                        });
                    } else {
                        console.warn(`[TokensPage] Bulk price history fetch failed:`, bulkHistoryResult.error);
                    }
                } catch (error) {
                    console.warn(`[TokensPage] Failed to bulk fetch price history:`, error);
                }

            } else {
                console.log('[TokensPage] No enhanced data available from Price Series API');
                console.log('[TokensPage] Full result:', allTokensResult);
            }
        } catch (error) {
            console.error('[TokensPage] Error enhancing with Price Series data:', error);
            // Continue with basic token data
        }
    } else {
        console.log('[TokensPage] No BLOB_READ_WRITE_TOKEN configured - using basic data only');
    }

    console.log('[TokensPage] Final data summary:', {
        totalTokens: tokens.length,
        enhancedDataAvailable,
        priceHistoriesCount: Object.keys(priceHistories).length,
        arbitrageOpportunitiesCount: arbitrageOpportunities.length
    });

    return (
        <div className="flex flex-col min-h-screen">
            <Header />

            <main className="flex-1 container max-w-7xl mx-auto px-4 py-8">
                {!enhancedDataAvailable && (
                    <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                        <p className="text-sm text-yellow-400">
                            Enhanced price data is not available. Showing basic token information.
                        </p>
                    </div>
                )}

                <ComparisonTokenProvider>
                    <TokensPageClient
                        tokens={tokens}
                        priceHistories={priceHistories}
                        arbitrageOpportunities={arbitrageOpportunities}
                    />
                </ComparisonTokenProvider>
            </main>
        </div>
    );
}
import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { type TokenCacheData } from '@/lib/contract-registry-adapter';
import { listTokens as listMetadata } from '@/lib/contract-registry-adapter';
import type { TokenSummary, PriceStats } from '@/types/token-types';
import { calculateMarketCap, findClosestPrice } from '@/lib/utils/token-utils';
import { CachedPriceClient } from '@/lib/cached-balance-client';
import { Header } from '@/components/layout/header';
import TokenDetailClient from '@/components/tokens/token-detail-client';
import TokenDetailSkeleton from '@/components/tokens/token-detail-skeleton';
import TokenBreadcrumbs from '@/components/tokens/token-breadcrumbs';
import RelatedTokens from '@/components/tokens/related-tokens';
import PremiumTokenInfo from '@/components/tokens/premium-token-info';
import { ComparisonTokenProvider } from '@/contexts/comparison-token-context';
import { Suspense } from 'react';
import { priceSeriesService } from '@/lib/charts/price-series-service';
import { perfMonitor } from '@/lib/performance-monitor';

interface PageProps {
    params: { contractId: string };
}

export const dynamic = 'force-dynamic';
export const revalidate = 60;

async function getTokenDetail(contractId: string): Promise<TokenSummary> {
    // Get metadata
    const metaList = await listMetadata();
    let meta: TokenCacheData | undefined = metaList.find(m => m.contractId === contractId);

    // Create default metadata if not found
    if (!meta) {
        meta = {
            contractId,
            name: contractId.split('.').pop() || contractId,
            symbol: contractId.split('.').pop() || contractId,
            description: null,
            image: null,
            lastUpdated: null,
            decimals: 6,
            token_uri: null,
            identifier: contractId,
            total_supply: null,
            tokenAContract: null,
            tokenBContract: null,
            type: 'SIP-10',
            lpRebatePercent: null,
            externalPoolId: null,
            engineContractId: null,
            base: null,
        };
    }

    // Default price stats
    let priceStats: PriceStats = {
        price: null,
        change1h: null,
        change24h: null,
        change7d: null,
        lastUpdated: null
    };

    let enhancedData: Partial<TokenSummary> = {};

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (blobToken) {
        try {
            const storage = new PriceSeriesStorage(blobToken);
            const priceAPI = new PriceSeriesAPI(storage);

            // Get current price
            const priceResult = await priceAPI.getCurrentPrice(contractId);
            if (priceResult.success && priceResult.data) {
                const priceData = priceResult.data;

                priceStats.price = priceData.usdPrice;
                priceStats.lastUpdated = priceData.lastUpdated || Date.now();

                enhancedData = {
                    source: priceData.source,
                    reliability: priceData.reliability
                };

                // Try to calculate changes from historical data using price service directly
                try {
                    // Get 200 hourly data points (covers ~8 days)
                    const historyResult = await priceAPI.getPriceHistory({
                        tokenId: contractId,
                        timeframe: '1h',
                        limit: 200,
                        endTime: Date.now()
                    });

                    if (historyResult.success && historyResult.data && historyResult.data.length > 0) {
                        const currentPrice = priceData.usdPrice;
                        const history = historyResult.data;

                        // Sort history by timestamp (newest first)
                        const sortedHistory = [...history].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

                        const now = Date.now();
                        const oneHourMs = 60 * 60 * 1000;
                        const oneDayMs = 24 * oneHourMs;
                        const sevenDaysMs = 7 * oneDayMs;

                        // Find closest prices to target time periods
                        const oneHourAgo = findClosestPrice(sortedHistory, now - oneHourMs);
                        const oneDayAgo = findClosestPrice(sortedHistory, now - oneDayMs);
                        const sevenDaysAgo = findClosestPrice(sortedHistory, now - sevenDaysMs);

                        if (oneHourAgo?.usdPrice) {
                            priceStats.change1h = ((currentPrice - oneHourAgo.usdPrice) / oneHourAgo.usdPrice) * 100;
                        }
                        if (oneDayAgo?.usdPrice) {
                            priceStats.change24h = ((currentPrice - oneDayAgo.usdPrice) / oneDayAgo.usdPrice) * 100;
                        }
                        if (sevenDaysAgo?.usdPrice) {
                            priceStats.change7d = ((currentPrice - sevenDaysAgo.usdPrice) / sevenDaysAgo.usdPrice) * 100;
                        }
                    }
                } catch (error) {
                    // Silently fail - changes will remain null
                }

                // Check for arbitrage opportunities
                const arbResult = await priceAPI.getArbitrageOpportunities();
                if (arbResult.success && arbResult.data) {
                    const arbOpp = arbResult.data.find(opp => opp.tokenId === contractId);
                    if (arbOpp) {
                        enhancedData.arbitrageOpportunity = {
                            marketPrice: arbOpp.marketPrice,
                            virtualValue: arbOpp.virtualValue,
                            deviation: arbOpp.deviation,
                            profitable: arbOpp.profitable
                        };
                    }
                }
            }
        } catch (error) {
            console.warn('[getTokenDetail] Failed to get price data:', error);
        }
    }

    // Calculate market cap
    const marketCap = calculateMarketCap(
        priceStats.price ?? 0,
        meta.total_supply || null,
        meta.decimals || null
    );

    return { ...meta, ...priceStats, marketCap, ...enhancedData } as TokenSummary;
}

async function listTokenSummaries(): Promise<TokenSummary[]> {
    const summaries: TokenSummary[] = [];

    // Step 1: Get all token metadata
    const metaList = await listMetadata();
    const metaMap = new Map(metaList.map((m) => [m.contractId, m]));

    // Step 2: Get price data from Price Series API
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
        console.warn('[listTokenSummaries] No BLOB_READ_WRITE_TOKEN configured');
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
            console.error('[listTokenSummaries] Failed to fetch prices:', allTokensResult.error);
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
            console.warn('[listTokenSummaries] Failed to fetch arbitrage data:', error);
        }

        // Step 3: Combine metadata with price data
        for (const [contractId, meta] of metaMap) {
            const priceData = priceDataMap.get(contractId);

            // Skip tokens without price data
            if (!priceData || !priceData.usdPrice) {
                continue;
            }

            // Calculate percentage changes if we have historical data
            let change1h: number | null = null;
            let change24h: number | null = null;
            let change7d: number | null = null;

            // Try to calculate changes from historical data using price service directly
            try {
                // Get 200 hourly data points (covers ~8 days)
                const historyResult = await priceAPI.getPriceHistory({
                    tokenId: contractId,
                    timeframe: '1h',
                    limit: 200,
                    endTime: Date.now()
                });

                if (historyResult.success && historyResult.data && historyResult.data.length > 0) {
                    const currentPrice = priceData.usdPrice;
                    const history = historyResult.data;

                    // Sort history by timestamp (newest first)
                    const sortedHistory = [...history].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

                    const now = Date.now();
                    const oneHourMs = 60 * 60 * 1000;
                    const oneDayMs = 24 * oneHourMs;
                    const sevenDaysMs = 7 * oneDayMs;

                    // Find closest prices to target time periods
                    const oneHourAgo = findClosestPrice(sortedHistory, now - oneHourMs);
                    const oneDayAgo = findClosestPrice(sortedHistory, now - oneDayMs);
                    const sevenDaysAgo = findClosestPrice(sortedHistory, now - sevenDaysMs);

                    if (oneHourAgo?.usdPrice) {
                        change1h = ((currentPrice - oneHourAgo.usdPrice) / oneHourAgo.usdPrice) * 100;
                    }
                    if (oneDayAgo?.usdPrice) {
                        change24h = ((currentPrice - oneDayAgo.usdPrice) / oneDayAgo.usdPrice) * 100;
                    }
                    if (sevenDaysAgo?.usdPrice) {
                        change7d = ((currentPrice - sevenDaysAgo.usdPrice) / sevenDaysAgo.usdPrice) * 100;
                    }
                }
            } catch (error) {
                // Silently fail - changes will remain null
            }

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
        console.error('[listTokenSummaries] Error fetching data:', error);
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

async function preloadPriceSeriesData(contractIds: string[]) {
    if (contractIds.length === 0) return {};

    const result: Record<string, any[]> = {};
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

    console.log('[preloadPriceSeriesData] Starting preload for tokens:', contractIds.map(t => t.substring(0, 10)));

    if (!blobToken) {
        console.warn('[preloadPriceSeriesData] No BLOB_READ_WRITE_TOKEN configured');
        return result;
    }

    try {
        const storage = new PriceSeriesStorage(blobToken);
        const priceAPI = new PriceSeriesAPI(storage);

        // Fetch enhanced historical data with multiple timeframes
        await Promise.all(contractIds.map(async (contractId) => {
            try {
                // Fetch comprehensive data for charts and analytics
                const [
                    hourlyData,
                    fiveMinData,
                    dailyData
                ] = await Promise.all([
                    priceAPI.getPriceHistory({
                        tokenId: contractId,
                        timeframe: '1h',
                        limit: 720 // 30 days
                    }),
                    priceAPI.getPriceHistory({
                        tokenId: contractId,
                        timeframe: '5m',
                        limit: 288 // 24 hours
                    }),
                    priceAPI.getPriceHistory({
                        tokenId: contractId,
                        timeframe: '1d',
                        limit: 365 // 1 year
                    })
                ]);

                const processData = (data: any[]) => data.map(entry => ({
                    time: Math.floor(entry.timestamp / 1000),
                    value: entry.usdPrice || entry.price || 0,
                    volume: entry.volume || null // Don't fake volume data - use null if not available
                }));

                const processed = {
                    '5m': fiveMinData.success ? processData(fiveMinData.data || []) : [],
                    '1h': hourlyData.success ? processData(hourlyData.data || []) : [],
                    '1d': dailyData.success ? processData(dailyData.data || []) : [],
                    // Generate analytics data from hourly data
                    analytics: hourlyData.success && hourlyData.data ? 
                        generateAnalyticsData(hourlyData.data) : null
                };
                
                console.log(`[preloadPriceSeriesData] Processed data for ${contractId.substring(0, 10)}:`, {
                    '5m': processed['5m'].length,
                    '1h': processed['1h'].length,
                    '1d': processed['1d'].length,
                    analytics: !!processed.analytics
                });
                
                result[contractId] = processed;

            } catch (error) {
                console.warn(`Failed to preload price series for token ${contractId.substring(0, 10)}:`, error);
                result[contractId] = {
                    '5m': [],
                    '1h': [],
                    '1d': [],
                    analytics: null
                };
            }
        }));
    } catch (error) {
        console.warn('[preloadPriceSeriesData] Failed to initialize Price Series API:', error);
    }

    console.log('[preloadPriceSeriesData] Final result summary:', {
        tokenCount: Object.keys(result).length,
        tokens: Object.keys(result).map(t => t.substring(0, 10)),
        totalDataPoints: Object.values(result).reduce((sum: number, data: any) => {
            if (typeof data === 'object' && data !== null) {
                return sum + Object.values(data).reduce((innerSum: number, innerData: any) => {
                    return innerSum + (Array.isArray(innerData) ? innerData.length : 0);
                }, 0);
            }
            return sum;
        }, 0)
    });

    return result;
}

// Generate analytics data from price history
function generateAnalyticsData(priceData: any[]) {
    if (!priceData || priceData.length < 10) return null;

    const prices = priceData.map(entry => entry.usdPrice || entry.price || 0).filter(p => p > 0);
    if (prices.length < 10) return null;

    // Calculate returns
    const returns = prices.slice(1).map((price, i) => Math.log(price / prices[i]));
    const positiveReturns = returns.filter(ret => ret > 0);

    // Calculate volatility (annualized)
    const meanReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(365) * 100;

    // Calculate Sharpe ratio
    const annualizedReturn = meanReturn * 365;
    const riskFreeRate = 0.02; // 2%
    const sharpeRatio = volatility > 0 ? (annualizedReturn - riskFreeRate) / (volatility / 100) : 0;

    // Calculate max drawdown
    let maxDrawdown = 0;
    let peak = prices[0];
    for (let i = 1; i < prices.length; i++) {
        if (prices[i] > peak) {
            peak = prices[i];
        } else {
            const drawdown = (peak - prices[i]) / peak;
            maxDrawdown = Math.max(maxDrawdown, drawdown);
        }
    }

    return {
        volatility: Math.max(0, volatility),
        sharpeRatio,
        maxDrawdown: maxDrawdown * 100,
        averageReturn: annualizedReturn * 100,
        winRate: (positiveReturns.length / returns.length) * 100,
        priceCount: prices.length,
        priceRange: {
            min: Math.min(...prices),
            max: Math.max(...prices),
            current: prices[prices.length - 1]
        }
    };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { contractId } = await params;
    try {
        const detail = await getTokenDetail(decodeURIComponent(contractId));
        return {
            title: `${detail.symbol} (${detail.name}) | Token Details - SimpleSwap`,
            description: `Live price, charts, and detailed information for ${detail.name} (${detail.symbol}). Current price: $${detail.price?.toFixed(4) || '0.0000'}, 24h change: ${detail.change24h?.toFixed(2) || '0.00'}%.`,
            keywords: `${detail.name}, ${detail.symbol}, cryptocurrency, token price, live chart, crypto analytics`,
            openGraph: {
                title: `${detail.symbol} (${detail.name}) | SimpleSwap`,
                description: `Live price and analytics for ${detail.name}`,
                type: "website",
                images: detail.image ? [{ url: detail.image, alt: detail.name }] : [],
            },
            twitter: {
                card: "summary_large_image",
                title: `${detail.symbol} (${detail.name}) | SimpleSwap`,
                description: `Live price and analytics for ${detail.name}`,
                images: detail.image ? [detail.image] : [],
            },
        };
    } catch (error) {
        return {
            title: "Token Details | SimpleSwap",
            description: "Token details and analytics",
        };
    }
}

export default async function TokenDetailPage({ params }: PageProps) {
    const { contractId } = await params;
    const decodedContractId = decodeURIComponent(contractId);

    try {
        const timer = perfMonitor.startTiming('token-detail-page-load');

        // Step 1: Fetch basic token data and summaries in parallel
        const [detail, summaries] = await Promise.all([
            getTokenDetail(decodedContractId),
            listTokenSummaries(),
        ]);

        if (!detail) notFound();

        // Step 2: Preload comprehensive chart and analytics data
        const commonComparisonTokens = getCommonComparisonTokens(summaries);
        const tokensToPreload = [decodedContractId, ...commonComparisonTokens.slice(0, 5)];

        // Preload enhanced price series data with multiple timeframes and analytics
        const preloadedData = await preloadPriceSeriesData(tokensToPreload);
        
        console.log('[TOKEN-DETAIL-SSR] Preloaded data summary:', {
            requestedTokens: tokensToPreload.map(t => t.substring(0, 10)),
            actualTokens: Object.keys(preloadedData).map(t => t.substring(0, 10)),
            dataStructure: Object.fromEntries(
                Object.entries(preloadedData).map(([key, value]) => [
                    key.substring(0, 10),
                    typeof value === 'object' && value !== null 
                        ? Object.fromEntries(
                            Object.entries(value).map(([k, v]) => [
                                k, 
                                Array.isArray(v) ? `${v.length} points` : typeof v
                            ])
                        )
                        : typeof value
                ])
            )
        });

        timer.end({
            tokenId: decodedContractId.substring(0, 10),
            preloadedTokens: tokensToPreload.length,
            totalDataPoints: Object.values(preloadedData).reduce((sum, data) => {
                if (typeof data === 'object' && data !== null) {
                    return sum + Object.values(data).reduce((innerSum, innerData) => {
                        return innerSum + (Array.isArray(innerData) ? innerData.length : 0);
                    }, 0);
                }
                return sum;
            }, 0)
        });

        return (
            <div className="flex flex-col min-h-screen">
                <Header />

                <main className="flex-1 container max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
                    <ComparisonTokenProvider>
                        {/* Breadcrumbs */}
                        <TokenBreadcrumbs token={detail} className="mb-6" />

                        {/* Main content */}
                        <div className="space-y-6 sm:space-y-8">
                            {/* Header + compare selector + chart handled in client component */}
                            <Suspense fallback={<TokenDetailSkeleton />}>
                                <TokenDetailClient 
                                    detail={detail} 
                                    tokens={summaries}
                                    preloadedData={preloadedData}
                                />
                            </Suspense>

                            {/* Premium Token Information Grid */}
                            <PremiumTokenInfo detail={detail} />

                            {/* Related Tokens */}
                            <RelatedTokens currentToken={detail} allTokens={summaries} />
                        </div>
                    </ComparisonTokenProvider>
                </main>
            </div>
        );
    } catch (error) {
        console.error('Error loading token details:', error);
        notFound();
    }
}

/* --- helpers --- */

/**
 * Get the most commonly used comparison tokens for preloading
 */
function getCommonComparisonTokens(summaries: TokenSummary[]): string[] {
    // Priority order for comparison tokens
    const prioritySymbols = ['aeUSDC', 'STX', 'sBTC', 'CHA', 'WELSH', 'USDC', 'USDT'];

    const tokens: string[] = [];

    // Add priority tokens if they exist
    for (const symbol of prioritySymbols) {
        const token = summaries.find(t => t.symbol === symbol);
        if (token) {
            tokens.push(token.contractId);
        }
    }

    // Fill remaining slots with highest volume/price tokens
    const remainingTokens = summaries
        .filter(t => !tokens.includes(t.contractId))
        .sort((a, b) => (b.price || 0) * (b.marketCap || 0) - (a.price || 0) * (a.marketCap || 0))
        .slice(0, 10 - tokens.length)
        .map(t => t.contractId);

    return [...tokens, ...remainingTokens];
}

function fmtPrice(price: number | null) {
    if (price === null) return "-";
    return `$${price.toFixed(4)}`;
}

function fmtDelta(delta: number | null) {
    if (delta === null) return "-";
    const sign = delta > 0 ? "+" : "";
    return `${sign}${delta?.toFixed(2)}%`;
}

function getDeltaColour(delta: number | null) {
    if (delta === null) return "text-muted-foreground";
    if (delta > 0) return "text-green-600";
    if (delta < 0) return "text-red-600";
    return "";
}

// Premium components are now in separate client component files 
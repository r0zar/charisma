import { Metadata } from 'next';
import { Header } from "../../components/layout/header";
import { listTokens as listMetadata, listPrices } from '@/lib/contract-registry-adapter';
import type { TokenSummary } from "@/types/token-types";
import { calculateMarketCap, findClosestPrice } from "@/lib/utils/token-utils";
import TokensPageClient from "@/components/tokens/tokens-page-client";
import { ComparisonTokenProvider } from '@/contexts/comparison-token-context';

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

    try {
        // Step 1: Get all token metadata using cached API
        const metaList = await listMetadata();
        const metaMap = new Map(metaList.map((m) => [m.contractId, m]));
        
        console.log(`[getTokenSummaries] Fetched ${metaList.length} tokens from cached metadata API`);

        // Step 2: Get price data using cached prices API
        const prices = await listPrices();
        
        console.log(`[getTokenSummaries] Fetched ${Object.keys(prices).length} prices from cached prices API`);

        // Step 3: Combine metadata with price data
        for (const [contractId, meta] of metaMap) {
            const price = prices[contractId];

            // Include all tokens, even without prices for better UX
            const summary: TokenSummary = {
                ...meta,
                price: price || null,
                change1h: null, // Would need historical data API
                change24h: null, // Would need historical data API
                change7d: null, // Would need historical data API
                lastUpdated: price ? Date.now() : null,
                marketCap: price ? calculateMarketCap(
                    price,
                    meta.total_supply || null,
                    meta.decimals || null
                ) : null
            };

            summaries.push(summary);
        }

        // Sort by market cap (tokens with prices first)
        summaries.sort((a, b) => {
            if (a.marketCap && b.marketCap) {
                return b.marketCap - a.marketCap;
            }
            if (a.marketCap && !b.marketCap) return -1;
            if (!a.marketCap && b.marketCap) return 1;
            return a.symbol.localeCompare(b.symbol);
        });

        console.log(`[getTokenSummaries] Created ${summaries.length} token summaries, ${summaries.filter(t => t.price).length} with prices`);
        return summaries;

    } catch (error) {
        console.error('[getTokenSummaries] Error fetching data:', error);
        // Return empty array on error to prevent page crash
        return [];
    }
}

export default async function TokensPage() {
    let priceHistories: Record<string, any[]> = {};
    let arbitrageOpportunities: any[] = [];

    // Get the base token data using cached APIs
    let tokens: TokenSummary[] = [];

    try {
        console.log('[TokensPage] Fetching token summaries from cached APIs...');
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

    console.log('[TokensPage] Final data summary:', {
        totalTokens: tokens.length,
        tokensWithPrices: tokens.filter(t => t.price).length,
        priceHistoriesCount: Object.keys(priceHistories).length,
        arbitrageOpportunitiesCount: arbitrageOpportunities.length
    });

    return (
        <div className="flex flex-col min-h-screen">
            <Header />

            <main className="flex-1 container max-w-7xl mx-auto px-4 py-8">
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
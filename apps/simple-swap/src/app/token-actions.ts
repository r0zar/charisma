'use server';

import { listTokens as listMetadata, TokenCacheData } from '@repo/tokens';
import { getPriceStats, PriceStats, getBulkPriceStats } from '@/lib/price/metrics';
import { getAllTrackedTokens, getBulkLatestPrices } from '@/lib/price/store';

export type TokenSummary = TokenCacheData & PriceStats & {
    marketCap: number | null; // Pre-calculated market cap in USD
};

/**
 * Returns metadata + current price + % deltas for every token that currently has a price.
 * This is consumed by the `/tokens` index page.
 * Uses internal Redis price store instead of external APIs for better performance and reliability.
 */
export async function listTokenSummaries(): Promise<TokenSummary[]> {

    // Step 1: Get all tokens that have price data in Redis
    const trackedTokens = await getAllTrackedTokens();

    if (trackedTokens.length === 0) {
        return [];
    }

    // Step 2: Get current prices for all tracked tokens
    const currentPrices = await getBulkLatestPrices(trackedTokens);
    const contractIds = Object.keys(currentPrices);

    if (contractIds.length === 0) {
        return [];
    }

    // Step 3: Get metadata for tokens with prices (in parallel)
    const metaList = await listMetadata();
    const metaMap = new Map<string, TokenCacheData>(metaList.map((m) => [m.contractId, m]));

    // Step 4: Bulk fetch price statistics for all tokens at once
    const bulkPriceStats = await getBulkPriceStats(contractIds);

    // Step 5: Process results and calculate market caps
    const summaries: TokenSummary[] = [];

    for (const contractId of contractIds) {
        let meta: TokenCacheData | undefined = metaMap.get(contractId);

        // If no metadata available, create default metadata to avoid token-cache API calls
        if (!meta) {
            meta = {
                contractId,
                name: contractId.split('.').pop() || contractId,
                symbol: contractId.split('.').pop() || contractId,
                description: null,
                image: null,
                lastUpdated: null,
                decimals: 6, // Default to 6 decimals
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

        const stats = bulkPriceStats[contractId];
        if (!stats || !stats.price) {
            continue; // Skip tokens without valid price stats
        }

        // Calculate market cap
        const marketCap = calculateMarketCap(stats.price, meta.total_supply || null, meta.decimals || null);

        const summary: TokenSummary = {
            ...meta,
            ...stats,
            marketCap,
        };

        summaries.push(summary);
    }

    return summaries;
}

/**
 * Calculate market cap from price, total supply, and decimals
 */
function calculateMarketCap(price: number, total_supply: string | null, decimals: number | null): number | null {
    if (!price || !total_supply || decimals === null) return null;

    try {
        const supply = parseFloat(total_supply);
        const adjustedDecimals = decimals || 6;
        const adjustedSupply = supply / Math.pow(10, adjustedDecimals);
        const marketCap = price * adjustedSupply;

        // Validate result
        if (isNaN(marketCap) || !isFinite(marketCap) || marketCap <= 0) {
            return null;
        }

        return marketCap;
    } catch (error) {
        console.warn('Failed to calculate market cap:', { price, total_supply, decimals, error });
        return null;
    }
}

/**
 * Returns enriched information for a single token – used for the token detail page.
 * Uses Redis-first approach to avoid token-cache API dependencies.
 */
export async function getTokenDetail(contractId: string): Promise<TokenSummary> {

    // Step 1: Get price stats from Redis (this includes current price)
    const stats = await getPriceStats(contractId);

    // Step 2: Try to get metadata from cached list first
    const metaList = await listMetadata();
    let meta: TokenCacheData | undefined = metaList.find(m => m.contractId === contractId);

    // Step 3: If no metadata available, create default metadata (avoid token-cache API calls)
    if (!meta) {
        meta = {
            contractId,
            name: contractId.split('.').pop() || contractId,
            symbol: contractId.split('.').pop() || contractId,
            description: null,
            image: null,
            lastUpdated: null,
            decimals: 6, // Default to 6 decimals
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

    // Step 4: Calculate market cap
    const marketCap = calculateMarketCap(stats.price!, meta.total_supply || null, meta.decimals || null);

    return { ...meta, ...stats, marketCap } as TokenSummary;
}

/**
 * Pre-fetch bulk price series data for common tokens
 * This should be called during static generation to reduce client-side requests
 */
export async function preloadPriceSeriesData(contractIds: string[]) {
    if (contractIds.length === 0) return {};

    try {
        // Use the internal price store directly instead of making HTTP request
        const { getPricesInRange } = await import('@/lib/price/store');

        // Calculate time range (last 30 days)
        const now = Date.now(); // milliseconds
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

        const result: Record<string, any[]> = {};

        const stats = { processed: 0, totalPoints: 0, errors: 0 };

        // Process all contract IDs in parallel
        await Promise.all(contractIds.map(async (contractId: string) => {
            try {
                const raw = await getPricesInRange(contractId, thirtyDaysAgo, now);

                // Convert to LineData format
                const series = raw
                    .filter(item => Array.isArray(item) && item.length >= 2)
                    .map(([ts, price]) => ({
                        time: Math.floor(Number(ts) / 1000), // Convert to seconds
                        value: Number(price),
                    }))
                    .filter(point => !isNaN(point.time) && !isNaN(point.value));

                result[contractId] = series;
                stats.processed++;
                stats.totalPoints += series.length;
            } catch (error) {
                console.warn(`Failed to preload price series for token ${contractId.substring(0, 10)}...:`, (error as Error).message);
                result[contractId] = [];
                stats.errors++;
            }
        }));

        return result;
    } catch (error) {
        console.warn('Failed to preload price series data:', error);
        return {};
    }
} 
'use server';

import { listPrices, listTokens as listMetadata, getTokenMetadataCached, TokenCacheData } from '@repo/tokens';
import { getPriceStats, PriceStats } from '@/lib/price/metrics';

export type TokenSummary = TokenCacheData & PriceStats;

/**
 * Returns metadata + current price + % deltas for every token that currently has a price.
 * This is consumed by the `/tokens` index page.
 */
export async function listTokenSummaries(): Promise<TokenSummary[]> {
    // parallel fetching of static metadata for all tokens & latest USD prices
    const [metaList, priceMap] = await Promise.all([listMetadata(), listPrices()]);

    const metaMap = new Map<string, TokenCacheData>(metaList.map((m) => [m.contractId, m]));

    const contractIds = Object.keys(priceMap);

    const summaries = await Promise.all(
        contractIds.map(async (id) => {
            let meta;
            try {
                meta = metaMap.get(id) ?? (await getTokenMetadataCached(id));
            } catch (e) {
                console.error(`Failed to fetch metadata for token ${id}:`, e);
                return null;
            }
            const stats = await getPriceStats(id);
            return {
                ...meta,
                ...stats,
            } as TokenSummary;
        }),
    );

    return summaries.filter((s): s is TokenSummary => {
        return s !== null && !!s.price;
    }); // filter out null tokens and tokens with no price
}

/**
 * Returns enriched information for a single token – used for the token detail page.
 */
export async function getTokenDetail(contractId: string): Promise<TokenSummary> {
    const [meta, stats] = await Promise.all([
        getTokenMetadataCached(contractId),
        getPriceStats(contractId),
    ]);
    return { ...meta, ...stats } as TokenSummary;
} 
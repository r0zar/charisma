import { getLatestPrice, getPricesInRange, getBulkLatestPrices, getBulkPricesInRange } from './store';

// Time windows we want percentage changes for (in milliseconds)
const ONE_HOUR = 1000 * 60 * 60;
const TWENTY_FOUR_HOURS = ONE_HOUR * 24;
const SEVEN_DAYS = TWENTY_FOUR_HOURS * 7;

export interface PriceStats {
    contractId: string;
    price: number | null; // latest price in USD
    change1h: number | null; // percentage change relative to 1-hour ago
    change24h: number | null; // percentage change relative to 24-hours ago
    change7d: number | null; // percentage change relative to 7-days ago
}

/**
 * Helper that returns the earliest snapshot within the requested time window.
 * We purposely take the *first* entry (oldest) in the range so the delta is relative to the price at exactly the start of the window or as close as our snapshot cadence allows.
 */
async function getPastPrice(contractId: string, fromTimestamp: number, toTimestamp: number): Promise<number | null> {
    const data = await getPricesInRange(contractId, fromTimestamp, toTimestamp);
    if (!data || data.length === 0) return null;
    return data[0][1]; // price is stored as [timestamp, price]
}

function pctChange(prev: number | null, current: number | null): number | null {
    if (prev === null || current === null || prev === 0) return null;
    return ((current - prev) / prev) * 100;
}

/**
 * Compute latest price + 1h / 24h / 7d percentage deltas for a given token.
 * Returns nulls when historical data is insufficient.
 */
export async function getPriceStats(contractId: string): Promise<PriceStats> {
    const now = Date.now();

    const latest = await getLatestPrice(contractId);

    // if we have no price at all, short-circuit
    if (latest === undefined) {
        return {
            contractId,
            price: null,
            change1h: null,
            change24h: null,
            change7d: null,
        };
    }

    // fetch past prices in parallel
    const [past1h, past24h, past7d] = await Promise.all([
        getPastPrice(contractId, now - ONE_HOUR, now),
        getPastPrice(contractId, now - TWENTY_FOUR_HOURS, now),
        getPastPrice(contractId, now - SEVEN_DAYS, now),
    ]);

    return {
        contractId,
        price: latest,
        change1h: pctChange(past1h, latest),
        change24h: pctChange(past24h, latest),
        change7d: pctChange(past7d, latest),
    };
}

/**
 * Bulk version of getPriceStats for efficient processing of multiple tokens
 * Uses Redis pipelining to minimize round trips
 */
export async function getBulkPriceStats(contractIds: string[]): Promise<Record<string, PriceStats>> {
    if (contractIds.length === 0) return {};

    const now = Date.now();

    // Step 1: Get all latest prices in bulk
    const latestPrices = await getBulkLatestPrices(contractIds);

    // Filter out tokens with no prices to avoid unnecessary historical queries
    const tokensWithPrices = contractIds.filter(id => latestPrices[id] !== undefined);

    if (tokensWithPrices.length === 0) {
        // Return empty stats for all tokens
        const result: Record<string, PriceStats> = {};
        contractIds.forEach(contractId => {
            result[contractId] = {
                contractId,
                price: null,
                change1h: null,
                change24h: null,
                change7d: null,
            };
        });
        return result;
    }

    // Step 2: Get historical prices for all time periods in parallel
    const [past1hData, past24hData, past7dData] = await Promise.all([
        getBulkPricesInRange(tokensWithPrices, now - ONE_HOUR, now),
        getBulkPricesInRange(tokensWithPrices, now - TWENTY_FOUR_HOURS, now),
        getBulkPricesInRange(tokensWithPrices, now - SEVEN_DAYS, now)
    ]);

    // Step 3: Process results and calculate percentage changes
    const result: Record<string, PriceStats> = {};

    contractIds.forEach(contractId => {
        const latestPrice = latestPrices[contractId] ?? null;

        if (latestPrice === null) {
            result[contractId] = {
                contractId,
                price: null,
                change1h: null,
                change24h: null,
                change7d: null,
            };
            return;
        }

        // Extract historical prices (first entry in range = oldest)
        const past1h = past1hData[contractId]?.[0]?.[1] ?? null;
        const past24h = past24hData[contractId]?.[0]?.[1] ?? null;
        const past7d = past7dData[contractId]?.[0]?.[1] ?? null;

        result[contractId] = {
            contractId,
            price: latestPrice,
            change1h: pctChange(past1h, latestPrice),
            change24h: pctChange(past24h, latestPrice),
            change7d: pctChange(past7d, latestPrice),
        };
    });

    return result;
} 
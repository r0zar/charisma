import { kv } from '@vercel/kv';
import { ADMIN_CONFIG } from '../admin-config';

const PREFIX = 'price:token';

// Use centralized configuration - single source of truth
const RETENTION_MS = ADMIN_CONFIG.RETENTION_MS;
const EPSILON = ADMIN_CONFIG.PRICE_EPSILON;

export async function addPriceSnapshot(contractId: string, price: number, timestamp: number = Date.now()): Promise<void> {
    const key = `${PREFIX}:${contractId}`;

    // Log snapshot attempt
    console.log(`[addPriceSnapshot] contractId=${contractId}, price=${price}, timestamp=${timestamp}`);

    // if epsilon is set, skip writing if change is insignificant
    if (EPSILON > 0) {
        const last = await getLatestPrice(contractId);
        if (last !== undefined && Math.abs(price - last) / last < EPSILON) {
            console.log(`[addPriceSnapshot] Skipped write for contractId=${contractId} (change < EPSILON)`);
            return; // skip write
        }
    }

    await kv.zadd(key, { score: timestamp, member: price.toString() });
    console.log(`[addPriceSnapshot] Added price snapshot for contractId=${contractId}`);

    // cleanup old entries
    const cutoff = timestamp - RETENTION_MS;
    await kv.zremrangebyscore(key, 0, cutoff);
    console.log(`[addPriceSnapshot] Cleaned up old entries for contractId=${contractId}, cutoff=${cutoff}`);
}

export async function getLatestPrice(contractId: string): Promise<number | undefined> {
    const key = `${PREFIX}:${contractId}`;
    const res = await kv.zrange(key, -1, -1);
    if (!res || res.length === 0) {
        console.log(`[getLatestPrice] No price found for contractId=${contractId}`);
        return undefined;
    }
    console.log(`[getLatestPrice] contractId=${contractId}, price=${res[0]}`);
    return Number(res[0]);
}

export async function getPricesInRange(contractId: string, fromTimestamp: number, toTimestamp: number): Promise<[number, number][]> {
    const key = `${PREFIX}:${contractId}`;
    const res = await kv.zrange<number[]>(key, fromTimestamp, toTimestamp, {
        byScore: true,
        withScores: true
    });
    // data is returned as alternating price, ts, price, ts...
    // so we need to pair them up
    const out: [number, number][] = [];
    for (let i = 0; i < res.length; i += 2) {
        const price = Number(res[i]);
        const ts = Number(res[i + 1]);
        out.push([ts, price]);
    }
    // Removed individual logging - use aggregated logging in bulk operations
    return out;
}

// Fast function to get a limited number of tokens for admin UI
export async function getTrackedTokensPaginated(limit: number = ADMIN_CONFIG.PAGE_SIZE, cursor: string = '0'): Promise<{
    tokens: string[];
    nextCursor: string;
    total: number;
}> {
    const allKeys: string[] = [];
    let currentCursor = cursor;
    let iterations = 0;
    const maxIterations = Math.ceil(limit / 100); // Since we fetch 100 at a time

    do {
        const result = await kv.scan(currentCursor, {
            match: `${PREFIX}:*`,
            count: 100
        });

        currentCursor = result[0];
        const keys = result[1] as string[];
        allKeys.push(...keys);

        iterations++;

        // Stop if we have enough tokens or reached max iterations
        if (allKeys.length >= limit || iterations >= maxIterations) {
            break;
        }

    } while (currentCursor !== '0');

    // Remove the prefix from each key to get just the contract IDs
    const tokens = allKeys
        .map(key => key.replace(`${PREFIX}:`, ''))
        .slice(0, limit);

    console.log(`[getTrackedTokensPaginated] limit=${limit}, returned=${tokens.length}, nextCursor=${currentCursor}`);

    return {
        tokens,
        nextCursor: currentCursor,
        total: allKeys.length // This is approximate for the current batch
    };
}

// Optimized function for getting basic token count
export async function getTrackedTokenCount(): Promise<number> {
    let count = 0;
    let cursor = '0';
    let iterations = 0;
    const maxIterations = 10; // Limit to prevent infinite loops

    do {
        const result = await kv.scan(cursor, {
            match: `${PREFIX}:*`,
            count: 100
        });

        cursor = result[0];
        const keys = result[1] as string[];
        count += keys.length;

        iterations++;
        if (iterations >= maxIterations) {
            break; // Safety break - return approximate count
        }

    } while (cursor !== '0');

    console.log(`[getTrackedTokenCount] count=${count}`);
    return count;
}

// Keep the original function for compatibility but mark it as potentially slow
export async function getAllTrackedTokens(): Promise<string[]> {
    console.warn('getAllTrackedTokens() can be slow with large datasets. Consider using getTrackedTokensPaginated() instead.');

    const allKeys: string[] = [];
    let cursor = '0';
    let iterations = 0;
    const maxIterations = 100; // Safety limit

    do {
        const result = await kv.scan(cursor, {
            match: `${PREFIX}:*`,
            count: 100
        });

        cursor = result[0];
        const keys = result[1] as string[];
        allKeys.push(...keys);

        iterations++;
        if (iterations >= maxIterations) {
            console.warn('getAllTrackedTokens() hit iteration limit, returning partial results');
            break;
        }

    } while (cursor !== '0');

    const tokens = allKeys.map(key => key.replace(`${PREFIX}:`, ''));
    console.log(`[getAllTrackedTokens] total=${tokens.length}`);
    return tokens;
}

// Returns { totalDataPoints, firstSeen, lastSeen } for a token's price history
export async function getPriceHistoryInfo(contractId: string): Promise<{
    totalDataPoints: number;
    firstSeen: string | null;
    lastSeen: string | null;
}> {
    const key = `${PREFIX}:${contractId}`;
    // Get count
    const totalDataPoints = await kv.zcard(key);
    // Get first (oldest) entry
    const first = await kv.zrange(key, 0, 0, { withScores: true });
    // Get last (newest) entry
    const last = await kv.zrange(key, -1, -1, { withScores: true });
    let firstSeen: string | null = null;
    let lastSeen: string | null = null;
    if (first && first.length === 2) {
        firstSeen = new Date(Number(first[1])).toISOString();
    }
    if (last && last.length === 2) {
        lastSeen = new Date(Number(last[1])).toISOString();
    }
    return {
        totalDataPoints: totalDataPoints || 0,
        firstSeen,
        lastSeen
    };
}

export async function addPriceSnapshotsBulk(
    snapshots: { contractId: string, price: number, timestamp: number }[]
): Promise<void> {
    if (!snapshots.length) return;
    const pipeline = kv.pipeline ? kv.pipeline() : null;
    for (const { contractId, price, timestamp } of snapshots) {
        const key = `${PREFIX}:${contractId}`;
        // Only add if EPSILON is 0 or price changed enough
        let shouldAdd = true;
        if (EPSILON > 0) {
            const last = await getLatestPrice(contractId);
            if (last !== undefined && Math.abs(price - last) / last < EPSILON) {
                shouldAdd = false;
            }
        }
        if (shouldAdd) {
            if (pipeline) {
                pipeline.zadd(key, { score: timestamp, member: price.toString() });
                pipeline.zremrangebyscore(key, 0, timestamp - RETENTION_MS);
            } else {
                await kv.zadd(key, { score: timestamp, member: price.toString() });
                await kv.zremrangebyscore(key, 0, timestamp - RETENTION_MS);
            }
        }
    }
    if (pipeline) await pipeline.exec();
}

/**
 * Get latest prices for multiple tokens in bulk using Redis pipelining
 */
export async function getBulkLatestPrices(contractIds: string[]): Promise<Record<string, number>> {
    if (contractIds.length === 0) return {};

    const startTime = Date.now();
    const result: Record<string, number> = {};

    // Use pipeline for bulk operations
    const pipeline = kv.pipeline();
    if (!pipeline) {
        // Fallback to individual queries if pipeline not available
        const promises = contractIds.map(async (contractId) => {
            const price = await getLatestPrice(contractId);
            return { contractId, price };
        });
        
        const results = await Promise.all(promises);
        results.forEach(({ contractId, price }) => {
            if (price !== undefined) {
                result[contractId] = price;
            }
        });
        
        console.log('[BULK-LATEST] Fallback method completed in', Date.now() - startTime, 'ms');
        return result;
    }

    // Add all queries to pipeline
    contractIds.forEach(contractId => {
        const key = `${PREFIX}:${contractId}`;
        pipeline.zrange(key, -1, -1);
    });

    const results = await pipeline.exec();
    
    // Process pipeline results
    contractIds.forEach((contractId, index) => {
        const res = results?.[index];
        if (res && Array.isArray(res) && res.length > 0) {
            // Handle both string and number results from Redis
            const priceValue = res[0];
            const price = typeof priceValue === 'string' ? Number(priceValue) : Number(priceValue);
            if (!isNaN(price)) {
                result[contractId] = price;
            }
        }
    });

    const duration = Date.now() - startTime;
    console.log('[BULK-LATEST] Retrieved prices for', Object.keys(result).length, '/', contractIds.length, 'tokens in', duration, 'ms');

    return result;
}

/**
 * Get price ranges for multiple tokens in bulk using Redis pipelining
 */
export async function getBulkPricesInRange(
    contractIds: string[], 
    fromTimestamp: number, 
    toTimestamp: number
): Promise<Record<string, [number, number][]>> {
    if (contractIds.length === 0) return {};

    const startTime = Date.now();
    const result: Record<string, [number, number][]> = {};

    // Use pipeline for bulk operations
    const pipeline = kv.pipeline();
    if (!pipeline) {
        // Fallback to individual queries if pipeline not available
        const promises = contractIds.map(async (contractId) => {
            const data = await getPricesInRange(contractId, fromTimestamp, toTimestamp);
            return { contractId, data };
        });
        
        const results = await Promise.all(promises);
        results.forEach(({ contractId, data }) => {
            result[contractId] = data;
        });
        
        console.log('[BULK-RANGE] Fallback method completed in', Date.now() - startTime, 'ms');
        return result;
    }

    // Add all queries to pipeline
    contractIds.forEach(contractId => {
        const key = `${PREFIX}:${contractId}`;
        pipeline.zrange(key, fromTimestamp, toTimestamp, {
            byScore: true,
            withScores: true
        });
    });

    const results = await pipeline.exec();
    
    // Process pipeline results
    contractIds.forEach((contractId, index) => {
        const res = results?.[index];
        if (res && Array.isArray(res)) {
            const out: [number, number][] = [];
            // Data is returned as alternating price, ts, price, ts...
            for (let i = 0; i < res.length; i += 2) {
                const price = Number(res[i]);
                const ts = Number(res[i + 1]);
                if (!isNaN(price) && !isNaN(ts)) {
                    out.push([ts, price]);
                }
            }
            result[contractId] = out;
        } else {
            result[contractId] = [];
        }
    });

    const duration = Date.now() - startTime;
    const totalPoints = Object.values(result).reduce((sum, data) => sum + data.length, 0);
    
    console.log('[BULK-RANGE] Retrieved', totalPoints, 'price points for', contractIds.length, 'tokens in', duration, 'ms');

    return result;
}

/**
 * Snapshot prices for all available tokens using oracle data
 * This function replicates the logic from the cron/price route
 */
export async function snapshotPricesFromOracle(): Promise<{
    status: 'success' | 'error';
    count: number;
    timestamp: number;
    charismaTokenIncluded: boolean;
    tokens: string[];
}> {
    const now = Date.now();
    
    try {
        // Import functions dynamically to avoid circular dependencies
        const { listPrices } = await import('@repo/tokens');
        const { listTokens } = await import('dexterity-sdk');
        
        // Fetch all token prices (USD values) from the source
        const oraclePrices = await listPrices();
        const dexTokens = await listTokens();

        console.log(`[snapshotPricesFromOracle] Oracle returned ${Object.keys(oraclePrices).length} prices`);
        console.log(`[snapshotPricesFromOracle] Dex tokens count: ${dexTokens.length}`);

        // Filter out tokens that are not in the dexTokens list
        const oraclePricesFiltered = Object.fromEntries(
            Object.entries(oraclePrices).filter(([contractId]) =>
                dexTokens.some(token => token.contractId === contractId)
            )
        );

        console.log(`[snapshotPricesFromOracle] Filtered prices count: ${Object.keys(oraclePricesFiltered).length}`);
        console.log(`[snapshotPricesFromOracle] Filtered tokens:`, Object.keys(oraclePricesFiltered));

        const snapshots: { contractId: string, price: number, timestamp: number }[] = [];
        const tokenList: string[] = [];
        
        for (const [contractId, price] of Object.entries(oraclePricesFiltered)) {
            if (typeof price === 'number' && !isNaN(price)) {
                // Add tiny random noise to price (0.0000001% of value)
                const noise = price * 0.0000001 * (Math.random() - 0.5); // ±0.00000005%
                const noisyPrice = price + noise;
                snapshots.push({ contractId, price: noisyPrice, timestamp: now });
                tokenList.push(contractId);
            }
        }

        await addPriceSnapshotsBulk(snapshots);
        
        // Check if .charisma-token is included
        const charismaTokenIncluded = tokenList.includes('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token');
        
        console.log(`[snapshotPricesFromOracle] Successfully stored ${snapshots.length} price snapshots`);
        console.log(`[snapshotPricesFromOracle] Charisma token included: ${charismaTokenIncluded}`);

        return {
            status: 'success',
            count: snapshots.length,
            timestamp: now,
            charismaTokenIncluded,
            tokens: tokenList
        };
    } catch (error) {
        console.error('[snapshotPricesFromOracle] Failed to snapshot prices:', error);
        return {
            status: 'error',
            count: 0,
            timestamp: now,
            charismaTokenIncluded: false,
            tokens: []
        };
    }
}
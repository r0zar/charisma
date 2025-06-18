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
    // if (EPSILON > 0) {
    //     const last = await getLatestPrice(contractId);
    //     if (last !== undefined && Math.abs(price - last) / last < EPSILON) {
    //         console.log(`[addPriceSnapshot] Skipped write for contractId=${contractId} (change < EPSILON)`);
    //         return; // skip write
    //     }
    // }

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
    console.log(`[getPricesInRange] contractId=${contractId}, from=${fromTimestamp}, to=${toTimestamp}, count=${out.length}`);
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
        if (pipeline) {
            pipeline.zadd(key, { score: timestamp, member: price.toString() });
            pipeline.zremrangebyscore(key, 0, timestamp - RETENTION_MS);
        } else {
            await kv.zadd(key, { score: timestamp, member: price.toString() });
            await kv.zremrangebyscore(key, 0, timestamp - RETENTION_MS);
        }
    }
    if (pipeline) await pipeline.exec();
}
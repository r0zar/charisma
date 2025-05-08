import { kv } from '@vercel/kv';

const PREFIX = 'price';

// how long (ms) to retain snapshots, default 7 days
const RETENTION_MS = Number(process.env.PRICE_RETENTION_MS ?? 1000 * 60 * 60 * 24 * 7);

// only persist if price deviates more than this fraction (e.g. 0.002 = 0.2%) from last stored price
const EPSILON = Number(process.env.PRICE_EPSILON ?? 0);

export async function addPriceSnapshot(pair: string, price: number, timestamp: number = Date.now()): Promise<void> {
    const key = `${PREFIX}:${pair}`;

    // if epsilon is set, skip writing if change is insignificant
    if (EPSILON > 0) {
        const last = await getLatestPrice(pair);
        if (last !== undefined && Math.abs(price - last) / last < EPSILON) {
            return; // skip write
        }
    }

    await kv.zadd(key, { score: timestamp, member: price.toString() });

    // cleanup old entries
    const cutoff = timestamp - RETENTION_MS;
    // @ts-ignore - zremrangebyscore exists at runtime
    await kv.zremrangebyscore(key, 0, cutoff);
}

export async function getLatestPrice(pair: string): Promise<number | undefined> {
    const key = `${PREFIX}:${pair}`;
    const res = await kv.zrange(key, -1, -1);
    if (!res || res.length === 0) return undefined;
    return Number(res[0]);
}

export async function getPricesInRange(pair: string, fromTimestamp: number, toTimestamp: number): Promise<[number, number][]> {
    const key = `${PREFIX}:${pair}`;
    // @ts-ignore - zrangebyscore exists in runtime
    const res = await kv.zrangebyscore(key, fromTimestamp, toTimestamp, { withScores: true });
    const out: [number, number][] = [];
    for (let i = 0; i < res.length; i += 2) {
        const price = Number(res[i]);
        const ts = Number(res[i + 1]);
        out.push([ts, price]);
    }
    return out;
} 
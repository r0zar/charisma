import { kv } from '@vercel/kv';

const PREFIX = 'price:token';

// how long (ms) to retain snapshots, default 3 days
const RETENTION_MS = Number(process.env.PRICE_RETENTION_MS ?? 1000 * 60 * 60 * 24 * 3);

// only persist if price deviates more than this fraction (e.g. 0.002 = 0.2%) from last stored price
const EPSILON = Number(process.env.PRICE_EPSILON ?? 0.0001);

export async function addPriceSnapshot(contractId: string, price: number, timestamp: number = Date.now()): Promise<void> {
    const key = `${PREFIX}:${contractId}`;

    // if epsilon is set, skip writing if change is insignificant
    if (EPSILON > 0) {
        const last = await getLatestPrice(contractId);
        if (last !== undefined && Math.abs(price - last) / last < EPSILON) {
            return; // skip write
        }
    }

    await kv.zadd(key, { score: timestamp, member: price.toString() });

    // cleanup old entries
    const cutoff = timestamp - RETENTION_MS;
    await kv.zremrangebyscore(key, 0, cutoff);
}

export async function getLatestPrice(contractId: string): Promise<number | undefined> {
    const key = `${PREFIX}:${contractId}`;
    const res = await kv.zrange(key, -1, -1);
    if (!res || res.length === 0) return undefined;
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
    return out;
}
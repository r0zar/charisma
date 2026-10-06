// @ts-ignore: vercel/kv runtime import without types
import { kv } from '@vercel/kv';

/**
 * Which wallets' balances just changed, so live screens re-work only those. A wallet with a live screen open is
 * "watched", and changes are only recorded for watched wallets, so the cost follows the number of people watching
 * rather than the number of transactions on the chain.
 */

/** Sorted set: address → when a live screen last confirmed it's still watching (ms) */
const WATCHED_KEY = 'balance-sheet:watched';
const versionKey = (address: string) => `balance-sheet:version:${address}`;
/** A wallet stops counting as watched this long after its last live screen closes */
const WATCH_TTL_MS = 60_000;

/** Live screens call this regularly for the wallets they show */
export async function watching(addresses: string[]): Promise<void> {
    if (!addresses.length) return;
    const now = Date.now();
    const [first, ...rest] = addresses.map(member => ({ score: now, member }));
    await kv.zadd(WATCHED_KEY, first, ...rest);
    // Addresses stay at most minutes after their last screen closes, and the list itself an hour after the last one
    await kv.zremrangebyscore(WATCHED_KEY, 0, now - 10 * WATCH_TTL_MS);
    await kv.expire(WATCHED_KEY, 3600);
}

export async function watched(): Promise<Set<string>> {
    return new Set(await kv.zrange<string[]>(WATCHED_KEY, Date.now() - WATCH_TTL_MS, '+inf', { byScore: true }));
}

/** Records that these wallets' balances changed; only watched wallets are recorded */
export async function changed(addresses: Iterable<string>, among?: Set<string>): Promise<void> {
    const unique = [...new Set(addresses)];
    if (!unique.length) return;
    const watch = among ?? (await watched());
    const hits = unique.filter(a => watch.has(a));
    if (!hits.length) return;
    const batch = kv.pipeline();
    for (const address of hits) {
        batch.incr(versionKey(address));
        batch.expire(versionKey(address), 3600);
    }
    await batch.exec();
}

/** Each wallet's change counter (null until its first change) */
export async function versions(addresses: string[]): Promise<(number | null)[]> {
    return addresses.length ? kv.mget<(number | null)[]>(...addresses.map(versionKey)) : [];
}

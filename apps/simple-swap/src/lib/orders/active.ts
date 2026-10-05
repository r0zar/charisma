// @ts-ignore: vercel/kv runtime import without types
import { kv } from '@vercel/kv';
import type { LimitOrder } from './types';

/**
 * Orders that can still spend, per owner: open, or sent and not yet final. Instant balances read a wallet's orders
 * every few seconds, and the orders hash holds every order ever made, so the store keeps this small index beside it.
 */

export const ORDERS_KEY = 'orders';
export const activeKey = (owner: string) => `orders:active:${owner}`;
/** Set once the index holds every order saved before it existed */
const BUILT_KEY = 'orders:active:built';

// 'filled' is the legacy name for 'broadcasted'
export const isActive = (o: LimitOrder) => o.status === 'open' || o.status === 'broadcasted' || o.status === 'filled';

/** An exit that spends the same funds as its siblings: Zesty's target/safety, or any order marked metadata.oco. */
export const isExit = (o: LimitOrder) =>
    (o.strategyType === 'zesty' && o.metadata?.zesty?.role !== 'convert') || o.metadata?.oco === true;

const parse = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v) as LimitOrder;

/** Adds every active order to the index; safe to run more than once */
async function buildIndex(): Promise<void> {
    const all = Object.values((await kv.hgetall<Record<string, unknown>>(ORDERS_KEY)) ?? {}).map(parse).filter(isActive);
    if (all.length) {
        const batch = kv.pipeline();
        for (const o of all) batch.sadd(activeKey(o.owner), o.uuid);
        await batch.exec();
    }
    await kv.set(BUILT_KEY, Date.now());
}

/** The owner's orders that can still spend */
export async function activeOrders(owner: string): Promise<LimitOrder[]> {
    if (!(await kv.exists(BUILT_KEY))) await buildIndex();
    const uuids = await kv.smembers<string[]>(activeKey(owner));
    if (!uuids.length) return [];
    const found = Object.values((await kv.hmget<Record<string, unknown>>(ORDERS_KEY, ...uuids)) ?? {}).filter(Boolean).map(parse);
    const stale = found.filter(o => !isActive(o)).map(o => o.uuid);
    if (stale.length) await kv.srem(activeKey(owner), ...stale);
    return found.filter(isActive);
}

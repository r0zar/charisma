import { LimitOrder, NewOrderRequest } from './types';
// @ts-ignore: vercel/kv runtime import without types
import { kv } from '@vercel/kv';

const HASH_KEY = 'orders'; // Redis hash holding order JSON blobs

export async function addOrder(req: NewOrderRequest): Promise<LimitOrder> {
    const order: LimitOrder = {
        ...req,
        status: 'open',
        createdAt: new Date().toISOString(),
    };
    await kv.hset(HASH_KEY, { [order.uuid]: JSON.stringify(order) });
    return order;
}

export async function getOrder(uuid: string): Promise<LimitOrder | undefined> {
    const raw = await kv.hget(HASH_KEY, uuid);
    if (!raw) return undefined;
    return typeof raw === 'string' ? (JSON.parse(raw) as LimitOrder) : (raw as LimitOrder);
}

export async function listOrders(owner?: string): Promise<LimitOrder[]> {
    const map = await kv.hgetall<Record<string, unknown>>(HASH_KEY);
    const all: LimitOrder[] = map ? Object.values(map).map((v) => (typeof v === 'string' ? JSON.parse(v) : v) as LimitOrder) : [];
    return owner ? all.filter((o) => o.owner === owner) : all;
}

export async function cancelOrder(uuid: string): Promise<LimitOrder | undefined> {
    const order = await getOrder(uuid);
    if (!order) return undefined;
    if (order.status === 'open') {
        order.status = 'cancelled';
        await kv.hset(HASH_KEY, { [uuid]: JSON.stringify(order) });
    }
    return order;
}

export async function fillOrder(uuid: string, txid: string): Promise<LimitOrder | undefined> {
    const order = await getOrder(uuid);
    if (!order) return undefined;
    if (order.status === 'open') {
        order.status = 'filled';
        order.txid = txid;
        await kv.hset(HASH_KEY, { [uuid]: JSON.stringify(order) });
    }
    return order;
}

export async function updateOrder(order: LimitOrder): Promise<void> {
    await kv.hset(HASH_KEY, { [order.uuid]: JSON.stringify(order) });
} 
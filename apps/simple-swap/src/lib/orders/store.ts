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

export interface PaginatedOrdersResult {
    orders: LimitOrder[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

export async function listOrders(owner?: string): Promise<LimitOrder[]> {
    const map = await kv.hgetall<Record<string, unknown>>(HASH_KEY);
    const all: LimitOrder[] = map ? Object.values(map).map((v) => (typeof v === 'string' ? JSON.parse(v) : v) as LimitOrder) : [];
    return owner ? all.filter((o) => o.owner === owner) : all;
}

export async function listOrdersPaginated(
    owner?: string,
    page: number = 1,
    limit: number = 10,
    sortBy: 'createdAt' | 'status' = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
    statusFilter?: 'all' | 'open' | 'broadcasted' | 'confirmed' | 'failed' | 'cancelled',
    searchQuery?: string
): Promise<PaginatedOrdersResult> {
    const map = await kv.hgetall<Record<string, unknown>>(HASH_KEY);
    const all: LimitOrder[] = map ? Object.values(map).map((v) => (typeof v === 'string' ? JSON.parse(v) : v) as LimitOrder) : [];

    // Filter by owner if specified
    let filtered = owner ? all.filter((o) => o.owner === owner) : all;

    // Filter by status if specified
    if (statusFilter && statusFilter !== 'all') {
        filtered = filtered.filter((o) => o.status === statusFilter);
    }

    // Filter by search query if specified
    if (searchQuery && searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        filtered = filtered.filter((o) => {
            return (
                o.uuid.toLowerCase().includes(query) ||
                o.owner.toLowerCase().includes(query) ||
                o.inputToken.toLowerCase().includes(query) ||
                o.outputToken.toLowerCase().includes(query) ||
                (o.conditionToken && o.conditionToken.toLowerCase().includes(query)) ||
                (o.txid && o.txid.toLowerCase().includes(query))
            );
        });
    }

    // Sort orders
    const sorted = filtered.sort((a, b) => {
        if (sortBy === 'createdAt') {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        } else if (sortBy === 'status') {
            // Sort by status priority: open > broadcasted > confirmed > failed > cancelled
            const statusPriority = { open: 5, broadcasted: 4, confirmed: 3, failed: 2, cancelled: 1 };
            const priorityA = statusPriority[a.status] || 0;
            const priorityB = statusPriority[b.status] || 0;
            if (priorityA !== priorityB) {
                return sortOrder === 'desc' ? priorityB - priorityA : priorityA - priorityB;
            }
            // If same status, sort by creation date
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        }
        return 0;
    });

    // Pagination calculation
    const total = sorted.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const orders = sorted.slice(startIndex, endIndex);

    return {
        orders,
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
    };
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

export async function broadcastOrder(uuid: string, txid: string): Promise<LimitOrder | undefined> {
    const order = await getOrder(uuid);
    if (!order) return undefined;
    if (order.status === 'open') {
        order.status = 'broadcasted';
        order.txid = txid;
        await kv.hset(HASH_KEY, { [uuid]: JSON.stringify(order) });
    }
    return order;
}

export async function confirmOrder(uuid: string, blockHeight?: number, blockTime?: number): Promise<LimitOrder | undefined> {
    const order = await getOrder(uuid);
    if (!order) {
        console.warn(`[ORDERS] confirmOrder: Order ${uuid} not found`);
        return undefined;
    }

    // Handle both 'broadcasted' and legacy 'filled' statuses
    // @ts-ignore: legacy filled status
    if (order.status === 'broadcasted' || order.status === 'filled') {
        console.log(`[ORDERS] Confirming order ${uuid}: ${order.status} -> confirmed`);
        order.status = 'confirmed';
        order.blockHeight = blockHeight;
        order.blockTime = blockTime;
        order.confirmedAt = new Date().toISOString();
        await kv.hset(HASH_KEY, { [uuid]: JSON.stringify(order) });
        console.log(`[ORDERS] ✅ Order ${uuid} successfully updated to confirmed status`);
    } else {
        console.warn(`[ORDERS] Cannot confirm order ${uuid}: current status is '${order.status}', expected 'broadcasted' or 'filled'`);
    }
    return order;
}

export async function failOrder(uuid: string, reason: string): Promise<LimitOrder | undefined> {
    const order = await getOrder(uuid);
    if (!order) {
        console.warn(`[ORDERS] failOrder: Order ${uuid} not found`);
        return undefined;
    }

    // Handle both 'broadcasted' and legacy 'filled' statuses
    // @ts-ignore: legacy filled status
    if (order.status === 'broadcasted' || order.status === 'filled') {
        console.log(`[ORDERS] Failing order ${uuid}: ${order.status} -> failed (${reason})`);
        order.status = 'failed';
        order.failedAt = new Date().toISOString();
        order.failureReason = reason;
        await kv.hset(HASH_KEY, { [uuid]: JSON.stringify(order) });
        console.log(`[ORDERS] ❌ Order ${uuid} successfully updated to failed status`);
    } else {
        console.warn(`[ORDERS] Cannot fail order ${uuid}: current status is '${order.status}', expected 'broadcasted' or 'filled'`);
    }
    return order;
}

// Legacy function for backward compatibility
export async function fillOrder(uuid: string, txid: string): Promise<LimitOrder | undefined> {
    console.warn('fillOrder is deprecated, use broadcastOrder instead');
    return broadcastOrder(uuid, txid);
}

export async function updateOrder(order: LimitOrder): Promise<void> {
    await kv.hset(HASH_KEY, { [order.uuid]: JSON.stringify(order) });
} 
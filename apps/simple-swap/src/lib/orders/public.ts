import { createHash } from 'node:crypto';
import type { LimitOrder, PublicOrder } from './types';

/**
 * The id public APIs show for an order. A uuid is a bearer secret until the order runs: anyone who knows it can spend it
 * on-chain (blaze-v1 records used uuids before checking the signature), which would block the order for good. So the
 * outside world gets a one-way, uuid-shaped handle instead; the server accepts either (see findOrder).
 */
export function orderHandle(uuid: string): string {
    const h = createHash('sha256').update(`charisma-order:${uuid}`).digest('hex');
    // shaped like a v4 uuid so every client and validator that expects one keeps working
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * An order as public APIs return it: no signature (the legacy router lets whoever submits it choose the payout, so it
 * must never leave the server) and a handle in place of the uuid.
 */
export const toPublicOrder = ({ signature: _signature, ...order }: LimitOrder): PublicOrder => ({ ...order, uuid: orderHandle(order.uuid) });

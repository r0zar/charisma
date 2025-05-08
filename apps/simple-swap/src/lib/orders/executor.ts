import { listOrders, fillOrder } from './store';
import { LimitOrder } from './types';
import { getLatestPrice } from '@/lib/price/store';
import { getQuote } from '@/app/actions';
// @ts-ignore: vercel/kv runtime import without types
import { kv } from '@vercel/kv';
import { Dexterity } from '../dexterity-client';

/**
 * Fetches the current price for a given token pair.
 * Right now this is a stub that simply returns 1:1. You should
 * replace it with a real oracle or DEX quote service.
 */
async function getCurrentPrice(order: LimitOrder): Promise<number> {
    // use conditionToken if provided, otherwise default to outputToken
    const watchedToken = order.conditionToken || order.outputToken;
    const pair = `${order.inputToken}-${watchedToken}`;
    const price = await getLatestPrice(pair);
    if (price !== undefined) return price;
    // fallback placeholder
    return 1;
}

/**
 * Executes the trade on-chain via the signer API and returns the txid.
 * You can point SIGNER_URL env var at the blaze-signer instance.
 */
async function executeTrade(order: LimitOrder): Promise<string> {
    const quoteRes = await getQuote(order.inputToken, order.outputToken, order.amountIn);
    if (!quoteRes.success || !quoteRes.data) throw new Error('Route fetch failed');

    const tx = await Dexterity.buildXSwapTransaction(
        quoteRes.data.route,
        {
            amountIn: order.amountIn,
            signature: order.signature,
            uuid: order.uuid,
            recipient: order.recipient,
        }
    );

    const payload = {
        tx,
        signature: order.signature,
        uuid: order.uuid,
    };

    const url = `${process.env.SIGNER_URL ?? 'http://localhost:3005'}/api/multihop/execute`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Signer ${res.status}`);
    const data = (await res.json()) as { txid: string };
    return data.txid;
}

/**
 * Determines whether an order should be filled based on current price.
 * Currently supports simple >= comparison; extend as needed.
 */
function shouldFill(order: LimitOrder, currentPrice: number): boolean {
    const target = Number(order.targetPrice);
    if (order.direction === 'lt') {
        return currentPrice <= target;
    }
    // default / 'gt'
    return currentPrice >= target;
}

// Acquire a short-lived lock for the order. Returns true if acquired.
async function acquireLock(uuid: string, ttlSec = 30): Promise<boolean> {
    const key = `lock:order:${uuid}`;
    // NX – set only if not exists
    // EX – seconds to live (auto-release)
    // @ts-ignore
    const res = await kv.set(key, '1', { nx: true, ex: ttlSec });
    // redis returns 'OK' when set, null otherwise
    return res === 'OK';
}

async function releaseLock(uuid: string): Promise<void> {
    const key = `lock:order:${uuid}`;
    await kv.del(key);
}

/**
 * Loops through all open orders and executes any that meet their price condition.
 * Returns the UUIDs of all orders that were filled during this run.
 */
export async function processOpenOrders(): Promise<string[]> {
    const openOrders = (await listOrders()).filter((o) => o.status === 'open');
    const filled: string[] = [];

    for (const order of openOrders) {
        // attempt to grab lock; skip if another instance holds it
        const gotLock = await acquireLock(order.uuid, 60); // 1-min safety lock
        if (!gotLock) {
            continue; // another worker processing
        }

        try {
            const price = await getCurrentPrice(order);
            if (!shouldFill(order, price)) {
                // release lock early if condition not met
                await releaseLock(order.uuid);
                continue;
            }

            const txid = await executeTrade(order);
            await fillOrder(order.uuid, txid);
            filled.push(order.uuid);
            // lock will expire; no need manual release
        } catch (err) {
            console.error(`Failed to process order ${order.uuid}:`, err);
            // release lock to allow retry
            await releaseLock(order.uuid);
        }
    }

    return filled;
} 
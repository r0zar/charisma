import { listOrders, fillOrder, updateOrder } from './store';
import { LimitOrder } from './types';
import { getLatestPrice } from '@/lib/price/store';
import { getQuote } from '@/app/actions';
import { kv } from '@vercel/kv';
import { Dexterity } from '../dexterity-client';
import { log } from '@repo/logger';

/**
 * Fetches the current price for a given token pair.
 * Right now this is a stub that simply returns 1:1. You should
 * replace it with a real oracle or DEX quote service.
 */
async function getCurrentPrice(order: LimitOrder): Promise<number | undefined> {
    console.log('getCurrentPrice', order);
    // use conditionToken if provided, otherwise default to outputToken
    const watchedToken = order.conditionToken || order.outputToken;
    log({ orderUuid: order.uuid, watchedToken }, `Watched token selected.`);

    // Fetch the USD price for the single watched token
    log({ orderUuid: order.uuid, contractId: watchedToken }, `Fetching latest price for token ${watchedToken}`);
    const price = await getLatestPrice(watchedToken); // Use watchedToken directly
    log({ orderUuid: order.uuid, contractId: watchedToken, fetchedPrice: price }, `Fetched price from store: ${price}`);

    if (price !== undefined) return price;
    // fallback placeholder
    return undefined;
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
    log('Starting processOpenOrders job');
    const openOrders = (await listOrders()).filter((o) => o.status === 'open');
    log({ orderCount: openOrders.length }, `Found ${openOrders.length} open orders to process.`);
    const filled: string[] = [];

    for (const order of openOrders) {
        // attempt to grab lock; skip if another instance holds it
        log({ orderUuid: order.uuid }, 'Attempting to acquire lock');
        const gotLock = await acquireLock(order.uuid, 60); // 1-min safety lock
        if (!gotLock) {
            log({ orderUuid: order.uuid }, 'Lock already held, skipping order for this run.');
            continue; // another worker processing
        }
        log({ orderUuid: order.uuid }, 'Lock acquired successfully');

        // -------------------------------------------------------------
        // 1. Check execution window (validFrom / validTo)
        // -------------------------------------------------------------
        const now = Date.now();
        const validFromMs = order.validFrom ? Date.parse(order.validFrom) : undefined;
        const validToMs = order.validTo ? Date.parse(order.validTo) : undefined;

        // If order is not yet active
        if (validFromMs !== undefined && now < validFromMs) {
            log({ orderUuid: order.uuid, validFrom: order.validFrom }, 'Order not yet within execution window. Releasing lock.');
            await releaseLock(order.uuid);
            continue;
        }

        // If order has expired
        if (validToMs !== undefined && now > validToMs) {
            log({ orderUuid: order.uuid, validTo: order.validTo }, 'Order expired. Marking cancelled.');
            order.status = 'cancelled';
            await updateOrder(order);
            await releaseLock(order.uuid);
            continue;
        }

        try {
            log({ orderUuid: order.uuid, conditionToken: order.conditionToken }, 'Fetching current price for condition token');
            const price = await getCurrentPrice(order);

            if (price === undefined) {
                log({ orderUuid: order.uuid, conditionToken: order.conditionToken }, 'Could not find current price for condition token. Skipping order.');
                await releaseLock(order.uuid);
                continue; // Skip to next order
            }

            log({ orderUuid: order.uuid, currentPrice: price, targetPrice: order.targetPrice, direction: order.direction }, 'Checking fill condition');
            if (!shouldFill(order, price)) {
                log({ orderUuid: order.uuid, currentPrice: price }, 'Fill condition not met, releasing lock.');
                // release lock early if condition not met
                await releaseLock(order.uuid);
                continue;
            }

            log({ orderUuid: order.uuid }, 'Fill condition met. Attempting to execute trade.');
            const txid = await executeTrade(order);
            log({ orderUuid: order.uuid, txid }, 'Trade executed successfully. Marking order as filled.');
            await fillOrder(order.uuid, txid);
            filled.push(order.uuid);
            // lock will expire; no need manual release
            log({ orderUuid: order.uuid }, 'Order processed and filled. Lock will auto-expire.');
        } catch (err) {
            log({ orderUuid: order.uuid, error: err }, `Failed to process order ${order.uuid}. Releasing lock.`);
            // release lock to allow retry
            await releaseLock(order.uuid);
        }
    }

    log({ filledCount: filled.length, processedCount: openOrders.length }, 'Finished processOpenOrders job.');
    return filled;
} 
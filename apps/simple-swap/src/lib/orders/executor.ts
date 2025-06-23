import { listOrders, fillOrder, updateOrder } from './store';
import { LimitOrder } from './types';
import { getLatestPrice } from '@/lib/price/store';
import { getQuote } from '@/app/actions';
import { kv } from '@vercel/kv';
import { sendOrderExecutedNotification } from '@/lib/notifications/order-executed-handler';
import { executeMultihopSwap } from 'blaze-sdk';

/**
 * Fetches the current price ratio for a given order.
 * The ratio is calculated as price(conditionToken) / price(baseAsset).
 * If baseAsset is not defined or is a known stablecoin (like sUSDT),
 * it effectively compares the conditionToken's price against a USD target.
 * Special case: if conditionToken is '*', return 1 for immediate execution.
 */
async function getCurrentPriceRatio(order: LimitOrder): Promise<number | undefined> {
    const conditionTokenContract = order.conditionToken;
    
    // Safety check - this function should only be called for conditional orders
    if (!conditionTokenContract) {
        console.log({ orderUuid: order.uuid }, 'getCurrentPriceRatio called for manual order - this should not happen');
        return undefined;
    }
    
    // Handle wildcard immediate execution
    if (conditionTokenContract === '*') {
        console.log({ orderUuid: order.uuid }, 'Wildcard immediate execution detected - returning ratio 1');
        return 1; // Any positive number that will satisfy the condition
    }
    
    // Default to sUSDT if baseAsset is not specified, effectively making it a USD price comparison.
    const baseAssetContract = order.baseAsset || 'SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK.token-susdt';

    console.log({ orderUuid: order.uuid, conditionTokenContract, baseAssetContract }, `Fetching prices for ratio.`);

    const priceConditionToken = await getLatestPrice(conditionTokenContract);
    const priceBaseAsset = await getLatestPrice(baseAssetContract);

    if (priceConditionToken === undefined || priceBaseAsset === undefined) {
        console.log({ orderUuid: order.uuid, priceConditionToken, priceBaseAsset }, "Could not fetch one or both prices for ratio.");
        return undefined;
    }

    if (priceBaseAsset === 0) {
        console.log({ orderUuid: order.uuid, priceBaseAsset }, "Base asset price is zero, cannot calculate ratio.");
        return undefined;
    }

    const currentRatio = priceConditionToken / priceBaseAsset;
    console.log({ orderUuid: order.uuid, currentRatio, priceConditionToken, priceBaseAsset }, `Calculated current price ratio: ${currentRatio}`);
    return currentRatio;
}

/**
 * Executes the trade on-chain via the signer API and returns the txid.
 * You can point SIGNER_URL env var at the blaze-signer instance.
 */
export async function executeTrade(order: LimitOrder): Promise<string> {
    // get quote for multi-hop swap
    console.log({ orderUuid: order.uuid, inputToken: order.inputToken, outputToken: order.outputToken, amountIn: order.amountIn }, 'Fetching quote for order execution');
    const quoteRes = await getQuote(order.inputToken, order.outputToken, order.amountIn);
    console.log({ orderUuid: order.uuid, quoteRes }, 'Quote result');

    if (!quoteRes.success || !quoteRes.data) {
        const errorMessage = `Route fetch failed: ${quoteRes.error || 'No route data returned'}`;
        console.error({ orderUuid: order.uuid, error: errorMessage, quoteRes }, 'Failed to get quote for order execution');
        throw new Error(errorMessage);
    }

    const result = await executeMultihopSwap(
        quoteRes.data,
        {
            amountIn: order.amountIn,
            signature: order.signature,
            uuid: order.uuid,
            recipient: order.recipient,
        },
        process.env.PRIVATE_KEY!
    );

    return result.txid;
}

/**
 * Determines whether an order should be filled based on current price.
 * Currently supports simple >= comparison; extend as needed.
 * Note: This function should only be called for conditional orders.
 */
function shouldFill(order: LimitOrder, currentPrice: number): boolean {
    // Safety check - this function should only be called for conditional orders
    if (order.targetPrice === undefined || order.targetPrice === null || !order.direction) {
        console.log({ orderUuid: order.uuid }, 'shouldFill called for manual order - this should not happen');
        return false;
    }
    
    const target = Number(order.targetPrice);
    if (isNaN(target)) {
        console.log({ orderUuid: order.uuid, targetPrice: order.targetPrice }, 'Invalid target price in shouldFill');
        return false;
    }
    
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
    console.log('Starting processOpenOrders job');
    const openOrders = (await listOrders()).filter((o) => o.status === 'open');
    console.log({ orderCount: openOrders.length }, `Found ${openOrders.length} open orders to process.`);
    const filled: string[] = [];

    for (const order of openOrders) {
        // attempt to grab lock; skip if another instance holds it
        console.log({ orderUuid: order.uuid }, 'Attempting to acquire lock');
        const gotLock = await acquireLock(order.uuid, 60); // 1-min safety lock
        if (!gotLock) {
            console.log({ orderUuid: order.uuid }, 'Lock already held, skipping order for this run.');
            continue; // another worker processing
        }
        console.log({ orderUuid: order.uuid }, 'Lock acquired successfully');

        // -------------------------------------------------------------
        // 1. Check execution window (validFrom / validTo)
        // -------------------------------------------------------------
        const now = Date.now();
        const validFromMs = order.validFrom ? Date.parse(order.validFrom) : undefined;
        const validToMs = order.validTo ? Date.parse(order.validTo) : undefined;

        // If order is not yet active
        if (validFromMs !== undefined && now < validFromMs) {
            console.log({ orderUuid: order.uuid, validFrom: order.validFrom }, 'Order not yet within execution window. Releasing lock.');
            await releaseLock(order.uuid);
            continue;
        }

        // If order has expired
        if (validToMs !== undefined && now > validToMs) {
            console.log({ orderUuid: order.uuid, validTo: order.validTo }, 'Order expired. Marking cancelled.');
            order.status = 'cancelled';
            await updateOrder(order);
            await releaseLock(order.uuid);
            continue;
        }

        try {
            // -------------------------------------------------------------
            // 2. Check if this is a manual order (no conditions) or wildcard order
            // -------------------------------------------------------------
            
            // Check for wildcard immediate execution first
            if (order.conditionToken === '*') {
                console.log({ orderUuid: order.uuid }, 'Wildcard immediate execution order detected - processing immediately');
                // Skip ratio fetching for wildcard orders, go straight to execution
            } else if (!order.conditionToken || order.targetPrice === undefined || order.targetPrice === null || !order.direction) {
                console.log({ orderUuid: order.uuid }, 'Manual order detected (no conditions). Skipping automated processing - must be executed manually via API.');
                await releaseLock(order.uuid);
                continue;
            }

            // -------------------------------------------------------------
            // 3. Process conditional order or execute wildcard immediately
            // -------------------------------------------------------------
            
            let shouldExecute = false;
            
            if (order.conditionToken === '*') {
                // Wildcard immediate execution - always execute
                console.log({ orderUuid: order.uuid }, 'Wildcard order - executing immediately without condition checks');
                shouldExecute = true;
            } else {
                // Regular conditional order - check price conditions
                console.log({ orderUuid: order.uuid, conditionToken: order.conditionToken, baseAsset: order.baseAsset }, 'Fetching current price ratio for conditional order');
                const currentMarketRatio = await getCurrentPriceRatio(order);

                if (currentMarketRatio === undefined) {
                    console.log({ orderUuid: order.uuid, conditionToken: order.conditionToken, baseAsset: order.baseAsset }, 'Could not determine current market ratio. Skipping order.');
                    await releaseLock(order.uuid);
                    continue; // Skip to next order
                }

                console.log({ orderUuid: order.uuid, currentMarketRatio, targetPrice: order.targetPrice, direction: order.direction }, 'Checking fill condition with ratio');
                shouldExecute = shouldFill(order, currentMarketRatio);
                
                if (!shouldExecute) {
                    console.log({ orderUuid: order.uuid, currentMarketRatio }, 'Fill condition (ratio) not met, releasing lock.');
                    // release lock early if condition not met
                    await releaseLock(order.uuid);
                    continue;
                }
            }
            
            if (shouldExecute) {
                console.log({ orderUuid: order.uuid }, 'Condition met or wildcard order. Attempting to execute trade.');
                const txid = await executeTrade(order);
                console.log({ orderUuid: order.uuid, txid }, 'Trade executed successfully. Marking order as filled.');
                await fillOrder(order.uuid, txid);

                // Send notification (fire-and-forget style, errors handled within the function)
                sendOrderExecutedNotification(order, txid).catch(err => {
                    console.log({ orderUuid: order.uuid, error: err }, 'Failed to dispatch order execution notification task.');
                });

                filled.push(order.uuid);
                // lock will expire; no need manual release
                console.log({ orderUuid: order.uuid }, 'Order processed and filled. Lock will auto-expire.');
            }
        } catch (err) {
            console.log({ orderUuid: order.uuid, error: err }, `Failed to process order ${order.uuid}. Releasing lock.`);
            // release lock to allow retry
            await releaseLock(order.uuid);
        }
    }

    console.log({ filledCount: filled.length, processedCount: openOrders.length }, 'Finished processOpenOrders job.');
    return filled;
} 
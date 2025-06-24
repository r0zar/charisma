import { listOrders, fillOrder, updateOrder } from './store';
import { LimitOrder } from './types';
import { getLatestPrice } from '@/lib/price/store';
import { getQuote } from '@/app/actions';
import { sendOrderExecutedNotification } from '@/lib/notifications/order-executed-handler';
import { executeMultihopSwap, buildXSwapTransaction, broadcastMultihopTransaction } from 'blaze-sdk';
import { fetchNonce } from '@stacks/transactions';
import { BLAZE_SIGNER_PRIVATE_KEY, BLAZE_SOLVER_ADDRESS } from '@/lib/constants';

/**
 * Nonce management following meme-roulette's proven approach
 * Get blockchain nonce once and increment sequentially for batch processing
 */
let currentNonce: number | null = null;
let lastNonceFetch: number = 0;
const NONCE_CACHE_TTL = 30000; // 30 seconds

async function getNextNonce(useBlockchainNonce: boolean = false): Promise<number> {
    try {
        const now = Date.now();
        
        // For first transaction or when cache expires, fetch fresh nonce
        if (currentNonce === null || useBlockchainNonce || (now - lastNonceFetch) > NONCE_CACHE_TTL) {
            console.log(`[Nonce] Fetching fresh blockchain nonce`);
            const blockchainNonce = await fetchNonce({ address: BLAZE_SOLVER_ADDRESS });
            currentNonce = Number(blockchainNonce) + 1;
            lastNonceFetch = now;
            console.log(`[Nonce] Using fresh blockchain nonce: ${currentNonce}`);
        } else {
            // For subsequent transactions, increment sequentially
            currentNonce++;
            console.log(`[Nonce] Using sequential nonce: ${currentNonce}`);
        }
        
        return currentNonce;

    } catch (error) {
        console.error('[Nonce] Error fetching blockchain nonce:', error);
        // Reset cache on error
        currentNonce = null;
        throw error;
    }
}

// Helper function for delay (following meme-roulette pattern)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Simple retry wrapper with exponential backoff for nonce conflicts
 */
async function executeWithRetry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000
): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error as Error;
            const errorMessage = error instanceof Error ? error.message : String(error);

            // Check if it's a nonce conflict
            const isNonceConflict = errorMessage.includes('ConflictingNonceInMempool') ||
                errorMessage.includes('nonce') ||
                errorMessage.includes('BadNonce');

            if (isNonceConflict && attempt < maxAttempts) {
                const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff: 1s, 2s, 4s
                console.log(`[Retry] Nonce conflict detected (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            // If it's not a nonce conflict or we've exhausted retries, throw
            throw error;
        }
    }

    throw lastError;
}

/**
 * Enhanced executeMultihopSwap with intelligent nonce management and retry logic
 */
async function executeMultihopSwapWithNonce(
    route: any,
    meta: any,
    privateKey: string,
    config?: any,
    slippage?: number,
    useBlockchainNonce?: boolean
): Promise<any> {
    return executeWithRetry(async () => {
        try {
            console.log(`[Nonce] Using ${useBlockchainNonce ? 'blockchain' : 'atomic'} nonce management for transaction broadcasting`);
            const uniqueNonce = await getNextNonce(useBlockchainNonce);
            console.log('[Nonce] Using unique nonce:', uniqueNonce);

            // Build transaction config with explicit nonce and slippage
            const metaWithSlippage = slippage !== undefined ? { ...meta, slippage } : meta;
            const txConfig = await buildXSwapTransaction(route, metaWithSlippage, config);
            txConfig.nonce = uniqueNonce;

            console.log('[Nonce] Broadcasting multihop transaction with unique nonce:', uniqueNonce);
            const result = await broadcastMultihopTransaction(txConfig, privateKey);

            console.log('[Nonce] Transaction broadcast successful:', result);
            
            // Add delay after successful broadcast (following meme-roulette pattern)
            console.log('[Nonce] Adding 3-second delay after transaction broadcast...');
            await delay(3000);
            
            return result;

        } catch (error) {
            console.error('[Nonce] Error in nonce-managed multihop swap:', error);

            // Check if it's a nonce-related error
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('ConflictingNonceInMempool') || errorMessage.includes('nonce')) {
                console.log('[Nonce] Nonce conflict detected, will retry...');
                throw error; // Let the retry wrapper handle it
            }

            // For non-nonce errors, fall back to original function
            console.log('[Nonce] Non-nonce error, falling back to original executeMultihopSwap');
            const metaWithSlippage = slippage !== undefined ? { ...meta, slippage } : meta;
            return executeMultihopSwap(route, metaWithSlippage, privateKey, config);
        }
    });
}

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
export interface TradeExecutionResult {
    txid: string;
    success: boolean;
    response: any;
    error?: string;
}

export async function executeTrade(order: LimitOrder, slippage?: number, useBlockchainNonce?: boolean): Promise<TradeExecutionResult> {
    // get quote for multi-hop swap
    console.log({ orderUuid: order.uuid, inputToken: order.inputToken, outputToken: order.outputToken, amountIn: order.amountIn }, 'Fetching quote for order execution');
    const quoteRes = await getQuote(order.inputToken, order.outputToken, order.amountIn);
    console.log({ orderUuid: order.uuid, quoteRes }, 'Quote result');

    if (!quoteRes.success || !quoteRes.data) {
        const errorMessage = `Route fetch failed: ${quoteRes.error || 'No route data returned'}`;
        console.error({ orderUuid: order.uuid, error: errorMessage, quoteRes }, 'Failed to get quote for order execution');
        throw new Error(errorMessage);
    }

    const route = quoteRes.data;
    console.log({ orderUuid: order.uuid, route }, 'Executing multihop swap with route');

    // Store quote data in order metadata for display purposes
    try {
        const { updateOrder } = await import('./store');
        const updatedOrderWithQuote = {
            ...order,
            metadata: {
                ...order.metadata,
                quote: {
                    amountIn: route.amountIn,
                    amountOut: route.amountOut,
                    path: route.path,
                    timestamp: new Date().toISOString(),
                    slippage: slippage || 0.01 // Default 1% if not specified
                }
            }
        };
        await updateOrder(updatedOrderWithQuote);
        console.log({ orderUuid: order.uuid, quoteData: updatedOrderWithQuote.metadata.quote }, 'Stored quote data in order metadata');
    } catch (error) {
        console.error({ orderUuid: order.uuid, error }, 'Failed to store quote data in order metadata - continuing execution');
    }

    const result = await executeMultihopSwapWithNonce(
        route,
        {
            amountIn: order.amountIn,
            signature: order.signature,
            uuid: order.uuid,
            recipient: order.recipient,
        },
        BLAZE_SIGNER_PRIVATE_KEY!,
        undefined, // config
        slippage,
        useBlockchainNonce
    );

    // Log the complete response for debugging
    console.log({ orderUuid: order.uuid, fullSwapResult: result }, 'Complete executeMultihopSwap response');

    // Validate the response
    if (!result) {
        const errorMessage = 'executeMultihopSwap returned null/undefined response';
        console.error({ orderUuid: order.uuid, result }, errorMessage);
        throw new Error(errorMessage);
    }

    if (!result.txid) {
        const errorMessage = `Swap execution failed: No transaction ID returned. Response: ${JSON.stringify(result)}`;
        console.error({ orderUuid: order.uuid, result }, errorMessage);
        throw new Error(errorMessage);
    }

    // Check for any error indicators in the response
    if (result.error) {
        const errorMessage = `Swap execution failed: ${result.error}`;
        console.error({ orderUuid: order.uuid, result }, errorMessage);

        // Handle specific error types more gracefully
        if (result.reason === 'ConflictingNonceInMempool') {
            return {
                txid: result.txid || '', // Sometimes we still get a txid even with nonce conflicts
                success: false,
                response: result,
                error: `Transaction submitted but conflicting nonce in mempool. Reason: ${result.reason}. This may resolve automatically.`
            };
        }

        return {
            txid: '',
            success: false,
            response: result,
            error: errorMessage
        };
    }

    // Success case
    console.log({ orderUuid: order.uuid, txid: result.txid }, '✅ Trade execution successful');

    return {
        txid: result.txid,
        success: true,
        response: result,
    };
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
                const executionResult = await executeTrade(order);
                console.log({ orderUuid: order.uuid, executionResult }, 'Trade execution completed.');

                if (!executionResult.success || !executionResult.txid) {
                    console.error({ orderUuid: order.uuid, executionResult }, 'Trade execution failed');
                    continue; // Skip to next order
                }

                console.log({ orderUuid: order.uuid, txid: executionResult.txid }, 'Trade executed successfully. Marking order as filled.');
                await fillOrder(order.uuid, executionResult.txid);

                // Send notification (fire-and-forget style, errors handled within the function)
                sendOrderExecutedNotification(order, executionResult.txid).catch(err => {
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
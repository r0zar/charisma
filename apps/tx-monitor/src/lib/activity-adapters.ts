/**
 * Data adapters to convert transaction data into unified ActivityItem format
 * Transforms data from swaps, orders, and other sources into timeline activities
 */

import { ActivityItem, ActivityType, ActivityStatus, TokenInfo } from './activity-types';
import { kv } from '@vercel/kv';
import { listPrices } from '@repo/tokens';

/**
 * Helper to normalize timestamps to Unix milliseconds
 */
function normalizeTimestamp(timestamp: string | number): number {
  if (typeof timestamp === 'number') {
    // If it's already a number, assume it's Unix timestamp
    // Convert to milliseconds if it appears to be in seconds
    return timestamp < 10000000000 ? timestamp * 1000 : timestamp;
  }

  // If it's a string, parse ISO date
  return new Date(timestamp).getTime();
}

/**
 * Capture price snapshot for a token using @packages/tokens
 */
async function captureTokenPriceSnapshot(tokenId: string): Promise<TokenInfo['priceSnapshot'] | undefined> {
  try {
    // Use @packages/tokens to get current prices
    const priceData = await listPrices({
      strategy: 'fallback',
      sources: { stxtools: true, internal: true },
      timeout: 5000
    });

    const price = priceData[tokenId];
    if (typeof price === 'number' && price > 0) {
      return {
        price,
        timestamp: Date.now(),
        source: 'packages-tokens'
      };
    }

    // Handle STX special case
    if (tokenId === 'STX' || tokenId === '.stx') {
      const stxPrice = priceData['.stx'] || priceData['stx'];
      if (typeof stxPrice === 'number' && stxPrice > 0) {
        return {
          price: stxPrice,
          timestamp: Date.now(),
          source: 'packages-tokens'
        };
      }
    }

    // Fallback for stablecoins
    if (tokenId.includes('usdc') || tokenId.includes('USDC') ||
        tokenId.includes('usdt') || tokenId.includes('USDT') ||
        tokenId.includes('dai') || tokenId.includes('DAI')) {
      return {
        price: 1.0,
        timestamp: Date.now(),
        source: 'stablecoin-fallback'
      };
    }

    console.warn(`[TX-MONITOR] Could not fetch price for token ${tokenId} from @packages/tokens`);
    return undefined;
  } catch (error) {
    console.error(`[TX-MONITOR] Error fetching price snapshot for ${tokenId}:`, error);
    return undefined;
  }
}

/**
 * Helper to create TokenInfo from token contract ID with price snapshot
 */
async function createTokenInfo(tokenId: string, amount: string, decimals = 6): Promise<TokenInfo> {
  // Extract symbol from contract ID or use the ID itself
  let symbol = tokenId;
  if (tokenId.includes('.')) {
    const parts = tokenId.split('.');
    symbol = parts[parts.length - 1].toUpperCase();
  } else if (tokenId === 'STX') {
    symbol = 'STX';
  }

  // Capture price snapshot for historical accuracy
  const priceSnapshot = await captureTokenPriceSnapshot(tokenId);

  // Calculate USD value if we have price and amount
  let usdValue: number | undefined;
  if (priceSnapshot && amount && amount !== '0') {
    const tokenAmount = parseFloat(amount) / Math.pow(10, decimals);
    usdValue = tokenAmount * priceSnapshot.price;
  }

  return {
    symbol,
    amount,
    contractId: tokenId,
    decimals,
    usdValue,
    priceSnapshot
  };
}

/**
 * Generate activity ID from transaction data
 */
function generateActivityId(type: ActivityType, sourceId: string): string {
  const timestamp = Date.now();
  const prefix = type.replace(/_/g, '-');
  return `${prefix}-${timestamp}-${sourceId.slice(0, 8)}`;
}

/**
 * Create activity from transaction data and mapping
 */
export async function createActivityFromTransaction(
  txid: string,
  recordId: string,
  recordType: 'order' | 'swap'
): Promise<ActivityItem | null> {
  try {
    console.log(`[TX-MONITOR] Creating activity for transaction ${txid}, record ${recordId}, type ${recordType}`);

    if (recordType === 'swap') {
      return await createSwapActivity(txid, recordId);
    } else if (recordType === 'order') {
      return await createOrderActivity(txid, recordId);
    }

    return null;
  } catch (error) {
    console.error(`[TX-MONITOR] Error creating activity for transaction ${txid}:`, error);
    return null;
  }
}

/**
 * Create activity from swap record
 */
async function createSwapActivity(txid: string, swapId: string): Promise<ActivityItem | null> {
  try {
    // Fetch swap record from simple-swap storage
    const swapData = await kv.hget('swap-records', swapId);
    if (!swapData) {
      console.warn(`[TX-MONITOR] No swap record found for ${swapId}`);
      return null;
    }

    const swap = typeof swapData === 'string' ? JSON.parse(swapData) : swapData;

    // Create token info with price snapshots
    const fromToken = await createTokenInfo(swap.inputToken, swap.inputAmount, 6);
    const toToken = await createTokenInfo(swap.outputToken, swap.outputAmount || '0', 6);

    console.log(`[TX-MONITOR] Captured price snapshots - From: ${fromToken.priceSnapshot?.price || 'N/A'}, To: ${toToken.priceSnapshot?.price || 'N/A'}`);

    // Create activity from swap data
    const activity: ActivityItem = {
      id: generateActivityId('instant_swap', swapId),
      type: 'instant_swap',
      timestamp: normalizeTimestamp(swap.timestamp),
      status: mapSwapStatusToActivity(swap.status),
      owner: swap.owner,
      fromToken,
      toToken,
      txid: txid,
      route: swap.routePath || [],
      priceImpact: swap.priceImpact,
      replyCount: 0,
      hasReplies: false,
      metadata: {
        router: 'dexterity',
        isSubnetShift: swap.metadata?.isSubnetShift || false,
        notes: 'Instant swap transaction',
        priceSnapshotCaptured: Date.now()
      }
    };

    console.log(`[TX-MONITOR] Created swap activity: ${activity.id}`);
    return activity;

  } catch (error) {
    console.error(`[TX-MONITOR] Error creating swap activity for ${swapId}:`, error);
    return null;
  }
}

/**
 * Create activity from order record
 */
async function createOrderActivity(txid: string, orderId: string): Promise<ActivityItem | null> {
  try {
    // Fetch order record from simple-swap storage
    const orderData = await kv.hget('orders', orderId);
    if (!orderData) {
      console.warn(`[TX-MONITOR] No order record found for ${orderId}`);
      return null;
    }

    const order = typeof orderData === 'string' ? JSON.parse(orderData) : orderData;

    // Determine activity type based on order status
    let activityType: ActivityType = 'order_filled';
    if (order.status === 'cancelled') {
      activityType = 'order_cancelled';
    } else if (order.strategy === 'dca') {
      activityType = 'dca_update';
    } else if (order.strategy === 'twitter') {
      activityType = 'twitter_trigger';
    }

    // Create token info with price snapshots
    const fromToken = await createTokenInfo(order.fromToken, order.amountIn, 6);
    const toToken = await createTokenInfo(order.toToken, order.amountOut || '0', 6);

    console.log(`[TX-MONITOR] Captured price snapshots for order - From: ${fromToken.priceSnapshot?.price || 'N/A'}, To: ${toToken.priceSnapshot?.price || 'N/A'}`);

    // Create activity from order data
    const activity: ActivityItem = {
      id: generateActivityId(activityType, orderId),
      type: activityType,
      timestamp: normalizeTimestamp(order.timestamp),
      status: mapOrderStatusToActivity(order.status),
      owner: order.owner,
      fromToken,
      toToken,
      txid: txid,
      orderType: order.conditionType || 'manual',
      targetPrice: order.targetPrice,
      executionPrice: order.executionPrice,
      strategy: order.strategy || 'single',
      strategyPosition: order.strategyPosition,
      strategyTotal: order.strategyTotal,
      replyCount: 0,
      hasReplies: false,
      metadata: {
        notes: order.description || 'Triggered order execution',
        isTwitterTriggered: order.strategy === 'twitter',
        twitterHandle: order.twitterHandle,
        cancellationReason: order.cancellationReason,
        priceSnapshotCaptured: Date.now()
      }
    };

    console.log(`[TX-MONITOR] Created order activity: ${activity.id}`);
    return activity;

  } catch (error) {
    console.error(`[TX-MONITOR] Error creating order activity for ${orderId}:`, error);
    return null;
  }
}

/**
 * Create activity from transaction without mapping (discovered transaction)
 */
export async function createActivityFromUnknownTransaction(txid: string): Promise<ActivityItem | null> {
  try {
    console.log(`[TX-MONITOR] Creating activity for unknown transaction ${txid}`);

    // Create token info (will not have price snapshots for unknown tokens)
    const fromToken = await createTokenInfo('unknown', '0');
    const toToken = await createTokenInfo('unknown', '0');

    // Create a generic activity for unknown transactions
    const activity: ActivityItem = {
      id: generateActivityId('instant_swap', txid),
      type: 'instant_swap',
      timestamp: Date.now(),
      status: 'pending',
      owner: 'unknown',
      fromToken,
      toToken,
      txid: txid,
      replyCount: 0,
      hasReplies: false,
      metadata: {
        notes: 'Transaction discovered in monitoring queue'
      }
    };

    console.log(`[TX-MONITOR] Created unknown transaction activity: ${activity.id}`);
    return activity;

  } catch (error) {
    console.error(`[TX-MONITOR] Error creating activity for unknown transaction ${txid}:`, error);
    return null;
  }
}

/**
 * Map swap status to activity status
 */
function mapSwapStatusToActivity(swapStatus: string): ActivityStatus {
  switch (swapStatus) {
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'pending':
      return 'pending';
    default:
      return 'pending';
  }
}

/**
 * Map order status to activity status
 */
function mapOrderStatusToActivity(orderStatus: string): ActivityStatus {
  switch (orderStatus) {
    case 'filled':
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    case 'failed':
      return 'failed';
    case 'pending':
      return 'pending';
    default:
      return 'pending';
  }
}

/**
 * Map transaction status to activity status
 */
export function mapTransactionStatusToActivity(txStatus: string): ActivityStatus {
  switch (txStatus) {
    case 'success':
      return 'completed';
    case 'abort_by_response':
    case 'abort_by_post_condition':
      return 'failed';
    case 'pending':
    case 'broadcasted':
      return 'pending';
    default:
      return 'pending';
  }
}

/**
 * Create activity from successful transaction with real amounts from on-chain data
 */
export async function createActivityFromSuccessfulTransaction(
  txid: string,
  recordId: string,
  recordType: 'order' | 'swap'
): Promise<ActivityItem | null> {
  try {
    console.log(`[TX-MONITOR] Creating activity for successful transaction ${txid}, record ${recordId}, type ${recordType}`);

    if (recordType === 'swap') {
      return await createSwapActivityFromSuccessfulTransaction(txid, recordId);
    } else if (recordType === 'order') {
      return await createOrderActivityFromSuccessfulTransaction(txid, recordId);
    }

    return null;
  } catch (error) {
    console.error(`[TX-MONITOR] Error creating activity for successful transaction ${txid}:`, error);
    return null;
  }
}

/**
 * Create swap activity from successful transaction with real output amounts
 */
async function createSwapActivityFromSuccessfulTransaction(txid: string, swapId: string): Promise<ActivityItem | null> {
  try {
    // Fetch swap record from simple-swap storage
    const swapData = await kv.hget('swap-records', swapId);
    if (!swapData) {
      console.warn(`[TX-MONITOR] No swap record found for ${swapId}`);
      return null;
    }

    const swap = typeof swapData === 'string' ? JSON.parse(swapData) : swapData;

    // Import transaction analysis functions
    const { extractActualOutputAmount, analyzeTransaction } = await import('./extract-actual-amounts');

    // Extract real output amount from transaction events
    let realOutputAmount = swap.outputAmount || '0';
    if (swap.owner && swap.outputToken) {
      try {
        const extractedAmount = await extractActualOutputAmount(txid, swap.owner, swap.outputToken);
        if (extractedAmount) {
          realOutputAmount = extractedAmount;
          console.log(`[TX-MONITOR] Extracted real output amount: ${realOutputAmount} for ${swap.outputToken}`);
        }
      } catch (error) {
        console.warn(`[TX-MONITOR] Failed to extract real output amount for ${txid}:`, error);
      }
    }

    // Create token info with price snapshots - use real amounts
    const fromToken = await createTokenInfo(swap.inputToken, swap.inputAmount, 6);
    const toToken = await createTokenInfo(swap.outputToken, realOutputAmount, 6);

    console.log(`[TX-MONITOR] Creating swap activity with real amounts - From: ${swap.inputAmount}, To: ${realOutputAmount}`);

    // Perform comprehensive transaction analysis for metadata
    let transactionAnalysis;
    if (swap.owner && swap.outputToken) {
      try {
        transactionAnalysis = await analyzeTransaction(txid, swap.owner, swap.outputToken, swap.outputAmount);
        if (transactionAnalysis) {
          console.log(`[TX-MONITOR] Added transaction analysis for successful swap ${txid}`);
        }
      } catch (error) {
        console.warn(`[TX-MONITOR] Failed to create transaction analysis for ${txid}:`, error);
      }
    }

    // Create activity from swap data with real amounts
    const activity: ActivityItem = {
      id: generateActivityId('instant_swap', swapId),
      type: 'instant_swap',
      timestamp: normalizeTimestamp(swap.timestamp),
      status: 'completed', // Always completed since transaction succeeded
      owner: swap.owner,
      fromToken,
      toToken,
      txid: txid,
      route: swap.routePath || [],
      priceImpact: swap.priceImpact,
      replyCount: 0,
      hasReplies: false,
      metadata: {
        router: 'dexterity',
        isSubnetShift: swap.metadata?.isSubnetShift || false,
        notes: 'Instant swap transaction',
        priceSnapshotCaptured: Date.now(),
        lastStatusUpdate: Date.now(),
        txStatus: 'success',
        actualOutputAmount: realOutputAmount,
        transactionAnalysis: transactionAnalysis || undefined
      }
    };

    console.log(`[TX-MONITOR] Created successful swap activity: ${activity.id} with real output amount: ${realOutputAmount}`);
    return activity;

  } catch (error) {
    console.error(`[TX-MONITOR] Error creating successful swap activity for ${swapId}:`, error);
    return null;
  }
}

/**
 * Create order activity from successful transaction with real amounts
 */
async function createOrderActivityFromSuccessfulTransaction(txid: string, orderId: string): Promise<ActivityItem | null> {
  try {
    // For now, orders use the same logic as regular orders since they're less common
    // This can be enhanced later with real amount extraction if needed
    return await createOrderActivity(txid, orderId);
  } catch (error) {
    console.error(`[TX-MONITOR] Error creating successful order activity for ${orderId}:`, error);
    return null;
  }
}
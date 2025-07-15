/**
 * Data adapters to convert transaction data into unified ActivityItem format
 * Transforms data from swaps, orders, and other sources into timeline activities
 */

import { ActivityItem, ActivityType, ActivityStatus, TokenInfo } from './activity-types';
import { kv } from '@vercel/kv';

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
 * Capture price snapshot for a token
 */
async function captureTokenPriceSnapshot(tokenId: string): Promise<TokenInfo['priceSnapshot'] | undefined> {
  try {
    // For now, we'll make an HTTP call to a price API
    // In production, this could be enhanced to use multiple sources
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_SIMPLE_SWAP_URL}/api/prices/${encodeURIComponent(tokenId)}`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const priceData = await response.json();
      if (priceData.price) {
        return {
          price: priceData.price,
          timestamp: Date.now(),
          source: 'simple-swap-api'
        };
      }
    }
    
    console.warn(`[TX-MONITOR] Could not fetch price for token ${tokenId}`);
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
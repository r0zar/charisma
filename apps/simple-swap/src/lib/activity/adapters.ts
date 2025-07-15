/**
 * Data adapters to convert production data into unified ActivityItem format
 * Transforms data from orders, swaps, bots, and other systems into timeline activities
 */

import { ActivityItem, ActivityType, ActivityStatus, TokenInfo } from './types';
import type { LimitOrder } from '../orders/types';
import type { SwapRecord } from '../swaps/types';
import type { TwitterTriggerExecution } from '../twitter-triggers/types';
import type { BotActivityRecord } from '../../types/bot';
import type { PerpetualPosition } from '../perps/types';

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
 * Helper to create TokenInfo from token strings
 */
function createTokenInfo(tokenId: string, amount: string, decimals = 6): TokenInfo {
  // Extract symbol from contract ID or use the ID itself
  let symbol = tokenId;
  if (tokenId.includes('.')) {
    const parts = tokenId.split('.');
    symbol = parts[parts.length - 1].toUpperCase();
  } else if (tokenId === 'STX') {
    symbol = 'STX';
  }
  
  return {
    symbol,
    amount,
    contractId: tokenId,
    decimals
  };
}

/**
 * Map order status to activity status
 */
function mapOrderStatus(status: LimitOrder['status']): ActivityStatus {
  switch (status) {
    case 'filled':
    case 'confirmed':
      return 'completed';
    case 'open':
    case 'broadcasted':
      return 'pending';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'pending';
  }
}

/**
 * Map swap status to activity status
 */
function mapSwapStatus(status: SwapRecord['status']): ActivityStatus {
  switch (status) {
    case 'completed':
      return 'completed';
    case 'pending':
      return 'pending';
    case 'failed':
      return 'failed';
    default:
      return 'pending';
  }
}

/**
 * Convert LimitOrder to ActivityItem
 */
export function adaptLimitOrder(order: LimitOrder): ActivityItem {
  const type: ActivityType = order.status === 'filled' || order.status === 'confirmed' 
    ? 'order_filled' 
    : order.status === 'cancelled' 
    ? 'order_cancelled'
    : 'order_filled'; // Default for pending/processing

  return {
    id: order.uuid,
    type,
    timestamp: normalizeTimestamp(order.createdAt),
    status: mapOrderStatus(order.status),
    owner: order.owner,
    fromToken: createTokenInfo(order.inputToken, order.amountIn),
    toToken: createTokenInfo(order.outputToken, '0'), // Will be filled when executed
    txid: order.txid,
    blockHeight: order.blockHeight,
    targetPrice: order.targetPrice ? parseFloat(order.targetPrice) : undefined,
    orderType: order.conditions?.type === 'price' ? 'price_trigger' : 'manual',
    strategy: order.strategyType === 'dca' ? 'dca' : order.strategyType === 'twitter' ? 'twitter' : 'single',
    strategyPosition: order.strategyPosition,
    strategyTotal: order.strategySize,
    metadata: {
      notes: order.strategyDescription,
      errorMessage: order.failureReason,
      ...order.metadata
    }
  };
}

/**
 * Convert SwapRecord to ActivityItem
 */
export function adaptSwapRecord(swap: SwapRecord): ActivityItem {
  return {
    id: swap.id,
    type: 'instant_swap',
    timestamp: normalizeTimestamp(swap.timestamp),
    status: mapSwapStatus(swap.status),
    owner: swap.owner,
    fromToken: createTokenInfo(swap.inputToken, swap.inputAmount),
    toToken: createTokenInfo(swap.outputToken, swap.outputAmount || '0'),
    txid: swap.txid,
    route: swap.routePath,
    priceImpact: swap.priceImpact,
    orderType: 'manual',
    strategy: 'single',
    metadata: {
      router: 'dexterity', // Default router
      ...swap.metadata
    }
  };
}

/**
 * Convert TwitterTriggerExecution to ActivityItem
 */
export function adaptTwitterTrigger(trigger: TwitterTriggerExecution): ActivityItem {
  let status: ActivityStatus = 'pending';
  if (trigger.status === 'order_confirmed') status = 'completed';
  else if (trigger.status === 'failed' || trigger.status === 'overflow') status = 'failed';
  else if (trigger.status === 'pending' || trigger.status === 'bns_resolved' || trigger.status === 'order_broadcasted') status = 'pending';

  return {
    id: trigger.id,
    type: 'twitter_trigger',
    timestamp: normalizeTimestamp(trigger.executedAt),
    status,
    owner: trigger.recipientAddress || trigger.bnsName,
    displayName: trigger.replierDisplayName || trigger.replierHandle,
    fromToken: createTokenInfo('STX', '1000'), // Default amount for Twitter triggers
    toToken: createTokenInfo('CHA', '0'), // Will be filled based on order
    txid: trigger.txid,
    orderType: 'manual',
    strategy: 'twitter',
    metadata: {
      isTwitterTriggered: true,
      twitterHandle: trigger.replierHandle,
      notes: `Triggered by reply: "${trigger.replyText}"`,
      errorMessage: trigger.error
    }
  };
}

/**
 * Convert BotActivityRecord to ActivityItem
 */
export function adaptBotActivity(activity: BotActivityRecord): ActivityItem {
  let status: ActivityStatus = 'pending';
  if (activity.status === 'success') status = 'completed';
  else if (activity.status === 'failure') status = 'failed';
  else if (activity.status === 'pending') status = 'pending';

  return {
    id: activity.id,
    type: 'instant_swap', // Treat bot activities as swaps for now
    timestamp: normalizeTimestamp(activity.timestamp),
    status,
    owner: activity.recipient || 'Bot',
    fromToken: createTokenInfo('STX', activity.amount?.toString() || '0'),
    toToken: createTokenInfo('CHA', '0'), // Placeholder
    txid: activity.txid,
    blockHeight: activity.blockHeight,
    orderType: 'manual',
    strategy: 'single',
    metadata: {
      notes: `Bot ${activity.action} on ${activity.contractName}`,
      errorMessage: activity.errorMessage,
      router: 'bot'
    }
  };
}

/**
 * Convert PerpetualPosition to ActivityItem
 */
export function adaptPerpetualPosition(position: PerpetualPosition): ActivityItem {
  let status: ActivityStatus = 'pending';
  if (position.status === 'closed') status = 'completed';
  else if (position.status === 'open') status = 'completed';
  else if (position.status === 'pending') status = 'pending';

  return {
    id: position.uuid,
    type: 'order_filled', // Treat perp positions as filled orders
    timestamp: normalizeTimestamp(position.createdAt),
    status,
    owner: position.owner,
    fromToken: createTokenInfo(position.baseToken, position.marginRequired),
    toToken: createTokenInfo(position.tradingPair, position.positionSize),
    targetPrice: position.triggerPrice ? parseFloat(position.triggerPrice) : undefined,
    executionPrice: position.entryPrice ? parseFloat(position.entryPrice) : undefined,
    orderType: 'price_trigger',
    strategy: 'single',
    metadata: {
      notes: `${position.direction.toUpperCase()} ${position.leverage}x leverage`,
      router: 'perpetuals'
    }
  };
}

/**
 * Generic adapter function that routes to specific adapters based on data type
 */
export function adaptToActivityItem(data: any, sourceType: 'order' | 'swap' | 'twitter' | 'bot' | 'perp'): ActivityItem {
  switch (sourceType) {
    case 'order':
      return adaptLimitOrder(data as LimitOrder);
    case 'swap':
      return adaptSwapRecord(data as SwapRecord);
    case 'twitter':
      return adaptTwitterTrigger(data as TwitterTriggerExecution);
    case 'bot':
      return adaptBotActivity(data as BotActivityRecord);
    case 'perp':
      return adaptPerpetualPosition(data as PerpetualPosition);
    default:
      throw new Error(`Unknown source type: ${sourceType}`);
  }
}

/**
 * Batch adapter for processing multiple records
 */
export function adaptMultipleToActivityItems(
  records: Array<{data: any, sourceType: 'order' | 'swap' | 'twitter' | 'bot' | 'perp'}>
): ActivityItem[] {
  return records
    .map(({data, sourceType}) => {
      try {
        return adaptToActivityItem(data, sourceType);
      } catch (error) {
        console.error(`Failed to adapt ${sourceType} data:`, error, data);
        return null;
      }
    })
    .filter((item): item is ActivityItem => item !== null)
    .sort((a, b) => b.timestamp - a.timestamp); // Most recent first
}
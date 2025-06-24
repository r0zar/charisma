import { LimitOrder } from './types';
import { TokenCacheData } from '@repo/tokens';

// Enriched order type with token metadata for display
export interface DisplayOrder extends LimitOrder {
    inputTokenMeta: TokenCacheData;
    outputTokenMeta: TokenCacheData;
    conditionTokenMeta?: TokenCacheData;
    baseAssetMeta?: TokenCacheData | null;
}

export interface StrategyDisplayData {
    id: string;
    type: 'dca' | 'single' | 'twitter';
    description: string;
    orders: DisplayOrder[];
    totalOrders: number;
    completedOrders: number;
    progressPercent: number;
    totalValue: string;
    status: 'active' | 'completed' | 'partially_filled' | 'cancelled';
    estimatedCompletion?: string;
    // Twitter-specific metadata
    twitterMetadata?: {
        tweetUrl?: string;
        tweetId?: string;
        maxTriggers?: number;
        triggeredCount?: number;
        recentReplies?: any[];
    };
}

/**
 * Groups orders by strategy and creates display data
 */
export function groupOrdersByStrategy(
    orders: LimitOrder[],
    tokenMetadata: Map<string, TokenCacheData>
): StrategyDisplayData[] {
    // Group orders by strategyId
    const strategies = new Map<string, LimitOrder[]>();
    const singleOrders: LimitOrder[] = [];

    orders.forEach(order => {
        if (order.strategyId) {
            const existing = strategies.get(order.strategyId) || [];
            existing.push(order);
            strategies.set(order.strategyId, existing);
        } else {
            singleOrders.push(order);
        }
    });

    const result: StrategyDisplayData[] = [];

    // Process strategy groups
    strategies.forEach((strategyOrders, strategyId) => {
        const firstOrder = strategyOrders[0];
        const strategyData = createStrategyDisplayData(strategyId, strategyOrders, tokenMetadata);
        result.push(strategyData);
    });

    // Process single orders
    singleOrders.forEach(order => {
        const strategyData = createSingleOrderDisplayData(order, tokenMetadata);
        result.push(strategyData);
    });

    // Sort by creation date (newest first)
    return result.sort((a, b) => {
        const aTime = Math.max(...a.orders.map(o => new Date(o.createdAt).getTime()));
        const bTime = Math.max(...b.orders.map(o => new Date(o.createdAt).getTime()));
        return bTime - aTime;
    });
}

/**
 * Creates display data for a strategy group
 */
function createStrategyDisplayData(
    strategyId: string,
    orders: LimitOrder[],
    tokenMetadata: Map<string, TokenCacheData>
): StrategyDisplayData {
    const firstOrder = orders[0];
    const strategyType = firstOrder.strategyType || 'dca';
    
    // Sort orders by position
    const sortedOrders = orders.sort((a, b) => (a.strategyPosition || 0) - (b.strategyPosition || 0));
    
    // Calculate progress
    const totalOrders = firstOrder.strategySize || orders.length;
    const completedOrders = orders.filter(o => 
        o.status === 'confirmed' || o.status === 'filled'
    ).length;
    const progressPercent = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

    // Calculate total value
    const inputTokenMeta = tokenMetadata.get(firstOrder.inputToken);
    const totalValueNum = orders.reduce((sum, order) => {
        const amount = Number(order.amountIn);
        const decimals = inputTokenMeta?.decimals || 6;
        return sum + (amount / Math.pow(10, decimals));
    }, 0);
    const totalValue = formatTokenAmount(totalValueNum, inputTokenMeta?.decimals || 6);

    // Determine overall status
    const status = determineStrategyStatus(orders);

    // Generate description
    const description = generateStrategyDescription(
        strategyType,
        orders,
        totalValue,
        inputTokenMeta?.symbol || 'tokens'
    );

    // Estimate completion for active strategies
    const estimatedCompletion = estimateStrategyCompletion(orders, strategyType);

    // Extract Twitter metadata if this is a Twitter strategy
    const twitterMetadata = strategyType === 'twitter' ? {
        tweetUrl: firstOrder.metadata?.tweetUrl,
        tweetId: firstOrder.metadata?.tweetId,
        maxTriggers: firstOrder.metadata?.maxTriggers,
        triggeredCount: firstOrder.metadata?.triggeredCount,
        recentReplies: firstOrder.metadata?.recentReplies || []
    } : undefined;

    return {
        id: strategyId,
        type: strategyType,
        description,
        orders: sortedOrders,
        totalOrders,
        completedOrders,
        progressPercent,
        totalValue,
        status,
        estimatedCompletion,
        twitterMetadata
    };
}

/**
 * Creates display data for a single order (not part of a strategy)
 */
function createSingleOrderDisplayData(
    order: LimitOrder,
    tokenMetadata: Map<string, TokenCacheData>
): StrategyDisplayData {
    const inputTokenMeta = tokenMetadata.get(order.inputToken);
    const outputTokenMeta = tokenMetadata.get(order.outputToken);
    
    const amount = Number(order.amountIn);
    const decimals = inputTokenMeta?.decimals || 6;
    const formattedAmount = formatTokenAmount(amount / Math.pow(10, decimals), decimals);
    
    // Check if this is a wildcard immediate execution order
    const isWildcard = order.conditionToken === '*' && order.targetPrice === '0' && order.direction === 'gt';
    const isManual = !order.conditionToken || !order.targetPrice || !order.direction;
    
    let description = `Swap ${formattedAmount} ${inputTokenMeta?.symbol || 'tokens'} → ${outputTokenMeta?.symbol || 'tokens'}`;
    if (isWildcard) {
        description += ' (immediate)';
    } else if (isManual) {
        description += ' (manual)';
    }
    
    const status = order.status === 'confirmed' || order.status === 'filled' ? 'completed' : 
                  order.status === 'cancelled' ? 'cancelled' : 'active';
    
    return {
        id: order.uuid,
        type: 'single',
        description,
        orders: [order],
        totalOrders: 1,
        completedOrders: status === 'completed' ? 1 : 0,
        progressPercent: status === 'completed' ? 100 : 0,
        totalValue: formattedAmount,
        status: status as StrategyDisplayData['status']
    };
}

/**
 * Determines the overall status of a strategy based on its orders
 */
function determineStrategyStatus(orders: LimitOrder[]): StrategyDisplayData['status'] {
    const statuses = orders.map(o => o.status);
    
    if (statuses.every(s => s === 'confirmed' || s === 'filled')) {
        return 'completed';
    } else if (statuses.every(s => s === 'cancelled')) {
        return 'cancelled';
    } else if (statuses.some(s => s === 'confirmed' || s === 'filled')) {
        return 'partially_filled';
    } else {
        return 'active';
    }
}

/**
 * Generates human-readable description for strategy types
 */
function generateStrategyDescription(
    type: 'dca' | 'twitter',
    orders: LimitOrder[],
    totalValue: string,
    tokenSymbol: string
): string {
    const orderCount = orders.length;
    
    switch (type) {
        case 'dca':
            return `DCA ${totalValue} ${tokenSymbol} over ${orderCount} orders`;
        case 'twitter':
            const tweetUrl = orders[0]?.metadata?.tweetUrl;
            if (tweetUrl) {
                return `Twitter trigger for ${totalValue} ${tokenSymbol} (${orderCount} orders)`;
            }
            return `Tweet-triggered strategy (${orderCount} orders)`;
        default:
            return `${orderCount} related orders`;
    }
}

/**
 * Estimates when a strategy might complete based on order timing
 */
function estimateStrategyCompletion(
    orders: LimitOrder[],
    type: 'dca' | 'twitter'
): string | undefined {
    if (type === 'dca') {
        // For DCA, estimate based on validTo times
        const validToTimes = orders
            .map(o => o.validTo ? new Date(o.validTo).getTime() : null)
            .filter(t => t !== null) as number[];
        
        if (validToTimes.length > 0) {
            const latestTime = Math.max(...validToTimes);
            const latestDate = new Date(latestTime);
            return latestDate.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        }
    }
    
    if (type === 'twitter') {
        // For Twitter strategies, completion depends on replies and max triggers
        const metadata = orders[0]?.metadata;
        if (metadata?.maxTriggers && metadata?.triggeredCount) {
            const remaining = metadata.maxTriggers - metadata.triggeredCount;
            if (remaining <= 0) {
                return 'Complete';
            }
            return `${remaining} triggers remaining`;
        }
        return 'Waiting for replies';
    }
    
    return undefined;
}

/**
 * Formats token amounts with appropriate precision
 */
function formatTokenAmount(amount: number, decimals: number): string {
    if (amount >= 1000000) {
        return (amount / 1000000).toFixed(1) + 'M';
    } else if (amount >= 1000) {
        return (amount / 1000).toFixed(1) + 'K';
    } else if (amount >= 1) {
        return amount.toFixed(2);
    } else {
        return amount.toFixed(Math.min(6, decimals));
    }
}
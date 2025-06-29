import type { LimitOrder } from './types';
import { TokenCacheData } from '@repo/tokens';

// Enhanced DisplayOrder type with classification
export interface ClassifiedOrder extends LimitOrder {
    inputTokenMeta: TokenCacheData;
    outputTokenMeta: TokenCacheData;
    conditionTokenMeta: TokenCacheData;
    baseAssetMeta?: TokenCacheData | null;
    // Classified order type based on inference
    orderType: 'single' | 'dca' | 'sandwich';
}

export type OrderTypeClassification = 'single' | 'dca' | 'sandwich';

export interface OrderTypeCounts {
    single: number;
    dca: number;
    sandwich: number;
    total: number;
}

export interface OrderStrategy {
    type: 'dca' | 'sandwich';
    id: string;
    orders: ClassifiedOrder[];
    createdAt: string;
    status: 'pending' | 'active' | 'partial' | 'completed';
    // DCA-specific fields
    totalInvested?: number;
    totalPlanned?: number;
    filledOrders?: number;
    totalOrders?: number;
    nextExecution?: string | null;
    // Sandwich-specific fields
    buyOrder?: ClassifiedOrder;
    sellOrder?: ClassifiedOrder;
    tokenA?: TokenCacheData;
    tokenB?: TokenCacheData;
}

/**
 * Classify a single order based on its properties and timing patterns
 */
export function classifyOrderType(
    order: LimitOrder & { inputTokenMeta: TokenCacheData; outputTokenMeta: TokenCacheData },
    allOrders?: (LimitOrder & { inputTokenMeta: TokenCacheData; outputTokenMeta: TokenCacheData })[]
): OrderTypeClassification {
    // Check for DCA patterns - orders with future validFrom dates or part of a sequence
    if (order.validFrom || order.validTo) {
        const validFromDate = order.validFrom ? new Date(order.validFrom) : null;
        const now = new Date();

        // If validFrom is in the future, likely part of DCA sequence
        if (validFromDate && validFromDate > now) {
            return 'dca';
        }

        // If we have all orders, check for DCA patterns
        if (allOrders) {
            const isDCACandidate = checkForDCAPattern(order, allOrders);
            if (isDCACandidate) {
                return 'dca';
            }
        }
    }

    // Check for sandwich patterns if we have all orders
    if (allOrders) {
        const isSandwichCandidate = checkForSandwichPattern(order, allOrders);
        if (isSandwichCandidate) {
            return 'sandwich';
        }
    }

    // Default to single/limit order
    return 'single';
}

/**
 * Check if an order is part of a DCA pattern
 */
function checkForDCAPattern(
    order: LimitOrder & { inputTokenMeta: TokenCacheData; outputTokenMeta: TokenCacheData },
    allOrders: (LimitOrder & { inputTokenMeta: TokenCacheData; outputTokenMeta: TokenCacheData })[]
): boolean {
    const creationTime = new Date(order.createdAt).getTime();
    const tokenPair = `${order.inputTokenMeta.contractId}-${order.outputTokenMeta.contractId}`;
    const amount = parseFloat(order.amountIn || '0');

    // Look for similar orders created around the same time with similar amounts
    const similarOrders = allOrders.filter(o => {
        if (o.uuid === order.uuid) return false;

        const otherCreationTime = new Date(o.createdAt).getTime();
        const otherTokenPair = `${o.inputTokenMeta.contractId}-${o.outputTokenMeta.contractId}`;
        const otherAmount = parseFloat(o.amountIn || '0');

        // Within 5 minutes, same token pair, similar amount (within 10%)
        return Math.abs(creationTime - otherCreationTime) < 300000 &&
            tokenPair === otherTokenPair &&
            Math.abs(amount - otherAmount) < (amount * 0.1);
    });

    // If we find 1+ similar orders, this is likely part of a DCA sequence
    return similarOrders.length >= 1;
}

/**
 * Check if an order is part of a sandwich pattern
 */
function checkForSandwichPattern(
    order: LimitOrder & { inputTokenMeta: TokenCacheData; outputTokenMeta: TokenCacheData },
    allOrders: (LimitOrder & { inputTokenMeta: TokenCacheData; outputTokenMeta: TokenCacheData })[]
): boolean {
    const creationTime = new Date(order.createdAt).getTime();
    const tokenPair = `${order.inputTokenMeta.contractId}-${order.outputTokenMeta.contractId}`;
    const reverseTokenPair = `${order.outputTokenMeta.contractId}-${order.inputTokenMeta.contractId}`;

    // Look for complementary orders (opposite direction) created around same time
    const complementaryOrders = allOrders.filter(o => {
        if (o.uuid === order.uuid) return false;

        const otherCreationTime = new Date(o.createdAt).getTime();
        const otherTokenPair = `${o.inputTokenMeta.contractId}-${o.outputTokenMeta.contractId}`;

        // Within 1 minute, same or reverse token pair, opposite direction
        return Math.abs(creationTime - otherCreationTime) < 60000 &&
            (tokenPair === otherTokenPair || tokenPair === reverseTokenPair ||
                reverseTokenPair === otherTokenPair) &&
            order.direction !== o.direction;
    });

    // If we find complementary orders, this is likely part of a sandwich
    return complementaryOrders.length >= 1;
}

/**
 * Classify multiple orders and return type counts
 */
export function classifyOrderTypes(
    orders: (LimitOrder & { inputTokenMeta: TokenCacheData; outputTokenMeta: TokenCacheData })[]
): { classifiedOrders: ClassifiedOrder[]; counts: OrderTypeCounts } {
    // First pass: classify each order
    const classifiedOrders: ClassifiedOrder[] = orders.map(order => ({
        ...order,
        orderType: classifyOrderType(order, orders),
        conditionTokenMeta: order.inputTokenMeta // Use input token as fallback for condition token
    }));

    // Count by type
    const counts: OrderTypeCounts = {
        single: 0,
        dca: 0,
        sandwich: 0,
        total: 0
    };

    classifiedOrders.forEach(order => {
        counts[order.orderType]++;
        counts.total++;
    });

    return { classifiedOrders, counts };
}

/**
 * Group classified orders into strategies (DCA series, sandwich pairs, etc.)
 */
export function groupOrdersIntoStrategies(classifiedOrders: ClassifiedOrder[]): {
    strategies: OrderStrategy[];
    individualOrders: ClassifiedOrder[];
} {
    const strategies: OrderStrategy[] = [];
    const usedOrderIds = new Set<string>();

    // Group sandwich orders
    const sandwichOrders = classifiedOrders.filter(o => o.orderType === 'sandwich' && !usedOrderIds.has(o.uuid));
    const sandwichGroups = new Map<string, ClassifiedOrder[]>();

    sandwichOrders.forEach(order => {
        const creationTime = new Date(order.createdAt).getTime();
        const tokenPair = `${order.inputTokenMeta.contractId}-${order.outputTokenMeta.contractId}`;

        let groupKey = null;
        for (const [key] of sandwichGroups.entries()) {
            const [existingTime, existingPair] = key.split('|');
            if (Math.abs(creationTime - parseInt(existingTime)) < 60000 && // Within 1 minute
                (tokenPair === existingPair || tokenPair === existingPair.split('-').reverse().join('-'))) {
                groupKey = key;
                break;
            }
        }

        if (!groupKey) {
            groupKey = `${creationTime}|${tokenPair}`;
            sandwichGroups.set(groupKey, []);
        }

        sandwichGroups.get(groupKey)!.push(order);
        usedOrderIds.add(order.uuid);
    });

    // Create sandwich strategy objects
    sandwichGroups.forEach((orders, key) => {
        if (orders.length >= 2) {
            const buyOrder = orders.find(o => o.direction === 'lt'); // Buy low
            const sellOrder = orders.find(o => o.direction === 'gt'); // Sell high

            strategies.push({
                type: 'sandwich',
                id: `sandwich-${key}`,
                orders: orders,
                buyOrder,
                sellOrder,
                createdAt: orders[0].createdAt,
                status: orders.every(o => o.status === 'filled') ? 'completed' :
                    orders.some(o => o.status === 'filled') ? 'partial' : 'pending',
                tokenA: orders[0].inputTokenMeta,
                tokenB: orders[0].outputTokenMeta,
                totalInvested: orders.reduce((sum, o) => sum + parseFloat(o.amountIn || '0') / (10 ** (o.inputTokenMeta.decimals || 6)), 0),
                filledOrders: orders.filter(o => o.status === 'filled').length,
                totalOrders: orders.length
            });
        } else {
            // Single sandwich orders go back to individual list
            orders.forEach(order => usedOrderIds.delete(order.uuid));
        }
    });

    // Group DCA orders
    const dcaOrders = classifiedOrders.filter(o => o.orderType === 'dca' && !usedOrderIds.has(o.uuid));
    const dcaGroups = new Map<string, ClassifiedOrder[]>();

    dcaOrders.forEach(order => {
        const creationTime = new Date(order.createdAt).getTime();
        const tokenPair = `${order.inputTokenMeta.contractId}-${order.outputTokenMeta.contractId}`;
        const amount = parseFloat(order.amountIn || '0');

        let groupKey = null;
        for (const [key] of dcaGroups.entries()) {
            const [existingTime, existingPair, existingAmount] = key.split('|');
            if (Math.abs(creationTime - parseInt(existingTime)) < 300000 && // Within 5 minutes
                tokenPair === existingPair &&
                Math.abs(amount - parseFloat(existingAmount)) < (amount * 0.1)) { // Within 10% amount difference
                groupKey = key;
                break;
            }
        }

        if (!groupKey) {
            groupKey = `${creationTime}|${tokenPair}|${amount}`;
            dcaGroups.set(groupKey, []);
        }

        dcaGroups.get(groupKey)!.push(order);
        usedOrderIds.add(order.uuid);
    });

    // Create DCA strategy objects
    dcaGroups.forEach((orders, key) => {
        if (orders.length >= 2) { // Only group if there are multiple orders
            strategies.push({
                type: 'dca',
                id: `dca-${key}`,
                orders: orders.sort((a, b) => new Date(a.validFrom || a.createdAt).getTime() - new Date(b.validFrom || b.createdAt).getTime()),
                createdAt: orders[0].createdAt,
                status: orders.every(o => o.status === 'filled') ? 'completed' :
                    orders.some(o => o.status === 'filled') ? 'active' : 'pending',
                totalInvested: orders.filter(o => o.status === 'filled').reduce((sum, o) => sum + parseFloat(o.amountIn || '0') / (10 ** (o.inputTokenMeta.decimals || 6)), 0),
                totalPlanned: orders.reduce((sum, o) => sum + parseFloat(o.amountIn || '0') / (10 ** (o.inputTokenMeta.decimals || 6)), 0),
                filledOrders: orders.filter(o => o.status === 'filled').length,
                totalOrders: orders.length,
                nextExecution: orders.find(o => o.status === 'open')?.validFrom || null
            });
        } else {
            // Single DCA orders go back to individual list
            orders.forEach(order => usedOrderIds.delete(order.uuid));
        }
    });

    // Add remaining individual orders (single, ungrouped DCA/sandwich)
    const individualOrders = classifiedOrders.filter(o => !usedOrderIds.has(o.uuid));

    return { strategies, individualOrders };
}

/**
 * Count orders by type from raw LimitOrder array (for admin stats)
 */
export async function countOrdersByType(
    orders: LimitOrder[],
    getTokenMetadata: (contractId: string) => Promise<TokenCacheData>
): Promise<OrderTypeCounts> {
    // Enrich orders with token metadata for classification
    const enrichedOrders: (LimitOrder & { inputTokenMeta: TokenCacheData; outputTokenMeta: TokenCacheData })[] = [];

    for (const order of orders) {
        try {
            const [inputTokenMeta, outputTokenMeta] = await Promise.all([
                getTokenMetadata(order.inputToken),
                getTokenMetadata(order.outputToken)
            ]);

            enrichedOrders.push({
                ...order,
                inputTokenMeta,
                outputTokenMeta
            });
        } catch (error) {
            console.error(`Failed to get metadata for order ${order.uuid}:`, error);
            // Skip orders with missing metadata
        }
    }

    const { counts } = classifyOrderTypes(enrichedOrders);
    return counts;
}
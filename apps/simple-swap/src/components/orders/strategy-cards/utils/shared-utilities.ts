import { StrategyDisplayData, DisplayOrder } from '@/lib/orders/strategy-formatter';
import { formatOrderStatusTime, formatStrategyStatusTime, getConditionIcon } from '@/lib/date-utils';

/**
 * Gets the appropriate status time information for a strategy
 */
export function getStrategyStatusTime(strategyData: StrategyDisplayData) {
    const { type, status, orders } = strategyData;
    const firstOrder = orders[0];
    
    if (type === 'single') {
        return formatOrderStatusTime(firstOrder);
    } else {
        return formatStrategyStatusTime({ status, orders });
    }
}

/**
 * Gets the appropriate condition icon for a strategy
 */
export function getStrategyConditionIcon(strategyData: StrategyDisplayData): string | null {
    const { type, orders } = strategyData;
    const firstOrder = orders[0];
    
    return getConditionIcon(firstOrder, type);
}

/**
 * Determines if a strategy should show action buttons (only single orders with open status)
 */
export function shouldShowActionButtons(strategyData: StrategyDisplayData): boolean {
    const { type, orders } = strategyData;
    const firstOrder = orders[0];
    
    return type === 'single' && firstOrder.status === 'open';
}

/**
 * Gets the appropriate badge status for display
 */
export function getBadgeStatus(strategyData: StrategyDisplayData): 'open' | 'confirmed' | 'cancelled' | 'broadcasted' | 'failed' {
    const { type, status, orders } = strategyData;
    
    if (type === 'single') {
        return orders[0].status;
    } else {
        // Map strategy status to badge status
        switch (status) {
            case 'completed':
                return 'confirmed';
            case 'active':
            case 'partially_filled':
                return 'open';
            case 'cancelled':
                return 'cancelled';
            default:
                return 'open';
        }
    }
}

/**
 * Gets transaction ID for display (only for single orders)
 */
export function getTxId(strategyData: StrategyDisplayData): string | undefined {
    const { type, orders } = strategyData;
    
    if (type === 'single') {
        return orders[0].txid;
    }
    
    return undefined;
}

/**
 * Gets failure reason for display (only for single orders)
 */
export function getFailureReason(strategyData: StrategyDisplayData): string | undefined {
    const { type, orders } = strategyData;
    
    if (type === 'single') {
        return orders[0].failureReason;
    }
    
    return undefined;
}
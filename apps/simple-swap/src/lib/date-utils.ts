/**
 * Date formatting utilities for the orders UI
 * Provides consistent date/time formatting across all order components
 */

/**
 * Formats a date for display in order tooltips and detailed views
 * Returns a consistent full date/time string
 */
export function formatOrderDate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'Invalid Date';
    
    return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

/**
 * Formats a date as relative time (e.g., "2 hours ago", "3 days ago")
 * Falls back to short date format for older dates
 */
export function formatRelativeTime(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'Invalid Date';
    
    const now = new Date();
    const diffMs = d.getTime() - now.getTime(); // Changed order to handle future dates
    const diffSec = Math.floor(Math.abs(diffMs) / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) {
        return 'Just now';
    } else if (diffMin < 60) {
        if (diffMs > 0) {
            return `${diffMin} min${diffMin > 1 ? 's' : ''} from now`;
        } else {
            return `${diffMin} min${diffMin > 1 ? 's' : ''} ago`;
        }
    } else if (diffHour < 24) {
        if (diffMs > 0) {
            return `${diffHour} hour${diffHour > 1 ? 's' : ''} from now`;
        } else {
            return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
        }
    } else if (diffDay < 30) {
        if (diffMs > 0) {
            return `${diffDay} day${diffDay > 1 ? 's' : ''} from now`;
        } else {
            return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
        }
    } else {
        // Fall back to short date if more than a month ago/from now
        return formatShortDate(d);
    }
}

/**
 * Formats an execution window from validFrom/validTo timestamps
 * Handles various combinations of start/end times
 */
export function formatExecWindow(validFrom?: string, validTo?: string): string {
    const from = validFrom ? new Date(validFrom) : null;
    const to = validTo ? new Date(validTo) : null;

    // Validate dates
    if (from && isNaN(from.getTime())) return 'Invalid Date Range';
    if (to && isNaN(to.getTime())) return 'Invalid Date Range';

    if (!from && !to) return 'Anytime';
    if (from && !to) return `After ${formatOrderDate(from)}`;
    if (!from && to) return `Before ${formatOrderDate(to)}`;
    if (from && to) return `${formatOrderDate(from)} – ${formatOrderDate(to)}`;
    return 'Anytime';
}

/**
 * Formats a date as date-only (no time)
 * Used for compact displays and older dates
 */
export function formatShortDate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'Invalid Date';
    
    return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Formats a date as time-only (no date)
 * Used for same-day time displays
 */
export function formatTime(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'Invalid Time';
    
    return d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

/**
 * Formats a date range for execution windows with smart formatting
 * Uses shorter formats when appropriate
 */
export function formatExecWindowCompact(validFrom?: string, validTo?: string): string {
    const from = validFrom ? new Date(validFrom) : null;
    const to = validTo ? new Date(validTo) : null;

    // Validate dates
    if (from && isNaN(from.getTime())) return 'Invalid Range';
    if (to && isNaN(to.getTime())) return 'Invalid Range';

    if (!from && !to) return 'Anytime';
    
    // Check if both dates are on the same day
    const sameDay = from && to && 
        from.getDate() === to.getDate() &&
        from.getMonth() === to.getMonth() &&
        from.getFullYear() === to.getFullYear();
    
    if (from && !to) return `After ${formatShortDate(from)}`;
    if (!from && to) return `Before ${formatShortDate(to)}`;
    
    if (from && to) {
        if (sameDay) {
            return `${formatShortDate(from)} ${formatTime(from)} – ${formatTime(to)}`;
        } else {
            return `${formatShortDate(from)} – ${formatShortDate(to)}`;
        }
    }
    
    return 'Anytime';
}

/**
 * Formats an execution window in a human-readable way for DCA strategies
 * Uses more natural language for time ranges
 */
export function formatExecWindowHuman(validFrom?: string, validTo?: string, orderStatus?: string): string {
    const from = validFrom ? new Date(validFrom) : null;
    const to = validTo ? new Date(validTo) : null;
    const now = new Date();

    // Validate dates
    if (from && isNaN(from.getTime())) return 'Invalid date range';
    if (to && isNaN(to.getTime())) return 'Invalid date range';

    // For confirmed orders, show past tense
    if (orderStatus === 'confirmed') {
        if (!from && !to) return 'Executed (no time constraints)';
        
        if (from && !to) {
            return `Executed (valid from ${formatRelativeTime(from)})`;
        }
        
        if (!from && to) {
            return `Executed (valid until ${formatRelativeTime(to)})`;
        }
        
        if (from && to) {
            const fromRelative = formatRelativeTime(from);
            const toRelative = formatRelativeTime(to);
            
            // If both times format to "Just now", use absolute times for clarity
            if (fromRelative === 'Just now' && toRelative === 'Just now') {
                return `Executed (valid ${formatTime(from)} to ${formatTime(to)})`;
            }
            
            return `Executed (valid ${fromRelative} to ${toRelative})`;
        }
    }

    // For non-confirmed orders, show future tense
    if (!from && !to) return 'Execute anytime';
    
    if (from && !to) {
        // Only start time
        if (from <= now) {
            return 'Execute now or later';
        } else {
            return `Execute starting ${formatRelativeTime(from)}`;
        }
    }
    
    if (!from && to) {
        // Only end time
        return `Execute before ${formatRelativeTime(to)}`;
    }
    
    if (from && to) {
        // Both times specified
        if (from <= now) {
            return `Execute before ${formatRelativeTime(to)}`;
        } else {
            const fromRelative = formatRelativeTime(from);
            const toRelative = formatRelativeTime(to);
            
            // If both times format to "Just now", use absolute times for clarity
            if (fromRelative === 'Just now' && toRelative === 'Just now') {
                return `Execute between ${formatTime(from)} and ${formatTime(to)}`;
            }
            
            // If both are less than a day away, show more specific timing
            const fromDiffHours = Math.abs(from.getTime() - now.getTime()) / (1000 * 60 * 60);
            const toDiffHours = Math.abs(to.getTime() - now.getTime()) / (1000 * 60 * 60);
            
            if (fromDiffHours < 24 && toDiffHours < 24) {
                return `Execute between ${formatTime(from)} and ${formatTime(to)}`;
            } else {
                return `Execute between ${fromRelative} and ${toRelative}`;
            }
        }
    }
    
    return 'Execute anytime';
}

/**
 * Interface for order-like objects with status and timestamps
 */
interface OrderLike {
    status: 'open' | 'broadcasted' | 'confirmed' | 'failed' | 'cancelled' | 'filled';
    createdAt: string;
    confirmedAt?: string;
    failedAt?: string;
    blockTime?: number;
}

/**
 * Interface for strategy-like objects
 */
interface StrategyLike {
    status: 'active' | 'completed' | 'partially_filled' | 'cancelled';
    orders: OrderLike[];
}

/**
 * Formats order status time with context-aware labels
 * Returns appropriate text based on order status and most relevant timestamp
 */
export function formatOrderStatusTime(order: OrderLike): { text: string; tooltip: string } {
    const createdDate = new Date(order.createdAt);
    
    switch (order.status) {
        case 'confirmed': {
            const confirmedDate = order.confirmedAt ? new Date(order.confirmedAt) : createdDate;
            return {
                text: `Executed ${formatRelativeTime(confirmedDate)}`,
                tooltip: `Executed: ${formatOrderDate(confirmedDate)}\nCreated: ${formatOrderDate(createdDate)}`
            };
        }
        case 'filled': {
            const filledDate = order.confirmedAt ? new Date(order.confirmedAt) : createdDate;
            return {
                text: `Filled ${formatRelativeTime(filledDate)}`,
                tooltip: `Filled: ${formatOrderDate(filledDate)}\nCreated: ${formatOrderDate(createdDate)}`
            };
        }
        case 'failed': {
            const failedDate = order.failedAt ? new Date(order.failedAt) : createdDate;
            return {
                text: `Failed ${formatRelativeTime(failedDate)}`,
                tooltip: `Failed: ${formatOrderDate(failedDate)}\nCreated: ${formatOrderDate(createdDate)}`
            };
        }
        case 'broadcasted': {
            return {
                text: `Broadcasted ${formatRelativeTime(createdDate)}`,
                tooltip: `Broadcasted: ${formatOrderDate(createdDate)}`
            };
        }
        case 'cancelled': {
            return {
                text: `Cancelled ${formatRelativeTime(createdDate)}`,
                tooltip: `Cancelled: ${formatOrderDate(createdDate)}\nCreated: ${formatOrderDate(createdDate)}`
            };
        }
        case 'open':
        default: {
            return {
                text: `Created ${formatRelativeTime(createdDate)}`,
                tooltip: `Created: ${formatOrderDate(createdDate)}`
            };
        }
    }
}

/**
 * Formats strategy status time with context-aware labels
 * Analyzes all orders to determine most relevant timestamp and status
 */
export function formatStrategyStatusTime(strategy: StrategyLike): { text: string; tooltip: string } {
    const { status, orders } = strategy;
    
    if (orders.length === 0) {
        return {
            text: 'No orders',
            tooltip: 'Strategy contains no orders'
        };
    }
    
    // Sort orders by creation time to get earliest
    const earliestOrder = orders.reduce((earliest, order) => 
        new Date(order.createdAt) < new Date(earliest.createdAt) ? order : earliest
    );
    
    switch (status) {
        case 'completed': {
            // Find the latest confirmed order
            const confirmedOrders = orders.filter(o => o.status === 'confirmed' && o.confirmedAt);
            if (confirmedOrders.length > 0) {
                const latestConfirmed = confirmedOrders.reduce((latest, order) => 
                    new Date(order.confirmedAt!) > new Date(latest.confirmedAt!) ? order : latest
                );
                return {
                    text: `Completed ${formatRelativeTime(latestConfirmed.confirmedAt!)}`,
                    tooltip: `Completed: ${formatOrderDate(latestConfirmed.confirmedAt!)}\nCreated: ${formatOrderDate(earliestOrder.createdAt)}`
                };
            }
            // Fallback to creation time if no confirmed timestamps
            return {
                text: `Completed recently`,
                tooltip: `All orders completed\nCreated: ${formatOrderDate(earliestOrder.createdAt)}`
            };
        }
        case 'partially_filled': {
            // Find the latest execution among confirmed orders
            const confirmedOrders = orders.filter(o => o.status === 'confirmed' && o.confirmedAt);
            if (confirmedOrders.length > 0) {
                const latestExecution = confirmedOrders.reduce((latest, order) => 
                    new Date(order.confirmedAt!) > new Date(latest.confirmedAt!) ? order : latest
                );
                const completedCount = confirmedOrders.length;
                return {
                    text: `Last executed ${formatRelativeTime(latestExecution.confirmedAt!)}`,
                    tooltip: `${completedCount}/${orders.length} orders completed\nLast execution: ${formatOrderDate(latestExecution.confirmedAt!)}\nCreated: ${formatOrderDate(earliestOrder.createdAt)}`
                };
            }
            // Fallback if no execution timestamps
            return {
                text: `Partially filled`,
                tooltip: `Some orders completed\nCreated: ${formatOrderDate(earliestOrder.createdAt)}`
            };
        }
        case 'cancelled': {
            return {
                text: `Cancelled ${formatRelativeTime(earliestOrder.createdAt)}`,
                tooltip: `Strategy cancelled\nCreated: ${formatOrderDate(earliestOrder.createdAt)}`
            };
        }
        case 'active':
        default: {
            return {
                text: `Created ${formatRelativeTime(earliestOrder.createdAt)}`,
                tooltip: `Created: ${formatOrderDate(earliestOrder.createdAt)}\n${orders.length} orders in strategy`
            };
        }
    }
}

/**
 * Gets detailed timestamp information for an order
 * Returns all relevant timestamps for display in expanded views
 */
export function getOrderTimestamps(order: OrderLike): Array<{ label: string; time: string; isMain?: boolean }> {
    const timestamps = [];
    
    // Always include creation time
    timestamps.push({
        label: 'Created',
        time: formatOrderDate(order.createdAt),
        isMain: order.status === 'open'
    });
    
    // Add status-specific timestamps
    if (order.status === 'confirmed' && order.confirmedAt) {
        timestamps.push({
            label: 'Executed',
            time: formatOrderDate(order.confirmedAt),
            isMain: true
        });
    }
    
    if (order.status === 'failed' && order.failedAt) {
        timestamps.push({
            label: 'Failed',
            time: formatOrderDate(order.failedAt),
            isMain: true
        });
    }
    
    if (order.status === 'broadcasted') {
        timestamps.push({
            label: 'Broadcasted',
            time: formatOrderDate(order.createdAt),
            isMain: true
        });
    }
    
    if (order.status === 'cancelled') {
        timestamps.push({
            label: 'Cancelled',
            time: formatOrderDate(order.createdAt), // No cancelledAt field available
            isMain: true
        });
    }
    
    return timestamps;
}

/**
 * Interface for order condition information
 */
interface OrderConditionInfo {
    conditionToken?: string;
    targetPrice?: string;
    direction?: 'lt' | 'gt';
    validFrom?: string;
    validTo?: string;
}

/**
 * Determines the appropriate condition icon for an order
 * Returns the emoji icon that represents the order's execution condition
 */
export function getConditionIcon(
    order: OrderConditionInfo, 
    strategyType?: 'dca' | 'single' | 'twitter' | 'split' | 'batch'
): string | null {
    // For Twitter strategy orders, prioritize Twitter-based execution
    if (strategyType === 'twitter') {
        return '🐦';
    }
    
    // For DCA strategy orders, prioritize time-based execution
    if (strategyType === 'dca') {
        return '⏰';
    }
    
    // For split/batch strategy orders
    if (strategyType === 'split') {
        return '🔀';
    }
    
    if (strategyType === 'batch') {
        return '📦';
    }
    
    // Check for immediate execution (wildcard condition)
    if (order.conditionToken === '*' && order.targetPrice === '0' && order.direction === 'gt') {
        return '⚡';
    }
    
    // Check for price-based conditions
    if (order.conditionToken && order.targetPrice && order.direction) {
        return '💰';
    }
    
    // Check for time-based execution windows
    if (order.validFrom || order.validTo) {
        return '⏰';
    }
    
    // Manual/programmatic execution (no conditions)
    if (!order.conditionToken || !order.targetPrice || !order.direction) {
        return '🎯';
    }
    
    return null;
}
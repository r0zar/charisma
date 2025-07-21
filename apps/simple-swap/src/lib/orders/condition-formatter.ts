import { LimitOrder } from './types';
import { TokenCacheData } from '@/lib/contract-registry-adapter';

export interface ConditionDisplayData {
    humanReadableText: string;
    shortText: string;
    directionIcon: string;
    progressData?: {
        creationPrice: number;
        currentPrice: number;
        targetPrice: number;
        progressPercent: number;
        direction: 'up' | 'down';
    };
    contextualInfo: string;
    isManualOrder: boolean;
}

/**
 * Formats order conditions into human-readable text
 */
export function formatOrderCondition(
    order: LimitOrder,
    conditionTokenMeta?: TokenCacheData,
    baseAssetMeta?: TokenCacheData | null,
    currentPrice?: number
): ConditionDisplayData {
    // Handle wildcard immediate execution orders  
    if (order.conditionToken === '*' && order.targetPrice === '0' && order.direction === 'gt') {
        return {
            humanReadableText: "Execute immediately",
            shortText: "Immediate execution",
            directionIcon: "⚡",
            contextualInfo: "This order will be executed automatically right away",
            isManualOrder: true
        };
    }

    // Handle manual orders (no conditions)
    if (!order.conditionToken || !order.targetPrice || !order.direction) {
        return {
            humanReadableText: "Manual execution required",
            shortText: "Manual order",
            directionIcon: "👤",
            contextualInfo: "This order must be manually executed via the interface or API",
            isManualOrder: true
        };
    }

    // Handle case where conditionTokenMeta is undefined (shouldn't happen for valid conditional orders)
    if (!conditionTokenMeta) {
        return {
            humanReadableText: "Invalid condition token",
            shortText: "Invalid condition",
            directionIcon: "⚠️",
            contextualInfo: "Unable to load condition token information",
            isManualOrder: true
        };
    }

    const targetPrice = Number(order.targetPrice);
    const creationPrice = order.creationPrice ? Number(order.creationPrice) : undefined;
    const symbol = conditionTokenMeta.symbol;
    const baseSymbol = baseAssetMeta?.symbol || 'USD';

    // Generate human-readable text based on direction
    const isGoingUp = order.direction === 'gt';
    const directionWord = isGoingUp ? 'reaches' : 'drops to';
    const directionIcon = isGoingUp ? '↗️' : '↘️';
    
    const formattedTarget = formatPrice(targetPrice);
    const humanReadableText = `When ${symbol} ${directionWord} ${baseSymbol === 'USD' ? '$' : ''}${formattedTarget}${baseSymbol !== 'USD' ? ` ${baseSymbol}` : ''} or ${isGoingUp ? 'higher' : 'lower'}`;
    
    const shortText = `${symbol} ${isGoingUp ? '≥' : '≤'} ${baseSymbol === 'USD' ? '$' : ''}${formattedTarget}${baseSymbol !== 'USD' ? ` ${baseSymbol}` : ''}`;

    // Generate progress data if we have current and creation prices
    let progressData: ConditionDisplayData['progressData'];
    if (currentPrice !== undefined) {
        const direction: 'up' | 'down' = isGoingUp ? 'up' : 'down';
        
        let progressPercent = 0;
        if (creationPrice !== undefined) {
            if (isGoingUp) {
                // Going up: progress from creation to target
                const totalDistance = targetPrice - creationPrice;
                const currentProgress = currentPrice - creationPrice;
                progressPercent = totalDistance > 0 ? Math.max(0, Math.min(100, (currentProgress / totalDistance) * 100)) : 0;
            } else {
                // Going down: progress from creation to target (inverted)
                const totalDistance = creationPrice - targetPrice;
                const currentProgress = creationPrice - currentPrice;
                progressPercent = totalDistance > 0 ? Math.max(0, Math.min(100, (currentProgress / totalDistance) * 100)) : 0;
            }
        }

        progressData = {
            creationPrice: creationPrice || currentPrice,
            currentPrice,
            targetPrice,
            progressPercent,
            direction
        };
    }

    // Generate contextual information
    let contextualInfo = "Will execute automatically when condition is met";
    if (currentPrice !== undefined) {
        const currentFormatted = formatPrice(currentPrice);
        const comparison = isGoingUp 
            ? currentPrice >= targetPrice ? "Target reached!" : `Currently ${baseSymbol === 'USD' ? '$' : ''}${currentFormatted}${baseSymbol !== 'USD' ? ` ${baseSymbol}` : ''}`
            : currentPrice <= targetPrice ? "Target reached!" : `Currently ${baseSymbol === 'USD' ? '$' : ''}${currentFormatted}${baseSymbol !== 'USD' ? ` ${baseSymbol}` : ''}`;
        contextualInfo = comparison;
    }

    return {
        humanReadableText,
        shortText,
        directionIcon,
        progressData,
        contextualInfo,
        isManualOrder: false
    };
}

/**
 * Formats execution window information
 */
export function formatExecutionWindow(order: LimitOrder): string {
    if (!order.validFrom && !order.validTo) {
        return "Active indefinitely";
    }

    const now = new Date();
    const fromDate = order.validFrom ? new Date(order.validFrom) : null;
    const toDate = order.validTo ? new Date(order.validTo) : null;

    if (fromDate && toDate) {
        const fromFormatted = formatDateShort(fromDate);
        const toFormatted = formatDateShort(toDate);
        
        if (now < fromDate) {
            return `Activates ${fromFormatted} until ${toFormatted}`;
        } else if (now > toDate) {
            return `Expired on ${toFormatted}`;
        } else {
            return `Active until ${toFormatted}`;
        }
    } else if (fromDate) {
        if (now < fromDate) {
            return `Activates ${formatDateShort(fromDate)}`;
        } else {
            return `Active since ${formatDateShort(fromDate)}`;
        }
    } else if (toDate) {
        if (now > toDate) {
            return `Expired on ${formatDateShort(toDate)}`;
        } else {
            return `Active until ${formatDateShort(toDate)}`;
        }
    }

    return "Active";
}

/**
 * Helper function to format prices with appropriate precision
 */
function formatPrice(price: number): string {
    if (price >= 1) {
        return price.toLocaleString(undefined, { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 4 
        });
    } else {
        // For values < 1, show more decimal places to maintain significance
        return price.toLocaleString(undefined, { 
            minimumFractionDigits: 4, 
            maximumFractionDigits: 8 
        });
    }
}

/**
 * Helper function to format dates in a short, readable format
 */
function formatDateShort(date: Date): string {
    const now = new Date();
    const isThisYear = date.getFullYear() === now.getFullYear();
    
    if (isThisYear) {
        return date.toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    } else {
        return date.toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
        });
    }
}
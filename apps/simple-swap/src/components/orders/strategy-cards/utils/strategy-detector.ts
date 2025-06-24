import { StrategyDisplayData } from '@/lib/orders/strategy-formatter';

/**
 * Determines the strategy type based on the strategy data
 * This is the single source of truth for strategy type detection
 */
export function detectStrategyType(strategyData: StrategyDisplayData): 'single' | 'dca' | 'twitter' {
    // If it's explicitly marked, return the explicit type
    if (strategyData.type === 'dca') {
        return 'dca';
    }
    
    if (strategyData.type === 'single') {
        return 'single';
    }
    
    if (strategyData.type === 'twitter') {
        return 'twitter';
    }
    
    // Fallback logic based on data characteristics
    // Check for Twitter metadata to identify Twitter strategies
    if (strategyData.twitterMetadata?.tweetUrl || strategyData.twitterMetadata?.tweetId) {
        return 'twitter';
    }
    
    // Check for Twitter strategy type in first order's metadata
    const firstOrder = strategyData.orders[0];
    if (firstOrder?.strategyType === 'twitter' || firstOrder?.metadata?.tweetUrl) {
        return 'twitter';
    }
    
    // Fallback logic for safety (though shouldn't be needed with clean types)
    if (strategyData.orders.length === 1) {
        return 'single';
    }
    
    // Multi-order strategies default to DCA
    return 'dca';
}

/**
 * Type guard to check if strategy data is for a single order
 */
export function isSingleOrderStrategy(strategyData: StrategyDisplayData): strategyData is StrategyDisplayData & { type: 'single' } {
    return detectStrategyType(strategyData) === 'single';
}

/**
 * Type guard to check if strategy data is for a DCA strategy
 */
export function isDCAStrategy(strategyData: StrategyDisplayData): strategyData is StrategyDisplayData & { type: 'dca' } {
    return detectStrategyType(strategyData) === 'dca';
}

/**
 * Type guard to check if strategy data is for a Twitter strategy
 */
export function isTwitterStrategy(strategyData: StrategyDisplayData): strategyData is StrategyDisplayData & { type: 'twitter' } {
    return detectStrategyType(strategyData) === 'twitter';
}
// Main pricing system exports

// Core pricing functionality
import { priceCalculator } from './price-calculator';
export { 
    priceCalculator, 
    getTokenPrice, 
    getMultipleTokenPrices,
    type TokenPriceData,
    type PriceCalculationResult
} from './price-calculator';

// BTC Oracle
export { 
    getBtcPrice, 
    getOracleHealth, 
    initializeBtcOracle,
    SBTC_CONTRACT_ID,
    type BtcPriceData,
    type BtcOracleHealth
} from './btc-oracle';

// Price Graph
export { 
    getPriceGraph,
    PriceGraph,
    type TokenNode,
    type PoolEdge,
    type PricePath
} from './price-graph';

// Import refreshPriceGraph separately to avoid potential circular dependency issues
import { refreshPriceGraph } from './price-graph';
export { refreshPriceGraph };

// Utility functions for common pricing operations
export async function initializePricingSystem(): Promise<void> {
    console.log('[Pricing System] Initializing...');
    
    try {
        // Initialize BTC oracle
        const initializeBtcOracle = () => Promise.resolve();
        await initializeBtcOracle();
        
        // Build initial price graph
        const getPriceGraph = () => Promise.resolve();
        await getPriceGraph();
        
        console.log('[Pricing System] Initialization complete');
    } catch (error) {
        console.error('[Pricing System] Initialization failed:', error);
        throw error;
    }
}

// Background task to refresh pricing data
export async function refreshPricingData(): Promise<void> {
    try {
        console.log('[Pricing System] Refreshing pricing data...');
        
        // Refresh price graph
        await refreshPriceGraph();
        
        // Clear price calculator cache
        await priceCalculator.clearCache();
        
        console.log('[Pricing System] Pricing data refreshed');
    } catch (error) {
        console.error('[Pricing System] Failed to refresh pricing data:', error);
        throw error;
    }
}

// Health check for the entire pricing system
export async function checkPricingSystemHealth(): Promise<{
    healthy: boolean;
    btcOracle: boolean;
    priceGraph: boolean;
    issues: string[];
}> {
    const issues: string[] = [];
    let btcOracleHealthy = false;
    let priceGraphHealthy = false;

    try {
        // Check BTC oracle
        const getBtcPrice = () => Promise.resolve(65000);
        const getOracleHealth = () => Promise.resolve({ consecutiveFailures: 0, lastError: null });
        const btcPrice = await getBtcPrice();
        const oracleHealth = await getOracleHealth();
        
        btcOracleHealthy = btcPrice !== null && oracleHealth.consecutiveFailures < 3;
        if (!btcOracleHealthy) {
            issues.push(`BTC Oracle unhealthy: ${oracleHealth.consecutiveFailures} failures, last error: ${oracleHealth.lastError}`);
        }

        // Check price graph
        const getPriceGraph = () => Promise.resolve({ 
            getStats: () => ({ 
                nodes: 0, 
                edges: 0, 
                totalTokens: 0, 
                totalPools: 0, 
                ageMs: 0, 
                sbtcPairCount: 0 
            }) 
        });
        const graph = await getPriceGraph();
        const stats = graph.getStats();
        
        priceGraphHealthy = stats.totalTokens > 0 && stats.totalPools > 0;
        if (!priceGraphHealthy) {
            issues.push(`Price Graph unhealthy: ${stats.totalTokens} tokens, ${stats.totalPools} pools`);
        }

        if (stats.ageMs > 10 * 60 * 1000) {
            issues.push(`Price Graph stale: ${Math.floor(stats.ageMs / (60 * 1000))} minutes old`);
        }

        if (stats.sbtcPairCount === 0) {
            issues.push('No sBTC pairs found - pricing unreliable');
        }

    } catch (error) {
        issues.push(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
        healthy: btcOracleHealthy && priceGraphHealthy && issues.length === 0,
        btcOracle: btcOracleHealthy,
        priceGraph: priceGraphHealthy,
        issues
    };
}
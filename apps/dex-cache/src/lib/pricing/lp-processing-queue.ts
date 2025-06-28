import { getLpDependencyGraph, LpDependency } from './lp-dependency-graph';
import { calculateLpIntrinsicValueFromVault } from './lp-token-calculator';
import { getAllVaultData } from '@/lib/pool-service';

/**
 * Result of LP token intrinsic calculation
 */
export interface LpIntrinsicResult {
    contractId: string;
    symbol: string;
    usdPrice: number;
    sbtcRatio: number;
    confidence: number;
    level: number;
    dependencies: string[];
}

/**
 * Processor for calculating LP token intrinsic values in dependency order
 */
export class LpProcessingQueue {
    private dependencyGraph: any;
    private vaultMap = new Map<string, any>();
    private calculatedPrices = new Map<string, number>(); // contractId -> USD price

    /**
     * Initialize the processing queue
     */
    async initialize(basePrices: Record<string, number>): Promise<void> {
        console.log('[LpProcessingQueue] Initializing...');
        
        // Build dependency graph
        this.dependencyGraph = await getLpDependencyGraph();
        
        // Build vault map for quick lookup
        const allVaults = await getAllVaultData();
        allVaults.forEach(vault => {
            this.vaultMap.set(vault.contractId, vault);
        });

        // Initialize with base token prices
        Object.entries(basePrices).forEach(([contractId, price]) => {
            this.calculatedPrices.set(contractId, price);
        });

        console.log(`[LpProcessingQueue] Initialized with ${Object.keys(basePrices).length} base prices and ${allVaults.length} vaults`);
    }

    /**
     * Process all LP tokens in dependency order with timeout protection
     */
    async processAllLpTokens(timeoutMs: number = 20000): Promise<Map<string, LpIntrinsicResult>> {
        const results = new Map<string, LpIntrinsicResult>();
        const processingOrder = this.dependencyGraph.getProcessingOrder();
        
        console.log(`[LpProcessingQueue] Processing ${processingOrder.length} LP tokens in dependency order (timeout: ${timeoutMs}ms)`);

        // Set up timeout protection
        const startTime = Date.now();
        
        // Process level by level
        const levels = this.dependencyGraph.getLevels();
        for (const level of levels) {
            // Check timeout before processing each level
            const elapsed = Date.now() - startTime;
            if (elapsed > timeoutMs) {
                console.warn(`[LpProcessingQueue] Timeout reached after ${elapsed}ms, stopping at level ${level}`);
                break;
            }
            
            const tokensAtLevel = this.dependencyGraph.getTokensAtLevel(level);
            console.log(`[LpProcessingQueue] Processing Level ${level}: ${tokensAtLevel.length} tokens`);
            
            // Process all tokens at this level (can be done in parallel since no interdependencies)
            const levelResults = await Promise.all(
                tokensAtLevel.map(contractId => this.processLpToken(contractId))
            );

            // Store results and update calculated prices for next level
            levelResults.forEach(result => {
                if (result) {
                    results.set(result.contractId, result);
                    this.calculatedPrices.set(result.contractId, result.usdPrice);
                    console.log(`[LpProcessingQueue] Level ${result.level} - ${result.symbol}: $${result.usdPrice.toFixed(6)}`);
                }
            });
        }

        console.log(`[LpProcessingQueue] Completed processing. Results: ${results.size} LP tokens calculated`);
        return results;
    }

    /**
     * Process a single LP token
     */
    private async processLpToken(contractId: string): Promise<LpIntrinsicResult | null> {
        const dependency = this.dependencyGraph.getDependency(contractId);
        const vault = this.vaultMap.get(contractId);

        if (!dependency || !vault) {
            console.warn(`[LpProcessingQueue] Missing dependency or vault data for: ${contractId}`);
            return null;
        }

        try {
            // Create price lookup that includes both base tokens and previously calculated LP tokens
            const pricesForCalculation = Object.fromEntries(this.calculatedPrices.entries());
            
            // Calculate intrinsic value using the new quote-based function
            const intrinsicUsdPrice = await calculateLpIntrinsicValueFromVault(vault, pricesForCalculation, 1);
            
            if (intrinsicUsdPrice === null) {
                console.warn(`[LpProcessingQueue] Failed to calculate intrinsic value for: ${contractId} (${dependency.symbol})`);
                console.warn(`[LpProcessingQueue] Available prices: ${Object.keys(pricesForCalculation).length}`);
                console.warn(`[LpProcessingQueue] TokenA: ${dependency.tokenA.contractId} (${dependency.tokenA.isLpToken ? 'LP' : 'base'}) - Price: ${pricesForCalculation[dependency.tokenA.contractId] || 'MISSING'}`);
                console.warn(`[LpProcessingQueue] TokenB: ${dependency.tokenB.contractId} (${dependency.tokenB.isLpToken ? 'LP' : 'base'}) - Price: ${pricesForCalculation[dependency.tokenB.contractId] || 'MISSING'}`);
                return null;
            }

            // Convert to sBTC ratio
            const sbtcPrice = pricesForCalculation['SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token'] || 100000;
            const sbtcRatio = intrinsicUsdPrice / sbtcPrice;
            
            // Set confidence based on dependency level (higher levels have lower confidence)
            const baseConfidence = 0.8;
            const confidence = Math.max(0.3, baseConfidence - (dependency.level * 0.1));

            return {
                contractId,
                symbol: dependency.symbol,
                usdPrice: intrinsicUsdPrice,
                sbtcRatio,
                confidence,
                level: dependency.level,
                dependencies: dependency.dependencies
            };

        } catch (error) {
            console.error(`[LpProcessingQueue] Error processing ${contractId}:`, error);
            return null;
        }
    }

    /**
     * Get the current calculated prices (includes base + calculated LP prices)
     */
    getCurrentPrices(): Record<string, number> {
        return Object.fromEntries(this.calculatedPrices.entries());
    }

    /**
     * Check if all dependencies for a token are satisfied
     */
    private areDependenciesSatisfied(dependency: LpDependency): boolean {
        return dependency.dependencies.every(depId => this.calculatedPrices.has(depId));
    }

    /**
     * Get processing statistics
     */
    getStats(): {
        totalCalculatedPrices: number;
        dependencyLevels: number[];
        levelDistribution: Record<number, number>;
    } {
        const stats = this.dependencyGraph.getStats();
        return {
            totalCalculatedPrices: this.calculatedPrices.size,
            dependencyLevels: this.dependencyGraph.getLevels(),
            levelDistribution: stats.levelDistribution
        };
    }
}

/**
 * Calculate intrinsic values for all LP tokens using dependency-aware processing
 */
export const calculateAllLpIntrinsicValues = async (
    basePrices: Record<string, number>,
    timeoutMs: number = 15000
): Promise<Map<string, LpIntrinsicResult>> => {
    const processor = new LpProcessingQueue();
    await processor.initialize(basePrices);
    return await processor.processAllLpTokens(timeoutMs);
};
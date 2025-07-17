/**
 * Price Service Orchestrator - Three-Engine Architecture Coordinator
 * 
 * Coordinates between Oracle, CPMM, and Intrinsic Value engines to provide
 * unified price discovery with arbitrage analysis and intelligent source selection.
 */

import type { 
    TokenPriceData, 
    PriceCalculationResult, 
    BulkPriceResult,
    PriceServiceRequest,
    PriceServiceResponse,
    PriceSource,
    EngineHealth,
    PriceServiceConfig
} from '../shared/types';
import type { OracleEngine } from '../engines/oracle-engine';
import type { CpmmEngine } from '../engines/cpmm-engine';
import type { IntrinsicValueEngine } from '../engines/intrinsic-value-engine';

/**
 * Price Service Orchestrator - Main coordinator for all pricing engines
 */
export class PriceServiceOrchestrator {
    private oracleEngine: OracleEngine | null = null;
    private cpmmEngine: CpmmEngine | null = null;
    private intrinsicEngine: IntrinsicValueEngine | null = null;
    private config: PriceServiceConfig | null = null;
    
    // Health monitoring
    private engineHealth = new Map<PriceSource, EngineHealth>();
    
    // Caching
    private priceCache = new Map<string, { data: TokenPriceData; timestamp: number }>();
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes default

    constructor(config?: PriceServiceConfig) {
        this.config = config || null;
        this.initializeEngineHealth();
    }

    /**
     * Set the oracle engine
     */
    setOracleEngine(engine: OracleEngine): void {
        this.oracleEngine = engine;
    }

    /**
     * Set the CPMM engine
     */
    setCpmmEngine(engine: CpmmEngine): void {
        this.cpmmEngine = engine;
    }

    /**
     * Set the intrinsic value engine
     */
    setIntrinsicEngine(engine: IntrinsicValueEngine): void {
        this.intrinsicEngine = engine;
    }

    /**
     * Set configuration
     */
    setConfig(config: PriceServiceConfig): void {
        this.config = config;
    }

    /**
     * Calculate price for a single token using intelligent engine selection
     */
    async calculateTokenPrice(tokenId: string, options?: {
        preferredSources?: PriceSource[];
        includeArbitrageAnalysis?: boolean;
        useCache?: boolean;
        maxAge?: number;
    }): Promise<PriceCalculationResult> {
        const startTime = Date.now();
        const useCache = options?.useCache !== false;
        const includeArbitrage = options?.includeArbitrageAnalysis === true;

        console.log(`[PriceOrchestrator] Calculating price for ${tokenId}`);

        try {
            // Check cache first
            if (useCache) {
                const cached = this.getCachedPrice(tokenId, options?.maxAge);
                if (cached) {
                    console.log(`[PriceOrchestrator] Returning cached price for ${tokenId}`);
                    return {
                        success: true,
                        price: cached,
                        cached: true,
                        debugInfo: {
                            calculationTimeMs: Date.now() - startTime,
                            enginesUsed: [cached.source]
                        }
                    };
                }
            }

            // Determine which engines to try based on asset type
            const engineStrategy = await this.determineEngineStrategy(tokenId, options?.preferredSources);
            console.log(`[PriceOrchestrator] Engine strategy for ${tokenId}: ${engineStrategy.primary} (alternatives: ${engineStrategy.alternatives.join(', ')})`);

            let primaryResult: TokenPriceData | null = null;
            let alternativeResults: Array<{ source: PriceSource; price: TokenPriceData }> = [];
            const enginesUsed: PriceSource[] = [];

            // Try primary engine first
            primaryResult = await this.tryEngine(engineStrategy.primary, tokenId);
            if (primaryResult) {
                enginesUsed.push(engineStrategy.primary);
                console.log(`[PriceOrchestrator] Primary engine ${engineStrategy.primary} succeeded: $${primaryResult.usdPrice.toFixed(6)}`);
            }

            // Try alternative engines if requested or if primary failed
            if (!primaryResult || includeArbitrage) {
                for (const engineType of engineStrategy.alternatives) {
                    const altResult = await this.tryEngine(engineType, tokenId);
                    if (altResult) {
                        enginesUsed.push(engineType);
                        alternativeResults.push({ source: engineType, price: altResult });
                        console.log(`[PriceOrchestrator] Alternative engine ${engineType} result: $${altResult.usdPrice.toFixed(6)}`);
                        
                        // Use as primary if we don't have one yet
                        if (!primaryResult) {
                            primaryResult = altResult;
                        }
                    }
                }
            }

            // If no results, fail
            if (!primaryResult) {
                const error = `All engines failed for ${tokenId}`;
                console.error(`[PriceOrchestrator] ${error}`);
                return {
                    success: false,
                    error,
                    debugInfo: {
                        calculationTimeMs: Date.now() - startTime,
                        enginesUsed: []
                    }
                };
            }

            // Perform arbitrage analysis if multiple sources available
            if (includeArbitrage && alternativeResults.length > 0) {
                this.addArbitrageAnalysis(primaryResult, alternativeResults);
            }

            // Cache the result
            if (useCache) {
                this.cachePrice(tokenId, primaryResult);
            }

            const calculationTime = Date.now() - startTime;
            console.log(`[PriceOrchestrator] Successfully calculated ${tokenId} price in ${calculationTime}ms: $${primaryResult.usdPrice.toFixed(6)} (source: ${primaryResult.source})`);

            return {
                success: true,
                price: primaryResult,
                cached: false,
                debugInfo: {
                    calculationTimeMs: calculationTime,
                    enginesUsed
                }
            };

        } catch (error) {
            console.error(`[PriceOrchestrator] Error calculating price for ${tokenId}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                debugInfo: {
                    calculationTimeMs: Date.now() - startTime,
                    enginesUsed: []
                }
            };
        }
    }

    /**
     * Calculate prices for multiple tokens efficiently
     */
    async calculateMultipleTokenPrices(
        tokenIds: string[], 
        options?: {
            includeArbitrageAnalysis?: boolean;
            useCache?: boolean;
            batchSize?: number;
        }
    ): Promise<BulkPriceResult> {
        const startTime = Date.now();
        const batchSize = options?.batchSize || 10;
        const results = new Map<string, TokenPriceData>();
        const errors = new Map<string, string>();
        const engineStats = { oracle: 0, market: 0, intrinsic: 0, hybrid: 0 };

        console.log(`[PriceOrchestrator] Calculating prices for ${tokenIds.length} tokens`);

        // Process in batches to avoid overwhelming the engines
        for (let i = 0; i < tokenIds.length; i += batchSize) {
            const batch = tokenIds.slice(i, i + batchSize);
            
            const promises = batch.map(async (tokenId) => {
                const result = await this.calculateTokenPrice(tokenId, options);
                if (result.success && result.price) {
                    results.set(tokenId, result.price);
                    engineStats[result.price.source]++;
                } else {
                    errors.set(tokenId, result.error || 'Unknown error');
                }
            });

            await Promise.all(promises);
        }

        const calculationTime = Date.now() - startTime;
        console.log(`[PriceOrchestrator] Bulk calculation complete: ${results.size} successes, ${errors.size} errors in ${calculationTime}ms`);

        return {
            success: results.size > 0,
            prices: results,
            errors,
            lastUpdated: Date.now(),
            debugInfo: {
                totalTokens: tokenIds.length,
                successCount: results.size,
                errorCount: errors.size,
                calculationTimeMs: calculationTime,
                engineStats
            }
        };
    }

    /**
     * Determine which engines to use for a token
     */
    private async determineEngineStrategy(
        tokenId: string, 
        preferredSources?: PriceSource[]
    ): Promise<{ primary: PriceSource; alternatives: PriceSource[] }> {
        
        // If user specified preferences, use them
        if (preferredSources && preferredSources.length > 0) {
            return {
                primary: preferredSources[0],
                alternatives: preferredSources.slice(1)
            };
        }

        // Smart engine selection based on asset type
        
        // Check if it's an intrinsic asset first
        if (this.intrinsicEngine) {
            const hasIntrinsic = await this.intrinsicEngine.hasIntrinsicValue(tokenId);
            if (hasIntrinsic) {
                return {
                    primary: 'intrinsic',
                    alternatives: ['market'] // Can compare with market price for arbitrage
                };
            }
        }

        // Default to market discovery with oracle fallback
        return {
            primary: 'market',
            alternatives: ['oracle']
        };
    }

    /**
     * Try a specific engine for pricing
     */
    private async tryEngine(engineType: PriceSource, tokenId: string): Promise<TokenPriceData | null> {
        try {
            switch (engineType) {
                case 'oracle':
                    return await this.tryOracleEngine(tokenId);
                case 'market':
                    return await this.tryMarketEngine(tokenId);
                case 'intrinsic':
                    return await this.tryIntrinsicEngine(tokenId);
                default:
                    console.warn(`[PriceOrchestrator] Unknown engine type: ${engineType}`);
                    return null;
            }
        } catch (error) {
            console.error(`[PriceOrchestrator] Engine ${engineType} failed for ${tokenId}:`, error);
            this.recordEngineFailure(engineType);
            return null;
        }
    }

    /**
     * Try oracle engine
     */
    private async tryOracleEngine(tokenId: string): Promise<TokenPriceData | null> {
        if (!this.oracleEngine) return null;

        // Oracle engine currently only supports BTC
        if (!tokenId.includes('sbtc')) return null;

        const btcData = await this.oracleEngine.getBtcPrice();
        if (!btcData) return null;

        this.recordEngineSuccess('oracle');
        return {
            tokenId,
            symbol: 'sBTC',
            usdPrice: btcData.price,
            sbtcRatio: 1.0,
            lastUpdated: Date.now(),
            source: 'oracle',
            reliability: btcData.reliability,
            oracleData: {
                asset: 'BTC',
                source: btcData.source,
                reliability: btcData.reliability === 1 ? 'high' : btcData.reliability > 0.7 ? 'medium' : 'low',
                timestamp: btcData.lastUpdated
            }
        };
    }

    /**
     * Try CPMM market engine
     */
    private async tryMarketEngine(tokenId: string): Promise<TokenPriceData | null> {
        if (!this.cpmmEngine) return null;

        // For market engine, we need to discover prices from a base token
        // This is a simplified implementation - in practice you'd need to:
        // 1. Get sBTC price from oracle
        // 2. Use CPMM engine to discover prices relative to sBTC
        
        console.log(`[PriceOrchestrator] Market engine not fully implemented for ${tokenId}`);
        return null; // TODO: Implement market price discovery
    }

    /**
     * Try intrinsic value engine
     */
    private async tryIntrinsicEngine(tokenId: string): Promise<TokenPriceData | null> {
        if (!this.intrinsicEngine) return null;

        const intrinsicResult = await this.intrinsicEngine.calculateIntrinsicValue(tokenId);
        if (!intrinsicResult) return null;

        this.recordEngineSuccess('intrinsic');
        return {
            tokenId,
            symbol: intrinsicResult.symbol,
            usdPrice: intrinsicResult.usdValue,
            sbtcRatio: intrinsicResult.btcRatio,
            lastUpdated: intrinsicResult.lastUpdated,
            source: 'intrinsic',
            reliability: 0.95, // High reliability for intrinsic values
            intrinsicData: {
                assetType: intrinsicResult.type,
                calculationMethod: intrinsicResult.calculationMethod,
                sourceData: intrinsicResult.sourceData
            }
        };
    }

    /**
     * Add arbitrage analysis to primary result
     */
    private addArbitrageAnalysis(
        primaryResult: TokenPriceData, 
        alternatives: Array<{ source: PriceSource; price: TokenPriceData }>
    ): void {
        if (alternatives.length === 0) return;

        const marketPrice = alternatives.find(a => a.source === 'market')?.price.usdPrice;
        const intrinsicValue = alternatives.find(a => a.source === 'intrinsic')?.price.usdPrice;
        const oraclePrice = alternatives.find(a => a.source === 'oracle')?.price.usdPrice;

        if (marketPrice && intrinsicValue) {
            const deviation = Math.abs(marketPrice - intrinsicValue) / intrinsicValue;
            const profitable = deviation > 0.05; // 5% threshold

            primaryResult.arbitrageOpportunity = {
                marketPrice,
                intrinsicValue,
                deviation: deviation * 100,
                profitable
            };

            console.log(`[PriceOrchestrator] Arbitrage analysis: Market=$${marketPrice.toFixed(6)}, Intrinsic=$${intrinsicValue.toFixed(6)}, Deviation=${(deviation * 100).toFixed(2)}%, Profitable=${profitable}`);
        }
    }

    /**
     * Cache management
     */
    private getCachedPrice(tokenId: string, maxAge?: number): TokenPriceData | null {
        const cached = this.priceCache.get(tokenId);
        if (!cached) return null;

        const age = Date.now() - cached.timestamp;
        const maxAgeMs = maxAge || this.CACHE_DURATION;
        
        if (age < maxAgeMs) {
            return cached.data;
        }

        this.priceCache.delete(tokenId);
        return null;
    }

    private cachePrice(tokenId: string, price: TokenPriceData): void {
        this.priceCache.set(tokenId, {
            data: price,
            timestamp: Date.now()
        });
    }

    /**
     * Engine health monitoring
     */
    private initializeEngineHealth(): void {
        const engines: PriceSource[] = ['oracle', 'market', 'intrinsic'];
        for (const engine of engines) {
            this.engineHealth.set(engine, {
                engine,
                status: 'healthy',
                lastSuccess: Date.now(),
                errorRate: 0,
                averageResponseTime: 0
            });
        }
    }

    private recordEngineSuccess(engine: PriceSource): void {
        const health = this.engineHealth.get(engine);
        if (health) {
            health.lastSuccess = Date.now();
            health.status = 'healthy';
            // Update error rate (simplified)
            health.errorRate = Math.max(0, health.errorRate - 0.1);
        }
    }

    private recordEngineFailure(engine: PriceSource): void {
        const health = this.engineHealth.get(engine);
        if (health) {
            health.errorRate = Math.min(1, health.errorRate + 0.1);
            if (health.errorRate > 0.5) {
                health.status = 'degraded';
            }
            if (health.errorRate > 0.8) {
                health.status = 'failed';
            }
        }
    }

    /**
     * Get engine health status
     */
    getEngineHealth(): EngineHealth[] {
        return Array.from(this.engineHealth.values());
    }

    /**
     * Clear price cache
     */
    clearCache(): void {
        this.priceCache.clear();
        console.log('[PriceOrchestrator] Price cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.priceCache.size,
            oldestEntry: this.priceCache.size > 0 
                ? Math.min(...Array.from(this.priceCache.values()).map(c => c.timestamp))
                : null
        };
    }
}
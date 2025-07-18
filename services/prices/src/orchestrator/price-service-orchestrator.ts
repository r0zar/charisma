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
    PriceSource,
    EngineHealth,
    PriceServiceConfig
} from '../shared/types';
import type { OracleEngine } from '../engines/oracle-engine';
import type { CpmmEngine, CpmmPriceResult } from '../engines/cpmm-engine';
import type { VirtualEngine } from '../engines/virtual-engine';
import { getHostUrl } from '@modules/discovery';

/**
 * Price Service Orchestrator - Main coordinator for all pricing engines
 */
export class PriceServiceOrchestrator {
    private oracleEngine: OracleEngine | null = null;
    private cpmmEngine: CpmmEngine | null = null;
    private virtualEngine: VirtualEngine | null = null;
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
     * Initialize orchestrator with default engines and providers (like @apps/price-scheduler)
     * This allows apps to simply use `new PriceServiceOrchestrator()` without manual configuration
     */
    async initializeWithDefaults(options?: {
        investServiceUrl?: string;
        blobToken?: string;
    }): Promise<void> {
        console.log('[PriceOrchestrator] Initializing with default engine configuration...');

        try {
            // Import engines dynamically to avoid circular dependencies
            const { OracleEngine } = await import('../engines/oracle-engine');
            const { CpmmEngine } = await import('../engines/cpmm-engine');
            const { VirtualEngine } = await import('../engines/virtual-engine');

            // Create engines
            const oracleEngine = new OracleEngine();
            const cpmmEngine = new CpmmEngine();
            const virtualEngine = new VirtualEngine();

            // Get invest service URL for vault data
            const investUrl = options?.investServiceUrl || this.getDefaultInvestUrl();
            console.log('[PriceOrchestrator] Using invest service URL:', investUrl);

            // Set up CPMM engine with pool data provider
            const poolDataProvider = {
                getAllVaultData: async () => {
                    console.log('[PriceOrchestrator] Fetching vault data from invest service...');
                    try {
                        const response = await fetch(`${investUrl}/api/v1/vaults`);
                        console.log('[PriceOrchestrator] Vault API response status:', response.status, response.statusText);

                        if (!response.ok) {
                            throw new Error(`Failed to fetch vaults: ${response.statusText}`);
                        }

                        const { data } = await response.json();
                        if (!Array.isArray(data)) {
                            console.error('[PriceOrchestrator] Vault data is not an array:', data);
                            throw new Error('Vault data is not an array');
                        }
                        console.log(`[PriceOrchestrator] Found ${data.length} vaults`);
                        return data;
                    } catch (error) {
                        console.error('[PriceOrchestrator] Error fetching vault data:', error);
                        throw error;
                    }
                }
            };

            cpmmEngine.setPoolDataProvider(poolDataProvider);
            await cpmmEngine.buildGraph();

            // Set up virtual engine providers
            virtualEngine.setOracleEngine(oracleEngine);

            // Token metadata provider (for subnet tokens)
            virtualEngine.setTokenMetadataProvider({
                getTokenMetadata: async (contractId: string) => {
                    try {
                        // Use @repo/tokens to get proper token metadata
                        const { getTokenMetadataCached } = await import('@repo/tokens');
                        const metadata = await getTokenMetadataCached(contractId);
                        
                        // Return in the format expected by virtual engine
                        if (metadata && metadata.contractId) {
                            return {
                                contractId: metadata.contractId,
                                type: metadata.type || 'STANDARD',
                                symbol: metadata.symbol,
                                decimals: metadata.decimals,
                                base: metadata.base || null
                            };
                        }
                        return null;
                    } catch (error) {
                        console.warn(`[PriceOrchestrator] Error getting metadata for ${contractId}:`, error);
                        return null;
                    }
                }
            });

            // LP provider (for virtual LP token calculation)
            virtualEngine.setLpProvider({
                getAllVaultData: poolDataProvider.getAllVaultData,
                getRemoveLiquidityQuote: async (contractId: string, amount: number) => {
                    try {
                        console.log(`[PriceOrchestrator] Getting remove liquidity quote for ${contractId}, amount: ${amount}`);
                        const response = await fetch(`${investUrl}/api/v1/quote/remove-liquidity`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ vaultContractId: contractId, targetLpAmountToBurn: amount })
                        });

                        if (!response.ok) {
                            return { success: false, error: `API error: ${response.statusText}` };
                        }

                        const data = await response.json();
                        if (data.success && data.quote) {
                            return {
                                success: true,
                                quote: data.quote
                            };
                        }

                        return { success: false, error: data.error || 'Unknown error' };
                    } catch (error) {
                        console.error(`[PriceOrchestrator] Error getting LP quote for ${contractId}:`, error);
                        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
                    }
                }
            });

            // Price provider (for recursive pricing in virtual engine)
            virtualEngine.setPriceProvider({
                getPrice: async (contractId: string) => {
                    try {
                        // Use our own orchestrator for recursive pricing (avoid infinite loops)
                        const result = await this.calculateTokenPrice(contractId, {
                            preferredSources: ['oracle', 'market'], // Avoid virtual recursion
                            useCache: true
                        });

                        if (result?.success && result.price) {
                            return { usdPrice: result.price.usdPrice };
                        }
                        return null;
                    } catch (error) {
                        console.warn(`[PriceOrchestrator] Error getting price for ${contractId}:`, error);
                        return null;
                    }
                }
            });

            // Set engines on orchestrator
            this.setOracleEngine(oracleEngine);
            this.setCpmmEngine(cpmmEngine);
            this.setVirtualEngine(virtualEngine);

            console.log('[PriceOrchestrator] ✅ Default initialization complete');

        } catch (error) {
            console.error('[PriceOrchestrator] ❌ Default initialization failed:', error);
            throw error;
        }
    }

    /**
     * Ensure the orchestrator is initialized with engines
     * Auto-initializes with defaults if no engines are configured
     */
    private async ensureInitialized(): Promise<void> {
        // Check if any engines are configured and functional
        const needsInitialization = !this.oracleEngine && !this.cpmmEngine && !this.virtualEngine;

        if (needsInitialization) {
            console.log('[PriceOrchestrator] No engines configured, auto-initializing with defaults...');
            await this.initializeWithDefaults();
        } else {
            // Engines already exist - no need to re-initialize
            console.log('[PriceOrchestrator] Engines already configured, skipping initialization');
        }
    }

    /**
     * Get default invest service URL using discovery module
     */
    private getDefaultInvestUrl(): string {
        try {
            // Use discovery module for URL resolution
            const url = getHostUrl('invest');
            console.log('[PriceOrchestrator] Using discovery module for invest URL:', url);
            return url;
        } catch (error) {
            console.warn('[PriceOrchestrator] Could not use discovery module, falling back to environment/default URL:', error);

            // Development fallback
            if (typeof process !== 'undefined' && process.env) {
                if (process.env.NODE_ENV === 'development') {
                    console.log('[PriceOrchestrator] Using development fallback URL');
                    return 'http://localhost:3003'; // Assume local dev server
                }
            }

            // Production fallback
            console.log('[PriceOrchestrator] Using production fallback URL');
            return 'https://invest.charisma.rocks';
        }
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
    setVirtualEngine(engine: VirtualEngine): void {
        this.virtualEngine = engine;
    }

    /**
     * Get the CPMM engine
     */
    getCpmmEngine(): CpmmEngine | null {
        return this.cpmmEngine;
    }

    /**
     * Get the virtual engine
     */
    getVirtualEngine(): VirtualEngine | null {
        return this.virtualEngine;
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
        skipInitialization?: boolean;
    }): Promise<PriceCalculationResult> {
        const startTime = Date.now();
        const useCache = options?.useCache !== false;
        const includeArbitrage = options?.includeArbitrageAnalysis === true;

        console.log(`[PriceOrchestrator] Calculating price for ${tokenId}`);

        try {
            // Auto-initialize with defaults if no engines are configured
            if (!options?.skipInitialization) {
                await this.ensureInitialized();
            }

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
        const engineStats = { oracle: 0, market: 0, virtual: 0, hybrid: 0 };

        console.log(`[PriceOrchestrator] Calculating prices for ${tokenIds.length} tokens`);

        // Auto-initialize with defaults if no engines are configured (once for batch)
        await this.ensureInitialized();

        // Process in batches to avoid overwhelming the engines
        for (let i = 0; i < tokenIds.length; i += batchSize) {
            const batch = tokenIds.slice(i, i + batchSize);

            const promises = batch.map(async (tokenId) => {
                const result = await this.calculateTokenPrice(tokenId, {
                    ...options,
                    skipInitialization: true // Skip initialization for bulk operations
                });
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
        if (this.virtualEngine) {
            const hasIntrinsic = await this.virtualEngine.hasVirtualValue(tokenId);
            if (hasIntrinsic) {
                return {
                    primary: 'virtual',
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
                case 'virtual':
                    return await this.tryVirtualEngine(tokenId);
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
        console.log(`[PriceOrchestrator] Trying market engine for ${tokenId}, engine exists: ${!!this.cpmmEngine}`);

        if (!this.cpmmEngine) {
            console.log(`[PriceOrchestrator] CPMM engine not available for ${tokenId}`);
            return null;
        }

        try {
            // sBTC contract ID - our base token for market discovery
            const SBTC_CONTRACT_ID = 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token';

            // If requesting sBTC directly, get from oracle
            if (tokenId === SBTC_CONTRACT_ID) {
                return await this.tryOracleEngine(tokenId);
            }

            // Get sBTC price from oracle as our base price
            const sbtcPrice = await this.getSbtcBasePrice();
            if (!sbtcPrice) {
                console.log(`[PriceOrchestrator] Cannot get sBTC base price for market discovery`);
                return null;
            }

            // Ensure CPMM graph is built and current
            if (this.cpmmEngine.needsRebuild()) {
                console.log(`[PriceOrchestrator] Rebuilding CPMM graph for market discovery`);
                await this.cpmmEngine.buildGraph();
            }

            // Use CPMM engine to discover prices relative to sBTC
            const baseTokenPrices = new Map<string, number>();
            baseTokenPrices.set(SBTC_CONTRACT_ID, 1.0); // sBTC = 1.0 in sBTC terms

            const discoveredPrices = await this.cpmmEngine.discoverPricesFromBase(
                SBTC_CONTRACT_ID,
                baseTokenPrices
            );

            const priceResult = discoveredPrices.get(tokenId);
            if (!priceResult) {
                console.log(`[PriceOrchestrator] No market path found for ${tokenId} via sBTC`);
                return null;
            }

            // Convert ratio to USD price using sBTC base price
            const usdPrice = priceResult.ratio * sbtcPrice;
            const sbtcRatio = priceResult.ratio;

            console.log(`[PriceOrchestrator] Market discovery: ${priceResult.symbol} = ${sbtcRatio.toFixed(6)} sBTC = $${usdPrice.toFixed(6)}`);

            // Build market-specific data
            const marketData = {
                primaryPath: {
                    tokens: priceResult.primaryPath.tokens,
                    pools: priceResult.primaryPath.pools.map(pool => ({
                        poolId: pool.poolId,
                        tokenA: pool.tokenA,
                        tokenB: pool.tokenB,
                        reservesA: pool.reservesA,
                        reservesB: pool.reservesB,
                        liquidityUsd: pool.liquidityUsd,
                        liquidityRelative: pool.liquidityUsd / priceResult.totalLiquidity,
                        weight: pool.weight,
                        lastUpdated: pool.lastUpdated,
                        fee: 0.003 // 0.3% standard AMM fee
                    })),
                    totalLiquidity: priceResult.totalLiquidity,
                    pathLength: priceResult.primaryPath.pathLength,
                    reliability: priceResult.reliability,
                    confidence: priceResult.reliability
                },
                alternativePaths: priceResult.alternativePaths.map(path => ({
                    tokens: path.tokens,
                    pools: path.pools.map(pool => ({
                        poolId: pool.poolId,
                        tokenA: pool.tokenA,
                        tokenB: pool.tokenB,
                        reservesA: pool.reservesA,
                        reservesB: pool.reservesB,
                        liquidityUsd: pool.liquidityUsd,
                        liquidityRelative: pool.liquidityUsd / path.totalLiquidity,
                        weight: pool.weight,
                        lastUpdated: pool.lastUpdated,
                        fee: 0.003
                    })),
                    totalLiquidity: path.totalLiquidity,
                    pathLength: path.pathLength,
                    reliability: path.reliability,
                    confidence: path.reliability
                })),
                pathsUsed: priceResult.pathsUsed,
                totalLiquidity: priceResult.totalLiquidity,
                priceVariation: this.calculatePriceVariation(priceResult)
            };

            this.recordEngineSuccess('market');
            return {
                tokenId,
                symbol: priceResult.symbol,
                usdPrice,
                sbtcRatio,
                lastUpdated: Date.now(),
                source: 'market',
                reliability: priceResult.reliability,
                marketData
            };

        } catch (error) {
            console.error(`[PriceOrchestrator] Market engine failed for ${tokenId}:`, error);
            this.recordEngineFailure('market');
            return null;
        }
    }

    /**
     * Get sBTC base price from oracle engine
     */
    private async getSbtcBasePrice(): Promise<number | null> {
        if (!this.oracleEngine) {
            console.log('[PriceOrchestrator] Oracle engine not available for sBTC price');
            return null;
        }

        try {
            const btcData = await this.oracleEngine.getBtcPrice();
            if (!btcData) {
                console.log('[PriceOrchestrator] Failed to get BTC price from oracle');
                return null;
            }

            // sBTC has 1:1 ratio with BTC
            return btcData.price;
        } catch (error) {
            console.error('[PriceOrchestrator] Error getting sBTC base price:', error);
            return null;
        }
    }

    /**
     * Calculate price variation across alternative paths
     */
    private calculatePriceVariation(priceResult: CpmmPriceResult): number {
        if (priceResult.alternativePaths.length === 0) return 0;

        const allPrices = [priceResult.ratio, ...priceResult.alternativePaths.map(path =>
            // For alternative paths, we'd need to recalculate ratios
            // This is a simplified approach using reliability as a proxy
            priceResult.ratio * (1 + (0.5 - path.reliability))
        )];

        const mean = allPrices.reduce((sum, price) => sum + price, 0) / allPrices.length;
        const variance = allPrices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / allPrices.length;
        const standardDeviation = Math.sqrt(variance);

        return standardDeviation / mean; // Coefficient of variation
    }

    /**
     * Try intrinsic value engine
     */
    private async tryVirtualEngine(tokenId: string): Promise<TokenPriceData | null> {
        if (!this.virtualEngine) return null;

        const intrinsicResult = await this.virtualEngine.calculateVirtualValue(tokenId);
        if (!intrinsicResult) return null;

        this.recordEngineSuccess('virtual');
        return {
            tokenId,
            symbol: intrinsicResult.symbol,
            usdPrice: intrinsicResult.usdValue,
            sbtcRatio: intrinsicResult.btcRatio,
            lastUpdated: intrinsicResult.lastUpdated,
            source: 'virtual',
            reliability: 0.95, // High reliability for intrinsic values
            virtualData: {
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
        const virtualValue = alternatives.find(a => a.source === 'virtual')?.price.usdPrice;
        const oraclePrice = alternatives.find(a => a.source === 'oracle')?.price.usdPrice;

        if (marketPrice && virtualValue) {
            const deviation = Math.abs(marketPrice - virtualValue) / virtualValue;
            const profitable = deviation > 0.05; // 5% threshold

            primaryResult.arbitrageOpportunity = {
                marketPrice,
                virtualValue,
                deviation: deviation * 100,
                profitable
            };

            console.log(`[PriceOrchestrator] Arbitrage analysis: Market=$${marketPrice.toFixed(6)}, Intrinsic=$${virtualValue.toFixed(6)}, Deviation=${(deviation * 100).toFixed(2)}%, Profitable=${profitable}`);
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
        const engines: PriceSource[] = ['oracle', 'market', 'virtual'];
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
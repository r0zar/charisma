import { kv } from "@vercel/kv";
import { getBtcPrice, SBTC_CONTRACT_ID, isStablecoin, type BtcPriceData } from './btc-oracle';
import { getPriceGraph, type PricePath, type PoolEdge } from './price-graph';
import {
    calculateDecimalAwareExchangeRate,
    getTokenDecimals,
    isValidDecimalConversion
} from './decimal-utils';
import {
    calculateLpIntrinsicValue,
    calculateAssetBreakdown,
    analyzeLpTokenPricing,
    type LpTokenPriceAnalysis
} from './lp-token-calculator';

// Cache keys
const TOKEN_PRICE_CACHE_PREFIX = 'token-price:';
const BULK_PRICE_CACHE_KEY = 'bulk-token-prices';
const PRICE_CALCULATION_CACHE_PREFIX = 'price-calc:';

// Cache durations
const TOKEN_PRICE_CACHE_DURATION_MS = process.env.NODE_ENV === 'development' ? 10 * 1000 : 5 * 60 * 1000; // 10 seconds in dev, 5 minutes in prod
const BULK_PRICE_CACHE_DURATION_MS = process.env.NODE_ENV === 'development' ? 10 * 1000 : 5 * 60 * 1000; // 10 seconds in dev, 5 minutes in prod  
const PRICE_CALCULATION_CACHE_DURATION_MS = process.env.NODE_ENV === 'development' ? 5 * 1000 : 60 * 1000; // 5 seconds in dev, 1 minute in prod

export interface TokenPriceData {
    tokenId: string;
    symbol: string;
    usdPrice: number;
    sbtcRatio: number;
    confidence: number;
    lastUpdated: number;
    primaryPath?: PricePath;
    alternativePaths?: PricePath[];
    // Enhanced fields for intrinsic pricing
    intrinsicValue?: number;
    marketPrice?: number;
    priceDeviation?: number;
    isArbitrageOpportunity?: boolean;
    isLpToken?: boolean;
    nestLevel?: number;
    calculationDetails?: {
        btcPrice: number;
        pathsUsed: number;
        totalLiquidity: number;
        priceVariation: number;
        priceSource?: 'market' | 'intrinsic' | 'hybrid';
    };
}

export interface PriceCalculationResult {
    success: boolean;
    price?: TokenPriceData;
    error?: string;
    debugInfo?: any;
}

export class PriceCalculator {
    private static instance: PriceCalculator;
    private lastBtcPrice: BtcPriceData | null = null;

    private constructor() {}

    static getInstance(): PriceCalculator {
        if (!PriceCalculator.instance) {
            PriceCalculator.instance = new PriceCalculator();
        }
        return PriceCalculator.instance;
    }

    /**
     * Calculate USD price for a token using sBTC as base
     */
    async calculateTokenPrice(tokenId: string, useCache = true): Promise<PriceCalculationResult> {
        const startTime = Date.now();

        try {
            // Handle sBTC directly
            if (tokenId === SBTC_CONTRACT_ID) {
                const btcPrice = await getBtcPrice();
                if (!btcPrice) {
                    return { success: false, error: 'Failed to get BTC price' };
                }

                const sbtcPrice: TokenPriceData = {
                    tokenId: SBTC_CONTRACT_ID,
                    symbol: 'sBTC',
                    usdPrice: btcPrice.price,
                    sbtcRatio: 1,
                    confidence: btcPrice.confidence,
                    lastUpdated: Date.now(),
                    isLpToken: false,
                    calculationDetails: {
                        btcPrice: btcPrice.price,
                        pathsUsed: 0,
                        totalLiquidity: 0,
                        priceVariation: 0
                    }
                };

                return { success: true, price: sbtcPrice };
            }

            // Check if this is an LP token and mark it (intrinsic pricing handled at API level)
            const isLp = await this.isLpToken(tokenId);
            if (isLp) {
                console.log(`[PriceCalculator] ${tokenId} identified as LP token (vault type: POOL)`);
            }

            // For non-LP tokens, get the price graph and continue with normal flow
            const graph = await getPriceGraph();
            const tokenNode = graph.getNode(tokenId);
            
            // Handle stablecoins as $1 (useful for arbitrage analysis)
            if (tokenNode && isStablecoin(tokenNode.symbol)) {
                const btcPrice = await getBtcPrice();
                if (!btcPrice) {
                    return { success: false, error: 'Failed to get BTC price for stablecoin calculation' };
                }

                const stablecoinPrice: TokenPriceData = {
                    tokenId,
                    symbol: tokenNode.symbol,
                    usdPrice: 1.0, // Fixed $1 for arbitrage perspective
                    sbtcRatio: 1.0 / btcPrice.price, // Convert to sBTC ratio
                    confidence: 1.0, // High confidence for stablecoin assumption
                    lastUpdated: Date.now(),
                    isLpToken: false,
                    calculationDetails: {
                        btcPrice: btcPrice.price,
                        pathsUsed: 0,
                        totalLiquidity: 0,
                        priceVariation: 0
                    }
                };

                console.log(`[PriceCalculator] Stablecoin ${tokenNode.symbol} priced at $1.00`);
                return { success: true, price: stablecoinPrice };
            }

            // Check cache first
            if (useCache) {
                const cached = await this.getCachedPrice(tokenId);
                if (cached) {
                    return { success: true, price: cached };
                }
            }

            // Get current BTC price (if not already fetched for stablecoin check)
            const btcPrice = await getBtcPrice();
            if (!btcPrice) {
                return { success: false, error: 'Failed to get BTC price' };
            }
            this.lastBtcPrice = btcPrice;
            
            if (!tokenNode) {
                return { success: false, error: 'Token not found in liquidity graph' };
            }

            // Find paths to sBTC for market pricing
            const paths = graph.findPathsToSbtc(tokenId);
            
            console.log(`[PriceCalculator] Found ${paths.length} paths for ${tokenNode.symbol} to sBTC`);
            
            if (paths.length === 0) {
                // If no paths found and not an LP token, or LP intrinsic pricing failed
                if (isLp) {
                    return { success: false, error: 'LP token intrinsic pricing failed and no market paths available' };
                }
                return { success: false, error: 'No liquidity paths found to sBTC' };
            }

            // Calculate price using multiple paths
            const priceData = await this.calculatePriceFromPaths(tokenNode.symbol, paths, btcPrice);
            
            if (!priceData) {
                return { success: false, error: 'Failed to calculate price from paths' };
            }

            // Enhance price data with market/intrinsic analysis
            priceData.marketPrice = priceData.usdPrice;
            priceData.intrinsicValue = null; // Market-based pricing, no intrinsic value calculated
            priceData.priceDeviation = 0;
            priceData.isArbitrageOpportunity = false;
            priceData.isLpToken = isLp; // Mark if this is an LP token
            
            // Set price source to market
            if (priceData.calculationDetails) {
                priceData.calculationDetails.priceSource = 'market';
            }

            // Cache the result
            await this.cachePrice(tokenId, priceData);

            const calculationTime = Date.now() - startTime;
            console.log(`[PriceCalculator] Calculated ${tokenNode.symbol} market price in ${calculationTime}ms: $${priceData.usdPrice.toFixed(6)}`);

            return { 
                success: true, 
                price: priceData,
                debugInfo: {
                    calculationTimeMs: calculationTime,
                    pathsFound: paths.length,
                    usedMarketPricing: true
                }
            };

        } catch (error) {
            console.error(`[PriceCalculator] Error calculating price for ${tokenId}:`, error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error' 
            };
        }
    }

    /**
     * Calculate price from multiple paths using weighted median approach
     */
    private async calculatePriceFromPaths(
        symbol: string,
        paths: PricePath[],
        btcPrice: BtcPriceData
    ): Promise<TokenPriceData | null> {
        if (paths.length === 0) return null;

        const pathPrices: Array<{
            sbtcRatio: number;
            usdPrice: number;
            weight: number;
            path: PricePath;
        }> = [];

        console.log(`[PriceCalculator] Calculating ${symbol} price from ${paths.length} paths`);

        // Calculate price for each path
        for (const path of paths) {
            const pathPrice = await this.calculatePathPrice(path);
            if (pathPrice !== null && pathPrice > 0 && isFinite(pathPrice)) {
                const weight = this.calculatePathWeight(path);
                pathPrices.push({
                    sbtcRatio: pathPrice,
                    usdPrice: pathPrice * btcPrice.price,
                    weight,
                    path
                });
                console.log(`[PriceCalculator] Valid path: ${path.tokens.join(' -> ')}, ratio: ${pathPrice}, USD: $${pathPrice * btcPrice.price}`);
            } else {
                console.log(`[PriceCalculator] Invalid path: ${path.tokens.join(' -> ')}, ratio: ${pathPrice}`);
            }
        }

        console.log(`[PriceCalculator] ${pathPrices.length} valid paths out of ${paths.length} total paths for ${symbol}`);

        if (pathPrices.length === 0) {
            console.log(`[PriceCalculator] No valid paths found for ${symbol}`);
            return null;
        }
        
        // Log the valid path prices for debugging
        pathPrices.forEach((pp, i) => {
            console.log(`[PriceCalculator] Path ${i + 1}: sBTC ratio=${pp.sbtcRatio}, USD=${pp.usdPrice}, weight=${pp.weight}`);
        });

        // Sort by price for outlier detection
        pathPrices.sort((a, b) => a.sbtcRatio - b.sbtcRatio);

        // Remove outliers (prices more than 50% away from median)
        const medianPrice = pathPrices[Math.floor(pathPrices.length / 2)].sbtcRatio;
        console.log(`[PriceCalculator] Median price for ${symbol}: ${medianPrice}`);
        
        const filteredPrices = pathPrices.filter(p => {
            const deviation = Math.abs(p.sbtcRatio - medianPrice) / medianPrice;
            const keep = deviation <= 0.5; // 50% deviation threshold
            console.log(`[PriceCalculator] Price ${p.sbtcRatio}, deviation: ${deviation}, keeping: ${keep}`);
            return keep;
        });

        console.log(`[PriceCalculator] Filtered ${pathPrices.length} -> ${filteredPrices.length} prices for ${symbol}`);

        if (filteredPrices.length === 0) {
            // If all prices are outliers, use the median
            console.log(`[PriceCalculator] All prices filtered as outliers for ${symbol}, using median`);
            const medianEntry = pathPrices[Math.floor(pathPrices.length / 2)];
            return this.createTokenPriceData(symbol, medianEntry, [medianEntry.path], btcPrice, pathPrices);
        }

        // Calculate weighted average
        let totalWeight = 0;
        let weightedSum = 0;
        
        console.log(`[PriceCalculator] Calculating weighted average for ${symbol} from ${filteredPrices.length} filtered prices`);
        
        for (const entry of filteredPrices) {
            console.log(`[PriceCalculator] Entry: sbtcRatio=${entry.sbtcRatio}, weight=${entry.weight}`);
            totalWeight += entry.weight;
            weightedSum += entry.sbtcRatio * entry.weight;
        }

        console.log(`[PriceCalculator] Totals: weightedSum=${weightedSum}, totalWeight=${totalWeight}`);

        const avgSbtcRatio = weightedSum / totalWeight;
        const avgUsdPrice = avgSbtcRatio * btcPrice.price;
        
        console.log(`[PriceCalculator] Averages: avgSbtcRatio=${avgSbtcRatio}, avgUsdPrice=${avgUsdPrice}`);

        // Calculate confidence based on price consistency and total liquidity
        const priceVariation = this.calculatePriceVariation(filteredPrices);
        const totalLiquidity = filteredPrices.reduce((sum, p) => sum + p.path.totalLiquidity, 0);
        const consistencyScore = Math.max(0, 1 - priceVariation);
        // Adjust liquidity threshold for atomic values (use much higher threshold)
        const liquidityScore = Math.min(1, totalLiquidity / 100000000000000); // Normalize to 100T atomic units
        const pathCountScore = Math.min(1, filteredPrices.length / 3); // Prefer multiple paths
        
        const confidence = (consistencyScore * 0.4 + liquidityScore * 0.4 + pathCountScore * 0.2) * btcPrice.confidence;

        console.log(`[PriceCalculator] Final ${symbol} price: USD=${avgUsdPrice}, sBTC=${avgSbtcRatio}, confidence=${confidence}`);

        // Select primary path (highest weighted)
        const primaryPath = filteredPrices.reduce((best, current) => 
            current.weight > best.weight ? current : best
        ).path;

        const alternativePaths = filteredPrices
            .filter(p => p.path !== primaryPath)
            .map(p => p.path)
            .slice(0, 5); // Top 5 alternative paths

        return {
            tokenId: primaryPath.tokens[0],
            symbol,
            usdPrice: avgUsdPrice,
            sbtcRatio: avgSbtcRatio,
            confidence,
            lastUpdated: Date.now(),
            primaryPath,
            alternativePaths,
            calculationDetails: {
                btcPrice: btcPrice.price,
                pathsUsed: filteredPrices.length,
                totalLiquidity,
                priceVariation
            }
        };
    }

    /**
     * Calculate the price ratio for a single path using proper decimal conversion
     */
    private async calculatePathPrice(path: PricePath): Promise<number | null> {
        if (path.pools.length === 0) return null;

        // Get price graph to access token decimal information
        const graph = await getPriceGraph();
        const tokenNodes = new Map();
        graph.getAllTokens().forEach(token => tokenNodes.set(token.contractId, token));

        let currentRatio = 1;
        let currentToken = path.tokens[0];

        console.log(`[PriceCalculator] Calculating decimal-aware path price for ${path.tokens.join(' -> ')}`);

        for (let i = 0; i < path.pools.length; i++) {
            const pool = path.pools[i];
            const nextToken = path.tokens[i + 1];

            // Determine which token we're converting from/to
            const isTokenAInput = pool.tokenA === currentToken;
            const inputToken = isTokenAInput ? pool.tokenA : pool.tokenB;
            const outputToken = isTokenAInput ? pool.tokenB : pool.tokenA;
            let inputReserve = isTokenAInput ? pool.reserveA : pool.reserveB;
            let outputReserve = isTokenAInput ? pool.reserveB : pool.reserveA;

            // Convert reserves to numbers if they're strings
            inputReserve = typeof inputReserve === 'string' ? parseFloat(inputReserve) : inputReserve;
            outputReserve = typeof outputReserve === 'string' ? parseFloat(outputReserve) : outputReserve;

            // Get token decimals
            const inputDecimals = getTokenDecimals(inputToken, tokenNodes);
            const outputDecimals = getTokenDecimals(outputToken, tokenNodes);

            console.log(`[PriceCalculator] Pool ${i + 1}: ${currentToken} -> ${nextToken}`);
            console.log(`[PriceCalculator] Atomic reserves: ${inputReserve} -> ${outputReserve}`);
            console.log(`[PriceCalculator] Decimals: ${inputDecimals} -> ${outputDecimals}`);

            // Validate conversion parameters
            if (!isValidDecimalConversion(inputReserve, inputDecimals) || 
                !isValidDecimalConversion(outputReserve, outputDecimals)) {
                console.log(`[PriceCalculator] Invalid conversion parameters`);
                return null;
            }

            if (!inputReserve || !outputReserve || inputReserve <= 0 || outputReserve <= 0) {
                console.log(`[PriceCalculator] Invalid atomic reserves: input=${inputReserve}, output=${outputReserve}`);
                return null;
            }

            // Convert to decimal values for proper exchange rate calculation
            const inputDecimalReserve = inputReserve / Math.pow(10, inputDecimals);
            const outputDecimalReserve = outputReserve / Math.pow(10, outputDecimals);
            
            // Calculate decimal exchange rate (decimal output per decimal input)
            const decimalExchangeRate = outputDecimalReserve / inputDecimalReserve;

            console.log(`[PriceCalculator] Decimal reserves: ${inputDecimalReserve} -> ${outputDecimalReserve}`);
            console.log(`[PriceCalculator] Decimal exchange rate: ${decimalExchangeRate} (${outputDecimalReserve}/${inputDecimalReserve})`);

            if (!isFinite(decimalExchangeRate) || decimalExchangeRate <= 0) {
                console.log(`[PriceCalculator] Invalid decimal exchange rate: ${decimalExchangeRate}`);
                return null;
            }

            currentRatio *= decimalExchangeRate;
            currentToken = nextToken;

            console.log(`[PriceCalculator] Current ratio after hop ${i + 1}: ${currentRatio}`);
        }

        console.log(`[PriceCalculator] Final atomic path ratio: ${currentRatio}`);
        
        if (!isFinite(currentRatio) || currentRatio <= 0) {
            console.log(`[PriceCalculator] Invalid final ratio: ${currentRatio}`);
            return null;
        }
        
        return currentRatio;
    }

    /**
     * Calculate weight for a path based on liquidity and reliability
     */
    private calculatePathWeight(path: PricePath): number {
        console.log(`[PriceCalculator] Calculating weight for path: ${path.tokens.join(' -> ')}`);
        console.log(`[PriceCalculator] Initial path properties: reliability=${path.reliability}, confidence=${path.confidence}, pathLength=${path.pathLength}`);
        
        // Base weight from path properties - ensure minimum values to avoid zero weights
        const reliability = Math.max(0.01, path.reliability || 0.01); // Minimum 1%
        const confidence = Math.max(0.01, path.confidence || 0.01); // Minimum 1%
        let weight = reliability * confidence;
        
        console.log(`[PriceCalculator] Base weight after reliability*confidence: ${weight}`);

        // Penalize longer paths
        const pathPenalty = Math.pow(Math.max(1, path.pathLength || 1), 1.2);
        weight /= pathPenalty;
        
        console.log(`[PriceCalculator] Weight after path length penalty (/${pathPenalty}): ${weight}`);

        // Boost based on minimum liquidity in path (bottleneck)
        if (path.pools && path.pools.length > 0) {
            // Use USD liquidity values 
            const liquidities = path.pools.map(p => p.liquidityUsd || 0);
            const minLiquidity = Math.min(...liquidities);
            // Scale USD liquidity appropriately - max 3x boost at $100K liquidity
            const liquidityBoost = Math.min(3, minLiquidity / 100000); // Max 3x boost at $100K USD
            weight *= (1 + liquidityBoost);
            
            console.log(`[PriceCalculator] Min liquidity (USD): $${minLiquidity.toFixed(2)}, boost: ${liquidityBoost.toFixed(4)}, weight after boost: ${weight}`);
        }

        // Boost recent data
        if (path.pools && path.pools.length > 0) {
            const avgAge = path.pools.reduce((sum, p) => sum + (Date.now() - (p.lastUpdated || Date.now())), 0) / path.pools.length;
            const recencyBoost = Math.max(0.5, 1 - (avgAge / (60 * 60 * 1000))); // Decay over 1 hour
            weight *= recencyBoost;
            
            console.log(`[PriceCalculator] Avg age: ${avgAge}ms, recency boost: ${recencyBoost}, final weight: ${weight}`);
        }

        // Ensure we never return zero weight
        const finalWeight = Math.max(0.001, weight);
        console.log(`[PriceCalculator] Final weight for path ${path.tokens.join(' -> ')}: ${finalWeight}`);
        
        return finalWeight;
    }

    /**
     * Calculate price variation across multiple paths
     */
    private calculatePriceVariation(pathPrices: Array<{ sbtcRatio: number; weight: number }>): number {
        if (pathPrices.length <= 1) return 0;

        const weightedAvg = pathPrices.reduce((sum, p) => sum + p.sbtcRatio * p.weight, 0) / 
                          pathPrices.reduce((sum, p) => sum + p.weight, 0);

        const variance = pathPrices.reduce((sum, p) => {
            const deviation = p.sbtcRatio - weightedAvg;
            return sum + Math.pow(deviation, 2) * p.weight;
        }, 0) / pathPrices.reduce((sum, p) => sum + p.weight, 0);

        return Math.sqrt(variance) / weightedAvg; // Coefficient of variation
    }

    /**
     * Helper to create TokenPriceData structure
     */
    private createTokenPriceData(
        symbol: string,
        entry: { sbtcRatio: number; usdPrice: number; path: PricePath },
        allPaths: PricePath[],
        btcPrice: BtcPriceData,
        pathPrices: Array<{ sbtcRatio: number; weight: number; path: PricePath }>
    ): TokenPriceData {
        return {
            tokenId: entry.path.tokens[0],
            symbol,
            usdPrice: entry.usdPrice,
            sbtcRatio: entry.sbtcRatio,
            confidence: entry.path.confidence * btcPrice.confidence,
            lastUpdated: Date.now(),
            primaryPath: entry.path,
            alternativePaths: allPaths.filter(p => p !== entry.path).slice(0, 3),
            calculationDetails: {
                btcPrice: btcPrice.price,
                pathsUsed: pathPrices.length,
                totalLiquidity: entry.path.totalLiquidity,
                priceVariation: this.calculatePriceVariation(pathPrices)
            }
        };
    }

    /**
     * Cache token price data
     */
    private async cachePrice(tokenId: string, priceData: TokenPriceData): Promise<void> {
        try {
            const cacheKey = `${TOKEN_PRICE_CACHE_PREFIX}${tokenId}`;
            await kv.setex(cacheKey, Math.floor(TOKEN_PRICE_CACHE_DURATION_MS / 1000), priceData);
        } catch (error) {
            console.error('[PriceCalculator] Failed to cache price:', error);
        }
    }

    /**
     * Get cached token price
     */
    private async getCachedPrice(tokenId: string): Promise<TokenPriceData | null> {
        try {
            const cacheKey = `${TOKEN_PRICE_CACHE_PREFIX}${tokenId}`;
            const cached = await kv.get<TokenPriceData>(cacheKey);
            
            if (cached && cached.lastUpdated) {
                const age = Date.now() - cached.lastUpdated;
                if (age < TOKEN_PRICE_CACHE_DURATION_MS) {
                    return cached;
                }
            }
            
            return null;
        } catch (error) {
            console.error('[PriceCalculator] Failed to get cached price:', error);
            return null;
        }
    }

    /**
     * Cache bulk price data
     */
    private async cacheBulkPrices(priceMap: Map<string, TokenPriceData>): Promise<void> {
        try {
            const priceData = {
                prices: Array.from(priceMap.entries()).map(([tokenId, data]) => ({ ...data, tokenId })),
                lastUpdated: Date.now(),
                count: priceMap.size
            };
            
            await kv.setex(BULK_PRICE_CACHE_KEY, Math.floor(BULK_PRICE_CACHE_DURATION_MS / 1000), priceData);
            console.log(`[PriceCalculator] Cached ${priceMap.size} token prices in bulk cache`);
        } catch (error) {
            console.error('[PriceCalculator] Failed to cache bulk prices:', error);
        }
    }

    /**
     * Get cached bulk price data
     */
    private async getCachedBulkPrices(): Promise<Map<string, TokenPriceData> | null> {
        try {
            const cached = await kv.get<{
                prices: Array<TokenPriceData & { tokenId: string }>;
                lastUpdated: number;
                count: number;
            }>(BULK_PRICE_CACHE_KEY);
            
            if (cached && cached.lastUpdated) {
                const age = Date.now() - cached.lastUpdated;
                if (age < BULK_PRICE_CACHE_DURATION_MS) {
                    const priceMap = new Map<string, TokenPriceData>();
                    cached.prices.forEach(price => {
                        priceMap.set(price.tokenId, price);
                    });
                    console.log(`[PriceCalculator] Retrieved ${cached.count} prices from bulk cache (${Math.round(age/1000)}s old)`);
                    return priceMap;
                }
            }
            
            return null;
        } catch (error) {
            console.error('[PriceCalculator] Failed to get cached bulk prices:', error);
            return null;
        }
    }

    /**
     * Calculate prices for multiple tokens efficiently
     */
    async calculateMultipleTokenPrices(tokenIds: string[]): Promise<Map<string, TokenPriceData>> {
        // Check bulk cache first
        const cachedBulk = await this.getCachedBulkPrices();
        if (cachedBulk) {
            // Filter to requested tokens and check if we have all of them
            const requestedResults = new Map<string, TokenPriceData>();
            let allFound = true;
            
            for (const tokenId of tokenIds) {
                const cached = cachedBulk.get(tokenId);
                if (cached) {
                    requestedResults.set(tokenId, cached);
                } else {
                    allFound = false;
                    break;
                }
            }
            
            if (allFound) {
                console.log(`[PriceCalculator] Serving ${tokenIds.length} prices from bulk cache`);
                return requestedResults;
            }
        }

        console.log(`[PriceCalculator] Calculating fresh prices for ${tokenIds.length} tokens`);
        const results = new Map<string, TokenPriceData>();
        
        // Process in batches to avoid overwhelming the system
        const batchSize = 10;
        for (let i = 0; i < tokenIds.length; i += batchSize) {
            const batch = tokenIds.slice(i, i + batchSize);
            
            const promises = batch.map(async (tokenId) => {
                const result = await this.calculateTokenPrice(tokenId);
                if (result.success && result.price) {
                    results.set(tokenId, result.price);
                }
            });
            
            await Promise.all(promises);
        }
        
        // Cache the results in bulk if we calculated a significant number
        if (results.size >= 5) {
            await this.cacheBulkPrices(results);
        }
        
        return results;
    }

    /**
     * Clear all cached prices
     */
    async clearCache(): Promise<void> {
        try {
            // Clear bulk cache
            await kv.del(BULK_PRICE_CACHE_KEY);
            console.log('[PriceCalculator] Cleared bulk price cache - individual entries will expire naturally');
        } catch (error) {
            console.error('[PriceCalculator] Failed to clear cache:', error);
        }
    }

    /**
     * Check if a token is an LP token by checking if it exists as a POOL type vault
     */
    private async isLpToken(tokenId: string): Promise<boolean> {
        try {
            // Check if this token ID exists in the vault list with type 'POOL'
            const { listVaults } = await import('../pool-service');
            const vaults = await listVaults();
            
            const vault = vaults.find(vault => vault.contractId === tokenId);
            if (vault && vault.type === 'POOL') {
                console.log(`[PriceCalculator] ${tokenId} identified as LP token (vault type: ${vault.type})`);
                return true;
            }

            // Fallback: Check if contract ID contains typical LP token indicators
            const contractIdIndicators = ['lp-token', 'amm-lp', 'pool-token'];
            if (contractIdIndicators.some(indicator => tokenId.toLowerCase().includes(indicator))) {
                console.log(`[PriceCalculator] ${tokenId} identified as LP token (naming pattern)`);
                return true;
            }

            // Fallback: Get token metadata to check symbol
            const graph = await getPriceGraph();
            const tokenNode = graph.getNode(tokenId);
            if (tokenNode) {
                const symbolIndicators = ['lp', 'pool', 'amm'];
                if (symbolIndicators.some(indicator => tokenNode.symbol.toLowerCase().includes(indicator))) {
                    console.log(`[PriceCalculator] ${tokenId} identified as LP token (symbol pattern)`);
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.warn(`[PriceCalculator] Failed to check LP token status for ${tokenId}:`, error);
            return false;
        }
    }

    /**
     * Calculate intrinsic price for LP tokens using underlying assets
     */
    private async calculateLpIntrinsicPrice(tokenId: string, prices: Record<string, number>): Promise<TokenPriceData | null> {
        try {
            console.log(`[PriceCalculator] Calculating intrinsic price for LP token ${tokenId}`);

            // Get vault data for the LP token
            const { listVaults } = await import('../pool-service');
            const vaults = await listVaults();
            const vault = vaults.find(v => v.contractId === tokenId);

            if (!vault) {
                console.log(`[PriceCalculator] No vault found for LP token ${tokenId}`);
                return null;
            }

            // Calculate intrinsic value using LP calculator
            const intrinsicValue = calculateLpIntrinsicValue(vault, prices);
            if (!intrinsicValue) {
                console.log(`[PriceCalculator] Could not calculate intrinsic value for ${tokenId}`);
                return null;
            }

            // Get BTC price for ratio calculation
            const btcPrice = await getBtcPrice();
            if (!btcPrice) {
                throw new Error('Failed to get BTC price for LP intrinsic calculation');
            }

            const sbtcRatio = intrinsicValue / btcPrice.price;

            // Calculate asset breakdown for detailed analysis
            const assetBreakdown = calculateAssetBreakdown(vault, prices);

            return {
                tokenId,
                symbol: vault.tokenA?.symbol && vault.tokenB?.symbol 
                    ? `${vault.tokenA.symbol}-${vault.tokenB.symbol} LP`
                    : 'LP',
                usdPrice: intrinsicValue,
                sbtcRatio,
                confidence: 0.8, // High confidence for intrinsic calculation
                lastUpdated: Date.now(),
                intrinsicValue,
                marketPrice: null, // LP tokens typically don't have market prices
                priceDeviation: 0,
                isArbitrageOpportunity: false,
                calculationDetails: {
                    btcPrice: btcPrice.price,
                    pathsUsed: 0,
                    totalLiquidity: (vault.reservesA || 0) + (vault.reservesB || 0),
                    priceVariation: 0,
                    priceSource: 'intrinsic'
                }
            };
        } catch (error) {
            console.error(`[PriceCalculator] Failed to calculate LP intrinsic price for ${tokenId}:`, error);
            return null;
        }
    }

    /**
     * Calculate confidence score considering market vs intrinsic deviation
     */
    private calculateEnhancedConfidence(
        baseConfidence: number,
        marketPrice: number | null,
        intrinsicValue: number | null
    ): number {
        if (!marketPrice || !intrinsicValue) {
            return baseConfidence;
        }

        const deviation = Math.abs(marketPrice - intrinsicValue) / intrinsicValue;
        const deviationPenalty = Math.min(0.5, deviation); // Max 50% penalty
        return baseConfidence * (1 - deviationPenalty);
    }

    /**
     * Combine market and intrinsic prices using a configurable hybrid strategy
     */
    private combineMarketAndIntrinsicPrices(
        marketPrice: TokenPriceData | null,
        intrinsicPrice: TokenPriceData | null,
        btcPrice: { price: number; confidence: number }
    ): TokenPriceData | null {
        // Configuration for hybrid pricing strategy
        const HYBRID_STRATEGY = 'fallback'; // 'fallback', 'average', or 'weighted'
        const MARKET_WEIGHT = 0.7; // For weighted average
        const DEVIATION_THRESHOLD = 0.1; // 10% deviation threshold for arbitrage detection

        console.log(`[PriceCalculator] Combining prices using ${HYBRID_STRATEGY} strategy`);
        console.log(`[PriceCalculator] Market: ${marketPrice ? `$${marketPrice.usdPrice.toFixed(6)}` : 'N/A'}`);
        console.log(`[PriceCalculator] Intrinsic: ${intrinsicPrice ? `$${intrinsicPrice.usdPrice.toFixed(6)}` : 'N/A'}`);

        if (!marketPrice && !intrinsicPrice) {
            return null;
        }

        // If only one price is available, use it
        if (!marketPrice && intrinsicPrice) {
            console.log(`[PriceCalculator] Using intrinsic price (market unavailable)`);
            return {
                ...intrinsicPrice,
                intrinsicValue: intrinsicPrice.usdPrice,
                marketPrice: null,
                priceDeviation: 0,
                isArbitrageOpportunity: false,
                calculationDetails: {
                    ...intrinsicPrice.calculationDetails,
                    priceSource: 'intrinsic'
                }
            };
        }

        if (marketPrice && !intrinsicPrice) {
            console.log(`[PriceCalculator] Using market price (intrinsic unavailable)`);
            return {
                ...marketPrice,
                intrinsicValue: null,
                marketPrice: marketPrice.usdPrice,
                priceDeviation: 0,
                isArbitrageOpportunity: false,
                calculationDetails: {
                    ...marketPrice.calculationDetails,
                    priceSource: 'market'
                }
            };
        }

        // Both prices are available - apply hybrid strategy
        if (marketPrice && intrinsicPrice) {
            const arbitrageAnalysis = this.detectArbitrageOpportunity(
                marketPrice.usdPrice,
                intrinsicPrice.usdPrice,
                DEVIATION_THRESHOLD
            );

            let finalPrice: TokenPriceData;
            let priceSource: 'market' | 'intrinsic' | 'hybrid';

            switch (HYBRID_STRATEGY) {
                case 'fallback':
                    // Prefer market price, fallback to intrinsic
                    finalPrice = { ...marketPrice };
                    priceSource = 'market';
                    console.log(`[PriceCalculator] Using market price (fallback strategy)`);
                    break;

                case 'average':
                    // Simple average
                    const avgPrice = (marketPrice.usdPrice + intrinsicPrice.usdPrice) / 2;
                    const avgSbtcRatio = avgPrice / btcPrice.price;
                    finalPrice = {
                        ...marketPrice,
                        usdPrice: avgPrice,
                        sbtcRatio: avgSbtcRatio,
                        confidence: Math.min(marketPrice.confidence, intrinsicPrice.confidence)
                    };
                    priceSource = 'hybrid';
                    console.log(`[PriceCalculator] Using average price: $${avgPrice.toFixed(6)}`);
                    break;

                case 'weighted':
                    // Weighted average based on confidence
                    const marketWeight = MARKET_WEIGHT * marketPrice.confidence;
                    const intrinsicWeight = (1 - MARKET_WEIGHT) * intrinsicPrice.confidence;
                    const totalWeight = marketWeight + intrinsicWeight;
                    
                    const weightedPrice = (
                        marketPrice.usdPrice * marketWeight + 
                        intrinsicPrice.usdPrice * intrinsicWeight
                    ) / totalWeight;
                    const weightedSbtcRatio = weightedPrice / btcPrice.price;
                    
                    finalPrice = {
                        ...marketPrice,
                        usdPrice: weightedPrice,
                        sbtcRatio: weightedSbtcRatio,
                        confidence: totalWeight / (marketPrice.confidence + intrinsicPrice.confidence)
                    };
                    priceSource = 'hybrid';
                    console.log(`[PriceCalculator] Using weighted average: $${weightedPrice.toFixed(6)} (market: ${marketWeight.toFixed(2)}, intrinsic: ${intrinsicWeight.toFixed(2)})`);
                    break;

                default:
                    finalPrice = { ...marketPrice };
                    priceSource = 'market';
            }

            // Enhance with market vs intrinsic analysis
            finalPrice.marketPrice = marketPrice.usdPrice;
            finalPrice.intrinsicValue = intrinsicPrice.usdPrice;
            finalPrice.priceDeviation = arbitrageAnalysis.deviation;
            finalPrice.isArbitrageOpportunity = arbitrageAnalysis.isOpportunity;
            
            if (finalPrice.calculationDetails) {
                finalPrice.calculationDetails.priceSource = priceSource;
            }

            console.log(`[PriceCalculator] Price deviation: ${arbitrageAnalysis.deviation.toFixed(2)}%`);
            if (arbitrageAnalysis.isOpportunity) {
                console.log(`[PriceCalculator] ⚡ Arbitrage opportunity detected!`);
            }

            return finalPrice;
        }

        return null;
    }

    /**
     * Detect arbitrage opportunities based on market vs intrinsic price deviation
     */
    private detectArbitrageOpportunity(
        marketPrice: number | null,
        intrinsicValue: number | null,
        threshold: number = 0.05
    ): { isOpportunity: boolean; deviation: number } {
        if (!marketPrice || !intrinsicValue) {
            return { isOpportunity: false, deviation: 0 };
        }

        const deviation = (marketPrice - intrinsicValue) / intrinsicValue;
        const absDeviation = Math.abs(deviation);
        
        return {
            isOpportunity: absDeviation > threshold,
            deviation: deviation * 100 // Convert to percentage
        };
    }

    /**
     * Warm the cache by calculating prices for all available tokens
     * This can be called periodically to keep prices fresh
     */
    async warmCache(): Promise<void> {
        try {
            console.log('[PriceCalculator] Starting cache warming...');
            const startTime = Date.now();
            
            // Get all available tokens
            const { listVaultTokens } = await import('../pool-service');
            const allTokens = await listVaultTokens();
            const tokenIds = allTokens.map(token => token.contractId);
            
            // Calculate prices for all tokens (this will cache them)
            const results = await this.calculateMultipleTokenPrices(tokenIds);
            
            const warmTime = Date.now() - startTime;
            console.log(`[PriceCalculator] Cache warmed with ${results.size} token prices in ${warmTime}ms`);
        } catch (error) {
            console.error('[PriceCalculator] Failed to warm cache:', error);
        }
    }
}

// Export singleton instance
export const priceCalculator = PriceCalculator.getInstance();

// Convenience functions
export async function getTokenPrice(tokenId: string): Promise<TokenPriceData | null> {
    const result = await priceCalculator.calculateTokenPrice(tokenId);
    return result.success ? result.price || null : null;
}

export async function getMultipleTokenPrices(tokenIds: string[]): Promise<Map<string, TokenPriceData>> {
    return await priceCalculator.calculateMultipleTokenPrices(tokenIds);
}
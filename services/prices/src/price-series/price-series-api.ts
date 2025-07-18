/**
 * Optimized Price Series API - High-performance cached endpoints
 * 
 * Key optimizations:
 * 1. Aggressive caching with smart invalidation
 * 2. Pre-calculated data retrieval
 * 3. Efficient batch operations
 */

import type { PriceSeriesStorage, TimeSeriesEntry, ArbitrageOpportunity } from './price-series-storage';
import type { TokenPriceData } from '../shared/types';

export interface PriceAPIResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    cached: boolean;
    timestamp: number;
}

export interface PriceHistoryRequest {
    tokenId: string;
    timeframe: '1m' | '5m' | '1h' | '1d';
    limit?: number;
    endTime?: number;
}

export interface BulkPriceRequest {
    tokenIds: string[];
    includeArbitrage?: boolean;
}

export interface BulkPriceSeriesRequest {
    tokenIds: string[];
    timeframe: '1m' | '5m' | '1h' | '1d';
    limit?: number;
    endTime?: number;
}

export interface PercentageChangesRequest {
    tokenIds: string[];
}

export interface ArbitrageRequest {
    minDeviation?: number;
    date?: string;
}

// Optimized cache configuration
const CACHE_CONFIG = {
    CURRENT_PRICE: 30 * 1000,      // 30 seconds
    BULK_PRICES: 30 * 1000,        // 30 seconds
    PRICE_HISTORY: 5 * 60 * 1000,  // 5 minutes (historical data)
    PERCENTAGE_CHANGES: 60 * 1000,  // 1 minute (pre-calculated)
    ARBITRAGE: 2 * 60 * 1000,      // 2 minutes
    ALL_TOKENS: 60 * 1000,         // 1 minute
    MAX_CACHE_SIZE: 1000           // Prevent memory leaks
};

/**
 * Optimized Price Series API with aggressive caching and pre-calculated data
 */
export class PriceSeriesAPI {
    private storage: PriceSeriesStorage;
    private requestCache = new Map<string, { data: any; timestamp: number; duration: number }>();
    private cacheHits = 0;
    private cacheMisses = 0;

    constructor(storage: PriceSeriesStorage) {
        this.storage = storage;
    }

    /**
     * GET /api/price/{tokenId} - Optimized single price retrieval
     */
    async getCurrentPrice(tokenId: string): Promise<PriceAPIResponse<TokenPriceData>> {
        const cacheKey = `current-${tokenId}`;

        try {
            // Check cache first
            const cached = this.getCached(cacheKey);
            if (cached) {
                this.cacheHits++;
                return {
                    success: true,
                    data: cached,
                    cached: true,
                    timestamp: Date.now()
                };
            }

            this.cacheMisses++;

            // Get from storage (KV-optimized)
            const price = await this.storage.getCurrentPrice(tokenId);

            if (!price) {
                return {
                    success: false,
                    error: `Price not found for token: ${tokenId}`,
                    cached: false,
                    timestamp: Date.now()
                };
            }

            // Cache with shorter TTL for current prices
            this.setCached(cacheKey, price, CACHE_CONFIG.CURRENT_PRICE);

            return {
                success: true,
                data: price,
                cached: false,
                timestamp: Date.now()
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                cached: false,
                timestamp: Date.now()
            };
        }
    }

    /**
     * POST /api/prices/bulk - Optimized bulk price retrieval
     */
    async getBulkCurrentPrices(request: BulkPriceRequest): Promise<PriceAPIResponse<{
        prices: Record<string, TokenPriceData>;
        arbitrageOpportunities?: ArbitrageOpportunity[];
    }>> {
        const sortedTokenIds = request.tokenIds.sort();
        const cacheKey = `bulk-${sortedTokenIds.join(',')}-${request.includeArbitrage || false}`;

        try {
            // Check cache
            const cached = this.getCached(cacheKey);
            if (cached) {
                this.cacheHits++;
                return {
                    success: true,
                    data: cached,
                    cached: true,
                    timestamp: Date.now()
                };
            }

            this.cacheMisses++;

            // Use optimized bulk retrieval
            const pricesMap = await this.storage.getCurrentPrices(request.tokenIds);
            const prices: Record<string, TokenPriceData> = {};

            pricesMap.forEach((price, tokenId) => {
                prices[tokenId] = price;
            });

            const result: any = { prices };

            // Include arbitrage if requested
            if (request.includeArbitrage) {
                const arbitrageOpps = await this.storage.getArbitrageOpportunities();
                result.arbitrageOpportunities = arbitrageOpps;
            }

            // Cache the result
            this.setCached(cacheKey, result, CACHE_CONFIG.BULK_PRICES);

            return {
                success: true,
                data: result,
                cached: false,
                timestamp: Date.now()
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                cached: false,
                timestamp: Date.now()
            };
        }
    }

    /**
     * GET /api/price/{tokenId}/history - Optimized history retrieval
     */
    async getPriceHistory(request: PriceHistoryRequest): Promise<PriceAPIResponse<TimeSeriesEntry[]>> {
        const startTime = Date.now();
        const endTimeKey = request.endTime ? Math.floor(request.endTime / (5 * 60 * 1000)) : 'latest';
        const cacheKey = `history-${request.tokenId}-${request.timeframe}-${request.limit || 100}-${endTimeKey}`;

        try {
            // Check cache with longer TTL for historical data
            const cached = this.getCached(cacheKey);
            if (cached) {
                this.cacheHits++;
                return {
                    success: true,
                    data: cached,
                    cached: true,
                    timestamp: Date.now()
                };
            }

            this.cacheMisses++;

            // Use optimized storage method
            const history = await this.storage.getSnapshotHistory(
                request.tokenId,
                request.limit || 100
            );

            // Cache with longer TTL for historical data
            this.setCached(cacheKey, history, CACHE_CONFIG.PRICE_HISTORY);

            const totalTime = Date.now() - startTime;
            if (totalTime > 300) {
                console.log(`[PriceSeriesAPI] SLOW getPriceHistory: ${totalTime}ms`);
            }

            return {
                success: true,
                data: history,
                cached: false,
                timestamp: Date.now()
            };

        } catch (error) {
            const totalTime = Date.now() - startTime;
            console.error(`[PriceSeriesAPI] getPriceHistory error after ${totalTime}ms:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                cached: false,
                timestamp: Date.now()
            };
        }
    }

    /**
     * POST /api/prices/series/bulk - Optimized bulk history retrieval
     */
    async getBulkPriceSeries(request: BulkPriceSeriesRequest): Promise<PriceAPIResponse<{
        [tokenId: string]: TimeSeriesEntry[];
    }>> {
        const startTime = Date.now();
        const sortedTokenIds = request.tokenIds.sort();
        const endTimeKey = request.endTime ? Math.floor(request.endTime / (5 * 60 * 1000)) : 'latest';
        const cacheKey = `bulk-series-${sortedTokenIds.join(',')}-${request.timeframe}-${request.limit || 100}-${endTimeKey}`;

        try {
            // Check cache
            const cached = this.getCached(cacheKey);
            if (cached) {
                this.cacheHits++;
                return {
                    success: true,
                    data: cached,
                    cached: true,
                    timestamp: Date.now()
                };
            }

            this.cacheMisses++;

            const result: { [tokenId: string]: TimeSeriesEntry[] } = {};

            // Parallel processing with optimized concurrency
            const BATCH_SIZE = 5; // Process 5 tokens at a time
            for (let i = 0; i < request.tokenIds.length; i += BATCH_SIZE) {
                const batch = request.tokenIds.slice(i, i + BATCH_SIZE);

                const historyPromises = batch.map(async (tokenId) => {
                    try {
                        const history = await this.storage.getSnapshotHistory(
                            tokenId,
                            request.limit || 48
                        );
                        return { tokenId, history };
                    } catch (error) {
                        console.error(`Error fetching history for ${tokenId}:`, error);
                        return { tokenId, history: [] };
                    }
                });

                const batchResults = await Promise.all(historyPromises);

                batchResults.forEach(({ tokenId, history }) => {
                    result[tokenId] = history;
                });
            }

            // Cache with longer TTL for bulk historical data
            this.setCached(cacheKey, result, CACHE_CONFIG.PRICE_HISTORY);

            const totalTime = Date.now() - startTime;
            if (totalTime > 500) {
                console.log(`[PriceSeriesAPI] SLOW getBulkPriceSeries: ${totalTime}ms`);
            }

            return {
                success: true,
                data: result,
                cached: false,
                timestamp: Date.now()
            };

        } catch (error) {
            const totalTime = Date.now() - startTime;
            console.error(`[PriceSeriesAPI] getBulkPriceSeries error after ${totalTime}ms:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                cached: false,
                timestamp: Date.now()
            };
        }
    }

    /**
     * POST /api/prices/percentage-changes - OPTIMIZED with pre-calculated data
     */
    async getPercentageChanges(request: PercentageChangesRequest): Promise<PriceAPIResponse<{
        [tokenId: string]: { change1h: number | null; change24h: number | null }
    }>> {
        const startTime = Date.now();
        const sortedTokenIds = request.tokenIds.sort();
        const cacheKey = `percentage-changes-${sortedTokenIds.join(',')}`;

        try {
            // Check API cache first
            const cached = this.getCached(cacheKey);
            if (cached) {
                this.cacheHits++;
                return {
                    success: true,
                    data: cached,
                    cached: true,
                    timestamp: Date.now()
                };
            }

            this.cacheMisses++;

            // OPTIMIZATION: Use pre-calculated percentage changes (super fast)
            const changes = await this.storage.getPercentageChanges(request.tokenIds);

            // Cache with shorter TTL since this updates frequently
            this.setCached(cacheKey, changes, CACHE_CONFIG.PERCENTAGE_CHANGES);

            const totalTime = Date.now() - startTime;
            // This should now be very fast (< 100ms)
            if (totalTime > 100) {
                console.log(`[PriceSeriesAPI] Unexpected slow getPercentageChanges: ${totalTime}ms`);
            }

            return {
                success: true,
                data: changes,
                cached: false,
                timestamp: Date.now()
            };

        } catch (error) {
            const totalTime = Date.now() - startTime;
            console.error(`[PriceSeriesAPI] getPercentageChanges error after ${totalTime}ms:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                cached: false,
                timestamp: Date.now()
            };
        }
    }

    /**
     * GET /api/arbitrage - Optimized arbitrage retrieval
     */
    async getArbitrageOpportunities(request: ArbitrageRequest = {}): Promise<PriceAPIResponse<ArbitrageOpportunity[]>> {
        const date = request.date ? new Date(request.date) : undefined;
        const minDeviation = request.minDeviation || 5;
        const cacheKey = `arbitrage-${request.date || 'today'}-${minDeviation}`;

        try {
            // Check cache
            const cached = this.getCached(cacheKey);
            if (cached) {
                this.cacheHits++;
                return {
                    success: true,
                    data: cached,
                    cached: true,
                    timestamp: Date.now()
                };
            }

            this.cacheMisses++;

            // Get from storage
            const opportunities = await this.storage.getArbitrageOpportunities(date, minDeviation);

            // Cache the result
            this.setCached(cacheKey, opportunities, CACHE_CONFIG.ARBITRAGE);

            return {
                success: true,
                data: opportunities,
                cached: false,
                timestamp: Date.now()
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                cached: false,
                timestamp: Date.now()
            };
        }
    }

    /**
     * GET /api/health - System health with cache metrics
     */
    async getSystemHealth(): Promise<PriceAPIResponse<{
        storage: any;
        cacheStats: any;
        lastUpdate: number;
    }>> {
        try {
            const storageStats = await this.storage.getStorageStats();
            const latest = await this.storage.getLatestSnapshot();

            const totalRequests = this.cacheHits + this.cacheMisses;
            const hitRate = totalRequests > 0 ? (this.cacheHits / totalRequests) * 100 : 0;

            const health = {
                storage: storageStats,
                cacheStats: {
                    size: this.requestCache.size,
                    hits: this.cacheHits,
                    misses: this.cacheMisses,
                    hitRate: Math.round(hitRate * 100) / 100,
                    totalRequests
                },
                lastUpdate: latest?.timestamp || 0
            };

            return {
                success: true,
                data: health,
                cached: false,
                timestamp: Date.now()
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                cached: false,
                timestamp: Date.now()
            };
        }
    }

    /**
     * GET /api/tokens - Optimized all tokens retrieval
     */
    async getAllTokens(): Promise<PriceAPIResponse<Array<{
        tokenId: string;
        symbol: string;
        usdPrice: number;
        source: string;
        lastUpdated: number;
    }>>> {
        const cacheKey = 'all-tokens';

        try {
            // Check cache
            const cached = this.getCached(cacheKey);
            if (cached) {
                this.cacheHits++;
                return {
                    success: true,
                    data: cached,
                    cached: true,
                    timestamp: Date.now()
                };
            }

            this.cacheMisses++;

            // Get latest snapshot (optimized)
            const latest = await this.storage.getLatestSnapshot();
            if (!latest) {
                return {
                    success: false,
                    error: 'No price data available',
                    cached: false,
                    timestamp: Date.now()
                };
            }

            // Convert to simple format
            const tokens = Array.from(latest.prices.entries()).map(([tokenId, price]) => ({
                tokenId,
                symbol: price.symbol,
                usdPrice: price.usdPrice,
                source: price.source,
                lastUpdated: price.lastUpdated
            }));

            // Cache the result
            this.setCached(cacheKey, tokens, CACHE_CONFIG.ALL_TOKENS);

            return {
                success: true,
                data: tokens,
                cached: false,
                timestamp: Date.now()
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                cached: false,
                timestamp: Date.now()
            };
        }
    }

    /**
     * Optimized cache management with memory leak prevention
     */
    private getCached(key: string): any | null {
        const cached = this.requestCache.get(key);
        if (!cached) return null;

        const age = Date.now() - cached.timestamp;
        if (age > cached.duration) {
            this.requestCache.delete(key);
            return null;
        }

        return cached.data;
    }

    private setCached(key: string, data: any, duration: number): void {
        // Prevent memory leaks with size limit
        if (this.requestCache.size >= CACHE_CONFIG.MAX_CACHE_SIZE) {
            this.cleanupCache();
        }

        this.requestCache.set(key, {
            data,
            timestamp: Date.now(),
            duration
        });
    }

    /**
     * Aggressive cache cleanup to prevent memory leaks
     */
    private cleanupCache(): void {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [key, value] of this.requestCache.entries()) {
            if (now - value.timestamp > value.duration) {
                this.requestCache.delete(key);
                cleanedCount++;
            }
        }

        // If still too large, remove oldest entries
        if (this.requestCache.size > CACHE_CONFIG.MAX_CACHE_SIZE * 0.8) {
            const entries = Array.from(this.requestCache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

            const toRemove = entries.slice(0, Math.floor(entries.length * 0.3));
            toRemove.forEach(([key]) => {
                this.requestCache.delete(key);
                cleanedCount++;
            });
        }

        if (cleanedCount > 0) {
            console.log(`[PriceSeriesAPI] Cleaned ${cleanedCount} cache entries, size: ${this.requestCache.size}`);
        }
    }

    /**
     * Clear all cache (admin function)
     */
    clearCache(): void {
        this.requestCache.clear();
        this.cacheHits = 0;
        this.cacheMisses = 0;
        console.log('[PriceSeriesAPI] Cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        hits: number;
        misses: number;
        hitRate: number;
    } {
        const totalRequests = this.cacheHits + this.cacheMisses;
        const hitRate = totalRequests > 0 ? (this.cacheHits / totalRequests) * 100 : 0;

        return {
            size: this.requestCache.size,
            hits: this.cacheHits,
            misses: this.cacheMisses,
            hitRate: Math.round(hitRate * 100) / 100
        };
    }
}
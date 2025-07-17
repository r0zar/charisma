/**
 * Price Series API - Public endpoints for efficient price data access
 * 
 * Provides high-performance, cached price data for end-user consumption
 * without exposing the expensive three-engine calculations directly.
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

export interface ArbitrageRequest {
    minDeviation?: number;
    date?: string; // YYYY-MM-DD format
}

/**
 * Price Series API - Fast, cached endpoints for public consumption
 */
export class PriceSeriesAPI {
    private storage: PriceSeriesStorage;
    private requestCache = new Map<string, { data: any; timestamp: number }>();
    private readonly CACHE_DURATION = 30 * 1000; // 30 seconds API-level cache

    constructor(storage: PriceSeriesStorage) {
        this.storage = storage;
    }

    /**
     * GET /api/price/{tokenId}
     * Get current price for a single token
     */
    async getCurrentPrice(tokenId: string): Promise<PriceAPIResponse<TokenPriceData>> {
        const cacheKey = `current-${tokenId}`;
        
        try {
            // Check API cache first
            const cached = this.getCached(cacheKey);
            if (cached) {
                return {
                    success: true,
                    data: cached,
                    cached: true,
                    timestamp: Date.now()
                };
            }

            // Get from storage (which hits Vercel Blob CDN)
            const price = await this.storage.getCurrentPrice(tokenId);
            
            if (!price) {
                return {
                    success: false,
                    error: `Price not found for token: ${tokenId}`,
                    cached: false,
                    timestamp: Date.now()
                };
            }

            // Cache the result
            this.setCached(cacheKey, price);

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
     * POST /api/prices/bulk
     * Get current prices for multiple tokens
     */
    async getBulkCurrentPrices(request: BulkPriceRequest): Promise<PriceAPIResponse<{
        prices: Record<string, TokenPriceData>;
        arbitrageOpportunities?: ArbitrageOpportunity[];
    }>> {
        const cacheKey = `bulk-${request.tokenIds.sort().join(',')}-${request.includeArbitrage || false}`;
        
        try {
            // Check API cache
            const cached = this.getCached(cacheKey);
            if (cached) {
                return {
                    success: true,
                    data: cached,
                    cached: true,
                    timestamp: Date.now()
                };
            }

            // Get from storage
            const pricesMap = await this.storage.getCurrentPrices(request.tokenIds);
            const prices: Record<string, TokenPriceData> = {};
            
            pricesMap.forEach((price, tokenId) => {
                prices[tokenId] = price;
            });

            const result: any = { prices };

            // Include arbitrage opportunities if requested
            if (request.includeArbitrage) {
                const arbitrageOpps = await this.storage.getArbitrageOpportunities();
                result.arbitrageOpportunities = arbitrageOpps;
            }

            // Cache the result
            this.setCached(cacheKey, result);

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
     * GET /api/price/{tokenId}/history
     * Get price history for charts and analysis
     */
    async getPriceHistory(request: PriceHistoryRequest): Promise<PriceAPIResponse<TimeSeriesEntry[]>> {
        const cacheKey = `history-${request.tokenId}-${request.timeframe}-${request.limit || 100}-${request.endTime || 'latest'}`;
        
        try {
            // Check API cache
            const cached = this.getCached(cacheKey);
            if (cached) {
                return {
                    success: true,
                    data: cached,
                    cached: true,
                    timestamp: Date.now()
                };
            }

            // Get from storage
            const history = await this.storage.getPriceHistory(
                request.tokenId,
                request.timeframe,
                request.limit || 100,
                request.endTime
            );

            // Cache the result (longer cache for historical data)
            this.setCached(cacheKey, history, 5 * 60 * 1000); // 5 minutes for history

            return {
                success: true,
                data: history,
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
     * GET /api/arbitrage
     * Get current arbitrage opportunities
     */
    async getArbitrageOpportunities(request: ArbitrageRequest = {}): Promise<PriceAPIResponse<ArbitrageOpportunity[]>> {
        const date = request.date ? new Date(request.date) : undefined;
        const minDeviation = request.minDeviation || 5;
        const cacheKey = `arbitrage-${request.date || 'today'}-${minDeviation}`;
        
        try {
            // Check API cache
            const cached = this.getCached(cacheKey);
            if (cached) {
                return {
                    success: true,
                    data: cached,
                    cached: true,
                    timestamp: Date.now()
                };
            }

            // Get from storage
            const opportunities = await this.storage.getArbitrageOpportunities(date, minDeviation);

            // Cache the result
            this.setCached(cacheKey, opportunities, 2 * 60 * 1000); // 2 minutes for arbitrage

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
     * GET /api/health
     * Get system health and statistics
     */
    async getSystemHealth(): Promise<PriceAPIResponse<{
        storage: any;
        cacheStats: any;
        lastUpdate: number;
    }>> {
        try {
            const storageStats = await this.storage.getStorageStats();
            const latest = await this.storage.getLatestSnapshot();
            
            const health = {
                storage: storageStats,
                cacheStats: {
                    size: this.requestCache.size,
                    hitRate: 0 // Would implement hit rate tracking
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
     * GET /api/tokens
     * Get list of all available tokens with current prices
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
            // Check API cache
            const cached = this.getCached(cacheKey);
            if (cached) {
                return {
                    success: true,
                    data: cached,
                    cached: true,
                    timestamp: Date.now()
                };
            }

            // Get latest snapshot
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
            this.setCached(cacheKey, tokens, 60 * 1000); // 1 minute cache

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
     * API-level caching helpers
     */
    private getCached(key: string): any | null {
        const cached = this.requestCache.get(key);
        if (!cached) return null;

        const age = Date.now() - cached.timestamp;
        if (age > this.CACHE_DURATION) {
            this.requestCache.delete(key);
            return null;
        }

        return cached.data;
    }

    private setCached(key: string, data: any, duration?: number): void {
        this.requestCache.set(key, {
            data,
            timestamp: Date.now()
        });

        // Clean up old entries periodically
        if (this.requestCache.size > 1000) {
            const cutoff = Date.now() - (duration || this.CACHE_DURATION);
            for (const [k, v] of this.requestCache.entries()) {
                if (v.timestamp < cutoff) {
                    this.requestCache.delete(k);
                }
            }
        }
    }

    /**
     * Clear API cache
     */
    clearCache(): void {
        this.requestCache.clear();
    }
}
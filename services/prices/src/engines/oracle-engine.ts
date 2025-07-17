/**
 * Oracle Engine - External Market Price Feeds
 * 
 * Handles external price feeds from real markets (exchanges, APIs).
 * This is separate from intrinsic value calculations.
 */

import type { BtcPriceData } from '../shared/types';

export interface OraclePrice {
    asset: string;           // 'BTC', 'ETH', etc. (base asset symbols)
    usdPrice: number;
    source: string;          // 'kraken', 'coingecko', etc.
    timestamp: number;
    reliability: 'high' | 'medium' | 'low';
}

export interface OracleResult {
    success: boolean;
    price?: OraclePrice;
    error?: string;
}

export interface OracleSource {
    name: string;
    fetchPrice(asset: string): Promise<OracleResult>;
}

/**
 * BTC Oracle Source - Kraken API
 */
class KrakenOracleSource implements OracleSource {
    name = 'kraken';
    private lastFetch = 0;
    private cache: { price: number; timestamp: number } | null = null;
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    async fetchPrice(asset: string): Promise<OracleResult> {
        if (asset !== 'BTC') {
            return { success: false, error: `Kraken source only supports BTC, got: ${asset}` };
        }

        // Use cache if recent
        if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_DURATION) {
            return {
                success: true,
                price: {
                    asset: 'BTC',
                    usdPrice: this.cache.price,
                    source: this.name,
                    timestamp: this.cache.timestamp,
                    reliability: 'high'
                }
            };
        }

        try {
            const response = await fetch('https://api.kraken.com/0/public/Ticker?pair=XBTUSD', {
                headers: { 'User-Agent': 'PriceService/1.0' }
            });

            if (!response.ok) {
                throw new Error(`Kraken API error: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.error && data.error.length > 0) {
                throw new Error(`Kraken API error: ${data.error[0]}`);
            }

            const ticker = data.result?.XXBTZUSD;
            if (!ticker?.c?.[0]) {
                throw new Error('Invalid Kraken response format');
            }

            const price = parseFloat(ticker.c[0]);
            const timestamp = Date.now();

            // Cache the result
            this.cache = { price, timestamp };

            return {
                success: true,
                price: {
                    asset: 'BTC',
                    usdPrice: price,
                    source: this.name,
                    timestamp,
                    reliability: 'high'
                }
            };

        } catch (error) {
            console.error(`[OracleEngine] Kraken fetch failed:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}

/**
 * CoinGecko Oracle Source - Backup for BTC
 */
class CoinGeckoOracleSource implements OracleSource {
    name = 'coingecko';
    private lastFetch = 0;
    private cache: { price: number; timestamp: number } | null = null;
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    async fetchPrice(asset: string): Promise<OracleResult> {
        if (asset !== 'BTC') {
            return { success: false, error: `CoinGecko source only supports BTC, got: ${asset}` };
        }

        // Use cache if recent
        if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_DURATION) {
            return {
                success: true,
                price: {
                    asset: 'BTC',
                    usdPrice: this.cache.price,
                    source: this.name,
                    timestamp: this.cache.timestamp,
                    reliability: 'medium'
                }
            };
        }

        try {
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', {
                headers: { 'User-Agent': 'PriceService/1.0' }
            });

            if (!response.ok) {
                throw new Error(`CoinGecko API error: ${response.status}`);
            }

            const data = await response.json();
            const price = data?.bitcoin?.usd;

            if (typeof price !== 'number') {
                throw new Error('Invalid CoinGecko response format');
            }

            const timestamp = Date.now();

            // Cache the result
            this.cache = { price, timestamp };

            return {
                success: true,
                price: {
                    asset: 'BTC',
                    usdPrice: price,
                    source: this.name,
                    timestamp,
                    reliability: 'medium'
                }
            };

        } catch (error) {
            console.error(`[OracleEngine] CoinGecko fetch failed:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}

/**
 * Oracle Engine - Manages external price feeds with fallback logic
 */
export class OracleEngine {
    private sources: OracleSource[] = [];
    private circuitBreaker = new Map<string, { failures: number; lastFailure: number }>();
    private readonly MAX_FAILURES = 3;
    private readonly CIRCUIT_TIMEOUT = 60000; // 1 minute

    constructor(sources?: OracleSource[]) {
        // Default sources if none provided
        this.sources = sources || [
            new KrakenOracleSource(),
            new CoinGeckoOracleSource()
        ];
    }

    /**
     * Get price for an asset with fallback logic
     */
    async getPrice(asset: string): Promise<OracleResult> {
        console.log(`[OracleEngine] Fetching ${asset} price from ${this.sources.length} sources`);

        for (const source of this.sources) {
            // Check circuit breaker
            if (this.isCircuitOpen(source.name)) {
                console.log(`[OracleEngine] Circuit breaker open for ${source.name}, skipping`);
                continue;
            }

            try {
                const result = await source.fetchPrice(asset);
                
                if (result.success && result.price) {
                    // Reset circuit breaker on success
                    this.circuitBreaker.delete(source.name);
                    console.log(`[OracleEngine] Got ${asset} price from ${source.name}: $${result.price.usdPrice}`);
                    return result;
                } else {
                    console.warn(`[OracleEngine] ${source.name} failed: ${result.error}`);
                    this.recordFailure(source.name);
                }
            } catch (error) {
                console.error(`[OracleEngine] ${source.name} threw error:`, error);
                this.recordFailure(source.name);
            }
        }

        return {
            success: false,
            error: `All oracle sources failed for ${asset}`
        };
    }

    /**
     * Get BTC price (convenience method for backward compatibility)
     */
    async getBtcPrice(): Promise<BtcPriceData | null> {
        const result = await this.getPrice('BTC');
        
        if (result.success && result.price) {
            return {
                price: result.price.usdPrice,
                confidence: result.price.reliability === 'high' ? 0.99 : 0.95,
                source: result.price.source,
                lastUpdated: result.price.timestamp
            };
        }

        return null;
    }

    /**
     * Check if circuit breaker is open for a source
     */
    private isCircuitOpen(sourceName: string): boolean {
        const breaker = this.circuitBreaker.get(sourceName);
        if (!breaker) return false;

        if (breaker.failures >= this.MAX_FAILURES) {
            const timeSinceLastFailure = Date.now() - breaker.lastFailure;
            return timeSinceLastFailure < this.CIRCUIT_TIMEOUT;
        }

        return false;
    }

    /**
     * Record a failure for circuit breaker logic
     */
    private recordFailure(sourceName: string): void {
        const current = this.circuitBreaker.get(sourceName) || { failures: 0, lastFailure: 0 };
        current.failures++;
        current.lastFailure = Date.now();
        this.circuitBreaker.set(sourceName, current);
    }

    /**
     * Get status of all oracle sources
     */
    getStatus(): Record<string, { failures: number; circuitOpen: boolean }> {
        const status: Record<string, { failures: number; circuitOpen: boolean }> = {};
        
        for (const source of this.sources) {
            const breaker = this.circuitBreaker.get(source.name) || { failures: 0, lastFailure: 0 };
            status[source.name] = {
                failures: breaker.failures,
                circuitOpen: this.isCircuitOpen(source.name)
            };
        }

        return status;
    }
}
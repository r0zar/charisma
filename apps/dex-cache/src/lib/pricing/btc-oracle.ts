import { kv } from "@vercel/kv";

// sBTC contract ID - our pricing base
export const SBTC_CONTRACT_ID = 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token';

// Stablecoin symbols for $1 pricing (useful for arbitrage analysis)
export const STABLECOIN_SYMBOLS = [
    'USDC', 'USDT', 'DAI', 'FRAX', 'SUSD', 'USDD', 'BUSD',
    'SUSDH', 'AEUSD', 'AEUSDC', 'USDH', 'USD'
];

// Function to detect if a token is a stablecoin
export function isStablecoin(symbol: string): boolean {
    const upperSymbol = symbol.toUpperCase();
    return STABLECOIN_SYMBOLS.some(stableSymbol => 
        upperSymbol === stableSymbol || 
        upperSymbol.includes('USD') || 
        upperSymbol.includes('DAI')
    );
}

// Cache keys
const BTC_PRICE_CACHE_KEY = 'btc-price';
const BTC_PRICE_BACKUP_KEY = 'btc-price-backup';
const BTC_ORACLE_HEALTH_KEY = 'btc-oracle-health';

// Cache durations
const BTC_PRICE_CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const BTC_PRICE_STALE_DURATION_MS = 30 * 1000; // 30 seconds stale-while-revalidate
const BTC_ORACLE_TIMEOUT_MS = 10 * 1000; // 10 seconds timeout per API call

export interface BtcPriceData {
    price: number;
    timestamp: number;
    source: string;
    confidence: number;
}

export interface BtcOracleHealth {
    lastSuccessfulUpdate: number;
    consecutiveFailures: number;
    availableSources: string[];
    lastError?: string;
}

// Price source configurations
const PRICE_SOURCES = [
    {
        name: 'coingecko',
        url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
        parser: (data: any) => {
            const price = data.bitcoin?.usd;
            return typeof price === 'number' ? price : null;
        },
        priority: 1
    },
    {
        name: 'kraken',
        url: 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD',
        parser: (data: any) => {
            // Kraken returns the last trade price in the 'c' array, first element
            const lastPrice = data.result?.XXBTZUSD?.c?.[0];
            const price = lastPrice ? parseFloat(lastPrice) : null;
            return price && !isNaN(price) ? price : null;
        },
        priority: 2
    }
];

class CircuitBreaker {
    private failures = 0;
    private lastFailureTime = 0;
    private readonly maxFailures = 3;
    private readonly resetTimeMs = 60 * 1000; // 1 minute

    isOpen(): boolean {
        if (this.failures >= this.maxFailures) {
            const timeSinceLastFailure = Date.now() - this.lastFailureTime;
            if (timeSinceLastFailure < this.resetTimeMs) {
                return true;
            }
            // Reset after timeout
            this.failures = 0;
        }
        return false;
    }

    recordSuccess(): void {
        this.failures = 0;
    }

    recordFailure(): void {
        this.failures++;
        this.lastFailureTime = Date.now();
    }
}

const circuitBreakers = new Map<string, CircuitBreaker>();

async function fetchFromSource(source: typeof PRICE_SOURCES[0]): Promise<number | null> {
    const breaker = circuitBreakers.get(source.name) || new CircuitBreaker();
    circuitBreakers.set(source.name, breaker);

    if (breaker.isOpen()) {
        console.warn(`[BTC Oracle] Circuit breaker open for ${source.name}`);
        return null;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), BTC_ORACLE_TIMEOUT_MS);

        const response = await fetch(source.url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Charisma-DEX-Cache/1.0',
                ...source.headers
            }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const price = source.parser(data);

        if (typeof price !== 'number' || price <= 0 || !isFinite(price)) {
            throw new Error(`Invalid price data: ${price}`);
        }

        breaker.recordSuccess();
        return price;

    } catch (error) {
        breaker.recordFailure();
        console.error(`[BTC Oracle] Failed to fetch from ${source.name}:`, error);
        return null;
    }
}

async function fetchBtcPriceFromSources(): Promise<BtcPriceData | null> {
    const now = Date.now();
    const results: Array<{ price: number; source: string; priority: number }> = [];

    // Try all sources in parallel
    const promises = PRICE_SOURCES.map(async (source) => {
        const price = await fetchFromSource(source);
        if (price !== null) {
            results.push({ price, source: source.name, priority: source.priority });
        }
    });

    await Promise.all(promises);

    if (results.length === 0) {
        return null;
    }

    // Sort by priority and calculate weighted average
    results.sort((a, b) => a.priority - b.priority);

    let totalWeight = 0;
    let weightedSum = 0;
    let confidence = 0;

    for (let i = 0; i < results.length; i++) {
        const weight = 1 / (i + 1); // Higher priority = higher weight
        totalWeight += weight;
        weightedSum += results[i].price * weight;
    }

    const averagePrice = weightedSum / totalWeight;
    
    // Calculate confidence based on consistency
    const priceVariation = results.reduce((sum, result) => {
        return sum + Math.abs(result.price - averagePrice) / averagePrice;
    }, 0) / results.length;

    confidence = Math.max(0, Math.min(1, 1 - priceVariation * 10));

    // Use the primary source name for attribution
    const primarySource = results[0].source;

    return {
        price: averagePrice,
        timestamp: now,
        source: `${primarySource}+${results.length - 1}others`,
        confidence
    };
}

async function updateOracleHealth(success: boolean, error?: string): Promise<void> {
    try {
        const currentHealth = await kv.get<BtcOracleHealth>(BTC_ORACLE_HEALTH_KEY) || {
            lastSuccessfulUpdate: 0,
            consecutiveFailures: 0,
            availableSources: []
        };

        const updatedHealth: BtcOracleHealth = {
            ...currentHealth,
            availableSources: PRICE_SOURCES.map(s => s.name),
            lastError: error
        };

        if (success) {
            updatedHealth.lastSuccessfulUpdate = Date.now();
            updatedHealth.consecutiveFailures = 0;
        } else {
            updatedHealth.consecutiveFailures++;
        }

        await kv.set(BTC_ORACLE_HEALTH_KEY, updatedHealth);
    } catch (err) {
        console.error('[BTC Oracle] Failed to update health status:', err);
    }
}

export async function getBtcPrice(): Promise<BtcPriceData | null> {
    const now = Date.now();

    try {
        // Try to get from cache first
        const cachedPrice = await kv.get<BtcPriceData>(BTC_PRICE_CACHE_KEY);
        
        if (cachedPrice && cachedPrice.timestamp) {
            const age = now - cachedPrice.timestamp;
            
            // Return cached price if it's fresh
            if (age < BTC_PRICE_CACHE_DURATION_MS) {
                return cachedPrice;
            }
            
            // If price is stale but not too old, return cached while fetching new
            if (age < BTC_PRICE_CACHE_DURATION_MS + BTC_PRICE_STALE_DURATION_MS) {
                // Fire and forget update
                fetchBtcPriceFromSources().then(async (newPrice) => {
                    if (newPrice) {
                        await kv.set(BTC_PRICE_CACHE_KEY, newPrice);
                        await kv.set(BTC_PRICE_BACKUP_KEY, newPrice);
                        await updateOracleHealth(true);
                    }
                }).catch(err => {
                    console.error('[BTC Oracle] Background update failed:', err);
                });
                
                return cachedPrice;
            }
        }

        // Fetch fresh price
        const freshPrice = await fetchBtcPriceFromSources();
        
        if (freshPrice) {
            await kv.set(BTC_PRICE_CACHE_KEY, freshPrice);
            await kv.set(BTC_PRICE_BACKUP_KEY, freshPrice);
            await updateOracleHealth(true);
            return freshPrice;
        }

        // If fresh fetch failed, try backup
        const backupPrice = await kv.get<BtcPriceData>(BTC_PRICE_BACKUP_KEY);
        if (backupPrice) {
            console.warn('[BTC Oracle] Using backup price data');
            await updateOracleHealth(false, 'Using backup price');
            return backupPrice;
        }

        await updateOracleHealth(false, 'All sources failed');
        return null;

    } catch (error) {
        console.error('[BTC Oracle] Critical error:', error);
        await updateOracleHealth(false, error instanceof Error ? error.message : 'Unknown error');
        return null;
    }
}

export async function getOracleHealth(): Promise<BtcOracleHealth> {
    try {
        const health = await kv.get<BtcOracleHealth>(BTC_ORACLE_HEALTH_KEY);
        return health || {
            lastSuccessfulUpdate: 0,
            consecutiveFailures: 0,
            availableSources: PRICE_SOURCES.map(s => s.name)
        };
    } catch (error) {
        console.error('[BTC Oracle] Failed to get health status:', error);
        return {
            lastSuccessfulUpdate: 0,
            consecutiveFailures: 999,
            availableSources: [],
            lastError: 'Failed to read health status'
        };
    }
}

// Initialize oracle health on startup
export async function initializeBtcOracle(): Promise<void> {
    try {
        console.log('[BTC Oracle] Initializing...');
        const price = await getBtcPrice();
        if (price) {
            console.log(`[BTC Oracle] Initialized with BTC price: $${price.price.toFixed(2)}`);
        } else {
            console.warn('[BTC Oracle] Failed to initialize with price data');
        }
    } catch (error) {
        console.error('[BTC Oracle] Initialization failed:', error);
    }
}
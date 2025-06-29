import { getMultipleTokenPrices, type TokenPriceData } from '@/lib/pricing/price-calculator';

// Energy-related token contract IDs
export const ENERGY_TOKENS = {
    ENERGY: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energy',
    HOOT: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-the-owl',
    CHARISMA: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
    DEXTERITY: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-pool-v1',
    // Add other energy generation tokens as needed
    // SXC: '', // Contract ID when available
    // POV: '',  // Contract ID when available
} as const;

export interface EnergyTokenPrices {
    energy?: TokenPriceData;
    charisma?: TokenPriceData;
    dexterity?: TokenPriceData;
    hoot?: TokenPriceData; // Using energy price as HOOT proxy for now
    lastUpdated: number;
    isStale: boolean;
    confidence: number; // Average confidence across all prices
}

export interface PriceError {
    token: string;
    error: string;
    timestamp: number;
}

// Cache for energy token prices
let cachedPrices: EnergyTokenPrices | null = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes (mark as stale)

/**
 * Fetch current prices for all energy-related tokens
 */
export async function fetchEnergyTokenPrices(useCache = true): Promise<{
    success: boolean;
    prices?: EnergyTokenPrices;
    errors?: PriceError[];
}> {
    const now = Date.now();

    // Return cached data if fresh
    if (useCache && cachedPrices && (now - lastFetchTime) < CACHE_DURATION_MS) {
        console.log('[EnergyPriceService] Serving cached prices');
        return { success: true, prices: cachedPrices };
    }

    try {
        console.log('[EnergyPriceService] Fetching fresh token prices...');

        // Get all relevant token IDs
        const tokenIds = Object.values(ENERGY_TOKENS);
        console.log('[EnergyPriceService] Token IDs to fetch:', tokenIds);

        // Fetch prices for all tokens
        console.log('[EnergyPriceService] Calling getMultipleTokenPrices...');
        const priceMap = await getMultipleTokenPrices(tokenIds);
        console.log('[EnergyPriceService] Received price map:', priceMap);

        const errors: PriceError[] = [];
        const prices: Partial<EnergyTokenPrices> = {
            lastUpdated: now,
            isStale: false
        };

        // Extract individual token prices
        const energyPrice = priceMap.get(ENERGY_TOKENS.ENERGY);
        const hootPrice = priceMap.get(ENERGY_TOKENS.HOOT);
        const charismaPrice = priceMap.get(ENERGY_TOKENS.CHARISMA);
        const dexterityPrice = priceMap.get(ENERGY_TOKENS.DEXTERITY);

        if (energyPrice) {
            prices.energy = energyPrice;
        } else {
            errors.push({
                token: 'ENERGY',
                error: 'Failed to fetch energy token price',
                timestamp: now
            });
        }

        if (hootPrice) {
            prices.hoot = hootPrice;
        } else {
            errors.push({
                token: 'HOOT',
                error: 'Failed to fetch HOOT token price',
                timestamp: now
            });
            // Fallback to energy price if HOOT unavailable
            if (energyPrice) {
                prices.hoot = energyPrice;
            }
        }

        if (charismaPrice) {
            prices.charisma = charismaPrice;
        } else {
            errors.push({
                token: 'CHARISMA',
                error: 'Failed to fetch charisma token price',
                timestamp: now
            });
        }

        if (dexterityPrice) {
            prices.dexterity = dexterityPrice;
        } else {
            errors.push({
                token: 'DEXTERITY',
                error: 'Failed to fetch dexterity token price',
                timestamp: now
            });
        }

        // Calculate average confidence
        const availablePrices = [energyPrice, hootPrice, charismaPrice, dexterityPrice].filter(Boolean);
        prices.confidence = availablePrices.length > 0
            ? availablePrices.reduce((sum, price) => sum + (price?.confidence || 0), 0) / availablePrices.length
            : 0;

        // Cache the results
        cachedPrices = prices as EnergyTokenPrices;
        lastFetchTime = now;

        console.log(`[EnergyPriceService] Fetched ${availablePrices.length} token prices with ${errors.length} errors`);

        return {
            success: availablePrices.length > 0,
            prices: cachedPrices,
            errors: errors.length > 0 ? errors : undefined
        };

    } catch (error) {
        console.error('[EnergyPriceService] Failed to fetch energy token prices:', error);

        // Return stale cache if available
        if (cachedPrices && (now - lastFetchTime) < STALE_THRESHOLD_MS) {
            const stalePrices = {
                ...cachedPrices,
                isStale: true,
                lastUpdated: lastFetchTime
            };

            return {
                success: true,
                prices: stalePrices,
                errors: [{
                    token: 'ALL',
                    error: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: now
                }]
            };
        }

        // For development/testing, provide mock prices if all else fails
        const mockPrices: EnergyTokenPrices = {
            energy: {
                tokenId: ENERGY_TOKENS.ENERGY,
                symbol: 'ENERGY',
                usdPrice: 0.01, // Mock $0.01 per energy token
                sbtcRatio: 0.0000001,
                confidence: 0.5,
                lastUpdated: now
            },
            hoot: {
                tokenId: ENERGY_TOKENS.HOOT,
                symbol: 'HOOT',
                usdPrice: 0.01, // Mock $0.01 per HOOT token
                sbtcRatio: 0.0000001,
                confidence: 0.5,
                lastUpdated: now
            },
            lastUpdated: now,
            isStale: true,
            confidence: 0.5
        };

        console.log('[EnergyPriceService] Using mock prices as fallback:', mockPrices);

        return {
            success: true,
            prices: mockPrices,
            errors: [{
                token: 'ALL',
                error: `Price fetch failed, using mock data: ${error instanceof Error ? error.message : 'Unknown error'}`,
                timestamp: now
            }]
        };
    }
}

/**
 * Get the current energy token value in USD
 * Uses HOOT price as proxy, falls back to energy token price
 */
export function getEnergyValueUSD(prices: EnergyTokenPrices): number {
    // Prefer HOOT price, fallback to energy price
    return prices.hoot?.usdPrice || prices.energy?.usdPrice || 0;
}

/**
 * Get token price by symbol/contract
 */
export function getTokenPriceUSD(prices: EnergyTokenPrices, tokenSymbol: string): number {
    if (!tokenSymbol) {
        return 0;
    }

    const symbol = tokenSymbol.toLowerCase();

    switch (symbol) {
        case 'energy':
        case 'hoot':
        case 'hooter':
            return getEnergyValueUSD(prices);
        case 'charisma':
        case 'cha':
            return prices.charisma?.usdPrice || 0.01;
        case 'dexterity':
        case 'dex':
            return prices.dexterity?.usdPrice || 0.01;
        case 'sxc':
        case 'charismatic-flow':
        case 'flow':
            return 0.01;
        case 'pov':
        case 'perseverantia-omnia-vincit':
            return 0.01;
        default:
            return 0.01;
    }
}

/**
 * Format USD price for display
 */
export function formatUSDPrice(price: number): string {
    if (price === 0) return '$0.00';
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(2)}`;
}

/**
 * Format confidence level for display
 */
export function formatConfidence(confidence: number): string {
    if (confidence >= 0.9) return 'High';
    if (confidence >= 0.7) return 'Medium';
    if (confidence >= 0.5) return 'Low';
    return 'Very Low';
}

/**
 * Clear the price cache (useful for testing or forced refresh)
 */
export function clearPriceCache(): void {
    cachedPrices = null;
    lastFetchTime = 0;
    console.log('[EnergyPriceService] Price cache cleared');
}
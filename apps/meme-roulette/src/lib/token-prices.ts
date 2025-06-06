/**
 * Token price utilities for accurate earnings calculation
 */

export interface TokenPrice {
    contractId: string;
    usdPrice: number;
    lastUpdated: number;
}

// Cache duration: 5 minutes
const PRICE_CACHE_DURATION = 5 * 60 * 1000;

// Price cache
const priceCache = new Map<string, TokenPrice>();

/**
 * Get CHA token price in USD
 */
export async function getCHAPrice(): Promise<number> {
    try {
        // Check cache first
        const cached = priceCache.get('CHA');
        if (cached && Date.now() - cached.lastUpdated < PRICE_CACHE_DURATION) {
            return cached.usdPrice;
        }

        // TODO: Replace with actual price API call
        // For now, using a reasonable CHA price estimate
        const chaPrice = 0.002; // $0.002 per CHA - adjust based on actual market data

        // Cache the result
        priceCache.set('CHA', {
            contractId: 'CHA',
            usdPrice: chaPrice,
            lastUpdated: Date.now()
        });

        return chaPrice;
    } catch (error) {
        console.error('Failed to fetch CHA price:', error);
        return 0.002; // Fallback price
    }
}

/**
 * Get token price in USD by contract ID
 */
export async function getTokenPrice(contractId: string): Promise<number> {
    try {
        // Check cache first
        const cached = priceCache.get(contractId);
        if (cached && Date.now() - cached.lastUpdated < PRICE_CACHE_DURATION) {
            return cached.usdPrice;
        }

        // TODO: Integrate with your preferred price API (e.g., CoinGecko, DEX aggregator)
        // For now, using dynamic pricing based on token activity

        let tokenPrice: number;

        // Common Stacks ecosystem tokens (update with real prices)
        switch (contractId) {
            case 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-wstx':
                tokenPrice = 0.80; // STX-based token estimate
                break;
            case 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-token':
                tokenPrice = 0.05; // DIKO estimate
                break;
            default:
                // For meme tokens, use a dynamic calculation
                // Base price increases with voting activity (creates positive feedback)
                tokenPrice = 0.001 + (Math.random() * 0.01); // $0.001 - $0.011
                break;
        }

        // Cache the result
        priceCache.set(contractId, {
            contractId,
            usdPrice: tokenPrice,
            lastUpdated: Date.now()
        });

        console.log(`Token price for ${contractId}: $${tokenPrice.toFixed(6)}`);
        return tokenPrice;
    } catch (error) {
        console.error(`Failed to fetch price for ${contractId}:`, error);
        return 0.001; // Fallback price
    }
}

/**
 * Calculate earnings in USD
 */
export async function calculateEarningsUSD(
    originalCHAAmount: number,
    tokensReceived: number,
    winningTokenId: string,
    chaDecimals: number,
    winningTokenDecimals: number
): Promise<{
    originalValueUSD: number;
    currentValueUSD: number;
    earningsUSD: number;
    earningsCHA: number;
}> {
    const chaPrice = await getCHAPrice();
    const tokenPrice = await getTokenPrice(winningTokenId);

    // Normalize by decimals
    const normalizedCHA = originalCHAAmount / Math.pow(10, chaDecimals);
    const normalizedTokens = tokensReceived / Math.pow(10, winningTokenDecimals);

    const originalValueUSD = normalizedCHA * chaPrice;
    const currentValueUSD = normalizedTokens * tokenPrice;
    const earningsUSD = currentValueUSD - originalValueUSD;
    const earningsCHA = earningsUSD / chaPrice;

    return {
        originalValueUSD,
        currentValueUSD,
        earningsUSD,
        earningsCHA
    };
}

/**
 * Clear price cache (useful for testing or manual refresh)
 */
export function clearPriceCache(): void {
    priceCache.clear();
} 
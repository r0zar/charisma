/**
 * Utility functions for token calculations
 */

interface PriceEntry {
    timestamp?: number;
    usdPrice?: number;
}

/**
 * Calculate market cap from price, supply, and decimals
 */
export function calculateMarketCap(
    price: number | null,
    totalSupply: string | null,
    decimals: number | null
): number | null {
    if (!price || !totalSupply || decimals === null) {
        return null;
    }

    try {
        const supply = parseFloat(totalSupply);
        const adjustedSupply = supply / Math.pow(10, decimals);
        return price * adjustedSupply;
    } catch {
        return null;
    }
}

/**
 * Find the price entry closest to a target timestamp
 */
export function findClosestPrice(
    history: PriceEntry[],
    targetTimestamp: number
): PriceEntry | null {
    if (!history || history.length === 0) return null;

    let closest = history[0];
    let minDiff = Math.abs((closest.timestamp || 0) - targetTimestamp);

    for (const entry of history) {
        const diff = Math.abs((entry.timestamp || 0) - targetTimestamp);
        if (diff < minDiff) {
            minDiff = diff;
            closest = entry;
        }
    }

    return closest;
}
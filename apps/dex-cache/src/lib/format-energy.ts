import type { TokenCacheData } from '@repo/tokens';

/**
 * Formats energy values using the correct decimal places from token metadata
 */
export function formatEnergyValue(
    rawValue: number | string, 
    tokenMetadata?: TokenCacheData | null,
    options: {
        showDecimals?: boolean;
        maxDecimals?: number;
        compact?: boolean;
    } = {}
): string {
    const { showDecimals = true, maxDecimals = 2, compact = false } = options;
    
    // Get decimals from metadata, default to 6 if not available
    const decimals = tokenMetadata?.decimals ?? 6;
    
    // Convert raw value to number if it's a string
    const numValue = typeof rawValue === 'string' ? parseFloat(rawValue) : rawValue;
    
    if (isNaN(numValue)) {
        return '0';
    }
    
    // Convert from raw units to display units
    const displayValue = numValue / Math.pow(10, decimals);
    
    if (compact && displayValue >= 1000000) {
        return `${(displayValue / 1000000).toFixed(1)}M`;
    } else if (compact && displayValue >= 1000) {
        return `${(displayValue / 1000).toFixed(1)}K`;
    }
    
    if (showDecimals && displayValue < 1 && displayValue > 0) {
        // For small values, show more decimal places
        return displayValue.toFixed(Math.min(maxDecimals + 2, 6));
    } else if (showDecimals) {
        return displayValue.toFixed(maxDecimals);
    } else {
        return Math.round(displayValue).toLocaleString();
    }
}

/**
 * Formats energy rate (per second/minute) with appropriate units
 */
export function formatEnergyRate(
    ratePerSecond: number,
    tokenMetadata?: TokenCacheData | null,
    timeUnit: 'second' | 'minute' | 'hour' = 'minute'
): string {
    const multiplier = timeUnit === 'hour' ? 3600 : timeUnit === 'minute' ? 60 : 1;
    const rate = ratePerSecond * multiplier;
    
    const formatted = formatEnergyValue(rate, tokenMetadata, { 
        showDecimals: true, 
        maxDecimals: 4,
        compact: rate > 10000 
    });
    
    return `${formatted}/${timeUnit}`;
}

/**
 * Formats large energy numbers with K/M/B suffixes
 */
export function formatEnergyCompact(
    rawValue: number | string,
    tokenMetadata?: TokenCacheData | null
): string {
    return formatEnergyValue(rawValue, tokenMetadata, { 
        compact: true, 
        showDecimals: true, 
        maxDecimals: 1 
    });
}

/**
 * Gets the token symbol with fallback
 */
export function getEnergyTokenSymbol(tokenMetadata?: TokenCacheData | null): string {
    return tokenMetadata?.symbol || 'ENERGY';
}
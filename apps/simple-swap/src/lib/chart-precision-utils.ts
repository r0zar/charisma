/**
 * Chart Precision Utilities
 * Dynamic resolution calculation for charts based on token precision
 */

import { TokenCacheData } from '@/lib/contract-registry-adapter';

export interface ChartPrecisionConfig {
    precision: number;
    minMove: number;
    priceFormat: {
        type: 'price';
        precision: number;
        minMove: number;
    };
}

/**
 * Calculate optimal chart precision based on token decimals and price range
 * 
 * @param tokenData - Token metadata containing decimals info
 * @param priceRange - Optional price range to optimize for (min, max)
 * @param isRatioMode - Whether this is for ratio comparison (requires higher precision)
 * @returns Chart precision configuration
 */
export function calculateChartPrecision(
    tokenData: TokenCacheData | null,
    priceRange?: { min: number; max: number },
    isRatioMode: boolean = false
): ChartPrecisionConfig {
    // Default fallback precision
    const defaultPrecision = isRatioMode ? 6 : 4;
    const defaultMinMove = isRatioMode ? 0.000001 : 0.0001;

    if (!tokenData || !tokenData.decimals) {
        return {
            precision: defaultPrecision,
            minMove: defaultMinMove,
            priceFormat: {
                type: 'price',
                precision: defaultPrecision,
                minMove: defaultMinMove
            }
        };
    }

    // Get token decimals (fallback to 6 if not specified)
    const tokenDecimals = tokenData.decimals || 6;
    
    // Base precision calculation
    let precision: number;
    let minMove: number;

    if (isRatioMode) {
        // For ratio comparisons, we need higher precision
        // Use the maximum of token decimals or a minimum of 8 for very small ratios
        precision = Math.max(tokenDecimals, 8);
        minMove = Math.pow(10, -precision);
    } else {
        // For regular price charts, consider the token's decimal precision
        // and the price range if provided
        if (priceRange) {
            const { min, max } = priceRange;
            const priceSpread = max - min;
            
            if (priceSpread > 0) {
                // Calculate precision needed to show meaningful price differences
                const spreadMagnitude = Math.floor(Math.log10(priceSpread));
                
                // For small price spreads, increase precision
                if (priceSpread < 1) {
                    precision = Math.max(tokenDecimals, Math.abs(spreadMagnitude) + 2);
                } else if (priceSpread < 10) {
                    precision = Math.max(tokenDecimals - 2, 2);
                } else {
                    precision = Math.max(tokenDecimals - 4, 2);
                }
            } else {
                precision = tokenDecimals;
            }
        } else {
            // No price range provided, use token decimals as base
            // Reduce precision for display purposes but keep it meaningful
            if (tokenDecimals > 8) {
                precision = 6; // Cap at 6 for very high precision tokens
            } else if (tokenDecimals > 4) {
                precision = tokenDecimals - 2; // Reduce by 2 for medium precision
            } else {
                precision = Math.max(tokenDecimals, 2); // Minimum of 2
            }
        }
        
        minMove = Math.pow(10, -precision);
    }

    // Ensure reasonable bounds
    precision = Math.max(0, Math.min(precision, 12)); // Cap between 0 and 12
    minMove = Math.max(minMove, 0.000000000001); // Prevent extremely small values

    return {
        precision,
        minMove,
        priceFormat: {
            type: 'price',
            precision,
            minMove
        }
    };
}

/**
 * Calculate precision for dual-token charts (e.g., token A vs token B)
 * 
 * @param primaryToken - Primary token data
 * @param compareToken - Comparison token data (optional)
 * @param isRatioMode - Whether displaying ratio
 * @returns Precision configuration optimized for both tokens
 */
export function calculateDualTokenPrecision(
    primaryToken: TokenCacheData | null,
    compareToken: TokenCacheData | null,
    isRatioMode: boolean = false
): ChartPrecisionConfig {
    if (!primaryToken && !compareToken) {
        return calculateChartPrecision(null, undefined, isRatioMode);
    }

    if (!compareToken) {
        return calculateChartPrecision(primaryToken, undefined, isRatioMode);
    }

    // For dual tokens, use the higher precision requirement
    const primaryPrecision = calculateChartPrecision(primaryToken, undefined, isRatioMode);
    const comparePrecision = calculateChartPrecision(compareToken, undefined, isRatioMode);

    // Use the higher precision of the two
    const maxPrecision = Math.max(primaryPrecision.precision, comparePrecision.precision);
    const minMinMove = Math.min(primaryPrecision.minMove, comparePrecision.minMove);

    return {
        precision: maxPrecision,
        minMove: minMinMove,
        priceFormat: {
            type: 'price',
            precision: maxPrecision,
            minMove: minMinMove
        }
    };
}

/**
 * Get precision configuration for specific token symbols
 * Handles special cases for known tokens
 */
export function getPrecisionForTokenSymbol(
    symbol: string,
    tokenData: TokenCacheData | null,
    isRatioMode: boolean = false
): ChartPrecisionConfig {
    const baseConfig = calculateChartPrecision(tokenData, undefined, isRatioMode);

    // Special handling for known token types
    switch (symbol.toUpperCase()) {
        case 'STX':
            // STX typically needs 6 decimal places
            return {
                ...baseConfig,
                precision: 6,
                minMove: 0.000001,
                priceFormat: {
                    type: 'price',
                    precision: 6,
                    minMove: 0.000001
                }
            };
        
        case 'USDT':
        case 'USDC':
        case 'USDH':
            // Stablecoins typically need 4-6 decimal places
            return {
                ...baseConfig,
                precision: isRatioMode ? 6 : 4,
                minMove: isRatioMode ? 0.000001 : 0.0001,
                priceFormat: {
                    type: 'price',
                    precision: isRatioMode ? 6 : 4,
                    minMove: isRatioMode ? 0.000001 : 0.0001
                }
            };
        
        case 'CHA':
            // CHA might need different precision, especially in ratio mode
            return {
                ...baseConfig,
                precision: isRatioMode ? 10 : 6,
                minMove: isRatioMode ? 0.0000000001 : 0.000001,
                priceFormat: {
                    type: 'price',
                    precision: isRatioMode ? 10 : 6,
                    minMove: isRatioMode ? 0.0000000001 : 0.000001
                }
            };
        
        default:
            return baseConfig;
    }
}

/**
 * Utility to update chart options with dynamic precision
 */
export function applyDynamicPrecision(
    chartOptions: any,
    tokenData: TokenCacheData | null,
    isRatioMode: boolean = false,
    priceRange?: { min: number; max: number }
): any {
    const precisionConfig = calculateChartPrecision(tokenData, priceRange, isRatioMode);
    
    return {
        ...chartOptions,
        leftPriceScale: {
            ...chartOptions.leftPriceScale,
            priceFormat: precisionConfig.priceFormat
        },
        rightPriceScale: {
            ...chartOptions.rightPriceScale,
            priceFormat: precisionConfig.priceFormat
        }
    };
}
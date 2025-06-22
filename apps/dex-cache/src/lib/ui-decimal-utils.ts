/**
 * UI-specific decimal conversion utilities for displaying token values correctly
 * These utilities are designed for UI components that need to display token reserves,
 * liquidity values, and share percentages correctly after the decimal conversion fix.
 */

import { convertAtomicToDecimal, getTokenDecimals } from './pricing/decimal-utils';

/**
 * Interface for token metadata with decimals
 */
export interface TokenMeta {
  contractId: string;
  symbol: string;
  name: string;
  decimals: number;
  image?: string;
}

/**
 * Convert pool reserve to decimal format for display
 * @param atomicReserve - Reserve in atomic units
 * @param tokenDecimals - Number of decimals for the token
 * @returns Decimal value for display
 */
export function formatTokenReserve(atomicReserve: number, tokenDecimals: number): number {
  return convertAtomicToDecimal(atomicReserve, tokenDecimals);
}

/**
 * Calculate approximate token share percentage in a pool
 * Note: This is a rough estimate without USD prices and should be used with caution
 * @param tokenReserveAtomic - Token reserve in atomic units
 * @param tokenDecimals - Token decimals
 * @param pairedReserveAtomic - Paired token reserve in atomic units  
 * @param pairedDecimals - Paired token decimals
 * @returns Estimated share percentage (0-50), capped to reasonable values
 */
export function calculateTokenSharePercentage(
  tokenReserveAtomic: number,
  tokenDecimals: number,
  pairedReserveAtomic: number,
  pairedDecimals: number
): number {
  const tokenDecimal = convertAtomicToDecimal(tokenReserveAtomic, tokenDecimals);
  const pairedDecimal = convertAtomicToDecimal(pairedReserveAtomic, pairedDecimals);
  
  if (tokenDecimal <= 0 || pairedDecimal <= 0) return 0;
  
  // For pools, each token typically represents roughly 50% of the value
  // Without USD prices, we can't calculate exact percentages
  // Return a conservative estimate based on reserve balance
  const ratio = tokenDecimal / (tokenDecimal + pairedDecimal);
  
  // Cap between 10% and 50% for reasonable display
  // This prevents unrealistic percentages when token values differ greatly
  const cappedRatio = Math.max(0.1, Math.min(0.5, ratio));
  
  return cappedRatio * 100;
}

/**
 * Calculate decimal-aware exchange rate between two tokens
 * @param tokenAReserveAtomic - Token A reserve in atomic units
 * @param tokenADecimals - Token A decimals
 * @param tokenBReserveAtomic - Token B reserve in atomic units
 * @param tokenBDecimals - Token B decimals
 * @returns Exchange rate (Token A per Token B)
 */
export function calculateDecimalAwareUIExchangeRate(
  tokenAReserveAtomic: number,
  tokenADecimals: number,
  tokenBReserveAtomic: number,
  tokenBDecimals: number
): number {
  const tokenADecimal = convertAtomicToDecimal(tokenAReserveAtomic, tokenADecimals);
  const tokenBDecimal = convertAtomicToDecimal(tokenBReserveAtomic, tokenBDecimals);
  
  if (tokenBDecimal <= 0) return 0;
  
  return tokenADecimal / tokenBDecimal;
}

/**
 * Format number for display with appropriate units (K, M, B) and dynamic precision
 * @param value - Decimal value to format
 * @param precision - Number of decimal places (optional, will be calculated dynamically if not provided)
 * @returns Formatted string
 */
export function formatNumber(value: number, precision?: number): string {
  // Handle very large numbers (like exchange rates) with comma formatting instead of K/M/B
  if (value >= 100000) {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }

  // If precision is not provided, calculate it dynamically
  if (precision === undefined) {
    if (value >= 1000000000) {
      precision = 2;
    } else if (value >= 1000000) {
      precision = 2;
    } else if (value >= 1000) {
      precision = 1;
    } else if (value >= 1) {
      precision = Math.max(0, 4 - Math.floor(Math.log10(value)));
    } else if (value > 0) {
      // For small values, show enough decimals to capture meaningful digits
      precision = Math.max(2, 6 - Math.floor(Math.log10(value)));
    } else {
      precision = 2;
    }
    // Cap precision at 8 to avoid excessive decimal places
    precision = Math.min(8, precision);
  }

  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(precision)}B`;
  } else if (value >= 1000000) {
    return `${(value / 1000000).toFixed(precision)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(precision)}K`;
  }
  return value.toFixed(precision);
}

/**
 * Format percentage for display
 * @param value - Percentage value (0-100)
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number): string {
  return `${Math.max(0, Math.min(100, value)).toFixed(2)}%`;
}

/**
 * Get token decimals from token metadata with fallback
 * @param tokenId - Token contract ID
 * @param allTokens - Array of token metadata
 * @returns Number of decimals
 */
export function getTokenDecimalsFromMeta(tokenId: string, allTokens: TokenMeta[]): number {
  const token = allTokens.find(t => t.contractId === tokenId);
  if (token?.decimals !== undefined && token.decimals >= 0 && token.decimals <= 18) {
    return token.decimals;
  }
  
  // Fallback logic for known tokens
  if (tokenId === '.stx' || tokenId === 'stx') {
    return 6; // STX has 6 decimals
  }
  
  if (tokenId.includes('sbtc-token')) {
    return 8; // sBTC has 8 decimals
  }
  
  // Default fallback
  console.warn(`[UI-DecimalUtils] Using fallback decimals (6) for token: ${tokenId}`);
  return 6;
}
import { type LineData } from 'lightweight-charts';

/**
 * Simple chart utilities that work directly with LineData
 * Replaces the overcomplicated chart-data-utils.ts
 */

/**
 * Calculate simple ratio between two price series
 * No extrapolation, no complex time alignment - just direct calculation
 */
export function calculateSimpleRatio(
  tokenData: LineData[],
  baseData: LineData[]
): LineData[] {
  if (!tokenData?.length || !baseData?.length) {
    return [];
  }

  // Create a map of base prices by timestamp for efficient lookup
  const basePriceMap = new Map<number, number>();
  baseData.forEach(point => {
    basePriceMap.set(Number(point.time), point.value);
  });

  // Calculate ratios for token data points where we have base data
  const ratios: LineData[] = [];
  
  for (const tokenPoint of tokenData) {
    const basePrice = basePriceMap.get(Number(tokenPoint.time));
    if (basePrice && basePrice > 0) {
      ratios.push({
        time: tokenPoint.time,
        value: tokenPoint.value / basePrice
      });
    }
  }

  return ratios;
}

/**
 * Simple data validation - just check for valid numbers
 */
export function isValidPrice(value: number): boolean {
  return typeof value === 'number' && !isNaN(value) && isFinite(value) && value > 0;
}

/**
 * Filter out invalid data points
 */
export function cleanPriceData(data: LineData[]): LineData[] {
  return data.filter(point => 
    point && 
    typeof point.time !== 'undefined' && 
    isValidPrice(point.value)
  );
}

/**
 * Format price for display - simplified version
 */
export function formatPrice(price: number): string {
  if (!isValidPrice(price)) return '0';

  if (price >= 1) {
    return price.toFixed(2);
  } else if (price >= 0.01) {
    return price.toFixed(4);
  } else {
    return price.toFixed(6);
  }
}
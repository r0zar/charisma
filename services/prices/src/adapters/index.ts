/**
 * Adapters for backward compatibility
 */

export { LegacyPriceService, type LegacyPriceServiceConfig, type LegacyPriceResult, type LegacyBulkPriceResult } from './legacy-price-service';

// Export as default for old import style
export { default as PriceService } from './legacy-price-service';
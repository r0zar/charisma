import type { TokenCacheData } from '@/lib/contract-registry-adapter';

export interface PriceStats {
    price: number | null;
    change1h: number | null;
    change24h: number | null;
    change7d: number | null;
    lastUpdated: number | null;
}

export type TokenSummary = TokenCacheData & PriceStats & {
    marketCap: number | null; // Pre-calculated market cap in USD
    // Enhanced fields from Price Series API
    source?: 'oracle' | 'market' | 'virtual' | 'hybrid';
    reliability?: number;
    arbitrageOpportunity?: {
        marketPrice: number;
        virtualValue: number;
        deviation: number;
        profitable: boolean;
    };
};
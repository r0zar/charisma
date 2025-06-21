/**
 * TokenRankingService - Interfaces with simple-swap APIs to get market analytics
 */

import { getTokenMetadataCached, type TokenCacheData } from '@repo/tokens';

// API Configuration - Can be overridden via setApiUrl()
let SIMPLE_SWAP_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
  ? 'http://localhost:3002' 
  : 'https://swap.charisma.rocks';

console.log(`[TokenRanking] Base URL configured as: ${SIMPLE_SWAP_BASE_URL}`);

// Types from simple-swap APIs
export interface PriceStats {
    contractId: string;
    price: number | null;
    change1h: number | null;
    change24h: number | null;
    change7d: number | null;
}

export interface TokenMetadata {
    name: string;
    symbol: string;
    image: string;
    contractId: string;
    totalSupply: string;
    decimals: number;
    type: string;
}

export interface EnhancedTokenData {
    contractId: string;
    price: number | null;
    change1h: number | null;
    change24h: number | null;
    change7d: number | null;
    metadata: TokenMetadata | null;
    marketcap: number | null;
    dataInsights: {
        totalDataPoints: number;
        firstSeen: string | null;
        lastSeen: string | null;
        dataQuality: 'no-data' | 'stale' | 'good';
    };
    // Keep priceStats for backwards compatibility but map it from the direct properties
    priceStats: PriceStats;
}

export interface SeriesPoint {
    time: number;
    value: number;
}

export class TokenRankingService {
    private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
    private readonly CACHE_TTL = 30 * 1000; // 30 seconds

    /**
     * Set the API base URL (useful for different environments)
     */
    setApiUrl(url: string): void {
        SIMPLE_SWAP_BASE_URL = url;
        console.log(`[TokenRanking] API URL set to: ${url}`);
    }

    /**
     * Fetch price statistics for multiple tokens
     */
    async getBulkPriceStats(contractIds: string[]): Promise<Record<string, PriceStats>> {
        const cacheKey = `price-stats:${contractIds.sort().join(',')}`;

        // Check cache first
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const url = `${SIMPLE_SWAP_BASE_URL}/api/price-stats/bulk?contractIds=${encodeURIComponent(contractIds.join(','))}`;
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch price stats: ${response.statusText}`);
            }

            const data = await response.json();
            this.setCache(cacheKey, data, this.CACHE_TTL);

            console.log(`[TokenRanking] Fetched price stats for ${contractIds.length} tokens`);
            return data;
        } catch (error) {
            console.error('[TokenRanking] Error fetching price stats:', error);
            return {};
        }
    }

    /**
     * Fetch historical price series for volatility analysis
     */
    async getBulkPriceSeries(
        contractIds: string[],
        fromTimestamp: number,
        toTimestamp: number,
        period?: number
    ): Promise<Record<string, SeriesPoint[]>> {
        const cacheKey = `price-series:${contractIds.sort().join(',')}:${fromTimestamp}:${toTimestamp}:${period || 'raw'}`;

        // Check cache first
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const params = new URLSearchParams({
                contractIds: contractIds.join(','),
                from: Math.floor(fromTimestamp / 1000).toString(),
                to: Math.floor(toTimestamp / 1000).toString(),
            });

            if (period) {
                params.set('period', period.toString());
            }

            const url = `${SIMPLE_SWAP_BASE_URL}/api/price-series/bulk?${params}`;
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch price series: ${response.statusText}`);
            }

            const data = await response.json();
            this.setCache(cacheKey, data, this.CACHE_TTL * 2); // Longer cache for historical data

            console.log(`[TokenRanking] Fetched price series for ${contractIds.length} tokens`);
            return data;
        } catch (error) {
            console.error('[TokenRanking] Error fetching price series:', error);
            return {};
        }
    }

    /**
     * Fetch comprehensive token data including market caps and metadata
     */
    async getBulkTokenData(
        limit: number = 50,
        sortField: string = 'marketcap',
        sortDirection: string = 'desc',
        showInactive: boolean = false
    ): Promise<{ tokens: EnhancedTokenData[]; total: number }> {
        const cacheKey = `token-data:${limit}:${sortField}:${sortDirection}:${showInactive}`;

        // Check cache first
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const params = new URLSearchParams({
                limit: limit.toString(),
                sortField,
                sortDirection,
                showInactive: showInactive.toString(),
                showWithoutMarketCap: 'true', // Include tokens without market cap for better coverage
            });

            const url = `${SIMPLE_SWAP_BASE_URL}/api/admin/prices-bulk?${params}`;
            console.log(`[TokenRanking] Fetching token data from: ${url}`);
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch token data: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Transform tokens to match our interface with proper metadata fetching
            const transformedTokens = await Promise.all((data.tokens || []).map(async (token: any): Promise<EnhancedTokenData> => {
                let metadata = token.metadata;
                
                // If no metadata exists, fetch it from the token cache
                if (!metadata) {
                    try {
                        const cachedMetadata = await getTokenMetadataCached(token.contractId);
                        metadata = {
                            name: cachedMetadata.name || this.generateTokenName(token.contractId),
                            symbol: cachedMetadata.symbol || this.generateTokenSymbol(token.contractId),
                            image: cachedMetadata.image || null,
                            contractId: token.contractId,
                            totalSupply: cachedMetadata.total_supply || null,
                            decimals: cachedMetadata.decimals || 6,
                            type: cachedMetadata.type || 'unknown'
                        };
                        console.log(`[TokenRanking] Fetched metadata from cache for ${token.contractId}: ${metadata.symbol} - ${metadata.name}`);
                    } catch (error) {
                        console.warn(`[TokenRanking] Failed to fetch metadata for ${token.contractId}, using fallback:`, error);
                        metadata = {
                            name: this.generateTokenName(token.contractId),
                            symbol: this.generateTokenSymbol(token.contractId),
                            image: null,
                            contractId: token.contractId,
                            totalSupply: null,
                            decimals: 6,
                            type: 'unknown'
                        };
                    }
                }
                
                return {
                    contractId: token.contractId,
                    price: token.price,
                    change1h: token.change1h,
                    change24h: token.change24h,
                    change7d: token.change7d,
                    metadata,
                    marketcap: token.marketcap,
                    dataInsights: token.dataInsights,
                    // Map to priceStats for backwards compatibility
                    priceStats: {
                        contractId: token.contractId,
                        price: token.price,
                        change1h: token.change1h,
                        change24h: token.change24h,
                        change7d: token.change7d,
                    }
                };
            }));
            
            const result = {
                tokens: transformedTokens,
                total: data.total || 0,
            };

            this.setCache(cacheKey, result, this.CACHE_TTL);

            console.log(`[TokenRanking] Fetched comprehensive data for ${result.tokens.length} tokens`);
            console.log('[TokenRanking] Sample raw token:', data.tokens?.[0]);
            console.log('[TokenRanking] Sample transformed token:', transformedTokens[0]);
            
            // Debug image handling for known tokens
            const sbtcToken = transformedTokens.find(t => t.contractId.includes('sbtc-token'));
            const stxToken = transformedTokens.find(t => t.contractId.includes('.stx'));
            if (sbtcToken) {
              console.log('[TokenRanking] sBTC token metadata:', sbtcToken.metadata);
            }
            if (stxToken) {
              console.log('[TokenRanking] STX token metadata:', stxToken.metadata);
            }
            
            return result;
        } catch (error) {
            console.error('[TokenRanking] Error fetching token data:', error);
            return { tokens: [], total: 0 };
        }
    }

    /**
     * Get top tokens by various criteria for arena placement
     */
    async getTopTokensByActivity(limit: number = 20): Promise<EnhancedTokenData[]> {
        try {
            // Fetch tokens sorted by recent activity indicators
            const { tokens } = await this.getBulkTokenData(limit, 'change24h', 'desc', false);

            // Filter for tokens with basic price data (relaxed filtering)
            const activeTokens = tokens.filter(token => {
                const hasPrice = token.priceStats?.price !== null && !isNaN(token.priceStats.price) && token.priceStats.price > 0;
                const hasValidContract = token.contractId && token.contractId.length > 0;
                
                // Very permissive - just need price and valid contract ID
                return hasPrice && hasValidContract;
            });

            console.log(`[TokenRanking] Found ${activeTokens.length} active tokens out of ${tokens.length} total`);
            return activeTokens;
        } catch (error) {
            console.error('[TokenRanking] Error getting top active tokens:', error);
            return [];
        }
    }

    /**
     * Get tokens by market cap for stable arena positions
     */
    async getTopTokensByMarketCap(limit: number = 20): Promise<EnhancedTokenData[]> {
        try {
            const { tokens } = await this.getBulkTokenData(limit, 'marketcap', 'desc', false);

            // Filter for tokens with valid market cap (relaxed for debugging)
            const topTokens = tokens.filter(token => {
                const hasMarketCap = token.marketcap !== null && token.marketcap > 0;
                const hasGoodData = token.dataInsights?.dataQuality === 'good';
                const hasPrice = token.priceStats?.price !== null;
                
                console.log(`[TokenRanking] MarketCap filter for ${token.contractId.slice(0, 8)}... - hasMarketCap: ${hasMarketCap}, hasPrice: ${hasPrice}, hasGoodData: ${hasGoodData}`);
                
                // Temporarily just require price for debugging
                return hasPrice;
            });

            console.log(`[TokenRanking] Found ${topTokens.length} top market cap tokens`);
            return topTokens;
        } catch (error) {
            console.error('[TokenRanking] Error getting top market cap tokens:', error);
            return [];
        }
    }

    /**
     * Get all available tokens with relaxed filters to capture broader universe
     */
    async getAllAvailableTokens(limit: number = 400): Promise<EnhancedTokenData[]> {
        try {
            const { tokens } = await this.getBulkTokenData(limit, 'change24h', 'desc', true); // Include inactive tokens

            // Very relaxed filtering - just need basic price data
            const availableTokens = tokens.filter(token => {
                const hasPrice = token.priceStats?.price !== null && !isNaN(token.priceStats.price) && token.priceStats.price > 0;
                const hasValidContract = token.contractId && token.contractId.length > 0;
                
                return hasPrice && hasValidContract;
            });

            console.log(`[TokenRanking] Found ${availableTokens.length} available tokens with relaxed filters`);
            return availableTokens;
        } catch (error) {
            console.error('[TokenRanking] Error getting all available tokens:', error);
            return [];
        }
    }

    /**
     * Cache management
     */
    private getFromCache(key: string): any | null {
        const cached = this.cache.get(key);
        if (!cached) return null;

        if (Date.now() - cached.timestamp > cached.ttl) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    private setCache(key: string, data: any, ttl: number): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl,
        });
    }

    /**
     * Generate a readable token name from contract ID
     */
    private generateTokenName(contractId: string): string {
        if (contractId === '.stx' || contractId === 'stx') {
            return 'Stacks Token';
        }
        
        // Extract token name from contract ID
        const parts = contractId.split('.');
        if (parts.length >= 2) {
            const tokenPart = parts[1];
            // Convert kebab-case or snake_case to Title Case
            return tokenPart
                .replace(/[-_]/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase())
                .replace(/Token$/, '') // Remove redundant "Token" suffix
                .trim() || 'Unknown Token';
        }
        
        return 'Unknown Token';
    }
    
    /**
     * Generate a token symbol from contract ID
     */
    private generateTokenSymbol(contractId: string): string {
        if (contractId === '.stx' || contractId === 'stx') {
            return 'STX';
        }
        
        // Extract token symbol from contract ID
        const parts = contractId.split('.');
        if (parts.length >= 2) {
            const tokenPart = parts[1];
            // Create symbol from first few characters or known patterns
            if (tokenPart.includes('token')) {
                // Remove "token" and use remaining part
                const cleaned = tokenPart.replace(/(^token-|token$|-token)/gi, '');
                return cleaned.slice(0, 4).toUpperCase() || tokenPart.slice(0, 4).toUpperCase();
            }
            return tokenPart.slice(0, 4).toUpperCase();
        }
        
        return contractId.slice(0, 4).toUpperCase();
    }

    /**
     * Clear all cached data
     */
    clearCache(): void {
        this.cache.clear();
        console.log('[TokenRanking] Cache cleared');
    }
}

// Export singleton instance
export const tokenRankingService = new TokenRankingService();
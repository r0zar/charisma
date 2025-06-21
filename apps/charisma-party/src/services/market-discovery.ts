/**
 * MarketDiscoveryService - Token universe discovery and trend detection
 */

import { tokenRankingService, EnhancedTokenData } from './token-ranking';
import { activityScoringService, RankedToken } from './activity-scoring';

export interface MarketSnapshot {
    timestamp: number;
    totalTokens: number;
    activeTokens: number;
    arenaTokens: RankedToken[];
    rosterTokens: RankedToken[];
    marketStats: {
        totalMarketCap: number;
        averageChange24h: number;
        topGainer: RankedToken | null;
        topLoser: RankedToken | null;
        mostVolatile: RankedToken | null;
    };
    trendingCategories: {
        emerging: RankedToken[];
        volatile: RankedToken[];
        stable: RankedToken[];
        trending: RankedToken[];
    };
}

export interface DiscoveryConfig {
    arenaSize: number;
    rosterSize: number;
    refreshInterval: number;
    minActivityThreshold: number;
    includeEmergingTokens: boolean;
}

export class MarketDiscoveryService {
    private currentSnapshot: MarketSnapshot | null = null;
    private lastRefresh = 0;
    private isRefreshing = false;

    private readonly DEFAULT_CONFIG: DiscoveryConfig = {
        arenaSize: 8,
        rosterSize: 200, // Increased from 50 to show more tokens
        refreshInterval: 60 * 1000, // 1 minute
        minActivityThreshold: 5, // Reduced from 10 to include more tokens
        includeEmergingTokens: true,
    };

    /**
     * Get current market snapshot, refreshing if needed
     */
    async getMarketSnapshot(config: Partial<DiscoveryConfig> = {}): Promise<MarketSnapshot> {
        const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
        
        // Check if we need to refresh
        const now = Date.now();
        const needsRefresh = !this.currentSnapshot || 
                           (now - this.lastRefresh) > finalConfig.refreshInterval ||
                           this.currentSnapshot.arenaTokens.length !== finalConfig.arenaSize;

        if (needsRefresh && !this.isRefreshing) {
            await this.refreshMarketData(finalConfig);
        }

        return this.currentSnapshot || this.createEmptySnapshot();
    }

    /**
     * Force refresh market data
     */
    async refreshMarketData(config: DiscoveryConfig): Promise<void> {
        if (this.isRefreshing) {
            console.log('[MarketDiscovery] Refresh already in progress, skipping...');
            return;
        }

        this.isRefreshing = true;
        const startTime = Date.now();

        try {
            console.log('[MarketDiscovery] Starting market data refresh...');

            // Step 1: Discover token universe
            const tokenUniverse = await this.discoverTokenUniverse(config);
            console.log(`[MarketDiscovery] Discovered ${tokenUniverse.length} tokens`);

            // Step 2: Rank all tokens
            const rankedTokens = await activityScoringService.rankTokens(tokenUniverse);
            console.log(`[MarketDiscovery] Ranked ${rankedTokens.length} tokens`);

            // Step 3: Categorize and filter
            const { arenaTokens, rosterTokens, stats, categories } = this.categorizeTokens(
                rankedTokens, 
                config
            );

            // Step 4: Create snapshot
            this.currentSnapshot = {
                timestamp: Date.now(),
                totalTokens: tokenUniverse.length,
                activeTokens: rankedTokens.filter(t => t.activityScore.total > config.minActivityThreshold).length,
                arenaTokens,
                rosterTokens,
                marketStats: stats,
                trendingCategories: categories,
            };

            this.lastRefresh = Date.now();
            
            const refreshTime = Date.now() - startTime;
            console.log(`[MarketDiscovery] Market refresh completed in ${refreshTime}ms`);
            console.log(`[MarketDiscovery] Arena: ${arenaTokens.length}, Roster: ${rosterTokens.length}`);

        } catch (error) {
            console.error('[MarketDiscovery] Error refreshing market data:', error);
        } finally {
            this.isRefreshing = false;
        }
    }

    /**
     * Discover available token universe
     */
    private async discoverTokenUniverse(config: DiscoveryConfig): Promise<EnhancedTokenData[]> {
        try {
            // Fetch tokens with multiple strategies to ensure good coverage
            const strategies = [
                // Strategy 1: Top by recent activity
                tokenRankingService.getTopTokensByActivity(config.rosterSize),
                
                // Strategy 2: Top by market cap (for stability)
                tokenRankingService.getTopTokensByMarketCap(config.rosterSize),
                
                // Strategy 3: All available tokens (broader scope)
                tokenRankingService.getAllAvailableTokens(config.rosterSize * 2),
            ];

            const results = await Promise.all(strategies);
            
            // Merge and deduplicate
            const tokenMap = new Map<string, EnhancedTokenData>();
            
            results.forEach(tokenList => {
                tokenList.forEach(token => {
                    if (!tokenMap.has(token.contractId)) {
                        tokenMap.set(token.contractId, token);
                    }
                });
            });

            const allTokens = Array.from(tokenMap.values());
            
            // Filter for quality tokens (temporarily relaxed filters for debugging)
            const qualityTokens = allTokens.filter(token => {
                const hasPrice = token.priceStats?.price !== null && token.priceStats?.price > 0;
                console.log(`[MarketDiscovery] Token ${token.contractId.slice(0, 8)}... - hasPrice: ${hasPrice}, price: ${token.priceStats?.price}`);
                return hasPrice;
            });

            console.log(`[MarketDiscovery] Filtered ${qualityTokens.length} quality tokens from ${allTokens.length} total`);
            console.log('[MarketDiscovery] Sample token before filtering:', allTokens[0]);
            console.log('[MarketDiscovery] Sample token after filtering:', qualityTokens[0]);
            return qualityTokens;

        } catch (error) {
            console.error('[MarketDiscovery] Error discovering token universe:', error);
            return [];
        }
    }

    /**
     * Categorize ranked tokens into arena/roster and calculate market stats
     */
    private categorizeTokens(
        rankedTokens: RankedToken[], 
        config: DiscoveryConfig
    ): {
        arenaTokens: RankedToken[];
        rosterTokens: RankedToken[];
        stats: MarketSnapshot['marketStats'];
        categories: MarketSnapshot['trendingCategories'];
    } {
        // Separate arena and roster tokens
        const arenaTokens = rankedTokens
            .filter(token => token.isArenaWorthy)
            .slice(0, config.arenaSize);

        // If we don't have enough arena-worthy tokens, fill with top-ranked
        if (arenaTokens.length < config.arenaSize) {
            const additional = rankedTokens
                .filter(token => !arenaTokens.includes(token))
                .slice(0, config.arenaSize - arenaTokens.length);
            arenaTokens.push(...additional);
        }

        const rosterTokens = rankedTokens
            .filter(token => !arenaTokens.includes(token))
            .slice(0, config.rosterSize);

        // Calculate market statistics
        const stats = this.calculateMarketStats(rankedTokens);

        // Categorize by type
        const categories = this.categorizeByTrend(rankedTokens);

        return { arenaTokens, rosterTokens, stats, categories };
    }

    /**
     * Calculate market-wide statistics
     */
    private calculateMarketStats(tokens: RankedToken[]): MarketSnapshot['marketStats'] {
        const tokensWithData = tokens.filter(t => 
            t.priceStats.price !== null && 
            t.priceStats.change24h !== null
        );

        if (tokensWithData.length === 0) {
            return {
                totalMarketCap: 0,
                averageChange24h: 0,
                topGainer: null,
                topLoser: null,
                mostVolatile: null,
            };
        }

        // Total market cap
        const totalMarketCap = tokens.reduce((sum, token) => 
            sum + (token.marketcap || 0), 0
        );

        // Average 24h change
        const validChanges = tokensWithData
            .map(t => t.priceStats.change24h!)
            .filter(change => !isNaN(change));
        
        const averageChange24h = validChanges.length > 0
            ? validChanges.reduce((sum, change) => sum + change, 0) / validChanges.length
            : 0;

        // Top gainer/loser
        const sortedByChange = [...tokensWithData].sort((a, b) => 
            (b.priceStats.change24h || 0) - (a.priceStats.change24h || 0)
        );

        const topGainer = sortedByChange.length > 0 && (sortedByChange[0]?.priceStats.change24h || 0) > 0
            ? sortedByChange[0] 
            : null;

        const topLoser = sortedByChange.length > 0 && (sortedByChange[sortedByChange.length - 1]?.priceStats.change24h || 0) < 0
            ? sortedByChange[sortedByChange.length - 1]
            : null;

        // Most volatile (highest volatility component)
        const mostVolatile = tokens.length > 0 ? tokens.reduce((max, token) => {
            if (!max) return token;
            return token.activityScore.components.volatility > max.activityScore.components.volatility 
                ? token 
                : max;
        }, tokens[0]) : null;

        return {
            totalMarketCap,
            averageChange24h,
            topGainer,
            topLoser,
            mostVolatile,
        };
    }

    /**
     * Categorize tokens by trend type
     */
    private categorizeByTrend(tokens: RankedToken[]): MarketSnapshot['trendingCategories'] {
        const emerging = tokens.filter(t => t.category === 'emerging').slice(0, 10);
        const volatile = tokens.filter(t => t.category === 'volatile').slice(0, 10);
        const stable = tokens.filter(t => t.category === 'stable').slice(0, 10);
        const trending = tokens.filter(t => t.category === 'trending').slice(0, 10);

        return { emerging, volatile, stable, trending };
    }

    /**
     * Create empty snapshot for fallback
     */
    private createEmptySnapshot(): MarketSnapshot {
        return {
            timestamp: Date.now(),
            totalTokens: 0,
            activeTokens: 0,
            arenaTokens: [],
            rosterTokens: [],
            marketStats: {
                totalMarketCap: 0,
                averageChange24h: 0,
                topGainer: null,
                topLoser: null,
                mostVolatile: null,
            },
            trendingCategories: {
                emerging: [],
                volatile: [],
                stable: [],
                trending: [],
            },
        };
    }

    /**
     * Get specific category of tokens
     */
    async getTokensByCategory(
        category: keyof MarketSnapshot['trendingCategories'],
        limit: number = 10
    ): Promise<RankedToken[]> {
        const snapshot = await this.getMarketSnapshot();
        return snapshot.trendingCategories[category].slice(0, limit);
    }

    /**
     * Search for tokens by symbol or name
     */
    async searchTokens(query: string, limit: number = 10): Promise<RankedToken[]> {
        const snapshot = await this.getMarketSnapshot();
        const allTokens = [...snapshot.arenaTokens, ...snapshot.rosterTokens];
        
        const searchTerm = query.toLowerCase();
        const matches = allTokens.filter(token => {
            const symbol = token.metadata?.symbol?.toLowerCase() || '';
            const name = token.metadata?.name?.toLowerCase() || '';
            const contractId = token.contractId.toLowerCase();
            
            return symbol.includes(searchTerm) || 
                   name.includes(searchTerm) || 
                   contractId.includes(searchTerm);
        });

        return matches.slice(0, limit);
    }

    /**
     * Get market health indicator
     */
    async getMarketHealth(): Promise<{
        status: 'healthy' | 'warning' | 'critical';
        indicators: {
            dataFreshness: number;
            tokenCoverage: number;
            activityLevel: number;
        };
        issues: string[];
    }> {
        const snapshot = await this.getMarketSnapshot();
        const issues: string[] = [];
        
        // Data freshness (how recent is our data)
        const dataAge = Date.now() - snapshot.timestamp;
        const dataFreshness = Math.max(0, 100 - (dataAge / (5 * 60 * 1000)) * 100); // 5 min = 0%
        
        if (dataFreshness < 50) {
            issues.push('Market data is stale');
        }

        // Token coverage (how many tokens have good data)
        const tokenCoverage = snapshot.totalTokens > 0 
            ? (snapshot.activeTokens / snapshot.totalTokens) * 100 
            : 0;
        
        if (tokenCoverage < 30) {
            issues.push('Low token data coverage');
        }

        // Activity level (how active is the market)
        const activityLevel = snapshot.arenaTokens.length > 0
            ? snapshot.arenaTokens.reduce((sum, t) => sum + t.activityScore.total, 0) / snapshot.arenaTokens.length
            : 0;
        
        if (activityLevel < 30) {
            issues.push('Low market activity detected');
        }

        // Determine overall status
        let status: 'healthy' | 'warning' | 'critical' = 'healthy';
        if (issues.length > 2 || dataFreshness < 20) {
            status = 'critical';
        } else if (issues.length > 0 || dataFreshness < 50) {
            status = 'warning';
        }

        return {
            status,
            indicators: {
                dataFreshness,
                tokenCoverage,
                activityLevel,
            },
            issues,
        };
    }

    /**
     * Clear cache and force next refresh
     */
    clearCache(): void {
        this.currentSnapshot = null;
        this.lastRefresh = 0;
        tokenRankingService.clearCache();
        console.log('[MarketDiscovery] Cache cleared');
    }
}

// Export singleton instance
export const marketDiscoveryService = new MarketDiscoveryService();
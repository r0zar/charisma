/**
 * ActivityScoringService - Enhanced multi-factor token activity scoring
 */

import { EnhancedTokenData, SeriesPoint, tokenRankingService } from './token-ranking';

export interface EnhancedActivityScore {
    total: number;
    components: {
        priceMovement: number;
        volume: number;
        marketCap: number;
        volatility: number;
    };
    trend: 'up' | 'down' | 'neutral';
    significance: 'high' | 'medium' | 'low';
    rank: number;
}

export interface RankedToken extends EnhancedTokenData {
    activityScore: EnhancedActivityScore;
    isArenaWorthy: boolean;
    category: 'trending' | 'stable' | 'volatile' | 'emerging';
}

export class ActivityScoringService {
    // Scoring weights for different factors - emphasize recent price movement
    private readonly WEIGHTS = {
        priceMovement: 0.6,  // Recent price changes (heavily favor 1h over 24h/7d)
        volume: 0.2,         // Data frequency and recency  
        marketCap: 0.1,      // Token significance (reduced to highlight movement over size)
        volatility: 0.1,     // Price movement consistency
    };

    // Thresholds for categorization
    private readonly THRESHOLDS = {
        highActivity: 75,
        mediumActivity: 40,
        arenaWorthy: 30,
        emergingMarketCap: 100_000,      // $100k
        stableMarketCap: 10_000_000,     // $10M
        highVolatility: 15,              // 15% volatility
    };

    /**
     * Calculate enhanced activity score for a token
     */
    calculateActivityScore(
        token: EnhancedTokenData,
        volatilityData?: SeriesPoint[]
    ): EnhancedActivityScore {
        try {
            const components = {
                priceMovement: this.calculatePriceMovementScore(token),
                volume: this.calculateVolumeScore(token),
                marketCap: this.calculateMarketCapScore(token),
                volatility: this.calculateVolatilityScore(volatilityData),
            };

            // Ensure all components are valid numbers
            const safeComponents = {
                priceMovement: isNaN(components.priceMovement) ? 0 : components.priceMovement,
                volume: isNaN(components.volume) ? 0 : components.volume,
                marketCap: isNaN(components.marketCap) ? 0 : components.marketCap,
                volatility: isNaN(components.volatility) ? 0 : components.volatility,
            };

            const total = (
                safeComponents.priceMovement * this.WEIGHTS.priceMovement +
                safeComponents.volume * this.WEIGHTS.volume +
                safeComponents.marketCap * this.WEIGHTS.marketCap +
                safeComponents.volatility * this.WEIGHTS.volatility
            );

            const safTotal = isNaN(total) ? 0 : total;
            const trend = this.determineTrend(token);
            const significance = this.determineSignificance(safTotal);

            return {
                total: Math.round(safTotal * 100) / 100,
                components: safeComponents,
                trend,
                significance,
                rank: 0, // Will be set during ranking
            };
        } catch (error) {
            console.warn(`[ActivityScoring] Error calculating score for ${token.contractId}:`, error);
            return {
                total: 0,
                components: {
                    priceMovement: 0,
                    volume: 0,
                    marketCap: 0,
                    volatility: 0,
                },
                trend: 'neutral',
                significance: 'low',
                rank: 0,
            };
        }
    }

    /**
     * Calculate price movement component (40% weight)
     * Based on recent percentage changes with recency bias
     */
    private calculatePriceMovementScore(token: EnhancedTokenData): number {
        try {
            if (!token.priceStats) return 0;
            
            const { change1h, change24h, change7d } = token.priceStats;
            
            // Convert percentage changes to absolute values for activity scoring
            const change1hAbs = Math.abs(Number(change1h) || 0);
            const change24hAbs = Math.abs(Number(change24h) || 0);
            const change7dAbs = Math.abs(Number(change7d) || 0);

            // Heavily weight recent changes for rapid movement detection
            const recentScore = change1hAbs * 10;    // 1h changes are extremely important for rapid detection
            const dayScore = change24hAbs * 3;       // 24h changes provide confirmation
            const weekScore = change7dAbs * 0.5;     // 7d changes are less relevant for short-term movement

            // Calculate composite score with diminishing returns
            const rawScore = recentScore + dayScore + weekScore;
            
            // Apply logarithmic scaling to prevent extreme outliers
            const score = Math.min(100, Math.log10(rawScore + 1) * 25);
            return isNaN(score) ? 0 : score;
        } catch (error) {
            console.warn(`[ActivityScoring] Error in price movement calculation:`, error);
            return 0;
        }
    }

    /**
     * Calculate volume/data quality component (30% weight)
     * Based on data freshness and frequency
     */
    private calculateVolumeScore(token: EnhancedTokenData): number {
        try {
            if (!token.dataInsights) return 0;
            
            const { dataInsights } = token;
            
            // Base score from data quality
            let score = 0;
            switch (dataInsights.dataQuality) {
                case 'good': score = 100; break;
                case 'stale': score = 30; break;
                case 'no-data': score = 0; break;
                default: score = 0; break;
            }

            // Bonus for high data frequency
            const totalDataPoints = Number(dataInsights.totalDataPoints) || 0;
            const dataPointBonus = Math.min(20, totalDataPoints / 100);
            score += dataPointBonus;

            // Recency bonus
            if (dataInsights.lastSeen) {
                const lastSeenMs = Date.parse(dataInsights.lastSeen);
                if (!isNaN(lastSeenMs)) {
                    const ageMinutes = (Date.now() - lastSeenMs) / (1000 * 60);
                    
                    if (ageMinutes < 5) score += 20;      // Very fresh
                    else if (ageMinutes < 30) score += 10; // Fresh
                    else if (ageMinutes < 120) score += 5; // Somewhat fresh
                }
            }

            const finalScore = Math.min(100, score);
            return isNaN(finalScore) ? 0 : finalScore;
        } catch (error) {
            console.warn(`[ActivityScoring] Error in volume calculation:`, error);
            return 0;
        }
    }

    /**
     * Calculate market cap component (20% weight)  
     * Logarithmic scaling to avoid mega-cap dominance
     */
    private calculateMarketCapScore(token: EnhancedTokenData): number {
        try {
            const marketCap = Number(token.marketcap) || 0;
            
            if (!marketCap || marketCap <= 0 || isNaN(marketCap)) return 0;

            // Logarithmic scaling: log10(marketCap) mapped to 0-100
            // $1k = ~30, $100k = ~50, $10M = ~70, $1B = ~90, $100B = ~100
            const logScore = Math.log10(marketCap) * 10;
            
            if (isNaN(logScore)) return 0;
            
            const score = Math.min(100, Math.max(0, logScore - 30)); // Offset so $1k = 0
            return isNaN(score) ? 0 : score;
        } catch (error) {
            console.warn(`[ActivityScoring] Error in market cap calculation:`, error);
            return 0;
        }
    }

    /**
     * Calculate volatility component (10% weight)
     * Based on price movement consistency over time
     */
    private calculateVolatilityScore(volatilityData?: SeriesPoint[]): number {
        if (!volatilityData || volatilityData.length < 2) return 0;

        // Calculate coefficient of variation (volatility measure)
        const prices = volatilityData.map(point => point.value);
        const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
        
        if (mean === 0) return 0;

        const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
        const stdDev = Math.sqrt(variance);
        const coefficientOfVariation = (stdDev / mean) * 100;

        // Convert volatility to activity score (more volatility = more activity)
        // Cap at reasonable volatility levels
        return Math.min(100, coefficientOfVariation * 2);
    }

    /**
     * Determine overall price trend
     */
    private determineTrend(token: EnhancedTokenData): 'up' | 'down' | 'neutral' {
        const { change1h, change24h } = token.priceStats;
        
        // Prioritize recent movement (1h) but consider 24h for confirmation
        const recentChange = change1h || 0;
        const dayChange = change24h || 0;
        
        // Require significant movement to avoid noise
        if (recentChange > 1 || (recentChange > 0.5 && dayChange > 0)) return 'up';
        if (recentChange < -1 || (recentChange < -0.5 && dayChange < 0)) return 'down';
        
        return 'neutral';
    }

    /**
     * Determine activity significance level
     */
    private determineSignificance(totalScore: number): 'high' | 'medium' | 'low' {
        if (totalScore >= this.THRESHOLDS.highActivity) return 'high';
        if (totalScore >= this.THRESHOLDS.mediumActivity) return 'medium';
        return 'low';
    }

    /**
     * Categorize token based on characteristics
     */
    private categorizeToken(token: EnhancedTokenData, activityScore: EnhancedActivityScore): RankedToken['category'] {
        const { marketcap } = token;
        const { volatility } = activityScore.components;
        
        // High volatility = volatile category
        if (volatility >= this.THRESHOLDS.highVolatility) return 'volatile';
        
        // Low market cap but high activity = emerging
        if (marketcap && marketcap < this.THRESHOLDS.emergingMarketCap && activityScore.total > 50) {
            return 'emerging';
        }
        
        // High market cap and stable = stable
        if (marketcap && marketcap > this.THRESHOLDS.stableMarketCap && volatility < 5) {
            return 'stable';
        }
        
        // Default to trending
        return 'trending';
    }

    /**
     * Rank multiple tokens and return sorted by activity score
     */
    async rankTokens(tokens: EnhancedTokenData[]): Promise<RankedToken[]> {
        console.log(`[ActivityScoring] Ranking ${tokens.length} tokens...`);
        
        // Early return if no tokens to rank
        if (tokens.length === 0) {
            console.log('[ActivityScoring] No tokens to rank, returning empty array');
            return [];
        }
        
        console.log('[ActivityScoring] Sample token being ranked:', tokens[0]);
        
        // Get historical data for volatility calculation (last 24h)
        const contractIds = tokens.map(t => t.contractId);
        const to = Date.now();
        const from = to - (24 * 60 * 60 * 1000); // 24 hours ago
        
        let historicalData: Record<string, SeriesPoint[]> = {};
        try {
            historicalData = await tokenRankingService.getBulkPriceSeries(contractIds, from, to, 3600); // 1h aggregation
        } catch (error) {
            console.warn('[ActivityScoring] Failed to fetch historical data for volatility calculation:', error);
        }

        // Calculate scores for all tokens
        const rankedTokens = tokens.map((token): RankedToken => {
            const volatilityData = historicalData[token.contractId] || [];
            const activityScore = this.calculateActivityScore(token, volatilityData);
            const category = this.categorizeToken(token, activityScore);
            
            return {
                ...token,
                activityScore,
                isArenaWorthy: activityScore.total >= this.THRESHOLDS.arenaWorthy,
                category,
            };
        });

        // Sort by activity score and assign ranks
        rankedTokens.sort((a, b) => b.activityScore.total - a.activityScore.total);
        rankedTokens.forEach((token, index) => {
            token.activityScore.rank = index + 1;
        });

        console.log(`[ActivityScoring] Completed ranking. Top 5 tokens:`, 
            rankedTokens.slice(0, 5).map(t => ({
                symbol: t.metadata?.symbol,
                score: t.activityScore.total,
                category: t.category
            }))
        );

        return rankedTokens;
    }

    /**
     * Get arena-worthy tokens for main stage
     */
    async getArenaTokens(limit: number = 8): Promise<RankedToken[]> {
        try {
            // Get a larger pool of active tokens to rank
            const activeTokens = await tokenRankingService.getTopTokensByActivity(limit * 3);
            
            if (activeTokens.length === 0) {
                console.warn('[ActivityScoring] No active tokens found, falling back to market cap');
                const topTokens = await tokenRankingService.getTopTokensByMarketCap(limit);
                const ranked = await this.rankTokens(topTokens);
                return ranked.slice(0, limit);
            }

            // Rank all active tokens
            const rankedTokens = await this.rankTokens(activeTokens);
            
            // Return top arena-worthy tokens
            const arenaTokens = rankedTokens
                .filter(token => token.isArenaWorthy)
                .slice(0, limit);

            // If we don't have enough arena-worthy tokens, fill with top-ranked
            if (arenaTokens.length < limit) {
                const additional = rankedTokens
                    .filter(token => !arenaTokens.includes(token))
                    .slice(0, limit - arenaTokens.length);
                arenaTokens.push(...additional);
            }

            console.log(`[ActivityScoring] Selected ${arenaTokens.length} arena tokens`);
            return arenaTokens;
        } catch (error) {
            console.error('[ActivityScoring] Error getting arena tokens:', error);
            return [];
        }
    }
}

// Export singleton instance
export const activityScoringService = new ActivityScoringService();
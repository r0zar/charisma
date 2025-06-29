'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { TokenSummary } from '@/app/token-actions';
import { cn } from '@/lib/utils';
import { useComparisonToken } from '@/contexts/comparison-token-context';

interface MarketInsightsProps {
    tokens: TokenSummary[];
}

interface MarketInsight {
    type: 'momentum_cluster' | 'price_correlation' | 'market_cap_leaders' | 'volatility_sync' | 'breakout_candidates';
    title: string;
    description: string;
    tokens: TokenWithScore[];
    confidence: number;
}

interface TokenWithScore {
    token: TokenSummary;
    score: number;
    reason: string;
}

// Skeleton loading component for insights
function InsightsSkeleton() {
    return (
        <div className="space-y-8">
            {/* Header skeleton */}
            <div>
                <div className="h-6 bg-white/[0.06] rounded-lg w-48 mb-2 animate-pulse" />
                <div className="h-4 bg-white/[0.04] rounded-lg w-80 animate-pulse" />
            </div>

            {/* Insights skeleton */}
            <div className="space-y-6">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="py-6 border-b border-white/[0.03]">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 bg-white/[0.06] rounded animate-pulse" />
                                <div className="space-y-2">
                                    <div className={`h-5 bg-white/[0.06] rounded-lg animate-pulse ${i === 0 ? 'w-40' : i === 1 ? 'w-32' : 'w-36'}`} />
                                    <div className={`h-4 bg-white/[0.04] rounded-lg animate-pulse ${i === 0 ? 'w-80' : i === 1 ? 'w-72' : 'w-76'}`} />
                                </div>
                            </div>
                            <div className="text-right space-y-1">
                                <div className="h-4 bg-white/[0.06] rounded w-12 animate-pulse" />
                                <div className="h-3 bg-white/[0.04] rounded w-16 animate-pulse" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {[...Array(3)].map((_, j) => (
                                <div key={j} className="p-3 rounded-xl">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 bg-white/[0.06] rounded-lg animate-pulse" />
                                        <div className="flex-1 space-y-1">
                                            <div className="h-4 bg-white/[0.06] rounded w-12 animate-pulse" />
                                        </div>
                                        <div className="h-4 bg-white/[0.06] rounded w-16 animate-pulse" />
                                    </div>
                                    <div className="h-3 bg-white/[0.04] rounded w-full animate-pulse" />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function MarketInsights({ tokens }: MarketInsightsProps) {
    const { compareId } = useComparisonToken();
    const [isLoading, setIsLoading] = useState(false);
    const [lastCompareId, setLastCompareId] = useState<string | null>(compareId);

    const insights = useMemo(() => {
        return generateMarketInsights(tokens);
    }, [tokens]);

    // Trigger loading state when comparison token changes
    useEffect(() => {
        if (compareId !== lastCompareId) {
            setIsLoading(true);
            setLastCompareId(compareId);
        }
    }, [compareId, lastCompareId]);

    // Reset loading state when insights have been recalculated
    useEffect(() => {
        if (isLoading && insights.length > 0) {
            // Short delay for smooth transition
            const timer = setTimeout(() => {
                setIsLoading(false);
            }, 150);
            
            return () => clearTimeout(timer);
        }
    }, [isLoading, insights.length]);

    if (isLoading) {
        return <InsightsSkeleton />;
    }

    if (insights.length === 0) return null;

    return (
        <div className="space-y-8">
            {/* Seamless header */}
            <div>
                <h2 className="text-lg font-medium text-white/90 mb-2">
                    Market Intelligence
                </h2>
                <p className="text-sm text-white/50">
                    Advanced pattern analysis and market correlation insights
                </p>
            </div>

            {/* Flowing insights - no heavy card boundaries */}
            <div className="space-y-6">
                {insights.slice(0, 4).map((insight, index) => (
                    <ImmersiveInsightRow key={`${insight.type}-${compareId}`} insight={insight} index={index} />
                ))}
            </div>
        </div>
    );
}

function InsightCard({ insight, index }: { insight: MarketInsight; index: number }) {
    const getInsightColor = (type: MarketInsight['type']) => {
        switch (type) {
            case 'momentum_cluster': return 'border-emerald-500/20 bg-emerald-500/5';
            case 'price_correlation': return 'border-blue-500/20 bg-blue-500/5';
            case 'market_cap_leaders': return 'border-orange-500/20 bg-orange-500/5';
            case 'volatility_sync': return 'border-purple-500/20 bg-purple-500/5';
            case 'breakout_candidates': return 'border-red-500/20 bg-red-500/5';
            default: return 'border-white/[0.05] bg-white/[0.02]';
        }
    };

    const getConfidenceColor = (confidence: number) => {
        if (confidence > 0.8) return 'text-emerald-400';
        if (confidence > 0.6) return 'text-yellow-400';
        return 'text-orange-400';
    };

    return (
        <div className={`border rounded-2xl p-6 ${getInsightColor(insight.type)} hover:border-opacity-40 transition-all duration-300`}>
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="font-medium text-white/90 mb-1">{insight.title}</h3>
                    <p className="text-sm text-white/60 leading-relaxed">{insight.description}</p>
                </div>
                <div className="text-right">
                    <div className={`text-sm font-medium ${getConfidenceColor(insight.confidence)}`}>
                        {(insight.confidence * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-white/40">confidence</div>
                </div>
            </div>

            {/* Token list */}
            <div className="space-y-3">
                {insight.tokens.slice(0, 3).map((tokenWithScore) => (
                    <TokenInsightRow key={tokenWithScore.token.contractId} tokenWithScore={tokenWithScore} />
                ))}
            </div>

            {/* View more if applicable */}
            {insight.tokens.length > 3 && (
                <div className="mt-4 pt-3 border-t border-white/[0.05]">
                    <div className="text-xs text-white/40">
                        +{insight.tokens.length - 3} more tokens in this pattern
                    </div>
                </div>
            )}
        </div>
    );
}

function ImmersiveInsightRow({ insight, index }: { insight: MarketInsight; index: number }) {
    const getConfidenceColor = (confidence: number) => {
        if (confidence > 0.8) return 'text-emerald-400';
        if (confidence > 0.6) return 'text-yellow-400';
        return 'text-orange-400';
    };

    const getInsightIcon = (type: MarketInsight['type']) => {
        switch (type) {
            case 'momentum_cluster': return '📈';
            case 'price_correlation': return '🔄';
            case 'market_cap_leaders': return '👑';
            case 'volatility_sync': return '⚡';
            case 'breakout_candidates': return '🚀';
            default: return '💡';
        }
    };

    return (
        <div className="py-6 border-b border-white/[0.03] last:border-b-0">
            {/* Clean header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                    <span className="text-lg">{getInsightIcon(insight.type)}</span>
                    <div>
                        <h3 className="font-medium text-white/90 mb-1">{insight.title}</h3>
                        <p className="text-sm text-white/60 leading-relaxed">{insight.description}</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className={`text-sm font-medium ${getConfidenceColor(insight.confidence)}`}>
                        {(insight.confidence * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-white/40">confidence</div>
                </div>
            </div>

            {/* Flowing token grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {insight.tokens.slice(0, 3).map((tokenWithScore) => (
                    <TokenInsightCard key={tokenWithScore.token.contractId} tokenWithScore={tokenWithScore} />
                ))}
            </div>

            {/* View more indicator */}
            {insight.tokens.length > 3 && (
                <div className="mt-4 text-center">
                    <div className="text-xs text-white/40">
                        +{insight.tokens.length - 3} more tokens match this pattern
                    </div>
                </div>
            )}
        </div>
    );
}

function TokenInsightRow({ tokenWithScore }: { tokenWithScore: TokenWithScore }) {
    const { token, reason } = tokenWithScore;
    const change = token.change24h || 0;
    const isPositive = change > 0;
    const isNegative = change < 0;

    return (
        <Link
            href={`/tokens/${encodeURIComponent(token.contractId)}`}
            className="group flex items-center justify-between py-2 px-3 rounded-xl hover:bg-white/[0.03] transition-all duration-200"
        >
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center overflow-hidden">
                    {token.image ? (
                        <img src={token.image} alt={token.symbol} className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-xs font-bold text-white/60">{token.symbol.charAt(0)}</span>
                    )}
                </div>
                <div>
                    <div className="font-medium text-white/90 text-sm group-hover:text-white transition-colors duration-200">
                        {token.symbol}
                    </div>
                    <div className="text-xs text-white/40" title={reason}>
                        {reason.length > 30 ? `${reason.slice(0, 30)}...` : reason}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <div className={cn(
                    "text-sm font-medium",
                    isPositive ? "text-emerald-400" :
                    isNegative ? "text-red-400" : 
                    "text-white/60"
                )}>
                    {change > 0 ? "+" : ""}{change.toFixed(2)}%
                </div>
                <ArrowUpRight className="h-3 w-3 text-white/20 group-hover:text-white/60 transition-colors duration-200" />
            </div>
        </Link>
    );
}

function TokenInsightCard({ tokenWithScore }: { tokenWithScore: TokenWithScore }) {
    const { token, reason } = tokenWithScore;
    const change = token.change24h || 0;
    const isPositive = change > 0;
    const isNegative = change < 0;

    return (
        <Link
            href={`/tokens/${encodeURIComponent(token.contractId)}`}
            className="group block p-3 rounded-xl hover:bg-white/[0.03] transition-all duration-200"
        >
            <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center overflow-hidden">
                    {token.image ? (
                        <img src={token.image} alt={token.symbol} className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-xs font-bold text-white/60">{token.symbol.charAt(0)}</span>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-white/90 text-sm group-hover:text-white transition-colors duration-200">
                        {token.symbol}
                    </div>
                </div>
                <div className={cn(
                    "text-sm font-medium",
                    isPositive ? "text-emerald-400" :
                    isNegative ? "text-red-400" : 
                    "text-white/60"
                )}>
                    {change > 0 ? "+" : ""}{change.toFixed(1)}%
                </div>
            </div>
            <div className="text-xs text-white/40 leading-relaxed" title={reason}>
                {reason.length > 40 ? `${reason.slice(0, 40)}...` : reason}
            </div>
        </Link>
    );
}

/* ---------------- Market Analysis Algorithm ---------------- */

function generateMarketInsights(tokens: TokenSummary[]): MarketInsight[] {
    const insights: MarketInsight[] = [];

    // 1. Momentum Clusters - tokens moving together
    const momentumCluster = findMomentumClusters(tokens);
    if (momentumCluster.tokens.length >= 3) {
        insights.push(momentumCluster);
    }

    // 2. Price Correlation Groups - similar price movements
    const priceCorrelation = findPriceCorrelations(tokens);
    if (priceCorrelation.tokens.length >= 3) {
        insights.push(priceCorrelation);
    }

    // 3. Market Cap Leadership - dominant tokens in size categories
    const marketCapLeaders = findMarketCapLeaders(tokens);
    if (marketCapLeaders.tokens.length >= 3) {
        insights.push(marketCapLeaders);
    }

    // 4. Volatility Synchronization - tokens with similar volatility patterns
    const volatilitySync = findVolatilitySync(tokens);
    if (volatilitySync.tokens.length >= 3) {
        insights.push(volatilitySync);
    }

    // 5. Breakout Candidates - tokens showing strong momentum
    const breakoutCandidates = findBreakoutCandidates(tokens);
    if (breakoutCandidates.tokens.length >= 2) {
        insights.push(breakoutCandidates);
    }

    // Sort by confidence and return top insights
    return insights
        .filter(insight => insight.confidence > 0.4)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 4);
}

function findMomentumClusters(tokens: TokenSummary[]): MarketInsight {
    const validTokens = tokens.filter(t => t.change24h !== null && t.change7d !== null);
    
    // Find tokens with consistent positive momentum (24h and 7d both positive)
    const positiveMomentum = validTokens.filter(t => 
        t.change24h! > 2 && t.change7d! > 5 && 
        Math.abs(t.change24h! - (t.change7d! / 7)) < 3 // Consistent daily average
    );

    const topMomentum = positiveMomentum
        .sort((a, b) => (b.change24h! + b.change7d!) - (a.change24h! + a.change7d!))
        .slice(0, 6)
        .map(token => ({
            token,
            score: (token.change24h! + token.change7d!) / 2,
            reason: `${token.change24h!.toFixed(1)}% daily, ${token.change7d!.toFixed(1)}% weekly momentum`
        }));

    const confidence = Math.min(topMomentum.length / 6, 1) * 0.9;

    return {
        type: 'momentum_cluster',
        title: 'Momentum Leaders',
        description: 'Tokens showing sustained positive momentum across multiple timeframes',
        tokens: topMomentum,
        confidence
    };
}

function findPriceCorrelations(tokens: TokenSummary[]): MarketInsight {
    const validTokens = tokens.filter(t => t.price && t.change24h !== null);
    
    // Group tokens by price ranges and find those moving together
    const priceGroups = new Map<string, TokenSummary[]>();
    
    validTokens.forEach(token => {
        const priceRange = getPriceRange(token.price!);
        if (!priceGroups.has(priceRange)) {
            priceGroups.set(priceRange, []);
        }
        priceGroups.get(priceRange)!.push(token);
    });

    // Find the group with most correlated movements
    let bestGroup: TokenSummary[] = [];
    let bestCorrelation = 0;

    for (const group of priceGroups.values()) {
        if (group.length < 3) continue;
        
        const avgChange = group.reduce((sum, t) => sum + t.change24h!, 0) / group.length;
        const correlation = group.filter(t => Math.abs(t.change24h! - avgChange) < 2).length / group.length;
        
        if (correlation > bestCorrelation) {
            bestCorrelation = correlation;
            bestGroup = group;
        }
    }

    const correlatedTokens = bestGroup
        .sort((a, b) => Math.abs(b.change24h!) - Math.abs(a.change24h!))
        .slice(0, 5)
        .map(token => ({
            token,
            score: Math.abs(token.change24h!),
            reason: `${token.change24h!.toFixed(1)}% move in ${getPriceRange(token.price!)} range`
        }));

    return {
        type: 'price_correlation',
        title: 'Correlated Movements',
        description: 'Tokens in similar price ranges moving together',
        tokens: correlatedTokens,
        confidence: bestCorrelation * 0.8
    };
}

function findMarketCapLeaders(tokens: TokenSummary[]): MarketInsight {
    const validTokens = tokens.filter(t => t.marketCap && t.marketCap > 0);
    
    // Find top market cap tokens with recent positive performance
    const leaders = validTokens
        .filter(t => t.change24h !== null && t.change24h! > -5) // Not severely declining
        .sort((a, b) => b.marketCap! - a.marketCap!)
        .slice(0, 8)
        .map(token => ({
            token,
            score: token.marketCap!,
            reason: `$${(token.marketCap! / 1000000).toFixed(1)}M market cap leader`
        }));

    const confidence = Math.min(leaders.length / 5, 1) * 0.7;

    return {
        type: 'market_cap_leaders',
        title: 'Market Dominators',
        description: 'Largest tokens by market capitalization maintaining stability',
        tokens: leaders,
        confidence
    };
}

function findVolatilitySync(tokens: TokenSummary[]): MarketInsight {
    const validTokens = tokens.filter(t => 
        t.change24h !== null && t.change7d !== null
    );

    // Calculate volatility as difference between 7d and expected 24h*7
    const volatilityTokens = validTokens.map(token => {
        const expectedWeekly = token.change24h! * 7;
        const actualWeekly = token.change7d!;
        const volatility = Math.abs(actualWeekly - expectedWeekly);
        
        return {
            token,
            volatility,
            score: volatility
        };
    });

    // Find tokens with similar volatility levels
    const medianVolatility = volatilityTokens.sort((a, b) => a.volatility - b.volatility)[Math.floor(volatilityTokens.length / 2)]?.volatility || 0;
    
    const syncedTokens = volatilityTokens
        .filter(t => Math.abs(t.volatility - medianVolatility) < 5)
        .sort((a, b) => Math.abs(a.token.change24h!) - Math.abs(b.token.change24h!))
        .slice(0, 5)
        .map(({ token, volatility }) => ({
            token,
            score: volatility,
            reason: `${volatility.toFixed(1)}% volatility pattern`
        }));

    const confidence = Math.min(syncedTokens.length / 5, 1) * 0.6;

    return {
        type: 'volatility_sync',
        title: 'Volatility Clusters',
        description: 'Tokens exhibiting similar volatility patterns',
        tokens: syncedTokens,
        confidence
    };
}

function findBreakoutCandidates(tokens: TokenSummary[]): MarketInsight {
    const validTokens = tokens.filter(t => 
        t.change24h !== null && t.change7d !== null && t.marketCap
    );

    // Find tokens with strong recent momentum that could continue
    const candidates = validTokens
        .filter(t => 
            t.change24h! > 5 && // Strong 24h performance
            t.change7d! > 10 && // Strong weekly performance  
            t.change24h! > t.change7d! / 7 // Accelerating momentum
        )
        .sort((a, b) => b.change24h! - a.change24h!)
        .slice(0, 4)
        .map(token => ({
            token,
            score: token.change24h!,
            reason: `${token.change24h!.toFixed(1)}% surge with accelerating momentum`
        }));

    const confidence = Math.min(candidates.length / 3, 1) * 0.85;

    return {
        type: 'breakout_candidates',
        title: 'Breakout Candidates',
        description: 'Tokens showing strong momentum with potential for continued growth',
        tokens: candidates,
        confidence
    };
}

function getPriceRange(price: number): string {
    if (price >= 1000) return '$1000+';
    if (price >= 100) return '$100-$1000';
    if (price >= 10) return '$10-$100';
    if (price >= 1) return '$1-$10';
    if (price >= 0.1) return '$0.10-$1';
    if (price >= 0.01) return '$0.01-$0.10';
    return '<$0.01';
}
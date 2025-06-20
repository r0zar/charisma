"use client";

import React, { useMemo, useState } from "react";
import { ArrowUpRight, TrendingUp, TrendingDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { TokenSummary } from "@/app/token-actions";
import { cn } from "@/lib/utils";

interface RelatedTokensProps {
    currentToken: TokenSummary;
    allTokens: TokenSummary[];
}

// Token Image component with error handling
function TokenImage({ token, size = 40 }: { token: TokenSummary; size?: number }) {
    const [imageError, setImageError] = useState(false);

    if (!token.image || imageError) {
        return (
            <span className="text-sm font-semibold text-primary/80">
                {token.symbol.charAt(0)}
            </span>
        );
    }

    return (
        <Image
            src={token.image}
            alt={token.symbol}
            width={size}
            height={size}
            className="object-cover"
            onError={() => setImageError(true)}
        />
    );
}

export default function RelatedTokens({ currentToken, allTokens }: RelatedTokensProps) {
    const relatedTokens = useMemo(() => {
        return calculateRelatedTokens(currentToken, allTokens);
    }, [currentToken, allTokens]);

    if (relatedTokens.length === 0) {
        return null;
    }

    return (
        <div className="space-y-8">
            {/* Seamless header - no obvious boundaries */}
            <div className="flex items-end justify-between">
                <div>
                    <h2 className="text-lg font-medium text-white/90 mb-2">
                        Related Assets
                    </h2>
                    <p className="text-sm text-white/50">
                        Similar opportunities based on performance patterns
                    </p>
                </div>
                <Link
                    href="/tokens"
                    className="group flex items-center gap-2 text-sm text-white/60 hover:text-white/90 transition-colors duration-200"
                >
                    View All
                    <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200" />
                </Link>
            </div>

            {/* Flowing token list - no card boundaries */}
            <div className="space-y-4">
                {relatedTokens.map((tokenWithReason, index) => (
                    <ImmersiveTokenRow 
                        key={tokenWithReason.token.contractId} 
                        tokenWithReason={tokenWithReason} 
                        index={index} 
                    />
                ))}
            </div>
        </div>
    );
}

interface ImmersiveTokenRowProps {
    tokenWithReason: TokenWithRelationship;
    index: number;
}

function ImmersiveTokenRow({ tokenWithReason, index }: ImmersiveTokenRowProps) {
    const { token, relationship } = tokenWithReason;
    const change = token.change24h || 0;
    const isPositive = change > 0;
    const isNegative = change < 0;

    return (
        <Link
            href={`/tokens/${encodeURIComponent(token.contractId)}`}
            className="group block py-4 border-b border-white/[0.03] hover:border-white/[0.08] transition-all duration-200"
        >
            <div className="flex items-center justify-between">
                {/* Token info - left side */}
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.03] flex items-center justify-center overflow-hidden">
                        <TokenImage token={token} size={40} />
                    </div>
                    <div>
                        <h3 className="font-medium text-white/90 text-sm group-hover:text-white transition-colors duration-200">
                            {token.name}
                        </h3>
                        <div className="flex items-center gap-2">
                            <p className="text-xs text-white/50">{token.symbol}</p>
                            <RelationshipBadge relationship={relationship} />
                        </div>
                    </div>
                </div>

                {/* Metrics - right side */}
                <div className="flex items-center gap-8 text-right">
                    <div>
                        <div className="text-sm font-mono text-white/80">
                            {fmtPrice(token.price)}
                        </div>
                        <div className="text-xs text-white/40">Price</div>
                    </div>
                    
                    <div>
                        <div className={cn(
                            "text-sm font-medium",
                            isPositive ? "text-emerald-400" :
                            isNegative ? "text-red-400" : 
                            "text-white/60"
                        )}>
                            {change > 0 ? "+" : ""}{change.toFixed(2)}%
                        </div>
                        <div className="text-xs text-white/40">24h</div>
                    </div>

                    {/* Subtle interaction hint */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <ArrowUpRight className="h-4 w-4 text-white/40" />
                    </div>
                </div>
            </div>
        </Link>
    );
}

/* ---------------- Advanced Relationship Algorithm ---------------- */

interface TokenWithRelationship {
    token: TokenSummary;
    relationship: RelationshipReason;
    score: number;
}

interface RelationshipReason {
    type: 'similar_price' | 'similar_performance' | 'momentum_correlation' | 'market_cap_peer' | 'volatility_match' | 'trending';
    description: string;
    confidence: number; // 0-1 score
}

function calculateRelatedTokens(currentToken: TokenSummary, allTokens: TokenSummary[]): TokenWithRelationship[] {
    const otherTokens = allTokens.filter(t => t.contractId !== currentToken.contractId);
    const scoredTokens: TokenWithRelationship[] = [];

    for (const token of otherTokens) {
        const relationships = analyzeRelationship(currentToken, token);
        
        // Only include tokens with meaningful relationships (confidence > 0.3)
        const bestRelationship = relationships
            .filter(r => r.confidence > 0.3)
            .sort((a, b) => b.confidence - a.confidence)[0];

        if (bestRelationship) {
            scoredTokens.push({
                token,
                relationship: bestRelationship,
                score: bestRelationship.confidence
            });
        }
    }

    // Sort by score and take top 6, ensuring no duplicates
    const uniqueTokens = Array.from(
        new Map(scoredTokens.map(item => [item.token.contractId, item])).values()
    );

    return uniqueTokens
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);
}

function analyzeRelationship(current: TokenSummary, other: TokenSummary): RelationshipReason[] {
    const relationships: RelationshipReason[] = [];

    // 1. Price Similarity Analysis
    if (current.price && other.price) {
        const priceRatio = Math.min(current.price, other.price) / Math.max(current.price, other.price);
        if (priceRatio > 0.2) { // Within 5x range
            const confidence = Math.min(priceRatio * 1.5, 1.0); // Closer prices = higher confidence
            relationships.push({
                type: 'similar_price',
                description: `Similar price range (${formatPriceRatio(current.price, other.price)})`,
                confidence
            });
        }
    }

    // 2. Performance Correlation
    if (current.change24h !== null && other.change24h !== null) {
        const changeDiff = Math.abs(current.change24h - other.change24h);
        if (changeDiff < 10) { // Within 10% performance difference
            const confidence = Math.max(0, 1 - (changeDiff / 10));
            relationships.push({
                type: 'similar_performance',
                description: `Similar 24h performance (${changeDiff.toFixed(1)}% difference)`,
                confidence
            });
        }
    }

    // 3. Market Cap Peers
    if (current.marketCap && other.marketCap) {
        const mcRatio = Math.min(current.marketCap, other.marketCap) / Math.max(current.marketCap, other.marketCap);
        if (mcRatio > 0.1) { // Within 10x market cap range
            const confidence = Math.min(mcRatio * 1.2, 1.0);
            relationships.push({
                type: 'market_cap_peer',
                description: `Similar market cap tier (${formatMarketCapRatio(current.marketCap, other.marketCap)})`,
                confidence
            });
        }
    }

    // 4. Momentum Correlation (7d vs 24h consistency)
    if (current.change24h !== null && current.change7d !== null && 
        other.change24h !== null && other.change7d !== null) {
        
        const currentMomentum = current.change7d / (current.change24h || 1);
        const otherMomentum = other.change7d / (other.change24h || 1);
        const momentumDiff = Math.abs(currentMomentum - otherMomentum);
        
        if (momentumDiff < 2) {
            const confidence = Math.max(0, 1 - (momentumDiff / 2));
            relationships.push({
                type: 'momentum_correlation',
                description: `Similar momentum pattern`,
                confidence
            });
        }
    }

    // 5. Volatility Match (based on 7d vs 24h variance)
    if (current.change24h !== null && current.change7d !== null && 
        other.change24h !== null && other.change7d !== null) {
        
        const currentVolatility = Math.abs(current.change7d - current.change24h * 7);
        const otherVolatility = Math.abs(other.change7d - other.change24h * 7);
        const volatilityRatio = Math.min(currentVolatility, otherVolatility) / Math.max(currentVolatility, otherVolatility);
        
        if (volatilityRatio > 0.5) {
            relationships.push({
                type: 'volatility_match',
                description: `Similar volatility profile`,
                confidence: volatilityRatio * 0.8 // Lower weight for volatility
            });
        }
    }

    // 6. Trending Status
    if (other.change24h !== null && other.change24h > 5) {
        relationships.push({
            type: 'trending',
            description: `Currently trending (+${other.change24h.toFixed(1)}%)`,
            confidence: Math.min(other.change24h / 20, 1.0) // Cap at 20% change
        });
    }

    return relationships;
}

function formatPriceRatio(price1: number, price2: number): string {
    const ratio = Math.max(price1, price2) / Math.min(price1, price2);
    if (ratio < 2) return 'very similar';
    if (ratio < 5) return 'similar range';
    return 'same magnitude';
}

function formatMarketCapRatio(mc1: number, mc2: number): string {
    const ratio = Math.max(mc1, mc2) / Math.min(mc1, mc2);
    if (ratio < 2) return 'nearly identical';
    if (ratio < 5) return 'same tier';
    return 'similar scale';
}

function RelationshipBadge({ relationship }: { relationship: RelationshipReason }) {
    const getBadgeColor = (type: RelationshipReason['type']) => {
        switch (type) {
            case 'similar_price': return 'bg-blue-500/20 text-blue-300';
            case 'similar_performance': return 'bg-emerald-500/20 text-emerald-300';
            case 'momentum_correlation': return 'bg-purple-500/20 text-purple-300';
            case 'market_cap_peer': return 'bg-orange-500/20 text-orange-300';
            case 'volatility_match': return 'bg-yellow-500/20 text-yellow-300';
            case 'trending': return 'bg-red-500/20 text-red-300';
            default: return 'bg-gray-500/20 text-gray-300';
        }
    };

    const getShortLabel = (type: RelationshipReason['type']) => {
        switch (type) {
            case 'similar_price': return 'Price';
            case 'similar_performance': return 'Performance';
            case 'momentum_correlation': return 'Momentum';
            case 'market_cap_peer': return 'Market Cap';
            case 'volatility_match': return 'Volatility';
            case 'trending': return 'Trending';
            default: return 'Related';
        }
    };

    return (
        <span 
            className={`px-1.5 py-0.5 rounded text-xs font-medium ${getBadgeColor(relationship.type)}`}
            title={relationship.description}
        >
            {getShortLabel(relationship.type)}
        </span>
    );
}

/* ---------------- helpers ---------------- */
function fmtPrice(price: number | null) {
    if (price === null) return "-";

    // Dynamic price formatting based on price range
    if (price >= 1000) {
        // Large prices: show 2 decimal places
        return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (price >= 1) {
        // Medium prices: show 2-4 decimal places
        return `$${price.toFixed(4).replace(/\.?0+$/, '')}`;
    } else if (price >= 0.01) {
        // Small prices: show 3-4 decimal places
        return `$${price.toFixed(4)}`;
    } else if (price >= 0.0001) {
        // Very small prices: show 6 decimal places
        return `$${price.toFixed(6)}`;
    } else if (price >= 0.000001) {
        // Extremely small prices: show 8 decimal places
        return `$${price.toFixed(8)}`;
    } else if (price > 0) {
        // Microscopic prices: use scientific notation
        return `$${price.toExponential(3)}`;
    } else {
        return "$0.00";
    }
} 
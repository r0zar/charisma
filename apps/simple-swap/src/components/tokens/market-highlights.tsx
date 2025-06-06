"use client";

import React, { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Activity, DollarSign, Flame, Star } from "lucide-react";
import Image from "next/image";
import type { TokenSummary } from "@/app/token-actions";
import { cn } from "@/lib/utils";

interface MarketHighlightsProps {
    tokens: TokenSummary[];
    className?: string;
}

// Token Image component with error handling
function TokenImage({ token, size = 32 }: { token: TokenSummary; size?: number }) {
    const [imageError, setImageError] = useState(false);

    if (!token.image || imageError) {
        return (
            <span className="text-xs font-semibold text-primary/80">
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

export default function MarketHighlights({ tokens, className }: MarketHighlightsProps) {
    const highlights = useMemo(() => {
        const validTokens = tokens.filter(t =>
            t.price !== null &&
            t.change24h !== null &&
            !isNaN(t.price) &&
            !isNaN(t.change24h)
        );

        // Top gainers (24h)
        const topGainers = [...validTokens]
            .sort((a, b) => (b.change24h || 0) - (a.change24h || 0))
            .slice(0, 3);

        // Top losers (24h)
        const topLosers = [...validTokens]
            .sort((a, b) => (a.change24h || 0) - (b.change24h || 0))
            .slice(0, 3);

        // Most active (highest abs change)
        const mostActive = [...validTokens]
            .sort((a, b) => Math.abs(b.change24h || 0) - Math.abs(a.change24h || 0))
            .slice(0, 3);

        // Market metrics
        const totalTokens = validTokens.length;
        const gainers = validTokens.filter(t => (t.change24h || 0) > 0).length;
        const losers = validTokens.filter(t => (t.change24h || 0) < 0).length;
        const avgChange = validTokens.reduce((sum, t) => sum + (t.change24h || 0), 0) / totalTokens;

        return {
            topGainers,
            topLosers,
            mostActive,
            metrics: {
                totalTokens,
                gainers,
                losers,
                avgChange
            }
        };
    }, [tokens]);

    return (
        <div className={cn("space-y-6", className)}>
            {/* Market Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">Total Tokens</p>
                            <p className="text-2xl font-bold">{highlights.metrics.totalTokens}</p>
                        </div>
                        <Activity className="h-8 w-8 text-blue-500" />
                    </div>
                </div>

                <div className="bg-card border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">Gainers</p>
                            <p className="text-2xl font-bold text-green-600">{highlights.metrics.gainers}</p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-green-500" />
                    </div>
                </div>

                <div className="bg-card border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">Losers</p>
                            <p className="text-2xl font-bold text-red-600">{highlights.metrics.losers}</p>
                        </div>
                        <TrendingDown className="h-8 w-8 text-red-500" />
                    </div>
                </div>

                <div className="bg-card border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">Avg Change</p>
                            <p className={cn(
                                "text-2xl font-bold",
                                highlights.metrics.avgChange > 0 ? "text-green-600" :
                                    highlights.metrics.avgChange < 0 ? "text-red-600" : "text-muted-foreground"
                            )}>
                                {highlights.metrics.avgChange > 0 ? "+" : ""}{highlights.metrics.avgChange.toFixed(2)}%
                            </p>
                        </div>
                        <DollarSign className="h-8 w-8 text-yellow-500" />
                    </div>
                </div>
            </div>

            {/* Top Movers */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top Gainers */}
                <div className="bg-card border border-border rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="h-5 w-5 text-green-500" />
                        <h3 className="text-lg font-semibold">Top Gainers</h3>
                        <span className="text-xs text-muted-foreground">(24h)</span>
                    </div>
                    <div className="space-y-3">
                        {highlights.topGainers.map((token, index) => (
                            <TokenHighlight
                                key={token.contractId}
                                token={token}
                                rank={index + 1}
                                type="gainer"
                            />
                        ))}
                    </div>
                </div>

                {/* Top Losers */}
                <div className="bg-card border border-border rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingDown className="h-5 w-5 text-red-500" />
                        <h3 className="text-lg font-semibold">Top Losers</h3>
                        <span className="text-xs text-muted-foreground">(24h)</span>
                    </div>
                    <div className="space-y-3">
                        {highlights.topLosers.map((token, index) => (
                            <TokenHighlight
                                key={token.contractId}
                                token={token}
                                rank={index + 1}
                                type="loser"
                            />
                        ))}
                    </div>
                </div>

                {/* Most Active */}
                <div className="bg-card border border-border rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Flame className="h-5 w-5 text-orange-500" />
                        <h3 className="text-lg font-semibold">Most Active</h3>
                        <span className="text-xs text-muted-foreground">(24h)</span>
                    </div>
                    <div className="space-y-3">
                        {highlights.mostActive.map((token, index) => (
                            <TokenHighlight
                                key={token.contractId}
                                token={token}
                                rank={index + 1}
                                type="active"
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

interface TokenHighlightProps {
    token: TokenSummary;
    rank: number;
    type: "gainer" | "loser" | "active";
}

function TokenHighlight({ token, rank, type }: TokenHighlightProps) {
    const change = token.change24h || 0;
    const isPositive = change > 0;
    const isNegative = change < 0;

    return (
        <div
            className="flex items-center justify-between hover:bg-muted/20 rounded-lg p-2 -m-2 cursor-pointer transition-colors"
            onClick={() => window.location.href = `/tokens/${encodeURIComponent(token.contractId)}`}
        >
            <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground w-4">#{rank}</span>
                <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center overflow-hidden">
                    <TokenImage token={token} size={32} />
                </div>
                <div className="min-w-0">
                    <div className="font-medium text-sm truncate max-w-[12rem]">{token.symbol}</div>
                    <div className="text-xs text-muted-foreground">
                        {fmtPrice(token.price)}
                    </div>
                </div>
            </div>
            <div className={cn(
                "text-sm font-medium",
                type === "active" ? (
                    isPositive ? "text-green-600" : isNegative ? "text-red-600" : "text-muted-foreground"
                ) : type === "gainer" ? "text-green-600" : "text-red-600"
            )}>
                {change > 0 ? "+" : ""}{change.toFixed(2)}%
            </div>
        </div>
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
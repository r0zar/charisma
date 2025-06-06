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
        // Filter out the current token
        const otherTokens = allTokens.filter(t => t.contractId !== currentToken.contractId);

        // Get tokens with similar price ranges (within 50% up or down)
        const currentPrice = currentToken.price || 0;
        const priceRangeTokens = otherTokens.filter(t => {
            if (!t.price || !currentPrice) return false;
            const ratio = t.price / currentPrice;
            return ratio >= 0.5 && ratio <= 2.0;
        });

        // Get tokens with similar performance (24h change within 5% difference)
        const currentChange = currentToken.change24h || 0;
        const performanceTokens = otherTokens.filter(t => {
            if (t.change24h === null) return false;
            return Math.abs((t.change24h || 0) - currentChange) <= 5;
        });

        // Get top performers
        const topPerformers = otherTokens
            .filter(t => t.change24h !== null && t.change24h > 0)
            .sort((a, b) => (b.change24h || 0) - (a.change24h || 0))
            .slice(0, 3);

        // Combine and deduplicate, preferring similar price range tokens
        const related = new Map<string, TokenSummary>();

        // Add price range tokens first (higher priority)
        priceRangeTokens.slice(0, 2).forEach(t => related.set(t.contractId, t));

        // Add performance tokens
        performanceTokens.slice(0, 2).forEach(t => related.set(t.contractId, t));

        // Fill remaining slots with top performers
        topPerformers.forEach(t => {
            if (related.size < 6) related.set(t.contractId, t);
        });

        // If still not enough, add random tokens
        otherTokens.slice(0, 6).forEach(t => {
            if (related.size < 6) related.set(t.contractId, t);
        });

        return Array.from(related.values()).slice(0, 6);
    }, [currentToken, allTokens]);

    if (relatedTokens.length === 0) {
        return null;
    }

    return (
        <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Related Tokens</h2>
                <Link
                    href="/tokens"
                    className="text-sm text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1"
                >
                    View all tokens
                    <ArrowUpRight className="h-4 w-4" />
                </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {relatedTokens.map((token) => (
                    <RelatedTokenCard key={token.contractId} token={token} />
                ))}
            </div>
        </div>
    );
}

interface RelatedTokenCardProps {
    token: TokenSummary;
}

function RelatedTokenCard({ token }: RelatedTokenCardProps) {
    const change = token.change24h || 0;
    const isPositive = change > 0;
    const isNegative = change < 0;

    return (
        <Link
            href={`/tokens/${encodeURIComponent(token.contractId)}`}
            className="group block"
        >
            <div className="bg-muted/20 hover:bg-muted/40 rounded-lg p-4 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center overflow-hidden">
                        <TokenImage token={token} size={40} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate max-w-[12rem]">{token.name}</div>
                        <div className="text-xs text-muted-foreground">{token.symbol}</div>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">
                        {fmtPrice(token.price)}
                    </div>
                    <div className={cn(
                        "inline-flex items-center gap-1 text-xs font-medium",
                        isPositive ? "text-green-600" :
                            isNegative ? "text-red-600" : "text-muted-foreground"
                    )}>
                        {isPositive ? (
                            <TrendingUp className="h-3 w-3" />
                        ) : isNegative ? (
                            <TrendingDown className="h-3 w-3" />
                        ) : null}
                        {change > 0 ? "+" : ""}{change.toFixed(2)}%
                    </div>
                </div>
            </div>
        </Link>
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
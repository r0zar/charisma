"use client";

import React, { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Activity, Info } from "lucide-react";
import Image from "next/image";
import type { TokenSummary } from "@/types/token-types";
import { cn, getIpfsUrl } from "@/lib/utils";
import { usePrices } from '@/contexts/token-price-context';

interface MarketHighlightsProps {
    tokenSummaries: TokenSummary[];
    priceHistories?: Record<string, any[]>;
    className?: string;
}

// Mini sparkline component
function MiniSparkline({ data, width = 40, height = 16 }: {
    data: number[];
    width?: number;
    height?: number;
}) {
    if (!data || data.length < 2) return null;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((value, index) => {
        const x = (index / (data.length - 1)) * width;
        const y = height - ((value - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    const isPositive = data[data.length - 1] > data[0];
    const lineColor = isPositive ? "#10b981" : "#ef4444";

    return (
        <svg width={width} height={height} className="inline-block opacity-60">
            <polyline
                fill="none"
                stroke={lineColor}
                strokeWidth="1"
                points={points}
            />
        </svg>
    );
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
            src={getIpfsUrl(token.image)}
            alt={token.symbol}
            width={size}
            height={size}
            className="object-cover"
            onError={() => setImageError(true)}
        />
    );
}

export default function MarketHighlights({ tokenSummaries, priceHistories = {}, className }: MarketHighlightsProps) {
    const { getPrice } = usePrices();

    const highlights = useMemo(() => {
        // Use all passed tokens for total count, but filter for calculations that need valid data
        const tokensWithPriceData = tokenSummaries.filter(t => {
            const currentPrice = getPrice(t.contractId) ?? t.price;
            return currentPrice !== null &&
                t.change24h !== null &&
                !isNaN(currentPrice) &&
                !isNaN(t.change24h);
        });

        // Top gainers (24h) - only from tokens with valid data
        const topGainers = [...tokensWithPriceData]
            .sort((a, b) => (b.change24h || 0) - (a.change24h || 0))
            .slice(0, 3);

        // Top losers (24h) - only from tokens with valid data
        const topLosers = [...tokensWithPriceData]
            .sort((a, b) => (a.change24h || 0) - (b.change24h || 0))
            .slice(0, 3);

        // Most active (highest abs change) - only from tokens with valid data
        const mostActive = [...tokensWithPriceData]
            .sort((a, b) => Math.abs(b.change24h || 0) - Math.abs(a.change24h || 0))
            .slice(0, 3);

        // Market metrics - use all passed tokens for total, but valid data for calculations
        const totalTokens = tokenSummaries.length;
        const gainers = tokensWithPriceData.filter(t => (t.change24h || 0) > 0).length;
        const losers = tokensWithPriceData.filter(t => (t.change24h || 0) < 0).length;

        // Market cap weighted average change (more representative than simple mean)
        const tokensWithMarketCap = tokensWithPriceData.filter(t => t.marketCap && t.marketCap > 0);
        const avgChange = tokensWithMarketCap.length > 0 ? (() => {
            const weightedChange = tokensWithMarketCap.reduce((sum, t) => {
                const weight = t.marketCap || 0;
                const change = t.change24h || 0;
                return sum + (change * weight);
            }, 0);
            const totalMarketCap = tokensWithMarketCap.reduce((sum, t) => sum + (t.marketCap || 0), 0);
            return totalMarketCap > 0 ? weightedChange / totalMarketCap : 0;
        })() : 0;

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
    }, [tokenSummaries, getPrice]);

    return (
        <div className={cn("space-y-8", className)}>
            {/* Clean market metrics - no card boundaries */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <div className="space-y-1">
                    <div className="text-2xl font-semibold text-white/90 font-mono">
                        {highlights.metrics.totalTokens}
                    </div>
                    <div className="text-xs text-white/40 uppercase tracking-wider">Total Tokens</div>
                </div>

                <div className="space-y-1">
                    <div className="text-2xl font-semibold text-emerald-400 font-mono">
                        {highlights.metrics.gainers}
                    </div>
                    <div className="text-xs text-white/40 uppercase tracking-wider">Gainers</div>
                </div>

                <div className="space-y-1">
                    <div className="text-2xl font-semibold text-red-400 font-mono">
                        {highlights.metrics.losers}
                    </div>
                    <div className="text-xs text-white/40 uppercase tracking-wider">Losers</div>
                </div>

                <div className="space-y-1">
                    <div className={cn(
                        "text-2xl font-semibold font-mono",
                        highlights.metrics.avgChange > 0 ? "text-emerald-400" :
                            highlights.metrics.avgChange < 0 ? "text-red-400" : "text-white/60"
                    )}>
                        {highlights.metrics.avgChange > 0 ? "+" : ""}{highlights.metrics.avgChange.toFixed(2)}%
                    </div>
                    <div className="text-xs text-white/40 uppercase tracking-wider flex items-center gap-1">
                        Market Avg
                        <div className="group relative">
                            <Info className="h-3 w-3 text-white/30 hover:text-white/60 cursor-help" />
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-black/80 border border-white/[0.1] rounded-lg shadow-lg text-xs text-white/80 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                                <div className="font-medium mb-1 text-white/90">Market Cap Weighted</div>
                                <div className="text-white/60">
                                    Larger tokens have proportionally more influence, providing accurate market representation.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Immersive top movers - flowing layout */}
            <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Top Gainers */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-emerald-400" />
                            <h3 className="font-medium text-white/90">Top Gainers</h3>
                            <span className="text-xs text-white/40">(24h)</span>
                        </div>
                        <div className="space-y-3">
                            {highlights.topGainers.map((token, index) => (
                                <CleanTokenHighlight
                                    key={token.contractId}
                                    token={token}
                                    rank={index + 1}
                                    type="gainer"
                                    getPrice={(contractId: string) => getPrice(contractId) ?? null}
                                    sparklineData={priceHistories[token.contractId]}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Top Losers */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <TrendingDown className="h-4 w-4 text-red-400" />
                            <h3 className="font-medium text-white/90">Top Losers</h3>
                            <span className="text-xs text-white/40">(24h)</span>
                        </div>
                        <div className="space-y-3">
                            {highlights.topLosers.map((token, index) => (
                                <CleanTokenHighlight
                                    key={token.contractId}
                                    token={token}
                                    rank={index + 1}
                                    type="loser"
                                    getPrice={(contractId: string) => getPrice(contractId) ?? null}
                                    sparklineData={priceHistories[token.contractId]}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Most Active */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-orange-400" />
                            <h3 className="font-medium text-white/90">Most Active</h3>
                            <span className="text-xs text-white/40">(24h)</span>
                        </div>
                        <div className="space-y-3">
                            {highlights.mostActive.map((token, index) => (
                                <CleanTokenHighlight
                                    key={token.contractId}
                                    token={token}
                                    rank={index + 1}
                                    type="active"
                                    getPrice={(contractId: string) => getPrice(contractId) ?? null}
                                    sparklineData={priceHistories[token.contractId]}
                                />
                            ))}
                        </div>
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
    getPrice: (contractId: string) => number | null;
    sparklineData?: any[];
}

function CleanTokenHighlight({ token, rank, type, getPrice, sparklineData }: TokenHighlightProps) {
    const change = token.change24h || 0;
    const isPositive = change > 0;
    const isNegative = change < 0;

    const priceData = sparklineData?.map(entry => entry.usdPrice || entry.price).filter(p => p != null);

    return (
        <div
            className="group flex items-center justify-between py-2 px-3 rounded-xl hover:bg-white/[0.03] cursor-pointer transition-all duration-200"
            onClick={() => {
                if (token.contractId && typeof token.contractId === 'string' && token.contractId.trim()) {
                    try {
                        window.location.href = `/tokens/${encodeURIComponent(token.contractId)}`;
                    } catch (error) {
                        console.error('Failed to navigate to token page:', error, token);
                    }
                } else {
                    console.warn('Invalid token contractId for navigation:', token);
                }
            }}
        >
            <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-white/30 w-4">#{rank}</span>
                <div className="h-8 w-8 rounded-lg bg-white/[0.05] flex items-center justify-center overflow-hidden">
                    <TokenImage token={token} size={32} />
                </div>
                <div className="min-w-0">
                    <div className="font-medium text-sm text-white/90 group-hover:text-white transition-colors duration-200 truncate max-w-[12rem]">
                        {token.symbol}
                    </div>
                    <div className="text-xs text-white/40 font-mono">
                        {fmtPrice(getPrice(token.contractId) ?? token.price)}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-3">
                {priceData && priceData.length > 1 && (
                    <MiniSparkline data={priceData} />
                )}
                <div className={cn(
                    "text-sm font-medium",
                    type === "active" ? (
                        isPositive ? "text-emerald-400" : isNegative ? "text-red-400" : "text-white/60"
                    ) : type === "gainer" ? "text-emerald-400" : "text-red-400"
                )}>
                    {change > 0 ? "+" : ""}{change.toFixed(2)}%
                </div>
            </div>
        </div>
    );
}

/* ---------------- helpers ---------------- */
function fmtPrice(price: number | null) {
    if (price === null) return "-";

    // Dynamic price formatting based on price range
    if (price >= 1000) {
        return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (price >= 1) {
        return `$${price.toFixed(4).replace(/\.?0+$/, '')}`;
    } else if (price >= 0.01) {
        return `$${price.toFixed(4)}`;
    } else if (price >= 0.0001) {
        return `$${price.toFixed(6)}`;
    } else if (price >= 0.000001) {
        return `$${price.toFixed(8)}`;
    } else if (price > 0) {
        return `$${price.toExponential(3)}`;
    } else {
        return "$0.00";
    }
}
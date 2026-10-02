"use client";

import React from 'react';
import { X, TrendingUp, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface ArbitrageOpportunity {
    tokenId: string;
    symbol: string;
    timestamp: number;
    marketPrice: number;
    virtualValue: number;
    deviation: number;
    profitable: boolean;
}

interface ArbitrageAlertsProps {
    opportunities: ArbitrageOpportunity[];
    onClose: () => void;
}

export default function ArbitrageAlerts({ opportunities, onClose }: ArbitrageAlertsProps) {
    // Sort by deviation (highest first)
    const sortedOpportunities = [...opportunities]
        .filter(o => o.profitable)
        .sort((a, b) => b.deviation - a.deviation)
        .slice(0, 3); // Show top 3

    if (sortedOpportunities.length === 0) return null;

    return (
        <div className="relative bg-gradient-to-r from-warning/10 via-accent/10 to-warning/10 border border-warning/20 rounded-2xl p-6">
            {/* Close button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1 rounded-lg hover:bg-surface-selected transition-colors"
                aria-label="Close arbitrage alerts"
            >
                <X className="h-4 w-4 text-ink-muted" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="relative">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    <div className="absolute inset-0 h-5 w-5 text-warning/40 blur-sm animate-pulse" />
                </div>
                <h3 className="text-lg font-medium text-ink">
                    Arbitrage Opportunities Detected
                </h3>
            </div>

            {/* Opportunities grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {sortedOpportunities.map((opp) => (
                    <Link
                        key={opp.tokenId}
                        href={`/tokens/${encodeURIComponent(opp.tokenId)}`}
                        className="group relative bg-surface hover:bg-surface-selected rounded-xl p-4 transition-all duration-200 border border-line hover:border-warning/30"
                    >
                        {/* Token info */}
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <h4 className="font-medium text-ink group-hover:text-ink transition-colors">
                                    {opp.symbol}
                                </h4>
                                <div className="text-xs text-ink-muted mt-1">
                                    {getTimeAgo(opp.timestamp)}
                                </div>
                            </div>
                            <TrendingUp className="h-4 w-4 text-warning" />
                        </div>

                        {/* Price comparison */}
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-ink-muted">Market Price:</span>
                                <span className="text-ink font-mono">
                                    ${opp.marketPrice.toFixed(4)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-ink-muted">Virtual Value:</span>
                                <span className="text-ink font-mono">
                                    ${opp.virtualValue.toFixed(4)}
                                </span>
                            </div>
                            <div className="pt-2 border-t border-line">
                                <div className="flex justify-between items-center">
                                    <span className="text-ink-muted">Deviation:</span>
                                    <span className={`font-medium ${opp.deviation > 10 ? 'text-warning' : 'text-warning'
                                        }`}>
                                        {opp.deviation.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Hover effect */}
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-warning/0 via-warning/5 to-warning/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </Link>
                ))}
            </div>

            {/* Footer message */}
            <div className="mt-4 text-xs text-ink-muted text-center">
                Market prices may differ from intrinsic values. Trade at your own risk.
            </div>
        </div>
    );
}

function getTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}
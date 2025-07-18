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
        <div className="relative bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/20 rounded-2xl p-6">
            {/* Close button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Close arbitrage alerts"
            >
                <X className="h-4 w-4 text-white/60" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="relative">
                    <AlertTriangle className="h-5 w-5 text-amber-400" />
                    <div className="absolute inset-0 h-5 w-5 text-amber-400/40 blur-sm animate-pulse" />
                </div>
                <h3 className="text-lg font-medium text-white/90">
                    Arbitrage Opportunities Detected
                </h3>
            </div>

            {/* Opportunities grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {sortedOpportunities.map((opp) => (
                    <Link
                        key={opp.tokenId}
                        href={`/tokens/${encodeURIComponent(opp.tokenId)}`}
                        className="group relative bg-white/5 hover:bg-white/10 rounded-xl p-4 transition-all duration-200 border border-white/10 hover:border-amber-400/30"
                    >
                        {/* Token info */}
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <h4 className="font-medium text-white/90 group-hover:text-white transition-colors">
                                    {opp.symbol}
                                </h4>
                                <div className="text-xs text-white/50 mt-1">
                                    {getTimeAgo(opp.timestamp)}
                                </div>
                            </div>
                            <TrendingUp className="h-4 w-4 text-amber-400" />
                        </div>

                        {/* Price comparison */}
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-white/60">Market Price:</span>
                                <span className="text-white/90 font-mono">
                                    ${opp.marketPrice.toFixed(4)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/60">Virtual Value:</span>
                                <span className="text-white/90 font-mono">
                                    ${opp.virtualValue.toFixed(4)}
                                </span>
                            </div>
                            <div className="pt-2 border-t border-white/10">
                                <div className="flex justify-between items-center">
                                    <span className="text-white/60">Deviation:</span>
                                    <span className={`font-medium ${opp.deviation > 10 ? 'text-amber-400' : 'text-yellow-400'
                                        }`}>
                                        {opp.deviation.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Hover effect */}
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-400/0 via-amber-400/5 to-amber-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </Link>
                ))}
            </div>

            {/* Footer message */}
            <div className="mt-4 text-xs text-white/50 text-center">
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
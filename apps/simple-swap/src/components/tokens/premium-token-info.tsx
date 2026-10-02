'use client';

import React from 'react';
import type { TokenSummary } from '@/types/token-types';
import { truncateSmartContract } from '@/lib/address-utils';

interface PremiumTokenInfoProps {
    detail: TokenSummary;
}

export default function PremiumTokenInfo({ detail }: PremiumTokenInfoProps) {
    return (
        <div className="space-y-8 sm:space-y-12">
            {/* Immersive token details - no obvious boundaries */}
            <div className="space-y-6 sm:space-y-8">
                {/* Description - if available, show prominently */}
                {detail.description && (
                    <div className="max-w-2xl">
                        <p className="text-ink-body text-sm sm:text-base leading-relaxed">
                            {detail.description}
                        </p>
                    </div>
                )}

                {/* Key metrics - mobile responsive grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
                    <div className="space-y-1">
                        <div className="text-lg sm:text-xl lg:text-2xl font-semibold text-ink font-mono break-all">
                            {fmtPrice(detail.price)}
                        </div>
                        <div className="text-xs text-ink-muted uppercase tracking-wider">Current Price</div>
                    </div>
                    
                    <div className="space-y-1">
                        <div className={`text-lg sm:text-xl lg:text-2xl font-semibold font-mono ${getColour(detail.change24h)}`}>
                            {fmtDelta(detail.change24h)}
                        </div>
                        <div className="text-xs text-ink-muted uppercase tracking-wider">24h Change</div>
                    </div>

                    {detail.marketCap && (
                        <div className="space-y-1">
                            <div className="text-lg sm:text-xl lg:text-2xl font-semibold text-ink font-mono">
                                ${(detail.marketCap / 1000000).toFixed(1)}M
                            </div>
                            <div className="text-xs text-ink-muted uppercase tracking-wider">Market Cap</div>
                        </div>
                    )}

                    {detail.total_supply && (
                        <div className="space-y-1">
                            <div className="text-lg sm:text-xl lg:text-2xl font-semibold text-ink font-mono">
                                {formatSupply(Number(detail.total_supply))}
                            </div>
                            <div className="text-xs text-ink-muted uppercase tracking-wider">Total Supply</div>
                        </div>
                    )}
                </div>

                {/* Technical details - mobile responsive */}
                <div className="pt-4 sm:pt-6 border-t border-line-soft">
                    <div className="space-y-4 sm:space-y-6">
                        {/* Contract address section */}
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-ink-muted text-sm">Contract:</span>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                <code className="font-mono text-ink-body text-xs bg-surface px-3 py-2 rounded-lg break-all flex-1 min-w-0" title={detail.contractId}>
                                    <span className="sm:hidden">{truncateSmartContract(detail.contractId)}</span>
                                    <span className="hidden sm:inline">{detail.contractId}</span>
                                </code>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => copyToClipboard(detail.contractId)}
                                        className="p-2 rounded-lg hover:bg-surface-hover text-ink-muted hover:text-ink-body transition-all duration-200 bg-surface"
                                        title="Copy contract address"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    </button>
                                    <a
                                        href={`https://explorer.hiro.so/address/${detail.contractId}?chain=mainnet`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 rounded-lg hover:bg-surface-hover text-ink-muted hover:text-ink-body transition-all duration-200 bg-surface"
                                        title="View on Stacks Explorer"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Additional details */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 text-sm">
                            <div className="flex items-center gap-2">
                                <span className="text-ink-muted">Standard:</span>
                                <span className="px-2 py-1 rounded-md bg-surface text-ink-body text-xs">
                                    {detail.type || "SIP-10"}
                                </span>
                            </div>

                            {detail.decimals !== undefined && (
                                <div className="flex items-center gap-2">
                                    <span className="text-ink-muted">Decimals:</span>
                                    <span className="text-ink-body font-mono">{detail.decimals}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Helper functions
async function copyToClipboard(text: string) {
    try {
        await navigator.clipboard.writeText(text);
    } catch (err) {
        console.error('Failed to copy text: ', err);
    }
}

function formatSupply(supply: number): string {
    if (supply >= 1e12) return `${(supply / 1e12).toFixed(1)}T`;
    if (supply >= 1e9) return `${(supply / 1e9).toFixed(1)}B`;
    if (supply >= 1e6) return `${(supply / 1e6).toFixed(1)}M`;
    if (supply >= 1e3) return `${(supply / 1e3).toFixed(1)}K`;
    return supply.toLocaleString();
}

function getColour(delta: number | null) {
    if (delta === null) return 'text-ink-muted';
    if (delta > 0) return 'text-success';
    if (delta < 0) return 'text-danger';
    return 'text-ink-muted';
}

function fmtPrice(price: number | null) {
    if (price === null) return "-";
    return `$${price.toFixed(4)}`;
}

function fmtDelta(delta: number | null) {
    if (delta === null) return "-";
    const sign = delta > 0 ? "+" : "";
    return `${sign}${delta?.toFixed(2)}%`;
}
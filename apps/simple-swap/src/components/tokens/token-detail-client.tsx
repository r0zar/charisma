'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import type { TokenSummary } from '@/app/token-actions';
import TokenChartWrapper from './token-chart-wrapper';
import { useDominantColor } from '../utils/useDominantColor';
import CompareTokenSelector from './compare-token-selector';
import { perfMonitor } from '@/lib/performance-monitor';
import LivePriceIndicator, { LivePriceStatus } from './live-price-indicator';
import { usePrices } from '@/contexts/token-price-context';
import { useBalances } from '@/contexts/wallet-balance-context';
import { useWallet } from '@/contexts/wallet-context';
import { useComparisonToken } from '@/contexts/comparison-token-context';

interface Props {
    detail: TokenSummary;
    tokens?: TokenSummary[];
}

interface PremiumComparisonCardProps {
    period: string;
    change: number | null;
    isRelative: boolean;
    compareSymbol?: string;
}

// Premium comparison card component
function PremiumComparisonCard({ period, change, isRelative, compareSymbol }: PremiumComparisonCardProps) {
    const getCleanColor = (delta: number | null) => {
        if (delta === null) return 'text-white/60';
        if (delta > 0) return 'text-emerald-400';
        if (delta < 0) return 'text-red-400';
        return 'text-white/60';
    };

    const getBorderGlow = (delta: number | null) => {
        if (delta === null) return 'border-white/[0.08] hover:border-white/[0.15]';
        if (delta > 0) return 'border-emerald-500/[0.15] hover:border-emerald-400/[0.3] shadow-emerald-500/[0.05]';
        if (delta < 0) return 'border-red-500/[0.15] hover:border-red-400/[0.3] shadow-red-500/[0.05]';
        return 'border-white/[0.08] hover:border-white/[0.15]';
    };

    const fmtDelta = (delta: number | null) => {
        if (delta === null) return '-';
        const sign = delta > 0 ? '+' : '';
        return `${sign}${delta.toFixed(2)}%`;
    };

    return (
        <div className={`group relative p-4 sm:p-6 rounded-2xl border bg-black/20 backdrop-blur-sm transition-all duration-300 hover:bg-black/30 hover:shadow-lg ${getBorderGlow(change)}`}>
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
            
            <div className="relative flex flex-col items-center space-y-2 sm:space-y-3">
                <div className="text-xs text-white/50 uppercase tracking-wider font-medium group-hover:text-white/70 transition-colors duration-300 text-center">
                    {period} {isRelative && compareSymbol && (
                        <span className="text-white/30 block sm:inline">
                            <span className="hidden sm:inline">vs </span>
                            <span className="sm:hidden">vs</span> {compareSymbol}
                        </span>
                    )}
                </div>
                <div className={`text-lg sm:text-xl font-semibold font-mono transition-colors duration-300 text-center ${getCleanColor(change)}`}>
                    {fmtDelta(change)}
                </div>
            </div>
            
            {/* Trend indicator */}
            {change !== null && (
                <div className="absolute top-3 right-3">
                    <div className={`w-2 h-2 rounded-full ${change > 0 ? 'bg-emerald-400' : 'bg-red-400'} opacity-60 group-hover:opacity-100 transition-opacity duration-300`} />
                </div>
            )}
        </div>
    );
}

// Token Image component with error handling
function TokenImage({ token, size = 56 }: { token: TokenSummary; size?: number }) {
    const [imageError, setImageError] = useState(false);

    if (!token.image || imageError) {
        return (
            <span className="text-lg font-bold text-primary/80">
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
            onError={() => setImageError(true)}
        />
    );
}

export default function TokenDetailClient({ detail, tokens: initialTokens }: Props) {
    const [tokens, setTokens] = useState<TokenSummary[]>(initialTokens ?? []);
    const [isLoadingTokens, setIsLoadingTokens] = useState(false);

    // Use shared comparison token context
    const { compareId, setCompareId, isInitialized } = useComparisonToken();

    // Real-time data from new contexts
    const { address } = useWallet();
    const { getPrice, isLoading: pricesLoading } = usePrices();
    const { getTokenBalance, isLoading: balancesLoading } = useBalances(address ? [address] : []);
    const isConnected = !pricesLoading && !balancesLoading;

    // Only fetch tokens if not provided from SSR and we don't have any tokens yet
    useEffect(() => {
        if (initialTokens && initialTokens.length > 0) {
            console.log('[TOKEN-DETAIL-CLIENT] Using SSR token data, skipping API call');
            return;
        }

        if (tokens.length > 0) {
            console.log('[TOKEN-DETAIL-CLIENT] Tokens already loaded, skipping API call');
            return;
        }

        const timer = perfMonitor.startTiming('token-detail-client-fetch-tokens');
        setIsLoadingTokens(true);

        fetch('/api/token-summaries')
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then((d: TokenSummary[]) => {
                setTokens(d);
                timer.end({ source: 'api', tokenCount: d.length });
                console.log('[TOKEN-DETAIL-CLIENT] Loaded tokens from API:', d.length);
            })
            .catch((error) => {
                console.error('[TOKEN-DETAIL-CLIENT] Failed to fetch tokens:', error);
                timer.end({ source: 'api', error: error.message });
            })
            .finally(() => {
                setIsLoadingTokens(false);
            });
    }, [initialTokens, tokens.length]);

    // compareId initialization is now handled by ComparisonTokenContext

    // Memoize expensive computations with real-time price enhancement
    const compareToken = useMemo(() =>
        compareId ? tokens.find((t) => t.contractId === compareId) ?? null : null,
        [tokens, compareId]
    );

    // Enhanced token details with real-time data from new contexts
    const enhancedDetail = useMemo(() => {
        const realtimePrice = getPrice(detail.contractId);
        const userBalance = address ? getTokenBalance(address, detail.contractId) : 0;

        return {
            ...detail,
            // Use real-time price if available, fallback to static
            currentPrice: realtimePrice ?? detail.price,
            // Enhanced metadata (simplified without balance metadata)
            enhancedMetadata: {
                name: detail.name,
                symbol: detail.symbol,
                decimals: detail.decimals,
                description: detail.description,
                image: detail.image,
            },
            userBalance,
        };
    }, [detail, getPrice, getTokenBalance, address]);

    // Calculate relative percentage changes when comparison token is selected
    const relativeChanges = useMemo(() => {
        if (!compareToken) {
            // No comparison token, use USD-based changes
            return {
                change1h: detail.change1h,
                change24h: detail.change24h,
                change7d: detail.change7d,
                isRelative: false
            };
        }

        // Calculate relative changes (Primary change - Compare change)
        const calculateRelativeChange = (primaryChange: number | null, compareChange: number | null): number | null => {
            if (primaryChange === null || compareChange === null) return null;
            return primaryChange - compareChange;
        };

        return {
            change1h: calculateRelativeChange(detail.change1h, compareToken.change1h),
            change24h: calculateRelativeChange(detail.change24h, compareToken.change24h),
            change7d: calculateRelativeChange(detail.change7d, compareToken.change7d),
            isRelative: true
        };
    }, [detail, compareToken]);

    // Extract colors with memoization
    const primaryColor = useDominantColor(detail.image);
    const compareColor = useDominantColor(compareToken?.image ?? null);

    // Memoize the default comparison token selection
    const defaultCompareId = useMemo(() => {
        if (!tokens.length) return null;

        // Priority order for default comparison
        const prioritySymbols = ['USDh', 'USDC', 'USDT', 'STX'];
        for (const symbol of prioritySymbols) {
            const token = tokens.find((t) => t.symbol === symbol);
            if (token && token.contractId !== detail.contractId) {
                return token.contractId;
            }
        }

        // Fallback to first available token that's not the current one
        const fallback = tokens.find((t) => t.contractId !== detail.contractId);
        return fallback?.contractId ?? null;
    }, [tokens, detail.contractId]);

    function diff(a: number | null, b: number | null): number | null {
        if (a === null || b === null) return null;
        return a - b;
    }

    function fmtDelta(delta: number | null) {
        if (delta === null) return '-';
        const sign = delta > 0 ? '+' : '';
        return `${sign}${delta.toFixed(2)}%`;
    }

    function getColour(delta: number | null) {
        if (delta === null) return 'text-white/60';
        if (delta > 0) return 'text-emerald-400';
        if (delta < 0) return 'text-red-400';
        return 'text-white/60';
    }

    // compareId persistence is now handled by ComparisonTokenContext

    // Set default comparison token when available (only after context is initialized)
    useEffect(() => {
        if (!isInitialized) {
            console.log('[TOKEN-DETAIL-CLIENT] Waiting for context initialization...');
            return;
        }
        
        if (!compareId && defaultCompareId) {
            console.log('[TOKEN-DETAIL-CLIENT] Setting default comparison token:', defaultCompareId.substring(0, 10));
            setCompareId(defaultCompareId);
        } else if (compareId) {
            console.log('[TOKEN-DETAIL-CLIENT] Using existing comparison token from context:', compareId.substring(0, 10));
        }
    }, [compareId, defaultCompareId, isInitialized, setCompareId]);

    return (
        <>
            {/* Header section - mobile responsive */}
            <div className="space-y-4 mb-6">
                {/* Token info row */}
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-muted/50 flex items-center justify-center overflow-hidden flex-shrink-0">
                        <TokenImage token={detail} size={56} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-xl sm:text-2xl font-semibold leading-tight truncate">{detail.name}</h1>
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-muted-foreground text-sm">
                                {enhancedDetail.enhancedMetadata?.symbol || detail.symbol}
                            </p>
                            <LivePriceStatus contractIds={[detail.contractId]} />
                            {/* Real-time connection indicator */}
                            <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} flex-shrink-0`}
                                title={isConnected ? 'Real-time data connected' : 'Real-time data disconnected'} />
                        </div>
                        {/* User balance display with tooltip */}
                        {enhancedDetail.userBalance && (
                            <div className="group relative text-xs text-muted-foreground mt-1 inline-block cursor-help">
                                <span className="hidden sm:inline">Your balance: </span>
                                <span className="sm:hidden">Balance: </span>
                                {enhancedDetail.userBalance.toFixed(4)} {enhancedDetail.enhancedMetadata?.symbol}
                                
                                {/* Tooltip */}
                                <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-black/20 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-lg text-xs text-white/80 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                                    <div className="font-medium mb-2 text-white/95">Balance Breakdown</div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between">
                                            <span className="text-white/70">Mainnet:</span>
                                            <span className="font-mono">{enhancedDetail.userBalance.toFixed(4)}</span>
                                        </div>
                                        <div className="border-t border-white/[0.1] pt-1 mt-2">
                                            <div className="flex justify-between font-medium">
                                                <span className="text-white/90">Total:</span>
                                                <span className="font-mono text-white/95">{enhancedDetail.userBalance.toFixed(4)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Comparison selector - full width on mobile */}
                <div className="w-full">
                    <CompareTokenSelector
                        tokens={tokens}
                        primary={detail}
                        selectedId={compareId}
                        onSelect={setCompareId}
                        isLoading={isLoadingTokens}
                    />
                </div>
            </div>

            {/* Premium comparison stats - mobile responsive grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
                <div className="group relative p-4 sm:p-6 rounded-2xl border border-white/[0.08] bg-black/20 backdrop-blur-sm transition-all duration-300 hover:bg-black/30 hover:border-white/[0.15] hover:shadow-lg">
                    {/* Subtle gradient overlay */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                    
                    <div className="relative flex flex-col items-center space-y-2 sm:space-y-3">
                        <div className="text-xs text-white/50 uppercase tracking-wider font-medium group-hover:text-white/70 transition-colors duration-300 text-center">
                            Price
                        </div>
                        <LivePriceIndicator
                            contractId={detail.contractId}
                            fallbackPrice={detail.price}
                            className="text-lg sm:text-xl font-semibold font-mono text-white/90 text-center"
                            showChange={false}
                            showStatus={false}
                        />
                    </div>
                    
                    {/* Live indicator */}
                    {isConnected && (
                        <div className="absolute top-3 right-3">
                            <div className="relative">
                                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                                <div className="absolute inset-0 w-2 h-2 bg-emerald-400/40 rounded-full animate-ping" />
                            </div>
                        </div>
                    )}
                </div>
                
                <PremiumComparisonCard
                    period="1h"
                    change={relativeChanges.change1h}
                    isRelative={relativeChanges.isRelative}
                    compareSymbol={compareToken?.symbol}
                />
                
                <PremiumComparisonCard
                    period="24h"
                    change={relativeChanges.change24h}
                    isRelative={relativeChanges.isRelative}
                    compareSymbol={compareToken?.symbol}
                />
                
                <PremiumComparisonCard
                    period="7d"
                    change={relativeChanges.change7d}
                    isRelative={relativeChanges.isRelative}
                    compareSymbol={compareToken?.symbol}
                />
            </div>

            {/* Chart */}
            <TokenChartWrapper
                primary={detail.contractId}
                compareId={compareId}
                primaryColor={primaryColor ?? '#3b82f6'}
                compareColor={compareColor ?? '#f87171'}
            />
        </>
    );
} 
'use client';

import React, { useState, Suspense } from 'react';
import SwapInterface from '@/components/swap-interface/swap-interface';
import SwapInterfaceContent from '@/components/swap-interface/swap-interface-content';
import SwapDetails from '@/components/swap-interface/swap-details';
import { Header } from '@/components/layout/header';
import { SwapTokensProvider } from '@/contexts/swap-tokens-context';
import { useRouterTrading } from '@/hooks/useRouterTrading';
import { useSwapTokens } from '@/contexts/swap-tokens-context';
import TokenLogo from '@/components/TokenLogo';
import { Menu, X, BarChart3, Info, ArrowRight, Zap, TrendingUp, Shield, Clock } from 'lucide-react';
import ErrorAlert from '@/components/swap-interface/error-alert';
import { formatTokenAmount } from '@/lib/swap-utils';

interface SwapPageClientProps {
    tokens: any[];
    searchParams: { [key: string]: string | string[] | undefined };
}

// Custom Swap Information Sidebar Component
function SwapInformationSidebar() {
    const { quote, isLoadingQuote, totalPriceImpact, error } = useRouterTrading();
    const { selectedToToken } = useSwapTokens();

    return (
        <div className="space-y-4">
            {/* Vault-level Isolation */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200">
                <div className="flex items-start space-x-3">
                    <div className="h-10 w-10 rounded-xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center mt-0.5 backdrop-blur-sm">
                        <svg className="h-5 w-5 text-white/90" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /></svg>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-white/95">Isolated Vault Security</h3>
                        <p className="text-xs text-white/70 mt-1">Every liquidity pool lives in its <strong className="text-white/85">own Clarity contract principal</strong>. Funds are sandboxed.</p>
                    </div>
                </div>
            </div>

            {/* Automatic post-conditions */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200">
                <div className="flex items-start space-x-3">
                    <div className="h-10 w-10 rounded-xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center mt-0.5 backdrop-blur-sm">
                        <svg className="h-5 w-5 text-white/90" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-white/95">Automatic Post-conditions</h3>
                        <p className="text-xs text-white/70 mt-1">Swap transactions include <strong className="text-white/85">fungible-token postconditions</strong> for safety.</p>
                    </div>
                </div>
            </div>

            {/* Unified LP Interface */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200">
                <div className="flex items-start space-x-3">
                    <div className="h-10 w-10 rounded-xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center mt-0.5 backdrop-blur-sm">
                        <svg className="h-5 w-5 text-white/90" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-white/95">Unified LP Interface</h3>
                        <p className="text-xs text-white/70 mt-1">Every pool implements the open <strong className="text-white/85">Liquidity-Pool SIP</strong> standard.</p>
                    </div>
                </div>
            </div>

            {/* Best-Path Routing */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200">
                <div className="flex items-start space-x-3">
                    <div className="h-10 w-10 rounded-xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center mt-0.5 backdrop-blur-sm">
                        <svg className="h-5 w-5 text-white/90" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><polyline points="3 12 9 12 21 12" /><polyline points="3 18 14 18 21 18" /></svg>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-white/95">Best-Path Multihop Routing</h3>
                        <p className="text-xs text-white/70 mt-1">Graph search evaluates up to <strong className="text-white/85">9-hop paths</strong> for optimal routing.</p>
                    </div>
                </div>
            </div>

            {/* Route Summary */}
            {quote && (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200">
                    <div className="flex items-start space-x-3">
                        <div className="h-10 w-10 rounded-xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center mt-0.5 backdrop-blur-sm">
                            <svg className="h-5 w-5 text-white/90" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-medium text-white/95">Route Path</h3>
                            <div className="flex items-center space-x-2 mt-2">
                                <div className="flex items-center space-x-1">
                                    {quote.path.slice(0, 7).map((token, index) => (
                                        <React.Fragment key={token.contractId || index}>
                                            <TokenLogo token={token} size="sm" />
                                            {index < Math.min(quote.path.length - 1, 6) && (
                                                <svg className="h-3 w-3 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            )}
                                        </React.Fragment>
                                    ))}
                                    {quote.path.length > 7 && <span className="text-xs text-white/60">+{quote.path.length - 7} more</span>}
                                </div>
                                <span className="text-xs text-white/70">
                                    {quote.path.length - 1} {quote.path.length - 1 === 1 ? 'hop' : 'hops'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Price Impact */}
            {totalPriceImpact && totalPriceImpact.priceImpact !== null && (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200">
                    <div className="flex items-start space-x-3">
                        <div className="h-10 w-10 rounded-xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center mt-0.5 backdrop-blur-sm">
                            <svg className="h-5 w-5 text-white/90" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20" /></svg>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-medium text-white/95">Price Impact</h3>
                            <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-white/70">Impact on trade</span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    totalPriceImpact.priceImpact > 0 ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
                                }`}>
                                    {totalPriceImpact.priceImpact > 0 ? '+' : ''}{totalPriceImpact.priceImpact.toFixed(2)}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Minimum Guaranteed */}
            {quote && selectedToToken && (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200">
                    <div className="flex items-start space-x-3">
                        <div className="h-10 w-10 rounded-xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center mt-0.5 backdrop-blur-sm">
                            <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 12l2 2 4-4"></path>
                                <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.37 0 4.52.92 6.11 2.42"></path>
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-medium text-white/95">Minimum Guaranteed</h3>
                            <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-white/70">You will receive at least</span>
                                <span className="text-green-400 font-medium text-xs">
                                    {formatTokenAmount(Number(quote.amountOut * 0.99), selectedToToken.decimals || 0)} {selectedToToken.symbol}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* High Price Impact Warning */}
            {totalPriceImpact && totalPriceImpact.priceImpact !== null && Math.abs(totalPriceImpact.priceImpact) > 20 && (
                <div className={`p-4 rounded-xl border backdrop-blur-sm ${
                    totalPriceImpact.priceImpact > 0 
                        ? 'bg-green-500/[0.08] border-green-500/[0.15]' 
                        : 'bg-yellow-500/[0.08] border-yellow-500/[0.15]'
                }`}>
                    <div className="flex items-start space-x-3">
                        <div className={`h-10 w-10 rounded-xl border flex items-center justify-center mt-0.5 backdrop-blur-sm ${
                            totalPriceImpact.priceImpact > 0
                                ? 'bg-green-500/20 border-green-500/30 text-green-400'
                                : 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400'
                        }`}>
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className={`text-sm font-medium ${
                                totalPriceImpact.priceImpact > 0 ? 'text-green-400' : 'text-yellow-400'
                            }`}>
                                {totalPriceImpact.priceImpact > 0 ? 'Positive Price Impact!' : 'High Price Impact Warning'}
                            </h3>
                            <p className="text-xs text-white/70 mt-1">
                                {totalPriceImpact.priceImpact > 0 
                                    ? 'You are receiving significantly more than expected!' 
                                    : 'You are receiving significantly less than expected!'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Error Alert */}
            <ErrorAlert />
        </div>
    );
}

// Custom Route Intelligence Sidebar Component
function RouteIntelligenceSidebar() {
    const { quote, isLoadingQuote, totalPriceImpact, securityLevel } = useRouterTrading();
    const { selectedFromToken, selectedToToken, displayAmount, mode } = useSwapTokens();

    if (!quote || isLoadingQuote) {
        return (
            <div className="space-y-4">
                {/* Loading State */}
                <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
                    <div className="flex items-center space-x-3 mb-4">
                        <div className="h-3 w-3 bg-blue-400 rounded-full animate-pulse" />
                        <div className="text-sm font-medium text-white/90">Analyzing Routes...</div>
                    </div>
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-4 bg-white/[0.05] rounded animate-pulse" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const routeHops = quote.path || [];
    const totalHops = routeHops.length - 1;

    return (
        <div className="space-y-4">
            {/* Route Overview */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 hover:bg-white/[0.05] transition-all duration-200">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                        <Zap className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-semibold text-white/95">Route Overview</span>
                    </div>
                    <div className={`px-2 py-1 rounded-md text-xs font-medium ${
                        securityLevel === 'high' ? 'bg-green-500/20 text-green-400' :
                        securityLevel === 'medium' ? 'bg-blue-500/20 text-blue-400' : 
                        'bg-purple-500/20 text-purple-400'
                    }`}>
                        {securityLevel === 'high' ? 'DIRECT' :
                         securityLevel === 'medium' ? 'OPTIMIZED' : 
                         securityLevel === 'low' ? 'ADVANCED' : 
                         securityLevel?.toUpperCase()}
                    </div>
                </div>
                
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-white/60">Total Hops</span>
                        <span className="text-white/90 font-medium">{totalHops}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-white/60">Route Type</span>
                        <span className="text-white/90 font-medium">
                            {totalHops === 0 ? 'Direct' : totalHops === 1 ? 'Single Hop' : 'Multi-Hop'}
                        </span>
                    </div>
                    {totalPriceImpact && (
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-white/60">Price Impact</span>
                            <span className={`font-medium ${
                                totalPriceImpact.priceImpact > 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                                {totalPriceImpact.priceImpact > 0 ? '+' : ''}{totalPriceImpact.priceImpact.toFixed(2)}%
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Route Visualization */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 hover:bg-white/[0.05] transition-all duration-200">
                <div className="flex items-center space-x-2 mb-4">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-semibold text-white/95">Route Path</span>
                </div>
                
                <div className="space-y-3">
                    {routeHops.map((token, index) => (
                        <div key={`${token.contractId}-${index}`} className="flex items-center space-x-3">
                            {/* Token Info */}
                            <div className="flex items-center space-x-2 flex-1">
                                <TokenLogo token={token} size="sm" />
                                <div>
                                    <div className="text-xs font-medium text-white/95">{token.symbol}</div>
                                    <div className="text-xs text-white/60">{token.name}</div>
                                </div>
                            </div>
                            
                            {/* Arrow or End */}
                            {index < routeHops.length - 1 && (
                                <ArrowRight className="w-3 h-3 text-white/40" />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Performance Metrics */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 hover:bg-white/[0.05] transition-all duration-200">
                <div className="flex items-center space-x-2 mb-4">
                    <Shield className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-semibold text-white/95">Performance</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/[0.02] rounded-lg p-3">
                        <div className="text-xs text-white/60 mb-1">Efficiency</div>
                        <div className="text-sm font-semibold text-white/95">
                            {totalPriceImpact && totalPriceImpact.priceImpact !== null
                                ? `${(100 + totalPriceImpact.priceImpact).toFixed(1)}%`
                                : totalHops === 0 ? '100%' : totalHops === 1 ? '95%' : '90%'
                            }
                        </div>
                    </div>
                    <div className="bg-white/[0.02] rounded-lg p-3">
                        <div className="text-xs text-white/60 mb-1">Gas Est.</div>
                        <div className="text-sm font-semibold text-white/95">
                            {mode === 'order' ? '0 STX' : '0.0002 STX'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Route Analysis */}
            {quote.hops && quote.hops.length > 0 && (
                <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 hover:bg-white/[0.05] transition-all duration-200">
                    <div className="flex items-center space-x-2 mb-4">
                        <Clock className="w-4 h-4 text-orange-400" />
                        <span className="text-sm font-semibold text-white/95">Liquidity Pools</span>
                    </div>
                    
                    <div className="space-y-2">
                        {quote.hops.map((hop, index) => (
                            <div key={index} className="bg-white/[0.02] rounded-lg p-3">
                                <div className="flex items-center space-x-3 mb-2">
                                    {hop.vault?.image && (
                                        <img 
                                            src={hop.vault.image} 
                                            alt={hop.vault?.name || 'Pool'}
                                            className="w-6 h-6 rounded-md"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    )}
                                    <div className="flex-1">
                                        <div className="text-xs font-medium text-white/90">
                                            {hop.vault?.name || 'Liquidity Pool'}
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-xs text-white/60 font-mono">
                                                {hop.vault?.contractId ? `${hop.vault.contractId.slice(0, 8)}...${hop.vault.contractId.slice(-6)}` : 'Pool'}
                                            </span>
                                            {hop.vault?.contractId && (
                                                <div className="flex items-center space-x-1">
                                                    <button
                                                        onClick={() => navigator.clipboard.writeText(hop.vault.contractId)}
                                                        className="h-4 w-4 rounded bg-white/[0.05] hover:bg-white/[0.1] text-white/60 hover:text-white/90 transition-all duration-200 flex items-center justify-center"
                                                        title="Copy contract ID"
                                                    >
                                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                                                            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() => window.open(`https://explorer.stacks.co/address/${hop.vault.contractId}?chain=mainnet`, '_blank')}
                                                        className="h-4 w-4 rounded bg-white/[0.05] hover:bg-white/[0.1] text-white/60 hover:text-white/90 transition-all duration-200 flex items-center justify-center"
                                                        title="View in explorer"
                                                    >
                                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                                            <polyline points="15,3 21,3 21,9"></polyline>
                                                            <line x1="10" y1="14" x2="21" y2="3"></line>
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {hop.vault?.fee !== undefined && (
                                        <div className="text-xs text-white/70 bg-white/[0.05] px-2 py-1 rounded">
                                            {hop.vault.fee === 0 ? 'No Fee' : `${(hop.vault.fee / 10000).toFixed(2)}% fee`}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Live Market Data */}
            <div className="bg-gradient-to-br from-blue-500/[0.05] to-purple-500/[0.05] border border-white/[0.08] rounded-xl p-4">
                <div className="flex items-center space-x-2 mb-3">
                    <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-sm font-semibold text-white/95">Live Market</span>
                </div>
                
                <div className="text-xs text-white/70">
                    Routes are calculated in real-time using live liquidity data from all connected pools.
                </div>
            </div>
        </div>
    );
}

export default function SwapPageClient({ tokens, searchParams }: SwapPageClientProps) {
    const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
    const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
    
    // Convert searchParams to URLSearchParams for consistency
    const urlSearchParams = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
        if (typeof value === 'string') {
            urlSearchParams.set(key, value);
        } else if (Array.isArray(value)) {
            urlSearchParams.set(key, value[0] || '');
        }
    });

    return (
        <SwapTokensProvider initialTokens={tokens} searchParams={urlSearchParams}>
            <div className="relative flex flex-col h-screen overflow-hidden">
                <Header />
            
            {/* Mobile Sidebar Toggle Buttons */}
            <div className="lg:hidden xl:hidden flex items-center justify-between p-4 border-b border-white/[0.08] bg-black/20 backdrop-blur-sm">
                <button
                    onClick={() => setLeftSidebarOpen(true)}
                    className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/70 hover:text-white/90 hover:bg-white/[0.08] transition-all duration-200"
                >
                    <BarChart3 className="w-4 h-4" />
                    <span className="text-sm">Route Analysis</span>
                </button>
                <button
                    onClick={() => setRightSidebarOpen(true)}
                    className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/70 hover:text-white/90 hover:bg-white/[0.08] transition-all duration-200"
                >
                    <Info className="w-4 h-4" />
                    <span className="text-sm">Swap Info</span>
                </button>
            </div>

            <main className="flex-1 overflow-hidden">
                <div className="flex h-full">
                    {/* Mobile Overlay */}
                    {(leftSidebarOpen || rightSidebarOpen) && (
                        <div 
                            className="fixed inset-0 bg-black/80 backdrop-blur-xl z-40 lg:hidden xl:hidden"
                            onClick={() => {
                                setLeftSidebarOpen(false);
                                setRightSidebarOpen(false);
                            }}
                        />
                    )}

                    {/* Left Sidebar - Route Intelligence */}
                    <div className={`w-full max-w-sm sm:w-[420px] border-r border-white/[0.08] bg-black/20 backdrop-blur-sm flex-col z-50 ${
                        leftSidebarOpen ? 'fixed inset-y-0 left-0 flex' : 'hidden lg:flex'
                    }`}>
                        <div className="p-4 border-b border-white/[0.08]">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <div className="h-8 w-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                                        </svg>
                                    </div>
                                    <h2 className="text-sm font-semibold text-white/95">Route Intelligence</h2>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <div className="flex items-center space-x-1">
                                        <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
                                        <span className="text-xs text-white/60">Live</span>
                                    </div>
                                    <button
                                        onClick={() => setLeftSidebarOpen(false)}
                                        className="lg:hidden h-6 w-6 rounded text-white/60 hover:text-white/90 hover:bg-white/[0.1] transition-all duration-200 flex items-center justify-center"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {/* Custom Route Intelligence Layout */}
                            <RouteIntelligenceSidebar />
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 flex flex-col min-h-0">
                        {/* Full-Width Swap Header */}
                        <div className="relative backdrop-blur-xl overflow-hidden border-b border-white/[0.08]">
                            {/* Premium Background with Gradient */}
                            <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/30 to-black/40" />
                            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-purple-500/[0.02]" />
                            
                            {/* Glass Morphism Effect */}
                            <div className="absolute inset-0 bg-white/[0.02] backdrop-blur-xl" />
                            
                            {/* Content - No Container Constraints */}
                            <div className="relative z-10 w-full">
                                <SwapInterface headerOnly={true} />
                            </div>
                        </div>
                        
                        {/* Main Swap Interface */}
                        <div className="flex-1 overflow-auto min-h-0">
                            <div className="container max-w-4xl mx-auto p-6 lg:p-8">
                                <Suspense fallback={null}>
                                    <SwapInterfaceContent />
                                </Suspense>
                            </div>
                        </div>
                    </div>

                    {/* Right Sidebar - Swap Information */}
                    <div className={`w-full max-w-sm sm:w-[420px] border-l border-white/[0.08] bg-black/20 backdrop-blur-sm flex-col z-50 ${
                        rightSidebarOpen ? 'fixed inset-y-0 right-0 flex' : 'hidden xl:flex'
                    }`}>
                        <div className="p-4 border-b border-white/[0.08]">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <div className="h-8 w-8 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path d="M9 12l2 2 4-4"></path>
                                            <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.37 0 4.52.92 6.11 2.42"></path>
                                        </svg>
                                    </div>
                                    <h2 className="text-sm font-semibold text-white/95">Swap Information</h2>
                                </div>
                                <button
                                    onClick={() => setRightSidebarOpen(false)}
                                    className="xl:hidden h-6 w-6 rounded text-white/60 hover:text-white/90 hover:bg-white/[0.1] transition-all duration-200 flex items-center justify-center"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            <SwapInformationSidebar />
                        </div>
                    </div>
                </div>
            </main>
            </div>
        </SwapTokensProvider>
    );
}
'use client';

import React from 'react';
import { useRouterTrading } from '@/hooks/useRouterTrading';
import { useSwapTokens } from '@/contexts/swap-tokens-context';
import TokenLogo from '@/components/TokenLogo';
import ErrorAlert from '@/components/swap-interface/error-alert';
import ValidationAlert from '@/components/swap-interface/validation-alert';
import { formatTokenAmount } from '@/lib/swap-utils';

export function SwapInformationSidebar() {
    const { quote, isLoadingQuote, totalPriceImpact, error } = useRouterTrading();
    const { selectedToToken, mode } = useSwapTokens();

    return (
        <div className="space-y-4">
            {/* Vault-level Isolation */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200">
                <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                        <svg className="w-5 h-5 text-white/90" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.37 0 4.52.92 6.11 2.42"/></svg>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-white/95">Your Funds Stay Safe</h3>
                        <p className="text-xs text-white/70 mt-1">Each trading pool is <strong className="text-white/85">completely isolated</strong>. If one pool has issues, your funds in other pools are protected.</p>
                    </div>
                </div>
            </div>

            {/* Automatic post-conditions */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200">
                <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                        <svg className="w-5 h-5 text-white/90" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2" ry="2"/><circle cx="12" cy="16" r="1"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-white/95">Built-in Trade Protection</h3>
                        <p className="text-xs text-white/70 mt-1">Every swap includes <strong className="text-white/85">automatic safety checks</strong> so you get exactly what you see in quotes.</p>
                    </div>
                </div>
            </div>

            {/* Unified LP Interface */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200">
                <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                        <svg className="w-5 h-5 text-white/90" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-white/95">Access All Markets</h3>
                        <p className="text-xs text-white/70 mt-1">Trade across <strong className="text-white/85">hundreds of token pairs</strong> from different exchanges, all in one simple interface.</p>
                    </div>
                </div>
            </div>

            {/* Live Market & Best-Path Routing */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200">
                <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                        <svg className="w-5 h-5 text-white/90" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="19" x2="12" y2="5"/>
                            <polyline points="5,12 12,5 19,12"/>
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-white/95">Best Prices Guaranteed</h3>
                        <p className="text-xs text-white/70 mt-1">We automatically find the <strong className="text-white/85">cheapest route</strong> across all available markets to get you the best deal.</p>
                    </div>
                </div>
            </div>

            {/* Gas Free Orders - only show in order mode */}
            {mode === 'order' && (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200">
                    <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                            <svg className="w-5 h-5 text-white/90" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 12h18l-3-3m0 6l3-3"/>
                                <path d="M14 7V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v4"/>
                                <path d="M8 12v8a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-8"/>
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-white/95">No Hidden Fees</h3>
                            <p className="text-xs text-white/70 mt-1">You only provide your tokens. <strong className="text-white/85">We cover all network fees</strong> when your trade executes.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Transaction Fees - only show in swap mode */}
            {mode === 'swap' && (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200">
                    <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                            <svg className="w-5 h-5 text-white/90" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                                <path d="M12 17h.01"/>
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-white/95">Small Network Fee</h3>
                            <p className="text-xs text-white/70 mt-1">Instant swaps cost about <strong className="text-white/85">~0.0001 STX</strong> in network fees that you pay.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Route Summary */}
            {quote && (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200">
                    <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                            <svg className="w-5 h-5 text-white/90" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-medium text-white/95">Your Trading Route</h3>
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

            {/* Trade Profit - only show when positive */}
            {totalPriceImpact && totalPriceImpact.priceImpact !== null && totalPriceImpact.priceImpact > 0 && (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200">
                    <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                            <svg className="w-5 h-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-medium text-white/95">Expected Profit</h3>
                            <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-white/70">Extra profit from this trade</span>
                                <span className={`text-xs font-medium ${
                                    totalPriceImpact.priceImpact > 0 ? 'text-green-400' : 'text-orange-400'
                                }`}>
                                    {totalPriceImpact.priceImpact > 0 ? '+' : ''}${Math.abs(totalPriceImpact.outputValueUsd - totalPriceImpact.inputValueUsd).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Minimum Guaranteed */}
            {quote && selectedToToken && (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200">
                    <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                            <svg className="w-5 h-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 12l2 2 4-4"></path>
                                <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.37 0 4.52.92 6.11 2.42"></path>
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-medium text-white/95">Guaranteed Amount</h3>
                            <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-white/70">Minimum you'll receive</span>
                                <span className="text-green-400 font-medium text-xs">
                                    {formatTokenAmount(Number(quote.amountOut * 0.99), selectedToToken.decimals || 0)} {selectedToToken.symbol}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Slippage Tolerance */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200">
                <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                        <svg className="w-5 h-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-medium text-white/95">Price Protection</h3>
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-white/70">Trade cancels if price moves more than</span>
                            <span className="text-blue-400 font-medium text-xs">1.0%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* High Price Impact Warning */}
            {totalPriceImpact && totalPriceImpact.priceImpact !== null && Math.abs(totalPriceImpact.priceImpact) > 20 && (
                <div className={`p-4 rounded-xl border backdrop-blur-sm ${
                    totalPriceImpact.priceImpact > 0 
                        ? 'bg-green-500/[0.08] border-green-500/[0.15]' 
                        : 'bg-yellow-500/[0.08] border-yellow-500/[0.15]'
                }`}>
                    <div className="flex items-center space-x-3">
                        <div className={`h-10 w-10 rounded-xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center flex-shrink-0 backdrop-blur-sm ${
                            totalPriceImpact.priceImpact > 0 ? 'text-green-400' : 'text-yellow-400'
                        }`}>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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

            {/* Validation Alert */}
            <ValidationAlert />
            
            {/* Error Alert */}
            <ErrorAlert />
        </div>
    );
}
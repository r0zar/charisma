'use client';

import React, { useState, useMemo } from 'react';
import { useRouterTrading } from '@/hooks/useRouterTrading';
import { useSwapTokens } from '@/contexts/swap-tokens-context';
import { useWallet } from '@/contexts/wallet-context';
import TokenLogo from '@/components/TokenLogo';
import { ArrowRight, Zap, TrendingUp, Shield, Clock, ChevronRight, Info } from 'lucide-react';
import { formatTokenAmount } from '@/lib/swap-utils';

export function RouteIntelligenceSidebar() {
    const {
        quote,
        isLoadingQuote,
        totalPriceImpact,
        securityLevel,
        postConditionsData,
        router,
        isLPToken,
        lpTokenInfo,
        burnSwapRoutes,
        isLoadingBurnSwapRoutes
    } = useRouterTrading();
    const { selectedFromToken, selectedToToken, displayAmount, mode, displayTokens, forceBurnSwap } = useSwapTokens();
    const { address: walletAddress } = useWallet();

    // Get actual token objects for LP token composition
    const lpTokens = useMemo(() => {
        if (!lpTokenInfo || !displayTokens) return { tokenA: null, tokenB: null };

        const tokenA = displayTokens.find(token => token.contractId === lpTokenInfo.tokenAContract);
        const tokenB = displayTokens.find(token => token.contractId === lpTokenInfo.tokenBContract);

        return { tokenA, tokenB };
    }, [lpTokenInfo, displayTokens]);

    const showRouteDetails = quote && !isLoadingQuote;

    const routeHops = quote?.path || [];
    const totalHops = routeHops.length - 1;

    // Check if burn-swap should be used (either more profitable OR forced by user)
    const isBurnSwapProfitable = useMemo(() => {
        if (!isLPToken || !burnSwapRoutes.tokenA && !burnSwapRoutes.tokenB || !quote) return false;

        const burnSwapTotal = Number(burnSwapRoutes.tokenA?.amountOut || burnSwapRoutes.tokenA?.expectedAmountOut || 0) +
            Number(burnSwapRoutes.tokenB?.amountOut || burnSwapRoutes.tokenB?.expectedAmountOut || 0);
        const regularQuoteAmount = Number(quote?.amountOut || quote?.expectedAmountOut || 0);

        return burnSwapTotal > regularQuoteAmount;
    }, [isLPToken, burnSwapRoutes, quote]);

    // Check if burn-swap should be shown (profitable OR forced)
    const shouldUseBurnSwap = useMemo(() => {
        const result = forceBurnSwap || isBurnSwapProfitable;
        console.log('Route Intelligence: shouldUseBurnSwap =', result, '(forceBurnSwap:', forceBurnSwap, ', isBurnSwapProfitable:', isBurnSwapProfitable, ')');
        return result;
    }, [forceBurnSwap, isBurnSwapProfitable]);

    return (
        <div className="space-y-4">
            {/* Router Information - Always show since it's mode-based */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 hover:bg-white/[0.05] transition-all duration-200">
                <div className="flex items-center space-x-2 mb-3">
                    <div className="h-6 w-6 rounded bg-purple-500/20 text-purple-400 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M8 2v4l-4-4 4-4z" />
                            <path d="M16 2v4l4-4-4-4z" />
                            <path d="M8 12v4l-4-4 4-4z" />
                            <path d="M16 12v4l4-4-4-4z" />
                        </svg>
                    </div>
                    <span className="text-sm font-semibold text-white/95">Router Details</span>
                </div>

                <div className="space-y-3">
                    <div>
                        <div className="text-xs text-white/60 mb-1">Router Name</div>
                        <div className="text-sm font-medium text-white/90">
                            {shouldUseBurnSwap && mode === 'swap'
                                ? 'Burn Swap Router'
                                : mode === 'swap'
                                    ? 'Multihop Router'
                                    : 'X-Multihop Subnet Router'
                            }
                        </div>
                        {shouldUseBurnSwap && mode === 'swap' && (
                            <div className="flex items-center space-x-1 mt-1">
                                <div className={`h-2 w-2 rounded-full ${isBurnSwapProfitable ? 'bg-green-400' : 'bg-purple-400'}`}></div>
                                <span className={`text-xs ${isBurnSwapProfitable ? 'text-green-400' : 'text-purple-400'}`}>
                                    {isBurnSwapProfitable ? 'Optimal Route Selected' : 'Forced Burn-Swap Active'}
                                </span>
                            </div>
                        )}
                    </div>

                    <div>
                        <div className="text-xs text-white/60 mb-1">Contract Address</div>
                        <div className="flex items-center space-x-2">
                            <span className="text-xs font-mono text-white/80 bg-white/[0.05] px-2 py-1 rounded">
                                {shouldUseBurnSwap && mode === 'swap'
                                    ? 'SP2ZNG...Z55KS.burn-swapper-rc2'
                                    : mode === 'swap'
                                        ? 'SP2ZNG...Z55KS.multihop'
                                        : 'SP2ZNG...Z55KS.x-multihop-rc9'
                                }
                            </span>
                            <div className="flex items-center space-x-1">
                                <button
                                    onClick={() => navigator.clipboard.writeText(
                                        shouldUseBurnSwap && mode === 'swap'
                                            ? 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.burn-swapper-rc2'
                                            : mode === 'swap'
                                                ? 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.multihop'
                                                : 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-rc9'
                                    )}
                                    className="h-6 w-6 rounded bg-white/[0.05] hover:bg-white/[0.1] text-white/60 hover:text-white/90 transition-all duration-200 flex items-center justify-center"
                                    title="Copy contract address"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                                    </svg>
                                </button>
                                <button
                                    onClick={() => window.open(
                                        `https://explorer.stacks.co/address/${shouldUseBurnSwap && mode === 'swap'
                                            ? 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.burn-swapper-rc2'
                                            : mode === 'swap'
                                                ? 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.multihop'
                                                : 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-rc9'
                                        }?chain=mainnet`, '_blank'
                                    )}
                                    className="h-6 w-6 rounded bg-white/[0.05] hover:bg-white/[0.1] text-white/60 hover:text-white/90 transition-all duration-200 flex items-center justify-center"
                                    title="View in explorer"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                        <polyline points="15,3 21,3 21,9"></polyline>
                                        <line x1="10" y1="14" x2="21" y2="3"></line>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="text-xs text-white/60 mb-1">Description</div>
                        <div className="text-xs text-white/70">
                            {shouldUseBurnSwap && mode === 'swap'
                                ? 'Advanced multihop router that burns LP tokens to underlying assets and routes them in dual paths to optimize for better rates. Supports 0-4 hop routing patterns.'
                                : mode === 'swap'
                                    ? 'Standard Stacks multihop router supporting up to 9 hops. Tokens move between your wallet and liquidity pools during each hop.'
                                    : 'Subnet-based multihop router supporting up to 5 hops with enhanced isolation. Tokens are withdrawn from subnet, swapped within the router contract, then transferred back to your wallet.'
                            }
                        </div>
                    </div>
                </div>
            </div>

            {/* Burn-Swap Routing - Show for LP tokens in swap mode when forced OR when routes available */}
            {isLPToken && mode === 'swap' && lpTokenInfo && (forceBurnSwap || (showRouteDetails && (isLoadingBurnSwapRoutes || burnSwapRoutes.tokenA || burnSwapRoutes.tokenB))) && (
                <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 hover:bg-white/[0.05] transition-all duration-200">
                    <div className="flex items-center space-x-2 mb-3">
                        <TrendingUp className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-semibold text-white/95">Burn-Swap Routing</span>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <div className="text-xs text-white/60 mb-2">Alternative Route</div>
                            <div className="flex flex-col space-y-2 text-sm">
                                {/* Step 1: Burn LP */}
                                <div className="flex items-center space-x-2">
                                    <span className="text-white/70 text-xs">1.</span>
                                    <span className="text-white/90">Burn</span>
                                    <div className="h-5 w-5 rounded flex-shrink-0 overflow-hidden bg-white/10">
                                        <TokenLogo token={selectedFromToken!} size="sm" />
                                    </div>
                                    <span className="font-medium text-white/90">{selectedFromToken?.symbol}</span>
                                </div>

                                {/* Step 2: Get underlying tokens */}
                                <div className="flex items-center space-x-2 ml-4">
                                    <span className="text-white/70 text-xs">2.</span>
                                    <span className="text-white/90">Get</span>
                                    <div className="h-4 w-4 rounded flex-shrink-0 overflow-hidden bg-white/10">
                                        <TokenLogo token={lpTokens.tokenA!} size="xs" />
                                    </div>
                                    <span className="text-blue-400 font-medium">{lpTokens.tokenA?.symbol || lpTokenInfo?.tokenA}</span>
                                    <span className="text-white/60">+</span>
                                    <div className="h-4 w-4 rounded flex-shrink-0 overflow-hidden bg-white/10">
                                        <TokenLogo token={lpTokens.tokenB!} size="xs" />
                                    </div>
                                    <span className="text-green-400 font-medium">{lpTokens.tokenB?.symbol || lpTokenInfo?.tokenB}</span>
                                </div>

                                {/* Step 3: Route to target */}
                                <div className="flex items-center space-x-2 ml-4">
                                    <span className="text-white/70 text-xs">3.</span>
                                    <span className="text-white/90">Route to</span>
                                    <div className="h-5 w-5 rounded flex-shrink-0 overflow-hidden bg-white/10">
                                        <TokenLogo token={selectedToToken} size="sm" />
                                    </div>
                                    <span className="font-medium text-white/90">{selectedToToken?.symbol || 'target'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Total Output Summary with Price Comparison */}
                        {(!isLoadingBurnSwapRoutes && (burnSwapRoutes.tokenA || burnSwapRoutes.tokenB)) || (forceBurnSwap && !isLoadingBurnSwapRoutes) ? (() => {
                            const burnSwapTotal = Number(burnSwapRoutes.tokenA?.amountOut || burnSwapRoutes.tokenA?.expectedAmountOut || 0) +
                                Number(burnSwapRoutes.tokenB?.amountOut || burnSwapRoutes.tokenB?.expectedAmountOut || 0);
                            const regularQuoteAmount = Number(quote?.amountOut || quote?.expectedAmountOut || 0);
                            const profit = burnSwapTotal - regularQuoteAmount;
                            const profitPercentage = regularQuoteAmount > 0 ? ((profit / regularQuoteAmount) * 100) : 0;
                            const isProfitable = profit > 0;
                            const hasRoutes = burnSwapRoutes.tokenA || burnSwapRoutes.tokenB;

                            return (
                                <div className={`bg-gradient-to-r ${isProfitable ? 'from-green-500/[0.08] to-blue-500/[0.08] border-green-500/[0.15]' : 'from-blue-500/[0.08] to-orange-500/[0.08] border-blue-500/[0.15]'} border rounded-lg p-3 mb-3`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-xs font-medium text-white/90">Burn-Swap Output</div>
                                        <div className="text-xs text-white/60">vs Regular Swap</div>
                                    </div>

                                    {/* Main Output Display */}
                                    <div className="flex items-center space-x-3 mb-3">
                                        <TokenLogo token={selectedToToken} size="md" />
                                        <div className="flex-1">
                                            <div className="text-lg font-bold text-white">
                                                {hasRoutes ? (
                                                    <>
                                                        {formatTokenAmount(burnSwapTotal, selectedToToken?.decimals || 6)} {selectedToToken?.symbol}
                                                    </>
                                                ) : (
                                                    <span className="text-white/50">Calculating routes...</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-white/60">
                                                {hasRoutes ? (
                                                    <>from burning {displayAmount || '0'} {selectedFromToken?.symbol}</>
                                                ) : (
                                                    <>Burn-swap routing forced - finding best paths</>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Price Comparison */}
                                    {hasRoutes ? (
                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                            <div className="bg-white/[0.03] rounded-lg p-2">
                                                <div className="text-white/50 mb-1">Regular Swap</div>
                                                <div className="text-white/90 font-medium">
                                                    {formatTokenAmount(regularQuoteAmount, selectedToToken?.decimals || 6)} {selectedToToken?.symbol}
                                                </div>
                                            </div>
                                            <div className={`rounded-lg p-2 ${isProfitable ? 'bg-green-500/[0.10]' : 'bg-orange-500/[0.10]'}`}>
                                                <div className="text-white/50 mb-1">Difference</div>
                                                <div className={`font-medium ${isProfitable ? 'text-green-400' : 'text-orange-400'}`}>
                                                    {isProfitable ? '+' : ''}{formatTokenAmount(Math.abs(profit), selectedToToken?.decimals || 6)} {selectedToToken?.symbol}
                                                </div>
                                                <div className={`text-xs ${isProfitable ? 'text-green-400/70' : 'text-orange-400/70'}`}>
                                                    {isProfitable ? '+' : ''}{profitPercentage.toFixed(2)}%
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-white/[0.03] rounded-lg p-3 text-center">
                                            <div className="text-white/50 text-xs">
                                                Routes calculation in progress...
                                            </div>
                                        </div>
                                    )}

                                    {/* Profit/Loss Indicator */}
                                    <div className={`mt-2 p-2 rounded-lg ${hasRoutes ? (isProfitable ? 'bg-green-500/[0.05] border border-green-500/[0.15]' : forceBurnSwap ? 'bg-purple-500/[0.05] border border-purple-500/[0.15]' : 'bg-orange-500/[0.05] border border-orange-500/[0.15]') : 'bg-purple-500/[0.05] border border-purple-500/[0.15]'}`}>
                                        <div className={`text-xs font-medium ${hasRoutes ? (isProfitable ? 'text-green-400' : forceBurnSwap ? 'text-purple-400' : 'text-orange-400') : 'text-purple-400'}`}>
                                            {hasRoutes ? (
                                                <>
                                                    {isProfitable ? '✓ ' : forceBurnSwap ? '🔥 ' : '⚠ '}
                                                    {isProfitable
                                                        ? `Burn-swap is ${profitPercentage.toFixed(2)}% more profitable`
                                                        : forceBurnSwap
                                                            ? `Burn-swap forced (${Math.abs(profitPercentage).toFixed(2)}% less profitable)`
                                                            : `Regular swap is ${Math.abs(profitPercentage).toFixed(2)}% better`
                                                    }
                                                </>
                                            ) : (
                                                <>
                                                    🔥 Burn-swap routing forced - calculating profitability...
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })() : null}

                        {/* Best Routes Found */}
                        <div>
                            <div className="text-xs font-medium text-white/90 mb-2">
                                {isLoadingBurnSwapRoutes ? 'Finding Best Routes...' : 'Route Breakdown'}
                            </div>

                            {isLoadingBurnSwapRoutes ? (
                                <div className="space-y-2">
                                    {[1, 2].map((i) => (
                                        <div key={i} className="flex items-center space-x-2 p-2 bg-white/[0.02] rounded animate-pulse">
                                            <div className="h-3 w-3 bg-blue-400/50 rounded-full" />
                                            <div className="h-3 bg-white/[0.1] rounded flex-1" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {/* Token A Route */}
                                    {burnSwapRoutes.tokenA ? (
                                        <div className="flex items-start space-x-3 p-3 rounded-lg bg-blue-500/[0.05] border border-blue-500/[0.15]">
                                            <div className="h-6 w-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                                                A
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center space-x-2 mb-1">
                                                    <TokenLogo token={selectedToToken} size="sm" />
                                                    <span className="text-xs font-medium text-white/90">
                                                        {formatTokenAmount(Number(burnSwapRoutes.tokenA.amountOut || burnSwapRoutes.tokenA.expectedAmountOut || 0), selectedToToken?.decimals || 6)} {selectedToToken?.symbol}
                                                    </span>
                                                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                                                        {burnSwapRoutes.tokenA.hops?.hops?.length || 0}-hop
                                                    </span>
                                                </div>
                                                <div className="text-xs text-blue-300 mb-1">
                                                    {lpTokens.tokenA?.symbol || lpTokenInfo?.tokenA} → {selectedToToken?.symbol}
                                                </div>
                                                {burnSwapRoutes.tokenA.hops?.hops && burnSwapRoutes.tokenA.hops.hops.length > 0 && (
                                                    <div className="text-xs text-blue-400/60">
                                                        via {burnSwapRoutes.tokenA.hops.hops.map((hop: any) => hop.vault?.name || 'Pool').join(' → ')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-start space-x-3 p-3 rounded-lg bg-red-500/[0.05] border border-red-500/[0.15]">
                                            <div className="h-6 w-6 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                                                A
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-xs text-red-400">
                                                    No route found for {lpTokens.tokenA?.symbol || lpTokenInfo?.tokenA} → {selectedToToken?.symbol}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Token B Route */}
                                    {burnSwapRoutes.tokenB ? (
                                        <div className="flex items-start space-x-3 p-3 rounded-lg bg-green-500/[0.05] border border-green-500/[0.15]">
                                            <div className="h-6 w-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                                                B
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center space-x-2 mb-1">
                                                    <TokenLogo token={selectedToToken} size="sm" />
                                                    <span className="text-xs font-medium text-white/90">
                                                        {formatTokenAmount(Number(burnSwapRoutes.tokenB.amountOut || burnSwapRoutes.tokenB.expectedAmountOut || 0), selectedToToken?.decimals || 6)} {selectedToToken?.symbol}
                                                    </span>
                                                    <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                                                        {burnSwapRoutes.tokenB.hops?.hops?.length || 0}-hop
                                                    </span>
                                                </div>
                                                <div className="text-xs text-green-300 mb-1">
                                                    {lpTokens.tokenB?.symbol || lpTokenInfo?.tokenB} → {selectedToToken?.symbol}
                                                </div>
                                                {burnSwapRoutes.tokenB.hops?.hops && burnSwapRoutes.tokenB.hops.hops.length > 0 && (
                                                    <div className="text-xs text-green-400/60">
                                                        via {burnSwapRoutes.tokenB.hops.hops.map((hop: any) => hop.vault?.name || 'Pool').join(' → ')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-start space-x-3 p-3 rounded-lg bg-red-500/[0.05] border border-red-500/[0.15]">
                                            <div className="h-6 w-6 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                                                B
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-xs text-red-400">
                                                    No route found for {lpTokens.tokenB?.symbol || lpTokenInfo?.tokenB} → {selectedToToken?.symbol}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Information Box */}
                        <div className="flex items-center space-x-2 p-2 bg-blue-500/10 rounded-lg">
                            <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
                            <div className="text-xs text-blue-400">
                                Burn-swap may offer better rates by accessing underlying liquidity directly.
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading State - Show when analyzing routes */}
            {!showRouteDetails && (
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
            )}

            {/* Route Overview - Only show when route details are available and burn-swap is not being used */}
            {showRouteDetails && !shouldUseBurnSwap && (
                <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 hover:bg-white/[0.05] transition-all duration-200">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                            <Zap className="w-4 h-4 text-blue-400" />
                            <span className="text-sm font-semibold text-white/95">Route Overview</span>
                        </div>
                        <div className={`px-2 py-1 rounded-md text-xs font-medium ${securityLevel === 'high' ? 'bg-green-500/20 text-green-400' :
                            securityLevel === 'medium' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-purple-500/20 text-purple-400'
                            }`}>
                            {securityLevel === 'high' ? 'DIRECT' :
                                securityLevel === 'medium' ? 'OPTIMIZED' :
                                    'ADVANCED'}
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
                                <span className={`font-medium ${totalPriceImpact.priceImpact > 0 ? 'text-green-400' : 'text-red-400'
                                    }`}>
                                    {totalPriceImpact.priceImpact > 0 ? '+' : ''}{totalPriceImpact.priceImpact.toFixed(2)}%
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Post Conditions - Only show when route details are available and burn-swap is not being used */}
            {showRouteDetails && postConditionsData && !shouldUseBurnSwap && (
                <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 hover:bg-white/[0.05] transition-all duration-200">
                    <div className="flex items-center space-x-2 mb-4">
                        <Shield className="w-4 h-4 text-green-400" />
                        <span className="text-sm font-semibold text-white/95">Transaction Safety</span>
                    </div>

                    <div className="space-y-3">
                        {postConditionsData.operations.map((operation, index) => {
                            if (operation.category === 'send') {
                                return (
                                    <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-orange-500/[0.05] border border-orange-500/[0.15]">
                                        <div className="h-6 w-6 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center flex-shrink-0">
                                            <ArrowRight className="w-3 h-3" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-2 mb-1">
                                                <TokenLogo token={operation.token} size="sm" />
                                                <span className="text-xs font-medium text-white/90">
                                                    {formatTokenAmount(Number(operation.amount), operation.token?.decimals || 0)} {operation.token?.symbol}
                                                </span>
                                                <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">=</span>
                                            </div>
                                            <div className="text-xs text-orange-300">{operation.description}</div>
                                        </div>
                                    </div>
                                );
                            }

                            if (operation.category === 'receive') {
                                return (
                                    <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-green-500/[0.05] border border-green-500/[0.15]">
                                        <div className="h-6 w-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center flex-shrink-0">
                                            <ArrowRight className="w-3 h-3 rotate-180" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-2 mb-1">
                                                <TokenLogo token={operation.token} size="sm" />
                                                <span className="text-xs font-medium text-white/90">
                                                    {formatTokenAmount(Number(operation.amount), operation.token?.decimals || 0)} {operation.token?.symbol}
                                                </span>
                                                <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">≥</span>
                                            </div>
                                            <div className="text-xs text-green-300">{operation.description}</div>
                                        </div>
                                    </div>
                                );
                            }

                            if (operation.category === 'subnet-security') {
                                return (
                                    <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-purple-500/[0.05] border border-purple-500/[0.15]">
                                        <div className="h-6 w-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center flex-shrink-0">
                                            <Shield className="w-3 h-3" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-xs font-medium text-purple-300 mb-1">Subnet Isolation</div>
                                            <div className="text-xs text-purple-300">{operation.description}</div>
                                        </div>
                                    </div>
                                );
                            }

                            if (operation.category === 'security') {
                                return (
                                    <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-blue-500/[0.05] border border-blue-500/[0.15]">
                                        <div className="h-6 w-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                                            <Shield className="w-3 h-3" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-xs font-medium text-blue-300 mb-1">Protected</div>
                                            <div className="text-xs text-blue-300">{operation.description}</div>
                                        </div>
                                    </div>
                                );
                            }

                            return null;
                        })}
                    </div>
                </div>
            )}

            {/* Route Analysis - Only show when route details are available and burn-swap is not being used */}
            {showRouteDetails && quote?.hops && quote.hops.length > 0 && !shouldUseBurnSwap && (
                <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 hover:bg-white/[0.05] transition-all duration-200">
                    <div className="flex items-center space-x-2 mb-4">
                        <Clock className="w-4 h-4 text-orange-400" />
                        <span className="text-sm font-semibold text-white/95">Liquidity Pools</span>
                    </div>

                    <div className="space-y-2">
                        {quote?.hops?.map((hop, index) => (
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
        </div>
    );
}
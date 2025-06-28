'use client';

import React from 'react';
import { useRouterTrading } from '@/hooks/useRouterTrading';
import { useSwapTokens } from '@/contexts/swap-tokens-context';
import { useWallet } from '@/contexts/wallet-context';
import TokenLogo from '@/components/TokenLogo';
import { ArrowRight, Zap, TrendingUp, Shield, Clock } from 'lucide-react';
import { formatTokenAmount } from '@/lib/swap-utils';

export function RouteIntelligenceSidebar() {
    const { quote, isLoadingQuote, totalPriceImpact, securityLevel, postConditionsData, router } = useRouterTrading();
    const { selectedFromToken, selectedToToken, displayAmount, mode } = useSwapTokens();
    const { address: walletAddress } = useWallet();

    const showRouteDetails = quote && !isLoadingQuote;

    const routeHops = quote?.path || [];
    const totalHops = routeHops.length - 1;

    return (
        <div className="space-y-4">
            {/* Router Information - Always show since it's mode-based */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 hover:bg-white/[0.05] transition-all duration-200">
                <div className="flex items-center space-x-2 mb-3">
                    <div className="h-6 w-6 rounded bg-purple-500/20 text-purple-400 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M8 2v4l-4-4 4-4z"/>
                            <path d="M16 2v4l4-4-4-4z"/>
                            <path d="M8 12v4l-4-4 4-4z"/>
                            <path d="M16 12v4l4-4-4-4z"/>
                        </svg>
                    </div>
                    <span className="text-sm font-semibold text-white/95">Router Details</span>
                </div>
                
                <div className="space-y-3">
                    <div>
                        <div className="text-xs text-white/60 mb-1">Router Name</div>
                        <div className="text-sm font-medium text-white/90">
                            {mode === 'swap' ? 'Multihop Router' : 'X-Multihop Subnet Router'}
                        </div>
                    </div>
                    
                    <div>
                        <div className="text-xs text-white/60 mb-1">Contract Address</div>
                        <div className="flex items-center space-x-2">
                            <span className="text-xs font-mono text-white/80 bg-white/[0.05] px-2 py-1 rounded">
                                {mode === 'swap' 
                                    ? 'SP2ZNG...Z55KS.multihop'
                                    : 'SP2ZNG...Z55KS.x-multihop-rc9'
                                }
                            </span>
                            <div className="flex items-center space-x-1">
                                <button
                                    onClick={() => navigator.clipboard.writeText(
                                        mode === 'swap' 
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
                                        `https://explorer.stacks.co/address/${mode === 'swap' 
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
                            {mode === 'swap' 
                                ? 'Standard Stacks multihop router supporting up to 9 hops. Tokens move between your wallet and liquidity pools during each hop.'
                                : 'Subnet-based multihop router supporting up to 5 hops with enhanced isolation. Tokens are withdrawn from subnet, swapped within the router contract, then transferred back to your wallet.'
                            }
                        </div>
                    </div>
                </div>
            </div>

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

            {/* Route Overview - Only show when route details are available */}
            {showRouteDetails && (
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
                            <span className={`font-medium ${
                                (totalPriceImpact.priceImpact || 0) > 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                                {(totalPriceImpact.priceImpact || 0) > 0 ? '+' : ''}{(totalPriceImpact.priceImpact || 0).toFixed(2)}%
                            </span>
                        </div>
                    )}
                </div>
            </div>
            )}

            {/* Post Conditions - Only show when route details are available */}
            {showRouteDetails && postConditionsData && (
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
                                                <TokenLogo token={operation.token!} size="sm" />
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
                                                <TokenLogo token={operation.token!} size="sm" />
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

            {/* Route Analysis - Only show when route details are available */}
            {showRouteDetails && quote?.hops && quote.hops.length > 0 && (
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
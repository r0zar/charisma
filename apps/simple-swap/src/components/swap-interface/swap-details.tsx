"use client";

import React, { useState } from 'react';
import TokenLogo from '../TokenLogo';
import Image from 'next/image';
import { Hop } from 'dexterity-sdk';
import { TokenCacheData } from '@/lib/contract-registry-adapter';
import { Info, DollarSign } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { useRouterTrading } from '@/hooks/useRouterTrading';
import { useSwapTokens } from '@/contexts/swap-tokens-context';
import { formatTokenAmount, formatCompactNumber } from '@/lib/swap-utils';
import { usePrices } from '@/contexts/token-price-context';
import { formatPriceUSD } from '@/lib/utils';

// Pool image with fallback for LP vaults
function PoolImageWithFallback({ src, alt }: { src?: string; alt?: string }) {
    const [imgError, setImgError] = React.useState(false);
    if (!imgError && src) {
        return (
            <Image
                className="rounded-md"
                src={src}
                alt={alt || ''}
                width={32}
                height={32}
                onError={() => setImgError(true)}
            />
        );
    } else {
        return (
            <div className="w-8 h-8 flex items-center justify-center bg-muted text-foreground/60 font-bold text-xs uppercase select-none rounded-md">
                {alt?.substring(0, 2) || '?'}
            </div>
        );
    }
}

interface SwapDetailsProps {
    compact?: boolean;
}

export default function SwapDetails({ compact = false }: SwapDetailsProps) {
    const [showDetails, setShowDetails] = useState(false);
    const [showRouteDetails, setShowRouteDetails] = useState(true);

    // Get swap state from context
    const {
        quote,
        isLoadingQuote,
        totalPriceImpact,
        priceImpacts,
        securityLevel,
    } = useRouterTrading();

    const {
        selectedToToken,
        displayAmount,
    } = useSwapTokens();


    const { getPrice } = usePrices();


    // Determine if this is a subnet shift operation by checking for SUBLINK vault type
    const isSubnetShift = quote?.hops.some((hop: Hop) => hop.vault.type === 'SUBLINK');

    // Detect if both from and to tokens are subnet tokens using type property
    const isFromSubnet = quote?.path[0]?.type === 'SUBNET';
    const isToSubnet = quote?.path[quote.path.length - 1]?.type === 'SUBNET';
    const isSubnetToSubnet = isFromSubnet && isToSubnet;

    // Get the direction of the shift (to or from subnet)
    const getShiftDirection = () => {
        if (!isSubnetShift || !quote) return null;
        const destinationToken = quote.path[quote.path.length - 1];
        return destinationToken.type === 'SUBNET' ? 'to-subnet' : 'from-subnet';
    };

    const shiftDirection = getShiftDirection();

    // For clearer UI terminology
    let operationType: string;
    if (isSubnetToSubnet) {
        operationType = 'Subnet Swap';
    } else if (isSubnetShift) {
        operationType = shiftDirection === 'to-subnet' ? 'Deposit' : 'Withdraw';
    } else {
        operationType = 'Swap';
    }

    // Show high price impact warning if needed
    const impactValue = totalPriceImpact && totalPriceImpact.priceImpact !== null ? totalPriceImpact.priceImpact : null;
    const showHighImpactWarning = impactValue && (impactValue > 20 || impactValue < -20);

    // Don't show anything if no quote and not loading
    if (!quote && !isLoadingQuote) {
        return null;
    }

    // Show loading state if loading
    if (isLoadingQuote) {
        if (compact) {
            return (
                <div className="flex items-center justify-center py-8">
                    <div className="flex items-center space-x-3">
                        <div className="w-5 h-5 border border-white/[0.3] border-t-blue-400 rounded-full animate-spin"></div>
                        <p className="text-white/60 text-sm">Finding best route...</p>
                    </div>
                </div>
            );
        }
        return (
            <div className="flex items-center justify-center h-[400px] bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <div className="flex flex-col items-center space-y-4">
                    <div className="relative">
                        <div className="w-12 h-12 border-2 border-white/[0.1] border-t-blue-400 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 w-12 h-12 border-2 border-transparent border-t-purple-400 rounded-full animate-spin-reverse animation-delay-150"></div>
                    </div>
                    <p className="text-white/70 text-sm">Analyzing optimal route...</p>
                </div>
            </div>
        );
    }

    // Compact version for main interface
    if (compact) {
        return (
            <div className="space-y-3">
                {/* High price impact warning */}
                {showHighImpactWarning && impactValue !== null && (
                    <div className={`flex items-center p-3 rounded-lg text-xs ${
                        impactValue > 0 
                            ? 'bg-green-500/[0.08] border border-green-500/[0.15] text-green-400' 
                            : 'bg-yellow-500/[0.08] border border-yellow-500/[0.15] text-yellow-400'
                    }`}>
                        <svg className="h-4 w-4 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">
                            {impactValue > 0 ? 'Positive price impact!' : 'High price impact warning'}
                        </span>
                    </div>
                )}

                {/* Quick Route Summary */}
                <div className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg">
                    <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-1">
                            {quote?.path.slice(0, 3).map((token: TokenCacheData, index: number) => (
                                <React.Fragment key={token.contractId || index}>
                                    <TokenLogo token={token} size="sm" />
                                    {index < Math.min((quote?.path.length || 0) - 1, 2) && (
                                        <svg className="h-3 w-3 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    )}
                                </React.Fragment>
                            ))}
                            {(quote?.path.length || 0) > 3 && <span className="text-xs text-white/60">+{(quote?.path.length || 0) - 3}</span>}
                        </div>
                        <div className="text-xs text-white/70">
                            {(quote?.path.length || 0) - 1} {(quote?.path.length || 0) - 1 === 1 ? 'hop' : 'hops'}
                        </div>
                    </div>
                    <div className="flex items-center space-x-2 text-xs">
                        {totalPriceImpact && totalPriceImpact.priceImpact !== null && (
                            <span className={`px-2 py-1 rounded ${
                                totalPriceImpact.priceImpact > 0 ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
                            }`}>
                                {totalPriceImpact.priceImpact > 0 ? '+' : ''}{totalPriceImpact.priceImpact.toFixed(2)}%
                            </span>
                        )}
                        <div className={`h-2 w-2 rounded-full ${
                            securityLevel === 'high' ? 'bg-green-400' : 
                            securityLevel === 'medium' ? 'bg-blue-400' : 'bg-purple-400'
                        }`}></div>
                    </div>
                </div>

                {/* Quick guarantee info */}
                {quote && selectedToToken && (
                    <div className="flex items-center justify-between text-xs p-3 bg-green-500/[0.05] border border-green-500/[0.1] rounded-lg">
                        <span className="text-white/70">Minimum guaranteed:</span>
                        <span className="text-green-400 font-medium">
                            {formatTokenAmount(Number(quote.amountOut * 0.99), selectedToToken.decimals || 0)} {selectedToToken.symbol}
                        </span>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* High price impact warning */}
            {showHighImpactWarning && impactValue !== null && (
                <div className={`flex items-center p-4 rounded-xl border animate-[appear_0.3s_ease-out] ${
                    impactValue > 0 
                        ? 'bg-green-500/[0.08] border border-green-500/[0.15] text-green-400' 
                        : 'bg-yellow-500/[0.08] border border-yellow-500/[0.15] text-yellow-400'
                }`}>
                    {impactValue > 0 ? (
                        <DollarSign className="h-5 w-5 mr-3 flex-shrink-0" />
                    ) : (
                        <svg className="h-5 w-5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    )}
                    <div className="flex-1">
                        <span className="font-medium">
                            {impactValue > 0
                                ? 'Notice: You are receiving significantly more than expected!'
                                : 'Warning: You are receiving significantly less than expected!'}
                        </span>
                        <PriceImpactWizardDialog />
                    </div>
                </div>
            )}

            {/* Route Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* Route Efficiency */}
                <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                                securityLevel === 'high' ? 'bg-green-500/20 text-green-400' :
                                securityLevel === 'medium' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                            }`}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                                </svg>
                            </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                            securityLevel === 'high' ? 'bg-green-500/10 text-green-400' :
                            securityLevel === 'medium' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
                        }`}>
                            {securityLevel === 'high' ? 'Optimal' : securityLevel === 'medium' ? 'Good' : 'Complex'}
                        </span>
                    </div>
                    <div className="text-sm text-white/90 font-medium">Route Efficiency</div>
                    <div className="text-xs text-white/60 mt-1">
                        {isSubnetShift
                            ? (shiftDirection === 'to-subnet' ? 'Deposit to subnet' : 'Withdraw from suburb')
                            : (securityLevel === 'high' ? 'Direct route' : securityLevel === 'medium' ? 'Optimized path' : 'Smart routing')
                        }
                    </div>
                </div>

                {/* Hops Count */}
                <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-2">
                        <div className="h-8 w-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                        <span className="text-lg font-semibold text-white/90">
                            {(quote?.path.length || 0) - 1}
                        </span>
                    </div>
                    <div className="text-sm text-white/90 font-medium">Network Hops</div>
                    <div className="text-xs text-white/60 mt-1">
                        {(quote?.path.length || 0) - 1 === 1 ? 'Single hop route' : `Multi-hop via ${(quote?.path.length || 0) - 2} pools`}
                    </div>
                </div>

                {/* Price Impact */}
                {totalPriceImpact && totalPriceImpact.priceImpact !== null && (
                    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-2">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                                totalPriceImpact.priceImpact > 0 ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
                            }`}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path d="M12 2v20M2 12h20" />
                                </svg>
                            </div>
                            <span className={`text-lg font-semibold ${
                                totalPriceImpact.priceImpact > 0 ? 'text-green-400' : 'text-orange-400'
                            }`}>
                                {totalPriceImpact.priceImpact > 0 ? '+' : ''}{totalPriceImpact.priceImpact.toFixed(2)}%
                            </span>
                        </div>
                        <div className="text-sm text-white/90 font-medium">Price Impact</div>
                        <div className="text-xs text-white/60 mt-1">
                            {formatPriceUSD(totalPriceImpact.inputValueUsd)} → {formatPriceUSD(totalPriceImpact.outputValueUsd)}
                        </div>
                    </div>
                )}
            </div>

            {/* Network Flow Visualization Toggle */}
            <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200 backdrop-blur-sm mb-4"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                                <line x1="12" y1="22.08" x2="12" y2="12"></line>
                            </svg>
                        </div>
                        <div className="text-left">
                            <div className="text-sm font-medium text-white/95">Network Flow Analysis</div>
                            <div className="text-xs text-white/60">
                                {showDetails ? 'Hide detailed route breakdown' : 'View detailed route breakdown'}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center space-x-3">
                        {/* Token flow preview */}
                        <div className="hidden sm:flex items-center space-x-1">
                            {quote?.path.slice(0, 4).map((token: TokenCacheData, index: number) => (
                                <React.Fragment key={token.contractId || index}>
                                    <TokenLogo token={token} size="sm" />
                                    {index < Math.min((quote?.path.length || 0) - 1, 3) && (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                        </svg>
                                    )}
                                </React.Fragment>
                            ))}
                            {(quote?.path.length || 0) > 4 && <span className="text-xs text-white/60">+{(quote?.path.length || 0) - 4}</span>}
                        </div>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className={`h-5 w-5 text-white/70 transition-transform duration-300 ${showDetails ? 'rotate-180' : ''}`}
                            viewBox="0 0 20 20"
                            fill="currentColor"
                        >
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </div>
                </div>
            </button>

            {showDetails && (
                <div className="bg-white/[0.01] border border-white/[0.06] rounded-xl p-6 animate-[slideDown_0.2s_ease-out] space-y-6">
                    
                    {/* Transaction Guarantee */}
                    {quote && selectedToToken && (
                        <div className="bg-white/[0.03] border border-green-500/[0.15] rounded-xl p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="h-10 w-10 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center">
                                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M9 12l2 2 4-4"></path>
                                            <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.37 0 4.52.92 6.11 2.42"></path>
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-white/95">Transaction Guarantee</div>
                                        <div className="text-xs text-white/70">Minimum amount protected by blockchain postconditions</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-medium text-green-400">
                                        {formatTokenAmount(Number(quote.amountOut * 0.99), selectedToToken.decimals || 0)} {selectedToToken.symbol}
                                    </div>
                                    <div className="text-xs text-white/60">
                                        {isSubnetToSubnet ? 'Min. swapped' : isSubnetShift ? `Min. ${operationType.toLowerCase()}ed` : 'Min. received'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Path/Route visualization with price impacts */}
                    {quote && (
                        <div className="flex flex-col pt-3 border-t border-white/[0.08]">
                            <button
                                onClick={() => setShowRouteDetails(!showRouteDetails)}
                                className="flex items-center justify-between w-full"
                            >
                                <span className="text-muted-foreground flex items-center">
                                    <svg className="h-4 w-4 mr-1.5 text-primary/70" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="9 18 15 12 9 6"></polyline>
                                    </svg>
                                    {isSubnetToSubnet
                                        ? 'Subnet swap route'
                                        : isSubnetShift
                                            ? `${operationType} route`
                                            : 'Route details'} ({quote.path.length - 1} {quote.path.length - 1 === 1 ? 'hop' : 'hops'})
                                </span>
                                <div className="flex items-center gap-1">
                                    {quote && quote.path.length > 0 && (
                                        <div className="flex items-center space-x-0.5">
                                            {quote.path.map((token: TokenCacheData, index: number) => (
                                                <React.Fragment key={token.contractId || index}>
                                                    <TokenLogo token={token} size="sm" />
                                                    {index < quote.path.length - 1 && (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-muted-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                                        </svg>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    )}
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className={`h-4 w-4 text-primary/70 transition-transform duration-200 ${showRouteDetails ? 'rotate-180' : ''}`}
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                    >
                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            </button>

                            {showRouteDetails && (
                                <div className="flex flex-col space-y-2 mt-3 animate-[slideDown_0.2s_ease-out]">
                                    {/* Starting token with USD value */}
                                    <div className="bg-white/[0.03] rounded-xl p-3 sm:p-3.5 border border-white/[0.08]">
                                        <div className="flex items-center mb-2">
                                            <TokenLogo token={quote.path[0]} size="lg" />
                                            <div className="ml-2 sm:ml-2.5">
                                                <div className="font-medium text-sm sm:text-base">
                                                    {quote.path[0].symbol}
                                                    <span className="font-normal ml-1 text-xs text-muted-foreground">
                                                        ({formatCompactNumber(Number(displayAmount))})
                                                    </span>
                                                </div>
                                                <div className="text-xs text-muted-foreground flex items-center">
                                                    <span>Start</span>
                                                    {(() => {
                                                        const price = getPrice(quote.path[0].contractId);
                                                        return price && (
                                                            <span className="ml-1">
                                                                ~{formatPriceUSD(Number(displayAmount) * price)}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Hops with price impact */}
                                    {quote.hops.map((hop: Hop, idx: number) => {
                                        const fromToken = quote.path[idx];
                                        const toToken = quote.path[idx + 1];
                                        const vaultName = hop.vault.name || 'Liquidity Pool';
                                        const formattedFee = (hop.vault.fee / 10000).toFixed(2);
                                        const priceImpact = priceImpacts[idx];

                                        // Check if this hop is a subnet shift
                                        const isSubnetShiftHop = hop.vault.type === 'SUBLINK';

                                        return (
                                            <div key={`hop-${idx}`} className="flex flex-col">
                                                {/* Arrow connecting nodes */}
                                                <div className="h-6 flex justify-center items-center">
                                                    <div className="h-full border-l-2 border-dashed border-primary/30"></div>
                                                </div>

                                                {/* Pool node with price impact */}
                                                <div className={`bg-white/[0.02] rounded-xl p-3 sm:p-3.5 border ${isSubnetShiftHop ?
                                                    'border-purple-500/30 border-dashed bg-purple-500/5' :
                                                    'border-white/[0.06] border-dashed'
                                                    }`}>
                                                    <div className="flex items-center mb-2">
                                                        <div className={`h-7 w-7 sm:h-8 sm:w-8 rounded-md flex items-center justify-center ${isSubnetShiftHop ? 'bg-purple-500/20' : 'bg-primary/20'}`}>
                                                            <PoolImageWithFallback src={hop.vault.image} alt={vaultName} />
                                                        </div>
                                                        <div className="ml-2 sm:ml-2.5 flex items-center w-full">
                                                            <div className="flex-1">
                                                                <div className="font-medium text-sm sm:text-base">
                                                                    {vaultName}
                                                                </div>
                                                                <div className="text-xs text-white/60">
                                                                    {hop.vault.fee === 0 ? 'No Fee' : `${formattedFee}% fee`}
                                                                </div>
                                                            </div>
                                                            {/* Add Liquidity button for non-subnet hops */}
                                                            {!isSubnetShiftHop && hop.vault.tokenA && hop.vault.tokenB && (
                                                                <a
                                                                    href={`https://invest.charisma.rocks/pools?tokenA=${encodeURIComponent(hop.vault.tokenA.contractId)}&tokenB=${encodeURIComponent(hop.vault.tokenB.contractId)}#add`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-xs px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/90 hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-200 backdrop-blur-sm flex items-center gap-1 ml-2 flex-shrink-0"
                                                                    title="Add liquidity to this pool"
                                                                >
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
                                                                    Add Liquidity
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-2 gap-y-1 sm:justify-between text-xs mt-1 text-muted-foreground">
                                                        <div className="flex items-center whitespace-nowrap">
                                                            <TokenLogo token={fromToken} size="sm" className="mr-1" />
                                                            <span className="font-medium text-foreground/90">{fromToken.symbol}</span>
                                                            <span className="ml-1 text-xs text-muted-foreground">
                                                                {idx === 0 ? `(${formatCompactNumber(Number(displayAmount))})` : `(${formatCompactNumber(Number(hop.quote?.amountIn) / (10 ** (fromToken.decimals || 6)))})`}
                                                            </span>
                                                            {/* Add USD value */}
                                                            {priceImpact && priceImpact.fromValueUsd !== null && (
                                                                <span className="ml-1">~{formatPriceUSD(priceImpact.fromValueUsd)}</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center whitespace-nowrap">
                                                            <TokenLogo token={toToken} size="sm" className="mr-1" />
                                                            <span className="font-medium text-foreground/90">{toToken.symbol}</span>
                                                            <span className="ml-1 text-xs text-muted-foreground">
                                                                {`(${formatCompactNumber(Number(hop.quote?.amountOut) / (10 ** (toToken.decimals || 6)))})`}
                                                            </span>
                                                            {/* Add USD value */}
                                                            {priceImpact && priceImpact.toValueUsd !== null && (
                                                                <span className="ml-1">~{formatPriceUSD(priceImpact.toValueUsd)}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Arrow connecting nodes */}
                                                <div className="h-6 flex justify-center items-center">
                                                    <div className="h-full border-l-2 border-dashed border-primary/30"></div>
                                                </div>

                                                {/* Only show intermediate tokens (not the final destination) */}
                                                {idx < quote.hops.length - 1 && (
                                                    <div className="bg-white/[0.03] rounded-xl p-3 sm:p-3.5 border border-white/[0.08]">
                                                        <div className="flex items-center">
                                                            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-background shadow-sm border border-border/50 flex items-center justify-center overflow-hidden">
                                                                <TokenLogo token={toToken} size="lg" />
                                                            </div>
                                                            <div className="ml-2 sm:ml-2.5">
                                                                <div className="font-medium text-sm sm:text-base">{toToken.symbol}</div>
                                                                <div className="text-xs text-muted-foreground flex items-center">
                                                                    <span>Intermediate</span>
                                                                    {(() => {
                                                                        const price = getPrice(toToken.contractId);
                                                                        return price && (
                                                                            <span className="ml-1">
                                                                                ~{formatPriceUSD(Number(hop.quote?.amountOut) * price / (10 ** (toToken.decimals || 6)))}
                                                                            </span>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* Final token with USD value */}
                                    <div className={`rounded-xl p-2.5 sm:p-3.5 border ${isSubnetShift ?
                                        'bg-white/[0.03] border border-purple-500/[0.15]' :
                                        'bg-white/[0.03] border border-green-500/[0.15]'
                                        }`}>
                                        <div className="flex items-center">
                                            <TokenLogo token={quote.path[quote.path.length - 1]} size="lg" />
                                            <div className="ml-2 sm:ml-2.5">
                                                <div className="font-medium text-xs sm:text-base">
                                                    {quote.path[quote.path.length - 1].symbol}
                                                    <span className="font-normal ml-1 text-xs text-muted-foreground">
                                                        ({formatTokenAmount(Number(quote.amountOut), quote.path[quote.path.length - 1].decimals || 6)})
                                                    </span>
                                                </div>
                                                <div className="flex items-center">
                                                    <span className={`text-xs ${isSubnetToSubnet
                                                        ? 'text-purple-600 dark:text-purple-400'
                                                        : isSubnetShift
                                                            ? 'text-purple-600 dark:text-purple-400'
                                                            : 'text-green-600 dark:text-green-400'
                                                        }`}>
                                                        {isSubnetToSubnet
                                                            ? 'Subnet Destination'
                                                            : isSubnetShift
                                                                ? (shiftDirection === 'to-subnet' ? 'Subnet Destination' : 'Mainnet Destination')
                                                                : 'Destination'
                                                        }
                                                    </span>
                                                    {(() => {
                                                        const finalToken = quote.path[quote.path.length - 1];
                                                        const price = getPrice(finalToken.contractId);
                                                        return price && (
                                                            <span className="ml-1 text-xs text-muted-foreground">
                                                                ~{formatPriceUSD(Number(quote.amountOut) * price / (10 ** (finalToken.decimals || 6)))}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Total price impact summary */}
                    {quote && totalPriceImpact && totalPriceImpact.priceImpact !== null && (
                        <div className="flex justify-between items-center pt-3 border-t border-white/[0.08] flex-wrap gap-y-1">
                            <span className="text-muted-foreground flex items-center whitespace-nowrap">
                                <svg className="h-4 w-4 mr-1.5 text-primary/70" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                                </svg>
                                {isSubnetToSubnet
                                    ? 'Subnet swap price impact'
                                    : isSubnetShift
                                        ? `${operationType} price impact`
                                        : 'Total price impact'}
                            </span>
                            <div className="flex items-center flex-wrap gap-x-2 gap-y-1 justify-end w-full sm:w-auto">
                                <div className="text-xs flex items-center flex-wrap gap-x-1">
                                    <span className="text-muted-foreground">Input:</span>
                                    <span className="text-foreground/90">{formatPriceUSD(totalPriceImpact.inputValueUsd)}</span>
                                    <span className="mx-1 text-muted-foreground">→</span>
                                    <span className="text-muted-foreground">Output:</span>
                                    <span className="text-foreground/90">{formatPriceUSD(totalPriceImpact.outputValueUsd)}</span>
                                </div>
                                <span className={`px-2 py-0.5 rounded-sm text-xs font-medium whitespace-nowrap ${totalPriceImpact.priceImpact > 0
                                    ? 'text-green-600 dark:text-green-400 bg-green-100/30 dark:bg-green-900/20'
                                    : 'text-orange-600 dark:text-orange-400 bg-orange-100/30 dark:bg-orange-900/20'
                                    }`}>
                                    {totalPriceImpact.priceImpact > 0 ? '+' : ''}
                                    {totalPriceImpact.priceImpact.toFixed(2)}% impact
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Vault Security Info */}
                    {quote && (
                        <div className="flex justify-between items-center py-3 border-t border-white/[0.08]">
                            <span className="text-muted-foreground flex items-center whitespace-nowrap">
                                <svg className="h-4 w-4 mr-1.5 text-primary/70" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                                {isSubnetToSubnet
                                    ? 'Subnet security'
                                    : isSubnetShift
                                        ? 'Subnet security'
                                        : 'Vault security'}
                            </span>
                            <span className="font-medium flex items-center bg-green-500/10 px-2 py-0.5 text-xs rounded text-green-700 dark:text-green-400 whitespace-nowrap">
                                <svg className="h-3.5 w-3.5 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                </svg>
                                {isSubnetToSubnet
                                    ? 'Isolated contracts'
                                    : isSubnetShift
                                        ? 'Isolated contracts'
                                        : 'Isolated contracts'}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function PriceImpactWizardDialog() {
    const [step, setStep] = useState(0);
    const [open, setOpen] = useState(false);
    const steps = [
        {
            title: 'What is Price Impact?',
            content: (
                <div className="space-y-3">
                    <p>Price impact is the difference between the market price of a token and the price you actually receive when swapping. It happens because your trade changes the balance of tokens in the liquidity pool, which affects the price for your transaction.</p>
                    <p className="text-xs text-muted-foreground">In AMMs (Automated Market Makers), every trade shifts the pool ratio, changing the price for the next trade. The larger your trade relative to the pool, the more the price moves against you. This is a direct result of the pool's math (e.g., constant product formula).</p>
                </div>
            ),
        },
        {
            title: 'Why Does Price Impact Matter?',
            content: (
                <div className="space-y-3">
                    <ul className="list-disc pl-5 space-y-1">
                        <li><b>High price impact</b> means you may get much less (or more) than the expected market rate.</li>
                        <li>It can make trades more expensive or less profitable, especially for large swaps or illiquid pools.</li>
                        <li>Sometimes, a high positive price impact can mean you are getting a better deal, but this is rare and should be verified.</li>
                    </ul>
                    <p className="text-xs text-muted-foreground">Price impact is different from <b>slippage</b>: slippage includes both price impact and any market movement that happens while your transaction is pending. Always check both before confirming a swap.</p>
                </div>
            ),
        },
        {
            title: 'How to Protect Yourself',
            content: (
                <div className="space-y-3">
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Double-check token amounts and prices before confirming a swap.</li>
                        <li>Compare with prices on other platforms or block explorers.</li>
                        <li>Be cautious with large trades or new/illiquid pools.</li>
                        <li>If unsure, start with a small swap to test the outcome.</li>
                    </ul>
                    <div className="bg-muted/40 border border-muted px-3 py-2 rounded text-xs text-foreground">
                        <b>Charisma Safety:</b> Charisma automatically applies <b>Stacks postconditions</b> on every hop of your trade. These postconditions ensure you receive the expected amount of tokens, and prevent any pool from transferring tokens you did not explicitly approve. This protects you from malicious pools and guarantees your swap is safe and predictable.
                    </div>
                    <div className="pt-2 border-t border-border/30 text-xs text-muted-foreground">
                        <b>Note:</b> Price impact can be caused by pool imbalances, advantageous or disadvantageous trades, or rapidly changing/incorrect pricing data. Please inspect and verify token amounts and prices on external platforms to ensure you are comfortable with this trade.
                    </div>
                </div>
            ),
        },
    ];
    // Reset to first step when dialog closes
    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (!isOpen) setStep(0);
    };
    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <span className="ml-2 cursor-pointer"><Info className="w-4 h-4 text-muted-foreground" /></span>
            </DialogTrigger>
            <DialogContent className="max-w-2xl text-sm text-muted-foreground space-y-4">
                <DialogHeader>
                    <DialogTitle>{steps[step].title}</DialogTitle>
                </DialogHeader>
                <div>{steps[step].content}</div>
                <div className="flex justify-between items-center pt-4">
                    <button
                        className="text-xs px-3 py-1 rounded bg-muted text-foreground border border-border disabled:opacity-50 cursor-pointer transition-colors hover:bg-muted/70 focus-visible:ring focus-visible:ring-primary/40"
                        onClick={() => setStep((s) => Math.max(0, s - 1))}
                        disabled={step === 0}
                    >
                        Back
                    </button>
                    <div className="flex-1" />
                    <button
                        className="text-xs px-3 py-1 rounded bg-primary text-primary-foreground border border-primary disabled:opacity-50 cursor-pointer transition-colors hover:bg-primary/80 focus-visible:ring focus-visible:ring-primary/40"
                        onClick={() => {
                            if (step === steps.length - 1) {
                                setOpen(false);
                            } else {
                                setStep((s) => Math.min(steps.length - 1, s + 1));
                            }
                        }}
                        disabled={step === steps.length - 1 && !open}
                    >
                        {step === steps.length - 1 ? 'Done' : 'Next'}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
} 
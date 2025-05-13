"use client";

import React, { useState } from 'react';
import type { Token } from '../../lib/swap-client';
import TokenLogo from '../TokenLogo';
import Image from 'next/image';
import { KraxelPriceData } from '@repo/tokens';

// Copied type definitions from useSwap.ts
interface Vault {
    type: string;
    contractId: string;
    contractAddress: string;
    contractName: string;
    name: string;
    symbol: string;
    decimals: number;
    identifier: string;
    description: string;
    image: string;
    fee: number;
    externalPoolId: string;
    engineContractId: string;
    tokenA: Token;
    tokenB: Token;
    reservesA: number;
    reservesB: number;
}

interface Hop {
    vault: Vault;
    tokenIn: Token;
    tokenOut: Token;
    opcode: number;
    quote?: {
        amountIn: number;
        amountOut: number;
    };
}

interface Route {
    path: Token[];
    hops: Hop[];
    amountIn: number;
    amountOut: number;
}

interface QuoteResponse {
    amountOut: number;
    expectedPrice: number;
    minimumReceived: number;
    route: Route;
}
// --- End of copied types ---

interface SwapDetailsProps {
    quote: QuoteResponse | null;
    selectedToToken: Token | null;
    microAmount: string;
    tokenPrices: KraxelPriceData;
    totalPriceImpact: {
        inputValueUsd: number;
        outputValueUsd: number;
        priceImpact: number | null;
    } | null;
    priceImpacts: {
        impact: number | null;
        fromValueUsd: number | null;
        toValueUsd: number | null;
    }[];
    isLoadingPrices: boolean;
    isLoadingQuote: boolean;
    securityLevel: 'high' | 'medium' | 'low' | null;
    formatTokenAmount: (amount: number, decimals: number) => string;
    formatUsd: (value: number | null) => string | null;
}

export default function SwapDetails({
    quote,
    selectedToToken,
    microAmount,
    tokenPrices,
    totalPriceImpact,
    priceImpacts,
    isLoadingPrices,
    isLoadingQuote,
    securityLevel,
    formatTokenAmount,
    formatUsd
}: SwapDetailsProps) {
    const [showDetails, setShowDetails] = useState(false);
    const [showRouteDetails, setShowRouteDetails] = useState(true);

    // Determine if this is a subnet shift operation by checking for SUBLINK vault type
    const isSubnetShift = quote?.route.hops.some(hop => hop.vault.type === 'SUBLINK');

    // Detect if both from and to tokens are subnet tokens using type property
    const isFromSubnet = quote?.route.path[0]?.type === 'SUBNET';
    const isToSubnet = quote?.route.path[quote.route.path.length - 1]?.type === 'SUBNET';
    const isSubnetToSubnet = isFromSubnet && isToSubnet;

    // Get the direction of the shift (to or from subnet)
    const getShiftDirection = () => {
        if (!isSubnetShift || !quote) return null;
        const destinationToken = quote.route.path[quote.route.path.length - 1];
        return destinationToken.contractId.includes('-subnet') ? 'to-subnet' : 'from-subnet';
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
    const showHighImpactWarning = totalPriceImpact && totalPriceImpact.priceImpact !== null && (totalPriceImpact.priceImpact > 20 || totalPriceImpact.priceImpact < -20);

    return (
        <div className="mb-5 border border-border/40 rounded-xl overflow-hidden bg-card/30 backdrop-blur-sm shadow-sm">
            {/* High price impact warning */}
            {showHighImpactWarning && (
                <div className="flex items-center bg-yellow-200 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-200 px-4 py-2 border-b border-yellow-400/5 animate-[appear_0.3s_ease-out]">
                    <svg className="h-5 w-5 mr-2 text-yellow-600 dark:text-yellow-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span className="font-mono">Warning: High price impact!</span>
                </div>
            )}
            <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full flex justify-between items-center p-4 hover:bg-muted/10 transition-colors"
            >
                <div className="flex items-center space-x-2">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 text-primary transition-transform duration-300 ${showDetails ? 'rotate-180' : ''}`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    <div className="flex items-center">
                        {/* Change title based on whether it's a swap or shift */}
                        <span className="font-medium text-foreground">
                            {isSubnetToSubnet
                                ? 'Subnet Swap details'
                                : isSubnetShift
                                    ? `Subnet ${operationType} details`
                                    : 'Swap details'}
                        </span>
                        {securityLevel && (
                            <span className={`ml-2 inline-flex px-1.5 py-0.5 text-xs rounded-full items-center ${isSubnetShift ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400' :
                                securityLevel === 'high' ? 'bg-green-500/10 text-green-700 dark:text-green-400' :
                                    securityLevel === 'medium' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400' :
                                        'bg-purple-500/10 text-purple-700 dark:text-purple-400'
                                }`}>
                                <span className={`h-1.5 w-1.5 rounded-full mr-1 ${isSubnetShift ? 'bg-purple-500' :
                                    securityLevel === 'high' ? 'bg-green-500' :
                                        securityLevel === 'medium' ? 'bg-blue-500' : 'bg-purple-500'
                                    }`}></span>
                                {isSubnetToSubnet
                                    ? 'Subnet to Subnet'
                                    : isSubnetShift
                                        ? (shiftDirection === 'to-subnet' ? 'Deposit to subnet' : 'Withdraw from subnet')
                                        : (securityLevel === 'high' ? 'Direct route' :
                                            securityLevel === 'medium' ? 'Optimized path' : 'Advanced routing')
                                }
                            </span>
                        )}
                    </div>
                </div>
                {!isLoadingQuote && quote && (
                    <div className="text-sm text-muted-foreground flex items-center">
                        <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs">
                            {quote.route.path.length - 1} {quote.route.path.length - 1 === 1 ? 'hop' : 'hops'}
                        </span>
                    </div>
                )}
            </button>

            {showDetails && (
                <div className="p-4 pt-0 pb-0 bg-card/50 text-sm space-y-4 animate-[slideDown_0.2s_ease-out]">
                    {/* Minimum received */}
                    {quote && selectedToToken && (
                        <div className="flex justify-between pt-3 border-t border-border/30">
                            <span className="text-muted-foreground flex items-center">
                                <svg className="h-4 w-4 mr-1.5 text-primary/70" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                                </svg>
                                {isSubnetToSubnet
                                    ? 'Minimum swapped'
                                    : isSubnetShift
                                        ? `Minimum ${operationType.toLowerCase()}ed`
                                        : 'Minimum received'}
                            </span>
                            <span className="font-medium text-foreground flex items-center">
                                {formatTokenAmount(Number(quote.minimumReceived), selectedToToken.decimals || 0)} {selectedToToken.symbol}
                            </span>
                        </div>
                    )}

                    {/* Path/Route visualization with price impacts */}
                    {quote && (
                        <div className="flex flex-col pt-3 border-t border-border/30">
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
                                            : 'Route details'} ({quote.route.path.length - 1} {quote.route.path.length - 1 === 1 ? 'hop' : 'hops'})
                                </span>
                                <div className="flex items-center gap-1">
                                    {/* Replace price impact with mini-path view */}
                                    {quote && quote.route.path.length > 0 && (
                                        <div className="flex items-center space-x-0.5">
                                            {quote.route.path.map((token: Token, index: number) => (
                                                <React.Fragment key={token.contractId || index}>
                                                    <div className="h-4 w-4 rounded-full bg-background flex items-center justify-center overflow-hidden border border-border/30">
                                                        <TokenLogo token={token} size="sm" />
                                                    </div>
                                                    {index < quote.route.path.length - 1 && (
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
                                    <div className="bg-muted/20 rounded-xl p-3 sm:p-3.5 border border-border/40">
                                        <div className="flex items-center mb-2">
                                            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-background shadow-sm border border-border/50 flex items-center justify-center overflow-hidden">
                                                <TokenLogo token={quote.route.path[0]} size="lg" />
                                            </div>
                                            <div className="ml-2 sm:ml-2.5">
                                                <div className="font-medium text-sm sm:text-base">
                                                    {quote.route.path[0].symbol}
                                                    <span className="font-normal ml-1 text-xs text-muted-foreground">
                                                        ({formatTokenAmount(Number(microAmount), quote.route.path[0].decimals || 6)})
                                                    </span>
                                                </div>
                                                <div className="text-xs text-muted-foreground flex items-center">
                                                    <span>Start</span>
                                                    {tokenPrices && tokenPrices[quote.route.path[0].contractId] && (
                                                        <span className="ml-1">
                                                            ~{formatUsd(Number(microAmount) * tokenPrices[quote.route.path[0].contractId] / (10 ** (quote.route.path[0].decimals || 6)))}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Hops with price impact */}
                                    {quote.route.hops.map((hop: Hop, idx: number) => {
                                        const fromToken = quote.route.path[idx];
                                        const toToken = quote.route.path[idx + 1];
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
                                                <div className={`bg-muted/20 rounded-xl p-3 sm:p-3.5 border ${isSubnetShiftHop ?
                                                    'border-purple-500/30 border-dashed bg-purple-500/5' :
                                                    'border-primary/30 border-dashed'
                                                    }`}>
                                                    <div className="flex items-center mb-2">
                                                        <div className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center ${isSubnetShiftHop ? 'bg-purple-500/20' : 'bg-primary/20'}`}>
                                                            {/* For subnet operations, use the vault image like other vaults */}
                                                            <Image className="rounded-md" src={hop.vault.image || ''} alt={vaultName} width={32} height={32} />
                                                        </div>
                                                        <div className="ml-2 sm:ml-2.5">
                                                            <div className="font-medium text-sm sm:text-base">
                                                                {vaultName}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground flex items-center flex-wrap gap-x-2">
                                                                {isSubnetShiftHop ? (
                                                                    <span className="text-purple-600 dark:text-purple-400 whitespace-nowrap">
                                                                        No fees to {shiftDirection === 'to-subnet' ? 'deposit' : 'withdraw'}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-primary whitespace-nowrap">
                                                                        {formattedFee} % fee to LP providers
                                                                    </span>
                                                                )}
                                                                {/* Price impact badge */}
                                                                {priceImpact && priceImpact.impact !== null && Math.abs(priceImpact.impact) > 0 && (
                                                                    <span className={`px-1.5 py-0.5 rounded-sm ${Math.abs(priceImpact.impact) < 5
                                                                        ? 'text-muted-foreground bg-muted/20'
                                                                        : priceImpact.impact > 5
                                                                            ? 'text-green-600 dark:text-green-400 bg-green-100/30 dark:bg-green-900/20'
                                                                            : priceImpact.impact < -5
                                                                                ? 'text-red-600 dark:text-red-400 bg-red-100/30 dark:bg-red-900/20'
                                                                                : ''
                                                                        }`}>
                                                                        {priceImpact.impact > 0 ? '+' : ''}
                                                                        {priceImpact.impact.toFixed(2)}% impact
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-2 gap-y-1 sm:justify-between text-xs mt-1 text-muted-foreground">
                                                        <div className="flex items-center whitespace-nowrap">
                                                            <div className="h-5 w-5 rounded-full bg-background shadow-sm border border-border/50 flex items-center justify-center overflow-hidden mr-1.5">
                                                                <TokenLogo token={fromToken} size="sm" />
                                                            </div>
                                                            <span className="font-medium text-foreground/90">{fromToken.symbol}</span>
                                                            <span className="ml-1 text-xs text-muted-foreground">
                                                                {idx === 0 ? `(${formatTokenAmount(Number(microAmount), fromToken.decimals || 6)})` : `(${formatTokenAmount(Number(hop.quote?.amountIn), fromToken.decimals || 6)})`}
                                                            </span>
                                                            {/* Add USD value */}
                                                            {priceImpact && priceImpact.fromValueUsd !== null && (
                                                                <span className="ml-1">~{formatUsd(priceImpact.fromValueUsd)}</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center whitespace-nowrap">
                                                            <div className="h-5 w-5 rounded-full bg-background shadow-sm border border-border/50 flex items-center justify-center overflow-hidden mr-1.5">
                                                                <TokenLogo token={toToken} size="sm" />
                                                            </div>
                                                            <span className="font-medium text-foreground/90">{toToken.symbol}</span>
                                                            <span className="ml-1 text-xs text-muted-foreground">
                                                                {`(${formatTokenAmount(Number(hop.quote?.amountOut), toToken.decimals || 6)})`}
                                                            </span>
                                                            {/* Add USD value */}
                                                            {priceImpact && priceImpact.toValueUsd !== null && (
                                                                <span className="ml-1">~{formatUsd(priceImpact.toValueUsd)}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Arrow connecting nodes */}
                                                <div className="h-6 flex justify-center items-center">
                                                    <div className="h-full border-l-2 border-dashed border-primary/30"></div>
                                                </div>

                                                {/* Only show intermediate tokens (not the final destination) */}
                                                {idx < quote.route.hops.length - 1 && (
                                                    <div className="bg-muted/20 rounded-xl p-3 sm:p-3.5 border border-border/40">
                                                        <div className="flex items-center">
                                                            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-background shadow-sm border border-border/50 flex items-center justify-center overflow-hidden">
                                                                <TokenLogo token={toToken} size="lg" />
                                                            </div>
                                                            <div className="ml-2 sm:ml-2.5">
                                                                <div className="font-medium text-sm sm:text-base">{toToken.symbol}</div>
                                                                <div className="text-xs text-muted-foreground flex items-center">
                                                                    <span>Intermediate</span>
                                                                    {tokenPrices && tokenPrices[toToken.contractId] && (
                                                                        <span className="ml-1">
                                                                            ~{formatUsd(Number(hop.quote?.amountOut) * tokenPrices[toToken.contractId] / (10 ** (toToken.decimals || 6)))}
                                                                        </span>
                                                                    )}
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
                                        'bg-purple-500/10 dark:bg-purple-900/20 border-purple-500/30' :
                                        'bg-green-500/10 dark:bg-green-900/20 border-green-500/30'
                                        }`}>
                                        <div className="flex items-center">
                                            <div className="h-7 w-7 sm:h-10 sm:w-10 rounded-full bg-background shadow-sm border border-border/50 flex items-center justify-center overflow-hidden">
                                                <TokenLogo token={quote.route.path[quote.route.path.length - 1]} size="lg" />
                                            </div>
                                            <div className="ml-2 sm:ml-2.5">
                                                <div className="font-medium text-xs sm:text-base">
                                                    {quote.route.path[quote.route.path.length - 1].symbol}
                                                    <span className="font-normal ml-1 text-xs text-muted-foreground">
                                                        ({formatTokenAmount(Number(quote.amountOut), quote.route.path[quote.route.path.length - 1].decimals || 6)})
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
                                                    {tokenPrices && tokenPrices[quote.route.path[quote.route.path.length - 1].contractId] && (
                                                        <span className="ml-1 text-xs text-muted-foreground">
                                                            ~{formatUsd(Number(quote.amountOut) * tokenPrices[quote.route.path[quote.route.path.length - 1].contractId] / (10 ** (quote.route.path[quote.route.path.length - 1].decimals || 6)))}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Total price impact summary */}
                    {quote && totalPriceImpact && totalPriceImpact.priceImpact !== null && !isLoadingPrices && (
                        <div className="flex justify-between items-center pt-3 border-t border-border/30 flex-wrap gap-y-1">
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
                                    <span className="text-foreground/90">{formatUsd(totalPriceImpact.inputValueUsd)}</span>
                                    <span className="mx-1 text-muted-foreground">→</span>
                                    <span className="text-muted-foreground">Output:</span>
                                    <span className="text-foreground/90">{formatUsd(totalPriceImpact.outputValueUsd)}</span>
                                </div>
                                <span className={`px-2 py-0.5 rounded-sm text-xs font-medium whitespace-nowrap ${totalPriceImpact.priceImpact > 0
                                    ? 'text-green-600 dark:text-green-400 bg-green-100/30 dark:bg-green-900/20'
                                    : 'text-red-600 dark:text-red-400 bg-red-100/30 dark:bg-red-900/20'
                                    }`}>
                                    {totalPriceImpact.priceImpact > 0 ? '+' : ''}
                                    {totalPriceImpact.priceImpact.toFixed(2)}% impact
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Vault Security Info */}
                    {quote && (
                        <div className="flex justify-between items-center py-3 border-t border-border/30">
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
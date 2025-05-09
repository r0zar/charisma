"use client";

import React, { useState } from 'react';
import type { Token } from '../../lib/swap-client';
import TokenDropdown from '../TokenDropdown';
import { Flame, ChevronDown } from 'lucide-react';
import ConditionTokenChartWrapper from '../condition-token-chart-wrapper';

interface TokenOutputSectionProps {
    label: string;
    selectedToken: Token | null;
    displayedToken: Token | null; // The token to show as selected in the dropdown (usually mainnet)
    outputAmount: string; // Formatted quote amount
    minimumReceived: string; // Formatted quote min received
    balance: string;
    displayTokens: Token[]; // Filtered list for the dropdown
    onSelectToken: (token: Token) => void; // Callback when base token is selected
    hasBothVersions: boolean;
    isSubnetSelected: boolean;
    onToggleSubnet: () => void;
    isLoadingQuote: boolean;
    isLoadingPrice: boolean;
    tokenValueUsd: string | null; // Formatted USD value
    formatUsd: (value: number | null) => string | null; // USD formatting function
    quoteHops: number | null;
    priceImpactDisplay: React.ReactNode; // Pass the price impact display as a node
}

export default function TokenOutputSection({
    label,
    selectedToken,
    displayedToken,
    outputAmount,
    minimumReceived,
    balance,
    displayTokens,
    onSelectToken,
    hasBothVersions,
    isSubnetSelected,
    onToggleSubnet,
    isLoadingQuote,
    isLoadingPrice,
    tokenValueUsd,
    formatUsd,
    quoteHops,
    priceImpactDisplay
}: TokenOutputSectionProps) {
    const [showChart, setShowChart] = useState(false);
    return (
        <div className="bg-muted/20 rounded-2xl p-4 sm:p-5 mb-5 backdrop-blur-sm border border-muted/40 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-2 sm:gap-0 mb-2">
                <div className="flex items-center gap-1">
                    <label className="text-sm text-foreground/80 font-medium">{label}</label>
                    {selectedToken && (
                        <button
                            type="button"
                            onClick={() => setShowChart(!showChart)}
                            className="text-muted-foreground hover:text-foreground p-0.5 rounded-md"
                            title={showChart ? 'Hide price chart' : 'Show price chart'}
                        >
                            <ChevronDown className={`w-4 h-4 transition-transform ${showChart ? 'rotate-180' : ''}`} />
                        </button>
                    )}
                </div>

                {selectedToken && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1 bg-background/40 px-2 py-0.5 rounded-full self-start">
                        Balance: <span className="font-semibold text-foreground">{balance}</span> {selectedToken.symbol}
                        {hasBothVersions && (
                            <button
                                onClick={onToggleSubnet}
                                className={`cursor-pointer ml-1 p-0.5 rounded-full hover:bg-muted transition-colors ${isSubnetSelected ? 'text-red-500' : 'text-muted-foreground/50'}`}
                                title={isSubnetSelected ? "Using Subnet Token" : "Using Mainnet Token"}
                            >
                                <Flame size={14} />
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="flex justify-between items-center gap-3">
                <div className="text-xl sm:text-2xl font-medium text-foreground relative min-h-[36px]">
                    {isLoadingQuote ? (
                        <div className="flex items-center space-x-2">
                            <div className="animate-pulse bg-muted rounded-md h-8 w-20"></div>
                            <div className="relative h-4 w-4">
                                <div className="absolute animate-ping h-full w-full rounded-full bg-primary opacity-30"></div>
                                <div className="absolute h-full w-full rounded-full bg-primary opacity-75 animate-pulse"></div>
                            </div>
                        </div>
                    ) : outputAmount ? (
                        <>
                            {outputAmount}
                            {quoteHops !== null && (
                                <div className="text-sm text-muted-foreground flex items-center">
                                    <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs">
                                        {quoteHops} {quoteHops === 1 ? 'hop' : 'hops'}
                                    </span>
                                </div>
                            )}
                        </>
                    ) : (
                        "0.00"
                    )}
                </div>

                <div className="min-w-[120px] sm:min-w-[140px] shrink-0">
                    <TokenDropdown
                        tokens={displayTokens}
                        selected={displayedToken} // Use the base token for highlighting dropdown
                        onSelect={onSelectToken} // Call parent handler for selection
                        label=""
                    />
                </div>
            </div>
            <div className="text-xs mt-1.5 h-4 flex items-center justify-between">
                <div className="text-muted-foreground">
                    {isLoadingQuote ? null : // Don't show loading if quote is loading
                        isLoadingPrice ? (
                            <div className="flex items-center space-x-1">
                                <span className="h-2 w-2 bg-primary/30 rounded-full animate-pulse"></span>
                                <span className="animate-pulse">Loading price...</span>
                            </div>
                        ) : tokenValueUsd !== null ? (
                            <span>~{tokenValueUsd}</span>
                        ) : null}
                </div>
                {/* {!isLoadingQuote && priceImpactDisplay} Render the passed price impact display node */}
            </div>

            {/* collapsible chart */}
            {showChart && selectedToken && (
                <div className="mt-4">
                    <ConditionTokenChartWrapper token={selectedToken} targetPrice="" onTargetPriceChange={() => { }} />
                </div>
            )}
        </div>
    );
} 
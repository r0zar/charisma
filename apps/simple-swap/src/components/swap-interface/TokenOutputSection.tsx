"use client";

import React, { useState } from 'react';
import TokenDropdown from '../TokenDropdown';
import { Flame, ChevronDown } from 'lucide-react';
import ConditionTokenChartWrapper from '../condition-token-chart-wrapper';
import { TokenCacheData } from '@repo/tokens';
import { useSwapContext } from '../../contexts/swap-context';

export default function TokenOutputSection() {
    const [showChart, setShowChart] = useState(false);

    // Get all needed state from context
    const {
        mode,
        selectedToToken,
        quote,
        toTokenBalance,
        isLoadingQuote,
        isLoadingPrices,
        toTokenValueUsd,
        formatTokenAmount,
        displayTokens,
        displayedToToken,
        hasBothVersions,
        useSubnetTo,
        setUseSubnetTo,
        setSelectedToToken,
        baseSelectedToToken,
        setBaseSelectedToToken,
        tokenCounterparts,
        totalPriceImpact,
        toLabel,
    } = useSwapContext();

    // Determine props based on mode and state
    const label = toLabel;
    // Create a virtual display token that shows subnet type when useSubnetTo is true
    const displayedToken = displayedToToken ? {
        ...displayedToToken,
        type: useSubnetTo ? 'SUBNET' as const : displayedToToken.type
    } : null;
    const tokensToShow = displayTokens;
    const isSubnetSelected = useSubnetTo;
    const hasBothVersionsForToken = hasBothVersions(selectedToToken);

    // Helper to format USD currency
    const formatUsd = (value: number | null) => {
        if (value === null || isNaN(value)) return null;
        return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const tokenValueUsd = formatUsd(toTokenValueUsd);
    const outputAmount = quote && selectedToToken ? formatTokenAmount(Number(quote.amountOut), selectedToToken.decimals || 0) : "0.00";
    const quoteHops = quote ? quote.path.length - 1 : null;

    const handleSelectToken = (t: TokenCacheData) => {
        console.log("Selected TO token:", t.symbol);
        if (mode === 'order') {
            // In order mode, we can select any token (mainnet or subnet)
            setSelectedToToken(t);
        } else {
            // In swap mode, directly set the selected token
            setSelectedToToken(t);
            setBaseSelectedToToken(t);
            setUseSubnetTo(t.type === 'SUBNET');
        }
    };

    const handleToggleSubnet = () => {
        if (selectedToToken) {
            // Toggle between mainnet and subnet versions
            const baseId = selectedToToken.type === 'SUBNET'
                ? selectedToToken.base!
                : selectedToToken.contractId;
            const counterparts = tokenCounterparts.get(baseId);

            if (counterparts) {
                const targetToken = useSubnetTo ? counterparts.mainnet : counterparts.subnet;
                if (targetToken) {
                    setSelectedToToken(targetToken);
                    setBaseSelectedToToken(targetToken);
                    setUseSubnetTo(!useSubnetTo);
                }
            }
        }
    };

    // Price impact display component
    const priceImpactDisplay = totalPriceImpact && totalPriceImpact.priceImpact !== null && !isLoadingPrices && !isLoadingQuote ? (
        <div className={`px-1.5 py-0.5 rounded-sm text-xs font-medium ${totalPriceImpact.priceImpact > 0
            ? 'text-green-600 dark:text-green-400 bg-green-100/30 dark:bg-green-900/20'
            : 'text-red-600 dark:text-red-400 bg-red-100/30 dark:bg-red-900/20'
            }`}>
            {totalPriceImpact.priceImpact > 0 ? '+' : ''}
            {totalPriceImpact.priceImpact.toFixed(2)}% impact
        </div>
    ) : null;

    return (
        <div className="bg-muted/20 rounded-2xl p-4 sm:p-5 mb-5 backdrop-blur-sm border border-muted/40 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-2 sm:gap-0 mb-2">
                <div className="flex items-center gap-1">
                    <label className="text-sm text-foreground/80 font-medium">{label}</label>
                    {selectedToToken && (
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

                {selectedToToken && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1 bg-background/40 px-2 py-0.5 rounded-full self-start">
                        Balance: <span className="font-semibold text-foreground">{toTokenBalance}</span> {selectedToToken.symbol}
                        {hasBothVersionsForToken && (
                            <button
                                onClick={handleToggleSubnet}
                                className={`ml-1 p-0.5 rounded-full transition-colors ${useSubnetTo ? 'text-red-500' : 'text-muted-foreground/50'}`}
                                title={
                                    useSubnetTo
                                        ? "Using Subnet Token - Click to use Mainnet"
                                        : "Using Mainnet Token - Click to use Subnet"
                                }
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
                        tokens={tokensToShow}
                        selected={displayedToken}
                        onSelect={handleSelectToken}
                        label=""
                    />
                </div>
            </div>
            <div className="text-xs mt-1.5 h-4 flex items-center justify-between">
                <div className="text-muted-foreground">
                    {isLoadingQuote ? null : // Don't show loading if quote is loading
                        isLoadingPrices ? (
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
            {showChart && selectedToToken && (
                <div className="mt-4">
                    <ConditionTokenChartWrapper token={selectedToToken} targetPrice="" onTargetPriceChange={() => { }} />
                </div>
            )}
        </div>
    );
} 
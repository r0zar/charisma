"use client";

import React, { useState } from 'react';
import TokenDropdown from '../TokenDropdown';
import { Flame, ChevronDown } from 'lucide-react';
import ConditionTokenChartWrapper from '../condition-token-chart-wrapper';
import { TokenCacheData } from '@repo/tokens';
import { useBlaze } from 'blaze-sdk';
import { formatPriceUSD } from '@/lib/utils';
import { useSwapTokens } from '@/contexts/swap-tokens-context';
import { useRouterTrading } from '@/hooks/useRouterTrading';
import { formatTokenAmount } from '@/lib/swap-utils';

export default function TokenOutputSection() {
    const [showChart, setShowChart] = useState(false);

    // Get all needed state from context
    const {
        mode,
        selectedToToken,
        displayTokens,
        displayedToToken,
        hasBothVersions,
        useSubnetTo,
        setUseSubnetTo,
        setSelectedToToken,
        setBaseSelectedToToken,
        tokenCounterparts,
    } = useSwapTokens();

    const { quote, isLoadingQuote, totalPriceImpact, toLabel } = useRouterTrading();

    // Get balance data directly from useSwapBalances
    const { balances, prices } = useBlaze();

    // Get balance for the current token
    const toTokenBalance = selectedToToken ? balances[selectedToToken.contractId]?.balance : "0";
    const price = prices[selectedToToken?.contractId ?? ''];

    // Determine props based on mode and state
    const label = toLabel;
    // Create a virtual display token that shows subnet type when useSubnetTo is true
    const displayedToken = displayedToToken ? {
        ...displayedToToken,
        type: useSubnetTo ? 'SUBNET' as const : displayedToToken.type
    } : null;
    const tokensToShow = displayTokens;
    const hasBothVersionsForToken = hasBothVersions(selectedToToken);

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
    const priceImpactDisplay = totalPriceImpact && totalPriceImpact.priceImpact !== null && !isLoadingQuote ? (
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
                                className={`ml-1 p-0.5 cursor-pointer rounded-full transition-colors ${useSubnetTo ? 'text-red-500' : 'text-muted-foreground/50'}`}
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
                        <span>{formatPriceUSD(price?.price * Number(outputAmount))}</span>
                    }
                </div>
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
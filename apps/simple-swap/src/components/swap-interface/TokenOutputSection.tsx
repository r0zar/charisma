"use client";

import React, { useState } from 'react';
import TokenDropdown from '../TokenDropdown';
import { ChevronDown } from 'lucide-react';
import TokenLogo from '../TokenLogo';
import ConditionTokenChartWrapper from '../condition-token-chart-wrapper';
import { TokenCacheData } from '@repo/tokens';
import { useBlaze } from 'blaze-sdk/realtime';
import { formatPriceUSD } from '@/lib/utils';
import { useSwapTokens } from '@/contexts/swap-tokens-context';
import { useRouterTrading } from '@/hooks/useRouterTrading';
import { formatTokenAmount, formatCompactNumber } from '@/lib/swap-utils';
import { useWallet } from '@/contexts/wallet-context';
import { BalanceTooltip } from '@/components/ui/tooltip';

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
        forceBurnSwap,
    } = useSwapTokens();

    const { quote, isLoadingQuote, totalPriceImpact, toLabel, isLPToken, burnSwapRoutes, isLoadingBurnSwapRoutes, routeableTokenIds } = useRouterTrading();

    // Get balance data from BlazeProvider with user-specific balances
    const { address } = useWallet();
    const { balances } = useBlaze({ userId: address });

    // Get enhanced balance data for the current token
    // For subnet tokens, we need to look up the base token's balance data
    const getBaseContractId = (token: TokenCacheData | null) => {
        if (!token) return null;
        // If it's a subnet token, use the base contract, otherwise use the token's contract
        return token.type === 'SUBNET' && token.base ? token.base : token.contractId;
    };

    const baseContractId = getBaseContractId(selectedToToken);
    const toTokenBalance = baseContractId && address ? balances[`${address}:${baseContractId}`] : null;

    // Get price from enriched balance metadata OR token's usdPrice
    const priceData = selectedToToken?.usdPrice;
    const change24h = toTokenBalance?.metadata?.change24h;


    // Determine props based on mode and state
    const label = 'You receive';
    // Create a virtual display token that shows subnet type when useSubnetTo is true
    const displayedToken = displayedToToken ? {
        ...displayedToToken,
        type: useSubnetTo ? 'SUBNET' as const : displayedToToken.type
    } : null;
    // Filter tokens to only show those with routing paths available
    const tokensToShow = displayTokens.filter(token => routeableTokenIds.has(token.contractId));
    const isSubnetSelected = useSubnetTo;
    const hasBothVersionsForToken = hasBothVersions(selectedToToken);

    // Debug logging
    React.useEffect(() => {
        console.log('[TokenOutputSection] Subnet toggle state:', {
            selectedToToken: selectedToToken?.symbol,
            hasBothVersionsForToken,
            isSubnetSelected,
            mode
        });
    }, [selectedToToken, hasBothVersionsForToken, isSubnetSelected, mode]);

    // Calculate compact balance display and tooltip content
    const { compactBalance, tooltipData } = React.useMemo(() => {
        if (!toTokenBalance) {
            return { compactBalance: '0', tooltipData: { mainnet: '0', activeLabel: 'Mainnet', subnet: undefined } };
        }

        const mainnetBalance = Number(toTokenBalance.formattedBalance ?? 0);
        const subnetBalance = Number(toTokenBalance.formattedSubnetBalance ?? 0);
        const hasSubnet = toTokenBalance.subnetBalance !== undefined;

        // Determine active balance based on subnet toggle
        const activeBalance = isSubnetSelected && hasSubnet ? subnetBalance : mainnetBalance;

        // Create compact display
        const compact = formatCompactNumber(activeBalance);

        // Create tooltip data
        const activeLabel = isSubnetSelected && hasSubnet ? 'Subnet' : 'Mainnet';
        const tooltipData = {
            mainnet: mainnetBalance.toLocaleString(),
            subnet: hasSubnet ? subnetBalance.toLocaleString() : undefined,
            activeLabel: activeLabel
        };

        return {
            compactBalance: compact,
            tooltipData
        };
    }, [toTokenBalance, isSubnetSelected, selectedToToken, baseContractId, address]);

    // Calculate output amount - use burn-swap total when active
    const outputAmount = React.useMemo(() => {
        if (!selectedToToken) return "0.00";

        // Check if burn-swap should be used (either more profitable OR forced by user)
        const isBurnSwapProfitable = isLPToken && (burnSwapRoutes.tokenA || burnSwapRoutes.tokenB) && quote ? (() => {
            const burnSwapTotal = Number(burnSwapRoutes.tokenA?.amountOut || burnSwapRoutes.tokenA?.expectedAmountOut || 0) +
                Number(burnSwapRoutes.tokenB?.amountOut || burnSwapRoutes.tokenB?.expectedAmountOut || 0);
            const regularQuoteAmount = Number(quote?.amountOut || quote?.expectedAmountOut || 0);
            return burnSwapTotal > regularQuoteAmount;
        })() : false;

        const shouldUseBurnSwap = forceBurnSwap || isBurnSwapProfitable;

        if (shouldUseBurnSwap && mode === 'swap' && (burnSwapRoutes.tokenA || burnSwapRoutes.tokenB)) {
            // Use burn-swap total
            const burnSwapTotal = Number(burnSwapRoutes.tokenA?.amountOut || burnSwapRoutes.tokenA?.expectedAmountOut || 0) +
                Number(burnSwapRoutes.tokenB?.amountOut || burnSwapRoutes.tokenB?.expectedAmountOut || 0);
            return formatTokenAmount(burnSwapTotal, selectedToToken.decimals || 0);
        } else if (quote) {
            // Use regular quote
            return formatTokenAmount(Number(quote.amountOut), selectedToToken.decimals || 0);
        }

        return "0.00";
    }, [quote, selectedToToken, isLPToken, burnSwapRoutes, forceBurnSwap, mode]);

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
        console.log('[TokenOutputSection] handleToggleSubnet called', {
            selectedToToken: selectedToToken?.symbol,
            hasBothVersionsForToken,
            useSubnetTo
        });
        if (selectedToToken && hasBothVersionsForToken) {
            // Simply toggle the subnet flag - no need to change tokens
            // The enhanced balance feed handles both mainnet and subnet balances
            setUseSubnetTo(!useSubnetTo);
        }
    };

    return (
        <div className="space-y-4">
            {/* Premium Header with Analytics */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                    <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M12 2v20M2 12h20" />
                        </svg>
                    </div>
                    <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-white/95">{label}</h4>
                        <p className="text-xs text-white/60 hidden sm:block">Expected output amount</p>
                    </div>
                </div>

                {selectedToToken && (
                    <button
                        type="button"
                        onClick={() => setShowChart(!showChart)}
                        className="h-8 w-8 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/70 hover:text-white/90 hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-200 flex items-center justify-center backdrop-blur-sm flex-shrink-0"
                        title={showChart ? 'Hide price chart' : 'Show price chart'}
                    >
                        <ChevronDown className={`w-4 h-4 transition-transform ${showChart ? 'rotate-180' : ''}`} />
                    </button>
                )}
            </div>

            {/* Balance Display - Invisible until hover */}
            {selectedToToken && (
                <div className="bg-transparent hover:bg-white/[0.03] rounded-xl p-3 sm:p-4 transition-all duration-200">
                    <div className="flex items-center justify-between mb-3 gap-3">
                        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                            <div className="relative flex-shrink-0">
                                {hasBothVersionsForToken && selectedToToken && (
                                    <button
                                        onClick={handleToggleSubnet}
                                        className="relative transition-all duration-200 cursor-pointer hover:scale-105 z-10"
                                        title={
                                            isSubnetSelected
                                                ? "Using Subnet Token - Click to use Mainnet"
                                                : "Using Mainnet Token - Click to use Subnet"
                                        }
                                    >
                                        <TokenLogo
                                            token={{
                                                ...selectedToToken,
                                                type: isSubnetSelected ? 'SUBNET' : selectedToToken.type
                                            }}
                                            size="md"
                                            suppressFlame={!isSubnetSelected}
                                        />
                                        {/* Subtle toggle indicator */}
                                        <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white/20 bg-green-500" />
                                    </button>
                                )}
                                {!hasBothVersionsForToken && selectedToToken && (
                                    <TokenLogo token={selectedToToken} size="md" />
                                )}
                            </div>

                            <div className="min-w-0">
                                <div className="text-sm font-medium text-white/95">{selectedToToken.symbol}</div>
                                <div className="text-xs text-white/60 truncate">{selectedToToken.name}</div>
                            </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                            <BalanceTooltip mainnet={tooltipData.mainnet} subnet={tooltipData.subnet} activeLabel={tooltipData.activeLabel} side="bottom">
                                <div className="cursor-help">
                                    <div className={`text-sm font-semibold ${isSubnetSelected && toTokenBalance?.subnetBalance !== undefined ? 'text-purple-400' : 'text-white/95'}`}>
                                        {compactBalance} {selectedToToken.symbol}
                                    </div>
                                    <div className="text-xs text-white/60">
                                        {isSubnetSelected ? 'Subnet' : 'Mainnet'}
                                    </div>
                                </div>
                            </BalanceTooltip>
                        </div>
                    </div>

                    {/* Network Status Indicator */}
                    <div className="flex items-center justify-between pt-3 border-t border-white/[0.08] gap-3">
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                            <div className="h-2 w-2 rounded-full bg-green-400 flex-shrink-0"></div>
                            <span className="text-xs text-white/70 truncate">
                                Connected to {isSubnetSelected ? 'Subnet' : 'Mainnet'} • {priceData ? formatPriceUSD(priceData) : 'Price loading...'}
                                {change24h !== null && change24h !== undefined && (
                                    <span className={`ml-2 ${change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
                                    </span>
                                )}
                            </span>
                        </div>

                        {/* Price Impact Display */}
                        {totalPriceImpact && totalPriceImpact.priceImpact !== null && !isLoadingQuote && (
                            <div className={`px-2 py-1 rounded-lg text-xs font-medium flex-shrink-0 ${totalPriceImpact.priceImpact > 0
                                ? 'text-green-400 bg-green-500/20 border border-green-500/30'
                                : totalPriceImpact.priceImpact < -10 ? 'text-red-400 bg-red-500/20 border border-red-500/30'
                                    : 'text-gray-400 bg-gray-500/20 border border-gray-500/30'
                                }`}>
                                {totalPriceImpact.priceImpact > 0 ? '+' : ''}
                                {totalPriceImpact.priceImpact.toFixed(2)}%
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Amount Display - Invisible until hover */}
            <div className="group bg-transparent hover:bg-white/[0.02] rounded-xl p-3 sm:p-4 transition-all duration-200">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        {isLoadingQuote ? (
                            <div className="flex items-center space-x-3">
                                <div className="animate-pulse bg-white/[0.05] rounded-xl h-12 w-32"></div>
                                <div className="relative h-5 w-5">
                                    <div className="absolute animate-ping h-full w-full rounded-full bg-green-400 opacity-30"></div>
                                    <div className="absolute h-full w-full rounded-full bg-green-400 opacity-75 animate-pulse"></div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white/95">
                                    {outputAmount}
                                </div>
                                <div className="text-sm text-white/60 mt-1">
                                    {(() => {
                                        const hasPrice = priceData !== null && priceData !== undefined;
                                        const hasOutput = outputAmount;
                                        // Remove commas and any other formatting from outputAmount before converting to number
                                        const cleanOutputAmount = typeof outputAmount === 'string' ? outputAmount.replace(/,/g, '') : outputAmount;
                                        const numericOutput = Number(cleanOutputAmount);
                                        const calculation = hasPrice && hasOutput ? priceData * numericOutput : null;
                                        return hasPrice && hasOutput && !isNaN(numericOutput) && !isNaN(calculation!) ? formatPriceUSD(calculation!) : 'Enter amount';
                                    })()}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Token Selector - Invisible until hover */}
                    <div className="ml-2 sm:ml-4 min-w-0 w-32 sm:w-36 flex-shrink-0" onMouseEnter={(e) => e.stopPropagation()}>
                        <div>
                            <TokenDropdown
                                tokens={tokensToShow}
                                selected={displayedToken}
                                onSelect={handleSelectToken}
                                label=""
                                showBalances={true}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Collapsible Chart */}
            {showChart && selectedToToken && (
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 sm:p-4 backdrop-blur-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                            <div className="h-6 w-6 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center flex-shrink-0">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path d="M3 3v18h18" />
                                    <path d="m19 9-5 5-4-4-3 3" />
                                </svg>
                            </div>
                            <span className="text-sm font-medium text-white/90">Price Chart</span>
                        </div>
                        <div className="text-xs text-white/60 flex-shrink-0">
                            {priceData ? formatPriceUSD(priceData) : 'Loading...'}
                        </div>
                    </div>
                    <ConditionTokenChartWrapper token={selectedToToken} targetPrice="" onTargetPriceChange={() => { }} />
                </div>
            )}
        </div>
    );
}
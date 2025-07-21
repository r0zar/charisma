"use client";

import React, { useState } from 'react';
import TokenDropdown from '../TokenDropdown';
import { ChevronDown } from 'lucide-react';
import TokenLogo from '../TokenLogo';
import ConditionTokenChartWrapper from '../condition-token-chart-wrapper';
import { TokenCacheData } from '@/lib/contract-registry-adapter';
import { usePrices } from '@/contexts/token-price-context';
import { useBalances } from '@/contexts/wallet-balance-context';
import { formatPriceUSD, hasValidPrice } from '@/lib/utils';
import { useSwapTokens } from '@/contexts/swap-tokens-context';
import { useRouterTrading } from '@/hooks/useRouterTrading';
import { formatTokenAmount, formatCompactNumber } from '@/lib/swap-utils';
import { useWallet } from '@/contexts/wallet-context';
import { BalanceTooltip } from '@/components/ui/tooltip';

export default function TokenOutputSection() {
    const [showChart, setShowChart] = useState(false);
    const [forceTokenDropdownOpen, setForceTokenDropdownOpen] = useState(false);

    // Get all needed state from context
    const {
        mode,
        selectedToToken,
        displayTokens,
        subnetDisplayTokens,
        displayedToToken,
        hasBothVersions,
        useSubnetTo,
        setUseSubnetTo,
        setSelectedToToken,
        setBaseSelectedToToken,
    } = useSwapTokens();

    const { quote, isLoadingQuote, totalPriceImpact, toLabel } = useRouterTrading();

    // Get balance data from new contexts
    const { address } = useWallet();
    const { getPrice } = usePrices();
    const { getTokenBalance, getSubnetBalance, getFormattedMainnetBalance, getFormattedSubnetBalance } = useBalances(address ? [address] : []);
    const priceValue = getPrice(selectedToToken?.contractId ?? '');
    const price = priceValue ? { price: priceValue } : undefined;


    // Determine props based on mode and state
    const label = 'You receive';
    // Create a virtual display token that shows subnet type when useSubnetTo is true
    const displayedToken = displayedToToken ? {
        ...displayedToToken,
        type: useSubnetTo ? 'SUBNET' as const : displayedToToken.type
    } : null;
    const tokensToShow = displayTokens;
    const isSubnetSelected = useSubnetTo;
    const hasBothVersionsForToken = hasBothVersions(selectedToToken);

    // Calculate compact balance display and tooltip content
    const { compactBalance, tooltipData } = React.useMemo(() => {
        if (!address || !selectedToToken) return { compactBalance: '0', tooltipData: { mainnet: '0', activeLabel: 'Mainnet', subnet: undefined } };

        // Check if this token has a subnet version
        const subnetToken = subnetDisplayTokens.find(t => t.base === selectedToToken.contractId);
        const hasSubnet = !!subnetToken;

        // Get formatted balances using context functions
        const formattedMainnetBalance = getFormattedMainnetBalance(address, selectedToToken.contractId);
        const formattedSubnetBalance = hasSubnet ? getFormattedSubnetBalance(address, subnetToken.contractId) : undefined;
        const compactBalance = useSubnetTo && hasSubnet ? formattedSubnetBalance! : formattedMainnetBalance;

        // Create tooltip data
        const tooltipData = {
            mainnet: formattedMainnetBalance,
            subnet: formattedSubnetBalance,
            activeLabel: useSubnetTo && hasSubnet ? 'Subnet' : 'Mainnet'
        };

        return {
            compactBalance,
            tooltipData
        };
    }, [address, selectedToToken, getFormattedMainnetBalance, getFormattedSubnetBalance, subnetDisplayTokens, useSubnetTo]);

    const outputAmount = quote && selectedToToken ? formatTokenAmount(Number(quote.amountOut), selectedToToken.decimals || 0) : "0.00";

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
        if (selectedToToken && hasBothVersionsForToken) {
            // Simply toggle the subnet flag - no need to change tokens
            // The enhanced balance feed handles both mainnet and subnet balances
            setUseSubnetTo(!useSubnetTo);
        }
    };

    const handleSectionClick = () => {
        setForceTokenDropdownOpen(true);
    };

    return (
        <div className="space-y-4 cursor-pointer" onClick={handleSectionClick}>
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
                        onClick={(e) => { e.stopPropagation(); setShowChart(!showChart); }}
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
                                        onClick={(e) => { e.stopPropagation(); handleToggleSubnet(); }}
                                        className="relative transition-all duration-200 cursor-pointer hover:scale-105"
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
                                    <div className="text-sm font-semibold text-white/95">
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
                                Connected to {isSubnetSelected ? 'Subnet' : 'Mainnet'} • {hasValidPrice(price) ? formatPriceUSD(price.price) : 'Price loading...'}
                            </span>
                        </div>
                        
                        {/* Price Impact Display */}
                        {totalPriceImpact && totalPriceImpact.priceImpact !== null && !isLoadingQuote && (
                            <div className={`px-2 py-1 rounded-lg text-xs font-medium flex-shrink-0 ${
                                totalPriceImpact.priceImpact > 0
                                    ? 'text-green-400 bg-green-500/20 border border-green-500/30'
                                    : 'text-red-400 bg-red-500/20 border border-red-500/30'
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
                                        const hasPrice = hasValidPrice(price);
                                        const hasOutput = outputAmount;
                                        // Remove commas and any other formatting from outputAmount before converting to number
                                        const cleanOutputAmount = typeof outputAmount === 'string' ? outputAmount.replace(/,/g, '') : outputAmount;
                                        const numericOutput = Number(cleanOutputAmount);
                                        const calculation = hasPrice && hasOutput ? price.price * numericOutput : null;
                                        return hasPrice && hasOutput && !isNaN(numericOutput) && !isNaN(calculation!) ? formatPriceUSD(calculation!) : 'Enter amount';
                                    })()}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Token Selector - Invisible until hover */}
                    <div className="ml-2 sm:ml-4 min-w-0 w-32 sm:w-36 flex-shrink-0" onMouseEnter={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                        <div>
                            <TokenDropdown
                                tokens={tokensToShow}
                                selected={displayedToken}
                                onSelect={handleSelectToken}
                                label=""
                                showBalances={true}
                                forceOpen={forceTokenDropdownOpen}
                                onForceOpenChange={setForceTokenDropdownOpen}
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
                            {hasValidPrice(price) ? formatPriceUSD(price.price) : 'Loading...'}
                        </div>
                    </div>
                    <ConditionTokenChartWrapper token={selectedToToken} targetPrice="" onTargetPriceChange={() => { }} />
                </div>
            )}
        </div>
    );
}
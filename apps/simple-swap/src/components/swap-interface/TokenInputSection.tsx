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
import { useWallet } from '@/contexts/wallet-context';
import { useSwapTokens } from '@/contexts/swap-tokens-context';
import { BalanceTooltip } from '@/components/ui/tooltip';
import { formatCompactNumber, formatTokenAmount } from '@/lib/swap-utils';

export default function TokenInputSection() {
    const [showChart, setShowChart] = useState(false);
    const [forceTokenDropdownOpen, setForceTokenDropdownOpen] = useState(false);

    // Get all needed state from context
    const {
        mode,
        selectedFromToken,
        displayAmount,
        setDisplayAmount,
        displayTokens,
        subnetDisplayTokens,
        displayedFromToken,
        hasBothVersions,
        useSubnetFrom,
        setUseSubnetFrom,
        setSelectedFromTokenSafe,
        setBaseSelectedFromToken,
    } = useSwapTokens();

    const { address } = useWallet();

    const { getPrice } = usePrices();
    const { getBalance, getTokenBalance, getSubnetBalance, getFormattedMainnetBalance, getFormattedSubnetBalance } = useBalances(address ? [address] : []);
    const priceValue = getPrice(selectedFromToken?.contractId ?? '');
    const price = priceValue ? { price: priceValue } : undefined;

    // Get enhanced balance data for the current token
    // For subnet tokens, we need to look up the base token's balance data
    const getBaseContractId = (token: TokenCacheData | null) => {
        if (!token) return null;
        // If it's a subnet token, use the base contract, otherwise use the token's contract
        return token.type === 'SUBNET' && token.base ? token.base : token.contractId;
    };

    const baseContractId = getBaseContractId(selectedFromToken);
    
    // Calculate compact balance display and tooltip content
    const { compactBalance, tooltipData, rawActiveBalance } = React.useMemo(() => {
        if (!address || !baseContractId) return { compactBalance: '0', tooltipData: { mainnet: '0', activeLabel: 'Mainnet', subnet: undefined }, rawActiveBalance: 0 };

        const rawMainnetBalance = getTokenBalance(address, baseContractId);
        
        // Check if this token has a subnet version
        const subnetToken = subnetDisplayTokens.find(t => t.base === baseContractId);
        const hasSubnet = !!subnetToken;
        const rawSubnetBalance = hasSubnet ? getSubnetBalance(address, subnetToken.contractId) : 0;

        // Determine active balance based on subnet toggle
        const rawActiveBalance = useSubnetFrom && hasSubnet ? rawSubnetBalance : rawMainnetBalance;

        // Get formatted balances using context functions
        const formattedMainnetBalance = getFormattedMainnetBalance(address, baseContractId);
        const formattedSubnetBalance = hasSubnet ? getFormattedSubnetBalance(address, subnetToken.contractId) : undefined;
        const compactBalance = useSubnetFrom && hasSubnet ? formattedSubnetBalance! : formattedMainnetBalance;

        // Create tooltip data
        const tooltipData = {
            mainnet: formattedMainnetBalance,
            subnet: formattedSubnetBalance,
            activeLabel: useSubnetFrom && hasSubnet ? 'Subnet' : 'Mainnet'
        };

        return {
            compactBalance,
            tooltipData,
            rawActiveBalance
        };
    }, [address, baseContractId, getTokenBalance, getSubnetBalance, getFormattedMainnetBalance, getFormattedSubnetBalance, subnetDisplayTokens, useSubnetFrom]);

    // Determine which tokens to show and other props based on mode
    const label = 'You send';
    const displayedToken = mode === 'order' ? selectedFromToken : displayedFromToken;
    const tokensToShow = mode === 'order' ? subnetDisplayTokens : displayTokens;
    const isSubnetSelected = mode === 'order' ? true : useSubnetFrom;
    const isToggleDisabled = mode === 'order';
    const hasBothVersionsForToken = mode === 'order' ? true : hasBothVersions(selectedFromToken);

    const handleSelectToken = (t: TokenCacheData) => {
        if (mode === 'order') {
            // In order mode, directly set the subnet token
            setSelectedFromTokenSafe(t);
        } else {
            // In swap mode, directly set the selected token
            setSelectedFromTokenSafe(t);
            setBaseSelectedFromToken(t);
            setUseSubnetFrom(t.type === 'SUBNET');
        }
    };

    const handleToggleSubnet = () => {
        if (mode !== 'order' && selectedFromToken && hasBothVersionsForToken) {
            // Simply toggle the subnet flag - no need to change tokens
            // The enhanced balance feed handles both mainnet and subnet balances
            setUseSubnetFrom(!useSubnetFrom);
        }
    };

    const handleBalancePercentageClick = (percentage: number) => {
        if (!selectedFromToken || !address || !baseContractId) return;

        // Calculate the percentage of the raw active balance (in atomic units)
        const rawAmount = rawActiveBalance * percentage;
        
        // Convert to formatted amount using token decimals
        const decimals = selectedFromToken?.decimals || 6;
        const formattedAmount = formatTokenAmount(rawAmount, decimals);

        // Set the display amount as formatted string
        setDisplayAmount(formattedAmount);
    };

    const handleSetMax = () => {
        if (!selectedFromToken) return;

        // Convert raw active balance to formatted amount
        const decimals = selectedFromToken?.decimals || 6;
        const formattedAmount = formatTokenAmount(rawActiveBalance, decimals);
        setDisplayAmount(formattedAmount);
    };

    const handleSectionClick = () => {
        setForceTokenDropdownOpen(true);
    };

    return (
        <div className="space-y-4 cursor-pointer" onClick={handleSectionClick}>
            {/* Premium Header with Analytics */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                    <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M12 2v20M2 12h20" />
                        </svg>
                    </div>
                    <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-white/95">{label}</h4>
                        <p className="text-xs text-white/60 hidden sm:block">Select asset and amount</p>
                    </div>
                </div>

                {selectedFromToken && (
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
            {selectedFromToken && (
                <div className="bg-transparent hover:bg-white/[0.03] rounded-xl p-3 sm:p-4 transition-all duration-200">
                    <div className="flex items-center justify-between mb-3 gap-3">
                        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                            <div className="relative flex-shrink-0">
                                {hasBothVersionsForToken && selectedFromToken && (
                                    <button
                                        onClick={isToggleDisabled ? undefined : (e) => { e.stopPropagation(); handleToggleSubnet(); }}
                                        className={`relative transition-all duration-200 ${isToggleDisabled
                                            ? 'cursor-default opacity-75'
                                            : 'cursor-pointer hover:scale-105'
                                            }`}
                                        title={
                                            isToggleDisabled
                                                ? "Subnet tokens required in order mode"
                                                : isSubnetSelected
                                                    ? "Using Subnet Token - Click to use Mainnet"
                                                    : "Using Mainnet Token - Click to use Subnet"
                                        }
                                        disabled={isToggleDisabled}
                                    >
                                        <TokenLogo
                                            token={{
                                                ...selectedFromToken,
                                                type: isSubnetSelected ? 'SUBNET' : selectedFromToken.type
                                            }}
                                            size="lg"
                                            suppressFlame={!isSubnetSelected}
                                        />
                                        {!isToggleDisabled && (
                                            <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                    <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                                </svg>
                                            </div>
                                        )}
                                    </button>
                                )}
                                {(!hasBothVersionsForToken || !selectedFromToken) && (
                                    <TokenLogo token={selectedFromToken} size="lg" />
                                )}
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm font-medium text-white/95">{selectedFromToken.symbol}</div>
                                <div className="text-xs text-white/60 truncate">{selectedFromToken.name}</div>
                            </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                            <BalanceTooltip mainnet={tooltipData.mainnet} subnet={tooltipData.subnet} activeLabel={tooltipData.activeLabel} side="bottom">
                                <div className="cursor-help">
                                    <div className="text-sm font-semibold text-white/95">
                                        {compactBalance} {selectedFromToken.symbol}
                                    </div>
                                    <div className="text-xs text-white/60">
                                        {isSubnetSelected ? 'Subnet' : 'Mainnet'}
                                    </div>
                                </div>
                            </BalanceTooltip>

                            {/* Quick Balance Actions */}
                            <div className="flex items-center gap-1 mt-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleBalancePercentageClick(0.25); }}
                                    className="text-xs px-2 py-1 rounded bg-white/[0.05] text-white/70 hover:bg-white/[0.1] hover:text-white/90 transition-all duration-200"
                                >
                                    25%
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleBalancePercentageClick(0.5); }}
                                    className="text-xs px-2 py-1 rounded bg-white/[0.05] text-white/70 hover:bg-white/[0.1] hover:text-white/90 transition-all duration-200"
                                >
                                    50%
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleBalancePercentageClick(1); }}
                                    className="text-xs px-2 py-1 rounded bg-white/[0.05] text-white/70 hover:bg-white/[0.1] hover:text-white/90 transition-all duration-200"
                                >
                                    MAX
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Network Status Indicator */}
                    <div className="flex items-center space-x-2 pt-3 border-t border-white/[0.08]">
                        <div className="h-2 w-2 rounded-full bg-green-400"></div>
                        <span className="text-xs text-white/70">
                            Connected to {isSubnetSelected ? 'Subnet' : 'Mainnet'} • {hasValidPrice(price) ? formatPriceUSD(price.price) : 'Price loading...'}
                        </span>
                    </div>
                </div>
            )}

            {/* Amount Input - Invisible until hover */}
            <div className="group bg-transparent hover:bg-white/[0.02] rounded-xl p-3 sm:p-4 transition-all duration-200">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <input
                            value={displayAmount}
                            onChange={(e) => {
                                const v = e.target.value;
                                if (/^[0-9]*\.?[0-9]*$/.test(v) || v === "") {
                                    setDisplayAmount(v);
                                }
                            }}
                            placeholder="0.00"
                            className="bg-transparent border-none text-xl sm:text-2xl lg:text-3xl font-semibold focus:outline-none w-full placeholder:text-white/30 text-white/95"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <div className="text-sm text-white/60 mt-1">
                            {hasValidPrice(price) && displayAmount ? (() => {
                                const cleanAmount = typeof displayAmount === 'string' ? displayAmount.replace(/,/g, '') : displayAmount;
                                const numericAmount = Number(cleanAmount);
                                return !isNaN(numericAmount) ? formatPriceUSD(price.price * numericAmount) : 'Enter amount';
                            })() : 'Enter amount'}
                        </div>
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

            {/* Premium Chart Display */}
            {showChart && selectedFromToken && (
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 sm:p-4 backdrop-blur-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                            <div className="h-6 w-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
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
                    <ConditionTokenChartWrapper token={selectedFromToken} targetPrice="" onTargetPriceChange={() => { }} />
                </div>
            )}
        </div>
    );
} 
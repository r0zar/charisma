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
import BalanceSourceSwitch from './BalanceSourceSwitch';
import { formatCompactNumber, formatTokenAmount } from '@/lib/swap-utils';
import { pairOf, rowBlazeVersion } from '@/lib/subnet-pairs';
import { AnimatedAmount } from '@/components/balances/AnimatedAmount';
import { BalanceGlance } from '@/components/balances/BalanceGlance';

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
    const { getBalance, getTokenBalance, getSubnetBalance, getSubnetBalanceExact, getFormattedMainnetBalance, getFormattedSubnetBalance } = useBalances(address ? [address] : []);
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
    const { tooltipData, rawActiveBalance } = React.useMemo(() => {
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

    // A v1/v2 pair's subnet balance (CHA, WELSH, sBTC) is one number across Blaze v1 and v2; while some is still on v1,
    // the tooltip shows where it sits
    const listedSubnet = subnetDisplayTokens.find(t => t.base === baseContractId)?.contractId;
    const fromPair = pairOf(listedSubnet);
    const splitParts = address && fromPair && getSubnetBalanceExact(address, fromPair.v1) > 0
        ? [['Blaze v1', fromPair.v1], ['Blaze v2', fromPair.v2]]
            .map(([part, subnet]) => ({ label: part, amount: formatTokenAmount(getSubnetBalanceExact(address, subnet), fromPair.decimals) }))
        : undefined;

    // The contracts behind the shown balance: the token on Stacks, or its Blaze subnet(s)
    const paysFromSubnet = useSubnetFrom && !!listedSubnet;
    const shownTokens = paysFromSubnet ? (fromPair ? [fromPair.v1, fromPair.v2] : [listedSubnet!]) : baseContractId ? [baseContractId] : [];
    const decimals = selectedFromToken?.decimals ?? 6;

    // Determine which tokens to show and other props based on mode
    const label = 'You send';
    const displayedToken = mode === 'order' ? selectedFromToken : displayedFromToken;
    const tokensToShow = mode === 'order' ? subnetDisplayTokens : displayTokens;
    const isSubnetSelected = mode === 'order' ? true : useSubnetFrom;
    const isToggleDisabled = mode === 'order';
    const hasBothVersionsForToken = mode === 'order' ? true : hasBothVersions(selectedFromToken);
    // The Stacks / Blaze switch shows when the token has a subnet to choose
    const hasSubnetChoice = !!selectedFromToken && hasBothVersionsForToken;

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
        <div className="space-y-4">
            {/* Premium Header with Analytics */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                    <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-accent/20 text-accent-text flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M12 2v20M2 12h20" />
                        </svg>
                    </div>
                    <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-ink">{label}</h4>
                        <p className="text-xs text-ink-muted hidden sm:block">Select asset and amount</p>
                    </div>
                </div>

                {selectedFromToken && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setShowChart(!showChart); }}
                        className="h-8 w-8 rounded-lg bg-surface border border-line text-ink-body hover:text-ink hover:bg-surface-hover hover:border-line-strong transition-all duration-200 flex items-center justify-center backdrop-blur-sm flex-shrink-0"
                        title={showChart ? 'Hide price chart' : 'Show price chart'}
                    >
                        <ChevronDown className={`w-4 h-4 transition-transform ${showChart ? 'rotate-180' : ''}`} />
                    </button>
                )}
            </div>

            {/* Balance Display - Invisible until hover */}
            {selectedFromToken && (
                <div className="bg-transparent hover:bg-surface rounded-xl p-3 sm:p-4 transition-all duration-200">
                    <div className="flex items-center justify-between mb-3 gap-3">
                        {/* Only the token itself opens the token picker (and the token button below) */}
                        <button
                            type="button"
                            onClick={handleSectionClick}
                            title="Choose a different token"
                            className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1 cursor-pointer rounded-lg text-left transition-opacity hover:opacity-80"
                        >
                            <div className="relative flex-shrink-0">
                                <TokenLogo
                                    token={{ ...selectedFromToken, type: hasSubnetChoice && isSubnetSelected ? 'SUBNET' : selectedFromToken.type }}
                                    size="lg"
                                    suppressFlame={hasSubnetChoice && !isSubnetSelected}
                                    blazeVersion={hasSubnetChoice ? rowBlazeVersion(listedSubnet) : undefined}
                                />
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm font-medium text-ink">{selectedFromToken.symbol}</div>
                                <div className="text-xs text-ink-muted truncate">{selectedFromToken.name}</div>
                            </div>
                        </button>

                        <div className="text-right flex-shrink-0">
                            <div className="flex items-center justify-end gap-1.5">
                                <BalanceTooltip mainnet={tooltipData.mainnet} subnet={tooltipData.subnet} subnetParts={splitParts} activeLabel={tooltipData.activeLabel} side="bottom">
                                    <div className="cursor-help">
                                        <div className="text-sm font-semibold text-ink">
                                            <AnimatedAmount key={shownTokens.join()} value={rawActiveBalance} format={n => formatTokenAmount(n, decimals)} /> {selectedFromToken.symbol}
                                        </div>
                                    </div>
                                </BalanceTooltip>
                                {address && baseContractId && (
                                    <BalanceGlance address={address} tokens={shownTokens} base={baseContractId} symbol={selectedFromToken.symbol} decimals={decimals} />
                                )}
                            </div>

                            {/* Quick Balance Actions */}
                            <div className="flex items-center gap-1 mt-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleBalancePercentageClick(0.25); }}
                                    className="text-xs px-2 py-1 rounded bg-surface text-ink-body hover:bg-surface-selected hover:text-ink transition-all duration-200"
                                >
                                    25%
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleBalancePercentageClick(0.5); }}
                                    className="text-xs px-2 py-1 rounded bg-surface text-ink-body hover:bg-surface-selected hover:text-ink transition-all duration-200"
                                >
                                    50%
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleBalancePercentageClick(1); }}
                                    className="text-xs px-2 py-1 rounded bg-surface text-ink-body hover:bg-surface-selected hover:text-ink transition-all duration-200"
                                >
                                    MAX
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Where it's paid from, and the token's price */}
                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-line">
                        {(hasSubnetChoice || (selectedFromToken && selectedFromToken.type !== 'SUBNET')) && (
                            <BalanceSourceSwitch
                                label="Pay from"
                                subnet={hasSubnetChoice ? isSubnetSelected : false}
                                onChange={setUseSubnetFrom}
                                wallet={address ? tooltipData.mainnet : undefined}
                                subnetBalance={address ? tooltipData.subnet : undefined}
                                blazeVersion={rowBlazeVersion(listedSubnet)}
                                missingSubnet={hasSubnetChoice ? undefined : { tokenId: selectedFromToken!.contractId, symbol: selectedFromToken!.symbol }}
                                lockedReason={isToggleDisabled ? 'Orders pay from Blaze' : undefined}
                            />
                        )}
                        <span className="ml-auto text-xs text-ink-muted">
                            {hasValidPrice(price) ? formatPriceUSD(price.price) : 'Price loading…'}
                        </span>
                    </div>
                </div>
            )}

            {/* Amount Input - Invisible until hover */}
            <div className="group bg-transparent hover:bg-surface rounded-xl p-3 sm:p-4 transition-all duration-200">
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
                            className="bg-transparent border-none text-xl sm:text-2xl lg:text-3xl font-semibold focus:outline-none w-full placeholder:text-ink-faint text-ink"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <div className="text-sm text-ink-muted mt-1">
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
                                selectedBlazeVersion={hasSubnetChoice ? rowBlazeVersion(listedSubnet) : undefined}
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
                <div className="bg-surface-sunken border border-line-soft rounded-xl p-3 sm:p-4 backdrop-blur-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                            <div className="h-6 w-6 rounded-lg bg-accent/20 text-accent-text flex items-center justify-center flex-shrink-0">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path d="M3 3v18h18" />
                                    <path d="m19 9-5 5-4-4-3 3" />
                                </svg>
                            </div>
                            <span className="text-sm font-medium text-ink">Price Chart</span>
                        </div>
                        <div className="text-xs text-ink-muted flex-shrink-0">
                            {hasValidPrice(price) ? formatPriceUSD(price.price) : 'Loading...'}
                        </div>
                    </div>
                    <ConditionTokenChartWrapper token={selectedFromToken} targetPrice="" onTargetPriceChange={() => { }} />
                </div>
            )}
        </div>
    );
} 
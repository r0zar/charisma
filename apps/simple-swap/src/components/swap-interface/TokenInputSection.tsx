"use client";

import React, { useState } from 'react';
import TokenDropdown from '../TokenDropdown';
import { ChevronDown } from 'lucide-react';
import TokenLogo from '../TokenLogo';
import ConditionTokenChartWrapper from '../condition-token-chart-wrapper';
import { TokenCacheData } from '@repo/tokens';
import { useBlaze } from 'blaze-sdk/realtime';
import { formatPriceUSD } from '@/lib/utils';
import { useWallet } from '@/contexts/wallet-context';
import { useSwapTokens } from '@/contexts/swap-tokens-context';
import { BalanceTooltip } from '@/components/ui/tooltip';
import { formatCompactNumber } from '@/lib/swap-utils';

export default function TokenInputSection() {
    const [showChart, setShowChart] = useState(false);

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
        tokenCounterparts,
    } = useSwapTokens();

    const { address } = useWallet();

    const { prices, balances } = useBlaze({ userId: address });
    const price = prices[selectedFromToken?.contractId ?? ''];

    // Get enhanced balance data for the current token
    const fromTokenBalance = selectedFromToken ? balances[`${address}:${selectedFromToken.contractId}`] : null;

    // Calculate compact balance display and tooltip content
    const { compactBalance, tooltipData, rawActiveBalance } = React.useMemo(() => {
        if (!fromTokenBalance) return { compactBalance: '0', tooltipData: { mainnet: '0', activeLabel: 'Mainnet', subnet: undefined }, rawActiveBalance: 0 };

        const mainnetBalance = Number(fromTokenBalance.formattedBalance ?? 0);
        const subnetBalance = Number(fromTokenBalance.formattedSubnetBalance ?? 0);
        const hasSubnet = fromTokenBalance.subnetBalance !== undefined;

        // Determine active balance based on subnet toggle
        const activeBalance = (mode === 'order' || useSubnetFrom) && hasSubnet ? subnetBalance : mainnetBalance;

        // Create compact display
        const compact = formatCompactNumber(activeBalance);

        // Create tooltip data
        const activeLabel = (mode === 'order' || useSubnetFrom) && hasSubnet ? 'Subnet' : 'Mainnet';
        const tooltipData = {
            mainnet: mainnetBalance.toLocaleString(),
            subnet: hasSubnet ? subnetBalance.toLocaleString() : undefined,
            activeLabel: activeLabel
        };

        return {
            compactBalance: compact,
            tooltipData,
            rawActiveBalance: activeBalance
        };
    }, [fromTokenBalance, mode, useSubnetFrom]);

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

    const handleSetMax = () => {
        if (!selectedFromToken || !fromTokenBalance) return;

        // Use the raw active balance (already calculated based on subnet toggle state)
        setDisplayAmount(rawActiveBalance.toString());
    };

    return (
        <div className="bg-muted/20 rounded-2xl p-4 sm:p-5 mb-1 backdrop-blur-sm border border-muted/40 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-2 sm:gap-0 mb-2">
                <div className="flex items-center gap-1">
                    <label className="text-sm text-foreground/80 font-medium">{label}</label>
                    {selectedFromToken && (
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

                {selectedFromToken && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1 bg-background/40 px-2 py-1 rounded-lg self-start">
                        <BalanceTooltip mainnet={tooltipData.mainnet} subnet={tooltipData.subnet} activeLabel={tooltipData.activeLabel} side="bottom">
                            <span className={`cursor-help font-semibold ${isSubnetSelected && fromTokenBalance?.subnetBalance !== undefined ? 'text-purple-600 dark:text-purple-400' : 'text-foreground'}`}>
                                {compactBalance} {selectedFromToken.symbol}
                            </span>
                        </BalanceTooltip>
                        {/* TokenLogo showing subnet state */}
                        {hasBothVersionsForToken && selectedFromToken && (
                            <button
                                onClick={isToggleDisabled ? undefined : handleToggleSubnet}
                                className={`ml-1 transition-opacity ${isToggleDisabled
                                    ? 'cursor-default opacity-75'
                                    : 'cursor-pointer hover:opacity-80'
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
                                    size="sm"
                                    suppressFlame={!isSubnetSelected}
                                />
                            </button>
                        )}
                        <button
                            className="ml-1 text-primary font-semibold bg-primary/10 px-1.5 rounded hover:bg-primary/20 transition-colors"
                            onClick={handleSetMax}
                        >
                            MAX
                        </button>
                    </div>
                )}
            </div>

            <div className="flex justify-between items-center">
                <input
                    value={displayAmount}
                    onChange={(e) => {
                        const v = e.target.value;
                        if (/^[0-9]*\.?[0-9]*$/.test(v) || v === "") {
                            setDisplayAmount(v);
                        }
                    }}
                    placeholder="0.00"
                    className="bg-transparent border-none text-xl sm:text-2xl font-medium focus:outline-none w-full placeholder:text-muted-foreground/50"
                />

                <div className="min-w-[120px] sm:min-w-[140px] shrink-0">
                    <TokenDropdown
                        tokens={tokensToShow}
                        selected={displayedToken} // Use the base token for highlighting dropdown
                        onSelect={handleSelectToken} // Call parent handler for selection
                        label=""
                        showBalances={true}
                    />
                </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1.5 h-4 flex items-center">
                <span>{formatPriceUSD(price?.price * Number(displayAmount))}</span>
            </div>

            {/* collapsible chart */}
            {showChart && selectedFromToken && (
                <div className="mt-4">
                    <ConditionTokenChartWrapper token={selectedFromToken} targetPrice="" onTargetPriceChange={() => { }} />
                </div>
            )}
        </div>
    );
} 
"use client";

import React, { useState } from 'react';
import TokenDropdown from '../TokenDropdown';
import { Flame, ChevronDown } from 'lucide-react';
import ConditionTokenChartWrapper from '../condition-token-chart-wrapper';
import { TokenCacheData } from '@repo/tokens';
import { useBlaze } from 'blaze-sdk';
import { formatPriceUSD } from '@/lib/utils';
import { useWallet } from '@/contexts/wallet-context';
import { useSwapTokens } from '@/contexts/swap-tokens-context';

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

    // Get balances for the current token
    const fromTokenBalance = balances[selectedFromToken?.contractId!];

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
        if (mode !== 'order' && selectedFromToken) {
            // Toggle between mainnet and subnet versions
            const baseId = selectedFromToken.type === 'SUBNET'
                ? selectedFromToken.base!
                : selectedFromToken.contractId;
            const counterparts = tokenCounterparts.get(baseId);

            if (counterparts) {
                const targetToken = useSubnetFrom ? counterparts.mainnet : counterparts.subnet;
                if (targetToken) {
                    setSelectedFromTokenSafe(targetToken);
                    setBaseSelectedFromToken(targetToken);
                    setUseSubnetFrom(!useSubnetFrom);
                }
            }
        }
    };

    const handleSetMax = () => {
        if (!selectedFromToken) return;

        setDisplayAmount(fromTokenBalance.balance);
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
                    <div className="text-xs text-muted-foreground flex items-center gap-1 bg-background/40 px-2 py-0.5 rounded-full self-start">
                        Balance: <span className="font-semibold text-foreground">{fromTokenBalance?.balance}</span> {selectedFromToken.symbol}
                        {/* Conditionally render Flame toggle */}
                        {hasBothVersionsForToken && (
                            <button
                                onClick={isToggleDisabled ? undefined : handleToggleSubnet}
                                className={`ml-1 p-0.5 rounded-full transition-colors ${isToggleDisabled
                                    ? 'cursor-default opacity-75'
                                    : 'cursor-pointer hover:bg-muted'
                                    } ${isSubnetSelected ? 'text-red-500' : 'text-muted-foreground/50'}`}
                                title={
                                    isToggleDisabled
                                        ? "Subnet tokens required in order mode"
                                        : isSubnetSelected
                                            ? "Using Subnet Token - Click to use Mainnet"
                                            : "Using Mainnet Token - Click to use Subnet"
                                }
                                disabled={isToggleDisabled}
                            >
                                <Flame size={14} />
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
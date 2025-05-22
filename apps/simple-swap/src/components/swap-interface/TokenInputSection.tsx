"use client";

import React, { useState } from 'react';
import type { Token } from '../../lib/_swap-client';
import TokenDropdown from '../TokenDropdown';
import { Flame, ChevronDown } from 'lucide-react';
import ConditionTokenChartWrapper from '../condition-token-chart-wrapper';

interface TokenInputSectionProps {
    label: string;
    selectedToken: Token | null;
    displayedToken: Token | null; // The token to show as selected in the dropdown (usually mainnet)
    displayAmount: string;
    onAmountChange: (value: string) => void;
    balance: string;
    displayTokens: Token[]; // Filtered list for the dropdown
    onSelectToken: (token: Token) => void; // Callback when base token is selected
    hasBothVersions: boolean;
    isSubnetSelected: boolean;
    onToggleSubnet: () => void;
    isLoadingPrice: boolean;
    tokenValueUsd: string | null; // Formatted USD value
    formatUsd: (value: number | null) => string | null; // USD formatting function
    onSetMax: () => void;
}

export default function TokenInputSection({
    label,
    selectedToken,
    displayedToken,
    displayAmount,
    onAmountChange,
    balance,
    displayTokens,
    onSelectToken,
    hasBothVersions,
    isSubnetSelected,
    onToggleSubnet,
    isLoadingPrice,
    tokenValueUsd,
    formatUsd,
    onSetMax,
}: TokenInputSectionProps) {
    const [showChart, setShowChart] = useState(false);

    return (
        <div className="bg-muted/20 rounded-2xl p-4 sm:p-5 mb-1 backdrop-blur-sm border border-muted/40 shadow-sm">
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
                        {/* Conditionally render Flame toggle */}
                        {hasBothVersions && (
                            <button
                                onClick={onToggleSubnet}
                                className={`cursor-pointer ml-1 p-0.5 rounded-full hover:bg-muted transition-colors ${isSubnetSelected ? 'text-red-500' : 'text-muted-foreground/50'}`}
                                title={isSubnetSelected ? "Using Subnet Token" : "Using Mainnet Token"}
                            >
                                <Flame size={14} />
                            </button>
                        )}
                        {Number(balance) > 0 && (
                            <button
                                className="ml-1 text-primary font-semibold bg-primary/10 px-1.5 rounded hover:bg-primary/20 transition-colors"
                                onClick={onSetMax}
                            >
                                MAX
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="flex justify-between items-center">
                <input
                    value={displayAmount}
                    onChange={(e) => {
                        const v = e.target.value;
                        if (/^[0-9]*\.?[0-9]*$/.test(v) || v === "") {
                            onAmountChange(v); // Call parent handler
                        }
                    }}
                    placeholder="0.00"
                    className="bg-transparent border-none text-xl sm:text-2xl font-medium focus:outline-none w-full placeholder:text-muted-foreground/50"
                />

                <div className="min-w-[120px] sm:min-w-[140px] shrink-0">
                    <TokenDropdown
                        tokens={displayTokens}
                        selected={displayedToken} // Use the base token for highlighting dropdown
                        onSelect={onSelectToken} // Call parent handler for selection
                        label=""
                    />
                </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1.5 h-4 flex items-center">
                {isLoadingPrice ? (
                    <div className="flex items-center space-x-1">
                        <span className="h-2 w-2 bg-primary/30 rounded-full animate-pulse"></span>
                        <span className="animate-pulse">Loading price...</span>
                    </div>
                ) : tokenValueUsd !== null ? (
                    // Use the passed formatted value directly
                    <span>~{tokenValueUsd}</span>
                ) : null}
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
"use client";

import React, { useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import TokenSelectorButton from './TokenSelectorButton';
import { useProModeContext } from '../../contexts/pro-mode-context';
import { useSwapContext } from '../../contexts/swap-context';
import SandwichCreationDialog from './SandwichCreationDialog';
import { TokenCacheData } from '@repo/tokens';

// Helper function to format token balance with dynamic precision
const formatTokenBalance = (balance: number, token: TokenCacheData): string => {
    const decimals = token.decimals || 6;

    if (balance === 0) return '0';
    if (balance < 0.001) {
        return balance.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: Math.min(decimals, 10)
        });
    } else if (balance < 1) {
        return balance.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: Math.min(decimals, 6)
        });
    } else {
        return balance.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: Math.min(decimals, 4)
        });
    }
};

export default function SandwichOrderForm() {
    const containerRef = useRef<HTMLDivElement>(null);
    const spreadInputRef = useRef<HTMLInputElement>(null);
    const currentSpreadRef = useRef<string>('');

    const {
        selectedOrderType,
        sandwichUsdAmount,
        setSandwichUsdAmount,
        sandwichBuyPrice,
        setSandwichBuyPrice,
        sandwichSellPrice,
        setSandwichSellPrice,
        sandwichSpread,
        setSandwichSpread,
        handleCreateSandwichOrder,
        isSubmitting,
        tradingPairBase,
        setTradingPairBase,
        handleSandwichSpreadChange,
    } = useProModeContext();

    const {
        selectedFromToken,
        setSelectedFromTokenSafe,
        selectedToToken,
        setSelectedToToken,
        displayTokens,
        fromTokenBalance,
        toTokenBalance,
        getUsdPrice,
        formatUsd,
        conditionToken,
        setConditionToken,
        allTokenBalances,
    } = useSwapContext();

    // Keep track of current spread value without causing re-renders
    useEffect(() => {
        currentSpreadRef.current = sandwichSpread;
    }, [sandwichSpread]);

    // Function to sync the current spread value to React state
    const syncSpreadToState = () => {
        if (currentSpreadRef.current !== sandwichSpread) {
            setSandwichSpread(currentSpreadRef.current);
        }
    };

    // Override the handleCreateSandwichOrder to sync spread before submission
    const handleCreateSandwichOrderWithSync = async () => {
        // Sync the spread value before creating the order
        syncSpreadToState();

        // Wait a tick for state to update
        await new Promise(resolve => setTimeout(resolve, 0));

        // Now create the order with the correct spread value
        await handleCreateSandwichOrder();
    };

    // Handle Ctrl/Cmd + mousewheel for spread adjustment
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            // Check if Ctrl (Windows/Linux) or Cmd (Mac) is pressed AND we're in sandwich mode
            if ((e.ctrlKey || e.metaKey) && selectedOrderType === 'sandwich') {
                console.log('Wheel event in sandwich mode:', { deltaY: e.deltaY, currentSpread: currentSpreadRef.current });

                e.preventDefault(); // Prevent page zoom
                e.stopPropagation(); // Stop the event from reaching the chart

                const currentSpread = parseFloat(currentSpreadRef.current) || 0;
                const delta = e.deltaY > 0 ? -0.5 : 0.5; // Scroll down decreases, scroll up increases
                const newSpread = Math.max(0, currentSpread + delta); // Ensure spread doesn't go below 0
                const newSpreadString = newSpread.toString();

                console.log('Updating spread from', currentSpread, 'to', newSpread);

                // Update the ref immediately to prevent stale values
                currentSpreadRef.current = newSpreadString;

                // Update the React context state
                setSandwichSpread(newSpreadString);

                // Update the input field directly without triggering React re-render
                const inputElement = spreadInputRef.current;
                if (inputElement) {
                    inputElement.value = newSpreadString;
                    console.log('✅ Updated input field to:', newSpreadString, 'DOM value:', inputElement.value);
                } else {
                    console.log('❌ spreadInputRef.current is null');
                }
            }
        };

        console.log('Adding wheel event listener to document');
        // Use capture phase to intercept events before they reach the chart
        document.addEventListener('wheel', handleWheel, { passive: false, capture: true });

        return () => {
            console.log('Removing wheel event listener from document');
            document.removeEventListener('wheel', handleWheel, true);
        };
    }, [selectedOrderType]); // Removed sandwichSpread and setSandwichSpread from dependencies

    return (
        <div ref={containerRef} className="grid grid-cols-3 gap-3 max-w-4xl">
            {/* USD Amount */}
            <div className="space-y-1">
                <label className="text-sm text-muted-foreground font-medium">USD Amount</label>
                <input
                    type="text"
                    value={sandwichUsdAmount}
                    onChange={(e) => setSandwichUsdAmount(e.target.value)}
                    placeholder="100.00"
                    className="w-full p-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground"
                />
                <div className="text-xs text-muted-foreground">
                    Total USD value for both buy and sell orders
                </div>
            </div>

            {/* Buy Price */}
            <div className="space-y-1">
                <label className="text-sm text-muted-foreground font-medium">Buy Price (USD)</label>
                <input
                    type="text"
                    value={sandwichBuyPrice}
                    onChange={(e) => setSandwichBuyPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground"
                />
                <div className="text-xs text-muted-foreground">
                    Price to trigger buy order
                </div>
            </div>

            {/* Sell Price */}
            <div className="space-y-1">
                <label className="text-sm text-muted-foreground font-medium">Sell Price (USD)</label>
                <input
                    type="text"
                    value={sandwichSellPrice}
                    onChange={(e) => setSandwichSellPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground"
                />
                <div className="text-xs text-muted-foreground">
                    Price to trigger sell order
                </div>
            </div>

            {/* From Token */}
            <div className="space-y-1">
                <label className="text-sm text-muted-foreground font-medium">From</label>
                <TokenSelectorButton
                    selectionType="from"
                    placeholder="Select input token"
                    className="w-full"
                />
                {selectedFromToken && (() => {
                    const balance = allTokenBalances.get(selectedFromToken.contractId);
                    if (balance !== undefined) {
                        const price = getUsdPrice(selectedFromToken.contractId);
                        return (
                            <div className="text-xs text-muted-foreground">
                                Balance: {formatTokenBalance(balance, selectedFromToken)} {selectedFromToken.symbol}
                                {price && balance > 0 ? ` (≈ ${formatUsd(price * balance)})` : ''}
                            </div>
                        );
                    }
                    return null;
                })()}
            </div>

            {/* To Token */}
            <div className="space-y-1">
                <label className="text-sm text-muted-foreground font-medium">To</label>
                <TokenSelectorButton
                    selectionType="to"
                    placeholder="Select output token"
                    className="w-full"
                />
                {selectedToToken && (() => {
                    const balance = allTokenBalances.get(selectedToToken.contractId);
                    if (balance !== undefined) {
                        const price = getUsdPrice(selectedToToken.contractId);
                        return (
                            <div className="text-xs text-muted-foreground">
                                Balance: {formatTokenBalance(balance, selectedToToken)} {selectedToToken.symbol}
                                {price && balance > 0 ? ` (≈ ${formatUsd(price * balance)})` : ''}
                            </div>
                        );
                    }
                    return null;
                })()}
            </div>

            {/* Spread Percentage */}
            <div className="space-y-1">
                <label className="text-sm text-muted-foreground font-medium">Spread (%)</label>
                <input
                    ref={spreadInputRef}
                    type="text"
                    value={sandwichSpread}
                    onChange={(e) => {
                        setSandwichSpread(e.target.value);
                        currentSpreadRef.current = e.target.value;
                    }}
                    onBlur={() => {
                        // Only sync on blur if user manually edited the field
                        if (spreadInputRef.current && spreadInputRef.current.value !== sandwichSpread) {
                            setSandwichSpread(spreadInputRef.current.value);
                            currentSpreadRef.current = spreadInputRef.current.value;
                        }
                    }}
                    placeholder="5"
                    className="w-full p-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground"
                />
                <div className="text-xs text-muted-foreground">
                    Percentage spread between buy and sell prices
                </div>
            </div>



            {/* Submit Button - spans all columns */}
            <div className="col-span-3 pt-4">
                <Button
                    onClick={handleCreateSandwichOrderWithSync}
                    disabled={!sandwichUsdAmount || !sandwichBuyPrice || !sandwichSellPrice || !selectedFromToken || !selectedToToken || isSubmitting}
                    className="w-full h-12 text-base font-medium"
                >
                    {isSubmitting ? 'Creating Sandwich Order...' : 'Create Sandwich Order'}
                </Button>
            </div>

            {/* Sandwich Creation Dialog */}
            <SandwichCreationDialog />
        </div>
    );
} 
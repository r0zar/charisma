"use client";

import React, { useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import TokenSelectorButton from './TokenSelectorButton';
import { useProModeContext } from '../../contexts/pro-mode-context';
import { useSwapContext } from '../../contexts/swap-context';
import SandwichCreationDialog from './SandwichCreationDialog';
import { TokenCacheData } from '@repo/tokens';
import { ArrowUpDown, Lock, Unlock } from 'lucide-react';

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
        lockTradingPairToSwapTokens,
        setLockTradingPairToSwapTokens,
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
        <div ref={containerRef} data-order-form="sandwich" className="space-y-6 max-w-6xl">
            {/* Horizontal Layout: Trigger Controls (Left) + Form Controls (Right) */}
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Left Side: Sandwich Order Trigger Controls */}
                {selectedFromToken && selectedToToken && (
                    <div className="lg:w-80 flex-shrink-0">
                        <div className="p-3 bg-muted/20 rounded-lg border border-border/40 h-fit">
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-sm text-muted-foreground font-medium">Sandwich Order Triggers</div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setLockTradingPairToSwapTokens(!lockTradingPairToSwapTokens)}
                                        className="text-muted-foreground hover:text-foreground h-6 w-6 p-0"
                                        title={lockTradingPairToSwapTokens ? "Unlock price triggers from swap tokens" : "Lock price triggers to swap tokens"}
                                    >
                                        {lockTradingPairToSwapTokens ? (
                                            <Lock className="w-3 h-3" />
                                        ) : (
                                            <Unlock className="w-3 h-3" />
                                        )}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            // Invert both buy and sell prices
                                            if (sandwichBuyPrice && !isNaN(parseFloat(sandwichBuyPrice)) && parseFloat(sandwichBuyPrice) > 0) {
                                                const buyPrice = parseFloat(sandwichBuyPrice);
                                                const invertedBuyPrice = 1 / buyPrice;
                                                setSandwichBuyPrice(invertedBuyPrice.toPrecision(9));
                                            }
                                            if (sandwichSellPrice && !isNaN(parseFloat(sandwichSellPrice)) && parseFloat(sandwichSellPrice) > 0) {
                                                const sellPrice = parseFloat(sandwichSellPrice);
                                                const invertedSellPrice = 1 / sellPrice;
                                                setSandwichSellPrice(invertedSellPrice.toPrecision(9));
                                            }
                                        }}
                                        className="h-6 w-6 p-0 hover:bg-muted"
                                        title="Invert price ratios"
                                    >
                                        <ArrowUpDown className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>

                            {/* Compact Grid Layout for Triggers */}
                            <div className="grid grid-cols-2 gap-3">
                                {/* A→B Trigger (Sell A for B) */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center space-x-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                                        <span className="text-xs text-muted-foreground font-medium">A→B (sell)</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <span className="text-xs">1 {selectedFromToken.symbol}</span>
                                        <span>≥</span>
                                        <span className="text-xs">{selectedToToken.symbol}</span>
                                    </div>
                                    <input
                                        type="text"
                                        value={sandwichBuyPrice}
                                        onChange={(e) => setSandwichBuyPrice(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full bg-transparent border border-border/40 rounded px-2 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/50"
                                    />
                                </div>

                                {/* B→A Trigger (Buy A with B) */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center space-x-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div>
                                        <span className="text-xs text-muted-foreground font-medium">B→A (buy)</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <span className="text-xs">1 {selectedFromToken.symbol}</span>
                                        <span>≤</span>
                                        <span className="text-xs">{selectedToToken.symbol}</span>
                                    </div>
                                    <input
                                        type="text"
                                        value={sandwichSellPrice}
                                        onChange={(e) => setSandwichSellPrice(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full bg-transparent border border-border/40 rounded px-2 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/50"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Right Side: Form Controls */}
                <div className="flex-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                                Total USD value for both swap orders
                            </div>
                        </div>

                        {/* Token A */}
                        <div className="space-y-1">
                            <label className="text-sm text-muted-foreground font-medium">Token A</label>
                            <TokenSelectorButton
                                selectionType="from"
                                placeholder="Select token A"
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

                        {/* Token B */}
                        <div className="space-y-1">
                            <label className="text-sm text-muted-foreground font-medium">Token B</label>
                            <TokenSelectorButton
                                selectionType="to"
                                placeholder="Select token B"
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
                                Percentage spread between trigger prices
                            </div>
                        </div>

                        {/* Submit Button - spans all columns */}
                        <div className="col-span-1 sm:col-span-2 lg:col-span-4 pt-4">
                            <Button
                                onClick={handleCreateSandwichOrderWithSync}
                                disabled={!sandwichUsdAmount || !sandwichBuyPrice || !sandwichSellPrice || !selectedFromToken || !selectedToToken || isSubmitting}
                                className="w-full h-12 text-base font-medium"
                            >
                                {isSubmitting ? 'Creating Sandwich Strategy...' : 'Create Sandwich Strategy'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sandwich Creation Dialog */}
            <SandwichCreationDialog />
        </div>
    );
} 
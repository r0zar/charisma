"use client";

import React, { useState } from 'react';
import { X, ArrowUpDown, Keyboard, Lock, Unlock } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import TokenSelectorButton from './TokenSelectorButton';
import { useProModeContext } from '../../contexts/pro-mode-context';
import { useSwapContext } from '../../contexts/swap-context';

export default function ProModeHeader() {
    const [showHotkeysDialog, setShowHotkeysDialog] = useState(false);

    const {
        selectedOrderType,
        tradingPairBase,
        setTradingPairBase,
        tradingPairQuote,
        setTradingPairQuote,
        targetPrice,
        setTargetPrice,
        conditionDir,
        setConditionDir,
        highlightedOrderId,
        clearHighlightedOrder,
        handlePriceChange,
        sandwichBuyPrice,
        setSandwichBuyPrice,
        sandwichSellPrice,
        setSandwichSellPrice,
        lockTradingPairToSwapTokens,
        setLockTradingPairToSwapTokens,
    } = useProModeContext();

    const {
        displayTokens,
        setIsProMode,
    } = useSwapContext();

    const hotkeys = [
        { key: 'Esc', description: 'Exit Pro mode' },
        { key: 'Tab', description: 'Switch between order types (forward)' },
        { key: 'Shift + Tab', description: 'Switch between order types (reverse)' },
        { key: 'Enter', description: 'Submit current order' },
        { key: 'Ctrl + S', description: 'Switch tokens' },
        ...(selectedOrderType === 'sandwich' ? [
            { key: 'Ctrl + Scroll', description: 'Adjust spread between A→B and B→A triggers' },
        ] : [
            { key: '↑ / ↓', description: 'Adjust price by 0.01' },
            { key: 'Shift + ↑ / ↓', description: 'Adjust price by 0.1' },
            { key: 'Ctrl + ↑ / ↓', description: 'Adjust price by 1' },
            { key: 'G', description: 'Toggle greater than condition' },
            { key: 'L', description: 'Toggle less than condition' },
        ]),
        { key: 'C', description: 'Clear highlighted order' },
    ];

    return (
        <>
            <div className="p-4 border-b border-border/40 flex items-center justify-between bg-card/30">
                <div className="flex items-center space-x-4">
                    <h1 className="text-2xl font-bold text-foreground">Pro Trading</h1>

                    {/* Conditional Logic Section - Trading Pair Selector */}
                    {tradingPairBase && tradingPairQuote && (
                        <>
                            {selectedOrderType === 'sandwich' ? (
                                /* Sandwich Mode - Show A→B and B→A Triggers */
                                <div className="flex items-center space-x-8">
                                    {/* Token Pair Display */}
                                    <div className="flex items-center space-x-2">
                                        <div className="text-sm text-muted-foreground font-medium">Trading</div>
                                        <div className="flex items-center space-x-1">
                                            <div className="">
                                                <TokenSelectorButton
                                                    selectionType="tradingPairBase"
                                                    placeholder="Token A"
                                                    size="sm"
                                                    disabled={lockTradingPairToSwapTokens}
                                                />
                                            </div>
                                            <span className="text-muted-foreground px-2">⇄</span>
                                            <div className="">
                                                <TokenSelectorButton
                                                    selectionType="tradingPairQuote"
                                                    placeholder="Token B"
                                                    size="sm"
                                                    disabled={lockTradingPairToSwapTokens}
                                                />
                                            </div>
                                        </div>
                                    </div>



                                    <div className="">

                                        {/* A→B Trigger */}
                                        <div className="flex items-center space-x-2">
                                            <div className="flex items-center space-x-1">
                                                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                                <span className="text-sm text-muted-foreground font-medium">A→B (sell):</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {tradingPairQuote && tradingPairBase && (
                                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                        1 {tradingPairBase.symbol}
                                                    </span>
                                                )}
                                                <span className="text-xs text-muted-foreground">
                                                    ≥
                                                </span>
                                                <input
                                                    type="text"
                                                    value={sandwichBuyPrice}
                                                    onChange={(e) => setSandwichBuyPrice(e.target.value)}
                                                    placeholder="0.00"
                                                    className="w-24 bg-transparent border-none text-sm font-medium focus:outline-none placeholder:text-muted-foreground/50"
                                                />
                                                {tradingPairQuote && tradingPairBase && (
                                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {tradingPairQuote.symbol}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* B→A Trigger */}
                                        <div className="flex items-center space-x-2">
                                            <div className="flex items-center space-x-1">
                                                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                                                <span className="text-sm text-muted-foreground font-medium">B→A (buy):</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {tradingPairQuote && tradingPairBase && (
                                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                        1 {tradingPairBase.symbol}
                                                    </span>
                                                )}
                                                <span className="text-xs text-muted-foreground">
                                                    ≤
                                                </span>
                                                <input
                                                    type="text"
                                                    value={sandwichSellPrice}
                                                    onChange={(e) => setSandwichSellPrice(e.target.value)}
                                                    placeholder="0.00"
                                                    className="w-24 bg-transparent border-none text-sm font-medium focus:outline-none placeholder:text-muted-foreground/50"
                                                />
                                                {tradingPairQuote && tradingPairBase && (
                                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {tradingPairQuote.symbol}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            ) : (
                                /* Traditional Mode - Show gt/lt Logic */
                                <div className="flex items-center space-x-4">
                                    {/* When Label */}
                                    <div className="text-sm text-muted-foreground font-medium">When</div>

                                    {/* Condition Token */}
                                    <div className="w-32">
                                        <TokenSelectorButton
                                            selectionType="tradingPairBase"
                                            placeholder="Base"
                                            size="sm"
                                            disabled={lockTradingPairToSwapTokens}
                                        />
                                    </div>

                                    {/* Direction Toggle */}
                                    <div className="flex items-center border border-border/40 rounded-md overflow-hidden text-xs select-none shrink-0 whitespace-nowrap">
                                        {[
                                            { key: 'gt', label: 'is greater than' },
                                            { key: 'lt', label: 'is less than' },
                                        ].map(({ key, label }) => (
                                            <button
                                                key={key}
                                                className={`px-2.5 py-1 whitespace-nowrap transition-colors ${conditionDir === key
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'bg-transparent hover:bg-muted'
                                                    }`}
                                                onClick={() => setConditionDir(key as 'lt' | 'gt')}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Price Input with +/- buttons */}
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="text"
                                            value={targetPrice}
                                            onChange={(e) => handlePriceChange(e.target.value)}
                                            placeholder="0.00"
                                            className="w-36 bg-transparent border-none text-lg font-medium focus:outline-none placeholder:text-muted-foreground/50"
                                        />
                                        <div className="flex flex-row gap-0.5 shrink-0">
                                            <button
                                                onClick={() => {
                                                    const currentPrice = parseFloat(targetPrice) || 0;
                                                    setTargetPrice((currentPrice + 0.01).toString());
                                                }}
                                                className="cursor-pointer hover:bg-muted-foreground/10 text-xs px-1.5 py-0.5 bg-muted-foreground/5 rounded"
                                            >
                                                +
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const currentPrice = parseFloat(targetPrice) || 0;
                                                    const newPrice = Math.max(0, currentPrice - 0.01);
                                                    setTargetPrice(newPrice.toString());
                                                }}
                                                className="cursor-pointer hover:bg-muted-foreground/10 text-xs px-1.5 py-0.5 bg-muted-foreground/5 rounded"
                                            >
                                                -
                                            </button>
                                        </div>
                                    </div>

                                    {/* Base Token (Quote) */}
                                    <div className="w-32">
                                        <TokenSelectorButton
                                            selectionType="tradingPairQuote"
                                            placeholder="Quote"
                                            size="sm"
                                            disabled={lockTradingPairToSwapTokens}
                                        />
                                    </div>


                                </div>
                            )}
                        </>
                    )}

                    {/* Switch Trading Pair Button - shown for all order types */}
                    {tradingPairBase && tradingPairQuote && (
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={lockTradingPairToSwapTokens}
                            onClick={() => {
                                // Swap the trading pair tokens
                                const tempBase = tradingPairBase;
                                setTradingPairBase(tradingPairQuote);
                                setTradingPairQuote(tempBase);

                                // Invert the target price if it exists for traditional mode
                                if (selectedOrderType !== 'sandwich' && targetPrice && !isNaN(parseFloat(targetPrice)) && parseFloat(targetPrice) > 0) {
                                    const currentPrice = parseFloat(targetPrice);
                                    const invertedPrice = 1 / currentPrice;
                                    setTargetPrice(invertedPrice.toPrecision(9));
                                }

                                // For sandwich mode, invert both buy and sell prices
                                if (selectedOrderType === 'sandwich') {
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
                                }
                            }}
                            style={{ padding: 0 }}
                            className="h-8 w-8 hover:bg-muted"
                            title={lockTradingPairToSwapTokens ? "Switch disabled (unlock first)" : "Switch trading pair (invert ratio)"}
                        >
                            <ArrowUpDown className="w-4 h-4" />
                        </Button>
                    )}

                    {/* Show All Orders Button - appears when an order is highlighted */}
                    {highlightedOrderId && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={clearHighlightedOrder}
                            className="text-xs h-8 px-3"
                        >
                            Show All Orders
                        </Button>
                    )}
                </div>

                {/* Right Side - Action Buttons */}
                <div className="flex items-center space-x-2">
                    {/* Lock/Unlock Button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLockTradingPairToSwapTokens(!lockTradingPairToSwapTokens)}
                        className="text-muted-foreground hover:text-foreground"
                        title={lockTradingPairToSwapTokens ? "Unlock price ratio from swap tokens" : "Lock price ratio to swap tokens"}
                    >
                        {lockTradingPairToSwapTokens ? (
                            <Lock className="w-4 h-4" />
                        ) : (
                            <Unlock className="w-4 h-4" />
                        )}
                    </Button>

                    {/* Hotkeys Button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowHotkeysDialog(true)}
                        className="text-muted-foreground hover:text-foreground"
                        title="View keyboard shortcuts"
                    >
                        <Keyboard className="w-4 h-4" />
                    </Button>

                    {/* Close Button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsProMode(false)}
                        className="text-muted-foreground hover:text-foreground"
                        title="Exit Pro mode (Esc)"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Hotkeys Dialog */}
            <Dialog open={showHotkeysDialog} onOpenChange={setShowHotkeysDialog}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Keyboard className="w-5 h-5" />
                            Keyboard Shortcuts
                        </DialogTitle>
                        <DialogDescription>
                            Use these keyboard shortcuts to navigate Pro mode efficiently.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 max-h-[80vh] overflow-y-auto">
                        {hotkeys.map((hotkey, index) => (
                            <div key={index} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                                <span className="text-sm text-muted-foreground">{hotkey.description}</span>
                                <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded border">
                                    {hotkey.key}
                                </kbd>
                            </div>
                        ))}
                    </div>

                    <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border/20">
                        Click the keyboard icon in the header to view these shortcuts
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
} 
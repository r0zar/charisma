"use client";

import React from 'react';
import { Button } from '../ui/button';
import TokenSelectorButton from './TokenSelectorButton';
import SingleOrderCreationDialog from './SingleOrderCreationDialog';
import { useProModeContext } from '../../contexts/pro-mode-context';
import { useSwapContext } from '../../contexts/swap-context';
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

export default function SingleOrderForm() {
    const {
        displayAmount,
        setDisplayAmount,
        targetPrice,
        setTargetPrice,
        handlePriceChange,
        handleCreateLimitOrder,
        isSubmitting,
        tradingPairBase,
        setTradingPairBase,
        tradingPairQuote,
        setTradingPairQuote,
        conditionDir,
        setConditionDir,
        lockTradingPairToSwapTokens,
        setLockTradingPairToSwapTokens,
        currentPrice,
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

    return (
        <div data-order-form="single" className="space-y-6 max-w-6xl">
            {/* Horizontal Layout: Condition Controls (Left) + Form Controls (Right) */}
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Left Side: Limit Order Condition Controls */}
                {selectedFromToken && selectedToToken && (
                    <div className="lg:w-80 flex-shrink-0">
                        <div className="p-4 bg-muted/20 rounded-lg border border-border/40 h-fit">
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-sm text-muted-foreground font-medium">Limit Order Condition</div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setLockTradingPairToSwapTokens(!lockTradingPairToSwapTokens)}
                                        className="text-muted-foreground hover:text-foreground h-6 w-6 p-0"
                                        title={lockTradingPairToSwapTokens ? "Unlock price condition from swap tokens" : "Lock price condition to swap tokens"}
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
                                            // Invert the target price if it exists
                                            if (targetPrice && !isNaN(parseFloat(targetPrice)) && parseFloat(targetPrice) > 0) {
                                                const currentPrice = parseFloat(targetPrice);
                                                const invertedPrice = 1 / currentPrice;
                                                setTargetPrice(invertedPrice.toPrecision(9));
                                            }
                                        }}
                                        className="h-6 w-6 p-0 hover:bg-muted"
                                        title="Invert price ratio"
                                    >
                                        <ArrowUpDown className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>

                            {/* Condition Logic - Vertical Layout for better fit */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-muted-foreground font-medium">When</span>
                                    <span className="font-medium">{selectedFromToken.symbol}</span>
                                </div>

                                {/* Direction Toggle */}
                                <div className="flex items-center border border-border/40 rounded-md overflow-hidden text-xs select-none">
                                    {[
                                        { key: 'gt', label: 'is greater than' },
                                        { key: 'lt', label: 'is less than' },
                                    ].map(({ key, label }) => (
                                        <button
                                            key={key}
                                            className={`flex-1 px-3 py-2 whitespace-nowrap transition-colors ${conditionDir === key
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-transparent hover:bg-muted'
                                                }`}
                                            onClick={() => setConditionDir(key as 'lt' | 'gt')}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>

                                {/* Price Input */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="text"
                                            value={targetPrice}
                                            onChange={(e) => handlePriceChange(e.target.value)}
                                            placeholder="0.00"
                                            className="flex-1 bg-transparent border border-border/40 rounded px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50"
                                        />
                                        <div className="flex flex-col gap-0.5 shrink-0">
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
                                    <div className="text-sm font-medium text-center">
                                        {selectedToToken.symbol}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Right Side: Form Controls */}
                <div className="flex-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Amount */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm text-muted-foreground font-medium">Amount</label>
                                {selectedFromToken && (
                                    <button
                                        onClick={() => {
                                            const balance = allTokenBalances.get(selectedFromToken.contractId);
                                            if (balance && balance > 0) {
                                                setDisplayAmount(balance.toString());
                                            }
                                        }}
                                        className="text-xs text-primary hover:text-primary/80 font-medium"
                                    >
                                        Max
                                    </button>
                                )}
                            </div>
                            <input
                                type="text"
                                value={displayAmount}
                                onChange={(e) => setDisplayAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full p-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground"
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

                        {/* From Token */}
                        <div className="space-y-2">
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
                        <div className="space-y-2">
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

                        {/* Submit Button - spans all columns */}
                        <div className="col-span-1 sm:col-span-2 lg:col-span-3 pt-4 space-y-2">
                            {!targetPrice && selectedFromToken && selectedToToken && (
                                <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                                    <div className="text-sm text-blue-800 dark:text-blue-200">
                                        <strong>📊 Click on the chart</strong> to set your target price for the limit order
                                    </div>
                                </div>
                            )}
                            <Button
                                onClick={handleCreateLimitOrder}
                                disabled={!displayAmount || !selectedFromToken || !selectedToToken || !targetPrice || isSubmitting}
                                className="w-full h-12 text-base font-medium"
                            >
                                {isSubmitting ? 'Creating Order...' :
                                    !targetPrice ? 'Set Target Price on Chart First' : 'Create Limit Order'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Order Creation Dialog */}
            <SingleOrderCreationDialog />
        </div>
    );
} 
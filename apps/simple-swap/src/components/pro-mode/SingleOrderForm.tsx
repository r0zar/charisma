"use client";

import React from 'react';
import { Button } from '../ui/button';
import TokenSelectorButton from './TokenSelectorButton';
import SingleOrderCreationDialog from './SingleOrderCreationDialog';
import { useProModeContext } from '../../contexts/pro-mode-context';
import { useSwapContext } from '../../contexts/swap-context';
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
        <div className="grid grid-cols-3 gap-6 max-w-4xl">
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
            <div className="col-span-3 pt-4">
                <Button
                    onClick={handleCreateLimitOrder}
                    disabled={!displayAmount || !selectedFromToken || !selectedToToken || !targetPrice || isSubmitting}
                    className="w-full h-12 text-base font-medium"
                >
                    {isSubmitting ? 'Creating Order...' : 'Create Limit Order'}
                </Button>
            </div>

            {/* Order Creation Dialog */}
            <SingleOrderCreationDialog />
        </div>
    );
} 
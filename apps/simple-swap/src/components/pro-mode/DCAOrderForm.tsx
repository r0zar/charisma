"use client";

import React from 'react';
import { Button } from '../ui/button';
import TokenSelectorButton from './TokenSelectorButton';
import DateTimePicker from '../ui/date-time-picker';
import DCACreationDialog from './DCACreationDialog';
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

export default function DCAOrderForm() {
    const {
        dcaAmount,
        setDcaAmount,
        dcaFrequency,
        setDcaFrequency,
        dcaDuration,
        setDcaDuration,
        dcaStartDate,
        setDcaStartDate,
        handleCreateDcaOrder,
        isSubmitting,
        tradingPairBase,
        setTradingPairBase,
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
        <div data-order-form="dca" className="grid grid-cols-3 gap-3 max-w-4xl">
            {/* Total Amount */}
            <div className="space-y-1">
                <div className="flex items-center justify-between">
                    <label className="text-sm text-muted-foreground font-medium">Total Amount</label>
                    {selectedFromToken && (
                        <button
                            onClick={() => {
                                const balance = allTokenBalances.get(selectedFromToken.contractId);
                                if (balance && balance > 0) {
                                    setDcaAmount(balance.toString());
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
                    value={dcaAmount}
                    onChange={(e) => setDcaAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground"
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

            {/* Frequency */}
            <div className="space-y-1">
                <label className="text-sm text-muted-foreground font-medium">Frequency</label>
                <select
                    value={dcaFrequency}
                    onChange={(e) => setDcaFrequency(e.target.value)}
                    className="w-full p-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                >
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                </select>
            </div>

            {/* Occurrences */}
            <div className="space-y-1">
                <label className="text-sm text-muted-foreground font-medium">Occurrences</label>
                <input
                    type="number"
                    value={dcaDuration}
                    onChange={(e) => setDcaDuration(e.target.value)}
                    placeholder="12"
                    min="1"
                    max="100"
                    className="w-full p-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground"
                />
            </div>

            {/* Start Date */}
            <div className="space-y-1">
                <label className="text-sm text-muted-foreground font-medium">Start Date</label>
                <DateTimePicker
                    value={dcaStartDate}
                    onChange={setDcaStartDate}
                    placeholder="Start immediately"
                    className="p-2 h-auto"
                />
                <div className="text-xs text-muted-foreground">
                    Leave empty to start immediately
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

            {/* Submit Button - spans all columns */}
            <div className="col-span-3 pt-4">
                <Button
                    onClick={handleCreateDcaOrder}
                    disabled={!dcaAmount || !selectedFromToken || !selectedToToken || !dcaFrequency || !dcaDuration || isSubmitting}
                    className="w-full h-12 text-base font-medium"
                >
                    {isSubmitting ? 'Creating DCA Strategy...' : 'Create DCA Strategy'}
                </Button>
            </div>

            {/* DCA Creation Dialog */}
            <DCACreationDialog />
        </div>
    );
} 
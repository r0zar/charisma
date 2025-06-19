"use client";

import React from 'react';
import { Button } from '../ui/button';
import TokenSelectorButton from './TokenSelectorButton';
import DateTimePicker from '../ui/date-time-picker';
import DCACreationDialog from './DCACreationDialog';
import { useProModeContext } from '../../contexts/pro-mode-context';
import { TokenCacheData } from '@repo/tokens';
import { useSwapTokens } from '@/contexts/swap-tokens-context';
import { useBlaze } from 'blaze-sdk';

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
        targetPrice,
    } = useProModeContext();

    const {
        selectedFromToken,
        selectedToToken,
    } = useSwapTokens();

    const {
        balances,
        getPrice,
    } = useBlaze();

    return (
        <div data-order-form="dca" className="grid grid-cols-3 gap-3 max-w-4xl">
            {/* Total Amount */}
            <div className="space-y-1">
                <div className="flex items-center justify-between">
                    <label className="text-sm text-muted-foreground font-medium">Total Amount</label>
                    {selectedFromToken && (
                        <button
                            onClick={() => {
                                const balance = balances[selectedFromToken.contractId];
                                if (balance && Number(balance.balance) > 0) {
                                    setDcaAmount(balance.balance);
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
                    const balance = balances[selectedFromToken.contractId];
                    if (balance !== undefined) {
                        const price = getPrice(selectedFromToken.contractId);
                        return (
                            <div className="text-xs text-muted-foreground">
                                Balance: {formatTokenBalance(Number(balance.balance), selectedFromToken)} {selectedFromToken.symbol}
                                {price && Number(balance.balance) > 0 ? ` (≈ ${price * Number(balance.balance)})` : ''}
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
                    <option value="1minute">Every Minute</option>
                    <option value="5minutes">Every 5 Minutes</option>
                    <option value="15minutes">Every 15 Minutes</option>
                    <option value="30minutes">Every 30 Minutes</option>
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
                    const balance = balances[selectedFromToken.contractId];
                    if (balance !== undefined) {
                        const price = getPrice(selectedFromToken.contractId);
                        return (
                            <div className="text-xs text-muted-foreground">
                                Balance: {formatTokenBalance(Number(balance.balance), selectedFromToken)} {selectedFromToken.symbol}
                                {price && Number(balance.balance) > 0 ? ` (≈ ${price * Number(balance.balance)})` : ''}
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
                    const balance = balances[selectedToToken.contractId];
                    if (balance !== undefined) {
                        const price = getPrice(selectedToToken.contractId);
                        return (
                            <div className="text-xs text-muted-foreground">
                                Balance: {formatTokenBalance(Number(balance.balance), selectedToToken)} {selectedToToken.symbol}
                                {price && Number(balance.balance) > 0 ? ` (≈ ${price * Number(balance.balance)})` : ''}
                            </div>
                        );
                    }
                    return null;
                })()}
            </div>

            {/* Submit Button - spans all columns */}
            <div className="col-span-3 pt-4 space-y-2">
                {!targetPrice && selectedFromToken && selectedToToken && (
                    <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="text-sm text-blue-800 dark:text-blue-200">
                            <strong>📊 Click on the chart</strong> to set your target price for DCA execution
                        </div>
                    </div>
                )}
                <Button
                    onClick={handleCreateDcaOrder}
                    disabled={!dcaAmount || !selectedFromToken || !selectedToToken || !dcaFrequency || !dcaDuration || !targetPrice || isSubmitting}
                    className="w-full h-12 text-base font-medium"
                >
                    {isSubmitting ? 'Creating DCA Strategy...' :
                        !targetPrice ? 'Set Target Price on Chart First' : 'Create DCA Strategy'}
                </Button>
            </div>

            {/* DCA Creation Dialog */}
            <DCACreationDialog />
        </div>
    );
} 
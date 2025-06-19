"use client";

import React from 'react';
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

export default function DCAOrderPreview() {
    const {
        dcaAmount,
        dcaFrequency,
        dcaDuration,
    } = useProModeContext();

    const {
        selectedFromToken,
        selectedToToken,
    } = useSwapTokens();

    const {
        getPrice,
    } = useBlaze();

    const hasValidData = dcaAmount && selectedFromToken && selectedToToken && dcaFrequency && dcaDuration;

    // Calculate DCA strategy details
    const getIntervalHours = () => {
        switch (dcaFrequency) {
            case '1minute': return 1 / 60; // 1 minute = 0.0167 hours
            case '5minutes': return 5 / 60; // 5 minutes = 0.0833 hours
            case '15minutes': return 15 / 60; // 15 minutes = 0.25 hours
            case '30minutes': return 30 / 60; // 30 minutes = 0.5 hours
            case 'hourly': return 1;
            case 'daily': return 24;
            case 'weekly': return 168;
            case 'monthly': return 720; // 30 days * 24 hours
            default: return 24;
        }
    };

    const calculateDCADetails = () => {
        if (!hasValidData) return null;

        const intervalHours = getIntervalHours();
        const numberOfOrders = parseInt(dcaDuration); // dcaDuration now represents number of occurrences
        const amountPerOrder = parseFloat(dcaAmount) / numberOfOrders;
        const totalDurationHours = numberOfOrders * intervalHours;
        const totalDurationDays = Math.ceil(totalDurationHours / 24);

        return {
            numberOfOrders,
            amountPerOrder,
            intervalHours,
            totalDurationDays,
        };
    };

    const dcaDetails = calculateDCADetails();

    if (!hasValidData || !dcaDetails) {
        return (
            <div className="w-full xl:w-80 xl:flex-shrink-0">
                <div className="bg-background/60 border border-border/60 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-3">
                        <h4 className="font-semibold text-foreground">DCA Strategy Preview</h4>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        Enter DCA parameters to see strategy preview
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full xl:w-80 xl:flex-shrink-0">
            <div className="bg-background/60 border border-border/60 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                    <h4 className="font-semibold text-foreground">DCA Strategy Preview</h4>
                </div>

                <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Total Amount:</span>
                        <span className="font-mono text-foreground">
                            {formatTokenBalance(parseFloat(dcaAmount), selectedFromToken)} {selectedFromToken.symbol}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Number of Orders:</span>
                        <span className="font-mono text-foreground">
                            {dcaDetails.numberOfOrders}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Amount per Order:</span>
                        <span className="font-mono text-foreground">
                            {formatTokenBalance(dcaDetails.amountPerOrder, selectedFromToken)} {selectedFromToken.symbol}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Frequency:</span>
                        <span className="font-mono text-foreground">
                            {(() => {
                                switch (dcaFrequency) {
                                    case '1minute': return 'Every Minute';
                                    case '5minutes': return 'Every 5 Minutes';
                                    case '15minutes': return 'Every 15 Minutes';
                                    case '30minutes': return 'Every 30 Minutes';
                                    case 'hourly': return 'Hourly';
                                    case 'daily': return 'Daily';
                                    case 'weekly': return 'Weekly';
                                    case 'monthly': return 'Monthly';
                                    default: return dcaFrequency;
                                }
                            })()}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Total Duration:</span>
                        <span className="font-mono text-foreground">
                            {dcaDetails.totalDurationDays} days
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">USD Value:</span>
                        <span className="font-mono text-foreground">
                            {(() => {
                                const amount = parseFloat(dcaAmount);
                                const price = getPrice(selectedFromToken.contractId);
                                if (price && amount > 0) {
                                    return `≈ $${(price * amount).toFixed(2)}`;
                                }
                                return '—';
                            })()}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
} 
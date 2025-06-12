"use client";

import React from 'react';
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

export default function SingleOrderPreview() {
    const {
        displayAmount,
        targetPrice,
        conditionDir,
        getTokenPrice,
    } = useProModeContext();

    const {
        selectedFromToken,
        selectedToToken,
        getUsdPrice,
        formatUsd,
    } = useSwapContext();

    const hasValidData = displayAmount && selectedFromToken && selectedToToken && targetPrice;

    if (!hasValidData) {
        return (
            <div className="w-full xl:w-80 xl:flex-shrink-0">
                <div className="bg-background/60 border border-border/60 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-3">
                        <h4 className="font-semibold text-foreground">Order Preview</h4>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        Enter amount and target price to see preview
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full xl:w-80 xl:flex-shrink-0">
            <div className="bg-background/60 border border-border/60 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                    <h4 className="font-semibold text-foreground">Order Preview</h4>
                </div>

                <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Spending:</span>
                        <span className="font-mono text-foreground">
                            {formatTokenBalance(parseFloat(displayAmount), selectedFromToken)} {selectedFromToken.symbol}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Target Price:</span>
                        <span className="font-mono text-foreground">
                            {conditionDir === 'gt' ? '≥' : '≤'} ${parseFloat(targetPrice).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 8
                            })}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">USD Value:</span>
                        <span className="font-mono text-foreground">
                            {(() => {
                                const amount = parseFloat(displayAmount);
                                const price = getUsdPrice(selectedFromToken.contractId);
                                if (price && amount > 0) {
                                    return `≈ ${formatUsd(price * amount)}`;
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
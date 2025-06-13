"use client";

import React from 'react';
import { useProModeContext } from '../../contexts/pro-mode-context';
import { useSwapContext } from '../../contexts/swap-context';
import { TokenCacheData } from '@repo/tokens';

export default function SandwichOrderPreview() {
    const {
        sandwichUsdAmount,
        sandwichBuyPrice,
        sandwichSellPrice,
        tradingPairBase,
        tradingPairQuote,
    } = useProModeContext();

    const {
        selectedFromToken,
        selectedToToken,
        getUsdPrice,
        fetchHistoricalPrices,
        formatTokenAmount,
    } = useSwapContext();

    const hasValidData = sandwichUsdAmount && sandwichBuyPrice && sandwichSellPrice && selectedFromToken && selectedToToken && tradingPairBase && tradingPairQuote;

    if (!hasValidData) {
        return (
            <div className="w-80 flex-shrink-0">
                <div className="bg-background/60 border border-border/60 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-3">
                        <h4 className="font-semibold text-foreground">Strategy Preview</h4>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        Enter USD amount and trigger prices to see strategy preview
                    </div>
                </div>
            </div>
        );
    }

    const usdAmount = parseFloat(sandwichUsdAmount);
    const lowPriceTrigger = parseFloat(sandwichBuyPrice);
    const highPriceTrigger = parseFloat(sandwichSellPrice);

    // Get token prices with fallback to base token for subnet tokens
    const getTokenPriceWithFallback = (token: TokenCacheData): number | null => {
        // Use the context's getUsdPrice which already includes subnet fallback logic
        const price = getUsdPrice(token.contractId);

        // If still no price, trigger historical price fetch and return null
        if (!price) {
            // Trigger historical price fetch for this token
            fetchHistoricalPrices([token.contractId]);
            return null;
        }

        return price;
    };

    const tokenAPrice = getTokenPriceWithFallback(selectedFromToken);
    const tokenBPrice = getTokenPriceWithFallback(selectedToToken);

    // If we don't have prices yet, show loading state
    if (tokenAPrice === null || tokenBPrice === null) {
        return (
            <div className="w-80 flex-shrink-0">
                <div className="bg-background/60 border border-border/60 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-3">
                        <h4 className="font-semibold text-foreground">Strategy Preview</h4>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        Loading price data...
                    </div>
                </div>
            </div>
        );
    }

    // Calculate token amounts (input amounts for each order)
    // A→B swap: Input amount is tokenA, we want to spend $usdAmount worth of tokenA
    const aToBAAmount = usdAmount / tokenAPrice; // Amount of tokenA to spend
    // B→A swap: Input amount is tokenB, we want to sell $usdAmount worth of tokenB
    const bToAAAmount = usdAmount / tokenBPrice; // Amount of tokenB to sell

    // Calculate profit estimate
    const calculateProfit = () => {
        if (lowPriceTrigger > 0 && highPriceTrigger > 0) {
            // Calculate tokens bought and sold
            const tokensBought = usdAmount / lowPriceTrigger;
            const tokensValue = tokensBought * highPriceTrigger;
            const profit = tokensValue - usdAmount;
            const profitPercentage = (profit / usdAmount) * 100;

            return {
                profit,
                profitPercentage,
                isPositive: profit >= 0,
            };
        }
        return { profit: 0, profitPercentage: 0, isPositive: true };
    };

    const profitData = calculateProfit();

    // Helper function to format token amounts with proper decimals
    const formatTokenAmountDisplay = (amount: number, token: TokenCacheData): string => {
        const decimals = token.decimals || 6;

        // For very small amounts, show more precision
        if (amount < 0.001) {
            return amount.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: Math.min(decimals, 10)
            });
        }
        // For normal amounts, show reasonable precision
        else if (amount < 1) {
            return amount.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: Math.min(decimals, 6)
            });
        }
        // For larger amounts, show fewer decimals
        else {
            return amount.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: Math.min(decimals, 4)
            });
        }
    };

    // Helper function to format prices with appropriate precision
    const formatPriceDisplay = (price: number): string => {
        if (price < 0.000001) {
            return price.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 12
            });
        } else if (price < 0.01) {
            return price.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 8
            });
        } else if (price < 1) {
            return price.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 6
            });
        } else {
            return price.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4
            });
        }
    };

    return (
        <div className="w-full xl:w-96 xl:flex-shrink-0">
            <div className="bg-background/60 border border-border/60 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                    <h4 className="font-semibold text-foreground">Calculated Amounts</h4>
                </div>

                <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-medium">A→B Swap (sell {selectedFromToken.symbol}):</span>
                        <span className="font-mono text-foreground">
                            {formatTokenAmountDisplay(aToBAAmount, selectedFromToken)} {selectedFromToken.symbol}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-medium">B→A Swap (buy {selectedFromToken.symbol}):</span>
                        <span className="font-mono text-foreground">
                            {formatTokenAmountDisplay(bToAAAmount, selectedToToken)} {selectedToToken.symbol}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-medium">A→B Trigger (sell):</span>
                        <span className="font-mono text-foreground">
                            1 {tradingPairQuote.symbol} ≥ {formatPriceDisplay(highPriceTrigger)} {tradingPairBase.symbol}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-medium">B→A Trigger (buy):</span>
                        <span className="font-mono text-foreground">
                            1 {tradingPairQuote.symbol} ≤ {formatPriceDisplay(lowPriceTrigger)} {tradingPairBase.symbol}
                        </span>
                    </div>

                    {/* Current Token Prices for debugging */}
                    <div className="border-t border-border/30 pt-3 mt-3">
                        <div className="text-xs text-muted-foreground mb-2">Current Prices:</div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Token A ({selectedFromToken.symbol}):</span>
                            <span className="font-mono text-foreground">
                                ${formatPriceDisplay(tokenAPrice)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Token B ({selectedToToken.symbol}):</span>
                            <span className="font-mono text-foreground">
                                ${formatPriceDisplay(tokenBPrice)}
                            </span>
                        </div>
                    </div>

                    {/* Profit Estimate */}
                    <div className="border-t border-border/30 pt-3 mt-3">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground font-medium">Estimated Profit:</span>
                            <span className="font-mono text-foreground">
                                <span className={profitData.isPositive ? 'text-foreground' : 'text-muted-foreground'}>
                                    {profitData.isPositive ? '+' : ''}${profitData.profit.toFixed(2)} ({profitData.isPositive ? '+' : ''}{profitData.profitPercentage.toFixed(2)}%)
                                </span>
                            </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                            Based on price difference between trigger levels
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 
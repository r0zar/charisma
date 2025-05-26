"use client";

import React, { useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import { useProModeContext } from '../../contexts/pro-mode-context';
import { useSwapContext } from '../../contexts/swap-context';
// Import the existing ProModeChart component
import OriginalProModeChart from '../swap-interface/ProModeChart';

export default function ProModeChart() {
    const {
        tradingPairBase,
        tradingPairQuote,
        targetPrice,
        setTargetPrice,
        pairFilteredOrders,
        highlightedOrderId,
        conditionDir,
        selectedOrderType,
        sandwichBuyPrice,
        sandwichSellPrice,
        setSandwichBuyPrice,
        setSandwichSellPrice,
        sandwichSpread,
        setCurrentPrice,
    } = useProModeContext();

    const { conditionToken, selectedToToken } = useSwapContext();

    // Use the condition token or selected to token for the chart
    const chartToken = conditionToken || selectedToToken;

    // Trigger chart resize when order type changes to ensure proper layout
    useEffect(() => {
        // Small delay to allow the DOM to update first
        const timeoutId = setTimeout(() => {
            // Dispatch a resize event to trigger chart recalculation
            window.dispatchEvent(new Event('resize'));
        }, 100);

        return () => clearTimeout(timeoutId);
    }, [selectedOrderType]);

    return (
        <div className="flex-1 p-4 flex flex-col min-h-0">
            {tradingPairBase && tradingPairQuote ? (
                <OriginalProModeChart
                    token={tradingPairQuote}
                    baseToken={tradingPairBase}
                    targetPrice={targetPrice}
                    onTargetPriceChange={setTargetPrice}
                    userOrders={pairFilteredOrders}
                    highlightedOrderId={highlightedOrderId}
                    conditionDir={conditionDir}
                    isSandwichMode={selectedOrderType === 'sandwich'}
                    sandwichBuyPrice={sandwichBuyPrice}
                    sandwichSellPrice={sandwichSellPrice}
                    onSandwichBuyPriceChange={setSandwichBuyPrice}
                    onSandwichSellPriceChange={setSandwichSellPrice}
                    sandwichSpread={sandwichSpread}
                    onCurrentPriceChange={setCurrentPrice}
                />
            ) : (
                <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                        <TrendingUp className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-xl font-medium text-foreground mb-2">Select Trading Pair</h3>
                        <p className="text-muted-foreground">
                            Choose tokens below to start trading
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
} 
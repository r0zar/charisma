"use client";

import React, { useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import { useProModeContext } from '../../contexts/pro-mode-context';
import { useSwapContext } from '../../contexts/swap-context';
import { useLayoutObserver } from '../../hooks/useLayoutObserver';
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
        // Perpetual props
        perpetualDirection,
        perpetualEntryPrice,
        perpetualStopLoss,
        perpetualTakeProfit,
        perpetualChartState,
        handlePerpetualChartClick,
        chartType,
        candleInterval,
    } = useProModeContext();

    const { conditionToken, selectedToToken, selectedFromToken } = useSwapContext();

    // Use the condition token or selected to token for the chart
    const chartToken = conditionToken || selectedToToken;

    // Use the tokens selected in the form for all order types
    const chartBaseToken = selectedFromToken;  // Always use the token selected in the form
    const chartQuoteToken = selectedToToken;   // Always use the token selected in the form

    // Use layout observer to automatically resize chart when order forms change height
    const { triggerChartResize } = useLayoutObserver([
        selectedOrderType,
        // Include other dependencies that might affect layout
        sandwichBuyPrice,
        sandwichSellPrice,
        perpetualEntryPrice,
        perpetualStopLoss,
        perpetualTakeProfit,
        perpetualChartState
    ]);

    return (
        <div className="flex-1 p-4 flex flex-col min-h-0 overflow-hidden">
            {chartBaseToken && chartQuoteToken ? (
                <div className="relative flex-1">
                    <OriginalProModeChart
                        token={chartQuoteToken}
                        baseToken={chartBaseToken}
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
                        isPerpetualMode={selectedOrderType === 'perpetual'}
                        perpetualDirection={perpetualDirection}
                        perpetualEntryPrice={perpetualEntryPrice}
                        perpetualStopLoss={perpetualStopLoss}
                        perpetualTakeProfit={perpetualTakeProfit}
                        perpetualChartState={perpetualChartState}
                        onPerpetualChartClick={handlePerpetualChartClick}
                        onCurrentPriceChange={setCurrentPrice}
                        chartType={chartType}
                        candleInterval={candleInterval}
                    />
                </div>
            ) : (
                <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                        <TrendingUp className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-xl font-medium text-foreground mb-2">
                            Select Tokens to Trade
                        </h3>
                        <p className="text-muted-foreground">
                            Choose tokens in the form below to view the price chart
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
} 
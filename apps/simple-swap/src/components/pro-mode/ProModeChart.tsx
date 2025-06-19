"use client";

import React, { useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import { useProModeContext } from '../../contexts/pro-mode-context';
import { useLayoutObserver } from '../../hooks/useLayoutObserver';
// Import the existing ProModeChart component
import OriginalProModeChart from '../swap-interface/ProModeChart';
import { useSwapTokens } from '@/contexts/swap-tokens-context';

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

    const { selectedToToken, selectedFromToken } = useSwapTokens();

    // Configure chart to show price in an intuitive way for trading
    // Different order types use different token configurations:

    // For sandwich orders: use trading pair configuration (more flexible)
    // For DCA/Single orders: use direct from/to tokens (keep original UI)
    const chartBaseToken = (selectedOrderType === 'sandwich' && tradingPairQuote)
        ? tradingPairQuote       // Sandwich: use trading pair quote token (denominator)
        : selectedFromToken;     // DCA/Single: use from token (denominator) - REVERTED

    const chartQuoteToken = (selectedOrderType === 'sandwich' && tradingPairBase)
        ? tradingPairBase        // Sandwich: use trading pair base token (numerator)  
        : selectedToToken;       // DCA/Single: use to token (numerator) - REVERTED

    // Chart display remains unchanged - backend order mapping was the issue, not chart UI
    // Chart shows: chartBaseToken_price / chartQuoteToken_price
    // This means: how many chartBaseToken = 1 chartQuoteToken

    // Debug logging for chart configuration
    React.useEffect(() => {
        if (chartBaseToken && chartQuoteToken) {
            console.log('📊 Chart Configuration Debug:', {
                orderType: selectedOrderType,
                tokenSource: selectedOrderType === 'sandwich' ? 'Trading Pair Tokens' : 'From/To Tokens',
                userAction: selectedOrderType === 'sandwich'
                    ? `Monitoring ${chartQuoteToken.symbol}/${chartBaseToken.symbol} pair for sandwich strategy`
                    : `Buying ${chartBaseToken.symbol} with ${chartQuoteToken.symbol}`,
                chartConfig: {
                    token: `${chartQuoteToken.symbol} (${chartQuoteToken.contractId})`,
                    baseToken: `${chartBaseToken.symbol} (${chartBaseToken.contractId})`
                },
                chartCalculation: selectedOrderType === 'sandwich'
                    ? `${chartBaseToken.symbol}_USD_price / ${chartQuoteToken.symbol}_USD_price`
                    : `${chartQuoteToken.symbol}_USD_price / ${chartBaseToken.symbol}_USD_price`,
                chartMeaning: selectedOrderType === 'sandwich'
                    ? `How many ${chartBaseToken.symbol} = 1 ${chartQuoteToken.symbol}`
                    : `How many ${chartBaseToken.symbol} = 1 ${chartQuoteToken.symbol} (matches order: "1 ${chartQuoteToken.symbol} >= X ${chartBaseToken.symbol}")`,
                note: selectedOrderType === 'sandwich'
                    ? 'Sandwich orders can trade different tokens while monitoring this price relationship'
                    : 'DCA/Single chart now matches the order condition format'
            });
        }
    }, [chartBaseToken, chartQuoteToken, selectedOrderType]);

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
"use client";

import React from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { TrendingUp, TrendingDown, HelpCircle, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import TokenSelectorButton from './TokenSelectorButton';
import PerpetualOrderCreationDialog from './PerpetualOrderCreationDialog';
import { useProModeContext } from '../../contexts/pro-mode-context';
import { useSwapContext } from '../../contexts/swap-context';
import { useMarginAccountAPI } from '../../hooks/useMarginAccountAPI';
import { TokenCacheData } from '@repo/tokens';
import MarginControlsCompact from './MarginControlsCompact';

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

export default function PerpetualOrderForm() {
    const {
        perpetualDirection,
        setPerpetualDirection,
        perpetualLeverage,
        setPerpetualLeverage,
        perpetualPositionSize,
        handlePerpetualPositionSizeChange,
        perpetualEntryPrice,
        handlePerpetualEntryPriceChange,
        perpetualStopLoss,
        handlePerpetualStopLossChange,
        perpetualTakeProfit,
        handlePerpetualTakeProfitChange,
        perpetualMarginRequired,
        perpetualLiquidationPrice,
        perpetualCurrentPnL,
        handleCreatePerpetualOrder,
        isSubmitting,
        currentPrice,
        resetPerpetualChart,
        perpetualChartState,
        autoTrackEntryPrice,
        setAutoTrackEntryPrice,
    } = useProModeContext();

    const {
        selectedFromToken,
        selectedToToken,
        displayTokens,
        getUsdPrice,
        formatUsd,
        allTokenBalances,
    } = useSwapContext();

    const {
        account,
        canOpenPosition,
        getMaxPositionSize,
        formatBalance
    } = useMarginAccountAPI();

    const leverageOptions = [2, 3, 5, 10, 20, 50, 100];

    return (
        <TooltipProvider delayDuration={300} skipDelayDuration={100}>
            <div data-order-form="perpetual" className="flex flex-col lg:flex-row gap-4 min-h-0">
                {/* Left Column - Margin Controls */}
                <div className="w-full lg:w-72 lg:flex-shrink-0">
                    <MarginControlsCompact />
                </div>

                {/* Right Column - Order Form */}
                <div className="flex-1 space-y-3 relative min-w-0">
                    {/* Ultra Compact 4-Column Layout */}
                    <div className="grid grid-cols-4 gap-2">
                        <div className="space-y-1">
                            <div className="flex items-center space-x-1">
                                <label className="text-xs text-muted-foreground font-medium">Direction</label>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" align="start">
                                        <p className="max-w-xs">
                                            <strong>Long:</strong> Profit when price goes up. Buy low, sell high.<br />
                                            <strong>Short:</strong> Profit when price goes down. Sell high, buy low.
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <div className="flex space-x-1">
                                <Button
                                    variant={perpetualDirection === 'long' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setPerpetualDirection('long')}
                                    className="flex-1 h-8 text-xs px-2"
                                >
                                    Long
                                    <TrendingUp className="w-3 h-3 ml-1" />
                                </Button>
                                <Button
                                    variant={perpetualDirection === 'short' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setPerpetualDirection('short')}
                                    className="flex-1 h-8 text-xs px-2"
                                >
                                    Short
                                    <TrendingDown className="w-3 h-3 ml-1" />
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-center space-x-1">
                                <label className="text-xs text-muted-foreground font-medium">Leverage</label>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" align="start">
                                        <p className="max-w-xs">
                                            Multiplies your exposure. 10x leverage means 1% price change = 10% gain/loss.
                                            Higher leverage = higher risk of liquidation.
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <select
                                value={perpetualLeverage}
                                onChange={(e) => setPerpetualLeverage(Number(e.target.value))}
                                className="w-full p-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground h-8 text-xs"
                            >
                                {leverageOptions.map(leverage => (
                                    <option key={leverage} value={leverage}>{leverage}x</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-center space-x-1">
                                <label className="text-xs text-muted-foreground font-medium">Size (USD)</label>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" align="start">
                                        <p className="max-w-xs">
                                            Total position size in USD. Your actual margin requirement will be this amount divided by leverage.
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <input
                                type="text"
                                value={perpetualPositionSize}
                                onChange={(e) => handlePerpetualPositionSizeChange(e.target.value)}
                                placeholder="0.00"
                                className="w-full p-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground h-8 text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-1">
                                    <label className="text-xs text-muted-foreground font-medium">Entry Price</label>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" align="start">
                                            <p className="max-w-xs">
                                                Price at which you want to enter the position. Use "Auto" to track live market price.
                                            </p>
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setAutoTrackEntryPrice(!autoTrackEntryPrice)}
                                        className={`text-xs font-medium px-1.5 py-0.5 rounded ${autoTrackEntryPrice
                                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                            : 'text-muted-foreground hover:text-foreground border border-border/50'
                                            }`}
                                    >
                                        {autoTrackEntryPrice ? 'AUTO' : 'Manual'}
                                    </button>
                                    {!autoTrackEntryPrice && currentPrice && (
                                        <button
                                            onClick={() => handlePerpetualEntryPriceChange(currentPrice.toString())}
                                            className="text-xs text-primary hover:text-primary/80 font-medium"
                                        >
                                            Use
                                        </button>
                                    )}
                                    {perpetualChartState && perpetualChartState.selectionStep !== 'entry' && (
                                        <button
                                            onClick={resetPerpetualChart}
                                            className="text-xs text-orange-400 hover:text-orange-300 font-medium"
                                        >
                                            Reset
                                        </button>
                                    )}
                                </div>
                            </div>
                            <input
                                type="text"
                                value={perpetualEntryPrice}
                                onChange={(e) => handlePerpetualEntryPriceChange(e.target.value)}
                                placeholder={autoTrackEntryPrice ? "Auto-tracking..." : "0.00"}
                                disabled={autoTrackEntryPrice}
                                className={`w-full p-2 border rounded-lg text-foreground placeholder:text-muted-foreground h-8 text-xs ${autoTrackEntryPrice
                                    ? 'bg-green-500/10 border-green-500/30 cursor-not-allowed'
                                    : 'bg-background border-border focus:outline-none focus:ring-2 focus:ring-primary/20'
                                    }`}
                            />
                        </div>
                    </div>

                    {/* Assets & Risk Management - 4 Column Layout */}
                    <div className="grid grid-cols-4 gap-2">
                        <div className="space-y-1">
                            <div className="flex items-center space-x-1">
                                <label className="text-xs text-muted-foreground font-medium">Base Asset</label>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="max-w-xs">
                                            The asset you're trading. This is what you're going long or short on.
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <TokenSelectorButton
                                selectionType="from"
                                placeholder="Select base"
                                className="w-full h-8 text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-center space-x-1">
                                <label className="text-xs text-muted-foreground font-medium">Quote Asset</label>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="max-w-xs">
                                            The asset used to price the base asset. Usually a stablecoin like USDT.
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <TokenSelectorButton
                                selectionType="to"
                                placeholder="Select quote"
                                className="w-full h-8 text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-center space-x-1">
                                <label className="text-xs text-muted-foreground font-medium">Stop Loss</label>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="max-w-xs">
                                            Optional. Price at which to automatically close position to limit losses.
                                            Should be below entry for long, above entry for short.
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <input
                                type="text"
                                value={perpetualStopLoss}
                                onChange={(e) => handlePerpetualStopLossChange(e.target.value)}
                                placeholder="Optional"
                                className="w-full p-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground h-8 text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-center space-x-1">
                                <label className="text-xs text-muted-foreground font-medium">Take Profit</label>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="max-w-xs">
                                            Optional. Price at which to automatically close position to secure profits.
                                            Should be above entry for long, below entry for short.
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <input
                                type="text"
                                value={perpetualTakeProfit}
                                onChange={(e) => handlePerpetualTakeProfitChange(e.target.value)}
                                placeholder="Optional"
                                className="w-full p-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground h-8 text-xs"
                            />
                        </div>
                    </div>

                    {/* Margin & Liquidation Info - Compact Display */}
                    {(perpetualMarginRequired > 0 || perpetualLiquidationPrice > 0) && (
                        <div className="bg-muted/30 rounded-lg p-2">
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                {perpetualMarginRequired > 0 && (
                                    <div>
                                        <div className="flex items-center space-x-1">
                                            <span className="text-muted-foreground">Est. Margin Required:</span>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                                </TooltipTrigger>
                                                <TooltipContent side="bottom" align="start">
                                                    <p className="max-w-xs">
                                                        <strong>Estimated</strong> amount of collateral needed to open this position.
                                                        Calculated as Position Size ÷ Leverage. Final value calculated securely on server.
                                                    </p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                        <div className={`font-medium ${canOpenPosition(perpetualMarginRequired) ? 'text-muted-foreground' : 'text-red-500'
                                            }`}>
                                            {formatUsd(perpetualMarginRequired)}
                                            {!canOpenPosition(perpetualMarginRequired) && (
                                                <span className="ml-1 text-red-500">⚠️</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {perpetualLiquidationPrice > 0 && (
                                    <div>
                                        <div className="flex items-center space-x-1">
                                            <span className="text-muted-foreground">Est. Liquidation Price:</span>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                                </TooltipTrigger>
                                                <TooltipContent side="bottom" align="start">
                                                    <p className="max-w-xs">
                                                        <strong>Estimated</strong> price at which your position will be automatically closed.
                                                        Final liquidation price calculated securely on server based on your risk parameters.
                                                    </p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                        <div className="font-medium text-red-500/70">{formatUsd(perpetualLiquidationPrice)}</div>
                                    </div>
                                )}

                                {/* Margin Account Status */}
                                {account && (
                                    <div>
                                        <div className="text-muted-foreground">Available Margin:</div>
                                        <div className="font-medium text-muted-foreground">{formatBalance(account.freeMargin)}</div>
                                    </div>
                                )}
                            </div>

                            {/* Margin Validation Warning */}
                            {perpetualMarginRequired > 0 && !canOpenPosition(perpetualMarginRequired) && account && (
                                <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                                    <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                                        <AlertTriangle className="w-3 h-3" />
                                        <span className="text-xs">
                                            Insufficient margin. Need {formatBalance(perpetualMarginRequired - account.freeMargin)} more.
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}



                    {/* Submit Button */}
                    <Button
                        onClick={handleCreatePerpetualOrder}
                        disabled={
                            !perpetualPositionSize ||
                            !selectedFromToken ||
                            !selectedToToken ||
                            !perpetualEntryPrice ||
                            isSubmitting ||
                            (perpetualMarginRequired > 0 && !canOpenPosition(perpetualMarginRequired))
                        }
                        className="w-full h-10 text-sm font-medium"
                    >
                        {isSubmitting ? 'Creating...' :
                            (perpetualMarginRequired > 0 && !canOpenPosition(perpetualMarginRequired)) ?
                                'Insufficient Margin' :
                                `Create ${perpetualDirection === 'long' ? 'Long' : 'Short'} Position (Preview)`
                        }
                    </Button>

                    {/* Order Creation Dialog */}
                    <PerpetualOrderCreationDialog />
                </div>
            </div>
        </TooltipProvider>
    );
} 
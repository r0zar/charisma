"use client";

import React from 'react';
import { Badge } from '../ui/badge';
import { TrendingUp, TrendingDown, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { useProModeContext } from '../../contexts/pro-mode-context';
import { useSwapTokens } from '@/contexts/swap-tokens-context';
import { formatPriceUSD } from '@/lib/utils';

export default function PerpetualOrderPreview() {
    const {
        perpetualDirection,
        perpetualLeverage,
        perpetualPositionSize,
        perpetualEntryPrice,
        perpetualStopLoss,
        perpetualTakeProfit,
        perpetualMarginRequired,
        perpetualLiquidationPrice,
        perpetualCurrentPnL,
    } = useProModeContext();

    const {
        selectedFromToken,
        selectedToToken,
    } = useSwapTokens();

    const hasValidData = perpetualPositionSize && selectedFromToken && selectedToToken && perpetualEntryPrice;

    if (!hasValidData) {
        return (
            <div className="w-full xl:w-80 xl:flex-shrink-0">
                <div className="bg-background/60 border border-border/60 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-medium text-foreground text-sm">Order Preview</h4>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        Enter position size and entry price to see preview
                    </div>
                </div>
            </div>
        );
    }

    return (
        <TooltipProvider delayDuration={300} skipDelayDuration={100}>
            <div className="w-full xl:w-80 xl:flex-shrink-0">
                <div className="bg-background/60 border border-border/60 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-medium text-foreground text-sm">Position Preview</h4>
                        <Badge variant="secondary" className="text-xs">Preview</Badge>
                    </div>

                    <div className="space-y-2 text-xs">
                        {/* Direction & Leverage */}
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Direction:</span>
                            <div className={`flex items-center space-x-1 font-medium ${perpetualDirection === 'long' ? 'text-green-600' : 'text-red-600'
                                }`}>
                                {perpetualDirection === 'long' ? (
                                    <TrendingUp className="w-3 h-3" />
                                ) : (
                                    <TrendingDown className="w-3 h-3" />
                                )}
                                <span>{perpetualDirection.toUpperCase()}</span>
                                <span className="text-muted-foreground">({perpetualLeverage}x)</span>
                            </div>
                        </div>

                        {/* Position Size */}
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Position Size:</span>
                            <span className="font-mono text-foreground">
                                {formatPriceUSD(parseFloat(perpetualPositionSize))}
                            </span>
                        </div>

                        {/* Entry Price */}
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Entry Price:</span>
                            <span className="font-mono text-foreground">
                                {formatPriceUSD(parseFloat(perpetualEntryPrice))}
                            </span>
                        </div>

                        {/* Margin Required */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1">
                                <span className="text-muted-foreground">Margin Required:</span>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent side="left" align="center">
                                        <p className="max-w-xs">
                                            The amount of collateral you need to deposit to open this position.
                                            Calculated as Position Size ÷ Leverage. This is the actual amount at risk.
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <span className="font-mono text-foreground">
                                {formatPriceUSD(perpetualMarginRequired)}
                            </span>
                        </div>

                        {/* Liquidation Price */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1">
                                <span className="text-muted-foreground">Liquidation Price:</span>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent side="left" align="center">
                                        <p className="max-w-xs">
                                            The price at which your position will be automatically closed to prevent further losses.
                                            If the market price reaches this level, you'll lose your margin. Higher leverage = closer liquidation price.
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <span className="font-mono text-red-600">
                                {formatPriceUSD(perpetualLiquidationPrice)}
                            </span>
                        </div>

                        {/* Stop Loss & Take Profit */}
                        {(perpetualStopLoss || perpetualTakeProfit) && (
                            <div className="border-t border-border/50 pt-1.5 space-y-1.5">
                                {perpetualStopLoss && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Stop Loss:</span>
                                        <span className="font-mono text-red-600">
                                            {formatPriceUSD(parseFloat(perpetualStopLoss))}
                                        </span>
                                    </div>
                                )}
                                {perpetualTakeProfit && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Take Profit:</span>
                                        <span className="font-mono text-green-600">
                                            {formatPriceUSD(parseFloat(perpetualTakeProfit))}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}



                        {/* Trading Pair */}
                        <div className="border-t border-border/50 pt-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Trading Pair:</span>
                                <span className="font-mono text-foreground">
                                    {selectedFromToken.symbol}/{selectedToToken.symbol}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
} 
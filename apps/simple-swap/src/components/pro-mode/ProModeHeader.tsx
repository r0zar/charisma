"use client";

import React, { useState } from 'react';
import { X, Keyboard, BarChart, Activity, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { useProModeContext } from '../../contexts/pro-mode-context';
import { useSwapTokens } from '@/contexts/swap-tokens-context';
import { useRouterTrading } from '@/hooks/useRouterTrading';

export default function ProModeHeader() {
    const [showHotkeysDialog, setShowHotkeysDialog] = useState(false);

    const {
        selectedOrderType,
        tradingPairBase,
        tradingPairQuote,
        highlightedOrderId,
        clearHighlightedOrder,
        chartType,
        setChartType,
        candleInterval,
        setCandleInterval,
        leftSidebarCollapsed,
        rightSidebarCollapsed,
        toggleLeftSidebar,
        toggleRightSidebar,
    } = useProModeContext();

    const {
        selectedFromToken,
        selectedToToken,
    } = useSwapTokens();

    const { setIsProMode } = useRouterTrading();

    const hotkeys = [
        { key: 'Esc', description: 'Exit Pro mode' },
        { key: 'Tab', description: 'Switch between order types (forward)' },
        { key: 'Shift + Tab', description: 'Switch between order types (reverse)' },
        { key: 'Enter', description: 'Submit current order' },
        { key: 'Ctrl + S', description: 'Switch tokens' },
        { key: '[', description: 'Toggle left sidebar (Order Types)' },
        { key: ']', description: 'Toggle right sidebar (Orders)' },
        ...(selectedOrderType === 'sandwich' ? [
            { key: 'Ctrl + Scroll', description: 'Adjust spread between A→B and B→A triggers' },
        ] : [
            { key: '↑ / ↓', description: 'Adjust price by 0.01' },
            { key: 'Shift + ↑ / ↓', description: 'Adjust price by 0.1' },
            { key: 'Ctrl + ↑ / ↓', description: 'Adjust price by 1' },
            { key: 'G', description: 'Toggle greater than condition' },
            { key: 'L', description: 'Toggle less than condition' },
        ]),
        { key: 'C', description: 'Clear highlighted order' },
    ];

    return (
        <>
            <div className="p-4 border-b border-border/40 flex items-center justify-between bg-card/30">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-3">
                        <h1 className="text-2xl font-bold text-foreground">Pro Trading</h1>

                        {/* Live Price Indicator */}
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <div className="flex items-center space-x-2 px-3 py-1 bg-green-950/20 border border-green-500/30 rounded-full">
                                        <div className="relative">
                                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                            <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping opacity-75"></div>
                                        </div>
                                        <span className="text-xs text-green-400 font-medium">LIVE</span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="text-sm">Price data updates every 30 seconds</p>
                                    <p className="text-xs text-muted-foreground">• Token prices from trading pairs</p>
                                    <p className="text-xs text-muted-foreground">• Open position P&L calculations</p>
                                    <p className="text-xs text-muted-foreground">• Order condition monitoring</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>

                    {/* Token Ratio Display - Shows what chart is displaying */}
                    {(() => {
                        // Determine chart tokens based on order type (same logic as ProModeChart.tsx)
                        const chartBaseToken = (selectedOrderType === 'sandwich' && tradingPairQuote)
                            ? tradingPairQuote   // Sandwich: trading pair quote token
                            : selectedFromToken; // DCA/Single: from token

                        const chartQuoteToken = (selectedOrderType === 'sandwich' && tradingPairBase)
                            ? tradingPairBase    // Sandwich: trading pair base token
                            : selectedToToken;   // DCA/Single: to token

                        // Debug logging for sandwich mode
                        if (selectedOrderType === 'sandwich') {
                            console.log('🔍 Header Debug - Sandwich Mode:', {
                                selectedFromToken: selectedFromToken?.symbol,
                                selectedToToken: selectedToToken?.symbol,
                                tradingPairBase: tradingPairBase?.symbol,
                                tradingPairQuote: tradingPairQuote?.symbol,
                                chartQuoteToken: chartQuoteToken?.symbol,
                                chartBaseToken: chartBaseToken?.symbol,
                                willDisplay: chartQuoteToken && chartBaseToken ? `${chartQuoteToken.symbol}/${chartBaseToken.symbol}` : 'null'
                            });
                        }

                        if (chartBaseToken && chartQuoteToken) {
                            return (
                                <div className="flex items-center space-x-2 px-3 py-1.5 bg-muted/30 border border-border/30 rounded-lg">
                                    <div className="flex items-center space-x-1 text-sm">
                                        <span className="text-muted-foreground">Chart:</span>
                                        <span className="font-medium text-foreground">
                                            {chartQuoteToken.symbol}
                                        </span>
                                        <span className="text-muted-foreground">/</span>
                                        <span className="font-medium text-foreground">
                                            {chartBaseToken.symbol}
                                        </span>
                                    </div>
                                    {selectedOrderType === 'sandwich' && (
                                        <div className="text-xs text-muted-foreground bg-background/60 px-2 py-0.5 rounded border">
                                            Trading Pair
                                        </div>
                                    )}
                                </div>
                            );
                        }
                        return null;
                    })()}

                    {/* Show All Orders Button - appears when an order is highlighted */}
                    {highlightedOrderId && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={clearHighlightedOrder}
                            className="text-xs h-8 px-3"
                        >
                            Show All Orders
                        </Button>
                    )}
                </div>

                {/* Right Side - Action Buttons */}
                <div className="flex items-center space-x-2">
                    {/* Sidebar Toggle Buttons */}
                    <div className="flex items-center space-x-1 border-r border-border/40 pr-2 mr-2">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={toggleLeftSidebar}
                                        className="text-muted-foreground hover:text-foreground"
                                    >
                                        {leftSidebarCollapsed ? (
                                            <PanelLeftOpen className="w-4 h-4" />
                                        ) : (
                                            <PanelLeftClose className="w-4 h-4" />
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{leftSidebarCollapsed ? 'Expand' : 'Collapse'} order types sidebar</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={toggleRightSidebar}
                                        className="text-muted-foreground hover:text-foreground"
                                    >
                                        {rightSidebarCollapsed ? (
                                            <PanelRightOpen className="w-4 h-4" />
                                        ) : (
                                            <PanelRightClose className="w-4 h-4" />
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{rightSidebarCollapsed ? 'Expand' : 'Collapse'} orders sidebar</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>

                    {/* Chart Type Toggle */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setChartType(chartType === 'line' ? 'candles' : 'line')}
                        className="text-muted-foreground hover:text-foreground"
                        title={`Switch to ${chartType === 'line' ? 'candlestick' : 'line'} chart`}
                    >
                        {chartType === 'line' ? (
                            <BarChart className="w-4 h-4" />
                        ) : (
                            <Activity className="w-4 h-4" />
                        )}
                    </Button>

                    {/* Candle Interval Selector - Only show in candlestick mode */}
                    {chartType === 'candles' && (
                        <select
                            value={candleInterval}
                            onChange={(e) => setCandleInterval(e.target.value)}
                            className="px-2 py-1 text-xs bg-background border border-border rounded text-foreground hover:bg-muted focus:outline-none focus:ring-1 focus:ring-primary"
                            title="Candlestick time interval"
                        >
                            <option value="1m">1m</option>
                            <option value="5m">5m</option>
                            <option value="15m">15m</option>
                            <option value="30m">30m</option>
                            <option value="1h">1h</option>
                            <option value="4h">4h</option>
                            <option value="12h">12h</option>
                            <option value="1d">1d</option>
                            <option value="3d">3d</option>
                            <option value="1w">1w</option>
                        </select>
                    )}



                    {/* Hotkeys Button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowHotkeysDialog(true)}
                        className="text-muted-foreground hover:text-foreground"
                        title="View keyboard shortcuts"
                    >
                        <Keyboard className="w-4 h-4" />
                    </Button>

                    {/* Close Button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsProMode(false)}
                        className="text-muted-foreground hover:text-foreground"
                        title="Exit Pro mode (Esc)"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Hotkeys Dialog */}
            <Dialog open={showHotkeysDialog} onOpenChange={setShowHotkeysDialog}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Keyboard className="w-5 h-5" />
                            Keyboard Shortcuts
                        </DialogTitle>
                        <DialogDescription>
                            Use these keyboard shortcuts to navigate Pro mode efficiently.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 max-h-[80vh] overflow-y-auto">
                        {hotkeys.map((hotkey, index) => (
                            <div key={index} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                                <span className="text-sm text-muted-foreground">{hotkey.description}</span>
                                <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded border">
                                    {hotkey.key}
                                </kbd>
                            </div>
                        ))}
                    </div>

                    <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border/20">
                        Click the keyboard icon in the header to view these shortcuts
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
} 
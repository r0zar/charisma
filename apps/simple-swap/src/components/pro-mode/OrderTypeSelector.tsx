"use client";

import React from 'react';
import { Zap, Repeat, Layers, TrendingUp } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { useProModeContext } from '../../contexts/pro-mode-context';

interface OrderTypeSelectorProps {
    collapsed: boolean;
}

export default function OrderTypeSelector({ collapsed }: OrderTypeSelectorProps) {
    const { selectedOrderType, setSelectedOrderType } = useProModeContext();

    if (collapsed) {
        return (
            <div className="h-full flex flex-col">
                <div className="p-3 border-b border-border/40">
                    <div className="text-center">
                        <div className="text-xs font-semibold text-foreground">Types</div>
                    </div>
                </div>
                <div className="p-2 space-y-2 flex-1">
                    {/* Collapsed Order Type Icons */}
                    <div
                        className={`p-3 rounded-lg cursor-pointer transition-all hover:bg-background/80 ${selectedOrderType === 'single' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                            }`}
                        onClick={() => setSelectedOrderType('single')}
                        title="Single Order"
                    >
                        <Zap className="w-5 h-5 mx-auto" />
                    </div>

                    <div
                        className={`p-3 rounded-lg cursor-pointer transition-all hover:bg-background/80 ${selectedOrderType === 'dca' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                            }`}
                        onClick={() => setSelectedOrderType('dca')}
                        title="DCA Orders"
                    >
                        <Repeat className="w-5 h-5 mx-auto" />
                    </div>

                    <div
                        className={`p-3 rounded-lg cursor-pointer transition-all hover:bg-background/80 ${selectedOrderType === 'sandwich' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                            }`}
                        onClick={() => setSelectedOrderType('sandwich')}
                        title="Sandwich Orders"
                    >
                        <Layers className="w-5 h-5 mx-auto" />
                    </div>

                    <div
                        className={`p-3 rounded-lg cursor-pointer transition-all hover:bg-background/80 ${selectedOrderType === 'perpetual' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                            }`}
                        onClick={() => setSelectedOrderType('perpetual')}
                        title="Perpetual Orders"
                    >
                        <TrendingUp className="w-5 h-5 mx-auto" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-border/40">
                <h2 className="text-lg font-semibold text-foreground">Order Types</h2>
                <p className="text-xs text-muted-foreground mt-1">Choose your trading strategy</p>
            </div>

            <div className="p-4 space-y-3">
                {/* Single Order Option */}
                <Card
                    className={`p-4 cursor-pointer transition-all hover:bg-background/80 ${selectedOrderType === 'single' ? 'ring-2 ring-primary bg-primary/5' : ''
                        }`}
                    onClick={() => setSelectedOrderType('single')}
                >
                    <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg ${selectedOrderType === 'single' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                            }`}>
                            <Zap className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-medium text-sm">Single Order</h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                Execute one-time limit orders when price conditions are met
                            </p>
                            <div className="flex items-center space-x-2 mt-2">
                                <Badge variant="outline" className="text-xs">Limit Orders</Badge>
                                <Badge variant="outline" className="text-xs">Price Triggers</Badge>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* DCA Order Option */}
                <Card
                    className={`p-4 cursor-pointer transition-all hover:bg-background/80 ${selectedOrderType === 'dca' ? 'ring-2 ring-primary bg-primary/5' : ''
                        }`}
                    onClick={() => setSelectedOrderType('dca')}
                >
                    <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg ${selectedOrderType === 'dca' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                            }`}>
                            <Repeat className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-medium text-sm">DCA Orders</h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                Dollar-cost average with recurring purchases over time
                            </p>
                            <div className="flex items-center space-x-2 mt-2">
                                <Badge variant="outline" className="text-xs">Recurring</Badge>
                                <Badge variant="outline" className="text-xs">Scheduled</Badge>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Sandwich Order Option */}
                <Card
                    className={`p-4 cursor-pointer transition-all hover:bg-background/80 ${selectedOrderType === 'sandwich' ? 'ring-2 ring-primary bg-primary/5' : ''
                        }`}
                    onClick={() => setSelectedOrderType('sandwich')}
                >
                    <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg ${selectedOrderType === 'sandwich' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                            }`}>
                            <Layers className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-medium text-sm">Sandwich Orders</h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                Buy and sell the same asset twice within a short period
                            </p>
                            <div className="flex items-center space-x-2 mt-2">
                                <Badge variant="outline" className="text-xs">Arbitrage</Badge>
                                <Badge variant="outline" className="text-xs">Hedging</Badge>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Perpetual Order Option */}
                <Card
                    className={`p-4 cursor-pointer transition-all hover:bg-background/80 ${selectedOrderType === 'perpetual' ? 'ring-2 ring-primary bg-primary/5' : ''
                        }`}
                    onClick={() => setSelectedOrderType('perpetual')}
                >
                    <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg ${selectedOrderType === 'perpetual' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                            }`}>
                            <TrendingUp className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-medium text-sm">Perpetual Orders</h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                Trade with leverage for amplified exposure to price movements
                            </p>
                            <div className="flex items-center space-x-2 mt-2">
                                <Badge variant="outline" className="text-xs">Leverage</Badge>
                                <Badge variant="outline" className="text-xs">Long/Short</Badge>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Order Type Info - Enhanced with merged content */}
            <div className="mt-auto p-4 border-t border-border/40">
                <div className="text-xs text-muted-foreground">
                    {selectedOrderType === 'single' ? (
                        <>
                            <div className="font-medium mb-2">How it works:</div>
                            <p className="text-muted-foreground mb-3 leading-relaxed">
                                A limit order executes automatically when your target price condition is met.
                                Set a price threshold and your swap will trigger when the market reaches that level.
                            </p>
                            <div className="font-medium mb-1">Features:</div>
                            <ul className="space-y-1">
                                <li>• Price-triggered execution</li>
                                <li>• One-time purchase</li>
                                <li>• Immediate or conditional</li>
                            </ul>
                        </>
                    ) : selectedOrderType === 'dca' ? (
                        <>
                            <div className="font-medium mb-2">How it works:</div>
                            <p className="text-muted-foreground mb-3 leading-relaxed">
                                Dollar-Cost Averaging spreads your purchase over time with regular, smaller buys.
                                This reduces the impact of price volatility and averages out your entry price.
                            </p>
                            <div className="font-medium mb-1">Features:</div>
                            <ul className="space-y-1">
                                <li>• Recurring purchases</li>
                                <li>• Time-based execution</li>
                                <li>• Risk averaging</li>
                            </ul>
                        </>
                    ) : selectedOrderType === 'sandwich' ? (
                        <>
                            <div className="font-medium mb-2">How it works:</div>
                            <p className="text-muted-foreground mb-3 leading-relaxed">
                                A sandwich strategy creates two conditional swaps: an A→B swap that triggers at a low price,
                                and a B→A swap that triggers at a high price. This strategy helps capture profits from price volatility.
                            </p>
                            <div className="font-medium mb-1">Features:</div>
                            <ul className="space-y-1">
                                <li>• Buy and sell the same asset twice</li>
                                <li>• Used for arbitrage or hedging</li>
                                <li>• Short duration between trades</li>
                            </ul>
                        </>
                    ) : selectedOrderType === 'perpetual' ? (
                        <>
                            <div className="font-medium mb-2">How it works:</div>
                            <p className="text-muted-foreground mb-3 leading-relaxed">
                                Perpetual trading uses leverage to amplify your exposure to price movements.
                                You can go long (bet price goes up) or short (bet price goes down) with up to 100x leverage.
                                Your position stays open until you close it or get liquidated.
                            </p>
                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-3">
                                <div className="flex items-center space-x-2">
                                    <Badge variant="secondary" className="text-xs">Preview Mode</Badge>
                                    <span className="text-xs text-yellow-600 dark:text-yellow-400">
                                        No real funds will be used
                                    </span>
                                </div>
                            </div>
                            <div className="font-medium mb-1">Features:</div>
                            <ul className="space-y-1">
                                <li>• Leverage trading up to 100x</li>
                                <li>• Long and short positions</li>
                                <li>• Real-time P&L calculations</li>
                                <li>• Risk management tools</li>
                                <li>• Margin and liquidation tracking</li>
                                <li>• Educational preview mode</li>
                            </ul>
                        </>
                    ) : (
                        <>
                            <div className="font-medium mb-1">Select an Order Type:</div>
                            <ul className="space-y-1">
                                <li>• Choose from various strategies</li>
                                <li>• Each type has unique features</li>
                                <li>• Preview mode available</li>
                            </ul>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
} 
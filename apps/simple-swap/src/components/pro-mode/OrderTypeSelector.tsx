"use client";

import React from 'react';
import { Zap, Repeat, Layers } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { useProModeContext } from '../../contexts/pro-mode-context';

export default function OrderTypeSelector() {
    const { selectedOrderType, setSelectedOrderType } = useProModeContext();

    return (
        <div className="w-80 border-r border-border/40 bg-card/50 backdrop-blur-sm flex flex-col">
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
            </div>

            {/* Order Type Info */}
            <div className="mt-auto p-4 border-t border-border/40">
                <div className="text-xs text-muted-foreground">
                    {selectedOrderType === 'single' ? (
                        <>
                            <div className="font-medium mb-1">Single Order Features:</div>
                            <ul className="space-y-1">
                                <li>• Price-triggered execution</li>
                                <li>• One-time purchase</li>
                                <li>• Immediate or conditional</li>
                            </ul>
                        </>
                    ) : selectedOrderType === 'dca' ? (
                        <>
                            <div className="font-medium mb-1">DCA Order Features:</div>
                            <ul className="space-y-1">
                                <li>• Recurring purchases</li>
                                <li>• Time-based execution</li>
                                <li>• Risk averaging</li>
                            </ul>
                        </>
                    ) : (
                        <>
                            <div className="font-medium mb-1">Sandwich Order Features:</div>
                            <ul className="space-y-1">
                                <li>• Buy and sell the same asset twice</li>
                                <li>• Used for arbitrage or hedging</li>
                                <li>• Short duration between trades</li>
                            </ul>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
} 
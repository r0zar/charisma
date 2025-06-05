"use client";

import React from 'react';
import { useProModeContext } from '../../contexts/pro-mode-context';
import OrderPreview from './OrderPreview';
import OrderForm from './OrderForm';

export default function OrderControls() {
    const { selectedOrderType } = useProModeContext();

    return (
        <div className="border-t border-border/40 bg-card/50 backdrop-blur-sm p-4 flex-shrink-0 max-h-96 overflow-y-auto">
            <div className="flex gap-6 min-h-0">
                {/* Left Side - Information Panel */}
                <div className="w-80 flex-shrink-0">
                    <div className="bg-background/60 border border-border/60 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-3">
                            <div className={`p-2 rounded-lg ${selectedOrderType === 'single' ? 'bg-green-100 text-green-700' :
                                selectedOrderType === 'dca' ? 'bg-blue-100 text-blue-700' :
                                    'bg-yellow-100 text-yellow-700'
                                }`}>
                                {selectedOrderType === 'single' ? '⚡' : selectedOrderType === 'dca' ? '🔄' : '🥪'}
                            </div>
                            <h4 className="font-semibold text-foreground">
                                {selectedOrderType === 'single' ? 'Limit Order' :
                                    selectedOrderType === 'dca' ? 'DCA Strategy' :
                                        'Sandwich Strategy'}
                            </h4>
                        </div>

                        {selectedOrderType === 'single' ? (
                            <div className="space-y-3 text-sm">
                                <div>
                                    <h5 className="font-medium text-foreground mb-1">How it works:</h5>
                                    <p className="text-muted-foreground text-xs leading-relaxed">
                                        A limit order executes automatically when your target price condition is met.
                                        Set a price threshold and your swap will trigger when the market reaches that level.
                                    </p>
                                </div>
                            </div>
                        ) : selectedOrderType === 'dca' ? (
                            <div className="space-y-3 text-sm">
                                <div>
                                    <h5 className="font-medium text-foreground mb-1">How it works:</h5>
                                    <p className="text-muted-foreground text-xs leading-relaxed">
                                        Dollar-Cost Averaging spreads your purchase over time with regular, smaller buys.
                                        This reduces the impact of price volatility and averages out your entry price.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3 text-sm">
                                <div>
                                    <h5 className="font-medium text-foreground mb-1">How it works:</h5>
                                    <p className="text-muted-foreground text-xs leading-relaxed">
                                        A sandwich strategy creates two conditional swaps: an A→B swap that triggers at a low price, and a B→A swap that triggers at a high price. This strategy helps capture profits from price volatility between the two tokens.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Center - Order Form Controls */}
                <div className="flex-1 min-w-0">
                    <OrderForm />
                </div>

                {/* Right Side - Order Preview */}
                <OrderPreview />
            </div>
        </div>
    );
} 
"use client";

import React from 'react';
import { Button } from '../ui/button';
import { ClockArrowUp, Repeat, Loader2 } from 'lucide-react';
import { useRouterTrading } from '@/hooks/useRouterTrading';
import { useSwapTokens } from '@/contexts/swap-tokens-context';

export default function OrderButton() {
    const { handleCreateLimitOrder, isCreatingOrder } = useRouterTrading();
    const { mode, targetPrice } = useSwapTokens();
    
    // Button should be disabled if creating order or if in order mode but no target price set
    const isDisabled = isCreatingOrder || (mode === 'order' && (!targetPrice || targetPrice === ''));

    const setDcaDialogOpen = (v: boolean) => { };

    return (
        <div className="mt-6">
            <div className="flex w-full shadow-lg">
                <Button
                    onClick={handleCreateLimitOrder}
                    disabled={isDisabled}
                    className="relative flex-1 rounded-r-none bg-gradient-to-r from-purple-600 to-purple-700 text-white py-3 font-semibold overflow-hidden hover:brightness-110 transition-transform active:scale-95 focus:outline-none rounded-l-xl disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:active:scale-100"
                >
                    <span className="absolute inset-0 opacity-10 animate-pulse" />
                    <span className="relative z-10 flex items-center justify-center">
                        {isCreatingOrder ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Creating Order...
                            </>
                        ) : (
                            <>
                                <ClockArrowUp className="w-4 h-4 mr-2" />
                                Create Swap Order
                            </>
                        )}
                    </span>
                </Button>

                {/* DCA trigger button */}
                <Button
                    className="relative w-12 h-auto rounded-l-none bg-gradient-to-r from-purple-700 to-purple-800 text-white overflow-hidden hover:brightness-110 transition-transform active:scale-95 focus:outline-none rounded-r-xl border-l border-white/20"
                    title="Create DCA orders"
                    onClick={() => setDcaDialogOpen(true)}
                    disabled={isDisabled}
                >
                    <Repeat className="w-5 h-5" />
                </Button>
            </div>
        </div>
    );
} 
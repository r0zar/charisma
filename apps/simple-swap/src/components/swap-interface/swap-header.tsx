"use client";

import React, { useCallback } from 'react';
import { Share2, Repeat, TrendingUp, Monitor } from 'lucide-react';
import { Button } from '../ui/button';
import { TokenCacheData } from '@repo/tokens';
import { useSwapTokens } from '@/contexts/swap-tokens-context';
import { useRouterTrading } from '@/hooks/useRouterTrading';

// Pure function for creating share URLs and tweets
function createShareData(params: {
    selectedFromToken: TokenCacheData | null;
    selectedToToken: TokenCacheData | null;
    displayAmount: string;
    useSubnetFrom: boolean;
    useSubnetTo: boolean;
    mode: 'swap' | 'order';
    targetPrice?: string;
    conditionDir?: 'lt' | 'gt';
    conditionToken?: TokenCacheData | null;
    baseToken?: TokenCacheData | null;
    shiftDirection?: 'to-subnet' | 'from-subnet' | null;
}) {
    const {
        selectedFromToken, selectedToToken, displayAmount, useSubnetFrom, useSubnetTo,
        mode, targetPrice, conditionDir = 'gt', conditionToken, baseToken, shiftDirection
    } = params;

    // Build URL parameters
    const urlParams = new URLSearchParams();
    if (selectedFromToken) urlParams.set('fromSymbol', selectedFromToken.symbol);
    if (selectedToToken) urlParams.set('toSymbol', selectedToToken.symbol);
    if (displayAmount) urlParams.set('amount', displayAmount);
    if (useSubnetFrom) urlParams.set('fromSubnet', '1');
    if (useSubnetTo) urlParams.set('toSubnet', '1');

    if (mode === 'order') {
        urlParams.set('mode', 'order');
        if (targetPrice) urlParams.set('targetPrice', targetPrice);
        urlParams.set('direction', conditionDir);
        // Include extra order params for deep-linking
        const condSymbol = (conditionToken || selectedToToken)?.symbol;
        if (condSymbol) urlParams.set('conditionToken', condSymbol);
        if (baseToken) urlParams.set('baseAsset', baseToken.symbol);
    }

    const shareUrl = `${window.location.origin}/swap?${urlParams.toString()}`;
    const toTag = selectedToToken ? `$${selectedToToken.symbol}` : '';

    // Create tweet text
    let text: string;
    if (mode === 'order') {
        text = `Planning an order on Charisma: ${displayAmount || ''} ${selectedFromToken?.symbol} → ${toTag} when price ${conditionDir === 'lt' ? '≤' : '≥'} ${targetPrice}. `;
    } else {
        // Swap mode
        if (shiftDirection === 'to-subnet') {
            text = `Subnet deposit: ${displayAmount || ''} ${selectedFromToken?.symbol} → ${toTag} (subnet) via Charisma`;
        } else if (shiftDirection === 'from-subnet') {
            text = `Subnet swap: ${displayAmount || ''} ${selectedFromToken?.symbol} (subnet) → ${toTag} via Charisma`;
        } else {
            text = `Swap ${displayAmount || ''} ${selectedFromToken?.symbol} for ${toTag} on Charisma`;
        }
    }

    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;

    return { shareUrl, tweetUrl, text };
}

export default function SwapHeader() {
    const {
        mode,
        setMode,
        selectedFromToken,
        selectedToToken,
        displayAmount,
        useSubnetFrom,
        useSubnetTo,
        targetPrice,
        conditionDir,
        conditionToken,
        baseToken,
        hasBothVersions,
    } = useSwapTokens();

    const {
        isProMode,
        setIsProMode,
        securityLevel,
        shiftDirection,
    } = useRouterTrading();

    // Create local handleShare function using the pure function
    const handleShare = useCallback(() => {
        if (typeof window === 'undefined') return;

        const { tweetUrl } = createShareData({
            selectedFromToken,
            selectedToToken,
            displayAmount,
            useSubnetFrom,
            useSubnetTo,
            mode,
            targetPrice,
            conditionDir,
            conditionToken,
            baseToken,
            shiftDirection
        });

        window.open(tweetUrl, '_blank');
    }, [selectedFromToken, selectedToToken, displayAmount, useSubnetFrom, useSubnetTo, mode, targetPrice, conditionDir, conditionToken, baseToken, shiftDirection]);

    // Check if order mode should be disabled based on from token subnet compatibility
    const isOrderModeDisabled = !hasBothVersions(selectedFromToken);

    return (
        <div className="flex items-center justify-between p-4 border-b border-border/40 bg-gradient-to-r from-primary/5 to-secondary/5">
            <div className="flex items-center space-x-3">
                <div className="flex items-center bg-background/80 rounded-lg p-1 shadow-sm border border-border/30">
                    <button
                        onClick={() => setMode('swap')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${mode === 'swap'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            }`}
                    >
                        <TrendingUp className="w-4 h-4 mr-1.5 inline" />
                        Swap
                    </button>
                    <button
                        onClick={() => !isOrderModeDisabled && setMode('order')}
                        disabled={isOrderModeDisabled}
                        title={isOrderModeDisabled
                            ? "Order mode requires a token with subnet support. Please select a different token."
                            : "Switch to order mode for triggered swaps"
                        }
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${isOrderModeDisabled
                            ? 'text-muted-foreground/50 cursor-not-allowed opacity-50'
                            : mode === 'order'
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            }`}
                    >
                        <Repeat className="w-4 h-4 mr-1.5 inline" />
                        Order
                    </button>
                </div>

                {/* Security indicator */}
                {securityLevel && (
                    <div className="flex items-center text-xs text-muted-foreground bg-background/60 px-2 py-1 rounded-md border border-border/30">
                        <span className={`h-2 w-2 rounded-full mr-1.5 ${securityLevel === 'high' ? 'bg-green-500' :
                            securityLevel === 'medium' ? 'bg-blue-500' : 'bg-purple-500'
                            }`}></span>
                        {securityLevel === 'high' ? 'Direct route' :
                            securityLevel === 'medium' ? 'Optimized path' : 'Advanced routing'}
                    </div>
                )}
            </div>

            <div className="flex items-center space-x-2">
                {/* Pro Mode Button - only enabled in order mode */}
                <Button
                    variant={isProMode ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setIsProMode(!isProMode)}
                    disabled={mode !== 'order'}
                    title={mode !== 'order'
                        ? "Pro mode is only available in Order mode"
                        : isProMode
                            ? "Exit Pro mode"
                            : "Enter Pro mode for full-screen orderbook experience"
                    }
                    className={`${mode !== 'order'
                        ? 'opacity-50 cursor-not-allowed'
                        : 'text-muted-foreground hover:text-foreground'
                        } ${isProMode ? 'bg-primary text-primary-foreground' : ''}`}
                >
                    <Monitor className="w-4 h-4" />
                    {isProMode && <span className="ml-1 text-xs">Pro</span>}
                </Button>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleShare}
                    className="text-muted-foreground hover:text-foreground"
                >
                    <Share2 className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
} 
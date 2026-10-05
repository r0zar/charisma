"use client";

import React, { useCallback } from 'react';
import { Share2, Repeat, Monitor, AlarmCheck } from 'lucide-react';
import { TokenCacheData } from '@/lib/contract-registry-adapter';
import { useSwapTokens } from '@/contexts/swap-tokens-context';
import { useRouterTrading } from '@/contexts/router-trading-context';
import Link from 'next/link';

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
            text = `Moving ${displayAmount || ''} ${selectedFromToken?.symbol} onto Blaze via Charisma`;
        } else if (shiftDirection === 'from-subnet') {
            text = `Moving ${displayAmount || ''} ${selectedFromToken?.symbol} back to Stacks via Charisma`;
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
        <div className="relative flex items-center justify-between overflow-hidden">
            {/* Left Side - Mode Selection & Status */}
            <div className="flex items-center space-x-4">
                {/* Compact Mode Toggle */}
                <div className="flex items-center bg-surface border border-line rounded-xl p-1">
                    <button
                        onClick={() => setMode('swap')}
                        className={`relative px-3 sm:px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-300 flex items-center space-x-2 cursor-pointer ${mode === 'swap'
                            ? 'bg-surface-hover text-ink'
                            : 'text-ink-body hover:text-ink hover:bg-surface-hover'
                            }`}
                    >
                        <div className={`hidden sm:block h-2 w-2 rounded-full transition-all duration-300 ${mode === 'swap' ? 'bg-accent' : 'bg-line-strong'}`} />
                        <Repeat className="w-4 h-4" />
                        <span className="hidden sm:inline">Instant Swaps</span>
                        <span className="sm:hidden">Instant</span>
                    </button>
                    <button
                        onClick={() => !isOrderModeDisabled && setMode('order')}
                        disabled={isOrderModeDisabled}
                        title={isOrderModeDisabled
                            ? "Order mode requires a token with subnet support. Please select a different token."
                            : "Switch to order mode for triggered swaps"
                        }
                        className={`relative px-3 sm:px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-300 flex items-center space-x-2 ${isOrderModeDisabled
                            ? 'text-ink-faint cursor-not-allowed opacity-50'
                            : mode === 'order'
                                ? 'bg-surface-hover text-ink cursor-pointer'
                                : 'text-ink-body hover:text-ink hover:bg-surface-hover cursor-pointer'
                            }`}
                    >
                        <div className={`hidden sm:block h-2 w-2 rounded-full transition-all duration-300 ${mode === 'order' && !isOrderModeDisabled ? 'bg-blaze' : 'bg-line-strong'}`} />
                        <AlarmCheck className="w-4 h-4" />
                        <span className="hidden sm:inline">Triggered Swaps</span>
                        <span className="sm:hidden">Triggered</span>
                    </button>
                </div>
            </div>

            {/* Right Side - Premium Action Controls */}
            <div className="relative z-10 flex items-center space-x-4">
                {/* Pro Trading - Compact Button - Only on very large screens */}
                <div className="hidden 3xl:block">
                    <Link href="/pro">
                        <div className="group bg-surface border border-line backdrop-blur-sm rounded-lg px-3 py-2 hover:bg-surface-hover hover:border-line-strong transition-all duration-300 cursor-pointer">
                            <div className="flex items-center space-x-2">
                                <Monitor className="w-4 h-4 text-ink" />
                                <div>
                                    <span className="text-sm font-semibold text-ink">Pro Trading</span>
                                    <span className="text-xs text-ink-muted ml-2">Advanced tools</span>
                                </div>
                            </div>
                        </div>
                    </Link>
                </div>

                {/* Share - Simplified Button */}
                <button
                    onClick={handleShare}
                    className="h-10 w-10 bg-surface border border-line backdrop-blur-sm rounded-lg hover:bg-surface-hover hover:border-line-strong transition-all duration-300 flex items-center justify-center cursor-pointer"
                    title="Share this swap configuration"
                >
                    <Share2 className="w-4 h-4 text-ink-body hover:text-ink transition-colors duration-300" />
                </button>
            </div>
        </div>
    );
} 
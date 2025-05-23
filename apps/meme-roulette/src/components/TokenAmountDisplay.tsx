'use client';

import React from 'react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface TokenAmountDisplayProps {
    amount: number; // Amount in atomic units
    decimals: number; // Token decimals
    symbol: string; // Token symbol (e.g., "CHA")
    usdPrice?: number; // USD price per token
    className?: string; // Optional additional styling
    showUsd?: boolean; // Whether to show USD estimate
    showUsdInTooltip?: boolean; // Whether to show USD in tooltip instead of inline
    size?: 'sm' | 'md' | 'lg'; // Size variant
}

const TokenAmountDisplay = ({
    amount,
    decimals,
    symbol,
    usdPrice,
    className = '',
    showUsd = true,
    showUsdInTooltip = false,
    size = 'md'
}: TokenAmountDisplayProps) => {
    // Format amount for display
    const formatAmount = (atomicAmount: number) => {
        const wholeAmount = atomicAmount / (10 ** decimals);
        if (wholeAmount >= 1000000) {
            return `${(wholeAmount / 1000000).toFixed(1)}M`;
        } else if (wholeAmount >= 1000) {
            return `${(wholeAmount / 1000).toFixed(1)}K`;
        }
        return wholeAmount.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });
    };

    // Calculate USD value
    const usdValue = usdPrice ? (amount / (10 ** decimals)) * usdPrice : null;

    // Format USD value
    const formatUsd = (value: number) => {
        if (value >= 1000000) {
            return `$${(value / 1000000).toFixed(1)}M`;
        } else if (value >= 1000) {
            return `$${(value / 1000).toFixed(1)}K`;
        } else if (value >= 1) {
            return `$${value.toFixed(2)}`;
        } else {
            return `$${value.toFixed(4)}`;
        }
    };

    // Size-based styling
    const sizeClasses = {
        sm: 'text-md',
        md: 'text-xl',
        lg: 'text-3xl'
    };

    // Size-based USD styling - always smaller than main text
    const usdSizeClasses = {
        sm: 'text-xs',       // xs for sm
        md: 'text-xs',       // xs for md 
        lg: 'text-sm'        // sm for lg
    };

    const formattedAmount = formatAmount(amount);
    const formattedUsd = usdValue ? formatUsd(usdValue) : null;

    // If we should show USD in tooltip
    if (showUsdInTooltip && showUsd && formattedUsd) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className={`font-mono ${sizeClasses[size]} ${className} cursor-help`}>
                        <span className="font-bold">{formattedAmount} {symbol}</span>
                    </span>
                </TooltipTrigger>
                <TooltipContent className="bg-muted text-muted-foreground border-border/30">
                    <p className="text-xs font-normal">≈ {formattedUsd}</p>
                </TooltipContent>
            </Tooltip>
        );
    }

    // Default behavior - show USD inline but make it more subtle
    return (
        <span className={`font-mono ${sizeClasses[size]} ${className}`}>
            <span className="font-bold mr-1">{formattedUsd}</span>
            {showUsd && !showUsdInTooltip && usdValue && (
                <span className={`text-muted-foreground/50 ml-1 ${usdSizeClasses[size]} font-light`}>
                    {formattedAmount} {symbol}
                </span>
            )}
        </span>
    );
};

export default TokenAmountDisplay; 
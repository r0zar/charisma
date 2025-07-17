'use client';

import React from 'react';
import { usePrices } from '@/contexts/token-price-context';
import { useWallet } from '@/contexts/wallet-context';
import { TrendingUp, TrendingDown, Wifi, WifiOff, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LivePriceIndicatorProps {
    contractId: string;
    fallbackPrice?: number | null;
    className?: string;
    showChange?: boolean;
    showStatus?: boolean;
}

export default function LivePriceIndicator({
    contractId,
    fallbackPrice = null,
    className,
    showChange = true,
    showStatus = true
}: LivePriceIndicatorProps) {
    const { getPrice, isLoading } = usePrices();

    const price = getPrice(contractId);
    const displayPrice = price ?? fallbackPrice;
    const hasRealtimeData = price !== null;
    const isConnected = !isLoading;

    const change = null;
    const error = null;
    const lastUpdate = hasRealtimeData ? Date.now() : null;
    const refresh = () => { };
    const timeSinceUpdate = lastUpdate ? Date.now() - lastUpdate : null;
    const isStale = timeSinceUpdate ? timeSinceUpdate > 30000 : false; // 30 seconds

    const formatPrice = (value: number | null) => {
        if (value === null) return '-';

        if (value >= 1000) {
            return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else if (value >= 1) {
            return `$${value.toFixed(4).replace(/\.?0+$/, '')}`;
        } else if (value >= 0.01) {
            return `$${value.toFixed(4)}`;
        } else if (value >= 0.0001) {
            return `$${value.toFixed(6)}`;
        } else if (value >= 0.000001) {
            return `$${value.toFixed(8)}`;
        } else if (value > 0) {
            return `$${value.toExponential(3)}`;
        } else {
            return '$0.00';
        }
    };

    const formatChange = (changeValue: number | null) => {
        if (changeValue === null) return null;
        const sign = changeValue > 0 ? '+' : '';
        return `${sign}${changeValue.toFixed(2)}%`;
    };

    const getChangeColor = (changeValue: number | null) => {
        if (changeValue === null) return 'text-muted-foreground';
        if (changeValue > 0) return 'text-green-600';
        if (changeValue < 0) return 'text-red-600';
        return 'text-muted-foreground';
    };

    const getStatusIcon = () => {
        if (error) {
            return (
                <div title={`Error: ${error}`}>
                    <WifiOff className="h-3 w-3 text-red-500" />
                </div>
            );
        }
        if (!isConnected || isStale) {
            return (
                <div title="Connection issues">
                    <WifiOff className="h-3 w-3 text-yellow-500" />
                </div>
            );
        }
        return (
            <div title="Live data">
                <Wifi className="h-3 w-3 text-green-500" />
            </div>
        );
    };

    const formatTimeAgo = (timestamp: number | null) => {
        if (!timestamp) return 'Never';
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ago`;
    };

    return (
        <div className={cn('flex items-center gap-2', className)}>
            {/* Price Display */}
            <div className={cn(
                'font-medium transition-colors duration-300',
                hasRealtimeData && change !== null && Math.abs(change) > 0.01 ?
                    change > 0 ? 'text-green-600' : 'text-red-600'
                    : 'text-foreground'
            )}>
                {formatPrice(displayPrice)}
            </div>

            {/* Price Change */}
            {showChange && change !== null && (
                <div className={cn(
                    'flex items-center gap-1 text-xs font-medium transition-colors duration-300',
                    getChangeColor(change)
                )}>
                    {change > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                    ) : change < 0 ? (
                        <TrendingDown className="h-3 w-3" />
                    ) : null}
                    {formatChange(change)}
                </div>
            )}

            {/* Connection Status */}
            {showStatus && (
                <div className="flex items-center gap-1">
                    {getStatusIcon()}

                    {/* Refresh Button */}
                    <button
                        onClick={refresh}
                        className="p-1 rounded hover:bg-muted/20 transition-colors"
                        title={`Last update: ${formatTimeAgo(lastUpdate)}`}
                        disabled={!isConnected && !error}
                    >
                        <RotateCcw className={cn(
                            'h-3 w-3 text-muted-foreground hover:text-foreground transition-colors',
                            !isConnected && !error && 'animate-spin'
                        )} />
                    </button>
                </div>
            )}

            {/* Live indicator dot */}
            {hasRealtimeData && !isStale && (
                <div className="relative">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                    <div className="absolute inset-0 h-2 w-2 bg-green-500 rounded-full animate-ping opacity-75" />
                </div>
            )}
        </div>
    );
}

/**
 * Compact version for use in tables or small spaces
 */
export function CompactLivePriceIndicator({ contractId, fallbackPrice, className }: LivePriceIndicatorProps) {
    return (
        <LivePriceIndicator
            contractId={contractId}
            fallbackPrice={fallbackPrice}
            className={className}
            showChange={false}
            showStatus={false}
        />
    );
}

/**
 * Status-only indicator for monitoring connection health
 */
export function LivePriceStatus({ contractIds }: { contractIds: string[] }) {
    const { isLoading } = usePrices();
    const isConnected = !isLoading;

    return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isConnected ? (
                <>
                    <Wifi className="h-3 w-3 text-green-500" />
                    <span>Live prices</span>
                </>
            ) : (
                <>
                    <WifiOff className="h-3 w-3 text-red-500" />
                    <span>Offline</span>
                </>
            )}
        </div>
    );
}
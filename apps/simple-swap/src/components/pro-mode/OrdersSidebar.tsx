"use client";

import React from 'react';
import { Trash2, ChevronDown, ChevronRight, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { useProModeContext } from '../../contexts/pro-mode-context';
import { useSwapContext } from '../../contexts/swap-context';
import TokenLogo from '../TokenLogo';

export default function OrdersSidebar() {
    const {
        pairFilteredOrders,
        swapFilteredOrders,
        shouldShowSplitSections,
        tradingPairBase,
        tradingPairQuote,
        expandedOrderId,
        setExpandedOrderId,
        showAllOrders,
        setShowAllOrders,
        isLoadingOrders,
        ordersError,
        handleOrderAction,
        confirmCancelOrder,
        cancelOrderAction,
        executeOrderAction,
        cancelingOrders,
        executingOrders,
        confirmCancelOrderId,
        setConfirmCancelOrderId,
        toggleOrderExpansion,
        formatTokenAmount,
        formatCompactNumber,
        formatCompactPrice,
        formatRelativeTime,
    } = useProModeContext();

    const {
        selectedFromToken,
        selectedToToken,
    } = useSwapContext();

    // Dynamic formatting functions for better precision
    const formatDynamicPrice = (price: string | number) => {
        const num = Number(price);
        if (isNaN(num) || num === 0) return '0';

        const absNum = Math.abs(num);

        if (absNum >= 1000000) {
            return (num / 1000000).toFixed(2) + 'M';
        } else if (absNum >= 1000) {
            return (num / 1000).toFixed(2) + 'K';
        } else if (absNum >= 1) {
            return num.toFixed(4);
        } else if (absNum >= 0.0001) {
            return num.toFixed(6);
        } else if (absNum > 0) {
            return num.toExponential(2);
        } else {
            return '0';
        }
    };

    const formatDynamicAmount = (amount: string | number, decimals: number) => {
        const rawAmount = Number(amount);
        if (isNaN(rawAmount) || rawAmount === 0) return '0';

        const num = rawAmount / (10 ** (decimals || 6));
        const absNum = Math.abs(num);

        if (absNum >= 1000000) {
            return (num / 1000000).toFixed(2) + 'M';
        } else if (absNum >= 1000) {
            return (num / 1000).toFixed(2) + 'K';
        } else if (absNum >= 1) {
            return num.toFixed(3);
        } else if (absNum >= 0.0001) {
            return num.toFixed(6);
        } else if (absNum > 0) {
            return num.toExponential(2);
        } else {
            return '0';
        }
    };

    const renderOrderItem = (order: any) => {

        return (
            <div
                key={order.uuid}
                className="border border-border/40 rounded-lg p-3 hover:bg-muted/20 transition-colors cursor-pointer"
                onClick={() => toggleOrderExpansion(order.uuid)}
            >
                {/* Compact view - single row with requested structure */}
                <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 flex-1">
                        {/* Status badge */}
                        <Badge
                            variant={order.status === 'open' ? 'default' :
                                order.status === 'filled' ? 'secondary' : 'destructive'}
                            className="text-xs px-1.5 py-0.5"
                        >
                            {order.status}
                        </Badge>

                        {/* Amount */}
                        <span className="font-mono text-xs">
                            {formatDynamicAmount(order.amountIn || '0', order.inputTokenMeta.decimals || 6)}
                        </span>

                        {/* Token images with arrow */}
                        <div className="flex items-center space-x-1">
                            <TokenLogo
                                token={{ ...order.inputTokenMeta, image: order.inputTokenMeta.image ?? undefined }}
                                size="sm"
                            />
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            <TokenLogo
                                token={{ ...order.outputTokenMeta, image: order.outputTokenMeta.image ?? undefined }}
                                size="sm"
                            />
                        </div>

                        {/* Timestamp */}
                        <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(order.createdAt)}
                        </span>
                    </div>

                    {/* Expand indicator */}
                    <div className="flex items-center">
                        {expandedOrderId === order.uuid ?
                            <ChevronDown className="w-4 h-4 text-muted-foreground" /> :
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        }
                    </div>
                </div>

                {/* Expanded view - show all details */}
                {expandedOrderId === order.uuid && (
                    <div className="mt-3 pt-3 border-t border-border/20 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Amount:</span>
                            <span className="font-mono">
                                {formatCompactNumber(order.amountIn, order.inputTokenMeta.decimals)} {order.inputTokenMeta.symbol}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Price Trigger:</span>
                            <span className="font-mono">
                                1 {order.conditionTokenMeta.symbol} {order.direction === 'gt' ? '≥' : '≤'} {formatCompactPrice(order.targetPrice)} {order.baseAssetMeta?.symbol || 'USD'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Order ID:</span>
                            <span className="font-mono text-xs">{order.uuid.slice(0, 8)}...</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Created:</span>
                            <span className="font-mono text-xs">
                                {new Date(order.createdAt).toLocaleDateString()}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Expires:</span>
                            <span className="font-mono text-xs">
                                {order.validTo ? new Date(order.validTo).toLocaleDateString() : 'Never'}
                            </span>
                        </div>

                        {/* Action buttons in expanded view */}
                        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border/20">
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={cancelingOrders.has(order.uuid)}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    confirmCancelOrder(order.uuid);
                                }}
                                className="h-8 px-3 text-xs text-destructive hover:text-destructive disabled:opacity-50"
                            >
                                {cancelingOrders.has(order.uuid) ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                        Canceling...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-4 h-4 mr-1" />
                                        Cancel
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Cancel confirmation dialog */}
                {confirmCancelOrderId && (
                    <Dialog open onOpenChange={(open) => { if (!open) setConfirmCancelOrderId(null); }}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Cancel Order</DialogTitle>
                                <DialogDescription>
                                    Are you sure you want to cancel this order? This action cannot be undone.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter className="flex justify-end gap-2 pt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => setConfirmCancelOrderId(null)}
                                    disabled={cancelingOrders.has(confirmCancelOrderId)}
                                >
                                    Keep Order
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => cancelOrderAction(confirmCancelOrderId)}
                                    disabled={cancelingOrders.has(confirmCancelOrderId)}
                                >
                                    {cancelingOrders.has(confirmCancelOrderId) ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Canceling...
                                        </>
                                    ) : (
                                        'Cancel Order'
                                    )}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </div>
        );
    };

    if (isLoadingOrders) {
        return (
            <div className="w-96 border-l border-border/40 bg-card/50 backdrop-blur-sm flex flex-col">
                <div className="p-4 border-b border-border/40">
                    <h2 className="text-lg font-semibold text-foreground">Orders</h2>
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                        <p className="text-muted-foreground text-sm">Loading orders...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (ordersError) {
        return (
            <div className="w-96 border-l border-border/40 bg-card/50 backdrop-blur-sm flex flex-col">
                <div className="p-4 border-b border-border/40">
                    <h2 className="text-lg font-semibold text-foreground">Orders</h2>
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <p className="text-destructive text-sm mb-2">Error loading orders</p>
                        <p className="text-muted-foreground text-xs">{ordersError}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-96 border-l border-border/40 bg-card/50 backdrop-blur-sm flex flex-col">
            {shouldShowSplitSections ? (
                <>
                    {/* Top Half - Trading Pair Orders */}
                    <div className="flex-1 flex flex-col">
                        <div className="p-4 border-b border-border/40">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-lg font-semibold text-foreground">
                                    Price Triggers
                                </h2>
                                <Badge variant="outline" className="text-xs">
                                    {pairFilteredOrders.length}
                                </Badge>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowAllOrders(!showAllOrders)}
                                    className="text-xs h-6 px-2"
                                >
                                    {showAllOrders ? 'Open Only' : 'Show All'}
                                </Button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {pairFilteredOrders.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-muted-foreground text-sm">
                                        No price triggers
                                    </p>
                                </div>
                            ) : (
                                pairFilteredOrders.map(renderOrderItem)
                            )}
                        </div>
                    </div>

                    {/* Bottom Half - Swap Token Orders */}
                    <div className="flex-1 flex flex-col border-t border-border/40">
                        <div className="p-4 border-b border-border/40">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-lg font-semibold text-foreground">
                                    Swap Orders
                                </h2>
                                <Badge variant="outline" className="text-xs">
                                    {swapFilteredOrders.length}
                                </Badge>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {swapFilteredOrders.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-muted-foreground text-sm">
                                        No swap orders
                                    </p>
                                </div>
                            ) : (
                                swapFilteredOrders.map(renderOrderItem)
                            )}
                        </div>
                    </div>
                </>
            ) : (
                /* Single Section - All Orders */
                <>
                    <div className="p-4 border-b border-border/40">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-lg font-semibold text-foreground">Orders</h2>
                            <Badge variant="outline" className="text-xs">
                                {pairFilteredOrders.length}
                            </Badge>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowAllOrders(!showAllOrders)}
                                className="text-xs h-6 px-2"
                            >
                                {showAllOrders ? 'Open Only' : 'Show All'}
                            </Button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {pairFilteredOrders.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-muted-foreground text-sm">
                                    No orders found
                                </p>
                            </div>
                        ) : (
                            pairFilteredOrders.map(renderOrderItem)
                        )}
                    </div>
                </>
            )}
        </div>
    );
} 
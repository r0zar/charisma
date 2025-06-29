"use client";

import React from 'react';
import { StrategyDisplayData } from '@/lib/orders/strategy-formatter';
import { formatOrderCondition } from '@/lib/orders/condition-formatter';
import { StrategyProgressBar, ConditionStatusIndicator, PriceProgressBar } from './order-progress-indicators';
import { PremiumStatusBadge } from './orders-panel';
import TokenLogo from '../TokenLogo';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { Copy, Check, Zap, Trash2, ChevronDown, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { truncateAddress } from '@/lib/address-utils';
import { formatOrderDate, formatExecWindow, formatOrderStatusTime, formatStrategyStatusTime, getOrderTimestamps, getConditionIcon } from '@/lib/date-utils';

interface EnhancedStrategyCardProps {
    strategyData: StrategyDisplayData;
    currentPrices: Map<string, number>;
    isRecentlyUpdated: boolean;
    expandedStrategies: Set<string>;
    expandedRow: string | null;
    onToggleExpansion: (strategyId: string) => void;
    onToggleRowExpansion: (uuid: string) => void;
    onCopyToClipboard: (text: string, id: string) => void;
    onExecuteNow: (uuid: string) => void;
    onCancelOrder: (uuid: string) => void;
    copiedId: string | null;
    formatTokenAmount: (amount: string | number, decimals: number) => string;
}

export const EnhancedStrategyCard: React.FC<EnhancedStrategyCardProps> = ({
    strategyData,
    currentPrices,
    isRecentlyUpdated,
    expandedStrategies,
    expandedRow,
    onToggleExpansion,
    onToggleRowExpansion,
    onCopyToClipboard,
    onExecuteNow,
    onCancelOrder,
    copiedId,
    formatTokenAmount
}) => {
    const { id, type, description, orders, status } = strategyData;
    const isExpanded = expandedStrategies.has(id);
    const firstOrder = orders[0];

    // For single orders, show the old detailed view
    // For strategies, show the new grouped view
    const isSingleOrder = type === 'single';

    // Check if this specific card is expanded for detailed view
    const isDetailExpanded = expandedRow === (isSingleOrder ? firstOrder.uuid : id);

    return (
        <div
            className={cn(
                "group relative rounded-2xl border transition-all duration-300 cursor-pointer",
                isRecentlyUpdated
                    ? 'border-emerald-500/[0.3] bg-emerald-950/10 shadow-emerald-500/[0.1] ring-1 ring-emerald-500/[0.2]'
                    : 'border-white/[0.08] bg-black/20 hover:bg-black/30 hover:border-white/[0.15]',
                "backdrop-blur-sm"
            )}
            onClick={(e) => {
                e.stopPropagation();
                if (isSingleOrder) {
                    onToggleRowExpansion(firstOrder.uuid);
                } else {
                    onToggleExpansion(id);
                }
            }}
        >
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

            {/* Recently Updated Indicator */}
            {isRecentlyUpdated && (
                <>
                    <div className="absolute top-3 right-3 w-2 h-2 bg-emerald-400 rounded-full animate-ping z-10" />
                    <div className="absolute top-3 right-3 w-2 h-2 bg-emerald-400 rounded-full z-10" />
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-400 animate-pulse z-10 rounded-t-2xl" />
                </>
            )}

            <div className="relative p-6 space-y-4">
                {/* Header Row */}
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <div className="text-sm font-medium text-white/90" title={
                            isSingleOrder
                                ? formatOrderStatusTime(firstOrder).tooltip
                                : formatStrategyStatusTime({ status, orders }).tooltip
                        }>
                            {isSingleOrder
                                ? formatOrderStatusTime(firstOrder).text
                                : formatStrategyStatusTime({ status, orders }).text
                            }
                        </div>
                        {isSingleOrder ? (
                            <div className="flex items-center gap-2 text-xs text-white/40">
                                <span className="font-mono" title={firstOrder.uuid}>
                                    #{firstOrder.uuid.substring(0, 8)}
                                </span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onCopyToClipboard(firstOrder.uuid, firstOrder.uuid);
                                    }}
                                    className="p-1 rounded-lg hover:bg-white/[0.05] text-white/40 hover:text-white/80 transition-all duration-200 cursor-pointer"
                                    title="Copy order ID"
                                >
                                    {copiedId === firstOrder.uuid ? (
                                        <Check className="h-3 w-3 text-emerald-400" />
                                    ) : (
                                        <Copy className="h-3 w-3" />
                                    )}
                                </button>
                            </div>
                        ) : (
                            <><div className="text-xs text-white/60">
                                {description}
                            </div><div className="text-xs text-white/40 font-mono">
                                    {id}
                                </div>
                            </>
                        )}
                        {(firstOrder.validFrom || firstOrder.validTo) && (
                            <div className="text-xs text-white/40 mt-1">
                                {formatExecWindow(firstOrder.validFrom, firstOrder.validTo)}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {!isSingleOrder && (
                            <span className="text-xs text-white/60 px-2 py-1 rounded-lg bg-white/[0.05]">
                                {orders.length} orders
                            </span>
                        )}
                        <PremiumStatusBadge
                            status={isSingleOrder ? firstOrder.status : (
                                status === 'completed' ? 'confirmed' :
                                    status === 'active' || status === 'partially_filled' ? 'open' :
                                        'cancelled'
                            )}
                            txid={isSingleOrder ? firstOrder.txid : undefined}
                            failureReason={isSingleOrder ? firstOrder.failureReason : undefined}
                            conditionIcon={getConditionIcon(firstOrder, isSingleOrder ? 'single' : type)}
                        />
                    </div>
                </div>

                {/* Strategy Progress Bar (for multi-order strategies) */}
                {!isSingleOrder && (
                    <StrategyProgressBar strategyData={strategyData} />
                )}

                {/* Swap Details Row */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <TokenLogo token={{ ...firstOrder.inputTokenMeta, image: firstOrder.inputTokenMeta.image ?? undefined }} size="sm" />
                            <span className="text-sm font-medium text-white/80">{firstOrder.inputTokenMeta.symbol}</span>
                        </div>
                        <div className="flex items-center gap-2 text-white/40">
                            <span className="text-lg">→</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <TokenLogo token={{ ...firstOrder.outputTokenMeta, image: firstOrder.outputTokenMeta.image ?? undefined }} size="sm" />
                            <span className="text-sm font-medium text-white/80">{firstOrder.outputTokenMeta.symbol}</span>
                        </div>
                    </div>

                    <div className="text-right">
                        <div className="text-sm font-mono text-white/90">
                            {isSingleOrder ?
                                formatTokenAmount(firstOrder.amountIn, firstOrder.inputTokenMeta.decimals!) :
                                strategyData.totalValue
                            }
                        </div>
                        <div className="text-xs text-white/40">{firstOrder.inputTokenMeta.symbol}</div>
                    </div>
                </div>

                {/* Price Condition Display and Action Buttons */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                    {/* Left: Price Condition Details (only for price-triggered orders) */}
                    <div className="space-y-3">
                        {firstOrder.conditionToken && firstOrder.targetPrice && firstOrder.direction &&
                            !(firstOrder.conditionToken === '*' && firstOrder.targetPrice === '0' && firstOrder.direction === 'gt') ? (
                            (() => {
                                const currentPrice = currentPrices.get(firstOrder.conditionToken!);
                                const conditionData = formatOrderCondition(
                                    firstOrder,
                                    firstOrder.conditionTokenMeta,
                                    firstOrder.baseAssetMeta,
                                    currentPrice
                                );

                                return (
                                    <>
                                        <ConditionStatusIndicator conditionData={conditionData} />
                                        {conditionData.progressData && (
                                            <PriceProgressBar progressData={conditionData.progressData} />
                                        )}
                                    </>
                                );
                            })()
                        ) : null}
                    </div>

                    {/* Right: Action Buttons (only for single orders with open status) */}
                    {(isSingleOrder && firstOrder.status === "open") && (
                        <div className="flex gap-2 justify-end lg:justify-end">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onExecuteNow(firstOrder.uuid);
                                        }}
                                        className="p-2 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/[0.15] text-emerald-400 hover:bg-emerald-500/[0.15] hover:border-emerald-400/[0.3] transition-all duration-200 backdrop-blur-sm cursor-pointer"
                                    >
                                        <Zap className="h-4 w-4" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Execute order now</p>
                                </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onCancelOrder(firstOrder.uuid);
                                        }}
                                        className="p-2 rounded-xl bg-red-500/[0.08] border border-red-500/[0.15] text-red-400 hover:bg-red-500/[0.15] hover:border-red-400/[0.3] transition-all duration-200 backdrop-blur-sm cursor-pointer"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Cancel order</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    )}
                </div>

                {/* Expand/Collapse button for strategies */}
                {!isSingleOrder && (
                    <div className="pt-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleRowExpansion(id);
                            }}
                            className="flex items-center gap-2 text-xs text-white/60 hover:text-white/90 transition-all duration-200 cursor-pointer hover:transform hover:scale-105"
                        >
                            <span>{isDetailExpanded ? 'Hide details' : 'Show details'}</span>
                            <div className={cn(
                                "transition-transform duration-300 ease-in-out",
                                isDetailExpanded ? "rotate-180" : "rotate-0"
                            )}>
                                <ChevronDown className="h-4 w-4" />
                            </div>
                        </button>
                    </div>
                )}

                {/* Expanded Strategy Details */}
                {!isSingleOrder && (
                    <div className={cn(
                        "overflow-hidden transition-all duration-500 ease-in-out border-t border-white/[0.08]",
                        isExpanded
                            ? "max-h-[2000px] opacity-100 pt-4"
                            : "max-h-0 opacity-0 pt-0"
                    )}>
                        <div className={cn(
                            "space-y-3 transition-all duration-300 ease-in-out",
                            isExpanded ? "transform translate-y-0" : "transform -translate-y-4"
                        )}>
                            {orders.map((order, index) => {
                                const isOrderExpanded = expandedRow === order.uuid;
                                return (
                                    <div key={order.uuid} className="rounded-xl bg-white/[0.02] border border-white/[0.05] transition-all duration-200 hover:shadow-lg hover:shadow-white/[0.02]">
                                        <div
                                            className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/[0.02] transition-all duration-200"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleRowExpansion(order.uuid);
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-white/60 font-mono">#{index + 1}</span>
                                                <div>
                                                    <div className="text-xs text-white/80 font-mono">
                                                        {formatTokenAmount(order.amountIn, order.inputTokenMeta.decimals!)} {order.inputTokenMeta.symbol}
                                                        {order.metadata?.quote && (
                                                            <span className="text-white/60 ml-1">
                                                                → {formatTokenAmount(order.metadata.quote.amountOut, order.outputTokenMeta.decimals!)} {order.outputTokenMeta.symbol}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-white/40">
                                                        {order.uuid.substring(0, 8)}
                                                    </div>
                                                    {(order.validFrom || order.validTo) && (
                                                        <div className="text-xs text-white/40 mt-1">
                                                            {formatExecWindow(order.validFrom, order.validTo)}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <PremiumStatusBadge
                                                    status={order.status}
                                                    txid={order.txid}
                                                    failureReason={order.failureReason}
                                                />
                                                {order.status === 'open' && (
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onExecuteNow(order.uuid);
                                                            }}
                                                            className="p-1 rounded-lg bg-emerald-500/[0.08] text-emerald-400 hover:bg-emerald-500/[0.15] transition-all duration-200 cursor-pointer"
                                                            title="Execute now"
                                                        >
                                                            <Zap className="h-3 w-3" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onCancelOrder(order.uuid);
                                                            }}
                                                            className="p-1 rounded-lg bg-red-500/[0.08] text-red-400 hover:bg-red-500/[0.15] transition-all duration-200 cursor-pointer"
                                                            title="Cancel"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                )}
                                                <div className="p-1 rounded-lg text-white/40 transition-all duration-300 pointer-events-none">
                                                    <div className={cn(
                                                        "transition-transform duration-300 ease-in-out",
                                                        isOrderExpanded ? "rotate-180" : "rotate-0"
                                                    )}>
                                                        <ChevronDown className="h-3 w-3" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Individual Order Detailed View */}
                                        <div className={cn(
                                            "overflow-hidden transition-all duration-400 ease-in-out border-t border-white/[0.05]",
                                            isOrderExpanded
                                                ? "max-h-[1500px] opacity-100"
                                                : "max-h-0 opacity-0"
                                        )}>
                                            <div className={cn(
                                                "px-3 pb-3 space-y-4 transition-all duration-300 ease-in-out",
                                                isOrderExpanded ? "transform translate-y-0 pt-3" : "transform -translate-y-4 pt-0"
                                            )}>
                                                <div className="grid gap-4 md:grid-cols-2 pt-3">
                                                    {/* Technical Parameters */}
                                                    <div className="space-y-3">
                                                        <h4 className="text-xs font-medium text-white/90 flex items-center gap-2">
                                                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                                                            Technical Parameters
                                                        </h4>
                                                        <div className="space-y-2 text-xs">
                                                            <div className="flex justify-between">
                                                                <span className="text-white/60">Order UUID:</span>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-mono text-white/80">{order.uuid}</span>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            onCopyToClipboard(order.uuid, order.uuid);
                                                                        }}
                                                                        className="p-0.5 rounded hover:bg-white/[0.05] text-white/40 hover:text-white/80 transition-colors cursor-pointer"
                                                                    >
                                                                        {copiedId === order.uuid ? (
                                                                            <Check className="h-2.5 w-2.5 text-emerald-400" />
                                                                        ) : (
                                                                            <Copy className="h-2.5 w-2.5" />
                                                                        )}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-white/60">Input Token:</span>
                                                                <span className="font-mono text-white/80">{order.inputToken}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-white/60">Output Token:</span>
                                                                <span className="font-mono text-white/80">{order.outputToken}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-white/60">Amount (micro units):</span>
                                                                <span className="font-mono text-white/80">{order.amountIn}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-white/60">Recipient:</span>
                                                                <span className="font-mono text-white/80">{truncateAddress(order.recipient)}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-white/60">Owner:</span>
                                                                <span className="font-mono text-white/80">{truncateAddress(order.owner)}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Condition Details */}
                                                    <div className="space-y-3">
                                                        <h4 className="text-xs font-medium text-white/90 flex items-center gap-2">
                                                            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
                                                            Condition Details
                                                        </h4>
                                                        <div className="space-y-2 text-xs">
                                                            {order.conditionToken &&
                                                                !(order.conditionToken === '*' && order.targetPrice === '0' && order.direction === 'gt') ? (
                                                                <>
                                                                    <div className="flex justify-between">
                                                                        <span className="text-white/60">Condition Token:</span>
                                                                        <span className="font-mono text-white/80">{order.conditionToken}</span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span className="text-white/60">Target Price:</span>
                                                                        <span className="font-mono text-white/80">{order.targetPrice}</span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span className="text-white/60">Direction:</span>
                                                                        <span className="text-white/80 capitalize">{order.direction}</span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span className="text-white/60">Base Asset:</span>
                                                                        <span className="font-mono text-white/80">{order.baseAsset || 'USD'}</span>
                                                                    </div>
                                                                    {order.creationPrice && (
                                                                        <div className="flex justify-between">
                                                                            <span className="text-white/60">Creation Price:</span>
                                                                            <span className="font-mono text-white/80">{order.creationPrice}</span>
                                                                        </div>
                                                                    )}
                                                                    <div className="mt-3 p-2 rounded-lg bg-blue-500/[0.08] border border-blue-500/[0.15]">
                                                                        <div className="text-blue-400 text-xs font-medium mb-1">
                                                                            Execution Trigger
                                                                        </div>
                                                                        <div className="text-white/70 text-xs">
                                                                            Order executes when {order.conditionTokenMeta?.symbol || order.conditionToken} price {order.direction === 'gt' ? 'reaches or exceeds' : 'drops to or below'} {order.targetPrice} {order.baseAsset || 'USD'}
                                                                        </div>
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <div className="p-2 rounded-lg bg-amber-500/[0.08] border border-amber-500/[0.15]">
                                                                    <div className="text-amber-400 text-xs font-medium mb-1">
                                                                        {order.conditionToken === '*' && type === 'dca' ?
                                                                            'Time-triggered Execution' :
                                                                            order.conditionToken === '*' ? 'Immediate Execution' : 'Execute on Command'
                                                                        }
                                                                    </div>
                                                                    <div className="text-white/70 text-xs">
                                                                        {order.conditionToken === '*' && type === 'dca' ?
                                                                            'This order will execute automatically within its scheduled time window' :
                                                                            order.conditionToken === '*' ?
                                                                                'This order will be executed automatically right away' :
                                                                                'This order must be triggered manually via the interface or API'
                                                                        }
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Timestamps */}
                                                <div className="border-t border-white/[0.05] pt-3">
                                                    <h4 className="text-xs font-medium text-white/90 flex items-center gap-2 mb-3">
                                                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                                                        Timeline
                                                    </h4>
                                                    <div className="space-y-2 text-xs">
                                                        {getOrderTimestamps(order).map((timestamp, idx) => (
                                                            <div key={idx} className={`flex justify-between ${timestamp.isMain ? 'text-white/90 font-medium' : 'text-white/70'}`}>
                                                                <span className="text-white/60">{timestamp.label}:</span>
                                                                <span>{timestamp.time}</span>
                                                            </div>
                                                        ))}
                                                        {order.txid && (
                                                            <div className="flex justify-between items-center pt-2 border-t border-white/[0.05]">
                                                                <span className="text-white/60">Transaction:</span>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-mono text-white/80">{truncateAddress(order.txid)}</span>
                                                                    <a
                                                                        href={`https://explorer.hiro.so/txid/${order.txid}?chain=mainnet`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="p-0.5 rounded hover:bg-white/[0.05] text-white/40 hover:text-white/80 transition-colors cursor-pointer"
                                                                        title="View on explorer"
                                                                    >
                                                                        <ExternalLink className="h-2.5 w-2.5" />
                                                                    </a>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Execution Window */}
                                                {(order.validFrom || order.validTo) && (
                                                    <div className="border-t border-white/[0.05] pt-3">
                                                        <h4 className="text-xs font-medium text-white/90 flex items-center gap-2 mb-3">
                                                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                                                            Execution Window
                                                        </h4>
                                                        <div className="grid gap-2 md:grid-cols-2 text-xs">
                                                            <div className="flex justify-between">
                                                                <span className="text-white/60">Valid From:</span>
                                                                <span className="text-white/80">{order.validFrom || 'Immediate'}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-white/60">Valid To:</span>
                                                                <span className="text-white/80">{order.validTo || 'No expiry'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Detailed Technical View - Strategy-level details only */}
                <div className={cn(
                    "overflow-hidden transition-all duration-500 ease-in-out border-t border-white/[0.08]",
                    isDetailExpanded
                        ? "max-h-[2000px] opacity-100 pt-6"
                        : "max-h-0 opacity-0 pt-0"
                )}>
                    <div className={cn(
                        "space-y-6 transition-all duration-300 ease-in-out",
                        isDetailExpanded ? "transform translate-y-0" : "transform -translate-y-4"
                    )}>
                        {!isSingleOrder ? (
                            // Strategy Details View
                            <div className="space-y-6">
                                <div className="grid gap-6 md:grid-cols-2">
                                    {/* Strategy Information */}
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-medium text-white/90 flex items-center gap-2">
                                            <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                                            Strategy Information
                                        </h4>
                                        <div className="space-y-3 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-white/60">Strategy ID:</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-white/80">{strategyData.id}</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onCopyToClipboard(strategyData.id, strategyData.id);
                                                        }}
                                                        className="p-1 rounded hover:bg-white/[0.05] text-white/40 hover:text-white/80 transition-colors cursor-pointer"
                                                    >
                                                        {copiedId === strategyData.id ? (
                                                            <Check className="h-3 w-3 text-emerald-400" />
                                                        ) : (
                                                            <Copy className="h-3 w-3" />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-white/60">Type:</span>
                                                <span className="text-white/80 capitalize">{strategyData.type}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-white/60">Description:</span>
                                                <span className="text-white/80">{strategyData.description}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-white/60">Total Value:</span>
                                                <span className="text-white/80">{strategyData.totalValue} {firstOrder.inputTokenMeta.symbol}</span>
                                            </div>
                                            {strategyData.estimatedCompletion && (
                                                <div className="flex justify-between">
                                                    <span className="text-white/60">Est. Completion:</span>
                                                    <span className="text-white/80">{strategyData.estimatedCompletion}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Strategy Progress */}
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-medium text-white/90 flex items-center gap-2">
                                            <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                                            Progress Overview
                                        </h4>
                                        <div className="space-y-3 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-white/60">Total Orders:</span>
                                                <span className="text-white/80">{strategyData.totalOrders}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-white/60">Completed:</span>
                                                <span className="text-white/80">{strategyData.completedOrders}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-white/60">Remaining:</span>
                                                <span className="text-white/80">{strategyData.totalOrders - strategyData.completedOrders}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-white/60">Progress:</span>
                                                <span className="text-white/80">{Math.round(strategyData.progressPercent)}%</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-white/60">Status:</span>
                                                <span className="text-white/80 capitalize">{strategyData.status.replace('_', ' ')}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Strategy Creation Details */}
                                <div className="border-t border-white/[0.05] pt-4">
                                    <h4 className="text-sm font-medium text-white/90 flex items-center gap-2 mb-4">
                                        <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                                        Creation Details
                                    </h4>
                                    <div className="grid gap-3 md:grid-cols-2 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Created:</span>
                                            <span className="text-white/80">{formatOrderDate(firstOrder.createdAt)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Owner:</span>
                                            <span className="font-mono text-white/80">{truncateAddress(firstOrder.owner)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Trading Pair:</span>
                                            <span className="text-white/80">{firstOrder.inputTokenMeta.symbol} → {firstOrder.outputTokenMeta.symbol}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Recipient:</span>
                                            <span className="font-mono text-white/80">{truncateAddress(firstOrder.recipient)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-center text-xs text-white/40 italic">
                                    Expand individual orders above for detailed technical parameters and transaction information
                                </div>
                            </div>
                        ) : (
                            // Single Order Details View (unchanged for single orders)
                            <div className="grid gap-6 md:grid-cols-2">
                                {/* Technical Parameters */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-medium text-white/90 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                                        Technical Parameters
                                    </h4>
                                    <div className="space-y-3 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Order UUID:</span>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-white/80">{firstOrder.uuid}</span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onCopyToClipboard(firstOrder.uuid, firstOrder.uuid);
                                                    }}
                                                    className="p-1 rounded hover:bg-white/[0.05] text-white/40 hover:text-white/80 transition-colors cursor-pointer"
                                                >
                                                    {copiedId === firstOrder.uuid ? (
                                                        <Check className="h-3 w-3 text-emerald-400" />
                                                    ) : (
                                                        <Copy className="h-3 w-3" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Input Token:</span>
                                            <span className="font-mono text-white/80">{firstOrder.inputToken}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Output Token:</span>
                                            <span className="font-mono text-white/80">{firstOrder.outputToken}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Amount (micro units):</span>
                                            <span className="font-mono text-white/80">{firstOrder.amountIn}</span>
                                        </div>
                                        {firstOrder.metadata?.quote && (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-white/60">Quote Input:</span>
                                                    <span className="font-mono text-white/80">
                                                        {formatTokenAmount(firstOrder.metadata.quote.amountIn, firstOrder.inputTokenMeta.decimals!)} {firstOrder.inputTokenMeta.symbol}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-white/60">Quote Output:</span>
                                                    <span className="font-mono text-white/80">
                                                        {formatTokenAmount(firstOrder.metadata.quote.amountOut, firstOrder.outputTokenMeta.decimals!)} {firstOrder.outputTokenMeta.symbol}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-white/60">Quote Slippage:</span>
                                                    <span className="font-mono text-white/80">{(firstOrder.metadata.quote.slippage * 100).toFixed(1)}%</span>
                                                </div>
                                            </>
                                        )}
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Recipient:</span>
                                            <span className="font-mono text-white/80">{truncateAddress(firstOrder.recipient)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Owner:</span>
                                            <span className="font-mono text-white/80">{truncateAddress(firstOrder.owner)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Condition Details */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-medium text-white/90 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
                                        Condition Details
                                    </h4>
                                    <div className="space-y-3 text-xs">
                                        {firstOrder.conditionToken &&
                                            !(firstOrder.conditionToken === '*' && firstOrder.targetPrice === '0' && firstOrder.direction === 'gt') ? (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-white/60">Condition Token:</span>
                                                    <span className="font-mono text-white/80">{firstOrder.conditionToken}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-white/60">Target Price:</span>
                                                    <span className="font-mono text-white/80">{firstOrder.targetPrice}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-white/60">Direction:</span>
                                                    <span className="text-white/80 capitalize">{firstOrder.direction}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-white/60">Base Asset:</span>
                                                    <span className="font-mono text-white/80">{firstOrder.baseAsset || 'USD'}</span>
                                                </div>
                                                {firstOrder.creationPrice && (
                                                    <div className="flex justify-between">
                                                        <span className="text-white/60">Creation Price:</span>
                                                        <span className="font-mono text-white/80">{firstOrder.creationPrice}</span>
                                                    </div>
                                                )}
                                                {currentPrices.get(firstOrder.conditionToken) && (
                                                    <div className="flex justify-between">
                                                        <span className="text-white/60">Current Price:</span>
                                                        <span className="font-mono text-white/80">{currentPrices.get(firstOrder.conditionToken)?.toFixed(6)}</span>
                                                    </div>
                                                )}
                                                <div className="mt-3 p-2 rounded-lg bg-blue-500/[0.08] border border-blue-500/[0.15]">
                                                    <div className="text-blue-400 text-xs font-medium mb-1">
                                                        Execution Trigger
                                                    </div>
                                                    <div className="text-white/70 text-xs">
                                                        Order executes when {firstOrder.conditionTokenMeta?.symbol || firstOrder.conditionToken} price {firstOrder.direction === 'gt' ? 'reaches or exceeds' : 'drops to or below'} {firstOrder.targetPrice} {firstOrder.baseAsset || 'USD'}
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="p-2 rounded-lg bg-amber-500/[0.08] border border-amber-500/[0.15]">
                                                <div className="text-amber-400 text-xs font-medium mb-1">
                                                    {firstOrder.conditionToken === '*' && !isSingleOrder && type === 'dca' ?
                                                        'Time-triggered Execution' :
                                                        firstOrder.conditionToken === '*' ? 'Immediate Execution' : 'Execute on Command'
                                                    }
                                                </div>
                                                <div className="text-white/70 text-xs">
                                                    {firstOrder.conditionToken === '*' && !isSingleOrder && type === 'dca' ?
                                                        'This order will execute automatically within its scheduled time window' :
                                                        firstOrder.conditionToken === '*' ?
                                                            'This order will be executed automatically right away' :
                                                            'This order must be triggered manually via the interface or API'
                                                    }
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Timeline */}
                                    <div className="pt-4 border-t border-white/[0.05]">
                                        <h4 className="text-sm font-medium text-white/90 flex items-center gap-2 mb-4">
                                            <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                                            Timeline
                                        </h4>
                                        <div className="space-y-3 text-xs">
                                            {getOrderTimestamps(firstOrder).map((timestamp, idx) => (
                                                <div key={idx} className={`flex justify-between ${timestamp.isMain ? 'text-white/90 font-medium' : 'text-white/70'}`}>
                                                    <span className="text-white/60">{timestamp.label}:</span>
                                                    <span className="text-white/80">{timestamp.time}</span>
                                                </div>
                                            ))}
                                            {firstOrder.txid && (
                                                <div className="flex justify-between items-center pt-2 border-t border-white/[0.05]">
                                                    <span className="text-white/60">Transaction:</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-white/80">{truncateAddress(firstOrder.txid)}</span>
                                                        <a
                                                            href={`https://explorer.hiro.so/txid/${firstOrder.txid}?chain=mainnet`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="p-1 rounded hover:bg-white/[0.05] text-white/40 hover:text-white/80 transition-colors cursor-pointer"
                                                            title="View on explorer"
                                                        >
                                                            <ExternalLink className="h-3 w-3" />
                                                        </a>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Execution Window */}
                                    {(firstOrder.validFrom || firstOrder.validTo) && (
                                        <div className="pt-4 border-t border-white/[0.05]">
                                            <h4 className="text-sm font-medium text-white/90 flex items-center gap-2 mb-4">
                                                <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                                                Execution Window
                                            </h4>
                                            <div className="space-y-3 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-white/60">Valid From:</span>
                                                    <span className="text-white/80">{firstOrder.validFrom || 'Immediate'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-white/60">Valid To:</span>
                                                    <span className="text-white/80">{firstOrder.validTo || 'No expiry'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Click hint */}
                        <div className="text-center">
                            <span className="text-xs text-white/40">Click to collapse details</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
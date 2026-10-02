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
import { truncateAddress, truncateSmartContract, truncateUuid } from '@/lib/address-utils';
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
                    ? 'border-success/[0.3] bg-success-soft shadow-emerald-500/[0.1] ring-1 ring-success/[0.2]'
                    : 'border-line bg-surface hover:bg-surface-hover hover:border-line-strong',
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

            {/* Recently Updated Indicator */}
            {isRecentlyUpdated && (
                <>
                    <div className="absolute top-3 right-3 w-2 h-2 bg-success rounded-full animate-ping z-10" />
                    <div className="absolute top-3 right-3 w-2 h-2 bg-success rounded-full z-10" />
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-success to-blaze animate-pulse z-10 rounded-t-2xl" />
                </>
            )}

            <div className="relative p-3 sm:p-6 space-y-4 overflow-hidden">
                {/* Header Row */}
                <div className="flex items-start justify-between">
                    <div className="space-y-1 min-w-0 flex-1 pr-4">
                        <div className="text-sm font-medium text-ink" title={
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
                            <div className="flex items-center gap-2 text-xs text-ink-muted">
                                <span className="font-mono" title={firstOrder.uuid}>
                                    #{truncateUuid(firstOrder.uuid)}
                                </span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onCopyToClipboard(firstOrder.uuid, firstOrder.uuid);
                                    }}
                                    className="p-1 rounded-lg hover:bg-surface-hover text-ink-muted hover:text-ink-body transition-all duration-200 cursor-pointer"
                                    title="Copy order ID"
                                >
                                    {copiedId === firstOrder.uuid ? (
                                        <Check className="h-3 w-3 text-success" />
                                    ) : (
                                        <Copy className="h-3 w-3" />
                                    )}
                                </button>
                            </div>
                        ) : (
                            <><div className="text-xs text-ink-muted truncate max-w-full">
                                {description}
                            </div><div className="text-xs text-ink-muted font-mono" title={id}>
                                    {truncateSmartContract(id)}
                                </div>
                            </>
                        )}
                        {(firstOrder.validFrom || firstOrder.validTo) && (
                            <div className="text-xs text-ink-muted mt-1">
                                {formatExecWindow(firstOrder.validFrom, firstOrder.validTo)}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        {!isSingleOrder && (
                            <span className="text-xs text-ink-muted px-2 py-1 rounded-lg bg-surface">
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
                            <span className="text-sm font-medium text-ink-body">{firstOrder.inputTokenMeta.symbol}</span>
                        </div>
                        <div className="flex items-center gap-2 text-ink-muted">
                            <span className="text-lg">→</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <TokenLogo token={{ ...firstOrder.outputTokenMeta, image: firstOrder.outputTokenMeta.image ?? undefined }} size="sm" />
                            <span className="text-sm font-medium text-ink-body">{firstOrder.outputTokenMeta.symbol}</span>
                        </div>
                    </div>

                    <div className="text-right">
                        <div className="text-sm font-mono text-ink">
                            {isSingleOrder ?
                                formatTokenAmount(firstOrder.amountIn, firstOrder.inputTokenMeta.decimals!) :
                                strategyData.totalValue
                            }
                        </div>
                        <div className="text-xs text-ink-muted">{firstOrder.inputTokenMeta.symbol}</div>
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
                                        className="p-2 rounded-xl bg-success/[0.08] border border-success/[0.15] text-success hover:bg-success/[0.15] hover:border-success/[0.3] transition-all duration-200 backdrop-blur-sm cursor-pointer"
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
                                        className="p-2 rounded-xl bg-danger/[0.08] border border-danger/[0.15] text-danger hover:bg-danger/[0.15] hover:border-danger/[0.3] transition-all duration-200 backdrop-blur-sm cursor-pointer"
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
                            className="flex items-center gap-2 text-xs text-ink-muted hover:text-ink transition-all duration-200 cursor-pointer hover:transform hover:scale-105"
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
 "overflow-hidden transition-all duration-500 ease-in-out border-t border-line",
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
                                    <div key={order.uuid} className="rounded-xl bg-surface-sunken border border-line-soft transition-all duration-200 hover:shadow-lg hover:shadow-white/[0.02]">
                                        <div
                                            className="flex items-center justify-between p-3 cursor-pointer hover:bg-surface transition-all duration-200"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleRowExpansion(order.uuid);
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-ink-muted font-mono">#{index + 1}</span>
                                                <div>
                                                    <div className="text-xs text-ink-body font-mono">
                                                        {formatTokenAmount(order.amountIn, order.inputTokenMeta.decimals!)} {order.inputTokenMeta.symbol}
                                                        {order.metadata?.quote && (
                                                            <span className="text-ink-muted ml-1">
                                                                → {formatTokenAmount(order.metadata.quote.amountOut, order.outputTokenMeta.decimals!)} {order.outputTokenMeta.symbol}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-ink-muted">
                                                        {order.uuid.substring(0, 8)}
                                                    </div>
                                                    {(order.validFrom || order.validTo) && (
                                                        <div className="text-xs text-ink-muted mt-1">
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
                                                            className="p-1 rounded-lg bg-success/[0.08] text-success hover:bg-success/[0.15] transition-all duration-200 cursor-pointer"
                                                            title="Execute now"
                                                        >
                                                            <Zap className="h-3 w-3" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onCancelOrder(order.uuid);
                                                            }}
                                                            className="p-1 rounded-lg bg-danger/[0.08] text-danger hover:bg-danger/[0.15] transition-all duration-200 cursor-pointer"
                                                            title="Cancel"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                )}
                                                <div className="p-1 rounded-lg text-ink-muted transition-all duration-300 pointer-events-none">
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
 "overflow-hidden transition-all duration-400 ease-in-out border-t border-line-soft",
                                            isOrderExpanded
                                                ? "max-h-[1500px] opacity-100"
                                                : "max-h-0 opacity-0"
                                        )}>
                                            <div className={cn(
 "px-2 sm:px-3 pb-3 space-y-4 transition-all duration-300 ease-in-out",
                                                isOrderExpanded ? "transform translate-y-0 pt-3" : "transform -translate-y-4 pt-0"
                                            )}>
                                                <div className="grid gap-4 lg:grid-cols-2 pt-3">
                                                    {/* Technical Parameters */}
                                                    <div className="space-y-3">
                                                        <h4 className="text-xs font-medium text-ink flex items-center gap-2">
                                                            <span className="w-1.5 h-1.5 bg-accent rounded-full"></span>
                                                            Technical Parameters
                                                        </h4>
                                                        <div className="space-y-2 text-xs">
                                                            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                                                <span className="text-ink-muted">Order UUID:</span>
                                                                <div className="flex items-center gap-1 min-w-0">
                                                                    <span className="font-mono text-ink-body text-xs" title={order.uuid}>{truncateUuid(order.uuid)}</span>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            onCopyToClipboard(order.uuid, order.uuid);
                                                                        }}
                                                                        className="p-0.5 rounded hover:bg-surface-hover text-ink-muted hover:text-ink-body transition-colors cursor-pointer"
                                                                    >
                                                                        {copiedId === order.uuid ? (
                                                                            <Check className="h-2.5 w-2.5 text-success" />
                                                                        ) : (
                                                                            <Copy className="h-2.5 w-2.5" />
                                                                        )}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                                                <span className="text-ink-muted">Input Token:</span>
                                                                <span className="font-mono text-ink-body text-xs" title={order.inputToken}>{truncateSmartContract(order.inputToken)}</span>
                                                            </div>
                                                            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                                                <span className="text-ink-muted">Output Token:</span>
                                                                <span className="font-mono text-ink-body text-xs" title={order.outputToken}>{truncateSmartContract(order.outputToken)}</span>
                                                            </div>
                                                            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                                                <span className="text-ink-muted">Amount (micro units):</span>
                                                                <span className="font-mono text-ink-body">{order.amountIn}</span>
                                                            </div>
                                                            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                                                <span className="text-ink-muted">Recipient:</span>
                                                                <span className="font-mono text-ink-body">{truncateAddress(order.recipient)}</span>
                                                            </div>
                                                            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                                                <span className="text-ink-muted">Owner:</span>
                                                                <span className="font-mono text-ink-body">{truncateAddress(order.owner)}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Condition Details */}
                                                    <div className="space-y-3">
                                                        <h4 className="text-xs font-medium text-ink flex items-center gap-2">
                                                            <span className="w-1.5 h-1.5 bg-warning rounded-full"></span>
                                                            Condition Details
                                                        </h4>
                                                        <div className="space-y-2 text-xs">
                                                            {order.conditionToken &&
                                                                !(order.conditionToken === '*' && order.targetPrice === '0' && order.direction === 'gt') ? (
                                                                <>
                                                                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                                                        <span className="text-ink-muted">Condition Token:</span>
                                                                        <span className="font-mono text-ink-body text-xs" title={order.conditionToken}>{truncateSmartContract(order.conditionToken)}</span>
                                                                    </div>
                                                                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                                                        <span className="text-ink-muted">Target Price:</span>
                                                                        <span className="font-mono text-ink-body">{order.targetPrice}</span>
                                                                    </div>
                                                                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                                                        <span className="text-ink-muted">Direction:</span>
                                                                        <span className="text-ink-body capitalize">{order.direction}</span>
                                                                    </div>
                                                                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                                                        <span className="text-ink-muted">Base Asset:</span>
                                                                        <span className="font-mono text-ink-body text-xs" title={order.baseAsset || 'USD'}>{order.baseAsset ? truncateSmartContract(order.baseAsset) : 'USD'}</span>
                                                                    </div>
                                                                    {order.creationPrice && (
                                                                        <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                                                            <span className="text-ink-muted">Creation Price:</span>
                                                                            <span className="font-mono text-ink-body">{order.creationPrice}</span>
                                                                        </div>
                                                                    )}
                                                                    <div className="mt-3 p-2 rounded-lg bg-accent/[0.08] border border-accent/[0.15]">
                                                                        <div className="text-accent-text text-xs font-medium mb-1">
                                                                            Execution Trigger
                                                                        </div>
                                                                        <div className="text-ink-body text-xs">
                                                                            Order executes when {order.conditionTokenMeta?.symbol || order.conditionToken} price {order.direction === 'gt' ? 'reaches or exceeds' : 'drops to or below'} {order.targetPrice} {order.baseAsset || 'USD'}
                                                                        </div>
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <div className="p-2 rounded-lg bg-warning/[0.08] border border-warning/[0.15]">
                                                                    <div className="text-warning text-xs font-medium mb-1">
                                                                        {order.conditionToken === '*' && type === 'dca' ?
                                                                            'Time-triggered Execution' :
                                                                            order.conditionToken === '*' ? 'Immediate Execution' : 'Execute on Command'
                                                                        }
                                                                    </div>
                                                                    <div className="text-ink-body text-xs">
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
                                                <div className="border-t border-line-soft pt-3">
                                                    <h4 className="text-xs font-medium text-ink flex items-center gap-2 mb-3">
                                                        <span className="w-1.5 h-1.5 bg-success rounded-full"></span>
                                                        Timeline
                                                    </h4>
                                                    <div className="space-y-2 text-xs">
                                                        {getOrderTimestamps(order).map((timestamp, idx) => (
                                                            <div key={idx} className={`flex justify-between ${timestamp.isMain ? 'text-ink font-medium' : 'text-ink-body'}`}>
                                                                <span className="text-ink-muted">{timestamp.label}:</span>
                                                                <span>{timestamp.time}</span>
                                                            </div>
                                                        ))}
                                                        {order.txid && (
                                                            <div className="flex justify-between items-center pt-2 border-t border-line-soft">
                                                                <span className="text-ink-muted">Transaction:</span>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-mono text-ink-body">{truncateAddress(order.txid)}</span>
                                                                    <a
                                                                        href={`https://explorer.hiro.so/txid/${order.txid}?chain=mainnet`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="p-0.5 rounded hover:bg-surface-hover text-ink-muted hover:text-ink-body transition-colors cursor-pointer"
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
                                                    <div className="border-t border-line-soft pt-3">
                                                        <h4 className="text-xs font-medium text-ink flex items-center gap-2 mb-3">
                                                            <span className="w-1.5 h-1.5 bg-accent rounded-full"></span>
                                                            Execution Window
                                                        </h4>
                                                        <div className="space-y-2 text-xs">
                                                            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                                                <span className="text-ink-muted">Valid From:</span>
                                                                <span className="text-ink-body truncate text-xs max-w-full">{order.validFrom ? formatOrderDate(order.validFrom) : 'Immediate'}</span>
                                                            </div>
                                                            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                                                <span className="text-ink-muted">Valid To:</span>
                                                                <span className="text-ink-body truncate text-xs max-w-full">{order.validTo ? formatOrderDate(order.validTo) : 'No expiry'}</span>
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
 "overflow-hidden transition-all duration-500 ease-in-out border-t border-line",
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
                                        <h4 className="text-sm font-medium text-ink flex items-center gap-2">
                                            <span className="w-2 h-2 bg-blaze rounded-full"></span>
                                            Strategy Information
                                        </h4>
                                        <div className="space-y-3 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-ink-muted">Strategy ID:</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-ink-body">{strategyData.id}</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onCopyToClipboard(strategyData.id, strategyData.id);
                                                        }}
                                                        className="p-1 rounded hover:bg-surface-hover text-ink-muted hover:text-ink-body transition-colors cursor-pointer"
                                                    >
                                                        {copiedId === strategyData.id ? (
                                                            <Check className="h-3 w-3 text-success" />
                                                        ) : (
                                                            <Copy className="h-3 w-3" />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-ink-muted">Type:</span>
                                                <span className="text-ink-body capitalize">{strategyData.type}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-ink-muted">Description:</span>
                                                <span className="text-ink-body">{strategyData.description}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-ink-muted">Total Value:</span>
                                                <span className="text-ink-body">{strategyData.totalValue} {firstOrder.inputTokenMeta.symbol}</span>
                                            </div>
                                            {strategyData.estimatedCompletion && (
                                                <div className="flex justify-between">
                                                    <span className="text-ink-muted">Est. Completion:</span>
                                                    <span className="text-ink-body">{strategyData.estimatedCompletion}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Strategy Progress */}
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-medium text-ink flex items-center gap-2">
                                            <span className="w-2 h-2 bg-success rounded-full"></span>
                                            Progress Overview
                                        </h4>
                                        <div className="space-y-3 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-ink-muted">Total Orders:</span>
                                                <span className="text-ink-body">{strategyData.totalOrders}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-ink-muted">Completed:</span>
                                                <span className="text-ink-body">{strategyData.completedOrders}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-ink-muted">Remaining:</span>
                                                <span className="text-ink-body">{strategyData.totalOrders - strategyData.completedOrders}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-ink-muted">Progress:</span>
                                                <span className="text-ink-body">{Math.round(strategyData.progressPercent)}%</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-ink-muted">Status:</span>
                                                <span className="text-ink-body capitalize">{strategyData.status.replace('_', ' ')}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Strategy Creation Details */}
                                <div className="border-t border-line-soft pt-4">
                                    <h4 className="text-sm font-medium text-ink flex items-center gap-2 mb-4">
                                        <span className="w-2 h-2 bg-accent rounded-full"></span>
                                        Creation Details
                                    </h4>
                                    <div className="grid gap-3 md:grid-cols-2 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-ink-muted">Created:</span>
                                            <span className="text-ink-body">{formatOrderDate(firstOrder.createdAt)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-ink-muted">Owner:</span>
                                            <span className="font-mono text-ink-body">{truncateAddress(firstOrder.owner)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-ink-muted">Trading Pair:</span>
                                            <span className="text-ink-body">{firstOrder.inputTokenMeta.symbol} → {firstOrder.outputTokenMeta.symbol}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-ink-muted">Recipient:</span>
                                            <span className="font-mono text-ink-body">{truncateAddress(firstOrder.recipient)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-center text-xs text-ink-muted italic">
                                    Expand individual orders above for detailed technical parameters and transaction information
                                </div>
                            </div>
                        ) : (
                            // Single Order Details View (unchanged for single orders)
                            <div className="grid gap-6 md:grid-cols-2">
                                {/* Technical Parameters */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-medium text-ink flex items-center gap-2">
                                        <span className="w-2 h-2 bg-accent rounded-full"></span>
                                        Technical Parameters
                                    </h4>
                                    <div className="space-y-3 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-ink-muted">Order UUID:</span>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-ink-body">{firstOrder.uuid}</span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onCopyToClipboard(firstOrder.uuid, firstOrder.uuid);
                                                    }}
                                                    className="p-1 rounded hover:bg-surface-hover text-ink-muted hover:text-ink-body transition-colors cursor-pointer"
                                                >
                                                    {copiedId === firstOrder.uuid ? (
                                                        <Check className="h-3 w-3 text-success" />
                                                    ) : (
                                                        <Copy className="h-3 w-3" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-ink-muted">Input Token:</span>
                                            <span className="font-mono text-ink-body">{firstOrder.inputToken}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-ink-muted">Output Token:</span>
                                            <span className="font-mono text-ink-body">{firstOrder.outputToken}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-ink-muted">Amount (micro units):</span>
                                            <span className="font-mono text-ink-body">{firstOrder.amountIn}</span>
                                        </div>
                                        {firstOrder.metadata?.quote && (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-ink-muted">Quote Input:</span>
                                                    <span className="font-mono text-ink-body">
                                                        {formatTokenAmount(firstOrder.metadata.quote.amountIn, firstOrder.inputTokenMeta.decimals!)} {firstOrder.inputTokenMeta.symbol}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-ink-muted">Quote Output:</span>
                                                    <span className="font-mono text-ink-body">
                                                        {formatTokenAmount(firstOrder.metadata.quote.amountOut, firstOrder.outputTokenMeta.decimals!)} {firstOrder.outputTokenMeta.symbol}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-ink-muted">Quote Slippage:</span>
                                                    <span className="font-mono text-ink-body">{(firstOrder.metadata.quote.slippage * 100).toFixed(1)}%</span>
                                                </div>
                                            </>
                                        )}
                                        <div className="flex justify-between">
                                            <span className="text-ink-muted">Recipient:</span>
                                            <span className="font-mono text-ink-body">{truncateAddress(firstOrder.recipient)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-ink-muted">Owner:</span>
                                            <span className="font-mono text-ink-body">{truncateAddress(firstOrder.owner)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Condition Details */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-medium text-ink flex items-center gap-2">
                                        <span className="w-2 h-2 bg-warning rounded-full"></span>
                                        Condition Details
                                    </h4>
                                    <div className="space-y-3 text-xs">
                                        {firstOrder.conditionToken &&
                                            !(firstOrder.conditionToken === '*' && firstOrder.targetPrice === '0' && firstOrder.direction === 'gt') ? (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-ink-muted">Condition Token:</span>
                                                    <span className="font-mono text-ink-body">{firstOrder.conditionToken}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-ink-muted">Target Price:</span>
                                                    <span className="font-mono text-ink-body">{firstOrder.targetPrice}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-ink-muted">Direction:</span>
                                                    <span className="text-ink-body capitalize">{firstOrder.direction}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-ink-muted">Base Asset:</span>
                                                    <span className="font-mono text-ink-body">{firstOrder.baseAsset || 'USD'}</span>
                                                </div>
                                                {firstOrder.creationPrice && (
                                                    <div className="flex justify-between">
                                                        <span className="text-ink-muted">Creation Price:</span>
                                                        <span className="font-mono text-ink-body">{firstOrder.creationPrice}</span>
                                                    </div>
                                                )}
                                                {currentPrices.get(firstOrder.conditionToken) && (
                                                    <div className="flex justify-between">
                                                        <span className="text-ink-muted">Current Price:</span>
                                                        <span className="font-mono text-ink-body">{currentPrices.get(firstOrder.conditionToken)?.toFixed(6)}</span>
                                                    </div>
                                                )}
                                                <div className="mt-3 p-2 rounded-lg bg-accent/[0.08] border border-accent/[0.15]">
                                                    <div className="text-accent-text text-xs font-medium mb-1">
                                                        Execution Trigger
                                                    </div>
                                                    <div className="text-ink-body text-xs">
                                                        Order executes when {firstOrder.conditionTokenMeta?.symbol || firstOrder.conditionToken} price {firstOrder.direction === 'gt' ? 'reaches or exceeds' : 'drops to or below'} {firstOrder.targetPrice} {firstOrder.baseAsset || 'USD'}
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="p-2 rounded-lg bg-warning/[0.08] border border-warning/[0.15]">
                                                <div className="text-warning text-xs font-medium mb-1">
                                                    {firstOrder.conditionToken === '*' && !isSingleOrder && type === 'dca' ?
                                                        'Time-triggered Execution' :
                                                        firstOrder.conditionToken === '*' ? 'Immediate Execution' : 'Execute on Command'
                                                    }
                                                </div>
                                                <div className="text-ink-body text-xs">
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
                                    <div className="pt-4 border-t border-line-soft">
                                        <h4 className="text-sm font-medium text-ink flex items-center gap-2 mb-4">
                                            <span className="w-2 h-2 bg-success rounded-full"></span>
                                            Timeline
                                        </h4>
                                        <div className="space-y-3 text-xs">
                                            {getOrderTimestamps(firstOrder).map((timestamp, idx) => (
                                                <div key={idx} className={`flex justify-between ${timestamp.isMain ? 'text-ink font-medium' : 'text-ink-body'}`}>
                                                    <span className="text-ink-muted">{timestamp.label}:</span>
                                                    <span className="text-ink-body">{timestamp.time}</span>
                                                </div>
                                            ))}
                                            {firstOrder.txid && (
                                                <div className="flex justify-between items-center pt-2 border-t border-line-soft">
                                                    <span className="text-ink-muted">Transaction:</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-ink-body">{truncateAddress(firstOrder.txid)}</span>
                                                        <a
                                                            href={`https://explorer.hiro.so/txid/${firstOrder.txid}?chain=mainnet`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="p-1 rounded hover:bg-surface-hover text-ink-muted hover:text-ink-body transition-colors cursor-pointer"
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
                                        <div className="pt-4 border-t border-line-soft">
                                            <h4 className="text-sm font-medium text-ink flex items-center gap-2 mb-4">
                                                <span className="w-2 h-2 bg-accent rounded-full"></span>
                                                Execution Window
                                            </h4>
                                            <div className="space-y-3 text-xs">
                                                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                                    <span className="text-ink-muted">Valid From:</span>
                                                    <span className="text-ink-body truncate text-xs max-w-full">{firstOrder.validFrom ? formatOrderDate(firstOrder.validFrom) : 'Immediate'}</span>
                                                </div>
                                                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                                    <span className="text-ink-muted">Valid To:</span>
                                                    <span className="text-ink-body truncate text-xs max-w-full">{firstOrder.validTo ? formatOrderDate(firstOrder.validTo) : 'No expiry'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Click hint */}
                        <div className="text-center">
                            <span className="text-xs text-ink-muted">Click to collapse details</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
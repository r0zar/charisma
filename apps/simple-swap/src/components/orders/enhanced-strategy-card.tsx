"use client";

import React, { useState } from 'react';
import { StrategyDisplayData } from '@/lib/orders/strategy-formatter';
import { formatOrderCondition } from '@/lib/orders/condition-formatter';
import { StrategyProgressBar, ConditionStatusIndicator, PriceProgressBar } from './order-progress-indicators';
import { PremiumStatusBadge } from './orders-panel';
import TokenLogo from '../TokenLogo';
import { Button } from '../ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { Copy, Check, Zap, Trash2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { truncateAddress } from '@/lib/address-utils';

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
    formatRelativeTime: (dateString: string) => string;
    formatExecWindow: (order: any) => string;
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
    formatTokenAmount,
    formatRelativeTime,
    formatExecWindow
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
            onClick={() => onToggleRowExpansion(isSingleOrder ? firstOrder.uuid : id)}
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
                        <div className="text-sm font-medium text-white/90" title={new Date(firstOrder.createdAt).toLocaleString()}>
                            {formatRelativeTime(firstOrder.createdAt)}
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
                            <div className="text-xs text-white/60">
                                {description}
                            </div>
                        )}
                        {(firstOrder.validFrom || firstOrder.validTo) && (
                            <div className="text-xs text-white/40 mt-1">
                                {formatExecWindow(firstOrder)}
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
                            status={isSingleOrder ? firstOrder.status : (status === 'completed' ? 'confirmed' : status === 'active' ? 'open' : 'cancelled')} 
                            txid={firstOrder.txid} 
                            failureReason={firstOrder.failureReason} 
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

                {/* Condition Display and Action Buttons */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                    {/* Left: Condition Display */}
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
                        ) : (
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-lg">
                                    {firstOrder.conditionToken === '*' ? '⚡' : '👤'}
                                </span>
                                <div>
                                    <div className="text-white/90 font-medium">
                                        {firstOrder.conditionToken === '*' ? 
                                            'Execute immediately' : 
                                            'Manual execution required'
                                        }
                                    </div>
                                    <div className="text-xs text-white/60">
                                        {firstOrder.conditionToken === '*' ? 
                                            'This order will be executed automatically right away' : 
                                            'This order must be manually executed via the interface or API'
                                        }
                                    </div>
                                </div>
                            </div>
                        )}
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
                                onToggleExpansion(id);
                            }}
                            className="flex items-center gap-2 text-xs text-white/60 hover:text-white/90 transition-colors cursor-pointer"
                        >
                            {isExpanded ? (
                                <>
                                    <ChevronUp className="h-4 w-4" />
                                    Hide details
                                </>
                            ) : (
                                <>
                                    <ChevronDown className="h-4 w-4" />
                                    Show {orders.length} orders
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* Expanded Strategy Details */}
                {!isSingleOrder && isExpanded && (
                    <div className="pt-4 border-t border-white/[0.08] space-y-3">
                        {orders.map((order, index) => (
                            <div key={order.uuid} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-white/60 font-mono">#{index + 1}</span>
                                    <div>
                                        <div className="text-xs text-white/80 font-mono">
                                            {formatTokenAmount(order.amountIn, order.inputTokenMeta.decimals!)} {order.inputTokenMeta.symbol}
                                        </div>
                                        <div className="text-xs text-white/40">
                                            {order.uuid.substring(0, 8)}
                                        </div>
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
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Detailed Technical View - Expanded on click */}
                {isDetailExpanded && (
                    <div className="pt-6 border-t border-white/[0.08] space-y-6">
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
                                        </>
                                    ) : (
                                        <div className="text-white/60 italic">
                                            {firstOrder.conditionToken === '*' ? 
                                                'Immediate execution (wildcard) - will execute automatically' : 
                                                'No conditions - requires manual execution via interface or API'
                                            }
                                        </div>
                                    )}
                                </div>

                                {/* Execution Window */}
                                <div className="pt-4 border-t border-white/[0.05]">
                                    <h4 className="text-sm font-medium text-white/90 flex items-center gap-2 mb-4">
                                        <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
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
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Created:</span>
                                            <span className="text-white/80">{new Date(firstOrder.createdAt).toLocaleString()}</span>
                                        </div>
                                        {firstOrder.txid && (
                                            <div className="flex justify-between items-center">
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
                            </div>

                            {/* Strategy Details (for multi-order strategies) */}
                            {!isSingleOrder && (
                                <div className="space-y-4">
                                    <h4 className="text-sm font-medium text-white/90 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                                        Strategy Details
                                    </h4>
                                    <div className="space-y-3 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Strategy ID:</span>
                                            <span className="font-mono text-white/80">{strategyData.id}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Type:</span>
                                            <span className="text-white/80 capitalize">{strategyData.type}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Total Orders:</span>
                                            <span className="text-white/80">{strategyData.totalOrders}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Completed:</span>
                                            <span className="text-white/80">{strategyData.completedOrders}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/60">Progress:</span>
                                            <span className="text-white/80">{Math.round(strategyData.progressPercent)}%</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Click hint */}
                        <div className="text-center">
                            <span className="text-xs text-white/40">Click to collapse details</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
"use client";

import React from 'react';
import { DCAStrategyCardProps } from '../base/shared-types';
import { BaseStrategyCard } from '../base/BaseStrategyCard';
import { getStrategyStatusTime, getStrategyConditionIcon, getBadgeStatus } from '../utils/shared-utilities';
import { PremiumStatusBadge } from '../../orders-panel';
import { StrategyProgressBar } from '../../order-progress-indicators';
import { formatExecWindowHuman, getOrderTimestamps } from '@/lib/date-utils';
import { truncateAddress } from '@/lib/address-utils';
import TokenLogo from '../../../TokenLogo';
import { ChevronDown, ChevronUp, ExternalLink, Copy, Check, Zap, Trash2 } from 'lucide-react';

/**
 * Component for displaying DCA (Dollar Cost Averaging) strategies
 */
export const DCAStrategyCard: React.FC<DCAStrategyCardProps> = (props) => {
    const {
        strategyData,
        isRecentlyUpdated,
        expandedStrategies,
        expandedRow,
        onToggleExpansion,
        onToggleRowExpansion,
        formatTokenAmount,
        onCopyToClipboard,
        onExecuteNow,
        onCancelOrder,
        copiedId
    } = props;

    const { id, description, orders, totalValue } = strategyData;
    const firstOrder = orders[0];
    const isExpanded = expandedStrategies.has(id);
    
    const statusTime = getStrategyStatusTime(strategyData);
    const conditionIcon = getStrategyConditionIcon(strategyData);
    
    const handleCardClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggleExpansion(id);
    };

    return (
        <BaseStrategyCard
            {...props}
            onClick={handleCardClick}
        >
            {/* Header Row */}
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <div className="text-sm font-medium text-white/90" title={statusTime.tooltip}>
                        {statusTime.text}
                    </div>
                    <div className="text-xs text-white/60">
                        {description}
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <span className="text-xs text-white/60 px-2 py-1 rounded-lg bg-white/[0.05]">
                        {orders.length} orders
                    </span>
                    <PremiumStatusBadge 
                        status={getBadgeStatus(strategyData)} 
                        conditionIcon={conditionIcon}
                    />
                </div>
            </div>

            {/* Strategy Progress Bar */}
            <StrategyProgressBar strategyData={strategyData} />

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
                        {totalValue}
                    </div>
                    <div className="text-xs text-white/40">{firstOrder.inputTokenMeta.symbol}</div>
                </div>
            </div>

            {/* Expansion Toggle */}
            <div className="flex items-center justify-center pt-2">
                <button
                    onClick={handleCardClick}
                    className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-white/60 hover:text-white/80 transition-all duration-200 text-xs"
                >
                    <span>{isExpanded ? 'Hide Details' : 'Show Details'}</span>
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
            </div>

            {/* Expanded Individual Orders (when expanded) */}
            {isExpanded && (
                <div className="mt-4 space-y-2 border-t border-white/[0.08] pt-4">
                    <div className="text-xs font-medium text-white/70 mb-3">Individual Orders ({orders.length})</div>
                    {orders.map((order, index) => {
                        const isOrderExpanded = expandedRow === order.uuid;
                        
                        return (
                            <div key={order.uuid} className="relative rounded-2xl border border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.02] transition-all duration-200">
                                {/* Order Header */}
                                <div 
                                    className="p-4 cursor-pointer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleRowExpansion(order.uuid);
                                    }}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="text-xs text-white/60">#{index + 1}</div>
                                            <div className="text-sm text-white/80">
                                                {formatTokenAmount(order.amountIn, order.inputTokenMeta.decimals!)} {order.inputTokenMeta.symbol}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <PremiumStatusBadge 
                                                status={order.status} 
                                                txid={order.txid} 
                                                failureReason={order.failureReason}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Order Details */}
                                {isOrderExpanded && (
                                    <div className="px-4 pb-4 space-y-4">
                                        <div className="grid gap-4 md:grid-cols-2">
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
                                                    <>
                                                        <div className="p-2 rounded-lg bg-amber-500/[0.08] border border-amber-500/[0.15]">
                                                            <div className="text-amber-400 text-xs font-medium mb-1">
                                                                Time-triggered Execution
                                                            </div>
                                                            <div className="text-white/70 text-xs">
                                                                {formatExecWindowHuman(order.validFrom, order.validTo, order.status)}
                                                            </div>
                                                        </div>
                                                        {(order.validFrom || order.validTo) && (
                                                            <div className="mt-3 space-y-2">
                                                                <div className="flex justify-between">
                                                                    <span className="text-white/60">Valid From:</span>
                                                                    <span className="text-white/80">{order.validFrom || 'Immediate'}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-white/60">Valid To:</span>
                                                                    <span className="text-white/80">{order.validTo || 'No expiry'}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
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


                                        {/* Action Buttons (for open orders) */}
                                        {order.status === 'open' && (
                                            <div className="border-t border-white/[0.05] pt-3">
                                                <div className="flex gap-2 justify-end">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onExecuteNow(order.uuid);
                                                        }}
                                                        className="p-2 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/[0.15] text-emerald-400 hover:bg-emerald-500/[0.15] hover:border-emerald-400/[0.3] transition-all duration-200 backdrop-blur-sm cursor-pointer flex items-center gap-2"
                                                    >
                                                        <Zap className="h-3 w-3" />
                                                        <span className="text-xs">Execute Now</span>
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onCancelOrder(order.uuid);
                                                        }}
                                                        className="p-2 rounded-xl bg-red-500/[0.08] border border-red-500/[0.15] text-red-400 hover:bg-red-500/[0.15] hover:border-red-400/[0.3] transition-all duration-200 backdrop-blur-sm cursor-pointer flex items-center gap-2"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                        <span className="text-xs">Cancel</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </BaseStrategyCard>
    );
};
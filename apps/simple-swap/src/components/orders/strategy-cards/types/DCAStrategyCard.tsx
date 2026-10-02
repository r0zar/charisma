"use client";

import React from 'react';
import { DCAStrategyCardProps } from '../base/shared-types';
import { BaseStrategyCard } from '../base/BaseStrategyCard';
import { OrderDetails } from '../base/OrderDetails';
import { getStrategyStatusTime, getStrategyConditionIcon, getBadgeStatus } from '../utils/shared-utilities';
import { PremiumStatusBadge } from '../../orders-panel';
import { StrategyProgressBar } from '../../order-progress-indicators';
import { formatExecWindowHuman, getOrderTimestamps, formatOrderDate } from '@/lib/date-utils';
import { truncateAddress, truncateSmartContract, truncateUuid } from '@/lib/address-utils';
import TokenLogo from '../../../TokenLogo';
import { ChevronDown, ExternalLink, Copy, Check, Zap, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
                    <div className="text-sm font-medium text-ink" title={statusTime.tooltip}>
                        {statusTime.text}
                    </div>
                    <div className="text-xs text-ink-muted">
                        {description}
                    </div>
                    <div className="text-xs text-ink-muted font-mono">
                        {id}
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <span className="text-xs text-ink-muted px-2 py-1 rounded-lg bg-surface">
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
                        {totalValue}
                    </div>
                    <div className="text-xs text-ink-muted">{firstOrder.inputTokenMeta.symbol}</div>
                </div>
            </div>

            {/* Expansion Toggle */}
            <div className="flex items-center justify-center pt-2">
                <button
                    onClick={handleCardClick}
                    className="flex items-center gap-2 px-3 py-1 rounded-lg bg-surface hover:bg-surface-hover text-ink-muted hover:text-ink-body transition-all duration-200 text-xs hover:transform hover:scale-105"
                >
                    <span>{isExpanded ? 'Hide Details' : 'Show Details'}</span>
                    <div className={cn(
 "transition-transform duration-300 ease-in-out",
                        isExpanded ? "rotate-180" : "rotate-0"
                    )}>
                        <ChevronDown className="h-3 w-3" />
                    </div>
                </button>
            </div>

            {/* Expanded Individual Orders (when expanded) */}
            <div className={cn(
 "overflow-hidden transition-all duration-500 ease-in-out border-t border-line",
                isExpanded 
                    ? "max-h-[2000px] opacity-100 mt-4 pt-4" 
                    : "max-h-0 opacity-0 mt-0 pt-0"
            )}>
                <div className={cn(
 "space-y-2 transition-all duration-300 ease-in-out",
                    isExpanded ? "transform translate-y-0" : "transform -translate-y-4"
                )}>
                    <div className="text-xs font-medium text-ink-body mb-3">Individual Orders ({orders.length})</div>
                    {orders.map((order, index) => {
                        const isOrderExpanded = expandedRow === order.uuid;
                        
                        return (
                            <div key={order.uuid} className="relative rounded-2xl border border-line-soft bg-surface-sunken hover:bg-surface transition-all duration-200 hover:shadow-lg hover:shadow-white/[0.02]">
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
                                            <div className="text-xs text-ink-muted">#{index + 1}</div>
                                            <div className="text-sm text-ink-body">
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
                                <div className={cn(
 "overflow-hidden transition-all duration-400 ease-in-out",
                                    isOrderExpanded 
                                        ? "max-h-[1500px] opacity-100" 
                                        : "max-h-0 opacity-0"
                                )}>
                                    <div className={cn(
 "px-4 pb-4 space-y-4 transition-all duration-300 ease-in-out",
                                        isOrderExpanded ? "transform translate-y-0 pt-0" : "transform -translate-y-4 pt-0"
                                    )}>
                                        <OrderDetails order={order} copiedId={copiedId} onCopyToClipboard={onCopyToClipboard} />


                                        {/* Action Buttons (for open orders) */}
                                        {order.status === 'open' && (
                                            <div className="border-t border-line-soft pt-3">
                                                <div className="flex gap-2 justify-end">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onExecuteNow(order.uuid);
                                                        }}
                                                        className="p-2 rounded-xl bg-success/[0.08] border border-success/[0.15] text-success hover:bg-success/[0.15] hover:border-success/[0.3] transition-all duration-200 backdrop-blur-sm cursor-pointer flex items-center gap-2"
                                                    >
                                                        <Zap className="h-3 w-3" />
                                                        <span className="text-xs">Execute Now</span>
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onCancelOrder(order.uuid);
                                                        }}
                                                        className="p-2 rounded-xl bg-danger/[0.08] border border-danger/[0.15] text-danger hover:bg-danger/[0.15] hover:border-danger/[0.3] transition-all duration-200 backdrop-blur-sm cursor-pointer flex items-center gap-2"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                        <span className="text-xs">Cancel</span>
                                                    </button>
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
        </BaseStrategyCard>
    );
};
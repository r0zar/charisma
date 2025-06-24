"use client";

import React from 'react';
import { SingleOrderCardProps } from '../base/shared-types';
import { BaseStrategyCard } from '../base/BaseStrategyCard';
import { getStrategyStatusTime, getStrategyConditionIcon, shouldShowActionButtons, getBadgeStatus, getTxId, getFailureReason } from '../utils/shared-utilities';
import { PremiumStatusBadge } from '../../orders-panel';
import { StrategyProgressBar, ConditionStatusIndicator, PriceProgressBar } from '../../order-progress-indicators';
import { formatOrderCondition } from '@/lib/orders/condition-formatter';
import TokenLogo from '../../../TokenLogo';
import { Button } from '../../../ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '../../../ui/tooltip';
import { Copy, Check, Zap, Trash2, ExternalLink } from 'lucide-react';
import { truncateAddress } from '@/lib/address-utils';

/**
 * Component for displaying individual orders (non-strategy orders)
 */
export const SingleOrderCard: React.FC<SingleOrderCardProps> = (props) => {
    const {
        strategyData,
        currentPrices,
        isRecentlyUpdated,
        expandedRow,
        onToggleRowExpansion,
        onCopyToClipboard,
        onExecuteNow,
        onCancelOrder,
        copiedId,
        formatTokenAmount
    } = props;

    const { id, orders } = strategyData;
    const firstOrder = orders[0];
    const isDetailExpanded = expandedRow === firstOrder.uuid;
    
    const statusTime = getStrategyStatusTime(strategyData);
    const conditionIcon = getStrategyConditionIcon(strategyData);
    const showActionButtons = shouldShowActionButtons(strategyData);
    
    const handleCardClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggleRowExpansion(firstOrder.uuid);
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
                </div>
                
                <div className="flex items-center gap-2">
                    <PremiumStatusBadge 
                        status={getBadgeStatus(strategyData)} 
                        txid={getTxId(strategyData)} 
                        failureReason={getFailureReason(strategyData)}
                        conditionIcon={conditionIcon}
                    />
                </div>
            </div>

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
                        {formatTokenAmount(firstOrder.amountIn, firstOrder.inputTokenMeta.decimals!)}
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
                {showActionButtons && (
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
        </BaseStrategyCard>
    );
};
"use client";

import React from 'react';
import { ConditionDisplayData } from '@/lib/orders/condition-formatter';
import { StrategyDisplayData } from '@/lib/orders/strategy-formatter';
import { cn } from '@/lib/utils';
import { formatShortDate } from '@/lib/date-utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';

interface PriceProgressBarProps {
    progressData: ConditionDisplayData['progressData'];
    className?: string;
}

/**
 * Visual progress bar showing movement from creation price to target price
 */
export const PriceProgressBar: React.FC<PriceProgressBarProps> = ({ progressData, className }) => {
    if (!progressData) return null;

    const { creationPrice, currentPrice, targetPrice, progressPercent, direction } = progressData;
    
    // Determine colors based on direction and progress
    const isGoingUp = direction === 'up';
    const isNearTarget = progressPercent > 80;
    const progressColor = isNearTarget ? 'bg-success' : isGoingUp ? 'bg-accent' : 'bg-warning';
    const trackColor = 'bg-surface-hover';

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className={cn("w-full", className)}>
                    <div className="flex items-center justify-between text-xs text-ink-muted mb-1">
                        <span>{isGoingUp ? '↗️' : '↘️'}</span>
                        <span>{Math.round(progressPercent)}% to target</span>
                    </div>
                    <div className={`w-full h-2 rounded-full ${trackColor} overflow-hidden`}>
                        <div 
                            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                        />
                    </div>
                    <div className="flex items-center justify-between text-xs text-ink-muted mt-1">
                        <span>${creationPrice.toFixed(2)}</span>
                        <span className="font-medium text-ink-body">${currentPrice.toFixed(2)}</span>
                        <span>${targetPrice.toFixed(2)}</span>
                    </div>
                </div>
            </TooltipTrigger>
            <TooltipContent>
                <div className="text-xs">
                    <div className="font-medium mb-1">Price Progress</div>
                    <div>Started at: ${creationPrice.toFixed(4)}</div>
                    <div>Currently: ${currentPrice.toFixed(4)}</div>
                    <div>Target: ${targetPrice.toFixed(4)}</div>
                    <div className="mt-1 text-ink-muted">
                        {progressPercent >= 100 ? 'Target reached!' : `${Math.round(progressPercent)}% of the way to target`}
                    </div>
                </div>
            </TooltipContent>
        </Tooltip>
    );
};

interface StrategyProgressBarProps {
    strategyData: StrategyDisplayData;
    className?: string;
}

/**
 * Progress bar for order strategies (split swaps, DCA, etc.)
 */
export const StrategyProgressBar: React.FC<StrategyProgressBarProps> = ({ strategyData, className }) => {
    const { completedOrders, totalOrders, progressPercent, status, type } = strategyData;
    
    // Determine colors based on strategy status
    const getProgressColor = () => {
        switch (status) {
            case 'completed': return 'bg-success';
            case 'partially_filled': return 'bg-warning';
            case 'cancelled': return 'bg-danger';
            default: return 'bg-accent';
        }
    };

    const getStatusIcon = () => {
        switch (type) {
            case 'split': return '🔀';
            case 'dca': return '📈';
            case 'batch': return '📦';
            case 'twitter': return '🐦';
            default: return '⚡';
        }
    };

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className={cn("w-full", className)}>
                    <div className="flex items-center justify-between text-xs text-ink-muted mb-1">
                        <span className="flex items-center gap-1">
                            <span>{getStatusIcon()}</span>
                            <span className="capitalize">{type} Strategy</span>
                        </span>
                        <span>{completedOrders}/{totalOrders} completed</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-surface-hover overflow-hidden">
                        <div 
                            className={`h-full rounded-full transition-all duration-500 ${getProgressColor()}`}
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    <div className="flex items-center justify-between text-xs text-ink-muted mt-1">
                        <span>{status.replace('_', ' ')}</span>
                        {strategyData.estimatedCompletion && (
                            <span>Est. {strategyData.estimatedCompletion}</span>
                        )}
                    </div>
                </div>
            </TooltipTrigger>
            <TooltipContent>
                <div className="text-xs">
                    <div className="font-medium mb-1">{strategyData.description}</div>
                    <div>Progress: {completedOrders} of {totalOrders} orders completed</div>
                    <div>Total Value: {strategyData.totalValue}</div>
                    <div className="mt-1 text-ink-muted">
                        Status: {status.replace('_', ' ')}
                    </div>
                    {strategyData.estimatedCompletion && (
                        <div className="text-ink-muted">
                            Estimated completion: {strategyData.estimatedCompletion}
                        </div>
                    )}
                </div>
            </TooltipContent>
        </Tooltip>
    );
};

interface ConditionStatusIndicatorProps {
    conditionData: ConditionDisplayData;
    className?: string;
}

/**
 * Visual indicator for condition status with human-readable text
 */
export const ConditionStatusIndicator: React.FC<ConditionStatusIndicatorProps> = ({ 
    conditionData, 
    className 
}) => {
    const { humanReadableText, shortText, directionIcon, contextualInfo, isManualOrder } = conditionData;

    if (isManualOrder) {
        return (
            <div className={cn("flex items-center gap-2 text-sm", className)}>
                <span className="text-lg">{directionIcon}</span>
                <div>
                    <div className="text-ink font-medium">{humanReadableText}</div>
                    <div className="text-xs text-ink-muted">{contextualInfo}</div>
                </div>
            </div>
        );
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className={cn("flex items-center gap-2 text-sm cursor-default", className)}>
                    <span className="text-lg">{directionIcon}</span>
                    <div className="flex-1">
                        <div className="text-ink font-medium">{shortText}</div>
                        <div className="text-xs text-ink-muted">{contextualInfo}</div>
                    </div>
                </div>
            </TooltipTrigger>
            <TooltipContent>
                <div className="text-xs">
                    <div className="font-medium mb-1">Trigger Condition</div>
                    <div>{humanReadableText}</div>
                    <div className="mt-1 text-ink-muted">{contextualInfo}</div>
                </div>
            </TooltipContent>
        </Tooltip>
    );
};

interface CompactOrderCardProps {
    strategyData: StrategyDisplayData;
    isExpanded: boolean;
    onToggle: () => void;
    className?: string;
}

/**
 * Compact card that represents either a single order or a strategy group
 */
export const CompactOrderCard: React.FC<CompactOrderCardProps> = ({ 
    strategyData, 
    isExpanded, 
    onToggle, 
    className 
}) => {
    const { type, description, orders, status, progressPercent } = strategyData;
    const firstOrder = orders[0];
    
    const getStatusColor = () => {
        switch (status) {
            case 'completed': return 'text-success bg-success/10 border-success/20';
            case 'partially_filled': return 'text-warning bg-warning/10 border-warning/20';
            case 'cancelled': return 'text-danger bg-danger/10 border-danger/20';
            default: return 'text-accent-text bg-accent/10 border-accent/20';
        }
    };

    return (
        <div 
            className={cn(
 "border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:border-line-strong",
                "bg-surface border-line",
                getStatusColor(),
                className
            )}
            onClick={onToggle}
        >
            <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-sm font-medium text-ink">{description}</div>
                        <div className="text-xs text-ink-muted">
                            {formatShortDate(firstOrder.createdAt)}
                            {type !== 'single' && ` • ${orders.length} orders`}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {type !== 'single' && (
                            <div className="text-xs text-ink-muted">
                                {Math.round(progressPercent)}%
                            </div>
                        )}
                        <div className={`px-2 py-1 rounded text-xs ${getStatusColor()}`}>
                            {status.replace('_', ' ')}
                        </div>
                    </div>
                </div>

                {/* Progress bar for strategies */}
                {type !== 'single' && (
                    <StrategyProgressBar strategyData={strategyData} />
                )}

                {/* Expanded details */}
                {isExpanded && (
                    <div className="pt-2 border-t border-line space-y-2">
                        {orders.map((order, index) => (
                            <div key={order.uuid} className="text-xs text-ink-body">
                                #{index + 1}: {order.status} • {order.uuid.substring(0, 8)}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
"use client";

import React from 'react';
import { TwitterStrategyCardProps } from '../base/shared-types';
import { BaseStrategyCard } from '../base/BaseStrategyCard';
import { getStrategyStatusTime, getStrategyConditionIcon, getBadgeStatus } from '../utils/shared-utilities';
import { PremiumStatusBadge } from '../../orders-panel';
import { StrategyProgressBar } from '../../order-progress-indicators';
import { getOrderTimestamps } from '@/lib/date-utils';
import { truncateAddress, truncateSmartContract } from '@/lib/address-utils';
import TokenLogo from '../../../TokenLogo';
import { ChevronDown, ExternalLink, Copy, Check, Zap, Trash2, MessageCircle, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Component for displaying Twitter-triggered strategies
 */
export const TwitterStrategyCard: React.FC<TwitterStrategyCardProps> = (props) => {
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

    const { id, description, orders, totalValue, twitterMetadata } = strategyData;
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

            {/* Twitter Strategy Information */}
            {twitterMetadata && (
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                        <h4 className="text-xs font-medium text-ink flex items-center gap-2">
                            <MessageCircle className="h-3 w-3 text-accent-text" />
                            Tweet Trigger
                        </h4>
                        <div className="space-y-2 text-xs">
                            {twitterMetadata.tweetUrl && (
                                <div className="p-3 rounded-lg bg-accent/[0.08] border border-accent/[0.15]">
                                    <div className="text-accent-text text-xs font-medium mb-1">
                                        Source Tweet
                                    </div>
                                    <a 
                                        href={twitterMetadata.tweetUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-ink-body text-xs hover:text-ink transition-colors flex items-center gap-1"
                                    >
                                        <span className="truncate">{twitterMetadata.tweetUrl.replace('https://twitter.com/', '').replace('https://x.com/', '')}</span>
                                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-xs font-medium text-ink flex items-center gap-2">
                            <Users className="h-3 w-3 text-success" />
                            Trigger Stats
                        </h4>
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-ink-muted">Executed:</span>
                                <span className="text-ink-body">{strategyData.completedOrders}/{strategyData.totalOrders} orders</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-ink-muted">Progress:</span>
                                <span className="text-ink-body">{Math.round(strategyData.progressPercent)}% complete</span>
                            </div>
                            {twitterMetadata.maxTriggers && (
                                <div className="flex justify-between">
                                    <span className="text-ink-muted">Max Triggers:</span>
                                    <span className="text-ink-body">{twitterMetadata.maxTriggers}</span>
                                </div>
                            )}
                            {twitterMetadata.recentReplies && twitterMetadata.recentReplies.length > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-ink-muted">Recent Replies:</span>
                                    <span className="text-ink-body">{twitterMetadata.recentReplies.length}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

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
                                        <div className="space-y-4 lg:grid lg:gap-4 lg:grid-cols-2 lg:space-y-0">
                                            {/* Technical Parameters */}
                                            <div className="space-y-3">
                                                <h4 className="text-xs font-medium text-ink flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 bg-accent rounded-full"></span>
                                                    Technical Parameters
                                                </h4>
                                                <div className="space-y-2 text-xs">
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-ink-muted flex-shrink-0">Order UUID:</span>
                                                        <div className="flex items-center gap-1 min-w-0 ml-2">
                                                            <span className="font-mono text-ink-body text-xs truncate">{order.uuid}</span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onCopyToClipboard(order.uuid, order.uuid);
                                                                }}
                                                                className="p-0.5 rounded hover:bg-surface-hover text-ink-muted hover:text-ink-body transition-colors cursor-pointer flex-shrink-0"
                                                            >
                                                                {copiedId === order.uuid ? (
                                                                    <Check className="h-2.5 w-2.5 text-success" />
                                                                ) : (
                                                                    <Copy className="h-2.5 w-2.5" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-ink-muted flex-shrink-0">Input Token:</span>
                                                        <span className="font-mono text-ink-body text-xs ml-2 truncate">{truncateSmartContract(order.inputToken)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-ink-muted flex-shrink-0">Output Token:</span>
                                                        <span className="font-mono text-ink-body text-xs ml-2 truncate">{truncateSmartContract(order.outputToken)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-ink-muted flex-shrink-0">Amount (micro units):</span>
                                                        <span className="font-mono text-ink-body text-xs truncate ml-2">{order.amountIn}</span>
                                                    </div>
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-ink-muted flex-shrink-0">Recipient:</span>
                                                        <div className="ml-2 text-right">
                                                            <span className="font-mono text-ink-body text-xs block">{truncateAddress(order.recipient)}</span>
                                                            {order.metadata?.execution?.bnsName && (
                                                                <span className="text-accent-text text-xs">📛 {order.metadata.execution.bnsName}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-ink-muted flex-shrink-0">Owner:</span>
                                                        <span className="font-mono text-ink-body text-xs ml-2">{truncateAddress(order.owner)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Twitter Trigger Details */}
                                            <div className="space-y-3">
                                                <h4 className="text-xs font-medium text-ink flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 bg-accent rounded-full"></span>
                                                    Trigger Details
                                                </h4>
                                                <div className="space-y-2 text-xs">
                                                    <div className="p-2 rounded-lg bg-accent/[0.08] border border-accent/[0.15]">
                                                        <div className="text-accent-text text-xs font-medium mb-1">
                                                            Tweet-triggered Execution
                                                        </div>
                                                        <div className="text-ink-body text-xs">
                                                            Order executes when someone replies to the monitored tweet with a valid .btc BNS name
                                                        </div>
                                                    </div>
                                                    {twitterMetadata?.tweetUrl && (
                                                        <div className="flex justify-between items-start">
                                                            <span className="text-ink-muted flex-shrink-0">Tweet URL:</span>
                                                            <a 
                                                                href={twitterMetadata.tweetUrl} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="font-mono text-ink-body hover:text-ink transition-colors flex items-center gap-1 min-w-0 ml-2"
                                                            >
                                                                <span className="truncate text-xs">{twitterMetadata.tweetUrl}</span>
                                                                <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Twitter Execution Details (for executed orders) */}
                                        {order.metadata?.execution && (order.status === 'confirmed' || order.status === 'broadcasted') && (
                                            <div className="border-t border-line-soft pt-3">
                                                <h4 className="text-xs font-medium text-ink flex items-center gap-2 mb-3">
                                                    <MessageCircle className="h-3 w-3 text-accent-text" />
                                                    Twitter Execution Details
                                                </h4>
                                                <div className="space-y-3 text-xs">
                                                    {/* Replier Information */}
                                                    <div className="p-3 rounded-lg bg-accent/[0.08] border border-accent/[0.15]">
                                                        <div className="text-accent-text text-xs font-medium mb-2">
                                                            Reply Trigger
                                                        </div>
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-ink-muted">Twitter User:</span>
                                                                <div className="flex items-center gap-2">
                                                                    <a
                                                                        href={`https://twitter.com/${order.metadata.execution.replierHandle}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="text-ink-body hover:text-accent-text transition-colors hover:underline"
                                                                        title={`View @${order.metadata.execution.replierHandle}'s Twitter profile`}
                                                                    >
                                                                        @{order.metadata.execution.replierHandle}
                                                                    </a>
                                                                    {order.metadata.execution.replyTweetId && (
                                                                        <a
                                                                            href={`https://twitter.com/twitter/status/${order.metadata.execution.replyTweetId}`}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            className="text-ink-muted hover:text-ink-body transition-colors"
                                                                            title="View reply tweet"
                                                                        >
                                                                            <ExternalLink className="h-3 w-3" />
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {order.metadata.execution.replierDisplayName && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-ink-muted">Display Name:</span>
                                                                    <span className="text-ink-body">{order.metadata.execution.replierDisplayName}</span>
                                                                </div>
                                                            )}
                                                            {order.metadata.execution.bnsName && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-ink-muted">BNS Name:</span>
                                                                    <span className="text-accent-text">📛 {order.metadata.execution.bnsName}</span>
                                                                </div>
                                                            )}
                                                            {order.metadata.execution.executedAt && (
                                                                <div className="flex justify-between">
                                                                    <span className="text-ink-muted">Executed:</span>
                                                                    <span className="text-ink-body">{new Date(order.metadata.execution.executedAt).toLocaleString()}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Reply Content */}
                                                    {order.metadata.execution.replyText && (
                                                        <div className="p-3 rounded-lg bg-surface border border-line">
                                                            <div className="text-ink-body text-xs font-medium mb-2">
                                                                Reply Content
                                                            </div>
                                                            <div className="text-ink-body text-xs italic">
                                                                "{order.metadata.execution.replyText}"
                                                            </div>
                                                            {order.metadata.execution.replyCreatedAt && (
                                                                <div className="text-ink-muted text-xs mt-2">
                                                                    Posted: {new Date(order.metadata.execution.replyCreatedAt).toLocaleString()}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Execution Status */}
                                                    {order.metadata.execution.status && (
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-ink-muted">Execution Status:</span>
                                                            <span className={`text-xs px-2 py-1 rounded-lg ${
                                                                order.metadata.execution.status === 'order_confirmed' 
                                                                    ? 'bg-success/[0.15] text-success' 
                                                                    : order.metadata.execution.status === 'order_broadcasted'
                                                                    ? 'bg-accent/[0.15] text-accent-text'
                                                                    : order.metadata.execution.status === 'bns_resolved'
                                                                    ? 'bg-warning/[0.15] text-warning'
                                                                    : order.metadata.execution.status === 'failed'
                                                                    ? 'bg-danger/[0.15] text-danger'
                                                                    : 'bg-surface-hover text-ink-body'
                                                            }`}>
                                                                {order.metadata.execution.status.replace('_', ' ').toUpperCase()}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Error Message */}
                                                    {order.metadata.execution.error && (
                                                        <div className="p-2 rounded-lg bg-danger/[0.08] border border-danger/[0.15]">
                                                            <div className="text-danger text-xs font-medium mb-1">
                                                                Execution Error
                                                            </div>
                                                            <div className="text-ink-body text-xs">
                                                                {order.metadata.execution.error}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Timeline */}
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
                                                        <a
                                                            href={`https://explorer.hiro.so/txid/${order.txid}?chain=mainnet`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="flex items-center gap-1 text-ink-body hover:text-ink transition-colors cursor-pointer group"
                                                            title="View on explorer"
                                                        >
                                                            <span className="font-mono text-xs hidden sm:inline">{order.txid}</span>
                                                            <span className="font-mono text-xs sm:hidden">{truncateAddress(order.txid)}</span>
                                                            <ExternalLink className="h-2.5 w-2.5 text-ink-muted group-hover:text-ink-body transition-colors" />
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

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
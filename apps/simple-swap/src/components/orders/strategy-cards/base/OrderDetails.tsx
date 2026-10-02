"use client";

import React from 'react';
import { StrategyDisplayData } from '@/lib/orders/strategy-formatter';
import { formatExecWindowHuman, getOrderTimestamps, formatOrderDate } from '@/lib/date-utils';
import { truncateAddress, truncateSmartContract, truncateUuid } from '@/lib/address-utils';
import { ExternalLink, Copy, Check } from 'lucide-react';

interface OrderDetailsProps {
    order: StrategyDisplayData['orders'][number];
    copiedId: string | null;
    onCopyToClipboard: (text: string, id: string) => void;
}

/**
 * Expanded details for a single order: parameters, condition, timeline and transaction link
 */
export const OrderDetails: React.FC<OrderDetailsProps> = ({ order, copiedId, onCopyToClipboard }) => (
    <>
        <div className="grid gap-4 md:grid-cols-2">
            {/* Technical Parameters */}
            <div className="space-y-3">
                <h4 className="text-xs font-medium text-ink flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-accent rounded-full"></span>
                    Technical Parameters
                </h4>
                <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                        <span className="text-ink-muted">Order UUID:</span>
                        <div className="flex items-center gap-1">
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
                        <span className="font-mono text-ink-body text-xs">{order.amountIn}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-ink-muted">Recipient:</span>
                        <span className="font-mono text-ink-body text-xs">{truncateAddress(order.recipient)}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-ink-muted">Owner:</span>
                        <span className="font-mono text-ink-body text-xs">{truncateAddress(order.owner)}</span>
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
                            <span className="font-mono text-ink-body text-xs">{order.targetPrice}</span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                            <span className="text-ink-muted">Direction:</span>
                            <span className="text-ink-body capitalize text-xs">{order.direction}</span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                            <span className="text-ink-muted">Base Asset:</span>
                            <span className="font-mono text-ink-body text-xs" title={order.baseAsset || 'USD'}>{order.baseAsset ? truncateSmartContract(order.baseAsset) : 'USD'}</span>
                        </div>
                        {order.creationPrice && (
                            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                <span className="text-ink-muted">Creation Price:</span>
                                <span className="font-mono text-ink-body text-xs">{order.creationPrice}</span>
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
                    <>
                        <div className="p-2 rounded-lg bg-warning/[0.08] border border-warning/[0.15]">
                            <div className="text-warning text-xs font-medium mb-1">
                                Time-triggered Execution
                            </div>
                            <div className="text-ink-body text-xs">
                                {formatExecWindowHuman(order.validFrom, order.validTo, order.status)}
                            </div>
                        </div>
                        {(order.validFrom || order.validTo) && (
                            <div className="mt-3 space-y-2">
                                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                    <span className="text-ink-muted">Valid From:</span>
                                    <span className="text-ink-body truncate text-xs max-w-full">{order.validFrom ? formatOrderDate(order.validFrom) : 'Immediate'}</span>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                    <span className="text-ink-muted">Valid To:</span>
                                    <span className="text-ink-body truncate text-xs max-w-full">{order.validTo ? formatOrderDate(order.validTo) : 'No expiry'}</span>
                                </div>
                            </div>
                        )}
                    </>
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
    </>
);

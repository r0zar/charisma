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
                <h4 className="text-xs font-medium text-white/90 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                    Technical Parameters
                </h4>
                <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                        <span className="text-white/60">Order UUID:</span>
                        <div className="flex items-center gap-1">
                            <span className="font-mono text-white/80 text-xs" title={order.uuid}>{truncateUuid(order.uuid)}</span>
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
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-white/60">Input Token:</span>
                        <span className="font-mono text-white/80 text-xs" title={order.inputToken}>{truncateSmartContract(order.inputToken)}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-white/60">Output Token:</span>
                        <span className="font-mono text-white/80 text-xs" title={order.outputToken}>{truncateSmartContract(order.outputToken)}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-white/60">Amount (micro units):</span>
                        <span className="font-mono text-white/80 text-xs">{order.amountIn}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-white/60">Recipient:</span>
                        <span className="font-mono text-white/80 text-xs">{truncateAddress(order.recipient)}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-white/60">Owner:</span>
                        <span className="font-mono text-white/80 text-xs">{truncateAddress(order.owner)}</span>
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
                        <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                            <span className="text-white/60">Condition Token:</span>
                            <span className="font-mono text-white/80 text-xs" title={order.conditionToken}>{truncateSmartContract(order.conditionToken)}</span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                            <span className="text-white/60">Target Price:</span>
                            <span className="font-mono text-white/80 text-xs">{order.targetPrice}</span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                            <span className="text-white/60">Direction:</span>
                            <span className="text-white/80 capitalize text-xs">{order.direction}</span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                            <span className="text-white/60">Base Asset:</span>
                            <span className="font-mono text-white/80 text-xs" title={order.baseAsset || 'USD'}>{order.baseAsset ? truncateSmartContract(order.baseAsset) : 'USD'}</span>
                        </div>
                        {order.creationPrice && (
                            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                <span className="text-white/60">Creation Price:</span>
                                <span className="font-mono text-white/80 text-xs">{order.creationPrice}</span>
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
                                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                    <span className="text-white/60">Valid From:</span>
                                    <span className="text-white/80 truncate text-xs max-w-full">{order.validFrom ? formatOrderDate(order.validFrom) : 'Immediate'}</span>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                    <span className="text-white/60">Valid To:</span>
                                    <span className="text-white/80 truncate text-xs max-w-full">{order.validTo ? formatOrderDate(order.validTo) : 'No expiry'}</span>
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
    </>
);

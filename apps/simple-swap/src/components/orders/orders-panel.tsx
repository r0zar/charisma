"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useWallet } from "@/contexts/wallet-context";
import type { LimitOrder } from "@/lib/orders/types";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "../ui/dialog";
import TokenLogo from "../TokenLogo";
import { ClipboardList, Copy, Check, Zap, Trash2, Search, ExternalLink } from "lucide-react";
import { TokenCacheData } from "@/lib/contract-registry-adapter";
import { toast } from "sonner";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../ui/tooltip";
import { signedFetch } from "blaze-sdk";
import { useTransactionStatus } from "@/hooks/useTransactionStatus";
import PremiumPagination, { type PaginationInfo } from "./premium-pagination";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { groupOrdersByStrategy, StrategyDisplayData } from "@/lib/orders/strategy-formatter";
import { usePrices } from '@/contexts/token-price-context';
import { useTokenMetadata } from '@/contexts/token-metadata-context';
import { StrategyCardFactory } from "./strategy-cards";
import { truncateAddress } from "@/lib/address-utils";
import { formatExecWindow, formatOrderStatusTime, getOrderTimestamps, getConditionIcon } from '@/lib/date-utils';

interface BadgeProps {
    status: LimitOrder["status"];
    failureReason?: string;
}

// Enriched order type with token metadata
interface DisplayOrder extends LimitOrder {
    inputTokenMeta: TokenCacheData;
    outputTokenMeta: TokenCacheData;
    conditionTokenMeta?: TokenCacheData;
    baseAssetMeta?: TokenCacheData | null;
}


// Transaction Status Indicator for filled orders
const TransactionStatusIndicator: React.FC<{ txid: string | undefined }> = ({ txid }) => {
    const { status, isConfirmed, isFailed, isPending, isLoading } = useTransactionStatus(txid);

    if (!txid || status === 'unknown') return null;

    if (isLoading) {
        return (
            <Tooltip>
                <TooltipTrigger>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-white/40 rounded-full animate-pulse" />
                        <span className="text-xs text-white/40">Checking...</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Checking transaction status on blockchain...</p>
                </TooltipContent>
            </Tooltip>
        );
    }

    if (isConfirmed) {
        return (
            <Tooltip>
                <TooltipTrigger>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                        <span className="text-xs text-emerald-400">Confirmed</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Transaction confirmed on blockchain</p>
                </TooltipContent>
            </Tooltip>
        );
    }

    if (isFailed) {
        return (
            <Tooltip>
                <TooltipTrigger>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-red-400 rounded-full" />
                        <span className="text-xs text-red-400">Failed</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Transaction failed on blockchain - order reverted to open</p>
                </TooltipContent>
            </Tooltip>
        );
    }

    if (isPending) {
        return (
            <Tooltip>
                <TooltipTrigger>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                        <span className="text-xs text-amber-400">Broadcasting...</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Transaction broadcasted - waiting for blockchain confirmation</p>
                </TooltipContent>
            </Tooltip>
        );
    }

    return null;
};

// Premium Status Badge with Apple/Tesla design
export const PremiumStatusBadge: React.FC<BadgeProps & { txid?: string; conditionIcon?: string | null }> = ({ status, txid, failureReason, conditionIcon }) => {
    const statusConfig: Record<LimitOrder["status"], { color: string, bgColor: string, borderColor: string, label: string, indicatorColor: string }> = {
        open: {
            color: "text-blue-400",
            bgColor: "bg-blue-500/[0.08]",
            borderColor: "border-blue-500/[0.15]",
            label: "Open",
            indicatorColor: "bg-blue-400"
        },
        broadcasted: {
            color: "text-amber-400",
            bgColor: "bg-amber-500/[0.08]",
            borderColor: "border-amber-500/[0.15]",
            label: "Pending",
            indicatorColor: "bg-amber-400"
        },
        confirmed: {
            color: "text-emerald-400",
            bgColor: "bg-emerald-500/[0.08]",
            borderColor: "border-emerald-500/[0.15]",
            label: "Confirmed",
            indicatorColor: "bg-emerald-400"
        },
        failed: {
            color: "text-red-400",
            bgColor: "bg-red-500/[0.08]",
            borderColor: "border-red-500/[0.15]",
            label: "Failed",
            indicatorColor: "bg-red-400"
        },
        filled: {
            color: "text-amber-400",
            bgColor: "bg-amber-500/[0.08]",
            borderColor: "border-amber-500/[0.15]",
            label: "Pending",
            indicatorColor: "bg-amber-400"
        },
        cancelled: {
            color: "text-white/60",
            bgColor: "bg-white/[0.03]",
            borderColor: "border-white/[0.08]",
            label: "Cancelled",
            indicatorColor: "bg-white/40"
        },
    };

    const config = statusConfig[status] || {
        color: "text-gray-400",
        bgColor: "bg-gray-500/[0.08]",
        borderColor: "border-gray-500/[0.15]",
        label: status.charAt(0).toUpperCase() + status.slice(1),
        indicatorColor: "bg-gray-400"
    };

    const badgeContent = (
        <div className={`relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border backdrop-blur-sm transition-all duration-200 ${config.color} ${config.bgColor} ${config.borderColor}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${config.indicatorColor} ${status === 'open' ? 'animate-pulse' : ''}`} />
            <span>{config.label}</span>
            {conditionIcon && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-black/80 border border-white/20 rounded-full flex items-center justify-center text-[10px] leading-none">
                    {conditionIcon}
                </div>
            )}
        </div>
    );

    // Determine if we should show a tooltip
    const shouldShowTooltip = (status === 'failed' && failureReason) ||
        (status === 'broadcasted') ||
        (status === 'open');

    const getTooltipContent = () => {
        if (status === 'failed' && failureReason) {
            return (
                <div className="text-xs">
                    <div className="font-medium text-red-400 mb-1">Transaction Failed</div>
                    <div className="text-muted-foreground">{failureReason}</div>
                </div>
            );
        }
        if (status === 'broadcasted') {
            return (
                <div className="text-xs">
                    <div className="font-medium text-amber-400 mb-1">Transaction Broadcasted</div>
                    <div className="text-muted-foreground">Waiting for blockchain confirmation</div>
                </div>
            );
        }
        if (status === 'open') {
            return (
                <div className="text-xs">
                    <div className="font-medium text-blue-400 mb-1">Order Active</div>
                    <div className="text-muted-foreground">Waiting for market conditions to be met</div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="flex flex-col gap-1">
            {shouldShowTooltip ? (
                <Tooltip>
                    <TooltipTrigger asChild>
                        {badgeContent}
                    </TooltipTrigger>
                    <TooltipContent
                        side="top"
                        align="center"
                        sideOffset={8}
                        className="max-w-xs z-50 bg-popover border border-border shadow-lg"
                        avoidCollisions={true}
                        collisionPadding={20}
                    >
                        {getTooltipContent()}
                    </TooltipContent>
                </Tooltip>
            ) : (
                badgeContent
            )}
        </div>
    );
};

// Premium Order Card Component
interface PremiumOrderCardProps {
    order: DisplayOrder;
    isRecentlyUpdated: boolean;
    expandedRow: string | null;
    toggleRowExpansion: (uuid: string) => void;
    copyToClipboard: (text: string, id: string) => void;
    copiedId: string | null;
    executeNow: (uuid: string) => void;
    setConfirmUuid: (uuid: string) => void;
    formatTokenAmount: (amount: string | number, decimals: number) => string;
}

const PremiumOrderCard: React.FC<PremiumOrderCardProps> = ({
    order: o,
    isRecentlyUpdated,
    expandedRow,
    toggleRowExpansion,
    copyToClipboard,
    copiedId,
    executeNow,
    setConfirmUuid,
    formatTokenAmount
}) => {
    const isExpanded = expandedRow === o.uuid;

    return (
        <div
            className={`group relative rounded-2xl border transition-all duration-300 cursor-pointer ${isRecentlyUpdated
                ? 'border-emerald-500/[0.3] bg-emerald-950/10 shadow-emerald-500/[0.1] ring-1 ring-emerald-500/[0.2]'
                : 'border-white/[0.08] bg-black/20 hover:bg-black/30 hover:border-white/[0.15]'
                } backdrop-blur-sm`}
            onClick={() => toggleRowExpansion(o.uuid)}
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

            <div className="relative p-3 sm:p-6 space-y-4">
                {/* Header Row */}
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <div className="text-sm font-medium text-white/90" title={formatOrderStatusTime(o).tooltip}>
                            {formatOrderStatusTime(o).text}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-white/40">
                            <span className="font-mono" title={o.uuid}>
                                #{o.uuid.substring(0, 8)}
                            </span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(o.uuid, o.uuid);
                                }}
                                className="p-1 rounded-lg hover:bg-white/[0.05] text-white/40 hover:text-white/80 transition-all duration-200 cursor-pointer"
                                title="Copy order ID"
                            >
                                {copiedId === o.uuid ? (
                                    <Check className="h-3 w-3 text-emerald-400" />
                                ) : (
                                    <Copy className="h-3 w-3" />
                                )}
                            </button>
                        </div>
                        {(o.validFrom || o.validTo) && (
                            <div className="text-xs text-white/40 mt-1">
                                {formatExecWindow(o.validFrom, o.validTo)}
                            </div>
                        )}
                    </div>

                    <PremiumStatusBadge
                        status={o.status}
                        txid={o.txid}
                        failureReason={o.failureReason}
                        conditionIcon={getConditionIcon(o, 'single')}
                    />
                </div>

                {/* Swap Details Row */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <TokenLogo token={{ ...o.inputTokenMeta, image: o.inputTokenMeta.image ?? undefined }} size="sm" />
                            <span className="text-sm font-medium text-white/80">{o.inputTokenMeta.symbol}</span>
                        </div>
                        <div className="flex items-center gap-2 text-white/40">
                            <span className="text-lg">→</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <TokenLogo token={{ ...o.outputTokenMeta, image: o.outputTokenMeta.image ?? undefined }} size="sm" />
                            <span className="text-sm font-medium text-white/80">{o.outputTokenMeta.symbol}</span>
                        </div>
                    </div>

                    <div className="text-right">
                        <div className="text-sm font-mono text-white/90">
                            {formatTokenAmount(o.amountIn, o.inputTokenMeta.decimals!)}
                        </div>
                        <div className="text-xs text-white/40">{o.inputTokenMeta.symbol}</div>
                    </div>
                </div>

                {/* Price Condition Row */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-mono">
                        <span className="text-white/60">When</span>
                        {o.direction === 'gt' ? (
                            <>
                                <span className="text-white/80">1</span>
                                <TokenLogo token={{ ...(o.conditionTokenMeta as any), image: (o.conditionTokenMeta as any)?.image ?? undefined }} size="sm" />
                                <span className="text-white/80">{(o.conditionTokenMeta as any)?.symbol}</span>
                                <span className="text-lg text-white/60">≥</span>
                                <span className="text-white/90">{Number(o.targetPrice).toLocaleString()}</span>
                                {o.baseAsset === 'USD' || !o.baseAsset ? (
                                    <span className="text-white/60">USD</span>
                                ) : (
                                    o.baseAssetMeta ? (
                                        <>
                                            <TokenLogo token={{ ...o.baseAssetMeta, image: o.baseAssetMeta.image ?? undefined }} size="sm" />
                                            <span className="text-white/80">{o.baseAssetMeta.symbol}</span>
                                        </>
                                    ) : (
                                        <span className="text-xs text-white/60" title={o.baseAsset}>
                                            {(o.baseAsset.split('.').pop() || o.baseAsset).slice(0, 10)}
                                        </span>
                                    )
                                )}
                            </>
                        ) : (
                            <>
                                <span className="text-white/80">1</span>
                                {o.baseAsset === 'USD' || !o.baseAsset ? (
                                    <span className="text-white/60">USD</span>
                                ) : (
                                    o.baseAssetMeta ? (
                                        <>
                                            <TokenLogo token={{ ...o.baseAssetMeta, image: o.baseAssetMeta.image ?? undefined }} size="sm" />
                                            <span className="text-white/80">{o.baseAssetMeta.symbol}</span>
                                        </>
                                    ) : (
                                        <span className="text-xs text-white/60" title={o.baseAsset}>
                                            {(o.baseAsset.split('.').pop() || o.baseAsset).slice(0, 10)}
                                        </span>
                                    )
                                )}
                                <span className="text-lg text-white/60">≥</span>
                                <span className="text-white/90">{Number(o.targetPrice).toLocaleString()}</span>
                                <TokenLogo token={{ ...(o.conditionTokenMeta as any), image: (o.conditionTokenMeta as any)?.image ?? undefined }} size="sm" />
                                <span className="text-white/80">{(o.conditionTokenMeta as any)?.symbol}</span>
                            </>
                        )}
                    </div>

                    {/* Action buttons */}
                    {o.status === "open" && (
                        <div className="flex gap-2">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            executeNow(o.uuid);
                                        }}
                                        className="p-2 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/[0.15] text-emerald-400 hover:bg-emerald-500/[0.15] hover:border-emerald-400/[0.3] transition-all duration-200 backdrop-blur-sm cursor-pointer"
                                    >
                                        <Zap className="h-4 w-4" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                    Execute this order immediately at the current market price.
                                </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setConfirmUuid(o.uuid);
                                        }}
                                        className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/60 hover:bg-red-500/[0.08] hover:border-red-500/[0.15] hover:text-red-400 transition-all duration-200 backdrop-blur-sm cursor-pointer"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                    Cancel this order.
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    )}
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                    <div className="pt-4 border-t border-white/[0.08] animate-[slideDown_0.2s_ease-out]">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-sm">
                            {/* Order Details Column */}
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-xs uppercase text-white/40 font-medium mb-3 tracking-wider">Order Details</h4>
                                    <div className="space-y-2">
                                        <div className="border-b border-white/[0.05] pb-2 mb-3">
                                            <h5 className="text-xs font-medium text-white/90 mb-2">Timeline</h5>
                                            <div className="space-y-1">
                                                {getOrderTimestamps(o).map((timestamp, idx) => (
                                                    <div key={idx} className={`flex justify-between text-xs ${timestamp.isMain ? 'text-white/90 font-medium' : 'text-white/70'}`}>
                                                        <span className="text-white/60">{timestamp.label}:</span>
                                                        <span>{timestamp.time}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-white/60">Order ID:</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-white/90 font-mono text-xs">{o.uuid}</span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        copyToClipboard(o.uuid, o.uuid);
                                                    }}
                                                    className="p-1 rounded-lg hover:bg-white/[0.05] cursor-pointer"
                                                >
                                                    {copiedId === o.uuid ? (
                                                        <Check className="h-3 w-3 text-emerald-400" />
                                                    ) : (
                                                        <Copy className="h-3 w-3 text-white/40" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-white/60">Owner:</span>
                                            <span className="text-white/90 font-mono text-xs truncate max-w-[200px]" title={o.owner}>
                                                {o.owner}
                                            </span>
                                        </div>
                                        {(o.validFrom || o.validTo) && (
                                            <div className="flex justify-between items-start">
                                                <span className="text-white/60">Execution Window:</span>
                                                <span className="text-white/90 font-mono text-xs text-right max-w-[200px]" title={formatExecWindow(o.validFrom, o.validTo)}>
                                                    {formatExecWindow(o.validFrom, o.validTo)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Swap Details Column */}
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-xs uppercase text-white/40 font-medium mb-3 tracking-wider">Swap Details</h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-white/60">From:</span>
                                            <div className="flex items-center gap-2">
                                                <TokenLogo token={{ ...o.inputTokenMeta, image: o.inputTokenMeta.image ?? undefined }} size="sm" />
                                                <span className="text-white/90">
                                                    {o.inputTokenMeta.symbol} ({formatTokenAmount(o.amountIn, o.inputTokenMeta.decimals!)})
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-white/60">To:</span>
                                            <div className="flex items-center gap-2">
                                                <TokenLogo token={{ ...o.outputTokenMeta, image: o.outputTokenMeta.image ?? undefined }} size="sm" />
                                                <span className="text-white/90">{o.outputTokenMeta.symbol}</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-white/60">Condition:</span>
                                            <span className="text-white/90 font-medium">
                                                {o.direction === 'gt' ? (
                                                    <>1 {(o.conditionTokenMeta as any)?.symbol} ≥ ${Number(o.targetPrice).toLocaleString()}</>
                                                ) : (
                                                    <>1 {o.baseAssetMeta?.symbol || 'USD'} ≥ ${Number(o.targetPrice).toLocaleString()}</>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Transaction Details */}
                                {o.txid && (
                                    <div>
                                        <h4 className="text-xs uppercase text-white/40 font-medium mb-3 tracking-wider">Transaction</h4>
                                        <div className="flex justify-between items-center">
                                            <span className="text-white/60">TxID:</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-white/90 font-mono text-xs truncate max-w-[120px]" title={o.txid}>
                                                    {truncateAddress(o.txid)}
                                                </span>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <a
                                                            href={`https://explorer.stacks.co/txid/${o.txid}?chain=mainnet`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-1 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/60 hover:bg-blue-500/[0.08] hover:border-blue-500/[0.15] hover:text-blue-400 transition-all duration-200"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <ExternalLink className="h-3 w-3" />
                                                        </a>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top">
                                                        View transaction on Stacks Explorer
                                                    </TooltipContent>
                                                </Tooltip>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                copyToClipboard(o.txid!, `txid-${o.uuid}`);
                                                            }}
                                                            className="p-1 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/60 hover:bg-white/[0.08] hover:text-white/90 transition-all duration-200"
                                                        >
                                                            {copiedId === `txid-${o.uuid}` ? (
                                                                <Check className="h-3 w-3 text-emerald-400" />
                                                            ) : (
                                                                <Copy className="h-3 w-3" />
                                                            )}
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top">
                                                        Copy transaction ID
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


export default function OrdersPanel() {
    const { address, connected } = useWallet();
    const { getPrice } = usePrices();
    const { getToken, getTokenWithDiscovery } = useTokenMetadata();
    const [displayOrders, setDisplayOrders] = useState<DisplayOrder[]>([]);
    const tokenMetaCacheRef = useRef<Map<string, TokenCacheData>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Track tokens we're currently discovering to avoid duplicate requests
    const discoveringTokensRef = useRef<Set<string>>(new Set());

    // Helper function to get token metadata with dynamic discovery
    const getTokenWithFallback = useCallback(async (contractId: string): Promise<TokenCacheData | null> => {
        // First check cache
        const cached = tokenMetaCacheRef.current.get(contractId);
        if (cached) {
            return cached;
        }

        // Then check context
        const contextToken = getToken(contractId);
        if (contextToken) {
            tokenMetaCacheRef.current.set(contractId, contextToken);
            return contextToken;
        }

        // If not found and not already discovering, attempt discovery
        if (!discoveringTokensRef.current.has(contractId)) {
            discoveringTokensRef.current.add(contractId);
            
            try {
                console.log(`[OrdersPanel] Token ${contractId} not found, attempting discovery...`);
                const discoveredToken = await getTokenWithDiscovery(contractId);
                
                if (discoveredToken && discoveredToken.symbol !== 'UNKNOWN') {
                    console.log(`[OrdersPanel] Successfully discovered token: ${contractId} (${discoveredToken.symbol})`);
                    tokenMetaCacheRef.current.set(contractId, discoveredToken);
                    return discoveredToken;
                } else {
                    console.warn(`[OrdersPanel] Discovery failed for token: ${contractId}`);
                }
            } catch (error) {
                console.error(`[OrdersPanel] Error during token discovery for ${contractId}:`, error);
            } finally {
                discoveringTokensRef.current.delete(contractId);
            }
        }

        return null;
    }, [getToken, getTokenWithDiscovery]);
    const [confirmUuid, setConfirmUuid] = useState<string | null>(null);
    const [activeFilter, setActiveFilter] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [recentlyUpdatedOrders, setRecentlyUpdatedOrders] = useState<Set<string>>(new Set());

    // Strategy grouping state
    const [strategyGroups, setStrategyGroups] = useState<StrategyDisplayData[]>([]);
    const [currentPrices, setCurrentPrices] = useState<Map<string, number>>(new Map());
    const [expandedStrategies, setExpandedStrategies] = useState<Set<string>>(new Set());

    // URL state management
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    // Pagination state
    const [pagination, setPagination] = useState<PaginationInfo>({
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false
    });
    const [paginationLoading, setPaginationLoading] = useState(false);

    // Initialize pagination from URL params
    useEffect(() => {
        const urlPage = searchParams?.get('page');
        const urlLimit = searchParams?.get('limit');
        const urlFilter = searchParams?.get('filter');
        const urlSearch = searchParams?.get('search');

        if (urlPage) {
            const page = parseInt(urlPage, 10);
            if (!isNaN(page) && page > 0) {
                setPagination(prev => ({ ...prev, page }));
            }
        }

        if (urlLimit) {
            const limit = parseInt(urlLimit, 10);
            if (!isNaN(limit) && limit > 0 && limit <= 100) {
                setPagination(prev => ({ ...prev, limit }));
            }
        }

        if (urlFilter && ['all', 'open', 'confirmed', 'failed', 'cancelled'].includes(urlFilter)) {
            setActiveFilter(urlFilter);
        }

        if (urlSearch) {
            setSearchQuery(urlSearch);
        }
    }, [searchParams]);

    const fetchOrders = useCallback(async (usePagination = true) => {
        if (!connected || !address) {
            setDisplayOrders([]);
            setLoading(false);
            setPagination(prev => ({ ...prev, total: 0, totalPages: 0 }));
            return;
        }

        const isInitialLoad = displayOrders.length === 0;
        if (isInitialLoad) {
            setLoading(true);
        } else {
            setPaginationLoading(true);
        }

        setError(null);

        try {
            // Build query parameters - get ALL orders, filter at strategy level
            const params = new URLSearchParams({
                owner: address
            });

            if (usePagination) {
                params.append('page', '1');
                params.append('limit', '50'); // Get recent orders for strategy grouping
                params.append('sortBy', 'createdAt');
                params.append('sortOrder', 'desc');

                // Use server-side filtering for individual order status
                if (activeFilter !== 'all') {
                    params.append('status', activeFilter);
                }

                if (searchQuery && searchQuery.trim()) {
                    params.append('search', searchQuery.trim());
                }
            }

            const res = await fetch(`/api/v1/orders?${params}`);
            const j = await res.json();

            if (res.ok) {
                const rawOrders = j.data as LimitOrder[];

                // Update pagination info if available
                if (j.pagination) {
                    setPagination({
                        total: j.pagination.total,
                        page: j.pagination.page,
                        limit: j.pagination.limit,
                        totalPages: j.pagination.totalPages,
                        hasNextPage: j.pagination.hasNextPage,
                        hasPrevPage: j.pagination.hasPrevPage
                    });
                }

                // Check for status changes before processing
                const statusChanges: Array<{ order: LimitOrder, oldStatus: string, newStatus: string }> = [];
                rawOrders.forEach(newOrder => {
                    const currentOrder = displayOrders.find(o => o.uuid === newOrder.uuid);
                    if (currentOrder && currentOrder.status !== newOrder.status) {
                        statusChanges.push({
                            order: newOrder,
                            oldStatus: currentOrder.status,
                            newStatus: newOrder.status
                        });
                    }
                });

                // Show notifications for status changes
                statusChanges.forEach(change => {
                    const orderDisplay = displayOrders.find(o => o.uuid === change.order.uuid);
                    if (!orderDisplay) return;

                    const fromSymbol = orderDisplay.inputTokenMeta?.symbol || 'Token';
                    const toSymbol = orderDisplay.outputTokenMeta?.symbol || 'Token';

                    if (change.newStatus === 'filled') {
                        toast.success(`Order Filled: ${fromSymbol} → ${toSymbol}`, {
                            description: (
                                <span className="text-green-800 font-medium">
                                    Your limit order has been executed successfully
                                </span>
                            ),
                            duration: 8000,
                            className: "border-green-200 bg-green-50 text-green-900",
                        });
                    } else if (change.newStatus === 'cancelled') {
                        toast.info(`Order Cancelled: ${fromSymbol} → ${toSymbol}`, {
                            description: `Your order has been cancelled.`,
                            duration: 5000,
                        });
                    }
                });

                // Mark orders as recently updated
                if (statusChanges.length > 0) {
                    const updatedOrderIds = statusChanges.map(c => c.order.uuid);
                    setRecentlyUpdatedOrders(new Set(updatedOrderIds));

                    // Clear the recently updated status after 10 seconds
                    setTimeout(() => {
                        setRecentlyUpdatedOrders(prev => {
                            const newSet = new Set(prev);
                            updatedOrderIds.forEach(id => newSet.delete(id));
                            return newSet;
                        });
                    }, 10000);
                }

                if (rawOrders.length === 0) {
                    setDisplayOrders([]);
                    setLoading(false);
                    return;
                }
                const newDisplayOrders: DisplayOrder[] = [];

                // Process orders with async token discovery
                for (const order of rawOrders) {
                    try {
                        // Get input token metadata with discovery fallback
                        let inputMeta = await getTokenWithFallback(order.inputToken);
                        if (!inputMeta) {
                            console.warn(`[OrdersPanel] Failed to get metadata for input token: ${order.inputToken}`);
                            // Create a placeholder token to prevent breaking the UI
                            inputMeta = {
                                type: 'token',
                                contractId: order.inputToken,
                                name: `Token ${order.inputToken.split('.')[1] || 'Unknown'}`,
                                description: null,
                                image: null,
                                lastUpdated: Date.now(),
                                decimals: 6,
                                symbol: order.inputToken.split('.')[1] || 'UNKNOWN',
                                token_uri: null,
                                identifier: order.inputToken,
                                total_supply: null,
                                tokenAContract: null,
                                tokenBContract: null,
                                lpRebatePercent: null,
                                externalPoolId: null,
                                engineContractId: null,
                                base: null,
                                usdPrice: null,
                                confidence: null,
                                marketPrice: null,
                                intrinsicValue: null,
                                totalLiquidity: null
                            };
                        }

                        // Get output token metadata with discovery fallback
                        let outputMeta = await getTokenWithFallback(order.outputToken);
                        if (!outputMeta) {
                            console.warn(`[OrdersPanel] Failed to get metadata for output token: ${order.outputToken}`);
                            // Create a placeholder token to prevent breaking the UI
                            outputMeta = {
                                type: 'token',
                                contractId: order.outputToken,
                                name: `Token ${order.outputToken.split('.')[1] || 'Unknown'}`,
                                description: null,
                                image: null,
                                lastUpdated: Date.now(),
                                decimals: 6,
                                symbol: order.outputToken.split('.')[1] || 'UNKNOWN',
                                token_uri: null,
                                identifier: order.outputToken,
                                total_supply: null,
                                tokenAContract: null,
                                tokenBContract: null,
                                lpRebatePercent: null,
                                externalPoolId: null,
                                engineContractId: null,
                                base: null,
                                usdPrice: null,
                                confidence: null,
                                marketPrice: null,
                                intrinsicValue: null,
                                totalLiquidity: null
                            };
                        }

                        // Get base token metadata with discovery fallback
                        let baseMeta: TokenCacheData | null = null;
                        const baseId = (order as any).baseAsset ?? (order as any).base_asset ?? (order as any).baseAssetId ?? (order as any).base_asset_id;
                        if (baseId && baseId !== 'USD') {
                            baseMeta = await getTokenWithFallback(baseId);
                        }

                        // Get condition token metadata with discovery fallback (skip for wildcards and undefined)
                        let conditionMeta: TokenCacheData | undefined;
                        if (order.conditionToken && order.conditionToken !== '*') {
                            conditionMeta = await getTokenWithFallback(order.conditionToken) || undefined;
                        }

                        newDisplayOrders.push({
                            ...order,
                            baseAsset: baseId ?? 'USD',
                            inputTokenMeta: inputMeta,
                            outputTokenMeta: outputMeta,
                            conditionTokenMeta: conditionMeta,
                            baseAssetMeta: baseMeta,
                        });
                        
                    } catch (orderError) {
                        console.error(`[OrdersPanel] Error processing order ${order.uuid}:`, orderError);
                        // Skip this order if there's an error, don't break the whole list
                    }
                }
                setDisplayOrders(newDisplayOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
            } else {
                throw new Error(j.error || "Failed to load orders");
            }
        } catch (err) {
            setError((err as Error).message);
            setDisplayOrders([]);
        } finally {
            setLoading(false);
            setPaginationLoading(false);
        }
    }, [address, connected, pagination.page, pagination.limit, activeFilter, searchQuery, getTokenWithFallback]);

    // fetch once when wallet connects/address changes
    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    // Group orders into strategies when displayOrders changes
    useEffect(() => {
        if (displayOrders.length === 0) {
            setStrategyGroups([]);
            return;
        }

        // Create token metadata map
        const tokenMetaMap = new Map<string, TokenCacheData>();
        displayOrders.forEach(order => {
            tokenMetaMap.set(order.inputToken, order.inputTokenMeta);
            tokenMetaMap.set(order.outputToken, order.outputTokenMeta);
            if (order.conditionToken) {
                tokenMetaMap.set(order.conditionToken, order.conditionTokenMeta as any);
            }
            if (order.baseAssetMeta) {
                tokenMetaMap.set(order.baseAsset || 'USD', order.baseAssetMeta);
            }
        });

        // Group orders into strategies
        const grouped = groupOrdersByStrategy(displayOrders, tokenMetaMap);
        setStrategyGroups(grouped);

        // Fetch current prices for condition tokens using new price context
        const priceMap = new Map<string, number>();
        const uniqueConditionTokens = new Set(
            displayOrders
                .filter(order => order.conditionToken && order.conditionToken !== '*')
                .map(order => order.conditionToken!)
        );

        uniqueConditionTokens.forEach(token => {
            const price = getPrice(token);
            if (price !== null) {
                priceMap.set(token, price);
            }
        });

        setCurrentPrices(priceMap);
    }, [displayOrders, getPrice]);

    // Order status polling for real-time updates
    useEffect(() => {
        if (!connected || !address) return;

        // Poll every 30 seconds for order status updates  
        const pollInterval = setInterval(() => {
            fetchOrders();
        }, 30000);

        return () => clearInterval(pollInterval);
    }, [connected, address, fetchOrders]);

    const formatTokenAmount = (amount: string | number, decimals: number) => {
        const num = Number(amount);
        if (isNaN(num)) return '0.00';
        return (num / (10 ** decimals)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
    };

    const cancelOrder = async (uuid: string) => {
        const orderToCancel = displayOrders.find(o => o.uuid === uuid);
        if (!orderToCancel) return;

        // Optimistic update - mark as cancelled immediately
        const originalStatus = orderToCancel.status;
        setDisplayOrders(prevOrders =>
            prevOrders.map(order =>
                order.uuid === uuid ? { ...order, status: 'cancelled' } : order
            )
        );

        try {
            const res = await signedFetch(`/api/v1/orders/${uuid}/cancel`, { method: "PATCH", message: uuid });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error || "Cancel failed");
            }
            toast.success("Order cancelled successfully.");
        } catch (err) {
            // Revert optimistic update on error
            setDisplayOrders(prevOrders =>
                prevOrders.map(order =>
                    order.uuid === uuid ? { ...order, status: originalStatus } : order
                )
            );
            toast.error((err as Error).message || "Failed to cancel order.");
        } finally {
            setConfirmUuid(null);
        }
    };

    const executeNow = async (uuid: string) => {
        const orderToExecute = displayOrders.find(o => o.uuid === uuid);
        if (!orderToExecute) return;

        // Optimistic update - mark as filled immediately
        const originalStatus = orderToExecute.status;
        setDisplayOrders(prevOrders =>
            prevOrders.map(order =>
                order.uuid === uuid ? { ...order, status: 'filled' } : order
            )
        );

        toast.info("Submitting order for execution...", { duration: 5000 });
        try {
            const res = await signedFetch(`/api/v1/orders/${uuid}/execute`, { method: 'POST', message: uuid });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || 'Execution failed');

            // Update with transaction ID if successful
            setDisplayOrders(prevOrders =>
                prevOrders.map(order =>
                    order.uuid === uuid ? { ...order, status: 'filled', txid: j.txid } : order
                )
            );
            toast.success(`Order Executed`, {
                description: (
                    <div className="space-y-2">
                        <div className="text-white/90 font-medium">Transaction submitted successfully</div>
                        <a
                            href={`https://explorer.hiro.so/txid/${j.txid}?chain=mainnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:text-emerald-300 underline text-sm font-mono inline-flex items-center gap-1"
                        >
                            View on Explorer
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    </div>
                ),
                duration: 8000,
                className: "bg-emerald-950/20 border-emerald-500/20 text-white backdrop-blur-sm",
            });
        } catch (err) {
            // Revert optimistic update on error
            setDisplayOrders(prevOrders =>
                prevOrders.map(order =>
                    order.uuid === uuid ? { ...order, status: originalStatus } : order
                )
            );
            toast.error((err as Error).message || "Failed to execute order.");
        }
    };

    // All filtering is now done server-side
    const filteredOrders = displayOrders;

    // Function to copy text to clipboard with visual feedback
    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        });
    };

    // Handle row click to expand/collapse details
    const toggleRowExpansion = (uuid: string) => {
        setExpandedRow(expandedRow === uuid ? null : uuid);
    };

    // Handle strategy expansion/collapse
    const toggleStrategyExpansion = (strategyId: string) => {
        setExpandedStrategies(prev => {
            const newSet = new Set(prev);
            if (newSet.has(strategyId)) {
                newSet.delete(strategyId);
            } else {
                newSet.add(strategyId);
            }
            return newSet;
        });
    };

    // Pagination handlers
    const handlePageChange = (newPage: number) => {
        setPagination(prev => ({ ...prev, page: newPage }));
        updateUrlParams({ page: newPage.toString() });
        setExpandedRow(null); // Close any expanded rows when changing pages
    };

    const handleLimitChange = (newLimit: number) => {
        setPagination(prev => ({
            ...prev,
            limit: newLimit,
            page: 1 // Reset to first page when changing limit
        }));
        updateUrlParams({ limit: newLimit.toString(), page: '1' });
        setExpandedRow(null);
    };

    const handleFilterChange = (newFilter: string) => {
        setActiveFilter(newFilter);
        setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page when changing filters
        updateUrlParams({ filter: newFilter, page: '1' });
        setExpandedRow(null);
    };

    const handleSearchChange = (newSearch: string) => {
        setSearchQuery(newSearch);
        setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page when searching
        updateUrlParams({ search: newSearch, page: '1' });
        setExpandedRow(null);
    };

    // Update URL parameters
    const updateUrlParams = (updates: Record<string, string>) => {
        const params = new URLSearchParams(searchParams?.toString() || '');

        Object.entries(updates).forEach(([key, value]) => {
            if (value && value !== 'all' && value !== '1' && value !== '10') {
                params.set(key, value);
            } else {
                params.delete(key);
            }
        });

        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    if (!connected) {
        return (
            <div className="container max-w-6xl mx-auto px-4 py-16">
                <div className="flex flex-col items-center justify-center py-16 text-white/40">
                    <div className="relative mb-6">
                        <div className="h-16 w-16 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
                            <ClipboardList className="h-8 w-8 text-white/30" />
                        </div>
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                    </div>
                    <h3 className="text-lg font-medium text-white/70 mb-2">Connect Your Wallet</h3>
                    <p className="text-sm text-center max-w-md leading-relaxed">
                        Please connect your wallet to view and manage your smart limit orders with real-time monitoring.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <TooltipProvider delayDuration={200}>
            <div className="sm:container max-w-6xl mx-auto px-2 py-4 sm:px-4 sm:py-8">
                {/* Immersive header - seamless design */}
                <div className="space-y-8 mb-16">
                    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
                        {/* Clean title section */}
                        <div className="space-y-6">
                            <div>
                                <h1 className="text-3xl font-medium text-white/95 tracking-wide mb-3">Order Management</h1>
                                <p className="text-white/60 max-w-2xl text-base leading-relaxed">
                                    Monitor and manage your smart limit orders with real-time status updates and seamless execution control.
                                    Track pending, executed, and cancelled orders in a unified dashboard.
                                </p>
                            </div>
                            <div className="flex items-center gap-6 text-sm text-white/40">
                                <span>
                                    {strategyGroups.length} {strategyGroups.length === 1 ? 'strategy' : 'strategies'}
                                    ({pagination.total} {activeFilter === 'all' ? 'total' : activeFilter} orders)
                                </span>
                                <span>Page {pagination.page} of {pagination.totalPages}</span>
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse" />
                                        <div className="absolute inset-0 h-1.5 w-1.5 bg-emerald-400/40 rounded-full animate-ping" />
                                        <div className="absolute inset-[-1px] h-2.5 w-2.5 bg-emerald-400/20 rounded-full blur-sm animate-pulse" />
                                    </div>
                                    <span className="animate-pulse">Live monitoring</span>
                                </div>
                            </div>
                        </div>

                        {/* Search and filter controls */}
                        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                            {/* Search input */}
                            <div className="relative flex-1 lg:max-w-sm">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Search orders, addresses, tokens..."
                                    value={searchQuery}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    disabled={loading}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/90 text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/[0.15] focus:border-white/[0.2] transition-all duration-200 disabled:opacity-50"
                                />
                            </div>

                            {/* Premium filter tabs */}
                            <div className="flex items-center gap-2 flex-wrap">
                                {[['all', 'All'], ['open', 'Open'], ['confirmed', 'Confirmed'], ['failed', 'Failed'], ['cancelled', 'Cancelled']].map(([value, label]) => (
                                    <button
                                        key={value}
                                        onClick={() => handleFilterChange(value)}
                                        disabled={loading || paginationLoading}
                                        className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 disabled:opacity-50 cursor-pointer ${activeFilter === value
                                            ? 'bg-white/[0.08] text-white border border-white/[0.2] shadow-lg backdrop-blur-sm'
                                            : 'text-white/60 hover:text-white/90 hover:bg-white/[0.03] border border-transparent'
                                            }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Premium Pagination - Top */}
                {!loading && pagination.totalPages > 1 && (
                    <div className="mb-8">
                        <PremiumPagination
                            pagination={pagination}
                            onPageChange={handlePageChange}
                            onLimitChange={handleLimitChange}
                            isLoading={paginationLoading}
                        />
                    </div>
                )}

                {/* Premium loading skeleton */}
                {loading && (
                    <div className="grid gap-6">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="group relative p-6 rounded-2xl border border-white/[0.08] bg-black/20 backdrop-blur-sm animate-pulse">
                                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                                <div className="relative space-y-4">
                                    {/* Header row */}
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-2">
                                            <div className="h-4 w-16 bg-white/[0.06] rounded-lg" />
                                            <div className="h-3 w-20 bg-white/[0.04] rounded-lg" />
                                        </div>
                                        <div className="h-6 w-20 bg-white/[0.06] rounded-full" />
                                    </div>
                                    {/* Swap row */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 bg-white/[0.06] rounded-full" />
                                            <div className="h-4 w-12 bg-white/[0.06] rounded-lg" />
                                            <div className="h-4 w-6 bg-white/[0.04] rounded-lg" />
                                            <div className="h-8 w-8 bg-white/[0.06] rounded-full" />
                                            <div className="h-4 w-12 bg-white/[0.06] rounded-lg" />
                                        </div>
                                        <div className="h-4 w-24 bg-white/[0.06] rounded-lg" />
                                    </div>
                                    {/* Condition row */}
                                    <div className="flex items-center justify-between">
                                        <div className="h-4 w-48 bg-white/[0.06] rounded-lg" />
                                        <div className="flex gap-2">
                                            <div className="h-8 w-8 bg-white/[0.06] rounded-xl" />
                                            <div className="h-8 w-8 bg-white/[0.06] rounded-xl" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

                {/* Content area with loading overlay support */}
                <div className="relative">
                    {!loading && (strategyGroups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-white/40">
                            <div className="relative mb-6">
                                <div className="h-16 w-16 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
                                    <ClipboardList className="h-8 w-8 text-white/30" />
                                </div>
                                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                            </div>
                            <h3 className="text-lg font-medium text-white/70 mb-2">{displayOrders.length === 0 ? 'No orders yet' : 'No matching orders'}</h3>
                            <p className="text-sm text-center max-w-md leading-relaxed">
                                {displayOrders.length === 0
                                    ? 'Create your first smart limit order from the Swap tab and it will appear here for real-time monitoring and management.'
                                    : `No ${activeFilter === 'all' ? '' : activeFilter} orders found. Try adjusting your filter or create new orders to get started.`}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {strategyGroups.map((strategyData) => {
                                // Check if any order in this strategy was recently updated
                                const isRecentlyUpdated = strategyData.orders.some(order =>
                                    recentlyUpdatedOrders.has(order.uuid)
                                );

                                return (
                                    <StrategyCardFactory
                                        key={strategyData.id}
                                        strategyData={strategyData}
                                        currentPrices={currentPrices}
                                        isRecentlyUpdated={isRecentlyUpdated}
                                        expandedStrategies={expandedStrategies}
                                        expandedRow={expandedRow}
                                        onToggleExpansion={toggleStrategyExpansion}
                                        onToggleRowExpansion={toggleRowExpansion}
                                        onCopyToClipboard={copyToClipboard}
                                        onExecuteNow={executeNow}
                                        onCancelOrder={(uuid) => setConfirmUuid(uuid)}
                                        copiedId={copiedId}
                                        formatTokenAmount={formatTokenAmount}
                                    />
                                );
                            })}
                        </div>
                    ))}

                    {/* Loading overlay during filter changes */}
                    {paginationLoading && (
                        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center rounded-2xl z-10">
                            <div className="flex items-center gap-3 text-sm text-white/70">
                                <div className="h-5 w-5 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
                                <span>Updating orders...</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>


            {/* Premium cancel confirmation dialog */}
            {confirmUuid && (
                <Dialog open onOpenChange={(open) => { if (!open) setConfirmUuid(null); }}>
                    <DialogContent className="border-white/[0.08] bg-black/40 backdrop-blur-xl">
                        <DialogHeader>
                            <DialogTitle className="text-white/95">Cancel Order</DialogTitle>
                            <DialogDescription className="text-white/60">
                                Are you sure you want to cancel this limit order? This action cannot be undone.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="flex justify-end gap-3 pt-4">
                            <Button
                                variant="outline"
                                onClick={() => setConfirmUuid(null)}
                                className="border-white/[0.08] bg-white/[0.03] text-white/80 hover:bg-white/[0.08] hover:text-white"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => cancelOrder(confirmUuid)}
                                className="bg-red-500/[0.15] border border-red-500/[0.3] text-red-400 hover:bg-red-500/[0.25] hover:border-red-400/[0.5]"
                            >
                                Confirm Cancellation
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </TooltipProvider>
    );
}
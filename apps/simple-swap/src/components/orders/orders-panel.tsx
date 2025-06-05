"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useWallet } from "@/contexts/wallet-context";
import type { LimitOrder } from "@/lib/orders/types";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "../ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import TokenLogo from "../TokenLogo";
import { ClipboardList, Copy, Check, Zap, Trash2 } from "lucide-react";
import { getTokenMetadataCached, TokenCacheData } from "@repo/tokens";
import { toast } from "sonner";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../ui/tooltip";
import { signedFetch } from "blaze-sdk";

interface BadgeProps {
    status: LimitOrder["status"];
}

// Enriched order type with token metadata
interface DisplayOrder extends LimitOrder {
    inputTokenMeta: TokenCacheData;
    outputTokenMeta: TokenCacheData;
    conditionTokenMeta: TokenCacheData;
    baseAssetMeta?: TokenCacheData | null;
}

const StatusBadge: React.FC<BadgeProps> = ({ status }) => {
    const statusConfig: Record<LimitOrder["status"], { color: string, label: string }> = {
        open: {
            color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900/50",
            label: "Pending"
        },
        filled: {
            color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900/50",
            label: "Executed"
        },
        cancelled: {
            color: "bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800",
            label: "Cancelled"
        },
    };

    const config = statusConfig[status];

    return (
        <span
            className={cn(
                "w-fit px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap border flex items-center gap-1.5",
                config.color
            )}
        >
            <span className={`w-1.5 h-1.5 rounded-full ${status === 'open' ? 'bg-yellow-500' : status === 'filled' ? 'bg-green-500' : 'bg-gray-500'}`}></span>
            {config.label}
        </span>
    );
};

// Function to format relative time
function formatRelativeTime(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.round(diffMs / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffHour = Math.round(diffMin / 60);
    const diffDay = Math.round(diffHour / 24);

    if (diffSec < 60) {
        return 'just now';
    } else if (diffMin < 60) {
        return `${diffMin} min${diffMin > 1 ? 's' : ''} ago`;
    } else if (diffHour < 24) {
        return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
    } else if (diffDay < 30) {
        return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    } else {
        // Fall back to date if more than a month ago
        return date.toLocaleDateString();
    }
}

// Helper to format execution window text
function formatExecWindow(order: LimitOrder): string {
    const from = order.validFrom ? new Date(order.validFrom) : null;
    const to = order.validTo ? new Date(order.validTo) : null;

    if (!from && !to) return 'Anytime';
    if (from && !to) return `After ${from.toLocaleString()}`;
    if (!from && to) return `Before ${to.toLocaleString()}`;
    if (from && to) return `${from.toLocaleString()} – ${to.toLocaleString()}`;
    return 'Anytime';
}

export default function OrdersPanel() {
    const { address, connected } = useWallet();
    const [displayOrders, setDisplayOrders] = useState<DisplayOrder[]>([]);
    const tokenMetaCacheRef = useRef<Map<string, TokenCacheData>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [confirmUuid, setConfirmUuid] = useState<string | null>(null);
    const [activeFilter, setActiveFilter] = useState<string>("all");
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    const fetchOrders = useCallback(async () => {
        if (!connected || !address) {
            setDisplayOrders([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/v1/orders?owner=${address}`);
            const j = await res.json();
            if (res.ok) {
                const rawOrders = j.data as LimitOrder[];
                if (rawOrders.length === 0) {
                    setDisplayOrders([]);
                    setLoading(false);
                    return;
                }
                const newDisplayOrders: DisplayOrder[] = [];
                const currentMetaCache = tokenMetaCacheRef.current;

                for (const order of rawOrders) {
                    let inputMeta = currentMetaCache.get(order.inputToken);
                    if (!inputMeta) {
                        inputMeta = await getTokenMetadataCached(order.inputToken);
                        currentMetaCache.set(order.inputToken, inputMeta);
                    }

                    let outputMeta = currentMetaCache.get(order.outputToken);
                    if (!outputMeta) {
                        outputMeta = await getTokenMetadataCached(order.outputToken);
                        currentMetaCache.set(order.outputToken, outputMeta);
                    }

                    let baseMeta: TokenCacheData | null = null;
                    const baseId = (order as any).baseAsset ?? (order as any).base_asset ?? (order as any).baseAssetId ?? (order as any).base_asset_id;
                    if (baseId && baseId !== 'USD') {
                        baseMeta = currentMetaCache.get(baseId) || await getTokenMetadataCached(baseId);
                        currentMetaCache.set(baseId, baseMeta);
                    }

                    // Fetch condition token meta (might duplicate output token)
                    let conditionMeta = currentMetaCache.get(order.conditionToken);
                    if (!conditionMeta) {
                        conditionMeta = await getTokenMetadataCached(order.conditionToken);
                        currentMetaCache.set(order.conditionToken, conditionMeta);
                    }

                    newDisplayOrders.push({
                        ...order,
                        baseAsset: baseId ?? 'USD',
                        inputTokenMeta: inputMeta,
                        outputTokenMeta: outputMeta,
                        conditionTokenMeta: conditionMeta,
                        baseAssetMeta: baseMeta,
                    });
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
        }
    }, [address, connected]);

    // fetch once when wallet connects/address changes
    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

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
            toast.success(`Execution submitted: ${j.txid.substring(0, 10)}...`);
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

    // Filter orders based on selected tab
    const filteredOrders = displayOrders.filter(order =>
        activeFilter === "all" || order.status === activeFilter
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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

    if (!connected) {
        return <p className="text-center text-sm text-muted-foreground">Connect wallet to view your orders.</p>;
    }

    return (
        <TooltipProvider delayDuration={200}>
            <Card className="bg-transparent border-none container">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 md:px-0 pt-6 md:pt-0">
                    <CardHeader className="flex-row items-center gap-3 px-1">
                        <ClipboardList className="h-6 w-6 text-primary" />
                        <div>
                            <CardTitle>My Orders</CardTitle>
                            <CardDescription>View and manage your open, filled or cancelled triggered swaps.</CardDescription>
                        </div>
                    </CardHeader>
                    <div className="mb-0 md:mb-4 flex justify-start md:justify-center">
                        <Tabs value={activeFilter} onValueChange={setActiveFilter} className="w-full md:w-auto max-w-md">
                            <TabsList className="grid grid-cols-4 w-full md:w-auto">
                                <TabsTrigger value="all">All</TabsTrigger>
                                <TabsTrigger value="open">Pending</TabsTrigger>
                                <TabsTrigger value="filled">Executed</TabsTrigger>
                                <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </div>
                <CardContent className="pt-4 px-6 md:px-0">
                    {loading && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left border-b border-border/70 whitespace-nowrap">
                                        <th className="px-4 py-2">When</th>
                                        <th className="px-4 py-2">Swap</th>
                                        <th className="px-4 py-2 text-right">Amount</th>
                                        <th className="px-4 py-2">Price Condition</th>
                                        <th className="px-4 py-2">Status</th>
                                        <th className="px-2 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody className="animate-pulse">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <tr key={i} className="border-b border-border/50 whitespace-nowrap">
                                            <td className="px-4 py-2">
                                                <div className="h-5 w-20 bg-muted rounded"></div>
                                                <div className="h-3 w-16 bg-muted rounded mt-1 opacity-60"></div>
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-5 w-5 bg-muted rounded-full"></div>
                                                    <div className="h-4 w-10 bg-muted rounded"></div>
                                                    <div className="mx-1 h-4 w-4 bg-muted rounded-full opacity-30"></div>
                                                    <div className="h-5 w-5 bg-muted rounded-full"></div>
                                                    <div className="h-4 w-10 bg-muted rounded"></div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                <div className="h-5 w-14 bg-muted rounded ml-auto"></div>
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="h-5 w-32 rounded bg-muted"></div>
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="h-5 w-16 rounded-full bg-muted"></div>
                                            </td>
                                            <td className="px-2 py-2">
                                                <div className="flex gap-2">
                                                    <div className="h-8 w-16 bg-muted rounded"></div>
                                                    <div className="h-8 w-16 bg-muted rounded"></div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {error && <p className="text-sm text-destructive mb-4">{error}</p>}
                    {!loading && (filteredOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <ClipboardList className="h-12 w-12 mb-3 text-primary/60" />
                            <p className="text-sm mb-1">{displayOrders.length === 0 ? 'No orders yet' : 'No matching orders'}</p>
                            <p className="text-xs text-center max-w-xs">
                                {displayOrders.length === 0
                                    ? 'Create a swap order from the Swap tab and it will appear here for tracking.'
                                    : `No ${activeFilter === 'all' ? '' : activeFilter} orders found. Try another filter.`}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left border-b border-border/70 whitespace-nowrap">
                                        <th className="px-4 py-2">When</th>
                                        <th className="px-4 py-2">Swap</th>
                                        <th className="px-4 py-2 text-center">Amount</th>
                                        <th className="px-4 py-2">Price Condition</th>
                                        <th className="px-4 py-2">Status</th>
                                        <th className="px-2 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredOrders.map((o) => (
                                        <React.Fragment key={o.uuid}>
                                            <tr
                                                className="border-b border-border/50 last:border-0 whitespace-nowrap hover:bg-muted/20 transition-colors cursor-pointer"
                                                onClick={() => toggleRowExpansion(o.uuid)}
                                            >
                                                <td className="px-4 py-2 font-medium">
                                                    <span title={new Date(o.createdAt).toLocaleString()}>
                                                        {formatRelativeTime(o.createdAt)}
                                                    </span>
                                                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                                        <span className="font-mono truncate max-w-[80px]" title={o.uuid}>
                                                            {o.uuid.substring(0, 8)}
                                                        </span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                copyToClipboard(o.uuid, o.uuid);
                                                            }}
                                                            className="p-0.5 rounded hover:bg-muted/50"
                                                            title="Copy order ID"
                                                        >
                                                            {copiedId === o.uuid ? (
                                                                <Check className="h-3 w-3 text-green-500" />
                                                            ) : (
                                                                <Copy className="h-3 w-3 text-muted-foreground/70" />
                                                            )}
                                                        </button>
                                                    </div>
                                                    {(o.validFrom || o.validTo) && (
                                                        <div className="text-xs text-muted-foreground mt-0.5">
                                                            {formatExecWindow(o)}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <span className="flex items-center gap-1">
                                                        <TokenLogo token={{ ...o.inputTokenMeta, image: o.inputTokenMeta.image ?? undefined }} size="sm" />
                                                        <span>{o.inputTokenMeta.symbol}</span>
                                                        <span className="mx-1 text-muted-foreground">→</span>
                                                        <TokenLogo token={{ ...o.outputTokenMeta, image: o.outputTokenMeta.image ?? undefined }} size="sm" />
                                                        <span>{o.outputTokenMeta.symbol}</span>
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-center">{formatTokenAmount(o.amountIn, o.inputTokenMeta.decimals!)}</td>
                                                <td className="px-4 py-2">
                                                    <span className="font-mono flex items-center gap-1">
                                                        <span>1</span>
                                                        <TokenLogo token={{ ...o.conditionTokenMeta, image: o.conditionTokenMeta.image ?? undefined }} size="sm" />
                                                        <span>{o.conditionTokenMeta.symbol}</span>
                                                        <span className="mx-1 font-mono text-lg">{o.direction === 'lt' ? '≤' : '≥'}</span>
                                                        <span>{Number(o.targetPrice).toLocaleString()}</span>
                                                        {o.baseAsset === 'USD' || !o.baseAsset ? (
                                                            <span>USD</span>
                                                        ) : (
                                                            o.baseAssetMeta ? (
                                                                <>
                                                                    <TokenLogo token={{ ...o.baseAssetMeta, image: o.baseAssetMeta.image ?? undefined }} size="sm" />
                                                                    <span>{o.baseAssetMeta.symbol}</span>
                                                                </>
                                                            ) : (
                                                                <span className="font-mono text-xs" title={o.baseAsset}>{(o.baseAsset.split('.').pop() || o.baseAsset).slice(0, 10)}</span>
                                                            )
                                                        )}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2"><StatusBadge status={o.status} /></td>
                                                <td className="px-2 py-2">
                                                    {o.status === "open" && (
                                                        <div className="flex gap-2">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="secondary"
                                                                        size="icon"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            executeNow(o.uuid);
                                                                        }}
                                                                    >
                                                                        <Zap className="h-4 w-4" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="top">
                                                                    Execute this order immediately at the current market price.
                                                                </TooltipContent>
                                                            </Tooltip>

                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setConfirmUuid(o.uuid);
                                                                        }}
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="top">
                                                                    Cancel this order.
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                            {expandedRow === o.uuid && (
                                                <tr className="bg-muted/10 animate-[slideDown_0.2s_ease-out]">
                                                    <td colSpan={6} className="p-4">
                                                        <div className="text-sm">
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                                <div className="space-y-3">
                                                                    <div>
                                                                        <h4 className="font-medium text-xs uppercase text-muted-foreground mb-1">Order Details</h4>
                                                                        <div className="space-y-1">
                                                                            <div className="flex justify-between">
                                                                                <span className="text-muted-foreground">Created:</span>
                                                                                <span title={new Date(o.createdAt).toISOString()}>{new Date(o.createdAt).toLocaleString()}</span>
                                                                            </div>
                                                                            <div className="flex justify-between">
                                                                                <span className="text-muted-foreground">Order ID:</span>
                                                                                <span className="font-mono text-xs flex items-center gap-1">
                                                                                    {o.uuid}
                                                                                    <button
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            copyToClipboard(o.uuid, o.uuid);
                                                                                        }}
                                                                                        className="p-0.5 rounded hover:bg-muted/50"
                                                                                    >
                                                                                        {copiedId === o.uuid ? (
                                                                                            <Check className="h-3 w-3 text-green-500" />
                                                                                        ) : (
                                                                                            <Copy className="h-3 w-3 text-muted-foreground/70" />
                                                                                        )}
                                                                                    </button>
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex justify-between">
                                                                                <span className="text-muted-foreground">Owner:</span>
                                                                                <span className="font-mono text-xs truncate max-w-[400px]" title={o.owner}>{o.owner}</span>
                                                                            </div>
                                                                            {(o.validFrom || o.validTo) && (
                                                                                <div className="flex justify-between">
                                                                                    <span className="text-muted-foreground">Execution Window:</span>
                                                                                    <span className="font-mono text-xs text-right max-w-[320px] truncate" title={formatExecWindow(o)}>
                                                                                        {formatExecWindow(o)}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="space-y-3">
                                                                    <div>
                                                                        <h4 className="font-medium text-xs uppercase text-muted-foreground mb-1">Swap Details</h4>
                                                                        <div className="space-y-1">
                                                                            <div className="flex justify-between">
                                                                                <span className="text-muted-foreground">From:</span>
                                                                                <span className="flex items-center gap-1">
                                                                                    <TokenLogo token={{ ...o.inputTokenMeta, image: o.inputTokenMeta.image ?? undefined }} size="sm" />
                                                                                    {o.inputTokenMeta.symbol} ({formatTokenAmount(o.amountIn, o.inputTokenMeta.decimals!)})
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex justify-between">
                                                                                <span className="text-muted-foreground">To:</span>
                                                                                <span className="flex items-center gap-1">
                                                                                    <TokenLogo token={{ ...o.outputTokenMeta, image: o.outputTokenMeta.image ?? undefined }} size="sm" />
                                                                                    {o.outputTokenMeta.symbol}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex justify-between">
                                                                                <span className="text-muted-foreground">Condition:</span>
                                                                                <span className="font-medium">
                                                                                    {/* Assuming conditionToken might also need metadata in future */}
                                                                                    {o.conditionToken.split(".")[1] || o.conditionToken} price {o.direction === 'lt' ? '≤' : '≥'} ${Number(o.targetPrice).toLocaleString()}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {o.status === "filled" && o.txid && (
                                                                        <div>
                                                                            <h4 className="font-medium text-xs uppercase text-muted-foreground mb-1">Transaction</h4>
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="text-muted-foreground">TxID:</span>
                                                                                <a
                                                                                    href={`https://explorer.stacks.co/txid/${o.txid}?chain=mainnet`}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    className="text-primary hover:underline font-mono truncate max-w-[200px]"
                                                                                >
                                                                                    {o.txid.substring(0, 10)}...
                                                                                </a>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Cancel confirmation dialog */}
            {confirmUuid && (
                <Dialog open onOpenChange={(open) => { if (!open) setConfirmUuid(null); }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Cancel Order</DialogTitle>
                            <DialogDescription>Are you sure you want to cancel this order?</DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setConfirmUuid(null)}>Dismiss</Button>
                            <Button variant="destructive" onClick={() => cancelOrder(confirmUuid)}>Confirm</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </TooltipProvider>
    );
}
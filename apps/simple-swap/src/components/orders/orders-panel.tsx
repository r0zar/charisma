"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useWallet } from "@/contexts/wallet-context";
import type { LimitOrder } from "@/lib/orders/types";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "../ui/dialog";
import { ClipboardList, Search, ExternalLink } from "lucide-react";
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
                        <div className="w-2 h-2 bg-line-strong rounded-full animate-pulse" />
                        <span className="text-xs text-ink-muted">Checking...</span>
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
                        <div className="w-2 h-2 bg-success rounded-full" />
                        <span className="text-xs text-success">Confirmed</span>
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
                        <div className="w-2 h-2 bg-danger rounded-full" />
                        <span className="text-xs text-danger">Failed</span>
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
                        <div className="w-2 h-2 bg-warning rounded-full animate-pulse" />
                        <span className="text-xs text-warning">Broadcasting...</span>
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
            color: "text-accent-text",
            bgColor: "bg-accent/[0.08]",
            borderColor: "border-accent/[0.15]",
            label: "Open",
            indicatorColor: "bg-accent"
        },
        broadcasted: {
            color: "text-warning",
            bgColor: "bg-warning/[0.08]",
            borderColor: "border-warning/[0.15]",
            label: "Pending",
            indicatorColor: "bg-warning"
        },
        confirmed: {
            color: "text-success",
            bgColor: "bg-success/[0.08]",
            borderColor: "border-success/[0.15]",
            label: "Confirmed",
            indicatorColor: "bg-success"
        },
        failed: {
            color: "text-danger",
            bgColor: "bg-danger/[0.08]",
            borderColor: "border-danger/[0.15]",
            label: "Failed",
            indicatorColor: "bg-danger"
        },
        filled: {
            color: "text-warning",
            bgColor: "bg-warning/[0.08]",
            borderColor: "border-warning/[0.15]",
            label: "Pending",
            indicatorColor: "bg-warning"
        },
        cancelled: {
            color: "text-ink-muted",
            bgColor: "bg-surface",
            borderColor: "border-line",
            label: "Cancelled",
            indicatorColor: "bg-line-strong"
        },
    };

    const config = statusConfig[status] || {
        color: "text-ink-muted",
        bgColor: "bg-surface-hover",
        borderColor: "border-line",
        label: status.charAt(0).toUpperCase() + status.slice(1),
        indicatorColor: "bg-surface-hover"
    };

    const badgeContent = (
        <div className={`relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border backdrop-blur-sm transition-all duration-200 ${config.color} ${config.bgColor} ${config.borderColor}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${config.indicatorColor} ${status === 'open' ? 'animate-pulse' : ''}`} />
            <span>{config.label}</span>
            {conditionIcon && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-surface-raised border border-line rounded-full flex items-center justify-center text-[10px] leading-none">
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
                    <div className="font-medium text-danger mb-1">Transaction Failed</div>
                    <div className="text-muted-foreground">{failureReason}</div>
                </div>
            );
        }
        if (status === 'broadcasted') {
            return (
                <div className="text-xs">
                    <div className="font-medium text-warning mb-1">Transaction Broadcasted</div>
                    <div className="text-muted-foreground">Waiting for blockchain confirmation</div>
                </div>
            );
        }
        if (status === 'open') {
            return (
                <div className="text-xs">
                    <div className="font-medium text-accent-text mb-1">Order Active</div>
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


/** The order manager. Inside Activity (`embedded`) it drops its own page frame and title. */
export default function OrdersPanel({ embedded = false }: { embedded?: boolean }) {
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
    const [confirmBulk, setConfirmBulk] = useState<string[] | null>(null);
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
    const loadedOnceRef = useRef(false);

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

    // quiet: a background refresh (the 30s poll) updates the list in place, with no loading state at all
    const fetchOrders = useCallback(async (usePagination = true, quiet = false) => {
        if (!connected || !address) {
            setDisplayOrders([]);
            setLoading(false);
            setPagination(prev => ({ ...prev, total: 0, totalPages: 0 }));
            return;
        }

        // A ref, not displayOrders: this callback's copy of the list is from when it was made, so it always looked empty
        if (!loadedOnceRef.current) {
            setLoading(true);
        } else if (!quiet) {
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
                                <span className="text-success font-medium">
                                    Your limit order has been executed successfully
                                </span>
                            ),
                            duration: 8000,
                            className: "border-success bg-success-soft text-success",
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
                loadedOnceRef.current = true;
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
            fetchOrders(true, true);
        }, 30000);

        return () => clearInterval(pollInterval);
    }, [connected, address, fetchOrders]);

    const formatTokenAmount = (amount: string | number, decimals: number) => {
        const num = Number(amount);
        if (isNaN(num)) return '0.00';
        return (num / (10 ** decimals)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
    };

    /** Returns true when the cancel succeeded. Errors are toasted here, not thrown. */
    const cancelOrder = async (uuid: string): Promise<boolean> => {
        const orderToCancel = displayOrders.find(o => o.uuid === uuid);
        if (!orderToCancel) return false;

        // Optimistic update - mark as cancelled immediately
        const originalStatus = orderToCancel.status;
        const originalCancelledAt = orderToCancel.cancelledAt;
        setDisplayOrders(prevOrders =>
            prevOrders.map(order =>
                order.uuid === uuid ? { ...order, status: 'cancelled', cancelledAt: new Date().toISOString() } : order
            )
        );

        try {
            const res = await signedFetch(`/api/v1/orders/${uuid}/cancel`, { method: "PATCH", message: uuid });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error || "Cancel failed");
            }
            toast.success("Order cancelled successfully.");
            return true;
        } catch (err) {
            // Revert optimistic update on error
            setDisplayOrders(prevOrders =>
                prevOrders.map(order =>
                    order.uuid === uuid ? { ...order, status: originalStatus, cancelledAt: originalCancelledAt } : order
                )
            );
            toast.error((err as Error).message || "Failed to cancel order.");
            return false;
        } finally {
            setConfirmUuid(null);
        }
    };

    const cancelOrders = async (uuids: string[]) => {
        let cancelled = 0;
        for (const uuid of uuids) {
            if (await cancelOrder(uuid)) cancelled++;
        }
        toast(`Cancelled ${cancelled} of ${uuids.length} orders`);
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
                        <div className="text-ink font-medium">Transaction submitted successfully</div>
                        <a
                            href={`https://explorer.hiro.so/txid/${j.txid}?chain=mainnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-success hover:text-success underline text-sm font-mono inline-flex items-center gap-1"
                        >
                            View on Explorer
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    </div>
                ),
                duration: 8000,
                className: "bg-success-soft border-success/20 text-ink backdrop-blur-sm",
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
                <div className="flex flex-col items-center justify-center py-16 text-ink-muted">
                    <div className="relative mb-6">
                        <div className="h-16 w-16 rounded-2xl bg-surface border border-line flex items-center justify-center">
                            <ClipboardList className="h-8 w-8 text-ink-faint" />
                        </div>
                    </div>
                    <h3 className="text-lg font-medium text-ink-body mb-2">Connect Your Wallet</h3>
                    <p className="text-sm text-center max-w-md leading-relaxed">
                        Please connect your wallet to view and manage your smart limit orders with real-time monitoring.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <TooltipProvider delayDuration={200}>
            <div className={embedded ? '' : 'sm:container max-w-6xl mx-auto px-2 py-4 sm:px-4 sm:py-8'}>
                {/* Immersive header - seamless design */}
                <div className={`space-y-8 ${embedded ? 'mb-8' : 'mb-16'}`}>
                    <div className={embedded ? "flex flex-col gap-4" : "flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8"}>
                        {/* Clean title section */}
                        <div className="space-y-6">
                            {!embedded && (
                                <div>
                                    <h1 className="text-3xl font-medium text-ink tracking-wide mb-3">Order Management</h1>
                                    <p className="text-ink-muted max-w-2xl text-base leading-relaxed">
                                        Monitor and manage your smart limit orders with real-time status updates and seamless execution control.
                                        Track pending, executed, and cancelled orders in a unified dashboard.
                                    </p>
                                </div>
                            )}
                            <div className="flex items-center gap-6 text-sm text-ink-muted">
                                <span>
                                    {strategyGroups.length} {strategyGroups.length === 1 ? 'strategy' : 'strategies'}
                                    ({pagination.total} {activeFilter === 'all' ? 'total' : activeFilter} orders)
                                </span>
                                <span>Page {pagination.page} of {pagination.totalPages}</span>
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <div className="h-1.5 w-1.5 bg-success rounded-full animate-pulse" />
                                        <div className="absolute inset-0 h-1.5 w-1.5 bg-success/40 rounded-full animate-ping" />
                                        <div className="absolute inset-[-1px] h-2.5 w-2.5 bg-success/20 rounded-full blur-sm animate-pulse" />
                                    </div>
                                    <span className="animate-pulse">Live monitoring</span>
                                </div>
                            </div>
                        </div>

                        {/* Search and filter controls */}
                        <div className={embedded ? "flex flex-col sm:flex-row sm:items-center gap-4" : "flex flex-col lg:flex-row lg:items-center gap-4"}>
                            {/* Search input */}
                            <div className="relative flex-1 lg:max-w-sm">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-muted w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Search orders, addresses, tokens..."
                                    value={searchQuery}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    disabled={loading}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface border border-line text-ink text-sm placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-line-strong focus:border-line-strong transition-all duration-200 disabled:opacity-50"
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
                                            ? 'bg-surface-hover text-ink border border-line-strong shadow-lg backdrop-blur-sm'
                                            : 'text-ink-muted hover:text-ink hover:bg-surface border border-transparent'
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
                            <div key={i} className="group relative p-6 rounded-2xl border border-line bg-surface backdrop-blur-sm animate-pulse">
                                <div className="relative space-y-4">
                                    {/* Header row */}
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-2">
                                            <div className="h-4 w-16 bg-surface-hover rounded-lg" />
                                            <div className="h-3 w-20 bg-surface rounded-lg" />
                                        </div>
                                        <div className="h-6 w-20 bg-surface-hover rounded-full" />
                                    </div>
                                    {/* Swap row */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 bg-surface-hover rounded-full" />
                                            <div className="h-4 w-12 bg-surface-hover rounded-lg" />
                                            <div className="h-4 w-6 bg-surface rounded-lg" />
                                            <div className="h-8 w-8 bg-surface-hover rounded-full" />
                                            <div className="h-4 w-12 bg-surface-hover rounded-lg" />
                                        </div>
                                        <div className="h-4 w-24 bg-surface-hover rounded-lg" />
                                    </div>
                                    {/* Condition row */}
                                    <div className="flex items-center justify-between">
                                        <div className="h-4 w-48 bg-surface-hover rounded-lg" />
                                        <div className="flex gap-2">
                                            <div className="h-8 w-8 bg-surface-hover rounded-xl" />
                                            <div className="h-8 w-8 bg-surface-hover rounded-xl" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {error && <p className="text-sm text-danger mb-4">{error}</p>}

                {/* Content area with loading overlay support */}
                <div className="relative">
                    {!loading && (strategyGroups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-ink-muted">
                            <div className="relative mb-6">
                                <div className="h-16 w-16 rounded-2xl bg-surface border border-line flex items-center justify-center">
                                    <ClipboardList className="h-8 w-8 text-ink-faint" />
                                </div>
                            </div>
                            <h3 className="text-lg font-medium text-ink-body mb-2">{displayOrders.length === 0 ? 'No orders yet' : 'No matching orders'}</h3>
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
                                        onCancelOrders={(uuids) => setConfirmBulk(uuids)}
                                        copiedId={copiedId}
                                        formatTokenAmount={formatTokenAmount}
                                    />
                                );
                            })}
                        </div>
                    ))}

                    {/* Loading overlay during filter changes */}
                    {paginationLoading && (
                        <div className="absolute inset-0 bg-surface/60 backdrop-blur-[1px] flex items-center justify-center rounded-2xl z-10">
                            <div className="flex items-center gap-3 text-sm text-ink-body">
                                <div className="h-5 w-5 border-2 border-line-strong border-t-ink/80 rounded-full animate-spin" />
                                <span>Updating orders...</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>


            {/* Premium cancel confirmation dialog */}
            {confirmUuid && (
                <Dialog open onOpenChange={(open) => { if (!open) setConfirmUuid(null); }}>
                    <DialogContent className="border-line bg-surface-raised">
                        <DialogHeader>
                            <DialogTitle className="text-ink">Cancel Order</DialogTitle>
                            <DialogDescription className="text-ink-muted">
                                Are you sure you want to cancel this limit order? This action cannot be undone.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="flex justify-end gap-3 pt-4">
                            <Button
                                variant="outline"
                                onClick={() => setConfirmUuid(null)}
                                className="border-line bg-surface text-ink-body hover:bg-surface-hover hover:text-ink"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => cancelOrder(confirmUuid)}
                                className="bg-danger/[0.15] border border-danger/[0.3] text-danger hover:bg-danger/[0.25] hover:border-danger/[0.5]"
                            >
                                Confirm Cancellation
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* Bulk cancel confirmation dialog */}
            {confirmBulk && (
                <Dialog open onOpenChange={(open) => { if (!open) setConfirmBulk(null); }}>
                    <DialogContent className="border-line bg-surface-raised">
                        <DialogHeader>
                            <DialogTitle className="text-ink">Cancel Orders</DialogTitle>
                            <DialogDescription className="text-ink-muted">
                                Cancel {confirmBulk.length} open orders? Each one needs a wallet signature, one after another. Filled legs are kept.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="flex justify-end gap-3 pt-4">
                            <Button
                                variant="outline"
                                onClick={() => setConfirmBulk(null)}
                                className="border-line bg-surface text-ink-body hover:bg-surface-hover hover:text-ink"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => cancelOrders(confirmBulk).finally(() => setConfirmBulk(null))}
                                className="bg-danger/[0.15] border border-danger/[0.3] text-danger hover:bg-danger/[0.25] hover:border-danger/[0.5]"
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
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    MoreHorizontal,
    ExternalLink,
    Copy,
    Trash2,
    Play,
    Pause,
    Eye,
    ArrowUpDown,
    Clock,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Timer,
    TrendingUp,
    TrendingDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatLocalDateTime, formatRelativeTime } from '@/lib/admin-config';
import type { LimitOrder } from '@/lib/orders/types';
import { getTokenMetadataCached, TokenCacheData, listPrices } from '@repo/tokens';
import { classifyOrderType } from '@/lib/orders/classification';
import PremiumPagination, { type PaginationInfo } from '../orders/premium-pagination';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

interface EnrichedOrder {
    id: string;
    order: LimitOrder;
    inputTokenMeta: TokenCacheData;
    outputTokenMeta: TokenCacheData;
    conditionTokenMeta: TokenCacheData;
}

interface DisplayOrder {
    id: string;
    type: 'single' | 'dca' | 'perpetual' | 'sandwich';
    status: 'open' | 'broadcasted' | 'confirmed' | 'failed' | 'cancelled' | 'filled';
    owner: string;
    ownerFull: string;
    inputToken: string;
    outputToken: string;
    inputTokenSymbol: string;
    outputTokenSymbol: string;
    amount: string;
    amountFormatted: string;
    targetPrice: string;
    currentPrice: string;
    direction: 'buy' | 'sell' | 'long' | 'short';
    volume: string;
    createdAt: string;
    updatedAt: string;
    txHash?: string;
    fillPercent?: number;
    estimatedGas?: string;
    priority: 'low' | 'medium' | 'high';
    blockHeight?: number;
    blockTime?: number;
    confirmedAt?: string;
    failedAt?: string;
    failureReason?: string;
}

// Helper function to get condition token from order structure
function getConditionTokenContract(order: LimitOrder): string {
    if (order.conditions) {
        if (order.conditions.type === 'price' || order.conditions.type === 'ratio') {
            return order.conditions.params.conditionToken || order.inputToken;
        } else if (order.conditions.type === 'dca') {
            return order.conditions.params.conditionToken || order.inputToken; // Fallback to input token for market DCA
        } else if (order.conditions.type === 'manual') {
            return order.inputToken; // Manual orders use input token as condition token
        }
    }
    // Legacy order support
    return (order as any).conditionToken || order.inputToken;
}

// Convert EnrichedOrder to DisplayOrder for admin interface
function convertToDisplayOrder(
    enrichedOrder: EnrichedOrder,
    priceData: Record<string, number> = {},
    allEnrichedOrders: EnrichedOrder[] = []
): DisplayOrder {
    const { id, order, inputTokenMeta, outputTokenMeta } = enrichedOrder;

    // Parse amounts using correct decimals from token metadata
    const inputDecimals = inputTokenMeta.decimals || 6;
    const outputDecimals = outputTokenMeta.decimals || 6;

    // Use amountIn from LimitOrder (not inputAmount)
    const inputAmount = parseFloat(order.amountIn || '0') / Math.pow(10, inputDecimals);

    // Get targetPrice from conditions structure
    let targetPrice = 0;
    if (order.conditions) {
        if (order.conditions.type === 'price' || order.conditions.type === 'ratio') {
            targetPrice = parseFloat(order.conditions.params.targetPrice || '0');
        } else if (order.conditions.type === 'dca') {
            targetPrice = parseFloat(order.conditions.params.targetPrice || '0');
        } else if (order.conditions.type === 'manual') {
            targetPrice = 0; // Manual orders don't have target prices
        }
    } else {
        // Legacy order support
        targetPrice = parseFloat((order as any).targetPrice || '0');
    }

    // Calculate volume in output tokens
    let volumeInOutputTokens = 0;

    if (inputAmount > 0 && targetPrice > 0) {
        volumeInOutputTokens = inputAmount * targetPrice;
    }

    // Calculate USD estimates using price data
    const inputTokenPrice = priceData[order.inputToken] || 0;
    const outputTokenPrice = priceData[order.outputToken] || 0;

    let usdEstimate = 0;
    if (volumeInOutputTokens > 0 && outputTokenPrice > 0) {
        // Use output token volume × output token USD price
        usdEstimate = volumeInOutputTokens * outputTokenPrice;
    } else if (inputAmount > 0 && inputTokenPrice > 0) {
        // Fallback: use input amount × input token USD price  
        usdEstimate = inputAmount * inputTokenPrice;
    }

    // Fallback: if we can't calculate output tokens, show input amount value
    const fallbackVolume = inputAmount;

    // Format owner address
    const shortOwner = order.owner.length > 20
        ? `${order.owner.slice(0, 8)}...${order.owner.slice(-4)}`
        : order.owner;

    // Determine direction based on conditions structure
    let direction: 'buy' | 'sell' | 'long' | 'short' = 'buy';
    if (order.conditions) {
        if (order.conditions.type === 'price' || order.conditions.type === 'ratio') {
            direction = order.conditions.params.direction === 'gt' ? 'sell' : 'buy';
        } else if (order.conditions.type === 'dca') {
            direction = order.conditions.params.direction === 'gt' ? 'sell' : 'buy';
        } else if (order.conditions.type === 'manual') {
            direction = 'buy'; // Default to buy for manual orders since no direction specified
        }
    } else {
        // Legacy order support
        direction = (order as any).direction === 'gt' ? 'sell' : 'buy';
    }

    // Handle legacy 'filled' status for migration
    const displayStatus = (order.status as any) === 'filled' ? 'broadcasted' : order.status;

    // Classify order type using the classification utility
    const allOrdersWithMeta = allEnrichedOrders.map(e => ({
        ...e.order,
        inputTokenMeta: e.inputTokenMeta,
        outputTokenMeta: e.outputTokenMeta
    }));
    const orderType = classifyOrderType({
        ...order,
        inputTokenMeta,
        outputTokenMeta
    }, allOrdersWithMeta);

    return {
        id: order.uuid, // Use the actual order UUID, not the hash key
        type: orderType,
        status: displayStatus,
        owner: shortOwner,
        ownerFull: order.owner,
        inputToken: order.inputToken,
        outputToken: order.outputToken,
        inputTokenSymbol: inputTokenMeta.symbol || 'UNK',
        outputTokenSymbol: outputTokenMeta.symbol || 'UNK',
        amount: inputAmount.toFixed(inputDecimals > 2 ? 2 : inputDecimals),
        amountFormatted: `${inputAmount.toLocaleString()} ${inputTokenMeta.symbol || 'UNK'}`,
        targetPrice: targetPrice.toFixed(6),
        currentPrice: targetPrice.toFixed(6), // TODO: Get real current price
        direction,
        volume: volumeInOutputTokens > 0
            ? `${volumeInOutputTokens.toFixed(2)} ${outputTokenMeta.symbol || 'UNK'}${usdEstimate > 0 ? ` (~$${usdEstimate.toFixed(2)})` : ''}`
            : fallbackVolume > 0
                ? `${fallbackVolume.toFixed(2)} ${inputTokenMeta.symbol || 'UNK'}${usdEstimate > 0 ? ` (~$${usdEstimate.toFixed(2)})` : ''}`
                : 'N/A',
        createdAt: order.createdAt,
        updatedAt: order.createdAt, // LimitOrder doesn't have updatedAt
        txHash: order.txid,
        priority: 'medium',
        blockHeight: order.blockHeight,
        blockTime: order.blockTime,
        confirmedAt: order.confirmedAt,
        failedAt: order.failedAt,
        failureReason: order.failureReason
    };
}

async function fetchAndEnrichOrders(
    page: number = 1,
    limit: number = 20,
    sortBy: 'createdAt' | 'status' = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
    statusFilter?: string,
    searchQuery?: string
): Promise<{ orders: DisplayOrder[], pagination: PaginationInfo }> {
    try {
        // Build query parameters
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
            sortBy,
            sortOrder
        });

        if (statusFilter && statusFilter !== 'all') {
            params.append('status', statusFilter);
        }

        if (searchQuery && searchQuery.trim()) {
            params.append('search', searchQuery.trim());
        }

        const [ordersResponse, priceData] = await Promise.all([
            fetch(`/api/v1/orders?${params}`),
            listPrices().catch(() => ({})) // Fallback to empty object if prices fail
        ]);

        const data = await ordersResponse.json();

        if (data.status !== 'success') {
            throw new Error('Failed to fetch orders');
        }

        const orders = data.data as LimitOrder[];
        const pagination = data.pagination as PaginationInfo;

        if (orders.length === 0) {
            return {
                orders: [],
                pagination: pagination || {
                    total: 0,
                    page: 1,
                    limit: 20,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPrevPage: false
                }
            };
        }

        // Enrich orders with token metadata
        const enrichedOrders: EnrichedOrder[] = [];

        for (const order of orders) {
            try {
                const conditionTokenContract = getConditionTokenContract(order);
                
                // Skip fetching metadata for non-existent "*" token
                const conditionTokenMetaPromise = conditionTokenContract === "*" 
                    ? Promise.resolve({
                        type: 'token' as const,
                        contractId: '*',
                        name: 'No Price Trigger',
                        symbol: '*',
                        decimals: 6,
                        identifier: '*'
                    })
                    : getTokenMetadataCached(conditionTokenContract);
                
                const [inputTokenMeta, outputTokenMeta, conditionTokenMeta] = await Promise.all([
                    getTokenMetadataCached(order.inputToken),
                    getTokenMetadataCached(order.outputToken),
                    conditionTokenMetaPromise
                ]);

                enrichedOrders.push({
                    id: order.uuid,
                    order,
                    inputTokenMeta,
                    outputTokenMeta,
                    conditionTokenMeta
                });
            } catch (metaError) {
                console.error(`Failed to fetch metadata for order ${order.uuid}:`, metaError);
                // Create fallback metadata
                const fallbackMeta: TokenCacheData = {
                    type: 'token',
                    contractId: '',
                    name: 'Unknown Token',
                    symbol: 'UNK',
                    decimals: 6,
                    identifier: ''
                };

                const conditionTokenContract = getConditionTokenContract(order);
                
                // Create appropriate fallback for condition token
                const conditionTokenFallback = conditionTokenContract === "*" 
                    ? {
                        type: 'token' as const,
                        contractId: '*',
                        name: 'No Price Trigger',
                        symbol: '*',
                        decimals: 6,
                        identifier: '*'
                    }
                    : { ...fallbackMeta, contractId: conditionTokenContract };
                
                enrichedOrders.push({
                    id: order.uuid,
                    order,
                    inputTokenMeta: { ...fallbackMeta, contractId: order.inputToken },
                    outputTokenMeta: { ...fallbackMeta, contractId: order.outputToken },
                    conditionTokenMeta: conditionTokenFallback
                });
            }
        }

        return {
            orders: enrichedOrders.map(enrichedOrder => convertToDisplayOrder(enrichedOrder, priceData, enrichedOrders)),
            pagination
        };

    } catch (error) {
        console.error('Failed to fetch orders:', error);
        return {
            orders: [],
            pagination: {
                total: 0,
                page: 1,
                limit: 20,
                totalPages: 0,
                hasNextPage: false,
                hasPrevPage: false
            }
        };
    }
}


const StatusBadge = ({ status }: { status: DisplayOrder['status'] }) => {
    const config = {
        open: { icon: Clock, color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Open' },
        broadcasted: { icon: Timer, color: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Broadcasted' },
        confirmed: { icon: CheckCircle, color: 'bg-green-100 text-green-700 border-green-200', label: 'Confirmed' },
        filled: { icon: CheckCircle, color: 'bg-green-100 text-green-700 border-green-200', label: 'Filled' },
        failed: { icon: AlertTriangle, color: 'bg-red-100 text-red-700 border-red-200', label: 'Failed' },
        cancelled: { icon: XCircle, color: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Cancelled' }
    };

    const { icon: Icon, color, label } = config[status];

    return (
        <Badge variant="outline" className={`${color} gap-1`}>
            <Icon className="w-3 h-3" />
            {label}
        </Badge>
    );
};

const TypeBadge = ({ type }: { type: DisplayOrder['type'] }) => {
    const config = {
        single: { color: 'bg-blue-50 text-blue-600 border-blue-200', label: 'LIMIT' },
        dca: { color: 'bg-green-50 text-green-600 border-green-200', label: 'DCA' },
        perpetual: { color: 'bg-purple-50 text-purple-600 border-purple-200', label: 'PERP' },
        sandwich: { color: 'bg-orange-50 text-orange-600 border-orange-200', label: 'SANDWICH' }
    };

    return (
        <Badge variant="outline" className={config[type].color}>
            {config[type].label}
        </Badge>
    );
};

const PriorityIndicator = ({ priority }: { priority: DisplayOrder['priority'] }) => {
    const colors = {
        low: 'bg-gray-400',
        medium: 'bg-yellow-400',
        high: 'bg-red-400'
    };

    return (
        <div className={`w-2 h-2 rounded-full ${colors[priority]}`} title={`${priority} priority`} />
    );
};

// Transaction Status Component for orders with transactions
const TransactionStatus = ({ txHash, status, order }: {
    txHash?: string;
    status: DisplayOrder['status'];
    order: DisplayOrder;
}) => {
    if (!txHash) return null;

    // Show status based on order status, not the hook
    switch (status) {
        case 'broadcasted':
            return (
                <div className="flex items-center gap-1 mt-1">
                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                    <span className="text-xs text-amber-400">Broadcasting...</span>
                </div>
            );
        case 'confirmed':
            return (
                <div className="flex items-center gap-1 mt-1">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                    <span className="text-xs text-emerald-400">
                        Confirmed {order.blockHeight ? `at block ${order.blockHeight}` : ''}
                    </span>
                </div>
            );
        case 'failed':
            return (
                <div className="flex items-center gap-1 mt-1">
                    <div className="w-2 h-2 bg-red-400 rounded-full" />
                    <span className="text-xs text-red-400">
                        Failed: {order.failureReason || 'Unknown reason'}
                    </span>
                </div>
            );
        default:
            return null;
    }
};

export function OrdersTable() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const [sortField, setSortField] = useState<string>('createdAt');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
    const [orders, setOrders] = useState<DisplayOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [paginationLoading, setPaginationLoading] = useState(false);

    // Pagination state
    const [pagination, setPagination] = useState<PaginationInfo>({
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false
    });

    // Current filter state from URL
    const currentStatusFilter = searchParams?.get('status') || 'all';
    const currentSearchQuery = searchParams?.get('search') || '';

    // Initialize pagination from URL params
    useEffect(() => {
        const urlPage = searchParams?.get('page');
        const urlLimit = searchParams?.get('limit');

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
    }, [searchParams]);

    const loadOrders = useCallback(async (usePagination = true) => {
        const isInitialLoad = orders.length === 0;
        if (isInitialLoad) {
            setLoading(true);
        } else {
            setPaginationLoading(true);
        }

        try {
            const result = await fetchAndEnrichOrders(
                pagination.page,
                pagination.limit,
                sortField as 'createdAt' | 'status',
                sortDirection,
                currentStatusFilter,
                currentSearchQuery
            );
            setOrders(result.orders);
            setPagination(result.pagination);
        } finally {
            setLoading(false);
            setPaginationLoading(false);
        }
    }, [pagination.page, pagination.limit, sortField, sortDirection, currentStatusFilter, currentSearchQuery, orders.length]);

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const handleSelectOrder = (orderId: string) => {
        const newSelected = new Set(selectedOrders);
        if (newSelected.has(orderId)) {
            newSelected.delete(orderId);
        } else {
            newSelected.add(orderId);
        }
        setSelectedOrders(newSelected);
    };

    const handleSelectAll = () => {
        if (selectedOrders.size === orders.length) {
            setSelectedOrders(new Set());
        } else {
            setSelectedOrders(new Set(orders.map(order => order.id)));
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        // You could add a toast notification here
    };

    const handleBulkCancel = async () => {
        if (selectedOrders.size === 0) return;

        // TODO: Implement bulk cancel API call
        console.log('Cancelling orders:', Array.from(selectedOrders));
        // For now, just clear selection
        setSelectedOrders(new Set());
    };

    const handleBulkExport = () => {
        if (selectedOrders.size === 0) return;

        const selectedData = orders.filter(order => selectedOrders.has(order.id));
        const csvContent = "data:text/csv;charset=utf-8,"
            + "ID,Status,Owner,Pair,Amount,Target Price,Volume,Created\n"
            + selectedData.map(order =>
                `${order.id},${order.status},${order.owner},"${order.inputTokenSymbol}→${order.outputTokenSymbol}",${order.amountFormatted},${order.targetPrice},${order.volume},${order.createdAt}`
            ).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `orders_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setSelectedOrders(new Set());
    };

    const handleRefresh = async () => {
        await loadOrders();
    };

    const handlePageChange = (page: number) => {
        const params = new URLSearchParams(searchParams?.toString());
        params.set('page', page.toString());
        router.push(`${pathname}?${params.toString()}`);
    };

    const handleLimitChange = (limit: number) => {
        const params = new URLSearchParams(searchParams?.toString());
        params.set('limit', limit.toString());
        params.set('page', '1'); // Reset to first page when changing limit
        router.push(`${pathname}?${params.toString()}`);
    };

    const SortButton = ({ field, children }: { field: string; children: React.ReactNode }) => (
        <button
            onClick={() => handleSort(field)}
            className="flex items-center gap-1 hover:text-foreground transition-colors group"
        >
            {children}
            <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
        </button>
    );

    return (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
            {/* Table Header */}
            <div className="px-6 py-4 border-b border-border bg-muted/20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h3 className="text-lg font-semibold">Orders</h3>
                        <span className="text-sm text-muted-foreground">
                            {loading ? 'Loading...' : `${orders.length} total orders`}
                        </span>
                        {selectedOrders.size > 0 && (
                            <span className="text-sm text-primary font-medium">
                                {selectedOrders.size} selected
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {selectedOrders.size > 0 && (
                            <>
                                <Button variant="outline" size="sm" onClick={handleBulkCancel}>
                                    Cancel Selected
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleBulkExport}>
                                    Export Selected
                                </Button>
                            </>
                        )}
                        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                            {loading ? 'Refreshing...' : 'Refresh'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-muted/10">
                        <tr className="border-b border-border">
                            <th className="text-left p-4">
                                <input
                                    type="checkbox"
                                    checked={selectedOrders.size === orders.length && orders.length > 0}
                                    onChange={handleSelectAll}
                                    className="rounded border-border"
                                    disabled={loading}
                                />
                            </th>
                            <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                                <SortButton field="id">Order ID</SortButton>
                            </th>
                            <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                                <SortButton field="type">Type</SortButton>
                            </th>
                            <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                                <SortButton field="status">Status</SortButton>
                            </th>
                            <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                                <SortButton field="owner">Owner</SortButton>
                            </th>
                            <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                                <SortButton field="pair">Pair</SortButton>
                            </th>
                            <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                                <SortButton field="amount">Amount</SortButton>
                            </th>
                            <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                                <SortButton field="targetPrice">Target Price</SortButton>
                            </th>
                            <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                                <SortButton field="volume">Volume</SortButton>
                            </th>
                            <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                                <SortButton field="createdAt">Created</SortButton>
                            </th>
                            <th className="text-right p-4 text-sm font-medium text-muted-foreground">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            [...Array(5)].map((_, i) => (
                                <tr key={i} className="border-b border-border">
                                    <td colSpan={11} className="p-4">
                                        <div className="h-16 bg-muted/20 rounded animate-pulse" />
                                    </td>
                                </tr>
                            ))
                        ) : orders.length === 0 ? (
                            <tr>
                                <td colSpan={11} className="p-8 text-center text-muted-foreground">
                                    No orders found
                                </td>
                            </tr>
                        ) : (
                            orders.map((order) => (
                                <tr key={order.id} className="border-b border-border hover:bg-muted/5 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={selectedOrders.has(order.id)}
                                                onChange={() => handleSelectOrder(order.id)}
                                                className="rounded border-border"
                                            />
                                            <PriorityIndicator priority={order.priority} />
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                                                {order.id.length > 12 ? `${order.id.slice(0, 8)}...${order.id.slice(-4)}` : order.id}
                                            </code>
                                            <button
                                                onClick={() => copyToClipboard(order.id)}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                                            </button>
                                        </div>
                                        <TransactionStatus txHash={order.txHash} status={order.status} order={order} />
                                    </td>
                                    <td className="p-4">
                                        <TypeBadge type={order.type} />
                                    </td>
                                    <td className="p-4">
                                        <StatusBadge status={order.status} />
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <code className="text-sm font-mono text-muted-foreground">
                                                {order.owner}
                                            </code>
                                            <button
                                                onClick={() => copyToClipboard(order.ownerFull)}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm">{order.inputTokenSymbol}</span>
                                            <div className="flex items-center gap-1">
                                                {order.direction === 'buy' ? (
                                                    <TrendingUp className="w-3 h-3 text-green-500" />
                                                ) : (
                                                    <TrendingDown className="w-3 h-3 text-red-500" />
                                                )}
                                            </div>
                                            <span className="text-muted-foreground text-sm">{order.outputTokenSymbol}</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {order.direction === 'buy' ? 'Buy' : 'Sell'} Order
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="text-sm">
                                            <div className="font-medium">{order.amountFormatted}</div>
                                            {order.fillPercent && (
                                                <div className="text-xs text-muted-foreground">
                                                    {order.fillPercent}% filled
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="text-sm">
                                            <div className="font-medium">{order.targetPrice} {order.outputTokenSymbol}</div>
                                            <div className="text-xs text-muted-foreground">
                                                per {order.inputTokenSymbol}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="font-medium">{order.volume}</span>
                                    </td>
                                    <td className="p-4">
                                        <div className="text-sm">
                                            <div className="font-medium">
                                                {formatRelativeTime(order.createdAt)}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {formatLocalDateTime(order.createdAt, 'compact')}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center justify-end gap-2">
                                            {order.txHash && (
                                                <Button variant="ghost" size="sm" className="gap-1">
                                                    <ExternalLink className="w-3 h-3" />
                                                </Button>
                                            )}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm">
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="gap-2">
                                                        <Eye className="w-4 h-4" />
                                                        View Details
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="gap-2">
                                                        <Copy className="w-4 h-4" />
                                                        Copy Order ID
                                                    </DropdownMenuItem>
                                                    {order.status === 'open' && (
                                                        <>
                                                            <DropdownMenuItem className="gap-2">
                                                                <Pause className="w-4 h-4" />
                                                                Pause Order
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem className="gap-2">
                                                                <Play className="w-4 h-4" />
                                                                Force Execute
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="gap-2 text-red-600">
                                                        <Trash2 className="w-4 h-4" />
                                                        Cancel Order
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Table Footer with Pagination */}
            <div className="px-6 py-4 border-t border-border bg-muted/10">
                <PremiumPagination
                    pagination={pagination}
                    onPageChange={handlePageChange}
                    onLimitChange={handleLimitChange}
                    isLoading={paginationLoading}
                />
            </div>
        </div>
    );
}
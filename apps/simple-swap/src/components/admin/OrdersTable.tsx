'use client';

import React, { useState } from 'react';
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

interface Order {
    id: string;
    type: 'limit' | 'dca' | 'perpetual' | 'sandwich';
    status: 'open' | 'filled' | 'cancelled' | 'failed' | 'pending';
    owner: string;
    inputToken: string;
    outputToken: string;
    amount: string;
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
}

// Mock data - in real implementation, this would come from props or API
const mockOrders: Order[] = [
    {
        id: '0x1234...abcd',
        type: 'limit',
        status: 'open',
        owner: 'SP2ZNG...55KS',
        inputToken: 'STX',
        outputToken: 'USDT',
        amount: '1,000',
        targetPrice: '0.85',
        currentPrice: '0.82',
        direction: 'sell',
        volume: '$850',
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T10:30:00Z',
        priority: 'medium'
    },
    {
        id: '0x5678...efgh',
        type: 'dca',
        status: 'filled',
        owner: 'SP3ABC...DEF1',
        inputToken: 'USDT',
        outputToken: 'BTC',
        amount: '500',
        targetPrice: '45,000',
        currentPrice: '45,250',
        direction: 'buy',
        volume: '$22,625',
        createdAt: '2024-01-15T09:15:00Z',
        updatedAt: '2024-01-15T11:45:00Z',
        txHash: '0xabc123...def456',
        fillPercent: 100,
        priority: 'high'
    },
    {
        id: '0x9abc...ijkl',
        type: 'perpetual',
        status: 'open',
        owner: 'SP4XYZ...789A',
        inputToken: 'STX',
        outputToken: 'USDT',
        amount: '2,500',
        targetPrice: '0.90',
        currentPrice: '0.82',
        direction: 'long',
        volume: '$2,250',
        createdAt: '2024-01-15T08:00:00Z',
        updatedAt: '2024-01-15T12:00:00Z',
        priority: 'high'
    },
    {
        id: '0xdef0...mnop',
        type: 'sandwich',
        status: 'failed',
        owner: 'SP5GHI...JKL2',
        inputToken: 'CHA',
        outputToken: 'STX',
        amount: '10,000',
        targetPrice: '0.015',
        currentPrice: '0.014',
        direction: 'sell',
        volume: '$150',
        createdAt: '2024-01-15T07:30:00Z',
        updatedAt: '2024-01-15T07:35:00Z',
        priority: 'low'
    }
];

const StatusBadge = ({ status }: { status: Order['status'] }) => {
    const config = {
        open: { icon: Clock, color: 'bg-blue-100 text-blue-700 border-blue-200' },
        filled: { icon: CheckCircle, color: 'bg-green-100 text-green-700 border-green-200' },
        cancelled: { icon: XCircle, color: 'bg-gray-100 text-gray-700 border-gray-200' },
        failed: { icon: AlertTriangle, color: 'bg-red-100 text-red-700 border-red-200' },
        pending: { icon: Timer, color: 'bg-yellow-100 text-yellow-700 border-yellow-200' }
    };

    const { icon: Icon, color } = config[status];

    return (
        <Badge variant="outline" className={`${color} gap-1`}>
            <Icon className="w-3 h-3" />
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
    );
};

const TypeBadge = ({ type }: { type: Order['type'] }) => {
    const config = {
        limit: { color: 'bg-blue-50 text-blue-600 border-blue-200' },
        dca: { color: 'bg-green-50 text-green-600 border-green-200' },
        perpetual: { color: 'bg-purple-50 text-purple-600 border-purple-200' },
        sandwich: { color: 'bg-orange-50 text-orange-600 border-orange-200' }
    };

    return (
        <Badge variant="outline" className={config[type].color}>
            {type.toUpperCase()}
        </Badge>
    );
};

const PriorityIndicator = ({ priority }: { priority: Order['priority'] }) => {
    const colors = {
        low: 'bg-gray-400',
        medium: 'bg-yellow-400',
        high: 'bg-red-400'
    };

    return (
        <div className={`w-2 h-2 rounded-full ${colors[priority]}`} title={`${priority} priority`} />
    );
};

export function OrdersTable() {
    const [sortField, setSortField] = useState<string>('createdAt');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

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
        if (selectedOrders.size === mockOrders.length) {
            setSelectedOrders(new Set());
        } else {
            setSelectedOrders(new Set(mockOrders.map(order => order.id)));
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        // You could add a toast notification here
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
                            {mockOrders.length} total orders
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
                                <Button variant="outline" size="sm">
                                    Cancel Selected
                                </Button>
                                <Button variant="outline" size="sm">
                                    Export Selected
                                </Button>
                            </>
                        )}
                        <Button variant="outline" size="sm">
                            Refresh
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
                                    checked={selectedOrders.size === mockOrders.length && mockOrders.length > 0}
                                    onChange={handleSelectAll}
                                    className="rounded border-border"
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
                        {mockOrders.map((order) => (
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
                                            {order.id}
                                        </code>
                                        <button
                                            onClick={() => copyToClipboard(order.id)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                                        </button>
                                    </div>
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
                                            onClick={() => copyToClipboard(order.owner)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                                        </button>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">{order.inputToken}</span>
                                        <div className="flex items-center gap-1">
                                            {order.direction === 'buy' || order.direction === 'long' ? (
                                                <TrendingUp className="w-3 h-3 text-green-500" />
                                            ) : (
                                                <TrendingDown className="w-3 h-3 text-red-500" />
                                            )}
                                        </div>
                                        <span className="text-muted-foreground">{order.outputToken}</span>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="text-sm">
                                        <div className="font-medium">{order.amount} {order.inputToken}</div>
                                        {order.fillPercent && (
                                            <div className="text-xs text-muted-foreground">
                                                {order.fillPercent}% filled
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="text-sm">
                                        <div className="font-medium">${order.targetPrice}</div>
                                        <div className="text-xs text-muted-foreground">
                                            Current: ${order.currentPrice}
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
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Table Footer with Pagination */}
            <div className="px-6 py-4 border-t border-border bg-muted/10">
                <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                        Showing 1-{mockOrders.length} of {mockOrders.length} orders
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" disabled>
                            Previous
                        </Button>
                        <Button variant="outline" size="sm">
                            Next
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
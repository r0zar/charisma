import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Database, Clock, DollarSign, Download, Zap, Filter, Search, RefreshCw } from 'lucide-react';
import { ADMIN_CONFIG, getPageSize, getAutoRefreshSeconds } from '@/lib/admin-config';
import { InfoTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { RefreshButton } from '@/components/admin/RefreshButton';
import { SystemStatus } from '@/components/admin/SystemStatus';
import { QuickActions } from '@/components/admin/QuickActions';
import { OrdersTable } from '@/components/admin/OrdersTable';
import { OrdersStats } from '@/components/admin/OrdersStats';
import { OrdersFilters } from '@/components/admin/OrdersFilters';

export const metadata: Metadata = {
    title: 'Order Management | Simple Swap Admin',
    description: 'Monitor and manage limit orders and perpetual positions',
};

function OrdersStatsSkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-card overflow-hidden shadow rounded-lg border border-border">
                    <div className="p-5">
                        <div className="animate-pulse">
                            <div className="flex items-center">
                                <div className="w-8 h-8 bg-muted rounded-md"></div>
                                <div className="ml-5 flex-1">
                                    <div className="h-4 bg-muted rounded w-24 mb-2"></div>
                                    <div className="h-6 bg-muted rounded w-16"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function OrdersTableSkeleton() {
    return (
        <div className="bg-card rounded-lg border border-border">
            <div className="p-6 border-b border-border">
                <div className="h-6 bg-muted rounded w-48 mb-4"></div>
                <div className="flex gap-2">
                    <div className="h-10 bg-muted rounded w-32"></div>
                    <div className="h-10 bg-muted rounded w-24"></div>
                    <div className="h-10 bg-muted rounded w-28"></div>
                </div>
            </div>
            <div className="p-6">
                <div className="space-y-3">
                    {[...Array(10)].map((_, i) => (
                        <div key={i} className="h-16 bg-muted/20 rounded animate-pulse" />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function OrderManagement() {
    return (
        <div className={`mx-auto px-4 py-8 ${ADMIN_CONFIG.MAX_WIDTH.ADMIN_WIDE} w-full`}>
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-4 mb-4">
                    <Link
                        href="/admin"
                        className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Admin
                    </Link>
                </div>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-500/20 rounded-md flex items-center justify-center">
                            <Database className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-foreground">
                                Order Management
                            </h1>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                <Zap className="w-3 h-3 text-green-500" />
                                Real-time monitoring • Auto-refreshes every {getAutoRefreshSeconds()}s
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <RefreshButton />
                        <Button variant="outline" size="sm">
                            <Download className="w-4 h-4 mr-2" />
                            Export Orders
                        </Button>
                        <Button variant="outline" size="sm">
                            <Database className="w-4 h-4 mr-2" />
                            Bulk Actions
                        </Button>
                    </div>
                </div>
                <p className="text-muted-foreground">
                    Monitor limit orders, perpetual positions, and trading activity • {getPageSize()} orders per page • Advanced filtering and analytics
                </p>
            </div>

            {/* Order Statistics */}
            <Suspense fallback={<OrdersStatsSkeleton />}>
                <OrdersStats />
            </Suspense>

            {/* Main Content Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                {/* Orders Table and Filters */}
                <div className="xl:col-span-3 space-y-6">
                    {/* Filters Bar */}
                    <Suspense fallback={
                        <div className="bg-card rounded-lg border border-border p-4">
                            <div className="h-16 bg-muted/20 rounded animate-pulse" />
                        </div>
                    }>
                        <OrdersFilters />
                    </Suspense>

                    {/* Orders Table */}
                    <Suspense fallback={<OrdersTableSkeleton />}>
                        <OrdersTable />
                    </Suspense>
                </div>

                {/* Sidebar with System Info and Quick Actions */}
                <div className="space-y-6">
                    {/* System Status */}
                    <Suspense fallback={
                        <div className="bg-card rounded-lg border border-border p-6">
                            <div className="animate-pulse space-y-4">
                                <div className="h-6 bg-muted rounded w-32"></div>
                                <div className="space-y-3">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className="h-4 bg-muted rounded"></div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    }>
                        <SystemStatus />
                    </Suspense>

                    {/* Quick Actions */}
                    <QuickActions />

                    {/* Order Monitoring Stats */}
                    <div className="bg-card rounded-lg border border-border p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <h3 className="text-lg font-semibold">Order Processing</h3>
                            <InfoTooltip content="Real-time statistics about order processing performance and system health." />
                        </div>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">Processing Speed:</span>
                                    <InfoTooltip content="Average time to process and execute eligible orders. Lower is better." />
                                </div>
                                <span className="font-mono text-green-500">~2.3s</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">Success Rate:</span>
                                    <InfoTooltip content="Percentage of orders that execute successfully without errors. Higher is better." />
                                </div>
                                <span className="font-mono text-green-500">98.7%</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">Queue Length:</span>
                                    <InfoTooltip content="Number of orders currently pending execution. Lower indicates healthy processing." />
                                </div>
                                <span className="font-mono text-blue-500">3</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">Last Execution:</span>
                                    <InfoTooltip content="Time since the last order was successfully executed. Recent activity indicates healthy system." />
                                </div>
                                <span className="font-mono text-muted-foreground">12s ago</span>
                            </div>
                        </div>
                    </div>

                    {/* Order Types Breakdown */}
                    <div className="bg-card rounded-lg border border-border p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <h3 className="text-lg font-semibold">Order Types</h3>
                            <InfoTooltip content="Distribution of different order types in the system. Helps understand trading patterns." />
                        </div>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                    <span className="text-muted-foreground">Limit Orders:</span>
                                </div>
                                <span className="font-mono">847</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                    <span className="text-muted-foreground">DCA Orders:</span>
                                </div>
                                <span className="font-mono">234</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                                    <span className="text-muted-foreground">Perpetuals:</span>
                                </div>
                                <span className="font-mono">156</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                                    <span className="text-muted-foreground">Sandwich:</span>
                                </div>
                                <span className="font-mono">89</span>
                            </div>
                        </div>
                    </div>

                    {/* Execution Health */}
                    <div className="bg-card rounded-lg border border-border p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <h3 className="text-lg font-semibold">Execution Health</h3>
                            <InfoTooltip content="System health indicators for order execution pipeline. All systems operating normally." />
                        </div>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Price Oracle:</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <span className="font-mono text-green-500">Online</span>
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">DEX Connectivity:</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <span className="font-mono text-green-500">Healthy</span>
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Execution Queue:</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <span className="font-mono text-green-500">Normal</span>
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Gas Tracker:</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                    <span className="font-mono text-yellow-500">Moderate</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
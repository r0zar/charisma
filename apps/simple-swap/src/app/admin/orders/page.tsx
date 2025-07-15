'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Database, Download, Zap, RefreshCw } from 'lucide-react';
import { ADMIN_CONFIG, getPageSize } from '@/lib/admin-config';
import { InfoTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { RefreshButton } from '@/components/admin/RefreshButton';
import { OrdersTable } from '@/components/admin/OrdersTable';
import { OrdersStats } from '@/components/admin/OrdersStats';
import { OrdersFilters } from '@/components/admin/OrdersFilters';
import { TransactionMonitoringStats } from '@/components/admin/TransactionMonitoringStats';
import { OrderTypesBreakdown } from '@/components/admin/OrderTypesBreakdown';

// Shared stats interface
interface AdminStats {
    totalOrders: number;
    ordersNeedingMonitoring: number;
    pendingTransactions: number;
    confirmedTransactions: number;
    failedTransactions: number;
    orderTypes: {
        single: number;
        dca: number;
        sandwich: number;
    };
}

async function fetchAdminStats(): Promise<AdminStats> {
    const TX_MONITOR_URL = process.env.NEXT_PUBLIC_TX_MONITOR_URL || 'http://localhost:3012';
    const response = await fetch(`${TX_MONITOR_URL}/api/v1/queue/stats`);
    const data = await response.json();

    if (data.success) {
        // Map tx-monitor stats to the expected format
        const stats = data.data;
        return {
            totalOrders: stats.totalTransactions || 0,
            ordersNeedingMonitoring: stats.queueSize || 0,
            pendingTransactions: stats.pendingCount || 0,
            confirmedTransactions: stats.confirmedCount || 0,
            failedTransactions: stats.failedCount || 0,
            processingHealth: stats.processingHealth || 'error',
            lastCheckTime: stats.lastChecked,
            txMonitor: {
                queueSize: stats.queueSize || 0,
                totalProcessed: stats.totalProcessed || 0,
                totalFailed: stats.failedCount || 0,
                totalSuccessful: stats.confirmedCount || 0,
                processingHealth: stats.processingHealth || 'error'
            },
            orderTypes: {
                single: 0, // These would need to be calculated separately if needed
                dca: 0,
                sandwich: 0
            }
        };
    }

    throw new Error('Failed to fetch admin stats');
}

// Metadata moved to layout or parent component since this is now a client component

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
    const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadStats = async () => {
        try {
            setLoading(true);
            setError(null);
            const stats = await fetchAdminStats();
            setAdminStats(stats);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load stats');
            console.error('Failed to load admin stats:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStats();

        // Auto-refresh disabled - users can manually refresh using the refresh button
        // const interval = setInterval(loadStats, 30000);
        // return () => clearInterval(interval);
    }, []);

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
                                Real-time monitoring • Use refresh button to update data
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <RefreshButton />
                        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                            <Download className="w-4 h-4 mr-2" />
                            Export All Orders
                        </Button>
                        <Button variant="outline" size="sm" onClick={async () => {
                            try {
                                const TX_MONITOR_URL = process.env.NEXT_PUBLIC_TX_MONITOR_URL || 'http://localhost:3012';
                                const response = await fetch(`${TX_MONITOR_URL}/api/v1/admin/trigger`, { method: 'POST' });
                                if (response.ok) {
                                    alert('Transaction monitoring triggered successfully');
                                } else {
                                    alert('Failed to trigger transaction monitoring');
                                }
                            } catch (error) {
                                alert('Error triggering transaction monitoring');
                            }
                        }}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Check Transactions
                        </Button>
                    </div>
                </div>
                <p className="text-muted-foreground">
                    Monitor limit orders, perpetual positions, and trading activity • {getPageSize()} orders per page • Advanced filtering and analytics
                </p>
            </div>

            {/* Order Statistics */}
            {loading ? (
                <OrdersStatsSkeleton />
            ) : error ? (
                <div className="mb-8 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-destructive">Error loading stats: {error}</p>
                </div>
            ) : adminStats ? (
                <OrdersStats stats={adminStats} />
            ) : null}

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

                {/* Sidebar with Monitoring Stats */}
                <div className="space-y-6">

                    {/* Transaction Monitoring Stats */}
                    {loading ? (
                        <div className="bg-card rounded-lg border border-border p-6">
                            <div className="animate-pulse space-y-4">
                                <div className="h-6 bg-muted rounded w-48"></div>
                                <div className="space-y-3">
                                    {[...Array(4)].map((_, i) => (
                                        <div key={i} className="h-4 bg-muted rounded"></div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : adminStats ? (
                        <TransactionMonitoringStats stats={adminStats as any} />
                    ) : null}

                    {/* Order Types Breakdown */}
                    {loading ? (
                        <div className="bg-card rounded-lg border border-border p-6">
                            <div className="animate-pulse space-y-4">
                                <div className="h-6 bg-muted rounded w-32"></div>
                                <div className="space-y-3">
                                    {[...Array(4)].map((_, i) => (
                                        <div key={i} className="h-4 bg-muted rounded"></div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : adminStats ? (
                        <OrderTypesBreakdown stats={adminStats} />
                    ) : null}

                    {/* System Status */}
                    <div className="bg-card rounded-lg border border-border p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <h3 className="text-lg font-semibold">System Status</h3>
                            <InfoTooltip content="Real-time status of key system components and monitoring processes." />
                        </div>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Transaction Monitoring:</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <span className="font-mono text-green-500">Active</span>
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Order Processing:</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <span className="font-mono text-green-500">Operational</span>
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">API Health:</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <span className="font-mono text-green-500">Healthy</span>
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Database:</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <span className="font-mono text-green-500">Connected</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
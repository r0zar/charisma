import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, Download, Zap } from 'lucide-react';
import { ADMIN_CONFIG, getPageSize } from '@/lib/admin-config';
import { Button } from '@/components/ui/button';
import { PriceStats } from '@/components/admin/PriceStats';
import { PriceMatrix } from '@/components/admin/PriceMatrix';
import { RefreshButton } from '@/components/admin/RefreshButton';
import { SystemStatus } from '@/components/admin/SystemStatus';
import { QuickActions } from '@/components/admin/QuickActions';

export const metadata: Metadata = {
    title: 'Price Dashboard | Simple Swap Admin',
    description: 'Monitor and manage historic price data for tokens',
};

function PriceStatsSkeleton() {
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

export default function PriceDashboard() {
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
                        <div className="w-8 h-8 bg-primary/20 rounded-md flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-foreground">
                                Price Data Matrix
                            </h1>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                <Zap className="w-3 h-3 text-green-500" />
                                Optimized for performance • Paginated loading
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <RefreshButton />
                        <Button variant="outline">
                            <Download className="w-4 h-4 mr-2" />
                            Export
                        </Button>
                    </div>
                </div>
                <p className="text-muted-foreground">
                    Comprehensive price data matrix for tracked tokens • Loads {getPageSize()} tokens per page
                </p>
            </div>

            {/* Stats Overview */}
            <Suspense fallback={<PriceStatsSkeleton />}>
                <PriceStats />
            </Suspense>

            {/* Data Matrix View */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                {/* Main Price Matrix */}
                <div className="xl:col-span-3">
                    <Suspense fallback={
                        <div className="bg-card rounded-lg border border-border p-6">
                            <div className="space-y-3">
                                {[...Array(15)].map((_, i) => (
                                    <div key={i} className="h-16 bg-muted/20 rounded animate-pulse" />
                                ))}
                            </div>
                        </div>
                    }>
                        <PriceMatrix />
                    </Suspense>
                </div>

                {/* Sidebar with Additional Info */}
                <div className="space-y-6">
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

                    <QuickActions />
                </div>
            </div>
        </div>
    );
} 
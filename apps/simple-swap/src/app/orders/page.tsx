"use client";

import { Suspense } from "react";
import { Header } from "@/components/layout/header";
import { Footer } from '@/components/layout/footer';
import OrdersPanel from "@/components/orders/orders-panel";

function OrdersPanelFallback() {
    return (
        <div className="sm:container max-w-6xl mx-auto px-2 py-4 sm:px-4 sm:py-8">
            <div className="space-y-6">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="group relative p-6 rounded-2xl border border-line bg-surface backdrop-blur-sm animate-pulse">
                        <div className="relative space-y-4">
                            <div className="flex items-start justify-between">
                                <div className="space-y-2">
                                    <div className="h-4 w-16 bg-surface-hover rounded-lg" />
                                    <div className="h-3 w-20 bg-surface rounded-lg" />
                                </div>
                                <div className="h-6 w-20 bg-surface-hover rounded-full" />
                            </div>
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
        </div>
    );
}

export default function OrdersPage() {
    return (
        <div className="relative flex flex-col min-h-screen">
            <Header />
            <Suspense fallback={<OrdersPanelFallback />}>
                <OrdersPanel />
            </Suspense>
            <Footer />
        </div>
    );
} 
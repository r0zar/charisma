"use client";

import { Suspense } from "react";
import { Header } from "@/components/layout/header";
import OrdersPanel from "@/components/orders/orders-panel";

function OrdersPanelFallback() {
    return (
        <div className="sm:container max-w-6xl mx-auto px-2 py-4 sm:px-4 sm:py-8">
            <div className="space-y-6">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="group relative p-6 rounded-2xl border border-white/[0.08] bg-black/20 backdrop-blur-sm animate-pulse">
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                        <div className="relative space-y-4">
                            <div className="flex items-start justify-between">
                                <div className="space-y-2">
                                    <div className="h-4 w-16 bg-white/[0.06] rounded-lg" />
                                    <div className="h-3 w-20 bg-white/[0.04] rounded-lg" />
                                </div>
                                <div className="h-6 w-20 bg-white/[0.06] rounded-full" />
                            </div>
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
        </div>
    );
} 
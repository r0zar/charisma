'use client';

import React, { useState, Suspense } from 'react';
import SwapInterface from '@/components/swap-interface/swap-interface';
import SwapInterfaceContent from '@/components/swap-interface/swap-interface-content';
import { Header } from '@/components/layout/header';
import { SwapTokensProvider, useSwapTokens } from '@/contexts/swap-tokens-context';
import { OrderConditionsProvider } from '@/contexts/order-conditions-context';
import { WalletBalanceProvider } from '@/contexts/wallet-balance-context';
import { SwapInformationSidebar } from '@/components/swap-interface/swap-information-sidebar';
import { RouteIntelligenceSidebar } from '@/components/swap-interface/route-intelligence-sidebar';
import { X, BarChart3, Info } from 'lucide-react';

interface SwapPageClientProps {
    tokens: any[];
    searchParams: { [key: string]: string | string[] | undefined };
    initialBalances?: import('@services/balances/src/types').BulkBalanceResponse;
}

// Wrapper component that provides OrderConditionsProvider with tokens from SwapTokensProvider
function SwapPageWithProviders({ children }: { children: React.ReactNode }) {
    const { selectedTokens, isLoadingTokens } = useSwapTokens();

    // Don't render the provider until tokens are loaded
    if (isLoadingTokens || !selectedTokens || selectedTokens.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="h-6 w-6 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <OrderConditionsProvider availableTokens={selectedTokens}>
            {children}
        </OrderConditionsProvider>
    );
}

export default function SwapPageClient({ tokens, searchParams, initialBalances }: SwapPageClientProps) {
    const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
    const [rightSidebarOpen, setRightSidebarOpen] = useState(false);

    // Convert searchParams to URLSearchParams for consistency
    const urlSearchParams = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
        if (typeof value === 'string') {
            urlSearchParams.set(key, value);
        } else if (Array.isArray(value)) {
            urlSearchParams.set(key, value[0] || '');
        }
    });

    return (
        <SwapTokensProvider initialTokens={tokens} searchParams={urlSearchParams}>
            {/* Wrap with balance provider that has initial balance data */}
            <WalletBalanceProvider initialServiceBalances={initialBalances}>
                <SwapPageWithProviders>
                <div className="relative flex flex-col h-screen">
                    <Header />

                    {/* Mobile Sidebar Toggle Buttons */}
                    <div className="lg:hidden xl:hidden flex items-center justify-between p-4 border-b border-white/[0.08] bg-black/20 backdrop-blur-sm">
                        <button
                            onClick={() => setLeftSidebarOpen(true)}
                            className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/70 hover:text-white/90 hover:bg-white/[0.08] transition-all duration-200"
                        >
                            <BarChart3 className="w-4 h-4" />
                            <span className="text-sm">Route Intelligence</span>
                        </button>
                        <button
                            onClick={() => setRightSidebarOpen(true)}
                            className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/70 hover:text-white/90 hover:bg-white/[0.08] transition-all duration-200"
                        >
                            <Info className="w-4 h-4" />
                            <span className="text-sm">Swap Info</span>
                        </button>
                    </div>

                    <main className="flex-1 h-full">
                        <div className="flex h-full">
                            {/* Mobile Overlay */}
                            {(leftSidebarOpen || rightSidebarOpen) && (
                                <div
                                    className="fixed inset-0 bg-black/80 backdrop-blur-xl z-40 lg:hidden xl:hidden"
                                    onClick={() => {
                                        setLeftSidebarOpen(false);
                                        setRightSidebarOpen(false);
                                    }}
                                />
                            )}

                            {/* Left Sidebar - Route Intelligence */}
                            <div className={`w-full max-w-sm sm:w-[420px] border-r border-white/[0.08] bg-black/20 backdrop-blur-sm flex-col z-50 ${leftSidebarOpen ? 'fixed inset-y-0 left-0 flex' : 'hidden lg:flex'
                                }`}>
                                <div className="p-4 border-b border-white/[0.08]">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                            <div className="h-8 w-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                                                </svg>
                                            </div>
                                            <h2 className="text-sm font-semibold text-white/95">Route Intelligence</h2>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <div className="flex items-center space-x-1">
                                                <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
                                                <span className="text-xs text-white/60">Live</span>
                                            </div>
                                            <button
                                                onClick={() => setLeftSidebarOpen(false)}
                                                className="lg:hidden h-6 w-6 rounded text-white/60 hover:text-white/90 hover:bg-white/[0.1] transition-all duration-200 flex items-center justify-center"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4">
                                    {/* Custom Route Intelligence Layout */}
                                    <RouteIntelligenceSidebar />
                                </div>
                            </div>

                            {/* Main Content */}
                            <div className="flex-1 overflow-y-auto">
                                <div className="container max-w-4xl mx-auto p-6 lg:p-8">
                                    <div className="space-y-6">
                                        {/* Swap Header - now part of scrollable content */}
                                        <div className="w-full">
                                            <SwapInterface headerOnly={true} />
                                        </div>

                                        {/* Main Swap Interface */}
                                        <Suspense fallback={null}>
                                            <SwapInterfaceContent />
                                        </Suspense>
                                    </div>
                                </div>
                            </div>

                            {/* Right Sidebar - Swap Information */}
                            <div className={`w-full max-w-sm sm:w-[420px] border-l border-white/[0.08] bg-black/20 backdrop-blur-sm flex-col z-50 ${rightSidebarOpen ? 'fixed inset-y-0 right-0 flex' : 'hidden xl:flex'
                                }`}>
                                <div className="p-4 border-b border-white/[0.08]">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                            <div className="h-8 w-8 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                    <path d="M9 12l2 2 4-4"></path>
                                                    <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.37 0 4.52.92 6.11 2.42"></path>
                                                </svg>
                                            </div>
                                            <h2 className="text-sm font-semibold text-white/95">Swap Information</h2>
                                        </div>
                                        <button
                                            onClick={() => setRightSidebarOpen(false)}
                                            className="xl:hidden h-6 w-6 rounded text-white/60 hover:text-white/90 hover:bg-white/[0.1] transition-all duration-200 flex items-center justify-center"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4">
                                    <SwapInformationSidebar />
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
                </SwapPageWithProviders>
            </WalletBalanceProvider>
        </SwapTokensProvider>
    );
}
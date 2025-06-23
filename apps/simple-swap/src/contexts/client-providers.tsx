'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { WalletProvider } from '@/contexts/wallet-context';
import { ComparisonTokenProvider } from '@/contexts/comparison-token-context';
import { OrderConditionsProvider } from '@/contexts/order-conditions-context';
import { BlazeProvider } from 'blaze-sdk/realtime';
import { TokenCacheData } from '@repo/tokens';

interface ClientProvidersProps {
    children: React.ReactNode;
}

// Global loading component for provider initialization
function GlobalLoadingSpinner() {
    return (
        <div className="fixed inset-0 bg-gray-950/90 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <div className="h-6 w-6 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
                <div className="text-center">
                    <div className="text-white/90 font-medium">Loading...</div>
                </div>
            </div>
        </div>
    );
}

// Token fetching wrapper component
function TokenAwareProviders({ children }: { children: React.ReactNode }) {
    const [tokens, setTokens] = useState<TokenCacheData[]>([]);
    const [isLoadingTokens, setIsLoadingTokens] = useState(true);

    useEffect(() => {
        // Fetch tokens for OrderConditionsProvider
        async function fetchTokens() {
            try {
                const response = await fetch('/api/token-summaries');
                if (response.ok) {
                    const tokenData = await response.json();
                    setTokens(tokenData);
                }
            } catch (error) {
                console.error('Failed to fetch tokens for OrderConditionsProvider:', error);
            } finally {
                setIsLoadingTokens(false);
            }
        }

        fetchTokens();
    }, []);

    // Show loading while tokens are fetching
    if (isLoadingTokens) {
        return <GlobalLoadingSpinner />;
    }

    return (
        <OrderConditionsProvider availableTokens={tokens}>
            <ComparisonTokenProvider>
                {children}
            </ComparisonTokenProvider>
        </OrderConditionsProvider>
    );
}

export function ClientProviders({ children }: ClientProvidersProps) {
    return (
        <Suspense fallback={<GlobalLoadingSpinner />}>
            <BlazeProvider>
                <WalletProvider>
                    <TokenAwareProviders>
                        {children}
                    </TokenAwareProviders>
                </WalletProvider>
            </BlazeProvider>
        </Suspense>
    );
}
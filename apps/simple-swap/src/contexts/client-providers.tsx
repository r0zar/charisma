'use client';

import React, { Suspense } from 'react';
import { WalletProvider } from '@/contexts/wallet-context';
import { TokenPriceProvider } from '@/contexts/token-price-context';
import { WalletBalanceProvider } from '@/contexts/wallet-balance-context';
import { BalanceNotices } from '@/components/balances/BalanceNotices';
import { TokenMetadataProvider } from '@/contexts/token-metadata-context';
import { SubnetTokensProvider } from '@/contexts/subnet-tokens-context';
import type { TokenCacheData } from '@/lib/contract-registry-adapter';

interface ClientProvidersProps {
    children: React.ReactNode;
    initialTokens?: TokenCacheData[];
}

// Shown for a moment while the app's providers start up: a quiet page, not an animation
function GlobalLoadingSpinner() {
    return <div className="fixed inset-0 z-50 bg-bg" aria-busy="true" />;
}

function TokenAwareProviders({ children, initialTokens }: { children: React.ReactNode; initialTokens?: TokenCacheData[] }) {
    return (
        <TokenPriceProvider>
            <TokenMetadataProvider initialTokens={initialTokens}>
                <SubnetTokensProvider>
                    <WalletBalanceProvider>
                        <BalanceNotices />
                        {children}
                    </WalletBalanceProvider>
                </SubnetTokensProvider>
            </TokenMetadataProvider>
        </TokenPriceProvider>
    );
}

export function ClientProviders({ children, initialTokens }: ClientProvidersProps) {
    return (
        <Suspense fallback={<GlobalLoadingSpinner />}>
            <WalletProvider>
                <TokenAwareProviders initialTokens={initialTokens}>
                    {children}
                </TokenAwareProviders>
            </WalletProvider>
        </Suspense>
    );
}
'use client';

import React, { Suspense } from 'react';
import { WalletProvider } from '@/contexts/wallet-context';
import { ComparisonTokenProvider } from '@/contexts/comparison-token-context';
import { BlazeProvider } from 'blaze-sdk/realtime';

interface ClientProvidersProps {
    children: React.ReactNode;
}

export function ClientProviders({ children }: ClientProvidersProps) {
    return (
        <BlazeProvider>
            <WalletProvider>
                <Suspense fallback={<div>Loading...</div>}>
                    <ComparisonTokenProvider>
                        {children}
                    </ComparisonTokenProvider>
                </Suspense>
            </WalletProvider>
        </BlazeProvider>
    );
}
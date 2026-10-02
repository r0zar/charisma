'use client';

import React from 'react';
import { WalletProvider } from '@/contexts/wallet-context';
import { TokensProvider } from '@/contexts/tokens-context';
import { RoundProvider } from '@/hooks/useRound';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <WalletProvider>
            <TokensProvider>
                <RoundProvider>
                    {children}
                </RoundProvider>
            </TokensProvider>
        </WalletProvider>
    );
}

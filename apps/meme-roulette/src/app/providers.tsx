'use client';

import React from 'react';
import { SpinProvider } from '@/contexts/SpinContext'; // Adjust path if using aliases
import { WalletProvider } from '@/contexts/wallet-context'; // Import WalletProvider

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <WalletProvider>
            <SpinProvider>
                {children}
            </SpinProvider>
        </WalletProvider>
    );
} 
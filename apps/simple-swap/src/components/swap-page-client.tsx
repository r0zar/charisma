"use client";

import { useSearchParams } from 'next/navigation';
import { TokenProvider } from '@/contexts/token-context';
import SwapInterface from '@/components/swap-interface';

export default function SwapPageClient() {
    // Get URL parameters on the client side
    const searchParams = useSearchParams();
    const fromSymbol = searchParams.get('fromSymbol') || "STX";
    const toSymbol = searchParams.get('toSymbol') || "CHA";

    return (
        <TokenProvider
            defaultFromSymbol={fromSymbol}
            defaultToSymbol={toSymbol}
            // Add a key to force complete remount when URL params change
            key={`${fromSymbol}-${toSymbol}-${Date.now()}`}
        >
            <SwapInterface />
        </TokenProvider>
    );
}
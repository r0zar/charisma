'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { BalanceBreakdown } from '@/components/balances/BalanceBreakdown';
import { useWallet } from '@/contexts/wallet-context';

/** /balances: the connected wallet's instant balances in full; ?token= opens one token, ?address= any wallet */
function Balances() {
    const params = useSearchParams();
    const { address: connected } = useWallet();
    const address = params.get('address') ?? connected;
    return address
        ? <BalanceBreakdown address={address} token={params.get('token') ?? undefined} />
        : <p className="py-16 text-center text-sm text-ink-muted">Connect a wallet to see its balances.</p>;
}

export default function BalancesPage() {
    return (
        <div className="relative flex min-h-screen flex-col">
            <Header />
            <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
                <Suspense fallback={null}>
                    <Balances />
                </Suspense>
            </main>
            <Footer />
        </div>
    );
}

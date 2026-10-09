'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { WalletActivity } from '@/components/activity/WalletActivity';
import { useWallet } from '@/contexts/wallet-context';

/** /activity: everything the connected wallet does; ?address= any wallet */
function Activity() {
    const params = useSearchParams();
    const { address: connected } = useWallet();
    const address = params.get('address') ?? connected;
    return address
        ? <WalletActivity address={address} />
        : <p className="py-16 text-center text-sm text-ink-muted">Connect a wallet to see its activity.</p>;
}

export default function ActivityPage() {
    return (
        <div className="relative flex min-h-screen flex-col">
            <Header />
            <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
                <Suspense fallback={null}>
                    <Activity />
                </Suspense>
            </main>
            <Footer />
        </div>
    );
}

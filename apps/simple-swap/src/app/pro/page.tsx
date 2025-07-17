import React, { Suspense } from 'react';
import { Metadata } from 'next';
import { listTokens } from '../actions';
import ProInterface from '@/components/pro-interface/pro-interface';
import { Header } from '@/components/layout/header';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Pro Trading | Charisma Swap',
    description: 'Advanced trading interface with limit orders, DCA, and professional tools on Charisma Swap',
    openGraph: {
        title: 'Pro Trading | Charisma Swap',
        description: 'Advanced trading interface with limit orders, DCA, and professional tools',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Pro Trading | Charisma Swap',
        description: 'Advanced trading interface with limit orders, DCA, and professional tools',
    },
};

export default async function ProPage() {
    // Prefetch tokens on the server
    const { success, tokens = [] } = await listTokens();

    return (
        <div className="relative flex flex-col min-h-screen">
            <Header />
            <main className="flex-1">
                <Suspense fallback={<div className="flex items-center justify-center min-h-screen">
                    <div className="h-8 w-8 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
                </div>}>
                    <ProInterface initialTokens={tokens} />
                </Suspense>
            </main>
        </div>
    );
}
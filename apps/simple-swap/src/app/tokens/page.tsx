import { Metadata } from 'next';
import { Header } from "../../components/layout/header";
import { listTokenSummaries } from "../token-actions";
import TokensPageClient from "@/components/tokens/tokens-page-client";
import { Suspense } from 'react';
import { TokenTableSkeleton } from '@/components/tokens/token-table-skeleton';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // Revalidate every minute

export const metadata: Metadata = {
    title: "Tokens | SimpleSwap - Live Cryptocurrency Prices & Analytics",
    description: "Discover and track live cryptocurrency prices, market data, and analytics. Compare tokens, view price charts, and access detailed token information on SimpleSwap.",
    keywords: "cryptocurrency, token prices, crypto analytics, live prices, market data, SimpleSwap",
    openGraph: {
        title: "Tokens | SimpleSwap",
        description: "Live cryptocurrency prices and analytics",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Tokens | SimpleSwap",
        description: "Live cryptocurrency prices and analytics",
    },
};

export default async function TokensPage() {
    const tokens = await listTokenSummaries();

    return (
        <div className="flex flex-col min-h-screen">
            <Header />

            <main className="flex-1 container max-w-7xl mx-auto px-4 py-8">
                <Suspense fallback={<TokenTableSkeleton />}>
                    <TokensPageClient tokens={tokens} />
                </Suspense>
            </main>
        </div>
    );
} 
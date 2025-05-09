import { Metadata } from 'next';
import { Header } from "../../components/header";
import { listTokenSummaries } from "../token-actions";
import TokensPageClient from "@/components/tokens-page-client";
import { Suspense } from 'react';

export const metadata: Metadata = {
    title: "Tokens | SimpleSwap",
    description: "Browse token prices and metadata on SimpleSwap",
};

export default async function TokensPage() {
    const tokens = await listTokenSummaries();

    return (
        <div className="flex flex-col min-h-screen">
            <Header />

            <main className="flex-1 container max-w-6xl mx-auto px-4 py-8">
                <Suspense fallback={<div>Loading...</div>}>
                    <TokensPageClient tokens={tokens} />
                </Suspense>
            </main>
        </div>
    );
} 
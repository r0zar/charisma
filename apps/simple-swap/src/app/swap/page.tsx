import React from 'react';
import { Metadata } from 'next';
import { listTokens } from '../actions';
import SwapInterface from '@/components/swap-interface';
import { Header } from '@/components/header';

type Props = {
    searchParams: { [key: string]: string | string[] | undefined }
}

export async function generateMetadata(
    { searchParams }: Props
): Promise<Metadata> {
    const params = await searchParams;
    const fromSymbol = (params.fromSymbol as string) || 'STX';
    const toSymbol = (params.toSymbol as string) || 'CHA';
    const amount = (params.amount as string) || '1';

    const title = `Swap ${amount} ${fromSymbol} to ${toSymbol} | Charisma Swap`;
    const description = `Swap ${amount} ${fromSymbol} to ${toSymbol} on Charisma Swap`;
    const ogImageUrl = `https://swap.charisma.rocks/api/og?fromSymbol=${fromSymbol}&toSymbol=${toSymbol}&amount=${amount}`;
    const pageUrl = `https://swap.charisma.rocks/swap?fromSymbol=${fromSymbol}&toSymbol=${toSymbol}&amount=${amount}`;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            url: pageUrl,
            images: [
                {
                    url: ogImageUrl,
                    width: 1200,
                    height: 630,
                    alt: title,
                },
            ],
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [ogImageUrl],
        },
    };
}

export default async function SwapPage({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined };
}) {
    const { fromSymbol, toSymbol, amount } = await searchParams;
    // Get URL parameters for pre-filling the swap form
    const fromParam = fromSymbol as string | undefined;
    const toParam = toSymbol as string | undefined;
    const amountParam = amount as string | undefined;

    // Prefetch tokens on the server
    const { success, tokens = [] } = await listTokens();

    return (
        <div className="relative flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 py-8 md:py-12">
                <div className="container max-w-6xl">
                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Main Swap UI */}
                        <div className="md:col-span-2">
                            <SwapInterface
                                initialTokens={tokens}
                                urlParams={{
                                    fromSymbol: fromParam,
                                    toSymbol: toParam,
                                    amount: amountParam
                                }}
                            />
                        </div>

                        {/* Sidebar */}
                        <div className="md:col-span-1">
                            <div className="sticky top-24 bg-card border border-border rounded-xl p-6 shadow-md">
                                <h2 className="text-lg font-semibold mb-4">Swap Information</h2>

                                <div className="space-y-6">
                                    {/* Vault-level Isolation */}
                                    <div className="flex items-start space-x-3">
                                        <div className="h-8 w-24 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
                                            {/* Shield icon */}
                                            <svg className="h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /></svg>
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-medium">Isolated Vault Security</h3>
                                            <p className="text-sm text-muted-foreground mt-1">Every liquidity pool lives in its <strong>own Clarity contract principal</strong>. Funds are sandboxed &mdash; actions in one vault cannot affect another.</p>
                                        </div>
                                    </div>

                                    {/* Automatic post-conditions */}
                                    <div className="flex items-start space-x-3">
                                        <div className="h-8 w-24 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
                                            {/* Check icon */}
                                            <svg className="h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-medium">Automatic Post-conditions</h3>
                                            <p className="text-sm text-muted-foreground mt-1">Swap transactions are generated with <strong>fungible-token postconditions</strong> that guarantee you never receive fewer tokens than quoted.</p>
                                        </div>
                                    </div>

                                    {/* Normalised trait wrapping */}
                                    <div className="flex items-start space-x-3">
                                        <div className="h-8 w-24 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
                                            {/* Layers icon */}
                                            <svg className="h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-medium">Unified LP Interface</h3>
                                            <p className="text-sm text-muted-foreground mt-1">Every pool implements the open <strong>Liquidity-Pool SIP</strong>. That means <em>anyone</em> can deploy a new pool and the router supports it.</p>
                                        </div>
                                    </div>

                                    {/* Multihop router */}
                                    <div className="flex items-start space-x-3">
                                        <div className="h-8 w-24 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
                                            {/* Route icon */}
                                            <svg className="h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><polyline points="3 12 9 12 21 12" /><polyline points="3 18 14 18 21 18" /></svg>
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-medium">Best-Path Multihop Routing</h3>
                                            <p className="text-sm text-muted-foreground mt-1">A graph search evaluates up to 9-hop paths. Because every pool implements the same interface, we always pathfind the best route.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
} 
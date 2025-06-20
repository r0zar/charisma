import React, { Suspense } from 'react';
import { Metadata } from 'next';
import { listTokens } from '../actions';
import SwapInterface from '@/components/swap-interface/swap-interface';
import { Header } from '@/components/layout/header';
import SwapPageClient from './swap-page-client';

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

    // Collect all recognised deep-link parameters
    const query = new URLSearchParams();
    if (fromSymbol) query.set('fromSymbol', fromSymbol);
    if (toSymbol) query.set('toSymbol', toSymbol);
    if (amount) query.set('amount', amount);

    const extraKeys = ['mode', 'targetPrice', 'direction', 'conditionToken', 'baseAsset', 'fromSubnet', 'toSubnet'] as const;
    extraKeys.forEach((k) => {
        const v = params[k];
        if (typeof v === 'string' && v !== '') query.set(k, v);
    });

    const title = `Swap ${amount} ${fromSymbol} to ${toSymbol} | Charisma Swap`;
    const description = `Swap ${amount} ${fromSymbol} to ${toSymbol} on Charisma Swap`;

    const base = 'https://swap.charisma.rocks';
    const ogImageUrl = `${base}/api/og?${query.toString()}`;
    const pageUrl = `${base}/swap?${query.toString()}`;

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
        other: {
            'og:logo': 'https://charisma.rocks/charisma.png',
        },
    };
}

export default async function SwapPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
    // Prefetch tokens on the server
    const { success, tokens = [] } = await listTokens();

    return <SwapPageClient tokens={tokens} searchParams={searchParams} />;
} 
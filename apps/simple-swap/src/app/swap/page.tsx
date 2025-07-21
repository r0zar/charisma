import React from 'react';
import { Metadata } from 'next';
import { listTokens, getBalancesAction } from '../actions';
import SwapPageClient from './swap-page-client';
import type { BulkBalanceResponse } from '@services/balances/src/types';

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
    
    // Await searchParams as required by Next.js 15
    const params = await searchParams;

    // Pre-load balance data for commonly used addresses
    // This is a basic implementation - could be enhanced with user-specific pre-loading
    let initialBalances: BulkBalanceResponse | undefined;
    
    try {
        // For now, we'll just initialize the balance service without pre-loading specific addresses
        // This could be enhanced to pre-load balances for known popular addresses or user wallets
        console.log('[SwapPage] Balance service will be available for client-side requests');
        
        // Example of how to pre-load specific addresses:
        // const commonAddresses = ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS']; // Example addresses
        // initialBalances = await getBalancesAction(commonAddresses, undefined, false);
        
    } catch (error) {
        console.warn('[SwapPage] Failed to pre-load balance data:', error);
        // Continue without pre-loaded balances
    }

    return <SwapPageClient tokens={tokens} searchParams={params} initialBalances={initialBalances} />;
} 
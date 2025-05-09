'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import type { TokenSummary } from '@/app/token-actions';
import CompareTokenSelector from './compare-token-selector';
import TokenChartWrapper from './token-chart-wrapper';
import { useDominantColor } from './utils/useDominantColor';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

interface Props {
    detail: TokenSummary;
    tokens?: TokenSummary[];
}

export default function TokenDetailClient({ detail, tokens: initialTokens }: Props) {
    const [tokens, setTokens] = useState<TokenSummary[]>(initialTokens ?? []);
    const [compareId, setCompareId] = useState<string | null>(null);

    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    useEffect(() => {
        if (initialTokens && initialTokens.length) return;
        fetch('/api/token-summaries')
            .then((r) => r.json())
            .then((d: TokenSummary[]) => {
                setTokens(d);
            })
            .catch(console.error);
    }, [initialTokens]);

    /* ------------- init compareId from URL/localStorage ------------- */
    useEffect(() => {
        if (compareId) return;
        const urlCompare = searchParams?.get('compare');
        if (urlCompare) {
            setCompareId(urlCompare);
            return;
        }
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('compareTokenId');
            if (stored) setCompareId(stored);
        }
    }, [compareId, searchParams]);

    const compareToken = tokens.find((t) => t.contractId === compareId) ?? null;

    // extract colors
    const primaryColor = useDominantColor(detail.image);
    const compareColor = useDominantColor(compareToken?.image ?? null);

    function diff(a: number | null, b: number | null): number | null {
        if (a === null || b === null) return null;
        return a - b;
    }

    function fmtDelta(delta: number | null) {
        if (delta === null) return '-';
        const sign = delta > 0 ? '+' : '';
        return `${sign}${delta.toFixed(2)}%`;
    }

    function getColour(delta: number | null) {
        if (delta === null) return 'text-muted-foreground';
        if (delta > 0) return 'text-green-600';
        if (delta < 0) return 'text-red-600';
        return '';
    }

    /* ------------- persist compareId changes ------------- */
    useEffect(() => {
        if (!compareId) return;
        if (typeof window !== 'undefined') {
            localStorage.setItem('compareTokenId', compareId);
        }
        const params = new URLSearchParams(searchParams?.toString());
        params.set('compare', compareId);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [compareId, pathname, router, searchParams]);

    // fallback default when still null after previous effects
    useEffect(() => {
        if (!compareId && tokens.length) {
            const stable = tokens.find((t) => ['aUSD', 'USDC', 'USDT', 'USD'].includes(t.symbol));
            setCompareId(stable ? stable.contractId : tokens[0].contractId);
        }
    }, [compareId, tokens]);

    return (
        <>
            {/* Header row with selector on right */}
            <div className="flex items-start justify-between gap-4 mb-6">
                {/* token info */}
                <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-full bg-muted/50 flex items-center justify-center overflow-hidden">
                        {detail.image ? (
                            <Image src={detail.image} alt={detail.symbol} width={56} height={56} />
                        ) : (
                            <span className="text-lg font-bold text-primary/80">
                                {detail.symbol.charAt(0)}
                            </span>
                        )}
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold leading-tight">{detail.name}</h1>
                        <p className="text-muted-foreground text-sm">{detail.symbol}</p>
                    </div>
                </div>

                {/* selector */}
                <CompareTokenSelector
                    tokens={tokens}
                    primary={detail}
                    selectedId={compareId}
                    onSelect={setCompareId}
                />
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="p-4 rounded-lg bg-muted/20">
                    <div className="text-xs text-muted-foreground mb-1">Price</div>
                    <div className="text-sm font-medium">{detail.price === null ? '-' : `$${detail.price.toFixed(4)}`}</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/20 flex flex-col items-center">
                    <div className="text-xs text-muted-foreground mb-1">1h</div>
                    <div className={`text-sm font-medium ${getColour(diff(detail.change1h, compareToken?.change1h ?? null))}`}>{fmtDelta(diff(detail.change1h, compareToken?.change1h ?? null))}</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/20 flex flex-col items-center">
                    <div className="text-xs text-muted-foreground mb-1">24h</div>
                    <div className={`text-sm font-medium ${getColour(diff(detail.change24h, compareToken?.change24h ?? null))}`}>{fmtDelta(diff(detail.change24h, compareToken?.change24h ?? null))}</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/20 flex flex-col items-center">
                    <div className="text-xs text-muted-foreground mb-1">7d</div>
                    <div className={`text-sm font-medium ${getColour(diff(detail.change7d, compareToken?.change7d ?? null))}`}>{fmtDelta(diff(detail.change7d, compareToken?.change7d ?? null))}</div>
                </div>
            </div>

            {/* Chart */}
            <TokenChartWrapper
                primary={detail.contractId}
                compareId={compareId}
                primaryColor={primaryColor ?? '#3b82f6'}
                compareColor={compareColor ?? '#f87171'}
            />
        </>
    );
} 
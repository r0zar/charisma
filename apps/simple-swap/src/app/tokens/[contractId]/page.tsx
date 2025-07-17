import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTokenDetail, listTokenSummaries, preloadPriceSeriesData, type TokenSummary } from '../../token-actions';
import { Header } from '@/components/layout/header';
import TokenDetailClient from '@/components/tokens/token-detail-client';
import TokenDetailSkeleton from '@/components/tokens/token-detail-skeleton';
import TokenBreadcrumbs from '@/components/tokens/token-breadcrumbs';
import RelatedTokens from '@/components/tokens/related-tokens';
import PremiumTokenInfo from '@/components/tokens/premium-token-info';
import { ComparisonTokenProvider } from '@/contexts/comparison-token-context';
import { Suspense } from 'react';
import { priceSeriesService } from '@/lib/price-series-service';
import { perfMonitor } from '@/lib/performance-monitor';

interface PageProps {
    params: { contractId: string };
}

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { contractId } = await params;
    try {
        const detail = await getTokenDetail(decodeURIComponent(contractId));
        return {
            title: `${detail.symbol} (${detail.name}) | Token Details - SimpleSwap`,
            description: `Live price, charts, and detailed information for ${detail.name} (${detail.symbol}). Current price: $${detail.price?.toFixed(4) || '0.0000'}, 24h change: ${detail.change24h?.toFixed(2) || '0.00'}%.`,
            keywords: `${detail.name}, ${detail.symbol}, cryptocurrency, token price, live chart, crypto analytics`,
            openGraph: {
                title: `${detail.symbol} (${detail.name}) | SimpleSwap`,
                description: `Live price and analytics for ${detail.name}`,
                type: "website",
                images: detail.image ? [{ url: detail.image, alt: detail.name }] : [],
            },
            twitter: {
                card: "summary_large_image",
                title: `${detail.symbol} (${detail.name}) | SimpleSwap`,
                description: `Live price and analytics for ${detail.name}`,
                images: detail.image ? [detail.image] : [],
            },
        };
    } catch (error) {
        return {
            title: "Token Details | SimpleSwap",
            description: "Token details and analytics",
        };
    }
}

export default async function TokenDetailPage({ params }: PageProps) {
    const { contractId } = await params;
    const decodedContractId = decodeURIComponent(contractId);

    try {
        const timer = perfMonitor.startTiming('token-detail-page-load');

        // Step 1: Fetch basic token data and summaries in parallel
        const [detail, summaries] = await Promise.all([
            getTokenDetail(decodedContractId),
            listTokenSummaries(),
        ]);

        if (!detail) notFound();

        // Step 2: Preload chart data for primary token and common comparison tokens
        const commonComparisonTokens = getCommonComparisonTokens(summaries);
        const tokensToPreload = [decodedContractId, ...commonComparisonTokens.slice(0, 5)];

        // Preload price series data and warm the cache
        const preloadedData = await preloadPriceSeriesData(tokensToPreload);
        priceSeriesService.bulkSetCachedPriceSeries(preloadedData);

        timer.end({
            tokenId: decodedContractId.substring(0, 10),
            preloadedTokens: tokensToPreload.length,
            totalDataPoints: Object.values(preloadedData).reduce((sum, data) => sum + data.length, 0)
        });

        return (
            <div className="flex flex-col min-h-screen">
                <Header />

                <main className="flex-1 container max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
                    <ComparisonTokenProvider>
                        {/* Breadcrumbs */}
                        <TokenBreadcrumbs token={detail} className="mb-6" />

                        {/* Main content */}
                        <div className="space-y-6 sm:space-y-8">
                            {/* Header + compare selector + chart handled in client component */}
                            <Suspense fallback={<TokenDetailSkeleton />}>
                                <TokenDetailClient detail={detail} tokens={summaries} />
                            </Suspense>

                            {/* Premium Token Information Grid */}
                            <PremiumTokenInfo detail={detail} />

                            {/* Related Tokens */}
                            <RelatedTokens currentToken={detail} allTokens={summaries} />
                        </div>
                    </ComparisonTokenProvider>
                </main>
            </div>
        );
    } catch (error) {
        console.error('Error loading token details:', error);
        notFound();
    }
}

/* --- helpers --- */

/**
 * Get the most commonly used comparison tokens for preloading
 */
function getCommonComparisonTokens(summaries: TokenSummary[]): string[] {
    // Priority order for comparison tokens
    const prioritySymbols = ['aeUSDC', 'STX', 'sBTC', 'CHA', 'WELSH', 'USDC', 'USDT'];

    const tokens: string[] = [];

    // Add priority tokens if they exist
    for (const symbol of prioritySymbols) {
        const token = summaries.find(t => t.symbol === symbol);
        if (token) {
            tokens.push(token.contractId);
        }
    }

    // Fill remaining slots with highest volume/price tokens
    const remainingTokens = summaries
        .filter(t => !tokens.includes(t.contractId))
        .sort((a, b) => (b.price || 0) * (b.marketCap || 0) - (a.price || 0) * (a.marketCap || 0))
        .slice(0, 10 - tokens.length)
        .map(t => t.contractId);

    return [...tokens, ...remainingTokens];
}

function fmtPrice(price: number | null) {
    if (price === null) return "-";
    return `$${price.toFixed(4)}`;
}

function fmtDelta(delta: number | null) {
    if (delta === null) return "-";
    const sign = delta > 0 ? "+" : "";
    return `${sign}${delta?.toFixed(2)}%`;
}

function getDeltaColour(delta: number | null) {
    if (delta === null) return "text-muted-foreground";
    if (delta > 0) return "text-green-600";
    if (delta < 0) return "text-red-600";
    return "";
}

// Premium components are now in separate client component files 
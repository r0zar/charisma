import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTokenDetail, listTokenSummaries } from '../../token-actions';
import { Header } from '@/components/layout/header';
import TokenDetailClient from '@/components/tokens/token-detail-client';
import TokenDetailSkeleton from '@/components/tokens/token-detail-skeleton';
import TokenBreadcrumbs from '@/components/tokens/token-breadcrumbs';
import RelatedTokens from '@/components/tokens/related-tokens';
import { Suspense } from 'react';

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

    try {
        const [detail, summaries] = await Promise.all([
            getTokenDetail(decodeURIComponent(contractId)),
            listTokenSummaries(),
        ]);

        if (!detail) notFound();

        return (
            <div className="flex flex-col min-h-screen">
                <Header />

                <main className="flex-1 container max-w-4xl mx-auto px-4 py-8">
                    {/* Breadcrumbs */}
                    <TokenBreadcrumbs token={detail} className="mb-6" />

                    {/* Main content */}
                    <div className="space-y-8">
                        {/* Header + compare selector + chart handled in client component */}
                        <Suspense fallback={<TokenDetailSkeleton />}>
                            <TokenDetailClient detail={detail} tokens={summaries} />
                        </Suspense>

                        {/* Token Information Cards */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Metadata */}
                            <div className="bg-card border border-border rounded-xl p-6">
                                <h2 className="text-lg font-semibold mb-4">Token Information</h2>
                                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm">
                                    <div className="flex justify-between">
                                        <dt className="font-medium text-muted-foreground">Contract Address</dt>
                                        <dd className="break-all text-right max-w-[200px] font-mono text-xs">
                                            {detail.contractId}
                                        </dd>
                                    </div>
                                    {detail.description && (
                                        <div className="flex justify-between">
                                            <dt className="font-medium text-muted-foreground">Description</dt>
                                            <dd className="text-right max-w-[200px]">{detail.description}</dd>
                                        </div>
                                    )}
                                    {detail.total_supply && (
                                        <div className="flex justify-between">
                                            <dt className="font-medium text-muted-foreground">Total Supply</dt>
                                            <dd className="font-mono">{Number(detail.total_supply).toLocaleString()}</dd>
                                        </div>
                                    )}
                                    {detail.decimals !== undefined && (
                                        <div className="flex justify-between">
                                            <dt className="font-medium text-muted-foreground">Decimals</dt>
                                            <dd>{detail.decimals}</dd>
                                        </div>
                                    )}
                                </dl>
                            </div>

                            {/* Market Stats */}
                            <div className="bg-card border border-border rounded-xl p-6">
                                <h2 className="text-lg font-semibold mb-4">Market Statistics</h2>
                                <div className="space-y-4">
                                    <Stat
                                        label="Current Price"
                                        value={fmtPrice(detail.price)}
                                    />
                                    <Stat
                                        label="24h Change"
                                        value={fmtDelta(detail.change24h)}
                                        delta={detail.change24h}
                                    />
                                    <Stat
                                        label="7d Change"
                                        value={fmtDelta(detail.change7d)}
                                        delta={detail.change7d}
                                    />
                                    <Stat
                                        label="30d Change"
                                        value={fmtDelta(detail.change30d)}
                                        delta={detail.change30d}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Related Tokens */}
                        <RelatedTokens currentToken={detail} allTokens={summaries} />
                    </div>
                </main>
            </div>
        );
    } catch (error) {
        console.error('Error loading token details:', error);
        notFound();
    }
}

/* --- helpers --- */
function fmtPrice(price: number | null) {
    if (price === null) return "-";
    return `$${price.toFixed(4)}`;
}

function fmtDelta(delta: number | null) {
    if (delta === null) return "-";
    const sign = delta > 0 ? "+" : "";
    return `${sign}${delta.toFixed(2)}%`;
}

function getDeltaColour(delta: number | null) {
    if (delta === null) return "text-muted-foreground";
    if (delta > 0) return "text-green-600";
    if (delta < 0) return "text-red-600";
    return "";
}

function Stat({ label, value, delta }: { label: string; value: string; delta?: number | null }) {
    return (
        <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-b-0">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className={`text-sm font-medium ${getDeltaColour(delta ?? null)}`}>{value}</div>
        </div>
    );
} 
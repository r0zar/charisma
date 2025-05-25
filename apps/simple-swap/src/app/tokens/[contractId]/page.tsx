import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTokenDetail, listTokenSummaries } from '../../token-actions';
import { Header } from '@/components/layout/header';
import dynamic from 'next/dynamic';

interface PageProps {
    params: { contractId: string };
}

const TokenDetailClient = dynamic(() => import('@/components/tokens/token-detail-client'), { ssr: true });

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { contractId } = await params;
    const detail = await getTokenDetail(decodeURIComponent(contractId));
    return {
        title: `${detail.symbol} | Token Details`,
        description: `Live stats and information for ${detail.name}`,
    };
}

export default async function TokenDetailPage({ params }: PageProps) {
    const { contractId } = await params;
    const [detail, summaries] = await Promise.all([
        getTokenDetail(decodeURIComponent(contractId)),
        listTokenSummaries(),
    ]);

    if (!detail) notFound();

    return (
        <div className="flex flex-col min-h-screen">
            <Header />

            <main className="flex-1 container max-w-3xl mx-auto px-4 py-8">
                {/* Header + compare selector + chart handled in client component */}
                <TokenDetailClient detail={detail} tokens={summaries} />

                {/* Metadata */}
                <div className="bg-card border border-border rounded-xl p-6">
                    <h2 className="text-lg font-semibold mb-4">Token Metadata</h2>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                        <div>
                            <dt className="font-medium text-muted-foreground">Contract</dt>
                            <dd className="break-all">{detail.contractId}</dd>
                        </div>
                        {detail.description && (
                            <div>
                                <dt className="font-medium text-muted-foreground">Description</dt>
                                <dd>{detail.description}</dd>
                            </div>
                        )}
                        {detail.total_supply && (
                            <div>
                                <dt className="font-medium text-muted-foreground">Total Supply</dt>
                                <dd>{detail.total_supply}</dd>
                            </div>
                        )}
                        {detail.decimals !== undefined && (
                            <div>
                                <dt className="font-medium text-muted-foreground">Decimals</dt>
                                <dd>{detail.decimals}</dd>
                            </div>
                        )}
                    </dl>
                </div>
            </main>
        </div>
    );
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
        <div className="p-4 rounded-lg bg-muted/20">
            <div className="text-xs text-muted-foreground mb-1">{label}</div>
            <div className={`text-sm font-medium ${getDeltaColour(delta ?? null)}`}>{value}</div>
        </div>
    );
} 
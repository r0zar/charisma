"use client"

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { NftCollection } from '@/lib/nft-service';
import type { TokenMetadata } from '@/lib/metadata-service';

const PAGE = 60;

type Token = TokenMetadata & { id: string };

/** One NFT collection: its details and a grid of its tokens, a page at a time */
export function NftCollectionDetail({ contractId }: { contractId: string }) {
    const [collection, setCollection] = useState<NftCollection | null>(null);
    const [tokens, setTokens] = useState<Token[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadPage = (offset: number) => {
        setLoading(true);
        fetch(`/api/v1/nft/${encodeURIComponent(contractId)}/tokens?offset=${offset}&limit=${PAGE}`)
            .then(r => r.json())
            .then(j => {
                if (!j.success) throw new Error(j.error);
                setCollection(j.collection);
                setTotal(j.total);
                setTokens(prev => offset === 0 ? j.tokens : [...prev, ...j.tokens]);
            })
            .catch(e => setError(e instanceof Error ? e.message : String(e)))
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadPage(0); }, [contractId]);

    if (error) return <p className="py-12 text-center text-destructive">Couldn't load this collection: {error}</p>;
    if (!collection) return <p className="py-12 text-center text-muted-foreground">Loading collection...</p>;

    const tokenUri = `https://metadata.charisma.rocks/nft/${collection.slug}/`;

    return (
        <div>
            <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
                <ArrowLeft className="h-4 w-4" /> All metadata
            </Link>
            <div className="flex flex-wrap items-start gap-6 mb-8">
                {collection.image && (
                    <img src={collection.image} alt={collection.name} className="h-24 w-24 rounded-lg border bg-muted object-contain [image-rendering:pixelated]" />
                )}
                <div className="space-y-2 min-w-0">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold tracking-tight">{collection.name}</h1>
                        <Badge variant="outline">{total.toLocaleString()} NFTs</Badge>
                    </div>
                    <p className="text-sm font-mono text-muted-foreground break-all">{collection.contractId}</p>
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Token URI base:</span>
                        <code className="font-mono break-all select-all">{tokenUri}</code>
                    </div>
                    {collection.description && <p className="text-sm text-muted-foreground max-w-2xl">{collection.description}</p>}
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {tokens.map(t => (
                    <a
                        key={t.id}
                        href={`${tokenUri}${t.id}.json`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border bg-card overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                    >
                        <div className="aspect-square bg-muted flex items-center justify-center">
                            {t.image && <img src={t.image} alt={t.name} loading="lazy" className="h-3/4 w-3/4 object-contain [image-rendering:pixelated]" />}
                        </div>
                        <div className="p-3 space-y-1">
                            <p className="text-xs text-muted-foreground">#{t.id}</p>
                            <p className="text-sm font-medium leading-tight line-clamp-2">{t.name}</p>
                            <div className="flex flex-wrap gap-1 pt-1">
                                {t.attributes?.slice(0, 3).map(a => (
                                    <Badge key={a.trait_type} variant="secondary" className="text-[10px] px-1.5 py-0">{String(a.value)}</Badge>
                                ))}
                            </div>
                        </div>
                    </a>
                ))}
            </div>

            {tokens.length < total && (
                <div className="flex justify-center mt-8">
                    <Button variant="outline" disabled={loading} onClick={() => loadPage(tokens.length)}>
                        {loading ? 'Loading...' : `Show more (${tokens.length.toLocaleString()} of ${total.toLocaleString()})`}
                    </Button>
                </div>
            )}
        </div>
    );
}

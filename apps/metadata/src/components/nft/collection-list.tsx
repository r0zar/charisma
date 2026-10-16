"use client"

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { NftCollection } from '@/lib/nft-service';

/** Every NFT collection metadata hosts, as cards that open the collection */
export function NftCollectionList() {
    const router = useRouter();
    const [collections, setCollections] = useState<NftCollection[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/v1/nft/list')
            .then(r => r.json())
            .then(j => j.success ? setCollections(j.collections) : setError(j.error))
            .catch(e => setError(String(e)));
    }, []);

    const header = (
        <div className="flex justify-end mb-6">
            <Button asChild>
                <Link href="/dashboard/nft/new"><Plus className="h-4 w-4" /> New collection</Link>
            </Button>
        </div>
    );

    if (error) return <p className="py-12 text-center text-destructive">Couldn't load NFT collections: {error}</p>;
    if (!collections) return <p className="py-12 text-center text-muted-foreground">Loading NFT collections...</p>;
    if (!collections.length) return <>{header}<p className="py-12 text-center text-muted-foreground">No NFT collections yet.</p></>;

    return (
        <>
        {header}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {collections.map(c => (
                <button
                    key={c.contractId}
                    onClick={() => router.push(`/dashboard/nft/${encodeURIComponent(c.contractId)}`)}
                    className="text-left overflow-hidden rounded-lg border bg-card hover:shadow-md transition-shadow cursor-pointer"
                >
                    <div className="h-48 bg-muted flex items-center justify-center">
                        {c.image && <img src={c.image} alt={c.name} className="h-32 w-32 object-contain [image-rendering:pixelated]" />}
                    </div>
                    <div className="p-6">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <h3 className="font-medium text-lg truncate">{c.name}</h3>
                            <Badge variant="outline">{c.tokenCount.toLocaleString()} NFTs</Badge>
                        </div>
                        <p className="text-muted-foreground text-sm truncate font-mono">{c.contractId}</p>
                    </div>
                </button>
            ))}
        </div>
        </>
    );
}

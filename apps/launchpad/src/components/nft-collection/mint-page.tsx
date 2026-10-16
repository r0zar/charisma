"use client"

import { useEffect, useState } from 'react';
import { ExternalLink, Minus, Pause, Play, Plus, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useApp } from '@/lib/context/app-context';
import {
    fetchHostedCollection, fetchMintedBy, fetchMintInfo, fetchMintTx, formatStx, isDeployed, METADATA_URL, mint, setMintOpen,
    type HostedCollection, type MintInfo, type NftToken,
} from '@/lib/nft-collection';
import { MAX_MINT_BATCH } from '@/lib/templates/sip009-contract-template';

const RECENT = 12;
const explorer = (txid: string) => `https://explorer.hiro.so/txid/${txid.startsWith('0x') ? txid : `0x${txid}`}?chain=mainnet`;

interface Loaded {
    info: MintInfo;
    collection: HostedCollection | null;
    recent: NftToken[];
    mintedByMe: number;
}

/** A launchpad collection's public mint page: progress, price, a mint button, and the latest pieces minted */
export function MintPage({ contractId, deployTxid }: { contractId: string; deployTxid?: string }) {
    const { stxAddress, connectWallet } = useApp();
    const [deployed, setDeployed] = useState<boolean | null>(null);
    const [loaded, setLoaded] = useState<Loaded | null>(null);
    const [count, setCount] = useState(1);
    const [pending, setPending] = useState<{ txid: string; label: string } | null>(null);
    const [got, setGot] = useState<NftToken[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const load = async () => {
        try {
            const live = await isDeployed(contractId);
            setDeployed(live);
            if (!live) return;
            const info = await fetchMintInfo(contractId);
            const hosted = await fetchHostedCollection(contractId, Math.max(0, info.minted - RECENT), RECENT);
            const mintedByMe = stxAddress ? await fetchMintedBy(contractId, stxAddress) : 0;
            setLoaded({ info, collection: hosted?.collection ?? null, recent: [...(hosted?.tokens ?? [])].reverse(), mintedByMe });
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };

    useEffect(() => { load(); }, [contractId, stxAddress]);

    // While the collection deploys, check back every 15 seconds
    useEffect(() => {
        if (deployed !== false || !deployTxid) return;
        const timer = setInterval(load, 15_000);
        return () => clearInterval(timer);
    }, [deployed, deployTxid]);

    // Follow a mint (or pause) until it lands, then show what it minted
    useEffect(() => {
        if (!pending) return;
        const timer = setInterval(async () => {
            try {
                const tx = await fetchMintTx(pending.txid);
                if (tx.status === 'pending') return;
                clearInterval(timer);
                setPending(null);
                if (tx.status !== 'success') return setActionError(`The transaction failed (${tx.status}).`);
                await load();
                setGot(await Promise.all(tx.ids.slice(0, RECENT).map(async id => {
                    const res = await fetch(`${METADATA_URL}/nft/${contractId}/${id}.json`);
                    return res.ok ? { id: String(id), ...(await res.json()) } : { id: String(id), name: `#${id}` };
                })));
            } catch (e) {
                setActionError(e instanceof Error ? e.message : String(e));
            }
        }, 10_000);
        return () => clearInterval(timer);
    }, [pending]);

    if (error) return <p className="py-16 text-center text-destructive">{error}</p>;
    if (deployed === false) {
        return (
            <div className="py-16 text-center space-y-3">
                <h1 className="text-2xl font-bold">{deployTxid ? 'Your collection is deploying' : 'This collection isn\'t deployed'}</h1>
                <p className="text-muted-foreground font-mono text-sm break-all">{contractId}</p>
                {deployTxid && (
                    <>
                        <p className="text-muted-foreground">This page opens up as soon as the network confirms it, usually within a few minutes.</p>
                        <Button variant="outline" asChild>
                            <a href={explorer(deployTxid)} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> View transaction</a>
                        </Button>
                    </>
                )}
            </div>
        );
    }
    if (!loaded) return <p className="py-16 text-center text-muted-foreground">Loading collection...</p>;

    const { info, collection, recent, mintedByMe } = loaded;
    const isCreator = stxAddress === info.creator;
    const remaining = info.maxSupply - info.minted;
    const walletLeft = isCreator || info.walletLimit === 0 ? Infinity : info.walletLimit - mintedByMe;
    const maxCount = Math.max(0, Math.min(MAX_MINT_BATCH, remaining, walletLeft));
    const quantity = Math.min(count, Math.max(1, maxCount));
    const blocked = remaining === 0 ? 'Sold out'
        : !info.open && !isCreator ? 'Minting is paused'
            : walletLeft <= 0 ? `You've minted your ${info.walletLimit}` : null;
    const cost = isCreator ? BigInt(0) : info.price * BigInt(quantity);

    const onMint = async () => {
        if (!stxAddress) return;
        setGot([]);
        setActionError(null);
        try {
            setPending({ txid: await mint(contractId, quantity, stxAddress, info), label: `Minting ${quantity}` });
        } catch (e) {
            setActionError(e instanceof Error ? e.message : String(e));
        }
    };
    const onToggle = async () => {
        setActionError(null);
        try {
            setPending({ txid: await setMintOpen(contractId, !info.open), label: info.open ? 'Pausing the mint' : 'Opening the mint' });
        } catch (e) {
            setActionError(e instanceof Error ? e.message : String(e));
        }
    };

    return (
        <div className="max-w-5xl mx-auto grid gap-10">
            <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
                <div className="aspect-square rounded-2xl border bg-muted flex items-center justify-center overflow-hidden">
                    {collection?.image
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={collection.image} alt={collection.name} className="h-full w-full object-contain [image-rendering:pixelated]" />
                        : <Sparkles className="h-16 w-16 text-muted-foreground" />}
                </div>

                <div className="grid gap-6 min-w-0">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-3xl font-bold tracking-tight">{collection?.name ?? contractId.split('.')[1]}</h1>
                            <Badge variant={blocked ? 'outline' : 'default'}>{remaining === 0 ? 'Sold out' : info.open ? 'Live' : 'Paused'}</Badge>
                        </div>
                        {collection?.description && <p className="text-muted-foreground">{collection.description}</p>}
                        <p className="text-xs font-mono text-muted-foreground break-all">{contractId}</p>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>{info.minted.toLocaleString()} of {info.maxSupply.toLocaleString()} minted</span>
                            <span className="text-muted-foreground">{Math.floor(100 * info.minted / info.maxSupply)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-primary transition-all" style={{ width: `${100 * info.minted / info.maxSupply}%` }} />
                        </div>
                    </div>

                    <Card>
                        <CardContent className="grid gap-4 pt-6">
                            <div className="flex items-baseline justify-between">
                                <span className="text-sm text-muted-foreground">Price</span>
                                <span className="text-xl font-semibold">{info.price === BigInt(0) ? 'Free' : `${formatStx(info.price)} each`}</span>
                            </div>
                            {info.walletLimit > 0 && (
                                <p className="text-sm text-muted-foreground">Up to {info.walletLimit} per wallet{stxAddress && !isCreator ? `. You've minted ${mintedByMe}.` : '.'}</p>
                            )}
                            {isCreator && <p className="text-sm text-muted-foreground">This is your collection, so you mint free.</p>}

                            {!stxAddress ? (
                                <Button size="lg" onClick={connectWallet}>Connect wallet to mint</Button>
                            ) : blocked ? (
                                <Button size="lg" disabled>{blocked}</Button>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-2">
                                            <Button variant="outline" size="icon" aria-label="One fewer" onClick={() => setCount(Math.max(1, quantity - 1))} disabled={quantity <= 1}><Minus className="h-4 w-4" /></Button>
                                            <span className="w-10 text-center text-lg font-semibold tabular-nums">{quantity}</span>
                                            <Button variant="outline" size="icon" aria-label="One more" onClick={() => setCount(Math.min(maxCount, quantity + 1))} disabled={quantity >= maxCount}><Plus className="h-4 w-4" /></Button>
                                        </div>
                                        <span className="text-sm text-muted-foreground">{cost === BigInt(0) ? 'Free' : `Total ${formatStx(cost)}`}</span>
                                    </div>
                                    <Button size="lg" onClick={onMint} disabled={!!pending}>
                                        <Sparkles className="h-4 w-4" /> Mint {quantity}
                                    </Button>
                                </>
                            )}

                            {actionError && <p className="text-sm text-destructive">{actionError}</p>}
                            {pending && (
                                <p className="text-sm text-muted-foreground">
                                    {pending.label}, waiting for the network...{' '}
                                    <a href={explorer(pending.txid)} target="_blank" rel="noreferrer" className="underline">View transaction</a>
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {isCreator && (
                        <Button variant="outline" onClick={onToggle} disabled={!!pending || remaining === 0}>
                            {info.open ? <><Pause className="h-4 w-4" /> Pause the mint</> : <><Play className="h-4 w-4" /> Open the mint</>}
                        </Button>
                    )}
                </div>
            </div>

            {got.length > 0 && <PieceGrid title="You minted" tokens={got} />}
            {recent.length > 0 && <PieceGrid title="Latest mints" tokens={recent} />}
        </div>
    );
}

function PieceGrid({ title, tokens }: { title: string; tokens: NftToken[] }) {
    return (
        <section className="grid gap-4">
            <h2 className="text-xl font-semibold">{title}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {tokens.map(t => (
                    <div key={t.id} className="rounded-lg border bg-card overflow-hidden">
                        <div className="aspect-square bg-muted flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {t.image && <img src={t.image} alt={t.name} loading="lazy" className="h-full w-full object-contain [image-rendering:pixelated]" />}
                        </div>
                        <div className="p-3">
                            <p className="text-xs text-muted-foreground">#{t.id}</p>
                            <p className="text-sm font-medium leading-tight line-clamp-2">{t.name}</p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

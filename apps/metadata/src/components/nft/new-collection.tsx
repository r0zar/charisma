"use client"

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, FolderOpen, ImagePlus, Rocket, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApp } from '@/lib/context/app-context';
import { buildCollection, readPieces, shuffled, uploadCollection, type Piece } from '@/lib/nft-upload';

const LAUNCHPAD_URL = 'https://launchpad.charisma.rocks';
const CONTRACT_NAME = /^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/;
const PREVIEWS = 24;

const toContractName = (name: string) => name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^(\d)/, 'nft-$1')
    .slice(0, 40);

/**
 * Upload a new NFT collection's art: images (plus matching .json files for names and traits), shuffled into mint
 * order and hosted at metadata.charisma.rocks/nft/<contractId>/, ready for the launchpad to deploy.
 */
export function NewNftCollection({ initialContract }: { initialContract?: string }) {
    const { authenticated, stxAddress, connectWallet } = useApp();
    const [name, setName] = useState('');
    const [contractName, setContractName] = useState(initialContract ?? '');
    const [description, setDescription] = useState('');
    const [pieces, setPieces] = useState<Piece[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [cover, setCover] = useState<File | null>(null);
    const [shuffle, setShuffle] = useState(true);
    const [progress, setProgress] = useState<{ step: string; done: number; total: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [uploaded, setUploaded] = useState(false);

    // Free the old preview images whenever new ones replace them
    useEffect(() => () => previews.forEach(url => URL.revokeObjectURL(url)), [previews]);

    if (!authenticated || !stxAddress) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
                <ImagePlus className="h-10 w-10 text-muted-foreground" />
                <h2 className="text-2xl font-semibold">Connect your wallet</h2>
                <p className="text-muted-foreground max-w-md">Your collection lives under your wallet's address, and your wallet signs the upload.</p>
                <Button onClick={connectWallet}>Connect wallet</Button>
            </div>
        );
    }

    const contractId = `${stxAddress}.${contractName}`;
    const traitTypes = [...new Set(pieces.flatMap(p => p.attributes?.map(a => a.trait_type) ?? []))];
    const ready = name.trim() && CONTRACT_NAME.test(contractName) && pieces.length > 0 && !progress;

    const onName = (value: string) => {
        if (!contractName || contractName === toContractName(name)) setContractName(toContractName(value));
        setName(value);
    };

    const onFiles = async (list: FileList | null) => {
        if (!list?.length) return;
        setError(null);
        try {
            const read = await readPieces([...list]);
            setPieces(read);
            setPreviews(read.slice(0, PREVIEWS).map(p => URL.createObjectURL(p.image)));
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };

    const upload = async () => {
        setError(null);
        try {
            const built = buildCollection(shuffle ? shuffled(pieces) : pieces, contractId, name.trim());
            await uploadCollection(contractId, { name: name.trim(), description: description.trim() || undefined }, built, cover,
                (step, done, total) => setProgress({ step, done, total }));
            setUploaded(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setProgress(null);
        }
    };

    if (uploaded) {
        return (
            <div className="max-w-xl mx-auto flex flex-col items-center gap-4 py-16 text-center">
                <div className="h-14 w-14 rounded-full bg-success-soft flex items-center justify-center">
                    <Check className="h-7 w-7 text-success" />
                </div>
                <h1 className="text-2xl font-bold">{name} is uploaded</h1>
                <p className="text-muted-foreground">
                    {pieces.length.toLocaleString()} pieces are hosted. Each one stays hidden until someone mints it.
                </p>
                <p className="text-sm font-mono text-muted-foreground break-all">{contractId}</p>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                    <Button asChild>
                        <a href={`${LAUNCHPAD_URL}/templates/sip009?contract=${encodeURIComponent(contractId)}`}>
                            <Rocket className="h-4 w-4" /> Next: deploy it on the launchpad
                        </a>
                    </Button>
                    <Button variant="outline" asChild>
                        <Link href={`/dashboard/nft/${encodeURIComponent(contractId)}`}>View collection</Link>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
                <ArrowLeft className="h-4 w-4" /> All metadata
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">New NFT collection</h1>
            <p className="text-muted-foreground mt-1 mb-8">Upload your art here, then deploy the collection on the launchpad.</p>

            <div className="grid gap-6">
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-sm font-medium">
                        Collection name
                        <Input id="nft-name" value={name} onChange={e => onName(e.target.value)} placeholder="Space Cats" maxLength={100} />
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium">
                        Contract name
                        <Input id="nft-contract" value={contractName} onChange={e => setContractName(e.target.value)} placeholder="space-cats" maxLength={40} className="font-mono" />
                        <span className={`text-xs font-normal ${contractName && !CONTRACT_NAME.test(contractName) ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {contractName && !CONTRACT_NAME.test(contractName)
                                ? 'Start with a letter, then letters, numbers, - or _'
                                : 'Use the same name when you deploy on the launchpad'}
                        </span>
                    </label>
                </div>
                <label className="grid gap-1.5 text-sm font-medium">
                    Description
                    <textarea
                        id="nft-description"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        rows={3}
                        maxLength={2000}
                        placeholder="What the collection is about"
                        className="rounded-md border border-input bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                </label>

                <div className="rounded-lg border border-dashed p-6 grid gap-3 justify-items-center text-center">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <div>
                        <p className="font-medium">Add your art</p>
                        <p className="text-sm text-muted-foreground max-w-lg">
                            One image per piece. For names and traits, add a .json with the same name as each image (1.png + 1.json),
                            the way most art generators export them.
                        </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                        <Button variant="outline" asChild>
                            <label className="cursor-pointer">
                                <FolderOpen className="h-4 w-4" /> Choose a folder
                                <input id="nft-folder" type="file" className="hidden" multiple
                                    {...{ webkitdirectory: '' }} onChange={e => onFiles(e.target.files)} />
                            </label>
                        </Button>
                        <Button variant="outline" asChild>
                            <label className="cursor-pointer">
                                <ImagePlus className="h-4 w-4" /> Choose files
                                <input id="nft-files" type="file" className="hidden" multiple accept="image/png,image/jpeg,image/gif,image/webp,image/avif,.json"
                                    onChange={e => onFiles(e.target.files)} />
                            </label>
                        </Button>
                    </div>
                </div>

                {pieces.length > 0 && (
                    <div className="grid gap-4">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                            <Badge variant="outline">{pieces.length.toLocaleString()} pieces</Badge>
                            <Badge variant="outline">{pieces.filter(p => p.name || p.attributes).length.toLocaleString()} with a .json</Badge>
                            {traitTypes.length > 0 && <span className="text-muted-foreground">Traits: {traitTypes.join(', ')}</span>}
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                            {pieces.slice(0, PREVIEWS).map((piece, i) => (
                                <div key={piece.image.name + i} className="rounded-lg border bg-card overflow-hidden">
                                    <div className="aspect-square bg-muted flex items-center justify-center">
                                        <img src={previews[i]} alt={piece.image.name} className="h-full w-full object-contain [image-rendering:pixelated]" />
                                    </div>
                                    <div className="p-2 space-y-1">
                                        <p className="text-xs font-medium truncate">{piece.name ?? piece.image.name}</p>
                                        <div className="flex flex-wrap gap-1">
                                            {piece.attributes?.slice(0, 3).map(a => (
                                                <Badge key={a.trait_type} variant="secondary" className="text-[10px] px-1.5 py-0">{String(a.value)}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {pieces.length > PREVIEWS && (
                            <p className="text-sm text-muted-foreground">Showing the first {PREVIEWS} of {pieces.length.toLocaleString()}.</p>
                        )}

                        <label className="flex items-start gap-3 text-sm cursor-pointer">
                            <input id="nft-shuffle" type="checkbox" checked={shuffle} onChange={e => setShuffle(e.target.checked)} className="mt-0.5 h-4 w-4 cursor-pointer" />
                            <span>
                                <span className="font-medium">Shuffle the mint order</span>
                                <span className="block text-muted-foreground">Pieces mint in order, so shuffling makes every mint a surprise. Turn it off to keep your file order.</span>
                            </span>
                        </label>
                        <label className="grid gap-1.5 text-sm">
                            <span className="font-medium">Cover image (optional)</span>
                            <span className="text-muted-foreground">Shown on the mint page. Without one, the first piece minted is the cover.</span>
                            <input id="nft-cover" type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
                                onChange={e => setCover(e.target.files?.[0] ?? null)} className="text-sm file:mr-3 file:rounded-md file:border file:bg-card file:px-3 file:py-1.5 file:cursor-pointer" />
                        </label>
                    </div>
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="flex flex-wrap items-center gap-4">
                    <Button onClick={upload} disabled={!ready}>
                        <Upload className="h-4 w-4" /> Sign and upload
                    </Button>
                    {progress && (
                        <span className="text-sm text-muted-foreground">
                            {progress.step}{progress.total > 1 ? ` ${progress.done.toLocaleString()} / ${progress.total.toLocaleString()}` : '...'}
                        </span>
                    )}
                    {!progress && contractName && CONTRACT_NAME.test(contractName) && (
                        <span className="text-xs font-mono text-muted-foreground break-all">{contractId}</span>
                    )}
                </div>
            </div>
        </div>
    );
}

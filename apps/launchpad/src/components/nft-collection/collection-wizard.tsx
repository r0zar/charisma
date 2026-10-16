"use client"

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ImagePlus, Rocket } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CodeBlock } from '@/components/ui/code-block';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/lib/context/app-context';
import { fetchHostedCollection, isDeployed, METADATA_URL, type HostedCollection } from '@/lib/nft-collection';
import { generateSIP009CollectionContract, MAX_MINT_BATCH } from '@/lib/templates/sip009-contract-template';

const CONTRACT_NAME = /^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/;

type Lookup =
    | { state: 'idle' | 'loading' }
    | { state: 'missing' }
    | { state: 'deployed' }
    | { state: 'ready'; collection: HostedCollection }
    | { state: 'error'; message: string };

/**
 * Deploy an NFT collection whose art is already on metadata.charisma.rocks: pick a price and a per-wallet limit,
 * and the supply is the number of pieces uploaded.
 */
export function NftCollectionWizard({ initialContract }: { initialContract?: string }) {
    const { authenticated, stxAddress, connectWallet, deployContract } = useApp();
    const router = useRouter();
    const [contractName, setContractName] = useState(initialContract?.split('.').pop() ?? '');
    const [price, setPrice] = useState('');
    const [walletLimit, setWalletLimit] = useState('0');
    const [lookup, setLookup] = useState<Lookup>({ state: 'idle' });
    const [deploying, setDeploying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const contractId = `${stxAddress}.${contractName}`;
    const uploader = initialContract?.includes('.') ? initialContract.split('.')[0] : null;

    // Look the collection up once typing pauses
    useEffect(() => {
        if (!stxAddress || !CONTRACT_NAME.test(contractName)) {
            setLookup({ state: 'idle' });
            return;
        }
        setLookup({ state: 'loading' });
        const timer = setTimeout(async () => {
            try {
                if (await isDeployed(contractId)) return setLookup({ state: 'deployed' });
                const hosted = await fetchHostedCollection(contractId);
                setLookup(hosted && hosted.collection.tokenCount > 0 ? { state: 'ready', collection: hosted.collection } : { state: 'missing' });
            } catch (e) {
                setLookup({ state: 'error', message: e instanceof Error ? e.message : String(e) });
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [contractId]);

    if (!authenticated || !stxAddress) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
                <Rocket className="h-10 w-10 text-muted-foreground" />
                <h2 className="text-2xl font-semibold">Connect your wallet</h2>
                <p className="text-muted-foreground max-w-md">Use the wallet you uploaded your art with. It deploys the collection and receives the mint payments.</p>
                <Button onClick={connectWallet}>Connect wallet</Button>
            </div>
        );
    }

    const priceStx = Number(price || 0);
    const limit = Number(walletLimit || 0);
    const rulesValid = price.trim() !== '' && Number.isFinite(priceStx) && priceStx >= 0 && Number.isInteger(limit) && limit >= 0;
    const code = lookup.state === 'ready' && rulesValid
        ? generateSIP009CollectionContract({
            collectionName: lookup.collection.name,
            contractName,
            deployerAddress: stxAddress,
            maxSupply: lookup.collection.tokenCount,
            priceStx,
            walletLimit: limit,
        })
        : null;

    const deploy = async () => {
        if (!code) return;
        setError(null);
        setDeploying(true);
        try {
            const { txid } = await deployContract(code, contractName);
            router.push(`/mint/${contractId}?deployed=${txid}`);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            setDeploying(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto">
            <Link href="/templates" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
                <ArrowLeft className="h-4 w-4" /> Templates
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">NFT Collection</h1>
            <p className="text-muted-foreground text-lg mt-1 mb-8">Set your price and deploy. Collectors mint from a page you can share.</p>

            {uploader && uploader !== stxAddress && (
                <p className="mb-6 rounded-md border border-warning/40 bg-warning-soft p-3 text-sm">
                    This art was uploaded by {uploader}. Connect that wallet to deploy it.
                </p>
            )}

            <div className="grid grid-cols-1 gap-6">
                <div className="grid gap-2">
                    <Label htmlFor="nft-contract">Contract name</Label>
                    <Input id="nft-contract" value={contractName} onChange={e => setContractName(e.target.value)} placeholder="space-cats" maxLength={40} className="font-mono" />
                    <p className="text-xs text-muted-foreground font-mono break-all">{CONTRACT_NAME.test(contractName) ? contractId : 'Start with a letter, then letters, numbers, - or _'}</p>
                </div>

                {lookup.state === 'loading' && <p className="text-sm text-muted-foreground">Looking for your art...</p>}
                {lookup.state === 'error' && <p className="text-sm text-destructive">{lookup.message}</p>}
                {lookup.state === 'deployed' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Already deployed</CardTitle>
                            <CardDescription>{contractId} is live on Stacks.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button asChild><Link href={`/mint/${contractId}`}>Go to the mint page</Link></Button>
                        </CardContent>
                    </Card>
                )}
                {lookup.state === 'missing' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Upload your art first</CardTitle>
                            <CardDescription>
                                Your images, names and traits live on Charisma Metadata. Upload them under this contract name, then come back here.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button asChild>
                                <a href={`${METADATA_URL}/dashboard/nft/new?contract=${encodeURIComponent(contractId)}`}>
                                    <ImagePlus className="h-4 w-4" /> Upload art
                                </a>
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {lookup.state === 'ready' && (
                    <>
                        <Card>
                            <CardContent className="flex flex-wrap items-center gap-5 pt-6">
                                {lookup.collection.image && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={lookup.collection.image} alt="" className="h-20 w-20 rounded-lg border bg-muted object-contain [image-rendering:pixelated]" />
                                )}
                                <div className="min-w-0 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="text-xl font-semibold">{lookup.collection.name}</h2>
                                        <Badge variant="outline">{lookup.collection.tokenCount.toLocaleString()} pieces</Badge>
                                    </div>
                                    {lookup.collection.description && <p className="text-sm text-muted-foreground">{lookup.collection.description}</p>}
                                </div>
                            </CardContent>
                        </Card>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="nft-price">Mint price (STX per piece)</Label>
                                <Input id="nft-price" type="number" min="0" step="any" value={price} onChange={e => setPrice(e.target.value)} placeholder="10" />
                                <p className="text-xs text-muted-foreground">Use 0 for a free mint.</p>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="nft-limit">Limit per wallet</Label>
                                <Input id="nft-limit" type="number" min="0" step="1" value={walletLimit} onChange={e => setWalletLimit(e.target.value)} />
                                <p className="text-xs text-muted-foreground">0 means no limit.</p>
                            </div>
                        </div>

                        <Card>
                            <CardHeader><CardTitle className="text-lg">How your mint works</CardTitle></CardHeader>
                            <CardContent>
                                <ul className="space-y-2 text-sm">
                                    <li>• {lookup.collection.tokenCount.toLocaleString()} pieces mint in order. Each one stays hidden until it's minted.</li>
                                    <li>• {rulesValid && priceStx > 0 ? `${priceStx.toLocaleString()} STX each, paid straight to your wallet.` : 'Free to mint.'}</li>
                                    <li>• {limit > 0 ? `Up to ${limit.toLocaleString()} per wallet.` : 'No limit per wallet.'} Up to {MAX_MINT_BATCH} in one go.</li>
                                    <li>• You mint free, as many as you like, and you can pause the mint anytime.</li>
                                    <li>• Charisma takes no fee.</li>
                                </ul>
                            </CardContent>
                        </Card>

                        {code && (
                            <details className="rounded-lg border">
                                <summary className="cursor-pointer px-4 py-3 text-sm font-medium">See the contract</summary>
                                <CodeBlock className="rounded-t-none max-h-96">{code}</CodeBlock>
                            </details>
                        )}

                        {error && <p className="text-sm text-destructive">{error}</p>}
                        <Button size="lg" onClick={deploy} disabled={!code || deploying}>
                            <Rocket className="h-4 w-4" /> {deploying ? 'Confirm in your wallet...' : 'Deploy collection'}
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}

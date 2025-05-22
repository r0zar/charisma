"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getTokenMetadataCached, TokenCacheData } from '@repo/tokens';
import { Loader2, EyeIcon, CodeIcon } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import ReactJson with SSR disabled as it's a client-side only component
const ReactJson = dynamic(() => import('react-json-view'), {
    ssr: false,
    loading: () => <div className="p-4 text-sm text-muted-foreground">Loading JSON viewer...</div>
});

interface AddSublinkDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSublinkCreated: (sublinkData: any) => void; // Define a proper type later (e.g., Vault-like structure)
}

// New type: Spreads main sublink properties and includes tokenA & tokenB objects
export type FetchedSublinkDetails = Partial<TokenCacheData> & {
    tokenA: TokenCacheData | null;
    tokenB: TokenCacheData | null;
};

const initialFetchedDetailsState: FetchedSublinkDetails = { tokenA: null, tokenB: null };

// Helper function to pick specified properties if they are defined (not null or undefined)
function pickDefinedProperties(source: Record<string, any> | null | undefined, keys: string[]): Record<string, any> {
    const result: Record<string, any> = {};
    if (!source) {
        return result;
    }
    for (const key of keys) {
        if (source[key] !== null && source[key] !== undefined) {
            result[key] = source[key];
        }
    }
    return result;
}

export default function AddSublinkDialog({ isOpen, onOpenChange, onSublinkCreated }: AddSublinkDialogProps) {
    const [sublinkContractIdInput, setSublinkContractIdInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Looking up Sublink...');
    const [error, setError] = useState<string | null>(null);
    const [fetchedDetails, setFetchedDetails] = useState<FetchedSublinkDetails>(initialFetchedDetailsState);
    const [displayableRawDetails, setDisplayableRawDetails] = useState<Record<string, any> | null>(null);
    const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview');

    const resetDialogState = () => {
        setSublinkContractIdInput('');
        setFetchedDetails(initialFetchedDetailsState);
        setDisplayableRawDetails(null);
        setError(null);
        setIsLoading(false);
        setLoadingMessage('Looking up Sublink...');
        setViewMode('preview');
    };

    const handleLookup = async () => {
        const trimmedContractId = sublinkContractIdInput.trim();
        if (!trimmedContractId) {
            setError('Please enter a Sublink Contract ID.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setFetchedDetails(initialFetchedDetailsState);

        try {
            setLoadingMessage('Fetching main sublink metadata...');
            const mainData = await getTokenMetadataCached(trimmedContractId);

            if (!mainData || !mainData.contractId) {
                throw new Error('Invalid or no metadata returned for the Sublink Contract ID.');
            }
            if (!(mainData.type === 'SUBLINK' || (mainData.tokenAContract && mainData.tokenBContract))) {
                throw new Error('The provided ID is not a recognized Sublink or lacks token pair information.');
            }

            let tokenAData: TokenCacheData | null = null;
            let tokenBData: TokenCacheData | null = null;

            if (mainData.tokenAContract) {
                setLoadingMessage(`Fetching metadata for Token A (${mainData.tokenAContract})...`);
                tokenAData = await getTokenMetadataCached(mainData.tokenAContract);
                if (!tokenAData || !tokenAData.contractId) {
                    console.warn(`Could not fetch full metadata for Token A: ${mainData.tokenAContract}`);
                    tokenAData = { contractId: mainData.tokenAContract, name: 'Token A (Details Missing)', symbol: 'TKA', type: 'TOKEN', identifier: mainData.tokenAContract, decimals: 6 };
                }
            }

            if (mainData.tokenBContract) {
                setLoadingMessage(`Fetching metadata for Token B (${mainData.tokenBContract})...`);
                tokenBData = await getTokenMetadataCached(mainData.tokenBContract);
                if (!tokenBData || !tokenBData.contractId) {
                    console.warn(`Could not fetch full metadata for Token B: ${mainData.tokenBContract}`);
                    tokenBData = { contractId: mainData.tokenBContract, name: 'Token B (Details Missing)', symbol: 'TKB', type: 'TOKEN', identifier: mainData.tokenBContract, decimals: 6 };
                }
            }

            if (!tokenAData || !tokenBData) {
                throw new Error('Could not resolve metadata for one or both tokens in the pair.');
            }

            setFetchedDetails({
                ...mainData, // Spread mainData properties onto the root
                tokenA: tokenAData,
                tokenB: tokenBData,
            });

        } catch (e: any) {
            console.error('Sublink lookup failed:', e);
            setError(e.message || 'Failed to fetch sublink details. Ensure the contract ID is correct and the service is available.');
            setFetchedDetails(initialFetchedDetailsState);
        } finally {
            setIsLoading(false);
        }
    };

    // Effect to update displayableRawDetails when fetchedDetails changes
    useEffect(() => {
        if (fetchedDetails.contractId && fetchedDetails.tokenA && fetchedDetails.tokenB) {
            const allowedTokenKeys = [
                'contractId', 'name', 'description', 'image', 'decimals',
                'identifier', 'symbol', 'type', 'total_supply', 'base'
            ];
            const tokenAData = pickDefinedProperties(fetchedDetails.tokenA, allowedTokenKeys);
            const tokenBData = pickDefinedProperties(fetchedDetails.tokenB, allowedTokenKeys);

            const rootSublinkProperties: Record<string, any> = {
                type: 'SUBLINK',
                protocol: 'CHARISMA',
                contractId: fetchedDetails.contractId,
                name: fetchedDetails.name || `Sublink: ${tokenAData.symbol || 'TKA'}-${tokenBData.symbol || 'TKB'}`,
            };
            const optionalRootKeys = ['description', 'engineContractId', 'image'];
            for (const key of optionalRootKeys) {
                if (fetchedDetails[key as keyof TokenCacheData] !== null && fetchedDetails[key as keyof TokenCacheData] !== undefined) {
                    rootSublinkProperties[key] = fetchedDetails[key as keyof TokenCacheData];
                }
            }
            setDisplayableRawDetails({
                ...rootSublinkProperties,
                tokenAContract: tokenAData.contractId,
                tokenBContract: tokenBData.contractId,
                tokenA: tokenAData,
                tokenB: tokenBData,
            });
        } else if (fetchedDetails.contractId) { // Only main details fetched, or partial
            setDisplayableRawDetails(fetchedDetails); // Show what we have so far
        } else {
            setDisplayableRawDetails(null);
        }
    }, [fetchedDetails]);

    const handleSubmit = () => {
        if (displayableRawDetails && displayableRawDetails.contractId && displayableRawDetails.tokenA && displayableRawDetails.tokenB && displayableRawDetails.tokenAContract && displayableRawDetails.tokenBContract) {
            onSublinkCreated(displayableRawDetails);
            onOpenChange(false);
            resetDialogState();
        } else {
            setError("Cannot create sublink. Crucial data is missing from the fetched details.")
        }
    };

    // Updated boolean flags based on the new structure
    const mainDetailsFetched = Boolean(fetchedDetails.contractId); // Check for a root property like contractId
    const hasAllDetails = Boolean(fetchedDetails.contractId && fetchedDetails.tokenA && fetchedDetails.tokenB);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) resetDialogState();
            onOpenChange(open);
        }}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Add New Sublink</DialogTitle>
                    <DialogDescription>
                        Enter the Sublink&apos;s main contract ID. This will fetch its metadata and the metadata for its token pair.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Input
                            id="sublinkContractIdInput"
                            placeholder="SP...sublink-contract"
                            value={sublinkContractIdInput}
                            onChange={(e) => setSublinkContractIdInput(e.target.value)}
                            className="col-span-4"
                            disabled={isLoading || hasAllDetails}
                        />
                    </div>
                    {error && (
                        <p className="text-sm text-red-500 col-span-4">{error}</p>
                    )}
                </div>

                {isLoading && (
                    <div className="flex items-center justify-center p-4">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        <span className="text-sm text-muted-foreground">{loadingMessage}</span>
                    </div>
                )}

                {hasAllDetails && !isLoading && (
                    <div className="p-4 border rounded-md bg-muted/50 space-y-3">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-semibold">Fetched Sublink & Token Details:</h4>
                            <div className="flex gap-1">
                                <Button
                                    variant={viewMode === 'preview' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('preview')}
                                    className="h-8 px-2.5"
                                >
                                    <EyeIcon className="mr-1.5 h-4 w-4" /> Preview
                                </Button>
                                <Button
                                    variant={viewMode === 'raw' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('raw')}
                                    className="h-8 px-2.5"
                                >
                                    <CodeIcon className="mr-1.5 h-4 w-4" /> Raw Data
                                </Button>
                            </div>
                        </div>

                        {viewMode === 'preview' && (
                            <div className="space-y-4 text-sm">
                                <div>
                                    <h5 className="font-semibold text-base mb-1">
                                        Main Sublink: <span className="font-mono text-xs text-muted-foreground">{fetchedDetails.contractId}</span>
                                    </h5>
                                    <div className="pl-3 text-xs space-y-0.5">
                                        <p><strong>Name:</strong> {fetchedDetails.name || 'N/A'}</p>
                                        <p><strong>Type:</strong> {fetchedDetails.type || 'N/A'}</p>
                                        {fetchedDetails.description && <p><strong>Description:</strong> {fetchedDetails.description}</p>}
                                    </div>
                                </div>

                                <div className="space-y-3 pt-2">
                                    {fetchedDetails.tokenA && (
                                        <div className="p-3 border rounded-md bg-card shadow-sm">
                                            <h6 className="font-semibold text-sm mb-1.5">
                                                Token A: <span className="font-mono text-xs text-muted-foreground">{fetchedDetails.tokenA.contractId}</span>
                                            </h6>
                                            <div className="flex items-start gap-3">
                                                {fetchedDetails.tokenA.image && (
                                                    <img
                                                        src={fetchedDetails.tokenA.image}
                                                        alt={fetchedDetails.tokenA.name || 'Token A'}
                                                        className="w-12 h-12 rounded-md object-cover border bg-background shadow-sm flex-shrink-0"
                                                    />
                                                )}
                                                <div className="text-xs space-y-0.5 flex-grow">
                                                    <p><strong>Name:</strong> {fetchedDetails.tokenA.name || 'N/A'}</p>
                                                    <p><strong>Symbol:</strong> {fetchedDetails.tokenA.symbol || 'N/A'}</p>
                                                    <p><strong>Decimals:</strong> {fetchedDetails.tokenA.decimals ?? 'N/A'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {fetchedDetails.tokenB && (
                                        <div className="p-3 border rounded-md bg-card shadow-sm">
                                            <h6 className="font-semibold text-sm mb-1.5">
                                                Token B: <span className="font-mono text-xs text-muted-foreground">{fetchedDetails.tokenB.contractId}</span>
                                            </h6>
                                            <div className="flex items-start gap-3">
                                                {fetchedDetails.tokenB.image && (
                                                    <img
                                                        src={fetchedDetails.tokenB.image}
                                                        alt={fetchedDetails.tokenB.name || 'Token B'}
                                                        className="w-12 h-12 rounded-md object-cover border bg-background shadow-sm flex-shrink-0"
                                                    />
                                                )}
                                                <div className="text-xs space-y-0.5 flex-grow">
                                                    <p><strong>Name:</strong> {fetchedDetails.tokenB.name || 'N/A'}</p>
                                                    <p><strong>Symbol:</strong> {fetchedDetails.tokenB.symbol || 'N/A'}</p>
                                                    <p><strong>Decimals:</strong> {fetchedDetails.tokenB.decimals ?? 'N/A'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {viewMode === 'raw' && (
                            <div
                                className="max-h-96 overflow-auto text-xs bg-black/80 p-2 rounded-md"
                                style={{ overflowWrap: 'break-word', wordBreak: 'break-all' }}
                            >
                                <ReactJson
                                    src={displayableRawDetails || {}}
                                    theme="ocean"
                                    iconStyle="square"
                                    displayObjectSize={false}
                                    displayDataTypes={false}
                                    enableClipboard={false}
                                    style={{ background: 'transparent' }}
                                />
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter>
                    {!hasAllDetails ? (
                        <Button
                            onClick={handleLookup}
                            disabled={isLoading || !sublinkContractIdInput.trim() || mainDetailsFetched}
                        >
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Lookup Sublink
                        </Button>
                    ) : (
                        <Button onClick={handleSubmit} type="submit" disabled={isLoading}>
                            Create Sublink Entry
                        </Button>
                    )}
                    <DialogClose asChild>
                        <Button variant="outline" onClick={resetDialogState}>Cancel</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
} 
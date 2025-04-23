"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context/app-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    ArrowLeft,
    Layers,
    AlertTriangle,
    CheckCircle2,
    Info
} from 'lucide-react';
import Link from 'next/link';

export default function NewTokenPage() {
    const { authenticated, stxAddress } = useApp();
    const [tokenIdentifier, setTokenIdentifier] = useState('');
    const [isValidating, setIsValidating] = useState(false);
    const [error, setError] = useState('');
    const [contractId, setContractId] = useState('');
    const router = useRouter();

    // Update the full contract ID whenever the token identifier changes
    useEffect(() => {
        if (stxAddress && tokenIdentifier) {
            setContractId(`${stxAddress}.${tokenIdentifier}`);
        } else if (stxAddress) {
            setContractId(`${stxAddress}.`);
        }
    }, [stxAddress, tokenIdentifier]);

    // Generate a default token identifier with timestamp
    const handleGenerateTokenId = () => {
        const timestamp = Date.now();
        const newIdentifier = `token-${timestamp}`;
        setTokenIdentifier(newIdentifier);
    };

    // Handle form submission
    const handleContinue = () => {
        if (!tokenIdentifier.trim()) {
            setError('Please enter a token identifier');
            return;
        }

        // Validate token identifier (no spaces, valid characters)
        if (!/^[a-z0-9\-]+$/.test(tokenIdentifier)) {
            setError('Token identifier can only contain lowercase letters, numbers, and hyphens');
            return;
        }

        setIsValidating(true);

        // Proceed to token detail page with the full contract ID
        router.push(`/tokens/${encodeURIComponent(contractId.trim())}`);
    };

    if (!authenticated) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center py-12 bg-gradient-to-b from-background to-muted/20 rounded-xl">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <Layers className="w-10 h-10 text-primary/60" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">Connect your wallet</h2>
                <p className="text-muted-foreground max-w-md">
                    Please connect your wallet to create new token metadata
                </p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="mb-8">
                <Link
                    href="/tokens"
                    className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Back to Tokens
                </Link>

                <h1 className="text-3xl font-bold mt-4 tracking-tight">Create New Token</h1>
                <p className="text-muted-foreground mt-1">Add metadata for your blockchain token</p>
            </div>

            <div className="bg-gradient-to-br from-background to-muted/30 border border-border/50 rounded-xl p-6 md:p-8">
                <div className="flex items-center gap-4 mb-8">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Layers className="h-5 w-5 text-primary/70" />
                    </div>
                    <div>
                        <h2 className="text-xl font-medium">Token Details</h2>
                        <p className="text-sm text-muted-foreground">Define your token's contract ID</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6">
                    <Info className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <p className="text-sm text-blue-700">
                        Tokens can only be deployed to your wallet address. The principal address is pre-filled with your wallet address.
                    </p>
                </div>

                {error && (
                    <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg mb-6">
                        <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
                        <p className="text-sm text-destructive">{error}</p>
                    </div>
                )}

                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label htmlFor="contractId" className="text-sm font-medium">
                                Contract ID
                            </label>
                            <span className="text-xs text-muted-foreground">Required</span>
                        </div>

                        <div className="bg-muted/50 border border-border/50 p-4 rounded-lg">
                            <div className="flex flex-col space-y-4">
                                {/* Principal Address Display */}
                                <div>
                                    <label className="text-xs font-medium block mb-1 text-muted-foreground">
                                        Principal Address (your wallet)
                                    </label>
                                    <div className="w-full px-3 py-2 border border-border/50 bg-background/30 rounded-md font-mono text-sm text-muted-foreground overflow-x-auto whitespace-nowrap">
                                        {stxAddress || 'Connect wallet'}
                                    </div>
                                </div>

                                {/* Token Identifier Input */}
                                <div>
                                    <div className="flex justify-between">
                                        <label htmlFor="tokenIdentifier" className="text-xs font-medium block mb-1">
                                            Token Identifier
                                        </label>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 px-2 text-xs text-primary"
                                            onClick={handleGenerateTokenId}
                                        >
                                            Generate
                                        </Button>
                                    </div>
                                    <div className="flex items-center">
                                        <div className="text-sm font-mono mr-1">.</div>
                                        <Input
                                            id="tokenIdentifier"
                                            value={tokenIdentifier}
                                            onChange={(e) => {
                                                setTokenIdentifier(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                                                setError('');
                                            }}
                                            placeholder="my-token"
                                            className="font-mono"
                                        />
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Use lowercase letters, numbers and hyphens only
                                    </p>
                                </div>
                            </div>

                            {/* Full Contract ID Preview */}
                            <div className="mt-4 pt-4 border-t border-border/30">
                                <label className="text-xs font-medium block mb-1 text-muted-foreground">
                                    Complete Contract ID
                                </label>
                                <div className="w-full px-3 py-2 bg-background rounded border border-border text-sm font-mono">
                                    {contractId}
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    This is the unique identifier that will be used for your token on the blockchain
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-muted/50 border border-border/50 p-4 rounded-lg">
                        <h3 className="text-sm font-medium mb-3 flex items-center">
                            <CheckCircle2 className="h-4 w-4 mr-1.5 text-primary/70" />
                            What happens next?
                        </h3>

                        <p className="text-sm text-muted-foreground mb-3">
                            After creating your token identifier, you'll be able to:
                        </p>

                        <ul className="text-sm text-muted-foreground space-y-2 ml-5 list-disc">
                            <li>Add a name, symbol, and description</li>
                            <li>Generate an AI-powered token image</li>
                            <li>Set decimal precision and other properties</li>
                            <li>Save your token metadata to the blockchain</li>
                        </ul>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-border/40 flex justify-between">
                    <Button
                        variant="outline"
                        onClick={() => router.push('/tokens')}
                    >
                        Cancel
                    </Button>

                    <Button
                        onClick={handleContinue}
                        disabled={isValidating || !tokenIdentifier.trim()}
                        className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-300"
                    >
                        Continue
                    </Button>
                </div>
            </div>
        </div>
    );
} 
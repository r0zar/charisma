"use client"

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { TokenMetadata } from '@/lib/metadata-service';
import { useApp } from '@/lib/context/app-context';
import { Button } from '@/components/ui/button';
import { Plus, ClipboardCopy, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';
import { isLPToken } from '@/lib/utils';

interface MetadataListProps {
    limit?: number;
    filterType?: 'all' | 'sip10' | 'lp';
}

export function MetadataList({ limit, filterType = 'all' }: MetadataListProps) {
    const router = useRouter();
    const { toast } = useToast();
    const { stxAddress, tokens, loading, authenticated, fetchTokens } = useApp();
    const [firstLoad, setFirstLoad] = useState(true);

    console.log("TokensList Render - Auth:", authenticated, "Addr:", stxAddress, "Loading:", loading, "Tokens:", tokens, "Filter:", filterType);

    useEffect(() => {
        console.log("TokensList useEffect triggered. Auth:", authenticated, "Addr:", stxAddress);
        async function loadTokens() {
            if (authenticated && stxAddress) {
                console.log("TokensList useEffect: Conditions met, calling fetchTokens");
                try {
                    await fetchTokens();
                    console.log("TokensList useEffect: fetchTokens call finished");
                } catch (error) {
                    console.error('TokensList useEffect: Failed to fetch tokens:', error);
                    toast({
                        variant: "destructive",
                        title: "Error loading tokens",
                        description: "Failed to fetch your tokens. Please try again later.",
                    });
                } finally {
                    console.log("TokensList useEffect: Setting firstLoad=false");
                    setFirstLoad(false);
                }
            } else {
                console.log("TokensList useEffect: Conditions not met, setting firstLoad=false");
                setFirstLoad(false);
            }
        }
        loadTokens();
    }, [authenticated, stxAddress, fetchTokens, toast]);

    // Ensure tokens is an array before filtering and slicing
    const allTokens = tokens && Array.isArray(tokens) ? tokens : [];

    const filteredTokens = allTokens.filter(token => {
        if (filterType === 'lp') {
            return isLPToken(token);
        }
        if (filterType === 'sip10') {
            return !isLPToken(token);
        }
        return true; // 'all' or any other case
    });

    const displayedTokens = limit ? filteredTokens.slice(0, limit) : filteredTokens;

    // Show loading state on first load
    if (firstLoad && loading) {
        return (
            <div className="flex items-center justify-center w-full py-12">
                <svg
                    className="w-8 h-8 text-primary animate-spin mr-3"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    ></circle>
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                </svg>
                <span className="text-muted-foreground text-lg">Loading tokens...</span>
            </div>
        );
    }

    // Show empty state when no tokens and not loading
    if ((!displayedTokens || displayedTokens.length === 0) && !loading) {
        return (
            <div className="flex flex-col items-center justify-center text-center py-12 px-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-8 h-8 text-primary/60"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                </div>
                <h3 className="text-xl font-medium mb-2">No metadata found</h3>
                <p className="text-muted-foreground max-w-md mb-8">
                    {authenticated
                        ? "You haven't added any token metadata yet. Add your first token to get started."
                        : "Connect your wallet to view and manage your token metadata."}
                </p>
                {authenticated && (
                    <Button onClick={() => router.push('/dashboard/new')}>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="mr-2 h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add New Metadata
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div>
            {authenticated && (
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold tracking-tight">Your Metadata</h1>
                    <Button onClick={() => router.push('/dashboard/new')} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add New Metadata
                    </Button>
                </div>
            )}

            {loading && !firstLoad && (
                <div className="flex items-center justify-center w-full py-4">
                    <svg
                        className="w-6 h-6 text-primary animate-spin mr-2"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        ></circle>
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                    </svg>
                    <span className="text-muted-foreground">Refreshing metadata...</span>
                </div>
            )}

            <motion.div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ staggerChildren: 0.1 }}
            >
                {displayedTokens.map((token, index) => (
                    <TokenCard key={token.contractId || `token-${index}`} token={token} index={index} />
                ))}
            </motion.div>
        </div>
    );
}

interface TokenCardProps {
    token: TokenMetadata;
    index: number;
}

function TokenCard({ token, index }: TokenCardProps) {
    const router = useRouter();
    const { toast } = useToast();
    const contractId = token.contractId || '';
    const isLp = isLPToken(token);

    const handleNavigate = () => {
        if (contractId) {
            router.push(`/dashboard/${encodeURIComponent(contractId)}`);
        }
    };

    const handleCopyToClipboard = () => {
        if (contractId) {
            navigator.clipboard.writeText(contractId)
                .then(() => {
                    toast({
                        title: "Copied to clipboard",
                        description: contractId,
                    });
                })
                .catch(err => {
                    console.error('Failed to copy: ', err);
                    toast({
                        variant: "destructive",
                        title: "Failed to copy",
                        description: "Could not copy contract ID to clipboard.",
                    });
                });
        }
    };

    const handleViewOnExplorer = () => {
        if (contractId) {
            window.open(`https://explorer.hiro.so/txid/${contractId}?chain=mainnet`, '_blank');
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
        >
            <div className="overflow-hidden h-full hover:shadow-md transition-shadow duration-200 flex flex-col rounded-lg border bg-card">
                <div
                    className="h-48 relative bg-muted flex items-center justify-center cursor-pointer"
                    onClick={handleNavigate}
                >
                    {token.image ? (
                        <Image
                            src={token.image}
                            alt={token.name || 'Token image'}
                            fill
                            className="object-cover"
                            unoptimized={true}
                        />
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="w-8 h-8 text-primary/60"
                            >
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="16" x2="12" y2="12" />
                                <line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                        </div>
                    )}
                    {isLp && (
                        <Badge variant="secondary" className="absolute top-2 right-2 z-10 whitespace-nowrap">
                            LP Token
                        </Badge>
                    )}
                </div>
                <div className="pt-6 flex-grow p-6">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <h3 className="font-medium text-lg truncate">{token.name || 'Unnamed Token'}</h3>
                        <div className="flex items-center gap-2">
                            {token.properties?.symbol && (
                                <Badge variant="outline">
                                    ${token.properties.symbol}
                                </Badge>
                            )}
                        </div>
                    </div>
                    <p className="text-muted-foreground text-sm truncate font-mono mb-3">{contractId}</p>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                        {token.description || 'No description provided'}
                    </p>
                </div>
                <div className="pt-2 pb-4 flex items-center justify-between p-6">
                    <Button
                        variant="ghost"
                        className="flex-grow mr-2"
                        onClick={handleNavigate}
                    >
                        View Details
                    </Button>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleCopyToClipboard}
                            title="Copy Contract ID"
                        >
                            <ClipboardCopy className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleViewOnExplorer}
                            title="View on Explorer"
                        >
                            <ExternalLink className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
} 
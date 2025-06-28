"use client"

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { TokenMetadata } from '@/lib/metadata-service';
import { useApp } from '@/lib/context/app-context';
import { TokenCacheData } from '@repo/tokens';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { Plus, Info, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';

interface TokensListProps {
    limit?: number;
}

export function TokensList({ limit }: TokensListProps) {
    const router = useRouter();
    const { toast } = useToast();
    const { stxAddress, tokens, loading, authenticated, fetchTokens } = useApp();
    const [firstLoad, setFirstLoad] = useState(true);

    console.log("TokensList Render - Auth:", authenticated, "Addr:", stxAddress, "Loading:", loading, "Tokens:", tokens);

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

    // Ensure tokens is an array before using slice or map
    const displayedTokens = tokens && Array.isArray(tokens)
        ? (limit ? tokens.slice(0, limit) : tokens)
        : [];

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
                <h3 className="text-xl font-medium mb-2">No tokens found</h3>
                <p className="text-muted-foreground max-w-md mb-8">
                    {authenticated
                        ? "You haven't added any token metadata yet. Add your first token to get started."
                        : "Connect your wallet to view and manage your token metadata."}
                </p>
                {authenticated && (
                    <Button onClick={() => router.push('/tokens/new')}>
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
                        Add New Token
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div>
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
                    <span className="text-muted-foreground">Refreshing tokens...</span>
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
    token: TokenCacheData;
    index: number;
}

function TokenCard({ token, index }: TokenCardProps) {
    const router = useRouter();
    const contractId = token.contractId || '';

    const handleNavigate = () => {
        if (contractId) {
            router.push(`/tokens/${encodeURIComponent(contractId)}`);
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
                </div>
                <div className="pt-6 flex-grow p-6">
                    <div className="mb-2 flex items-center gap-2">
                        <h3 className="font-medium text-lg truncate">{token.name || 'Unnamed Token'}</h3>
                        {token.symbol && (
                            <Badge variant="outline" className="ml-auto">
                                ${token.symbol}
                            </Badge>
                        )}
                    </div>
                    <p className="text-muted-foreground text-sm truncate font-mono mb-3">{contractId}</p>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                        {token.description || 'No description provided'}
                    </p>
                </div>
                <div className="pt-2 pb-4 flex items-center p-6">
                    <Button
                        variant="ghost"
                        className="w-full"
                        onClick={handleNavigate}
                    >
                        View Details
                    </Button>
                </div>
            </div>
        </motion.div>
    );
} 
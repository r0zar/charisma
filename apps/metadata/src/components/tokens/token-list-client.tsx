"use client"

import * as React from 'react';
import { useState } from 'react';
import { useApp } from '@/lib/context/app-context';
import { useRouter } from 'next/navigation';
import { TokenMetadata } from '@/lib/metadata-service';
import { Button } from '../ui/button';

export function TokenListClient() {
    const { authenticated, stxAddress, tokens, loading, tokensError, fetchTokens } = useApp();
    const router = useRouter();
    const [showAuthMessage, setShowAuthMessage] = useState(false);

    // Show auth message after a short delay to prevent flash during initial load
    React.useEffect(() => {
        if (!authenticated) {
            const timer = setTimeout(() => setShowAuthMessage(true), 500);
            return () => clearTimeout(timer);
        } else {
            setShowAuthMessage(false);
        }
    }, [authenticated]);

    const handleCreateToken = () => {
        if (!stxAddress) return;

        // Navigate to the dedicated new token route
        router.push('/tokens/new');
    };

    // Debugging: show the authentication status directly
    console.log("TokenListClient - Auth Status:", authenticated, "Address:", stxAddress);

    // If wallet is not connected, show connection message after delay
    if (showAuthMessage) {
        return (
            <div className="text-center py-12 border border-amber-200 bg-amber-50 rounded-lg">
                <h2 className="text-xl font-semibold mb-4">Connect your wallet to manage tokens</h2>
                <p className="text-sm text-gray-500">
                    Use the "Connect" button in the top right corner.
                </p>
            </div>
        );
    }

    // If authenticated but loading, show loading state
    if (loading) {
        return <div className="text-center py-8">Loading tokens...</div>;
    }

    // If there's an error fetching tokens
    if (tokensError) {
        return (
            <div className="text-center py-12 border border-red-200 bg-red-50 rounded-lg">
                <h2 className="text-xl font-semibold mb-4">Error loading tokens</h2>
                <p className="text-sm text-gray-500">
                    {tokensError}
                </p>
                <Button
                    onClick={() => fetchTokens()}
                    className="mt-4 inline-flex items-center justify-center"
                >
                    Retry
                </Button>
            </div>
        );
    }

    // Display tokens or empty state
    return (
        <div>
            {authenticated && (
                <div className="flex justify-end mb-6">
                    <button
                        onClick={handleCreateToken}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 gap-2"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-4 h-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                        Create Token Metadata
                    </button>
                </div>
            )}

            {authenticated && tokens.length === 0 && !loading ? (
                <div className="text-center py-12 border rounded-lg">
                    <h2 className="text-xl font-semibold mb-2">No tokens found</h2>
                    <p className="mb-6 text-muted-foreground">
                        You haven't created any token metadata yet.
                    </p>
                    <Button
                        onClick={handleCreateToken}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                    >
                        Create Token Metadata
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tokens.map((token) => (
                        <a
                            href={`/tokens/${encodeURIComponent(token.contractId || '')}`}
                            key={token.contractId || `token-${Date.now()}-${Math.random()}`}
                            className="block border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                        >
                            <div className="flex items-center space-x-4">
                                {token.image && (
                                    <div className="relative w-12 h-12 rounded-full overflow-hidden bg-muted">
                                        <img
                                            src={token.image}
                                            alt={token.name || 'Token'}
                                            className="object-cover w-full h-full"
                                        />
                                    </div>
                                )}
                                <div>
                                    <h3 className="font-semibold">{token.name}</h3>
                                    <p className="text-sm text-muted-foreground">{token.symbol}</p>
                                </div>
                            </div>
                            <div className="mt-4">
                                <div className="text-xs text-muted-foreground truncate">
                                    {token.contractId}
                                </div>
                            </div>
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
} 
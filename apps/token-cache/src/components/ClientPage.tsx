'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { TokenMetadata } from "@repo/cryptonomicon";
import TokenList from './TokenList';
import { getAllTokenData } from "@/lib/tokenService";

export default function ClientPage({ initialTokens = [] }: { initialTokens?: TokenMetadata[] }) {
    const searchParams = useSearchParams();
    const [tokens, setTokens] = useState<TokenMetadata[]>(initialTokens);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(initialTokens.length === 0);
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Effect to handle URL search parameters
    useEffect(() => {
        const urlSearchParam = searchParams.get('search');
        const contractIdParam = searchParams.get('contractId');

        // Prioritize search over contractId param (if both exist)
        const searchTerm = urlSearchParam || contractIdParam || '';
        setSearchTerm(searchTerm);
    }, [searchParams]);

    // Effect to fetch token data if not provided
    useEffect(() => {
        if (initialTokens.length === 0) {
            const fetchData = async () => {
                try {
                    const data = await getAllTokenData();
                    setTokens(data);
                } catch (error) {
                    console.error('Error fetching tokens:', error);
                } finally {
                    setIsLoading(false);
                }
            };

            fetchData();
        }
    }, [initialTokens]);

    // Get an example contract ID for the API link, if tokens exist
    const exampleContractId = tokens.length > 0 ? tokens[0].contract_principal : null;
    const exampleApiUrl = exampleContractId ? `/api/v1/sip10/${exampleContractId}` : null;
    const exampleSearchUrl = exampleContractId ? `/?search=${exampleContractId}` : null;

    return (
        <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 md:p-16 bg-gray-50 dark:bg-gray-900">
            {/* Main content container with max width */}
            <div className="w-full max-w-6xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-center">SIP-10 Token Cache</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">Explore and interact with Stacks SIP-10 fungible tokens</p>
                </header>

                {/* Introduction Text - Responsive Box */}
                <div className="w-full text-left text-sm text-gray-600 dark:text-gray-400 mb-8 space-y-4 border border-gray-200 dark:border-gray-700 p-4 sm:p-6 rounded-lg bg-white dark:bg-gray-800/30 shadow-sm">
                    <p className="flex items-start gap-3">
                        <span className="text-lg mt-0.5 flex-shrink-0">🧱</span>
                        <span className="break-words">
                            This tool displays information for SIP-10 Fungible Tokens on the Stacks blockchain.
                            Data is fetched using the Cryptonomicon library and cached via Vercel KV.
                        </span>
                    </p>
                    <p className="flex items-start gap-3">
                        <span className="text-lg mt-0.5 flex-shrink-0">🔍</span>
                        <span className="break-words">
                            You can search for tokens by name, symbol, or contract ID. If a token isn't listed, searching by its full contract ID
                            (e.g., <code className="break-all text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token</code>) and clicking the "Lookup" button will attempt to fetch its data and add it to the list.
                        </span>
                    </p>
                    <p className="flex items-start gap-3">
                        <span className="text-lg mt-0.5 flex-shrink-0">🔗</span>
                        <span className="break-words">
                            You can directly link to a specific token by using the <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">?search=</code> URL parameter with the contract ID.
                            {exampleSearchUrl && (
                                <>
                                    {' '}
                                    Example:
                                    <Link href={exampleSearchUrl} className="text-blue-500 hover:underline ml-1 break-all text-xs">
                                        <code>{exampleSearchUrl}</code>
                                    </Link>
                                </>
                            )}
                        </span>
                    </p>
                    <p className="flex items-start gap-3">
                        <span className="text-lg mt-0.5 flex-shrink-0">🔌</span>
                        <span className="break-words">
                            Token data is also available via a public API endpoint: <code className="break-all text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">/api/v1/sip10/[contractId]</code>.
                            {exampleApiUrl && (
                                <>
                                    {' '}
                                    Example:
                                    <Link href={exampleApiUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline ml-1 break-all text-xs">
                                        <code>{exampleApiUrl}</code>
                                    </Link>
                                </>
                            )}
                        </span>
                    </p>
                </div>

                {/* Loading state or TokenList */}
                {isLoading ? (
                    <div className="text-center py-8">Loading tokens...</div>
                ) : (
                    <TokenList
                        initialTokens={tokens}
                        isDevelopment={isDevelopment}
                        initialSearchTerm={searchTerm}
                    />
                )}

                {/* Simple footer */}
                <footer className="mt-12 text-center text-xs text-gray-500 dark:text-gray-400 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <p>SIP-10 Token Explorer &copy; {new Date().getFullYear()}</p>
                </footer>
            </div>
        </main>
    );
} 
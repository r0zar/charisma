'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { TokenMetadata } from "@repo/cryptonomicon";
import TokenList from './TokenList';
import { getAllTokenData } from "@/lib/tokenService";
import { Card, CardContent } from "@/components/ui/card";
import { Info } from 'lucide-react';

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
        const term = urlSearchParam || contractIdParam || '';
        setSearchTerm(term);
    }, [searchParams]);

    // Effect to fetch token data if not provided
    useEffect(() => {
        if (initialTokens.length === 0) {
            const fetchData = async () => {
                setIsLoading(true);
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
        <div className="w-full">
            <Card className="mb-8">
                <CardContent className="text-sm space-y-3">
                    <p className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">
                            This list displays cached SIP-10 token metadata. Use the search below or the
                            <Link href="/inspect" className="text-primary hover:underline mx-1">Inspector Tool</Link>
                            to check specific contract IDs.
                        </span>
                    </p>
                    <p className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">
                            API Endpoint: <code className="bg-muted px-1 py-0.5 rounded">/api/v1/sip10/[contractId]</code>
                            {exampleApiUrl && (
                                <Link href={exampleApiUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1 break-all text-xs">
                                    (Example)
                                </Link>
                            )}
                        </span>
                    </p>
                </CardContent>
            </Card>

            {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading tokens...</div>
            ) : (
                <TokenList
                    initialTokens={tokens}
                    isDevelopment={isDevelopment}
                    initialSearchTerm={searchTerm}
                />
            )}
        </div>
    );
} 
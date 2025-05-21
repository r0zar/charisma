'use client';

import Link from 'next/link';
import TokenList from './TokenList';
import { Card, CardContent } from "@/components/ui/card";
import { Info } from 'lucide-react';
import { TokenCacheData } from '@repo/tokens';

export default function ClientPage({ initialTokens = [] }: { initialTokens?: TokenCacheData[] }) {
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Get an example contract ID for the API link, if tokens exist
    const exampleContractId = initialTokens.length > 0 ? initialTokens[0].contractId : null;
    const exampleApiUrl = exampleContractId ? `/api/v1/sip10/${exampleContractId}` : null;

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

            <TokenList
                initialTokens={initialTokens}
                isDevelopment={isDevelopment}
            />
        </div>
    );
} 
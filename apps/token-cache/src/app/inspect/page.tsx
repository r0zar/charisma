import React from 'react';
import TokenInspector from '@/components/TokenInspector';
import { Metadata } from 'next';
import { Search } from 'lucide-react';

// Basic metadata for the page
export const metadata: Metadata = {
    title: 'Inspect Token Cache | Charisma',
    description: 'Inspect raw and cached token metadata.',
};

export default function InspectPage() {
    return (
        <main className="container py-8">
            <div className="flex items-center gap-3 mb-6">
                <Search className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold">Token Cache Inspector</h1>
            </div>
            <p className="text-muted-foreground mb-6 max-w-2xl">
                Use this tool to inspect the raw data fetched directly from the source (Cryptonomicon)
                and compare it with the currently cached data in Vercel KV. You can also force a refresh of the cache.
            </p>

            {/* Render the inspector component */}
            <TokenInspector />
        </main>
    );
} 
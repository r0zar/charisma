'use client';

import dynamic from 'next/dynamic';
import { TokenMetadata } from "@repo/cryptonomicon";

// Import ClientPage with dynamic import and disable SSR to avoid useSearchParams issues
const ClientPage = dynamic(() => import('./ClientPage'), {
    ssr: false, // crucial to avoid useSearchParams error during build
    loading: () => <div className="text-center py-8">Loading application...</div>
});

interface ClientWrapperProps {
    initialTokens: TokenMetadata[];
}

// This is just a thin client wrapper around the dynamic import
export default function ClientWrapper({ initialTokens }: ClientWrapperProps) {
    return <ClientPage initialTokens={initialTokens} />;
} 
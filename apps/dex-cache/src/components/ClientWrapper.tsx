'use client';

import dynamic from 'next/dynamic';
import { Vault } from '@repo/dexterity';

const ClientPage = dynamic(() => import('./ClientPage'), {
    ssr: false,
    loading: () => <div className="text-center py-8">Loading application...</div>,
});

interface Props {
    initialVaults: Vault[];
}

export default function ClientWrapper({ initialVaults }: Props) {
    return <ClientPage initialVaults={initialVaults} />;
} 
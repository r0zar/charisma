import React from 'react';
import PoolImporter from '@/components/PoolImporter';
import { ListPlus } from 'lucide-react';

export default function ListingPage() {
    return (
        <main className="container py-8">
            <div className="flex items-center gap-3 mb-6">
                <ListPlus className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold">Manage Vault Listings</h1>
            </div>
            <p className="text-muted-foreground mb-6 max-w-2xl">
                Use this tool to preview and add new liquidity pool vaults (LP tokens) to the Charisma Invest directory.
                Enter the contract ID of the LP token to begin the preview process.
            </p>

            <PoolImporter />
        </main>
    );
} 
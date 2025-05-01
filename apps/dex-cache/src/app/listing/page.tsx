'use client'; // PoolImporter uses client-side hooks

import React from 'react';
import PoolImporter from '@/components/PoolImporter';
import { Metadata } from 'next';
import { ListPlus } from 'lucide-react'; // Import an icon

// Basic metadata for the page
// export const metadata: Metadata = {
//   title: 'Manage Vault Listings | Charisma Invest',
//   description: 'Add, preview, and manage vault listings for Charisma Invest.',
// };
// Note: Metadata API currently doesn't work in Client Components.
// It needs to be exported from a Server Component, possibly the layout or a parent page.

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

            {/* Render the importer component */}
            <PoolImporter />
            {/* PoolImporter seems to have its own main container and padding, 
                so we don't need extra wrapping here. If it causes layout issues,
                we might need to adjust PoolImporter or add specific styling here. */}
        </main>
    );
} 
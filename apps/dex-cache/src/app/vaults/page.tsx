import React from 'react';
import VaultList from '@/components/VaultList';
import { Metadata } from 'next';
import { Coins } from 'lucide-react';
import { getAllVaultData } from '@/lib/pool-service';

// export const dynamic = 'force-dynamic';

// Define metadata for better SEO
export const metadata: Metadata = {
  title: 'Explore Pools | Charisma Invest',
  description: 'Browse and analyze liquidity pools available on the Stacks network through Charisma Invest.',
  keywords: 'Stacks, LP, Vault, Liquidity Pool, DeFi, Charisma, Invest, DEX, Pools',
  openGraph: {
    title: 'Charisma Invest - Explore Pools',
    description: 'Browse and analyze Stacks liquidity pools',
    type: 'website',
  },
};

export default async function ExplorePoolsPage() {

  const vaults = await getAllVaultData();

  return (
    <main className="flex-1 container py-8">
      <div className="flex items-center gap-3 mb-6">
        <Coins className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Explore Vaults</h1>
      </div>
      <p className="text-muted-foreground mb-6 max-w-2xl">
        Browse the available liquidity pools below. Click on a pool for more details or to manage your liquidity.
      </p>

      {/* Render the VaultList component with the fetched vaults */}
      {/* VaultList fetches its own prices client-side */}
      <VaultList vaults={vaults} />
    </main>
  );
}

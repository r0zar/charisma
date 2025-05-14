import React from 'react';
import { Metadata } from 'next';
import { Coins } from 'lucide-react';
import { getAllVaults } from '@/lib/vaultService';
import SublinkList from '@/components/SublinkList';

// export const dynamic = 'force-dynamic';

// Define metadata for better SEO
export const metadata: Metadata = {
  title: 'Explore Sublinks | Charisma Invest',
  description: 'Browse and analyze sublinks available on the Stacks network through Charisma Invest.',
  keywords: 'Stacks, LP, Vault, Liquidity Pool, DeFi, Charisma, Invest, DEX, Pools',
  openGraph: {
    title: 'Charisma Invest - Explore Sublinks',
    description: 'Browse and analyze Blaze sublinks',
    type: 'website',
  },
};

export default async function ExplorePoolsPage() {

  const { sublinks } = await getAllVaults();

  return (
    <main className="flex-1 container py-8">
      <div className="flex items-center gap-3 mb-6">
        <Coins className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Explore Subnets</h1>
      </div>
      <p className="text-muted-foreground mb-6 max-w-3xl">
        Subnets upgrade tokens to create an off-chain execution environment for decentralized applications.
      </p>

      {/* Render the VaultList component with the fetched vaults */}
      {/* VaultList fetches its own prices client-side */}
      <SublinkList vaults={sublinks} />
    </main>
  );
}

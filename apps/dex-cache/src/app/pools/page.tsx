import React from 'react';
import { getVaultIds, getVault } from "../actions";
import VaultList from '@/components/VaultList';
import { Metadata } from 'next';
import { Coins } from 'lucide-react';

interface Vault {
  name: string;
  symbol: string;
  description: string;
  image: string;
  fee: number;
  externalPoolId: string;
  engineContractId: string;
}

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
  let vaults: Vault[] = [];
  let fetchError: string | null = null;

  try {
    // 1. Fetch all managed vault IDs
    const vaultIds = await getVaultIds();

    // 2. Fetch details for each vault concurrently
    const vaultPromises = vaultIds.map(id => getVault(id));
    const vaultResults = await Promise.all(vaultPromises);

    // 3. Filter out any null results (vaults that couldn't be fetched)
    vaults = vaultResults.filter((v) => v !== null);

  } catch (error: any) {
    console.error("Error fetching vault data for pools page:", error);
    fetchError = error.message || "Failed to load pool data.";
  }

  // Render error state if fetching failed
  if (fetchError) {
    return (
      <main className="flex-1 container py-8">
        <p className="text-center text-red-500">{fetchError}</p>
      </main>
    );
  }

  return (
    <main className="flex-1 container py-8">
      <div className="flex items-center gap-3 mb-6">
        <Coins className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Explore Liquidity Pools</h1>
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

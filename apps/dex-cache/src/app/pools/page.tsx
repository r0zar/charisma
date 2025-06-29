import React from 'react';
import { Metadata } from 'next';
import { Coins } from 'lucide-react';
import PoolList from '@/components/PoolList';
import { getAllVaultData } from '@/lib/pool-service';
import AddNewPoolButton from '@/components/pool/AddNewPoolButton';
import { AddLiquidityWizard } from '@/components/pool/add-liquidity-wizard-dialog';
import { listPrices } from '@repo/tokens';

// export const dynamic = "force-dynamic";

// Define metadata for better SEO
export const metadata: Metadata = {
  title: 'Add Liquidity | Charisma Invest',
  description: 'Add liquidity to a pool with a single click. Charisma Invest makes it easy to add liquidity to a pool.',
  keywords: 'Stacks, LP, Vault, Liquidity Pool, DeFi, Charisma, Invest, DEX, Pools, Add Liquidity',
  openGraph: {
    title: "Charisma Invest | Add Liquidity Easily",
    description: "Add liquidity to a pool with a single click. Charisma Invest makes it easy to add liquidity to a pool.",
    url: 'https://invest.charisma.rocks/pools',
    siteName: 'Charisma Invest',
    images: [
      {
        url: '/add-lp.png',
        width: 953,
        height: 529,
        alt: 'Earn yield by adding liquidity to a pool',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Charisma Invest | Add Liquidity Easily",
    description: "Add liquidity to a pool with a single click. Charisma Invest makes it easy to add liquidity to a pool.",
    images: ['/add-lp.png'],
  },
};

export default async function ExplorePoolsPage() {
  const pools = await getAllVaultData({ type: 'POOL' });
  const prices = await listPrices();

  return (
    <main className="flex-1 container py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Coins className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Explore Liquidity Pools</h1>
        </div>
        <div className="flex items-center gap-3">
          <AddLiquidityWizard pools={pools} prices={prices} />
          <AddNewPoolButton />
        </div>
      </div>
      <p className="text-muted-foreground mb-6 max-w-2xl">
        Liquidity pools are essential for the Stacks ecosystem because they allow users to swap between tokens.
        By adding liquidity to a pool, you are providing a service to the pool and earning a fee for doing so.
      </p>
      <PoolList vaults={pools} />
    </main>
  );
}

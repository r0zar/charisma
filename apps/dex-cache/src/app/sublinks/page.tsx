import React from 'react';
import { Metadata } from 'next';
import { ArrowRightLeft, Flame } from 'lucide-react';
import { getAllVaults, Vault } from '@/lib/vaultService';
import SublinkList from '@/components/SublinkList';
import { getSubnetTokenBalance } from '@/app/actions';
import { listPrices, KraxelPriceData } from '@repo/tokens';

// Replace dynamic rendering with time-based revalidation
// This will cache the page for 5 minutes (300 seconds)
export const revalidate = 300;

// Define metadata for better SEO
export const metadata: Metadata = {
  title: 'Subnet Bridges | Charisma Invest',
  description: 'Bridge your tokens between Stacks mainnet and subnets for enhanced DeFi capabilities.',
  keywords: 'Stacks, Subnet, Bridge, Cross-chain, Token Bridge, DeFi, Charisma, Invest',
  openGraph: {
    title: 'Charisma Invest - Subnet Bridges',
    description: 'Bridge your tokens between Stacks mainnet and subnets',
    type: 'website',
  },
};

// Add a proper type declaration for the TvlData
interface TvlData {
  tokenBalance: number;
  tokenPrice: number;
  tvlUsd: number;
}

// Enhanced Vault type with TVL data
interface EnhancedVault extends Vault {
  tvlData?: TvlData;
}

// Create a server-side cache that won't be exposed to the client
// This is a better approach than using the global object directly
const tvlCache = new Map<string, TvlData>();

// Optimize the TVL fetching with better error handling and batch processing
async function enrichSublinksWithTvl(
  sublinks: Vault[],
  prices: KraxelPriceData
): Promise<EnhancedVault[]> {
  if (!sublinks || sublinks.length === 0) return [];

  console.log(`Enriching ${sublinks.length} sublinks with TVL data`);

  // Process sublinks in batches to avoid too many concurrent requests
  const batchSize = 5;
  const enrichedSublinks: EnhancedVault[] = [];

  // Process sublinks in batches
  for (let i = 0; i < sublinks.length; i += batchSize) {
    const batch = sublinks.slice(i, i + batchSize);
    console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(sublinks.length / batchSize)}`);

    const batchPromises = batch.map(async (sublink: Vault) => {
      try {
        // Get the subnet token balance for each sublink
        const result = await getSubnetTokenBalance(
          sublink.contractId,
          sublink.tokenA.contractId
        );

        if (result.success && result.balance !== undefined) {
          // Get token decimals from the result or fall back to the token's decimals
          const tokenDecimals = result.tokenDecimals || sublink.tokenA.decimals || 6;
          // Convert from micro units to standard units
          const tokenBalance = result.balance / Math.pow(10, tokenDecimals);

          // Calculate USD value if a price is available
          const tokenPrice = prices?.[sublink.tokenA.contractId] || 0;
          const tvlUsd = tokenBalance * tokenPrice;

          console.log(`Subnet ${sublink.contractId} TVL: ${tokenBalance.toFixed(6)} tokens at $${tokenPrice.toFixed(2)} = $${tvlUsd.toFixed(2)}`);

          // Return enhanced sublink with TVL data
          return {
            ...sublink,
            // Update reservesA with the actual token balance
            reservesA: result.balance,
            // Set reservesB to 0 since we're only tracking the main token
            reservesB: 0,
            // Add extra TVL information
            tvlData: {
              tokenBalance,
              tokenPrice,
              tvlUsd
            }
          };
        }

        return sublink as EnhancedVault;
      } catch (error) {
        console.error(`Error enriching TVL for sublink ${sublink.contractId}:`, error);
        return sublink as EnhancedVault;
      }
    });

    // Wait for the current batch to complete
    const batchResults = await Promise.all(batchPromises);
    enrichedSublinks.push(...batchResults);
  }

  return enrichedSublinks;
}

export default async function ExploreSubnetsPage() {
  // STEP 1: First, quickly get the basic data
  const [{ sublinks }, prices] = await Promise.all([
    getAllVaults(),
    listPrices()
  ]);

  // STEP 2: Now enrich the data with TVL information
  // If this takes time, at least we've already got the basic data to render
  const enrichedSublinks = await enrichSublinksWithTvl(sublinks, prices);

  // Performance optimization: use a Map-based caching approach
  // to preserve previous TVL values across page loads
  const cachedSublinks = enrichedSublinks.map(sublink => {
    // If a sublink doesn't have TVL data, check if we have it in our cache
    if (!sublink.tvlData && tvlCache.has(sublink.contractId)) {
      console.log(`Using cached TVL data for ${sublink.contractId}`);
      return {
        ...sublink,
        tvlData: tvlCache.get(sublink.contractId)
      };
    }

    // Cache the TVL data for future use
    if (sublink.tvlData) {
      tvlCache.set(sublink.contractId, sublink.tvlData);
    }

    return sublink;
  });

  return (
    <main className="flex-1 container py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="relative">
          <ArrowRightLeft className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Subnets</h1>
      </div>
      <p className="text-muted-foreground mb-6 max-w-3xl">
        Subnet bridges allow you to transfer tokens between the Stacks mainnet and subnet environments.
        This enables off-chain execution for decentralized applications while maintaining the security
        of your assets on the Stacks blockchain.
      </p>

      {/* Pass both vaults and prices to the SublinkList component */}
      <SublinkList vaults={cachedSublinks} prices={prices} />
    </main>
  );
}

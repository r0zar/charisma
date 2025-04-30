import { getVaultIds, getVault } from "./actions";
import ClientWrapper from "@/components/ClientWrapper";
import { Vault } from "@repo/dexterity";
import { Metadata } from 'next';

// Define metadata for better SEO
export const metadata: Metadata = {
  title: 'DEX Cache | Stacks Blockchain',
  description: 'Explore LP tokens on the Stacks blockchain. Search, view and access token data via API.',
  keywords: 'Stacks, LP, Fungible Token, Blockchain, Explorer, API',
  openGraph: {
    title: 'DEX Cache',
    description: 'Explore LP tokens on the Stacks blockchain',
    type: 'website',
  },
};

export default async function Home() {
  // Get the list of vault IDs
  const vaultIds = await getVaultIds();

  // Fetch each vault individually
  const vaultsPromises = vaultIds.map(id => getVault(id));
  const vaultsResponses = await Promise.all(vaultsPromises);

  // Filter out nulls and cast to Vault[] (nulls are removed by filter(Boolean))
  const vaults = vaultsResponses.filter(Boolean) as Vault[];

  return <ClientWrapper initialVaults={vaults} />;
}

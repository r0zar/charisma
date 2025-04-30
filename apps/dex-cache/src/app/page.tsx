import { getAllVaultData } from "@/lib/vaultService";
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
  // Fetch all vault data using the optimized service
  const vaults = await getAllVaultData();

  // Filter out nulls just in case, though getAllVaultData should handle this
  const validVaults = vaults.filter(Boolean) as Vault[];

  return <ClientWrapper initialVaults={validVaults} />;
}

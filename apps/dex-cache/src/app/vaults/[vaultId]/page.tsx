import { notFound } from 'next/navigation';
import { getVaultData } from '@/lib/vaultService'; // Assuming vaultService is in lib
import VaultDetailClient from '@/components/vault/vault-detail-client'; // Client component placeholder
import { listPrices } from '@repo/tokens'; // Hypothetical import

// Revalidate data periodically (e.g., every 5 minutes)
export const revalidate = 300;

interface VaultPageProps {
    params: {
        vaultId: string;
    };
}

async function fetchVaultAnalytics(vaultId: string): Promise<any> {
    console.warn(`Using MOCK fetchVaultAnalytics for ${vaultId}`);
    // Replace with actual API call to analytics service
    await new Promise(resolve => setTimeout(resolve, 150)); // Simulate network delay
    const mockTvl = Math.random() * 1000000;
    return {
        tvl: mockTvl,
        volume24h: mockTvl * (Math.random() * 0.1 + 0.05), // 5-15% of TVL
        apy: Math.random() * 50, // 0-50% APY
        lpHolders: Math.floor(Math.random() * 500) + 10,
        // Add historical data if needed for charts
    };
}
// --- End Mock Fetching ---


export default async function VaultPage({ params }: VaultPageProps) {
    const vaultId = await params.vaultId;

    // Basic validation
    if (!vaultId || !vaultId.includes('.')) {
        console.error("Invalid vaultId in route:", vaultId);
        notFound();
    }

    console.log(`Rendering page for vault: ${vaultId}`);

    const [vaultData, prices, analytics] = await Promise.all([
        getVaultData(vaultId),
        listPrices(), // TODO: Replace mock
        fetchVaultAnalytics(vaultId), // TODO: Replace mock
    ]);

    if (!vaultData) {
        console.error(`Vault data not found for ${vaultId}`);
        notFound(); // Triggers the not-found page
    }

    // Ensure reserves are numbers before passing
    const cleanVaultData = {
        ...vaultData,
        reservesA: Number(vaultData.reservesA ?? 0),
        reservesB: Number(vaultData.reservesB ?? 0),
    };


    return (
        <VaultDetailClient
            vault={cleanVaultData}
            prices={prices}
            analytics={analytics}
        />
    );
}

// Optional: Generate static paths if you have a known list of vaults
// export async function generateStaticParams() {
//   const vaultIds = await getManagedVaultIds(); // Fetch from vaultService
//   return vaultIds.map((id) => ({
//     vaultId: id,
//   }));
// } 
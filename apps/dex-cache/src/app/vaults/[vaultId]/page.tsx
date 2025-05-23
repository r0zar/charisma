import { notFound } from 'next/navigation';
import { getVaultData, Vault } from '@/lib/pool-service'; // Assuming vaultService is in lib
import VaultDetailClient from '@/components/pool/vault-detail-client'; // Client component placeholder
import { listPrices, KraxelPriceData } from '@repo/tokens'; // Hypothetical import
import { fetchContractInfo } from '@/app/actions';

// Revalidate data periodically (e.g., every 5 minutes)
export const revalidate = 300;

interface VaultPageProps {
    params: {
        vaultId: string;
    };
}

// Calculate USD value based on token amount and price
const calculateUsdValue = (amount: number, decimals: number, contractId: string, prices: KraxelPriceData | null): number | null => {
    if (!prices || !contractId) return null;

    const price = prices[contractId];
    if (!price) return null;

    const tokenUnits = amount / Math.pow(10, decimals);
    return tokenUnits * price;
};

async function fetchVaultAnalytics(vaultId: string, vault: any, prices: KraxelPriceData | null): Promise<any> {
    console.warn(`Calculating TVL for ${vaultId}`);

    // Calculate real TVL using the same logic as in VaultList
    const usdValueA = calculateUsdValue(
        vault.reservesA || 0,
        vault.tokenA.decimals || 0,
        vault.tokenA.contractId,
        prices
    );

    const usdValueB = calculateUsdValue(
        vault.reservesB || 0,
        vault.tokenB.decimals || 0,
        vault.tokenB.contractId,
        prices
    );

    // Calculate TVL from available token values (handle missing prices gracefully)
    let tvl = 0;
    if (usdValueA !== null) tvl += usdValueA;
    if (usdValueB !== null) tvl += usdValueB;

    return {
        tvl,
        // Other metrics are omitted since we don't have real data yet
    };
}

export default async function VaultPage({ params }: VaultPageProps) {
    const { vaultId } = await params;

    // Basic validation
    if (!vaultId || !vaultId.includes('.')) {
        console.error("Invalid vaultId in route:", vaultId);
        notFound();
    }

    console.log(`Rendering page for vault: ${vaultId}`);

    try {
        // Fetch the vault data and prices
        const [vaultData, prices, contractInfo] = await Promise.all([
            getVaultData(vaultId),
            listPrices(),
            fetchContractInfo(vaultId),
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
            // Ensure token images are strings
            tokenA: {
                ...vaultData.tokenA,
                image: vaultData.tokenA?.image || '', // Default to empty string
            },
            tokenB: {
                ...vaultData.tokenB,
                image: vaultData.tokenB?.image || '', // Default to empty string
            },
        };

        // Calculate analytics with real TVL
        const analytics = await fetchVaultAnalytics(vaultId, cleanVaultData, prices);

        return (
            <VaultDetailClient
                vault={cleanVaultData as any}
                prices={prices}
                analytics={analytics}
                contractInfo={contractInfo}
            />
        );
    } catch (error) {
        console.error(`Error fetching data for vault ${vaultId}:`, error);
        notFound();
    }
}

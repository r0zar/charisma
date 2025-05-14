import { notFound } from 'next/navigation';
import { getVaultData } from '@/lib/vaultService';
import SublinkDetailClient from '@/components/sublink/sublink-detail-client';
import { listPrices, KraxelPriceData } from '@repo/tokens';
import { fetchContractInfo } from '@/app/actions';

// Revalidate data periodically (e.g., every 5 minutes)
export const revalidate = 300;

interface SublinkPageProps {
    params: {
        contractId: string;
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

async function fetchSublinkAnalytics(sublinkId: string, sublink: any, prices: KraxelPriceData | null): Promise<any> {
    console.warn(`Calculating TVL for ${sublinkId}`);

    // Calculate real TVL using the same logic as in VaultList
    const usdValueA = calculateUsdValue(
        sublink.reservesA || 0,
        sublink.tokenA.decimals || 0,
        sublink.tokenA.contractId,
        prices
    );

    const usdValueB = calculateUsdValue(
        sublink.reservesB || 0,
        sublink.tokenB.decimals || 0,
        sublink.tokenB.contractId,
        prices
    );

    // Total TVL is the sum of both token values
    const tvl = (usdValueA !== null && usdValueB !== null)
        ? (usdValueA + usdValueB)
        : null;

    // Only return the real data we have
    return {
        tvl: tvl || 0,
        // Other metrics are omitted since we don't have real data yet
    };
}

export default async function SublinkPage({ params }: SublinkPageProps) {
    const { contractId } = await params;

    // Basic validation
    if (!contractId || !contractId.includes('.')) {
        console.error("Invalid contractId in route:", contractId);
        notFound();
    }

    console.log(`Rendering page for sublink: ${contractId}`);

    try {
        // Fetch the sublink data and prices
        const [sublinkData, prices, contractInfo] = await Promise.all([
            getVaultData(contractId),
            listPrices(),
            fetchContractInfo(contractId),
        ]);

        if (!sublinkData) {
            console.error(`Sublink data not found for ${contractId}`);
            notFound(); // Triggers the not-found page
        }

        // Verify this is a SUBLINK type
        if (sublinkData.type !== 'SUBLINK') {
            console.error(`Contract ${contractId} is not a SUBLINK type`);
            notFound();
        }

        // Ensure reserves are numbers before passing
        const cleanSublinkData = {
            ...sublinkData,
            reservesA: Number(sublinkData.reservesA ?? 0),
            reservesB: Number(sublinkData.reservesB ?? 0),
            // Ensure token images are strings
            tokenA: {
                ...sublinkData.tokenA,
                image: sublinkData.tokenA.image || '', // Default to empty string
            },
            tokenB: {
                ...sublinkData.tokenB,
                image: sublinkData.tokenB.image || '', // Default to empty string
            },
        };

        // Calculate analytics with real TVL
        const analytics = await fetchSublinkAnalytics(contractId, cleanSublinkData, prices);

        return (
            <SublinkDetailClient
                sublink={cleanSublinkData}
                prices={prices}
                analytics={analytics}
                contractInfo={contractInfo}
            />
        );
    } catch (error) {
        console.error(`Error fetching data for sublink ${contractId}:`, error);
        notFound();
    }
}
import EnergyVaultDetail from '@/components/hold-to-earn/EnergyVaultDetail';

interface EnergyVaultDetailPageProps {
    params: {
        contractId: string;
    };
}

export default async function EnergyVaultDetailPage({ params }: EnergyVaultDetailPageProps) {
    const { contractId } = await params;
    return (
        <div className="container mx-auto py-8">
            <EnergyVaultDetail contractId={contractId} />
        </div>
    );
} 
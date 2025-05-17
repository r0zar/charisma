import EnergyVaultDetail from '@/components/EnergyVaultDetail';

interface EnergyVaultDetailPageProps {
    params: {
        contractId: string;
    };
}

export default function EnergyVaultDetailPage({ params }: EnergyVaultDetailPageProps) {
    return (
        <div className="container mx-auto py-8">
            <EnergyVaultDetail contractId={params.contractId} />
        </div>
    );
} 
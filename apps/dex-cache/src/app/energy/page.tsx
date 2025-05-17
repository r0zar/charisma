import EnergyVaultList from '@/components/hold-to-earn/EnergyVaultList';

export default function EnergyPage() {
    return (
        <div className="container mx-auto py-8">
            <h1 className="text-3xl font-bold mb-6 text-primary">Energy Vaults</h1>
            <EnergyVaultList />
        </div>
    );
} 
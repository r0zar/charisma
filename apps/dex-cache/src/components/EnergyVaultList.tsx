'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from 'lucide-react';

// Re-using the Vault interface from PoolImporter or a shared location
// For now, let's define it here. Ideally, this would be in a shared types file.
interface Vault {
    contractId: string;
    type?: string;
    name: string;
    symbol?: string;
    description: string;
    image: string;
    fee: number; // Assuming fee might be relevant for display
    // Add any other fields relevant for an ENERGY vault card
}

// Mock function to fetch vaults - replace with actual API call
async function fetchEnergyVaults(): Promise<Vault[]> {
    console.log('Fetching energy vaults...');
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // TODO: Replace with actual API call to fetch vaults and filter by type 'ENERGY'
    // For now, returning mock data
    const mockVaults: Vault[] = [
        {
            contractId: 'SP123.energy-vault-1',
            type: 'ENERGY',
            name: 'Solar Farm Rewards',
            symbol: 'SOLAR',
            description: 'Earn rewards by staking in the solar farm project.',
            image: 'https://via.placeholder.com/150/FFFF00/000000?Text=SOLAR',
            fee: 0.1
        },
        {
            contractId: 'SP456.wind-turbine-yield',
            type: 'ENERGY',
            name: 'Wind Turbine Yield',
            symbol: 'WINDY',
            description: 'Stake and get yield from wind energy generation.',
            image: 'https://via.placeholder.com/150/ADD8E6/000000?Text=WINDY',
            fee: 0.05
        },
        {
            contractId: 'SP789.geo-power-stake',
            type: 'POOL', // This one should be filtered out if fetching all and then filtering
            name: 'Geothermal Pool',
            symbol: 'GEO',
            description: 'A standard liquidity pool.',
            image: 'https://via.placeholder.com/150/D2B48C/000000?Text=GEO',
            fee: 0.3
        }
    ];
    return mockVaults.filter(v => v.type === 'ENERGY');
}

export default function EnergyVaultList() {
    const [vaults, setVaults] = useState<Vault[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadVaults() {
            try {
                setIsLoading(true);
                const fetchedVaults = await fetchEnergyVaults();
                setVaults(fetchedVaults);
            } catch (err) {
                setError('Failed to load energy vaults.');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        }
        loadVaults();
    }, []);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2">Loading energy vaults...</p>
            </div>
        );
    }

    if (error) {
        return <p className="text-red-500 text-center">{error}</p>;
    }

    if (vaults.length === 0) {
        return <p className="text-center text-muted-foreground">No energy vaults found.</p>;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vaults.map((vault) => (
                <Link href={`/energy/${vault.contractId}`} key={vault.contractId} passHref>
                    <Card className="hover:shadow-lg transition-shadow duration-200 cursor-pointer h-full flex flex-col">
                        <CardHeader className="flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-xl">{vault.name}</CardTitle>
                                {vault.symbol && <Badge variant="outline">{vault.symbol}</Badge>}
                            </div>
                        </CardHeader>
                        <CardContent className="flex-grow flex flex-col justify-between">
                            <div className="flex items-center mb-4">
                                <img src={vault.image || 'https://via.placeholder.com/64'} alt={vault.name} className="w-16 h-16 rounded-md mr-4 object-cover bg-muted" />
                                <p className="text-sm text-muted-foreground line-clamp-3">{vault.description}</p>
                            </div>
                            <div>
                                {/* Add more vault details here if needed, e.g., fee, TVL, APR etc. */}
                                {typeof vault.fee === 'number' && (
                                    <p className="text-xs text-muted-foreground">Fee: {vault.fee}%</p>
                                )}
                                <Badge variant="secondary" className="mt-2">Type: {vault.type}</Badge>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            ))}
        </div>
    );
} 
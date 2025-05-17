'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';

// Re-using the Vault interface or a shared one
interface Vault {
    contractId: string;
    type?: string;
    name: string;
    symbol?: string;
    description: string;
    image: string;
    fee: number;
    externalPoolId?: string;
    engineContractId?: string;
    reservesA?: number; // May not be relevant for ENERGY type
    reservesB?: number; // May not be relevant for ENERGY type
    // Add any other fields specific to an ENERGY vault's detail view
    metadata?: Record<string, any>; // For any extra details
}

// Mock function to fetch a single vault's details - replace with actual API call
async function fetchVaultDetails(contractId: string): Promise<Vault | null> {
    console.log(`Fetching details for energy vault: ${contractId}`);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // TODO: Replace with actual API call to fetch a specific vault by its contractId
    // For now, returning mock data based on the ID
    if (contractId === 'SP123.energy-vault-1') {
        return {
            contractId: 'SP123.energy-vault-1',
            type: 'ENERGY',
            name: 'Solar Farm Rewards',
            symbol: 'SOLAR',
            description: 'Earn rewards by staking in the solar farm project. This vault focuses on renewable energy credits and provides a steady APY through staking SOLAR tokens.',
            image: 'https://via.placeholder.com/200/FFFF00/000000?Text=SOLAR',
            fee: 0.1,
            externalPoolId: 'ext-solar-farm-001',
            engineContractId: 'SPXYZ.staking-engine-v2',
            metadata: {
                apy: '5.75%',
                tvl: '$1,200,000',
                stakingToken: 'SOLAR',
                rewardToken: 'STX'
            }
        };
    }
    if (contractId === 'SP456.wind-turbine-yield') {
        return {
            contractId: 'SP456.wind-turbine-yield',
            type: 'ENERGY',
            name: 'Wind Turbine Yield',
            symbol: 'WINDY',
            description: 'Stake WINDY tokens and get yield from wind energy generation. This project contributes to green energy initiatives and offers competitive returns.',
            image: 'https://via.placeholder.com/200/ADD8E6/000000?Text=WINDY',
            fee: 0.05,
            metadata: {
                apy: '6.2%',
                tvl: '$850,000',
                stakingToken: 'WINDY',
                rewardToken: 'BTC'
            }
        };
    }
    return null;
}

interface EnergyVaultDetailProps {
    contractId: string;
}

export default function EnergyVaultDetail({ contractId }: EnergyVaultDetailProps) {
    const [vault, setVault] = useState<Vault | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!contractId) return;

        async function loadVaultDetails() {
            try {
                setIsLoading(true);
                const fetchedVault = await fetchVaultDetails(contractId);
                if (fetchedVault) {
                    setVault(fetchedVault);
                } else {
                    setError('Energy vault not found.');
                }
            } catch (err) {
                setError('Failed to load energy vault details.');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        }
        loadVaultDetails();
    }, [contractId]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2">Loading vault details...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center">
                <p className="text-red-500 mb-4">{error}</p>
                <Link href="/energy" passHref>
                    <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Energy Vaults</Button>
                </Link>
            </div>
        );
    }

    if (!vault) {
        return (
            <div className="text-center">
                <p className="text-muted-foreground mb-4">Vault data is not available.</p>
                <Link href="/energy" passHref>
                    <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Energy Vaults</Button>
                </Link>
            </div>
        );
    }

    return (
        <Card className="max-w-3xl mx-auto">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <Link href="/energy" passHref>
                            <Button variant="outline" size="sm" className="mb-4">
                                <ArrowLeft className="mr-2 h-4 w-4" /> Back to List
                            </Button>
                        </Link>
                        <CardTitle className="text-3xl font-bold text-primary">{vault.name}</CardTitle>
                        {vault.symbol && <Badge variant="secondary" className="mt-1">{vault.symbol}</Badge>}
                    </div>
                    <img src={vault.image || 'https://via.placeholder.com/100'} alt={vault.name} className="w-24 h-24 rounded-lg object-cover border bg-muted" />
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <CardDescription className="text-lg whitespace-pre-line">{vault.description}</CardDescription>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                        <h4 className="font-semibold text-muted-foreground mb-1">Contract ID</h4>
                        <p className="font-mono text-sm break-all">{vault.contractId}</p>
                    </div>
                    <div>
                        <h4 className="font-semibold text-muted-foreground mb-1">Type</h4>
                        <p><Badge>{vault.type || 'N/A'}</Badge></p>
                    </div>
                    {typeof vault.fee === 'number' && (
                        <div>
                            <h4 className="font-semibold text-muted-foreground mb-1">Fee</h4>
                            <p>{vault.fee}%</p>
                        </div>
                    )}
                    {vault.engineContractId && (
                        <div>
                            <h4 className="font-semibold text-muted-foreground mb-1">Engine Contract</h4>
                            <p className="font-mono text-sm break-all">{vault.engineContractId}</p>
                        </div>
                    )}
                </div>

                {vault.metadata && Object.keys(vault.metadata).length > 0 && (
                    <div className="pt-4 border-t">
                        <h3 className="text-xl font-semibold mb-3">Additional Details</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-sm">
                            {Object.entries(vault.metadata).map(([key, value]) => (
                                <div key={key}>
                                    <span className="font-medium capitalize text-muted-foreground">{key.replace(/_/g, ' ')}: </span>
                                    <span>{String(value)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
            {vault.externalPoolId && (
                <CardFooter className="border-t pt-6">
                    <Button variant="outline" asChild>
                        <a href={`https://explorer.hiro.so/txid/${vault.externalPoolId}?chain=mainnet`} target="_blank" rel="noopener noreferrer">
                            View on Explorer <ExternalLink className="ml-2 h-4 w-4" />
                        </a>
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
} 
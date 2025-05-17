'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, Coins } from 'lucide-react';
import { getTokenMetadataCached, TokenCacheData } from '@repo/tokens';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EnergyVaultCard } from './EnergyVaultCard';

// Re-using the Vault interface from PoolImporter or a shared location
// For now, let's define it here. Ideally, this would be in a shared types file.
interface Vault {
    contractId: string;
    type?: string;
    name: string;
    symbol?: string;
    description: string;
    image: string;
    // Add any other fields relevant for an ENERGY vault card
    // From API, we might also get other fields, but these are used in the list
    externalPoolId?: string;
    engineContractId?: string;
    reservesA?: number;
    reservesB?: number;
    tokenForRewards?: TokenCacheData; // Added token required for earning rewards
}

// Updated function to fetch vaults from the API
async function fetchEnergyVaults(): Promise<Vault[]> {
    console.log('Fetching ENERGY type vaults from API /api/v1/vaults?type=ENERGY');
    try {
        // Fetch specifically ENERGY type vaults
        const response = await fetch('/api/v1/vaults?type=ENERGY');
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'API request failed with no JSON body' }));
            throw new Error(`API request failed with status ${response.status}: ${errorData.message || response.statusText}`);
        }

        const responseData = await response.json();

        if (responseData.status === 'success' && Array.isArray(responseData.data)) {
            // Ensure essential fields are present for robust rendering
            const energyVaults = responseData.data.filter((vault: Vault) =>
                typeof vault.contractId === 'string' &&
                typeof vault.name === 'string' &&
                typeof vault.description === 'string' // image and fee are also used but might have fallbacks
            );
            console.log('Fetched and validated energy vaults:', energyVaults);
            return energyVaults;
        } else {
            console.error('API response was not successful or data is not an array:', responseData);
            throw new Error('Failed to fetch energy vaults: Invalid API response format.');
        }
    } catch (error) {
        console.error('Failed to fetch energy vaults:', error);
        throw error; // Re-throw to be caught by the component
    }
}

// Function to fetch token metadata
async function fetchTokenMetadata(vaults: Vault[]): Promise<Vault[]> {
    // Currently we know we need the dexterity-pool-v1 token info
    const dexterityTokenId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-pool-v1';

    try {
        const tokenMetadata = await getTokenMetadataCached(dexterityTokenId);
        console.log('Fetched token metadata:', tokenMetadata);

        // Add token metadata to each vault that uses this token for rewards
        return vaults.map(vault => ({
            ...vault,
            tokenForRewards: tokenMetadata
        }));
    } catch (error) {
        console.error('Failed to fetch token metadata:', error);
        return vaults; // Return vaults without token metadata on error
    }
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
                // Fetch and add token metadata for rewards
                const vaultsWithTokenInfo = await fetchTokenMetadata(fetchedVaults);
                setVaults(vaultsWithTokenInfo);
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {vaults.map((vault) => (
                <EnergyVaultCard key={vault.contractId} vault={vault} />
            ))}
        </div>
    );
} 
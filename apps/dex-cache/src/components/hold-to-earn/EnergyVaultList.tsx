'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, Coins } from 'lucide-react';
import { getTokenMetadataCached, TokenCacheData } from '@repo/tokens';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EnergyVaultCard } from './EnergyVaultCard';
import { fetchHoldToEarnVaults } from '@/lib/server/energy';

export default function EnergyVaultList() {
    const [vaults, setVaults] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadVaults() {
            try {
                setIsLoading(true);
                const fetchedVaults = await fetchHoldToEarnVaults();
                console.log('Fetched vaults:', fetchedVaults);
                setVaults(fetchedVaults);
            } catch (err) {
                setError('Failed to load Hold-to-Earn tokens.');
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
                <p className="ml-2">Loading Hold-to-Earn Tokens...</p>
            </div>
        );
    }

    if (error) {
        return <p className="text-red-500 text-center">{error}</p>;
    }

    if (vaults.length === 0) {
        return <p className="text-center text-muted-foreground">No Hold-to-Earn tokens found.</p>;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {vaults.map((vault) => (
                <EnergyVaultCard key={vault.contractId} vault={vault} />
            ))}
        </div>
    );
} 
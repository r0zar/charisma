'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/lib/context/app-context';
import type { EnergyTokenDashboardData } from '@/lib/server/energy';
import { getEnergyTokenMetadata } from '@/lib/server/energy';
import { TokenCacheData } from '@repo/tokens';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Activity, BarChart2, Zap, Clock, Archive, ZapIcon, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import Image from 'next/image';
import { getFungibleTokenBalance } from '@/lib/vaultService';

export default function UserEnergyDashboard() {
    const { stxAddress } = useApp();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userEnergyData, setUserEnergyData] = useState<EnergyTokenDashboardData[]>([]);
    const [energyMetadata, setEnergyMetadata] = useState<TokenCacheData | null>(null);
    const [energyBalance, setEnergyBalance] = useState<number>(0);

    // Fetch energy token metadata
    useEffect(() => {
        async function fetchEnergyMetadata() {
            try {
                const metadata = await getEnergyTokenMetadata();
                setEnergyMetadata(metadata);
            } catch (err) {
                console.error('Error fetching energy token metadata:', err);
            }
        }

        fetchEnergyMetadata();
    }, []);

    useEffect(() => {
        async function fetchUserEnergyData() {
            if (!stxAddress) {
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                setError(null);

                const response = await fetch(`/api/v1/energy/user-dashboard?address=${stxAddress}`);

                if (!response.ok) {
                    throw new Error(`Failed to fetch energy data: ${response.statusText}`);
                }

                const data = await response.json();
                setUserEnergyData(data);
            } catch (err) {
                console.error('Error fetching user energy data:', err);
                setError('Failed to load your energy data. Please try again later.');
            } finally {
                setIsLoading(false);
            }
        }

        fetchUserEnergyData();
    }, [stxAddress]);

    // load user energy balances
    useEffect(() => {
        async function getEnergyBalance() {
            if (!stxAddress) { return }
            const balance = await getFungibleTokenBalance('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energy', stxAddress);
            setEnergyBalance(balance);
        }
        getEnergyBalance();
    }, [stxAddress]);

    // Calculate aggregated stats across all tokens
    const aggregatedStats = userEnergyData.reduce((acc, token) => {
        return {
            totalAccumulatedEnergy: acc.totalAccumulatedEnergy + token.currentAccumulatedEnergy,
            totalEnergyRatePerHour: acc.totalEnergyRatePerHour + (token.estimatedEnergyRatePerSecond * 3600),
            totalTokens: acc.totalTokens + 1,
            totalHarvested: acc.totalHarvested + token.contractTotalEnergyHarvested,
            totalUniqueUsers: Math.max(acc.totalUniqueUsers, token.contractUniqueUsers), // Take the maximum as users might overlap
            latestUpdateTimestamp: Math.max(acc.latestUpdateTimestamp, token.lastRateCalculationTimestamp)
        };
    }, {
        totalAccumulatedEnergy: 0,
        totalEnergyRatePerHour: 0,
        totalTokens: 0,
        totalHarvested: 0,
        totalUniqueUsers: 0,
        latestUpdateTimestamp: 0
    });

    // Function to format energy values according to the token's decimals
    const formatEnergyValue = (value: number): string => {
        if (!energyMetadata) return value.toLocaleString();

        // Apply decimals from the energy token metadata
        const decimals = energyMetadata.decimals || 0;
        const divisor = Math.pow(10, decimals);
        const adjustedValue = value / divisor;

        return adjustedValue.toLocaleString(undefined, {
            maximumFractionDigits: 0
        });
    };

    if (isLoading) {
        return (
            <div className="py-12 text-center">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-8 w-64 bg-muted rounded mb-4"></div>
                    <div className="h-48 w-full max-w-md bg-muted rounded"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <Card className="p-6 text-center">
                <Activity className="h-12 w-12 text-destructive mx-auto mb-4" />
                <CardTitle className="mb-2">Error Loading Energy Data</CardTitle>
                <CardDescription>
                    {error}
                </CardDescription>
            </Card>
        );
    }

    // Not logged in state
    if (!stxAddress) {
        return (
            <Card className="p-6 text-center">
                <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <CardTitle className="mb-2">Connect Your Wallet</CardTitle>
                <CardDescription>
                    Connect your wallet to view your energy dashboard and start earning.
                </CardDescription>
            </Card>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    {/* Use energy token image if available */}
                    {energyMetadata?.image ? (
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-primary/20">
                            <Image
                                src={energyMetadata.image}
                                alt="Energy Token"
                                width={40}
                                height={40}
                                className="object-cover"
                            />
                        </div>
                    ) : (
                        <ZapIcon className="h-7 w-7 text-primary" />
                    )}
                    <h2 className="text-2xl font-bold">
                        Energy Dashboard
                        {energyMetadata?.symbol && <span className="text-sm text-muted-foreground ml-2">({energyMetadata.symbol})</span>}
                    </h2>
                </div>
                {userEnergyData.length > 0 && (
                    <Badge variant="secondary">
                        Tracking {userEnergyData.length} token(s)
                    </Badge>
                )}
            </div>

            {userEnergyData.length > 0 ? (
                <>
                    {/* Your Stats Section - With Total Energy */}
                    <div className="mb-8">
                        <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                            Your Overall Stats
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {/* Total energy card */}
                            <StatCard
                                title="Current Balance"
                                value={formatEnergyValue(energyBalance)}
                                icon="energy"
                                colorScheme="secondary"
                                description={`Your current energy balance`}
                                size="md"
                            />

                            {/* Total energy rate card */}
                            <StatCard
                                title="Generation Rate"
                                value={formatEnergyValue(aggregatedStats.totalEnergyRatePerHour)}
                                icon="clock"
                                colorScheme="secondary"
                                description="Your total energy per hour"
                                size="md"
                            />
                            <StatCard
                                title="Total Harvested"
                                value={formatEnergyValue(aggregatedStats.totalHarvested)}
                                icon="database"
                                description={`Across ${aggregatedStats.totalUniqueUsers} users`}
                            />
                            <StatCard
                                title="Tokens Tracked"
                                value={aggregatedStats.totalTokens}
                                icon="layers"
                                description="Earning energy"
                            />
                        </div>
                        {userEnergyData.length > 0 && userEnergyData[0].lastRateCalculationTimestamp > 0 && (
                            <p className="text-xs text-muted-foreground mt-2 text-right">
                                Last updated: {new Date(Math.max(...userEnergyData.map(d => d.lastRateCalculationTimestamp))).toLocaleString()}
                            </p>
                        )}
                    </div>
                </>
            ) : (
                <Card className="p-6 text-center">
                    <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <CardTitle className="mb-2">No Energy Data Found</CardTitle>
                    <CardDescription>
                        It looks like you're not accumulating energy for any tokens yet.
                        Select an eligible token below to start earning.
                    </CardDescription>
                </Card>
            )}
        </div>
    );
} 
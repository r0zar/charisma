"use client";

import React from 'react';
import { Vault } from '@repo/dexterity'; // Assuming type import
import { useApp } from '@/lib/context/app-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Wallet, LineChart, ArrowUpDown, Users, Info, Settings, Loader2 } from 'lucide-react';
import Image from 'next/image';

// Import the modals
import { AddLiquidityModal } from './add-liquidity-modal';
import { RemoveLiquidityModal } from './remove-liquidity-modal';
import { MetadataEditForm } from './metadata-edit-form'; // Import the new form

// Define the props based on data passed from page.tsx
interface VaultDetailClientProps {
    vault: Vault & { reservesA: number; reservesB: number }; // Include cleaned reserves
    prices: Record<string, number>;
    analytics: {
        tvl: number;
        volume24h?: number;
        apy?: number;
        lpHolders?: number;
        // Add other analytics fields as needed
    };
}

// TODO: Define StatCard and TokenInfoCard components (or import if they exist)
const StatCard = ({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) => (
    <Card className="p-4 bg-muted/40">
        <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-background/50">{icon}</div>
            <div>
                <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
                <div className="text-xl font-bold">{value}</div>
            </div>
        </div>
    </Card>
);

const TokenInfoCard = ({ token, reserves, price }: { token: any; reserves: number; price: number | undefined }) => {
    const reserveAmount = reserves / (10 ** (token.decimals || 6));
    const value = price !== undefined ? reserveAmount * price : null;

    return (
        <Card className="p-4 bg-muted/40">
            <div className="flex items-center gap-3">
                <Image
                    src={token.image || '/placeholder.png'} // Provide a fallback
                    alt={token.symbol || 'Token'}
                    width={40}
                    height={40}
                    className="rounded-full bg-background p-1"
                    onError={(e) => { e.currentTarget.src = '/placeholder.png'; }} // Handle image errors
                />
                <div className="flex-grow">
                    <h3 className="font-semibold">{token.name || 'Unknown Token'}</h3>
                    <div className="text-sm text-muted-foreground">{token.symbol || '--'}</div>
                </div>
                <div className="text-right">
                    <div className="font-medium">
                        {reserveAmount.toLocaleString(undefined, { maximumFractionDigits: token.decimals || 6 })} {token.symbol || '--'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                        {value !== null ? `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : 'Price N/A'}
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default function VaultDetailClient({ vault, prices, analytics }: VaultDetailClientProps) {
    const { walletState } = useApp();
    const [currentVaultData, setCurrentVaultData] = React.useState(vault); // For potential updates like metadata

    // Calculate derived values
    const feePercent = vault.fee ? (vault.fee / 10000).toFixed(2) : 'N/A'; // Assuming fee is basis points

    const handleMetadataUpdate = (updatedMetadata: Partial<Vault>) => {
        // Update the state, which will re-render child components including the form
        setCurrentVaultData(prev => ({
            ...prev,
            ...updatedMetadata // Shallow merge the updates
        }));
    };

    // Helper to format numbers
    const formatNumber = (num: number, type: 'currency' | 'percent' | 'decimal' = 'decimal') => {
        if (isNaN(num)) return 'N/A';
        switch (type) {
            case 'currency':
                return `$${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
            case 'percent':
                return `${num.toFixed(2)}%`;
            default:
                return num.toLocaleString();
        }
    };

    // Disable buttons if wallet isn't connected
    const buttonsDisabled = !walletState.connected;

    return (
        <div className="container mx-auto p-4 md:p-6">
            {/* Basic Loading State - Enhance later if needed */}
            {!vault && (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <span className="ml-2">Loading Vault Data...</span>
                </div>
            )}

            {vault && (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 md:gap-8">
                    {/* Left Panel - Hero Image & Basic Info */}
                    <div className="lg:col-span-2">
                        <Card className="overflow-hidden sticky top-6 bg-card/70 backdrop-blur-sm p-6 flex flex-col items-center gap-6">
                            <div className="relative h-48 w-48 md:h-64 md:w-64">
                                <Image
                                    src={currentVaultData.image || '/placeholder.png'}
                                    alt={currentVaultData.name || 'Vault'}
                                    fill
                                    className="rounded-lg object-cover"
                                    onError={(e) => { e.currentTarget.src = '/placeholder.png'; }} // Handle image errors
                                />
                            </div>
                            <div className="text-center">
                                <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
                                    {currentVaultData.name || 'Unnamed Vault'}
                                </h1>
                                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-muted-foreground text-sm">
                                    <div className="flex items-center gap-1">
                                        <Shield className="w-3 h-3" />
                                        <span>Fee: {feePercent}%</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Users className="w-3 h-3" />
                                        <span>{formatNumber(analytics.lpHolders || 0)} LP Holders</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex w-full gap-3">
                                <AddLiquidityModal
                                    vault={currentVaultData}
                                    prices={prices}
                                    trigger={
                                        <Button className="flex-1 gap-2" disabled={buttonsDisabled}>
                                            <Wallet className="w-4 h-4" />
                                            Add Liquidity
                                        </Button>
                                    }
                                />
                                <RemoveLiquidityModal
                                    vault={currentVaultData}
                                    prices={prices}
                                    trigger={
                                        <Button variant="outline" className="flex-1 gap-2" disabled={buttonsDisabled}>
                                            <ArrowUpDown className="w-4 h-4" />
                                            Remove
                                        </Button>
                                    }
                                />
                            </div>
                            {currentVaultData.description && (
                                <p className="text-sm text-muted-foreground text-center mt-2">
                                    {currentVaultData.description}
                                </p>
                            )}
                        </Card>
                    </div>

                    {/* Right Panel - Stats & Info */}
                    <div className="lg:col-span-3">
                        <Tabs defaultValue="stats" className="space-y-6">
                            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2">
                                <TabsTrigger value="stats" className="space-x-2">
                                    <LineChart className="h-4 w-4" />
                                    <span>Stats & Info</span>
                                </TabsTrigger>
                                <TabsTrigger value="settings" className="space-x-2">
                                    <Settings className="h-4 w-4" />
                                    <span>Configuration</span>
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="stats" className="space-y-6">
                                {/* Stats Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <StatCard
                                        title="Total Value Locked"
                                        value={formatNumber(analytics.tvl, 'currency')}
                                        icon={<Wallet className="w-5 h-5 text-primary" />}
                                    />
                                    <StatCard
                                        title="24h Volume"
                                        value={formatNumber(analytics.volume24h || 0, 'currency')}
                                        icon={<ArrowUpDown className="w-5 h-5 text-primary" />}
                                    />
                                    <StatCard
                                        title="APY"
                                        value={formatNumber(analytics.apy || 0, 'percent')}
                                        icon={<LineChart className="w-5 h-5 text-primary" />}
                                    />
                                </div>

                                {/* Token Pair Info */}
                                <div className="space-y-4">
                                    <TokenInfoCard token={currentVaultData.tokenA} reserves={currentVaultData.reservesA} price={prices[currentVaultData.tokenA.contractId]} />
                                    <TokenInfoCard token={currentVaultData.tokenB} reserves={currentVaultData.reservesB} price={prices[currentVaultData.tokenB.contractId]} />
                                </div>

                                {/* TODO: Activity Chart Placeholder */}
                                {/* <Card className="p-6 bg-muted/40">
                                    <h2 className="text-lg font-semibold mb-4">Activity</h2>
                                    <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                                        Chart placeholder
                                    </div>
                                </Card> */}
                            </TabsContent>

                            <TabsContent value="settings" className="space-y-6">
                                <Card className="p-6 bg-card/70 backdrop-blur-sm">
                                    <MetadataEditForm
                                        vault={currentVaultData}
                                        onMetadataUpdate={handleMetadataUpdate}
                                    />
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            )}
        </div>
    );
} 
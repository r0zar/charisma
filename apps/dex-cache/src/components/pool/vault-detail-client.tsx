"use client";

import React, { useState } from 'react';
import { useApp } from '@/lib/context/app-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Shield,
    Wallet,
    LineChart,
    ArrowUpDown,
    Users,
    Info,
    Settings,
    Loader2,
    TrendingUp,
    ArrowRightCircle,
    Shield as ShieldIcon,
    Clock,
    PieChart,
    AlertCircle,
    ChevronRight,
    CheckCircle,
    Package,
    DollarSign
} from 'lucide-react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { TokenCacheData } from '@repo/tokens';
import Link from 'next/link';

// Import the modals
import { AddLiquidityModal } from '@/components/pool/add-liquidity-modal';
import { RemoveLiquidityModal } from '@/components/pool/remove-liquidity-modal';
import { MetadataEditForm } from '@/components/pool/metadata-edit-form';
import TokenInfoCard from '@/components/pool/token-info-card';
import APYSimulator from '@/components/pool/apy-simulator';
import ProfitSimulator from '@/components/pool/profit-simulator';
import LpTokenPriceAnalysis from '@/components/pool/LpTokenPriceAnalysis';

// Renamed local Vault interface to avoid potential naming collisions
export interface ClientDisplayVault {
    type: string;
    contractId: string;
    name: string;
    identifier: string;
    symbol: string;
    decimals: number; // Decimals of the LP token itself
    description: string;
    image: string;
    fee: number;
    externalPoolId: string;
    engineContractId: string;
    tokenA: TokenCacheData; // Use TokenCacheData, which has optional decimals
    tokenB: TokenCacheData; // Use TokenCacheData, which has optional decimals
    reservesA: number;
    reservesB: number;
}

interface VaultDetailClientProps {
    vault: ClientDisplayVault & { reservesA: number; reservesB: number }; // Use renamed interface
    prices: Record<string, number>;
    analytics: {
        tvl: number;
        volume24h?: number;
        apy?: number;
        lpHolders?: number;
    };
    contractInfo?: any;
}

const StatCard = ({ title, value, icon, trend, footnote }: {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    trend?: { value: number; positive: boolean };
    footnote?: string;
}) => (
    <Card className="p-5 bg-gradient-to-br from-card to-background border border-border/50 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
            <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1.5">{title}</h3>
                <div className="text-2xl font-bold tracking-tight">{value}</div>

                {trend && (
                    <div className={`flex items-center text-xs mt-1.5 ${trend.positive ? 'text-green-500' : 'text-red-500'}`}>
                        {trend.positive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingUp className="w-3 h-3 mr-1 rotate-180" />}
                        {trend.positive ? '+' : ''}{trend.value}% past 30d
                    </div>
                )}

                {footnote && (
                    <div className="text-xs text-muted-foreground mt-1.5">{footnote}</div>
                )}
            </div>
            <div className="p-3 rounded-xl bg-primary/10">
                {icon}
            </div>
        </div>
    </Card>
);



// Add a reusable ComingSoonMask component
const ComingSoonMask = ({ children }: { children: React.ReactNode }) => (
    <div className="relative">
        <div className="filter blur-sm brightness-90 pointer-events-none select-none">
            {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="bg-background/80 border border-border/60 rounded-lg px-6 py-3 text-center text-base font-semibold text-muted-foreground shadow-lg">
                Coming Soon
            </div>
        </div>
    </div>
);

export default function VaultDetailClient({ vault, prices, analytics, contractInfo }: VaultDetailClientProps) {
    const { walletState } = useApp();
    const [currentVaultData, setCurrentVaultData] = React.useState<ClientDisplayVault>(vault); // Use renamed interface
    const [currentAPY, setCurrentAPY] = React.useState<number>(0);

    // Calculate derived values
    const feePercent = currentVaultData.fee ? (currentVaultData.fee / 10000).toFixed(2) : "0.00";

    // Dynamic recommendation - higher fees get better ratings
    const getRecommendationStatus = () => {
        const fee = parseFloat(feePercent);
        if (fee >= 2.0) return "Highly Recommended";  // Premium protection
        if (fee >= 1.0) return "Recommended";         // Strong protection
        if (fee >= 0.3) return "Consider";            // Moderate protection
        return "Neutral";                     // Low protection
    };

    const recommendationStatus = getRecommendationStatus();
    const expectedApy = typeof analytics.apy === 'number' ? analytics.apy : undefined;

    const handleMetadataUpdate = (updatedMetadata: Partial<ClientDisplayVault>) => {
        setCurrentVaultData(prev => ({
            ...prev,
            ...updatedMetadata
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

    // Render contract info if available
    const renderContractInfo = () => {
        if (!contractInfo || !contractInfo.contract_id) return null;
        return (
            <div className="mt-8">
                <Card className="bg-card/70 backdrop-blur-sm border border-border/50 overflow-hidden">
                    <div className="border-b border-border/50 p-4">
                        <h2 className="text-lg font-semibold">Contract Information</h2>
                    </div>
                    <div className="p-4">
                        <h3 className="font-medium mb-2 flex items-center">
                            <ShieldIcon className="w-4 h-4 mr-2 text-primary" />
                            Technical Details
                        </h3>
                        <div className="bg-muted/20 p-4 rounded-lg mb-4 space-y-2 text-sm">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <div className="text-muted-foreground">Contract ID</div>
                                    <div className="font-mono text-xs bg-muted/30 p-2 rounded mt-1 overflow-auto">
                                        {contractInfo.contract_id}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground">Transaction ID</div>
                                    <div className="font-mono text-xs bg-muted/30 p-2 rounded mt-1 overflow-auto">
                                        {contractInfo.tx_id}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4 mt-3">
                                <div>
                                    <div className="text-muted-foreground">Block Height</div>
                                    <div className="font-medium">{contractInfo.block_height}</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground">Clarity Version</div>
                                    <div className="font-medium">{contractInfo.clarity_version}</div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground">Canonical</div>
                                    <div className="font-medium">{String(contractInfo.canonical)}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {contractInfo.source_code && (
                        <div className="border-t border-border/50 p-4">
                            <h3 className="font-medium mb-2 flex items-center">
                                <Info className="w-4 h-4 mr-2 text-primary" />
                                Source Code
                            </h3>
                            <div className="relative">
                                <pre className="bg-muted/20 p-4 rounded-lg text-xs overflow-x-auto max-h-[640px] whitespace-pre-wrap">
                                    {contractInfo.source_code}
                                </pre>
                                <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none"></div>
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        );
    };

    return (
        <div className="container mx-auto p-4 md:p-6 mb-8">
            {/* Loading State */}
            {!vault && (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-2 text-muted-foreground">Loading Investment Opportunity...</span>
                </div>
            )}

            {vault && (
                <>
                    {/* Breadcrumb and Investment Status */}
                    <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between">
                        <div className="text-sm text-muted-foreground flex items-center mb-4 sm:mb-0">
                            <span>Liquidity Pools</span>
                            <ChevronRight className="w-3 h-3 mx-1" />
                            <span className="text-foreground">{vault.tokenA.symbol}-{vault.tokenB.symbol} Pool</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <Badge className={`px-3 py-1 font-medium ${recommendationStatus === "Highly Recommended"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-300"
                                : recommendationStatus === "Recommended"
                                    ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300"
                                    : recommendationStatus === "Consider"
                                        ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:border-orange-700 dark:text-orange-300"
                                        : "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:border-gray-700 dark:text-gray-300"
                                }`}>
                                <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                                {recommendationStatus}
                            </Badge>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Left Panel - Summary & Key Metrics */}
                        <div className="lg:col-span-4 space-y-6">
                            {/* Investment Card */}
                            <Card className="relative overflow-hidden border border-primary/10 shadow-md bg-card backdrop-blur-sm">
                                {/* Background Image Layer */}
                                {currentVaultData.image && (
                                    <div className="absolute inset-0 z-0">
                                        <Image
                                            src={currentVaultData.image}
                                            alt={`${currentVaultData.name || 'Vault'} background`}
                                            layout="fill"
                                            objectFit="cover"
                                            className="opacity-20 filter blur-[1px]" // Adjust opacity and blur as needed
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }} // Hide if image fails
                                        />
                                        {/* Overlay to improve text readability */}
                                        <div className="absolute inset-0 bg-black/30 z-10"></div>
                                    </div>
                                )}

                                {/* Content Layer - make sure this is above the background/overlay */}
                                <div className="relative z-20">
                                    <div className="p-6 flex flex-col items-center">

                                        <div className="text-center">
                                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
                                                {currentVaultData.name || 'Unnamed Vault'}
                                            </h1>

                                            {/* Token Pair Display with Overlapping Design */}
                                            <div className="relative flex justify-center items-center mb-6 h-32">
                                                {/* Token Images with Overlap */}
                                                <div className="relative flex items-center">
                                                    {/* Token A - Back */}
                                                    <div className="relative z-10">
                                                        <div className="w-24 h-24 rounded-full bg-muted/20 backdrop-blur-sm border-2 border-border/50 overflow-hidden shadow-lg">
                                                            {currentVaultData.tokenA.image ? (
                                                                <img
                                                                    src={currentVaultData.tokenA.image}
                                                                    alt={currentVaultData.tokenA.symbol}
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e) => {
                                                                        e.currentTarget.src = '/placeholder.png';
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground">
                                                                    {currentVaultData.tokenA.symbol?.charAt(0) || '?'}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Token A Title Card */}
                                                        <div className="absolute -bottom-2 -left-2 z-20 bg-card/90 backdrop-blur-sm border border-border/50 rounded-lg px-3 py-1 shadow-md">
                                                            <div className="text-xs font-bold">{currentVaultData.tokenA.symbol}</div>
                                                        </div>
                                                    </div>

                                                    {/* Token B - Front with Overlap */}
                                                    <div className="relative z-20 -ml-8">
                                                        <div className="w-24 h-24 rounded-full bg-muted/20 backdrop-blur-sm border-2 border-border/50 overflow-hidden shadow-lg">
                                                            {currentVaultData.tokenB.image ? (
                                                                <img
                                                                    src={currentVaultData.tokenB.image}
                                                                    alt={currentVaultData.tokenB.symbol}
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e) => {
                                                                        e.currentTarget.src = '/placeholder.png';
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground">
                                                                    {currentVaultData.tokenB.symbol?.charAt(0) || '?'}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Token B Title Card */}
                                                        <div className="absolute -bottom-2 -right-2 z-30 bg-card/90 backdrop-blur-sm border border-border/50 rounded-lg px-3 py-1 shadow-md">
                                                            <div className="text-xs font-bold">{currentVaultData.tokenB.symbol}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex w-full gap-3">
                                            <AddLiquidityModal
                                                vault={currentVaultData}
                                                prices={prices}
                                                trigger={
                                                    <Button className="flex-1 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                                                        <Wallet className="w-4 h-4" />
                                                        Invest Now
                                                    </Button>
                                                }
                                            />
                                            <RemoveLiquidityModal
                                                vault={currentVaultData}
                                                prices={prices}
                                                trigger={
                                                    <Button variant="outline" className="flex-1 gap-2 border-primary/20 text-primary hover:bg-primary/5" disabled={buttonsDisabled}>
                                                        <ArrowUpDown className="w-4 h-4" />
                                                        Withdraw
                                                    </Button>
                                                }
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* LP TOKEN OVERVIEW - Ensure content has contrast or its own background if needed */}
                                <div className="relative z-20 px-6 py-4 border-t border-border/40 bg-card/80 backdrop-blur-xs space-y-3"> {/* Added bg for this section */}
                                    <h3 className="font-medium text-sm text-muted-foreground mb-2">LP TOKEN OVERVIEW</h3>

                                    {(() => {
                                        if (currentVaultData.description) {
                                            return (
                                                <p className="text-sm leading-relaxed">
                                                    {currentVaultData.description}
                                                </p>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                            </Card>

                            {/* Key Metrics */}
                            <div>
                                <h2 className="text-lg font-semibold mb-3 flex items-center">
                                    <PieChart className="w-5 h-5 mr-2 text-primary" />
                                    Key Metrics
                                </h2>
                                <div className="space-y-3">
                                    <StatCard
                                        title="Total Value Locked"
                                        value={formatNumber(analytics.tvl, 'currency')}
                                        icon={<Wallet className="w-5 h-5 text-primary" />}
                                        footnote="Total assets under management"
                                    />
                                    <StatCard
                                        title="Fee Structure"
                                        value={`${feePercent}%`}
                                        icon={<Shield className="w-5 h-5 text-primary" />}
                                        footnote="LP fee rebate percentage"
                                    />
                                    {/* APY hidden until we have real calculation */}
                                    <div className="relative">
                                        <div className="filter blur-sm brightness-90 pointer-events-none select-none">
                                            <StatCard
                                                title="Expected Annual Yield"
                                                value="Calculating..."
                                                icon={<LineChart className="w-5 h-5 text-primary" />}
                                                footnote="Based on current pool performance"
                                            />
                                        </div>
                                        <div className="absolute inset-0 flex items-center justify-center z-10">
                                            <div className="bg-background/80 border border-border/60 rounded-lg px-4 py-2 text-center text-sm font-medium text-muted-foreground shadow-lg">
                                                Coming Soon
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Panel - Detailed Info */}
                        <div className="lg:col-span-8">
                            <Tabs defaultValue="portfolio" className="space-y-6">
                                <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 bg-muted/30 p-1">
                                    <TabsTrigger value="portfolio" className="text-sm">
                                        Portfolio Composition
                                    </TabsTrigger>
                                    <TabsTrigger value="analysis" className="text-sm">
                                        Investment Analysis
                                    </TabsTrigger>
                                    <TabsTrigger value="settings" className="text-sm">
                                        Advanced Settings
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="portfolio" className="space-y-8">
                                    {/* Professional Section Header */}
                                    <div>
                                        <h2 className="text-xl font-semibold mb-2">Portfolio Composition</h2>
                                        <p className="text-muted-foreground text-sm">
                                            This liquidity pool consists of the following assets with their current allocation and market value.
                                        </p>
                                    </div>

                                    {/* Token Assets */}
                                    <div className="space-y-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {currentVaultData.tokenA &&
                                            <TokenInfoCard token={currentVaultData.tokenA} reserves={currentVaultData.reservesA} price={prices[currentVaultData.tokenA.contractId]} />
                                        }
                                        {currentVaultData.tokenB &&
                                            <TokenInfoCard token={currentVaultData.tokenB} reserves={currentVaultData.reservesB} price={prices[currentVaultData.tokenB.contractId]} />
                                        }
                                    </div>

                                    {/* LP Token Pricing Analysis */}
                                    <div>
                                        <LpTokenPriceAnalysis 
                                            vault={currentVaultData as any} 
                                            prices={prices}
                                            analytics={analytics}
                                            className="mb-6"
                                        />
                                    </div>

                                    {/* Investment Simulators */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        <APYSimulator
                                            tvl={analytics.tvl}
                                            feeRate={vault.fee / 100}
                                            tokenASymbol={currentVaultData.tokenA.symbol}
                                            tokenBSymbol={currentVaultData.tokenB.symbol}
                                            onAPYChange={setCurrentAPY}
                                        />
                                        <ProfitSimulator
                                            apy={currentAPY}
                                            vault={currentVaultData}
                                            prices={prices}
                                        />
                                    </div>
                                </TabsContent>

                                <TabsContent value="analysis" className="space-y-6">
                                    <div>
                                        <h2 className="text-xl font-semibold mb-2">Investment Analysis</h2>
                                        <p className="text-muted-foreground text-sm mb-6">
                                            Detailed analysis of the pool's performance, risk factors, and market conditions.
                                        </p>
                                    </div>

                                    {/* Fee Structure Analysis */}
                                    <Card className="border border-border/50">
                                        <div className="border-b border-border/50 p-4">
                                            <h3 className="text-lg font-medium flex items-center mb-3">
                                                <DollarSign className="w-5 h-5 mr-2 text-primary" />
                                                Fee Structure & LP Economics
                                            </h3>

                                            {/* Fee Tier Categories */}
                                            <div className="space-y-2">
                                                <div>
                                                    <span className="text-xs text-muted-foreground font-medium mr-2">Fee Tiers:</span>
                                                    <div className="inline-flex flex-wrap gap-1.5 text-xs">
                                                        <div className={`px-2 py-1 rounded-md border ${parseFloat(feePercent) >= 3.0
                                                            ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300 font-medium'
                                                            : 'bg-muted/30 border-muted text-muted-foreground'
                                                            }`}>
                                                            Premium (3%+)
                                                        </div>
                                                        <div className={`px-2 py-1 rounded-md border ${parseFloat(feePercent) >= 1.0 && parseFloat(feePercent) < 3.0
                                                            ? 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/20 dark:border-orange-700 dark:text-orange-300 font-medium'
                                                            : 'bg-muted/30 border-muted text-muted-foreground'
                                                            }`}>
                                                            High (1-3%)
                                                        </div>
                                                        <div className={`px-2 py-1 rounded-md border ${parseFloat(feePercent) >= 0.3 && parseFloat(feePercent) < 1.0
                                                            ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300 font-medium'
                                                            : 'bg-muted/30 border-muted text-muted-foreground'
                                                            }`}>
                                                            Moderate (0.3-1%)
                                                        </div>
                                                        <div className={`px-2 py-1 rounded-md border ${parseFloat(feePercent) < 0.3
                                                            ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300 font-medium'
                                                            : 'bg-muted/30 border-muted text-muted-foreground'
                                                            }`}>
                                                            Low (&lt;0.3%)
                                                        </div>
                                                    </div>
                                                </div>

                                                <div>
                                                    <span className="text-xs text-muted-foreground font-medium mr-2">TVL Ranges:</span>
                                                    <div className="inline-flex flex-wrap gap-1.5 text-xs">
                                                        <div className={`px-2 py-1 rounded-md border ${analytics.tvl >= 10000000
                                                            ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-700 dark:text-purple-300 font-medium'
                                                            : 'bg-muted/30 border-muted text-muted-foreground'
                                                            }`}>
                                                            Mega ($10M+)
                                                        </div>
                                                        <div className={`px-2 py-1 rounded-md border ${analytics.tvl >= 1000000 && analytics.tvl < 10000000
                                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-700 dark:text-indigo-300 font-medium'
                                                            : 'bg-muted/30 border-muted text-muted-foreground'
                                                            }`}>
                                                            Large ($1M-$10M)
                                                        </div>
                                                        <div className={`px-2 py-1 rounded-md border ${analytics.tvl >= 100000 && analytics.tvl < 1000000
                                                            ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300 font-medium'
                                                            : 'bg-muted/30 border-muted text-muted-foreground'
                                                            }`}>
                                                            Medium ($100K-$1M)
                                                        </div>
                                                        <div className={`px-2 py-1 rounded-md border ${analytics.tvl >= 10000 && analytics.tvl < 100000
                                                            ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300 font-medium'
                                                            : 'bg-muted/30 border-muted text-muted-foreground'
                                                            }`}>
                                                            Small ($10K-$100K)
                                                        </div>
                                                        <div className={`px-2 py-1 rounded-md border ${analytics.tvl < 10000
                                                            ? 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-900/20 dark:border-gray-700 dark:text-gray-300 font-medium'
                                                            : 'bg-muted/30 border-muted text-muted-foreground'
                                                            }`}>
                                                            Micro (&lt;$10K)
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-4">
                                            <div className="prose prose-sm max-w-none text-sm text-muted-foreground leading-relaxed">
                                                <p className="mb-3">
                                                    This pool operates with a <strong className="text-foreground">{feePercent}% trading fee</strong>, which directly impacts both trader costs and LP profitability.
                                                    {parseFloat(feePercent) >= 3.0 ? (
                                                        <>This represents a <strong className="text-foreground">premium protection tier</strong> (3%+ fees) typically reserved for valuable tokens as their liquidity grows. These highest-tier fees provide <strong className="text-foreground">maximum protection from arbitrage extraction</strong> and ensure that volatility translates into substantial yield for LP providers rather than being drained by sophisticated arbitrage bots.</>
                                                    ) : parseFloat(feePercent) >= 1.0 ? (
                                                        <>This high fee tier (1-3%) provides <strong className="text-foreground">strong protection from arbitrage bots</strong> and converts significant trading volatility into yield for LP providers. This level is well-suited for emerging or volatile tokens where arbitrage activity could otherwise extract substantial value from the ecosystem.</>
                                                    ) : parseFloat(feePercent) >= 0.3 ? (
                                                        <>This moderate fee tier (0.3-1%) offers <strong className="text-foreground">balanced protection</strong> while maintaining competitive trading costs. It's suitable for established tokens with moderate volatility, providing decent arbitrage protection without deterring regular trading activity.</>
                                                    ) : (
                                                        <>This low fee tier (0.3%) is <strong className="text-foreground">optimized for high-frequency trading</strong> and is typically used for stable pairs or major tokens like BTC/ETH with deep liquidity, where tight spreads encourage maximum trading volume.</>
                                                    )}
                                                </p>

                                                <p className="mb-3">
                                                    With the current pool size of <strong className="text-foreground">{formatNumber(analytics.tvl, 'currency')}</strong>,
                                                    {analytics.tvl > 100000 ? (
                                                        <> this represents substantial liquidity depth that can absorb larger trades with minimal slippage.</>
                                                    ) : analytics.tvl > 10000 ? (
                                                        <> this provides moderate liquidity suitable for most retail trading activities.</>
                                                    ) : (
                                                        <> LPs should be aware that smaller pool sizes may experience higher price impact on trades.</>
                                                    )}
                                                    {parseFloat(feePercent) >= 1.0 && (
                                                        <> The elevated fee structure means that instead of price volatility being extracted by arbitrage bots, <strong className="text-foreground">significantly more of that movement gets converted into fee income for LP holders</strong>, creating a highly sustainable yield mechanism.</>
                                                    )}
                                                </p>

                                                <p>
                                                    {parseFloat(feePercent) >= 3.0 ? (
                                                        <>For LP providers, this premium tier offers <strong className="text-foreground">maximum value capture</strong> from trading activity. While trading volume may be lower due to higher costs, each transaction generates substantial fees, making this ideal for valuable tokens where protecting LP capital from arbitrage is the primary concern.</>
                                                    ) : parseFloat(feePercent) >= 1.0 ? (
                                                        <>For LP providers, this high fee level strikes an excellent balance between protecting against sophisticated arbitrage strategies while maintaining reasonable trading accessibility. This tier maximizes fee generation per transaction while still encouraging organic trading volume.</>
                                                    ) : parseFloat(feePercent) >= 0.3 ? (
                                                        <>This moderate fee structure provides decent protection against arbitrage while encouraging steady trading volume. LPs benefit from consistent fee generation with reduced risk of value extraction, suitable for most token pairs with established market presence.</>
                                                    ) : (
                                                        <>This competitive fee structure prioritizes high trading volume, which can generate substantial absolute returns for LPs despite the lower percentage per trade. However, this setup works best with highly liquid, stable token pairs where arbitrage risk is naturally lower.</>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    </Card>

                                </TabsContent>

                                <TabsContent value="settings" className="space-y-6">
                                    <Card className="bg-card/70 backdrop-blur-sm border border-border/50">
                                        <div className="border-b border-border/50 p-4">
                                            <h3 className="text-lg font-medium">Configuration Settings</h3>
                                        </div>
                                        <div className="p-6">
                                            <MetadataEditForm
                                                vault={currentVaultData}
                                                onMetadataUpdate={handleMetadataUpdate}
                                            />
                                        </div>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                </>
            )}

            {renderContractInfo()}
        </div>
    );
}
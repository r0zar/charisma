"use client";

import React from 'react';
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

// Import the modals
import { AddLiquidityModal } from './add-liquidity-modal';
import { RemoveLiquidityModal } from './remove-liquidity-modal';
import { MetadataEditForm } from './metadata-edit-form';
import TokenInfoCard from './token-info-card';

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

    // Calculate derived values
    const feePercent = currentVaultData.fee ? (currentVaultData.fee / 10000).toFixed(2) : "0.00";

    const riskLevel = "Moderate";
    const recommendationStatus = "Recommended";
    const expectedApy = typeof analytics.apy === 'number' ? analytics.apy : undefined;

    const handleMetadataUpdate = (updatedMetadata: Partial<ClientDisplayVault>) => { // Use renamed interface
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
                            <Badge className="bg-primary/10 text-primary border-primary/30 px-3 py-1 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                                Risk: {riskLevel}
                            </Badge>
                            <Badge className="bg-secondary/10 text-secondary border-secondary/30 px-3 py-1 font-medium">
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
                                            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-4">
                                                <Badge className="bg-muted/50 text-foreground/80 border border-foreground/5">{currentVaultData.tokenA.symbol}</Badge>
                                                <span>+</span>
                                                <Badge className="bg-muted/50 text-foreground/80 border border-foreground/5">{currentVaultData.tokenB.symbol}</Badge>
                                            </div>

                                            <div className="bg-muted/30 p-3 rounded-lg mb-6 border border-foreground/5">
                                                <div className="text-sm text-muted-foreground mb-1">Expected Annual Yield</div>
                                                <div className="text-3xl font-bold text-primary">{expectedApy !== undefined ? expectedApy.toFixed(2) + '%' : 'Calibrating...'}</div>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    Fee Rebate: {feePercent}% of pool fees
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
                            <ComingSoonMask>
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
                                            trend={{ value: 12.4, positive: true }}
                                            footnote="Total assets under management"
                                        />
                                        <StatCard
                                            title="Expected Annual Yield"
                                            value={expectedApy !== undefined ? formatNumber(expectedApy, 'percent') : 'Calibrating...'}
                                            icon={<LineChart className="w-5 h-5 text-primary" />}
                                            trend={undefined}
                                            footnote="Based on current pool performance"
                                        />
                                        <StatCard
                                            title="Fee Structure"
                                            value={`${feePercent}%`}
                                            icon={<Shield className="w-5 h-5 text-primary" />}
                                            footnote="LP fee rebate percentage"
                                        />
                                    </div>
                                </div>
                            </ComingSoonMask>
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

                                    {/* Pool Metrics */}
                                    <ComingSoonMask>
                                        <Card className="border border-border/50 p-5">
                                            <h3 className="text-lg font-medium mb-4">Pool Performance Metrics</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                                <div className="bg-muted/20 p-4 rounded-lg text-center">
                                                    <div className="text-sm text-muted-foreground mb-1">Stability Score</div>
                                                    <div className="text-2xl font-bold">86/100</div>
                                                    <div className="text-xs text-muted-foreground mt-1">Low volatility</div>
                                                </div>
                                                <div className="bg-muted/20 p-4 rounded-lg text-center">
                                                    <div className="text-sm text-muted-foreground mb-1">Historical APY</div>
                                                    <div className="text-2xl font-bold text-green-500">12.85%</div>
                                                    <div className="text-xs text-muted-foreground mt-1">Last 90 days</div>
                                                </div>
                                                <div className="bg-muted/20 p-4 rounded-lg text-center">
                                                    <div className="text-sm text-muted-foreground mb-1">Liquidity Score</div>
                                                    <div className="text-2xl font-bold">74/100</div>
                                                    <div className="text-xs text-muted-foreground mt-1">Medium depth</div>
                                                </div>
                                            </div>
                                        </Card>
                                    </ComingSoonMask>

                                    {/* Investment Recommendation */}
                                    <ComingSoonMask>
                                        <Card className="border-primary/20 border bg-gradient-to-r from-primary/5 to-transparent">
                                            <div className="p-5">
                                                <h3 className="text-lg font-medium mb-3 flex items-center">
                                                    <CheckCircle className="w-5 h-5 mr-2 text-primary" />
                                                    Advisor Recommendation
                                                </h3>
                                                <p className="text-sm leading-relaxed mb-4">
                                                    This liquidity pool offers a balanced risk-return profile with consistent fee generation.
                                                    The pairing of established tokens provides lower impermanent loss risk compared to more
                                                    volatile pairs. Recommended allocation: 5-15% of your DeFi portfolio.
                                                </p>
                                                <div className="flex items-center justify-between text-sm bg-card/70 rounded-lg p-3">
                                                    <div className="flex items-center text-muted-foreground">
                                                        <Clock className="w-4 h-4 mr-2" />
                                                        Recommended holding period
                                                    </div>
                                                    <div className="font-medium">3+ months</div>
                                                </div>
                                            </div>
                                        </Card>
                                    </ComingSoonMask>
                                </TabsContent>

                                <TabsContent value="analysis" className="space-y-6">
                                    <div>
                                        <h2 className="text-xl font-semibold mb-2">Investment Analysis</h2>
                                        <p className="text-muted-foreground text-sm mb-6">
                                            Detailed analysis of the pool's performance, risk factors, and market conditions.
                                        </p>
                                    </div>

                                    {/* Performance Chart Placeholder */}
                                    <ComingSoonMask>
                                        <Card className="p-6 border border-border/50">
                                            <h3 className="text-lg font-medium mb-4">Historical Performance</h3>
                                            <div className="h-[250px] flex items-center justify-center text-muted-foreground bg-muted/20 rounded-lg">
                                                <LineChart className="w-6 h-6 mr-2" />
                                                <span>Performance chart would appear here</span>
                                            </div>
                                        </Card>
                                    </ComingSoonMask>

                                    {/* Risk Analysis */}
                                    <ComingSoonMask>
                                        <Card className="border border-border/50">
                                            <div className="border-b border-border/50 p-4">
                                                <h3 className="text-lg font-medium">Risk Assessment</h3>
                                            </div>
                                            <div className="p-4">
                                                <div className="space-y-4">
                                                    <div className="flex items-start">
                                                        <div className="p-2 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-500 mr-3 mt-0.5">
                                                            <AlertCircle className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-medium mb-1">Impermanent Loss Risk</h4>
                                                            <p className="text-sm text-muted-foreground">
                                                                Moderate risk of impermanent loss if token prices diverge significantly. Historical correlation between these assets is relatively stable.
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-start">
                                                        <div className="p-2 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-500 mr-3 mt-0.5">
                                                            <ShieldIcon className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-medium mb-1">Contract Security</h4>
                                                            <p className="text-sm text-muted-foreground">
                                                                Smart contracts have undergone security audits. The pool uses standard AMM mechanics with well-established risk parameters.
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-start">
                                                        <div className="p-2 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-500 mr-3 mt-0.5">
                                                            <Info className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-medium mb-1">Market Conditions</h4>
                                                            <p className="text-sm text-muted-foreground">
                                                                Current market sentiment is neutral to positive for both tokens. Trading volumes have remained consistent over the past 30 days.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    </ComingSoonMask>
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
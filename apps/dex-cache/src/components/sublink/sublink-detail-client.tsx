'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Info, ShieldCheck, TrendingUp, DollarSign, Layers, Wallet, RefreshCw, Flame, ArrowRightLeft, ExternalLinkIcon, Settings } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Badge } from "@/components/ui/badge";
import { SublinkBridgeCard } from '@/components/SublinkBridgeCard';
import { Vault } from '@/lib/pool-service';
import { KraxelPriceData } from '@repo/tokens';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { getSubnetTokenBalance } from '@/lib/server/subnets';
import { SublinkMetadataEditForm } from './sublink-metadata-edit-form';

// Add a simpler CSS animation for the flame
const flameStyle = `
  @keyframes simplePulse {
    0% { opacity: 0.7; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
    70% { opacity: 0; box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
    100% { opacity: 0; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
  }
  
  .flame-pulse {
    animation: simplePulse 2s infinite cubic-bezier(0.66, 0, 0, 1);
  }
`;

// Props for SublinkDetailClient - must match what page.tsx provides
interface SublinkDetailClientProps {
    sublink: Vault & { reservesA: number; reservesB: number };
    prices: KraxelPriceData;
    analytics: {
        tvl: number;
        // Add other sublink-specific analytics if available
    };
    contractInfo?: any;
}

// Reusable StatCard, styled like the vault component
const StatCard = ({
    title,
    value,
    icon,
    isLoading = false
}: {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    isLoading?: boolean
}) => (
    <Card className="p-5 bg-gradient-to-br from-card to-background border border-border/50 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
            <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1.5">{title}</h3>
                <div className="text-2xl font-bold tracking-tight">
                    {isLoading ? (
                        <Skeleton className="h-8 w-24" />
                    ) : (
                        value
                    )}
                </div>
            </div>
            <div className="p-3 rounded-xl bg-primary/10">
                {icon}
            </div>
        </div>
    </Card>
);

// Skeleton version of StatCard
const StatCardSkeleton = () => (
    <Card className="p-5 bg-gradient-to-br from-card to-background border border-border/50">
        <div className="flex items-start justify-between">
            <div className="w-full">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
            </div>
            <Skeleton className="h-12 w-12 rounded-xl" />
        </div>
    </Card>
);

// Format USD amount for display
const formatUsdValue = (value: number | null): string => {
    if (value === null || isNaN(value)) return 'N/A';
    if (value < 0.01 && value !== 0) return '< $0.01';
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Helper to get subnet token contract ID
const getSubnetTokenContractId = (sublinkContractId: string, sublinkData: any) => {
    // Use the tokenBContract directly from the sublink metadata if available
    if (sublinkData && sublinkData.tokenBContract) {
        console.log(`Using sublinkData.tokenBContract: ${sublinkData.tokenBContract}`);
        return sublinkData.tokenBContract;
    }

    // Fallback to tokenB.contractId if tokenBContract doesn't exist
    if (sublinkData && sublinkData.tokenB && sublinkData.tokenB.contractId) {
        console.log(`Using sublinkData.tokenB.contractId: ${sublinkData.tokenB.contractId}`);
        return sublinkData.tokenB.contractId;
    }

    // Last resort fallback (should not happen with proper data)
    console.warn("No tokenBContract or tokenB.contractId found in sublink metadata, using fallback");
    const [address] = sublinkContractId.split('.');
    const fallback = `${address}.charisma-token-subnet-v1`;
    console.log(`Using fallback subnet contract: ${fallback}`);
    return fallback;
};

// Function to fetch subnet contract balance and calculate TVL
const calculateTvl = async (
    refreshing: boolean,
    sublinkContractId: string,
    sublinkData: any,
    tokenContractId: string,
    tokenPrice: number,
    setIsLoadingTvl: React.Dispatch<React.SetStateAction<boolean>>,
    setIsRefreshingTvl: React.Dispatch<React.SetStateAction<boolean>>,
    setCalculatedTvl: React.Dispatch<React.SetStateAction<number | null>>,
    setInitialLoad: React.Dispatch<React.SetStateAction<boolean>>
) => {
    if (refreshing) {
        setIsRefreshingTvl(true);
    } else {
        setIsLoadingTvl(true);
    }

    try {
        // Call the server action to get the token balance
        const result = await getSubnetTokenBalance(sublinkContractId, tokenContractId);

        if (result.success && result.balance !== undefined) {
            // Convert from micro units to standard units using the returned decimals or default
            const tokenDecimals = result.tokenDecimals || 6;
            const tokenBalance = result.balance / Math.pow(10, tokenDecimals);

            // Calculate TVL (token balance * token price)
            const tvl = tokenBalance * tokenPrice;
            setCalculatedTvl(tvl);

            console.log(`Calculated TVL: ${tvl} USD from ${tokenBalance} tokens at $${tokenPrice} each`);
        } else {
            console.error("Error fetching subnet balance:", result.error);
            toast.error("Could not fetch subnet token balance", {
                description: result.error
            });
        }
    } catch (error) {
        console.error("Error calculating TVL:", error);
        toast.error("Failed to fetch subnet TVL data");
    } finally {
        setIsLoadingTvl(false);
        setIsRefreshingTvl(false);
        setInitialLoad(false);
    }
};

export default function SublinkDetailClient({ sublink, prices, analytics, contractInfo }: SublinkDetailClientProps) {
    // Calculate fee percentage if available
    const feePercent = sublink.fee ? (sublink.fee / 10000).toFixed(2) : '0';

    // State for TVL calculation
    const [calculatedTvl, setCalculatedTvl] = useState<number | null>(null);
    const [isLoadingTvl, setIsLoadingTvl] = useState(false);
    const [isRefreshingTvl, setIsRefreshingTvl] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);
    const tokenDecimals = sublink.tokenA?.decimals || 6;

    // State for metadata editing (dev mode)
    const [currentSublink, setCurrentSublink] = useState(sublink);
    const isDev = process.env.NODE_ENV === 'development';

    // Calculate TVL on component mount
    useEffect(() => {
        calculateTvl(
            false,
            sublink.contractId,
            sublink,
            sublink.tokenA?.contractId!,
            prices[sublink.tokenA?.contractId!] || 0,
            setIsLoadingTvl,
            setIsRefreshingTvl,
            setCalculatedTvl,
            setInitialLoad
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sublink.contractId, sublink.tokenA?.contractId]);

    // Handler for metadata updates
    const handleMetadataUpdate = (updatedMetadata: Partial<Vault>) => {
        setCurrentSublink(prevSublink => ({
            ...prevSublink,
            ...updatedMetadata
        } as Vault & { reservesA: number; reservesB: number }));
        toast.success("Sublink metadata updated locally. Refresh the page to see all changes.");
    };

    // Update the refresh button click handler
    const handleRefreshTvl = () => {
        calculateTvl(
            true,
            sublink.contractId,
            sublink,
            sublink.tokenA?.contractId!,
            prices[sublink.tokenA?.contractId!] || 0,
            setIsLoadingTvl,
            setIsRefreshingTvl,
            setCalculatedTvl,
            setInitialLoad
        );
    };

    // Use currentSublink for rendering instead of sublink
    const displaySublink = currentSublink;

    const renderContractInfo = () => {
        if (!contractInfo || Object.keys(contractInfo).length === 0 || !contractInfo.contract_id) return null;
        return (
            <Card className="w-full mt-8 border-border/60">
                <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                        <Info className="w-5 h-5 mr-2 text-primary" />
                        Contract Information
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    <div>
                        <p className="text-xs text-muted-foreground">Contract ID</p>
                        <p className="font-mono text-xs bg-muted/50 p-2 rounded mt-0.5 break-all">{contractInfo.contract_id}</p>
                    </div>
                    {contractInfo.tx_id && (
                        <div>
                            <p className="text-xs text-muted-foreground">Transaction ID</p>
                            <p className="font-mono text-xs bg-muted/50 p-2 rounded mt-0.5 break-all">{contractInfo.tx_id}</p>
                        </div>
                    )}
                    {contractInfo.block_height && (
                        <div>
                            <p className="text-xs text-muted-foreground">Block Height</p>
                            <p>{contractInfo.block_height}</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    // Render loading skeleton for the entire detail page
    if (initialLoad) {
        return (
            <div className="container mx-auto p-4 md:p-6 mb-12">
                <div className="mb-6 flex items-center justify-between max-w-6xl mx-auto">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-6 w-20" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-6xl mx-auto">
                    {/* Left Column - Sublink Details Skeleton */}
                    <div className="lg:col-span-4 space-y-6">
                        <Card className="overflow-hidden border border-primary/10 shadow-md">
                            <div className="p-6 flex flex-col items-center">
                                <Skeleton className="h-24 w-24 rounded-lg mb-4" />
                                <div className="text-center w-full">
                                    <Skeleton className="h-8 w-2/3 mx-auto mb-2" />
                                    <div className="flex items-center justify-center gap-2 mb-4">
                                        <Skeleton className="h-6 w-16" />
                                        <span>↔</span>
                                        <Skeleton className="h-6 w-16" />
                                    </div>
                                </div>

                                <div className="w-full space-y-4">
                                    <StatCardSkeleton />
                                    <StatCardSkeleton />
                                </div>

                                <div className="w-full mt-4 p-4 bg-muted/20 rounded-lg border border-border/30">
                                    <Skeleton className="h-4 w-32 mb-2" />
                                    <Skeleton className="h-4 w-full mb-2" />
                                    <Skeleton className="h-4 w-full mb-2" />
                                    <Skeleton className="h-4 w-3/4" />
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Right Panel - Content Skeleton */}
                    <div className="lg:col-span-8">
                        <div className="space-y-6">
                            <Skeleton className="h-10 w-full" />

                            <div className="space-y-4">
                                <Skeleton className="h-32 w-full" />
                                <Skeleton className="h-80 w-full" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-6 mb-12">
            {/* Breadcrumb Navigation */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between max-w-6xl mx-auto">
                <div className="text-sm text-muted-foreground mb-4 sm:mb-0">
                    <Link href="/sublinks" className="inline-flex items-center hover:text-foreground transition-colors">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Subnets
                    </Link>
                </div>
                <Badge variant="outline" className="font-mono text-xs py-1">{displaySublink.protocol} / {displaySublink.type}</Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-6xl mx-auto">
                {/* Left Column - Sublink Details */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Sublink Card */}
                    <Card className="overflow-hidden border border-primary/10 shadow-md bg-gradient-to-br from-card to-muted/20 backdrop-blur-sm">
                        <div className="p-6 flex flex-col items-center">
                            <div className="mb-4 flex items-center justify-center gap-3">
                                {/* Original Token */}
                                <div className="flex flex-col items-center">
                                    <div className="relative w-10 h-10 z-10">
                                        {displaySublink.tokenA?.image ? (
                                            <Image
                                                src={displaySublink.tokenA.image}
                                                alt={`${displaySublink.tokenA.name}`}
                                                fill
                                                className="rounded-full object-cover border border-border/50"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 flex items-center justify-center bg-muted rounded-full border border-border/50">
                                                <Layers className="w-5 h-5 text-muted-foreground" />
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-xs text-muted-foreground mt-1">{displaySublink.tokenA?.symbol}</span>
                                </div>

                                {/* Arrow */}
                                <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180 z-10" />

                                {/* Bridge/Vault */}
                                <div className="flex flex-col items-center">
                                    <div className="relative w-16 h-16 z-10">
                                        {displaySublink.image ? (
                                            <Image
                                                src={displaySublink.image}
                                                alt={`${displaySublink.name} logo`}
                                                fill
                                                className="rounded-lg object-cover border-2 border-foreground/5"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 flex items-center justify-center bg-primary/10 rounded-lg border border-primary/30">
                                                <ArrowRightLeft className="w-6 h-6 text-primary" />
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-xs text-primary font-medium mt-1">Bridge</span>
                                </div>

                                {/* Arrow */}
                                <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180 z-10" />

                                {/* Subnet Token with Flame */}
                                <div className="flex flex-col items-center">
                                    <div className="relative w-10 h-10 z-10">
                                        {displaySublink.tokenA?.image ? (
                                            <Image
                                                src={displaySublink.tokenA.image}
                                                alt={`${displaySublink.tokenA.name} (subnet)`}
                                                fill
                                                className="rounded-full object-cover border border-border/50"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 flex items-center justify-center bg-muted rounded-full border border-border/50">
                                                <Layers className="w-5 h-5 text-muted-foreground" />
                                            </div>
                                        )}

                                        {/* Style tag for animations */}
                                        <style jsx>{flameStyle}</style>

                                        {/* Layered flame badge - static base with animation */}
                                        <div className="relative">
                                            {/* Base layer - non-animated flame */}
                                            <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 shadow-md z-20">
                                                <Flame className="w-3 h-3 text-white" />
                                            </div>

                                            {/* Animated layer - pulsing ring */}
                                            <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 z-10 flame-ping">
                                                <Flame className="w-3 h-3 text-white opacity-0" />
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-xs text-muted-foreground mt-1">Subnet</span>
                                </div>
                            </div>

                            <div className="w-full space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium text-muted-foreground">Subnet Stats</h3>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={handleRefreshTvl}
                                        disabled={isRefreshingTvl || isLoadingTvl}
                                    >
                                        <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingTvl ? 'animate-spin' : ''}`} />
                                        <span className="sr-only">Refresh TVL</span>
                                    </Button>
                                </div>
                                {isLoadingTvl ? (
                                    <StatCardSkeleton />
                                ) : (
                                    <StatCard
                                        title="Total Value Locked (TVL)"
                                        value={formatUsdValue(calculatedTvl !== null ? calculatedTvl : analytics.tvl)}
                                        icon={<DollarSign className="w-5 h-5 text-primary" />}
                                    />
                                )}

                                {displaySublink.fee !== undefined && (
                                    <StatCard
                                        title="Bridge Fee"
                                        value={`${feePercent}%`}
                                        icon={<Wallet className="w-5 h-5 text-primary" />}
                                    />
                                )}
                            </div>

                            {displaySublink.description && (
                                <div className="w-full mt-4 p-4 bg-muted/90 rounded-lg text-sm border border-border/30">
                                    <h3 className="font-medium text-xs mb-2 text-muted-foreground uppercase">About this Sublink</h3>
                                    <p className="leading-relaxed">
                                        {displaySublink.description}
                                    </p>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Right Panel - Main Content */}
                <div className="lg:col-span-8">
                    <Tabs defaultValue="bridge" className="space-y-6">
                        <TabsList className={`grid w-full ${isDev ? 'grid-cols-3' : 'grid-cols-2'} bg-muted/30 p-1`}>
                            <TabsTrigger value="bridge" className="text-sm">
                                Bridge Interface
                            </TabsTrigger>
                            <TabsTrigger value="details" className="text-sm">
                                Technical Details
                            </TabsTrigger>
                            {isDev && (
                                <TabsTrigger value="dev" className="text-sm">
                                    <Settings className="w-4 h-4 mr-2" />
                                    Dev
                                </TabsTrigger>
                            )}
                        </TabsList>

                        <TabsContent value="bridge" className="space-y-6">
                            {/* Add informational text here */}
                            <div className="p-4 bg-muted/30 border border-border/50 rounded-lg text-sm text-muted-foreground space-y-2">
                                <h4 className="font-medium text-foreground">Using the Subnet Bridge</h4>
                                <p>
                                    This interface allows you to transfer {displaySublink.tokenA?.symbol} assets between the Stacks mainnet and the subnet environment.
                                </p>
                                <ul className="list-disc pl-5 space-y-1 text-xs">
                                    <li>
                                        <strong>Enter Subnet:</strong> Moves your {displaySublink.tokenA?.symbol} from the Stacks mainnet to the subnet, where they will be represented as a wrapped version.
                                    </li>
                                    <li>
                                        <strong>Exit Subnet:</strong> Returns your {displaySublink.tokenA?.symbol} from the subnet back to the Stacks mainnet.
                                    </li>
                                    <li>Ensure you have sufficient STX for transaction fees on the Stacks mainnet.</li>
                                    <li>Transaction times may vary depending on network congestion.</li>
                                </ul>
                            </div>

                            {/* Bridge Card */}
                            <SublinkBridgeCard sublink={displaySublink} prices={prices} />
                        </TabsContent>

                        <TabsContent value="details" className="space-y-6">
                            <Card className="border border-border/50 overflow-hidden">
                                <CardHeader className="bg-muted/30 border-b border-border/30">
                                    <CardTitle className="text-lg flex items-center">
                                        <ShieldCheck className="w-5 h-5 mr-2 text-primary" />
                                        Token Details
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {/* Mainnet Token Details */}
                                    <div className="p-5 border-b border-border/30">
                                        <div className="flex items-start gap-4">
                                            <div className="relative flex-shrink-0 w-12 h-12">
                                                {displaySublink.tokenA?.image ? (
                                                    <Image
                                                        src={displaySublink.tokenA.image}
                                                        alt={`${displaySublink.tokenA.name}`}
                                                        fill
                                                        className="rounded-full object-cover border border-border/50"
                                                    />
                                                ) : (
                                                    <div className="w-12 h-12 flex items-center justify-center bg-muted rounded-full border border-border/50">
                                                        <Layers className="w-6 h-6 text-muted-foreground" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-grow">
                                                <h3 className="font-medium text-base mb-0.5 flex items-center">
                                                    Mainnet Token
                                                    <Badge variant="outline" className="ml-2 text-xs py-0">
                                                        {displaySublink.tokenA?.symbol}
                                                    </Badge>
                                                </h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 mt-2">
                                                    <div>
                                                        <p className="text-xs text-muted-foreground mb-0.5">Token Name</p>
                                                        <p className="text-sm font-medium">{displaySublink.tokenA?.name}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-muted-foreground mb-0.5">Decimals</p>
                                                        <p className="text-sm font-medium">{displaySublink.tokenA?.decimals}</p>
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <p className="text-xs text-muted-foreground mb-0.5">Contract ID</p>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono bg-muted/70 p-1.5 rounded text-xs block overflow-hidden text-ellipsis">
                                                                {displaySublink.tokenA?.contractId}
                                                            </span>
                                                            <Link href={`https://explorer.stacks.co/txid/${displaySublink.tokenA?.contractId}`} target="_blank" rel="noopener noreferrer">
                                                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                                                    <ExternalLinkIcon className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </Link>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Subnet Token Details */}
                                    <div className="p-5 border-b border-border/30">
                                        <div className="flex items-start gap-4">
                                            <div className="relative flex-shrink-0 w-12 h-12">
                                                {displaySublink.tokenA?.image ? (
                                                    <div className="relative w-12 h-12">
                                                        <Image
                                                            src={displaySublink.tokenA?.image}
                                                            alt={`${displaySublink.tokenA.name} (subnet)`}
                                                            fill
                                                            className="rounded-full object-cover border border-border/50"
                                                        />
                                                        {/* Layered flame badge - static base with animation */}
                                                        <div className="relative">
                                                            {/* Base layer - non-animated flame */}
                                                            <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 shadow-md z-20">
                                                                <Flame className="w-4 h-4 text-white" />
                                                            </div>

                                                            {/* Animated layer - pulsing ring */}
                                                            <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 z-10 flame-ping">
                                                                <Flame className="w-4 h-4 text-white opacity-0" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="relative w-12 h-12">
                                                        <div className="w-12 h-12 flex items-center justify-center bg-muted rounded-full border border-border/50">
                                                            <Layers className="w-6 h-6 text-muted-foreground" />
                                                        </div>
                                                        {/* Layered flame badge - static base with animation */}
                                                        <div className="relative">
                                                            {/* Base layer - non-animated flame */}
                                                            <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 shadow-md z-20">
                                                                <Flame className="w-4 h-4 text-white" />
                                                            </div>

                                                            {/* Animated layer - pulsing ring */}
                                                            <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 z-10 flame-ping">
                                                                <Flame className="w-4 h-4 text-white opacity-0" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-grow">
                                                <h3 className="font-medium text-base mb-0.5 flex items-center">
                                                    Subnet Token
                                                    <Badge variant="outline" className="ml-2 text-xs py-0">
                                                        {displaySublink.tokenB?.symbol}
                                                    </Badge>
                                                </h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 mt-2">
                                                    <div>
                                                        <p className="text-xs text-muted-foreground mb-0.5">Token Name</p>
                                                        <p className="text-sm font-medium">{displaySublink.tokenB?.name}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-muted-foreground mb-0.5">Decimals</p>
                                                        <p className="text-sm font-medium">{displaySublink.tokenB?.decimals}</p>
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <p className="text-xs text-muted-foreground mb-0.5">Contract ID</p>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono bg-muted/70 p-1.5 rounded text-xs block overflow-hidden text-ellipsis">
                                                                {displaySublink.tokenB?.contractId}
                                                            </span>
                                                            <Link href={`https://explorer.stacks.co/txid/${displaySublink.tokenB?.contractId}`} target="_blank" rel="noopener noreferrer">
                                                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                                                    <ExternalLinkIcon className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </Link>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sublink Information */}
                                    <div className="p-5">
                                        <h3 className="font-medium text-base mb-3">Subnet Bridge Information</h3>
                                        <div className="space-y-3 text-sm">
                                            <div className="flex flex-col space-y-1 p-3 bg-muted/30 rounded-md">
                                                <span className="text-xs text-muted-foreground">Bridge Contract ID</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs overflow-hidden text-ellipsis">
                                                        {displaySublink.contractId}
                                                    </span>
                                                    <Link href={`https://explorer.stacks.co/txid/${displaySublink.contractId}`} target="_blank" rel="noopener noreferrer">
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                                                            <ExternalLinkIcon className="h-3 w-3" />
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </div>

                                            <div className="flex flex-col space-y-1 p-3 bg-muted/30 rounded-md">
                                                <span className="text-xs text-muted-foreground">Subnet Contract ID</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs overflow-hidden text-ellipsis">
                                                        {getSubnetTokenContractId(displaySublink.contractId, displaySublink)}
                                                    </span>
                                                    <Link href={`https://explorer.stacks.co/txid/${getSubnetTokenContractId(displaySublink.contractId, displaySublink)}`} target="_blank" rel="noopener noreferrer">
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                                                            <ExternalLinkIcon className="h-3 w-3" />
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </div>

                                            {displaySublink.externalPoolId && (
                                                <div className="flex flex-col space-y-1 p-3 bg-muted/30 rounded-md">
                                                    <span className="text-xs text-muted-foreground">External Pool ID</span>
                                                    <span className="font-mono text-xs break-all">{displaySublink.externalPoolId}</span>
                                                </div>
                                            )}

                                            {displaySublink.engineContractId && (
                                                <div className="flex flex-col space-y-1 p-3 bg-muted/30 rounded-md">
                                                    <span className="text-xs text-muted-foreground">Engine Contract ID</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-xs overflow-hidden text-ellipsis">
                                                            {displaySublink.engineContractId}
                                                        </span>
                                                        <Link href={`https://explorer.stacks.co/txid/${displaySublink.engineContractId}`} target="_blank" rel="noopener noreferrer">
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                                                                <ExternalLinkIcon className="h-3 w-3" />
                                                            </Button>
                                                        </Link>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Only render contract info if available */}
                            {contractInfo && renderContractInfo()}
                        </TabsContent>

                        {isDev && (
                            <TabsContent value="dev" className="space-y-6">
                                <Card className="border border-amber-500/50 bg-amber-500/10">
                                    <CardHeader>
                                        <CardTitle className="flex items-center text-amber-600 dark:text-amber-400">
                                            <Settings className="w-5 h-5 mr-2" />
                                            Development Mode
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
                                            This tab is only visible in development mode. Use it to edit the dex-cache metadata for this sublink.
                                        </p>
                                        <SublinkMetadataEditForm
                                            sublink={displaySublink}
                                            onMetadataUpdate={handleMetadataUpdate}
                                        />
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        )}
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
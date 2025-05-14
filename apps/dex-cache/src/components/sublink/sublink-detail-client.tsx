'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Info, ShieldCheck, TrendingUp, DollarSign, Layers, Wallet, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Badge } from "@/components/ui/badge";
import { SublinkBridgeCard } from '@/components/SublinkBridgeCard';
import { Vault } from '@/lib/vaultService';
import { KraxelPriceData } from '@repo/tokens';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { callReadOnlyFunction } from '@repo/polyglot';
import { principalCV } from '@stacks/transactions';
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { getSubnetTokenBalance } from '@/app/actions';

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
        return sublinkData.tokenBContract;
    }

    // Fallback to tokenB.contractId if tokenBContract doesn't exist
    if (sublinkData && sublinkData.tokenB && sublinkData.tokenB.contractId) {
        return sublinkData.tokenB.contractId;
    }
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
    const tokenDecimals = sublink.tokenA.decimals || 6;

    // Calculate TVL on component mount
    useEffect(() => {
        calculateTvl(
            false,
            sublink.contractId,
            sublink,
            sublink.tokenA.contractId,
            prices[sublink.tokenA.contractId] || 0,
            setIsLoadingTvl,
            setIsRefreshingTvl,
            setCalculatedTvl,
            setInitialLoad
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sublink.contractId, sublink.tokenA.contractId]);

    const renderContractInfo = () => {
        if (!contractInfo || Object.keys(contractInfo).length === 0) return null;
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

    // Update the refresh button click handler
    const handleRefreshTvl = () => {
        calculateTvl(
            true,
            sublink.contractId,
            sublink,
            sublink.tokenA.contractId,
            prices[sublink.tokenA.contractId] || 0,
            setIsLoadingTvl,
            setIsRefreshingTvl,
            setCalculatedTvl,
            setInitialLoad
        );
    };

    return (
        <div className="container mx-auto p-4 md:p-6 mb-12">
            {/* Breadcrumb Navigation */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between max-w-6xl mx-auto">
                <div className="text-sm text-muted-foreground mb-4 sm:mb-0">
                    <Link href="/sublinks" className="inline-flex items-center hover:text-foreground transition-colors">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Sublinks
                    </Link>
                </div>
                <Badge variant="outline" className="font-mono text-xs py-1">{sublink.protocol} / {sublink.type}</Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-6xl mx-auto">
                {/* Left Column - Sublink Details */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Sublink Card */}
                    <Card className="overflow-hidden border border-primary/10 shadow-md bg-gradient-to-br from-card to-muted/20 backdrop-blur-sm">
                        <div className="p-6 flex flex-col items-center">
                            <div className="relative h-24 w-24 mb-4">
                                {sublink.image ? (
                                    <Image
                                        src={sublink.image}
                                        alt={`${sublink.name} logo`}
                                        fill
                                        className="rounded-lg object-cover p-0 border-2 border-foreground/5"
                                    />
                                ) : (
                                    <div className="w-24 h-24 flex items-center justify-center bg-muted rounded-lg border border-border/50">
                                        <Layers className="w-12 h-12 text-muted-foreground" />
                                    </div>
                                )}
                            </div>

                            <div className="text-center">
                                <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
                                    {sublink.name}
                                </h1>
                                <div className="flex items-center justify-center gap-2 text-muted-foreground mb-4">
                                    <Badge className="bg-muted/50 text-foreground/80 border border-foreground/5">{sublink.tokenA.symbol}</Badge>
                                    <span>↔</span>
                                    <Badge className="bg-muted/50 text-foreground/80 border border-foreground/5">{sublink.tokenB.symbol}</Badge>
                                </div>
                            </div>

                            <div className="w-full space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium text-muted-foreground">Total Value Locked (TVL)</h3>
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

                                {sublink.fee !== undefined && (
                                    <StatCard
                                        title="Bridge Fee"
                                        value={`${feePercent}%`}
                                        icon={<Wallet className="w-5 h-5 text-primary" />}
                                    />
                                )}
                            </div>

                            {sublink.description && (
                                <div className="w-full mt-4 p-4 bg-muted/20 rounded-lg text-sm border border-border/30">
                                    <h3 className="font-medium text-xs mb-2 text-muted-foreground uppercase">About this Sublink</h3>
                                    <p className="leading-relaxed">
                                        {sublink.description}
                                    </p>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Right Panel - Main Content */}
                <div className="lg:col-span-8">
                    <Tabs defaultValue="bridge" className="space-y-6">
                        <TabsList className="grid w-full grid-cols-2 bg-muted/30 p-1">
                            <TabsTrigger value="bridge" className="text-sm">
                                Bridge Interface
                            </TabsTrigger>
                            <TabsTrigger value="details" className="text-sm">
                                Technical Details
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="bridge" className="space-y-6">
                            {/* Add informational text here */}
                            <div className="p-4 bg-muted/30 border border-border/50 rounded-lg text-sm text-muted-foreground space-y-2">
                                <h4 className="font-medium text-foreground">Using the Sublink Bridge</h4>
                                <p>
                                    This interface allows you to transfer assets between the Stacks mainnet and the connected subnet.
                                </p>
                                <ul className="list-disc pl-5 space-y-1 text-xs">
                                    <li>
                                        <strong>Enter Subnet:</strong> Moves your {sublink.tokenA.symbol} from the Stacks mainnet to the subnet, where they will be represented as {sublink.tokenB.symbol}.
                                    </li>
                                    <li>
                                        <strong>Exit Subnet:</strong> Converts your {sublink.tokenB.symbol} on the subnet back to {sublink.tokenA.symbol} on the Stacks mainnet.
                                    </li>
                                    <li>Ensure you have sufficient STX for transaction fees on the Stacks mainnet.</li>
                                    <li>Transaction times may vary depending on network congestion.</li>
                                </ul>
                            </div>

                            {/* Bridge Card */}
                            <SublinkBridgeCard sublink={sublink} />
                        </TabsContent>

                        <TabsContent value="details" className="space-y-6">
                            <Card className="border border-border/50">
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center">
                                        <ShieldCheck className="w-5 h-5 mr-2 text-primary" />
                                        Token Details
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="bg-muted/20 p-4 rounded-lg">
                                        <h3 className="font-medium mb-3">Token A</h3>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Name:</span>
                                                <span className="font-medium">{sublink.tokenA.name}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Symbol:</span>
                                                <span className="font-medium">{sublink.tokenA.symbol}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Contract ID:</span>
                                                <span className="font-mono text-xs break-all">
                                                    <Link href={`https://explorer.stacks.co/txid/${sublink.tokenA.contractId}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                                        {sublink.tokenA.contractId}
                                                    </Link>
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-muted/20 p-4 rounded-lg">
                                        <h3 className="font-medium mb-3">Token B</h3>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Name:</span>
                                                <span className="font-medium">{sublink.tokenB.name}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Symbol:</span>
                                                <span className="font-medium">{sublink.tokenB.symbol}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Contract ID:</span>
                                                <span className="font-mono text-xs break-all">
                                                    <Link href={`https://explorer.stacks.co/txid/${sublink.tokenB.contractId}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                                        {sublink.tokenB.contractId}
                                                    </Link>
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-muted/20 p-4 rounded-lg">
                                        <h3 className="font-medium mb-3">Sublink Information</h3>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Contract ID:</span>
                                                <span className="font-mono text-xs break-all">
                                                    <Link href={`https://explorer.stacks.co/txid/${sublink.contractId}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                                        {sublink.contractId}
                                                    </Link>
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Subnet Contract ID:</span>
                                                <span className="font-mono text-xs break-all">
                                                    <Link href={`https://explorer.stacks.co/txid/${getSubnetTokenContractId(sublink.contractId, sublink)}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                                        {getSubnetTokenContractId(sublink.contractId, sublink)}
                                                    </Link>
                                                </span>
                                            </div>
                                            {sublink.externalPoolId && (
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">External Pool ID:</span>
                                                    <span className="font-mono text-xs break-all">{sublink.externalPoolId}</span>
                                                </div>
                                            )}
                                            {sublink.engineContractId && (
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Engine Contract ID:</span>
                                                    <span className="font-mono text-xs break-all">{sublink.engineContractId}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Only render contract info if available */}
                            {contractInfo && renderContractInfo()}
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
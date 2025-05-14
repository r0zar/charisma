'use client';

import React, { useState, useEffect } from 'react';
import { removeVault, refreshVaultData } from '@/app/actions'; // These actions might need to be adjusted for sublinks
import { listPrices, KraxelPriceData } from '@repo/tokens';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Trash2, ChevronDown, ChevronUp, Coins, Layers, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Vault } from '@/lib/vaultService'; // Assuming Vault is the correct type for sublinks for now
import Image from 'next/image'; // If sublinks have images

// Utility functions (truncateContractId, formatTokenAmount, formatUsdValue, formatTimestamp, getTimeSinceUpdate, calculateUsdValue)
// These are kept from the original PoolList structure and can be adjusted or removed if not needed for sublinks

const truncateContractId = (id: string, prefix = 4, suffix = 4) => {
    const [addr, name] = id.split('.');
    if (!addr) return id;
    if (addr.length <= prefix + suffix + 3) return id;
    return `${addr.slice(0, prefix)}...${addr.slice(-suffix)}.${name}`;
};

const formatTokenAmount = (amount: number, decimals: number): string => {
    if (amount === 0) return '0';
    const formatted = amount / Math.pow(10, decimals);
    if (formatted < 0.001 && formatted > 0) { // Avoid log(0) or small negative numbers if amount is tiny positive
        return formatted.toExponential(2);
    } else if (formatted < 1) {
        return formatted.toFixed(Math.min(6, decimals));
    } else if (formatted < 10000) {
        return formatted.toLocaleString(undefined, {
            maximumFractionDigits: Math.min(4, decimals),
            minimumFractionDigits: Math.min(2, decimals)
        });
    } else {
        return formatted.toLocaleString(undefined, {
            maximumFractionDigits: Math.min(2, decimals)
        });
    }
};

const formatUsdValue = (value: number | null): string => {
    if (value === null || isNaN(value)) return '—';
    if (value < 0.01 && value > -0.01 && value !== 0) return '< $0.01'; // Handle very small positive/negative
    if (value < 1 && value > -1) return `$${value.toFixed(2)}`;
    if (value < 1000 && value > -1000) return `$${value.toFixed(2)}`;
    if (value < 1000000 && value > -1000000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${(value / 1000000).toFixed(1)}M`;
};

const formatTimestamp = (timestamp?: number): string => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
};

const getTimeSinceUpdate = (timestamp?: number): { status: 'fresh' | 'normal' | 'stale'; text: string } => {
    if (!timestamp) return { status: 'stale', text: 'Never updated' };
    const now = Date.now();
    const diff = now - timestamp;
    if (diff < 60 * 60 * 1000) return { status: 'fresh', text: 'Updated recently' };
    if (diff < 24 * 60 * 60 * 1000) return { status: 'normal', text: 'Updated today' };
    return { status: 'stale', text: 'Needs update' };
};

const calculateUsdValue = (amount: number, decimals: number, contractId: string, prices: KraxelPriceData | null): number | null => {
    if (!prices || !contractId) return null;
    const price = prices[contractId];
    if (!price) return null;
    const tokenUnits = amount / Math.pow(10, decimals);
    return tokenUnits * price;
};


interface SublinkListProps {
    vaults: Vault[]; // Using Vault[] as sublinks for now
}

export default function SublinkList({ vaults }: SublinkListProps) {
    const [refreshing, setRefreshing] = useState<string | null>(null);
    // const [removing, setRemoving] = useState<string | null>(null); // If remove functionality is needed
    const [expandedItem, setExpandedItem] = useState<string | null>(null); // If expandable rows are needed
    const [prices, setPrices] = useState<KraxelPriceData | null>(null);
    const isDev = process.env.NODE_ENV === 'development';

    useEffect(() => {
        const fetchPrices = async () => {
            try {
                const priceData = await listPrices();
                setPrices(priceData);
            } catch (error) {
                console.error('Failed to fetch token prices for sublinks:', error);
            }
        };
        fetchPrices();
    }, []);

    const handleRefresh = async (id: string) => { // This might need a different backend action for sublinks
        setRefreshing(id);
        // await refreshSublinkData(id); // Example: new action
        await refreshVaultData(id); // Using existing for now
        window.location.reload(); // Consider optimistic updates instead of reload
        setRefreshing(null);
    };

    // const handleRemove = async (id: string) => { ... }; // If needed

    const toggleExpand = (id: string) => {
        setExpandedItem(expandedItem === id ? null : id);
    };

    if (!vaults || vaults.length === 0) {
        return (
            <Card className="mt-6">
                <CardContent className="pt-6">
                    <div className="text-center py-8 text-muted-foreground">
                        <Coins className="w-12 h-12 mx-auto mb-4 text-muted" />
                        <p className="text-lg font-semibold">No Sublinks Found</p>
                        <p className="text-sm mt-1">Sublinks will appear here once available.</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="mt-6 overflow-hidden">
            <CardHeader className="border-b border-border">
                <CardTitle className="flex items-center">
                    <Layers className="w-5 h-5 mr-2 text-primary" /> {/* Consider a different Icon for Sublinks */}
                    Sublinks
                    <Badge variant="secondary" className="ml-auto">
                        {vaults.length} sublink{vaults.length !== 1 ? 's' : ''}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-foreground">
                        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider">
                            <tr>
                                <th className="p-4 font-semibold text-muted-foreground">Name</th>
                                <th className="p-4 font-semibold text-muted-foreground">Contract ID</th>
                                <th className="p-4 font-semibold text-muted-foreground">Tokens</th>
                                <th className="p-4 font-semibold text-muted-foreground">Direction</th>
                                <th className="p-4 font-semibold text-muted-foreground">Liquidity (USD)</th>
                                <th className="p-4 font-semibold text-muted-foreground">Status</th>
                                <th className="p-4 font-semibold text-muted-foreground text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {vaults.map(sublink => {
                                const isRefreshingThis = refreshing === sublink.contractId;
                                // const isRemovingThis = removing === sublink.contractId;
                                const isExpandedThis = expandedItem === sublink.contractId;

                                // Assuming sublink (Vault type) has tokenA and tokenB for direction
                                const tokenASymbol = sublink.tokenA?.symbol || 'TokenA';
                                const tokenBSymbol = sublink.tokenB?.symbol || 'TokenB';

                                // Placeholder for liquidity - adapt based on actual data structure for sublinks
                                const liquidityA = sublink.reservesA || 0;
                                const liquidityB = sublink.reservesB || 0;
                                const decimalsA = sublink.tokenA?.decimals || 0;
                                const decimalsB = sublink.tokenB?.decimals || 0;
                                const contractA = sublink.tokenA?.contractId || '';
                                const contractB = sublink.tokenB?.contractId || '';

                                const usdA = calculateUsdValue(liquidityA, decimalsA, contractA, prices);
                                const usdB = calculateUsdValue(liquidityB, decimalsB, contractB, prices);
                                const totalUsdLiquidity = (usdA !== null && usdB !== null) ? usdA + usdB : null; // This might represent total value rather than bridge liquidity
                                const formattedTotalUsd = formatUsdValue(totalUsdLiquidity);

                                const lastUpdated = (sublink as any).reservesLastUpdatedAt; // Check if this field exists for sublinks
                                const updateStatus = getTimeSinceUpdate(lastUpdated);

                                return (
                                    <React.Fragment key={sublink.contractId}>
                                        <tr className={`${isExpandedThis ? 'bg-muted/20' : 'hover:bg-muted/10'} transition-colors`}>
                                            <td className="p-4 whitespace-nowrap font-medium">
                                                <div className="flex items-center gap-2">
                                                    {/* If sublinks have images:
                                                    {sublink.image && (
                                                        <Image
                                                            width={24} height={24} src={sublink.image}
                                                            alt={`${sublink.name} logo`}
                                                            className="h-6 w-6 rounded-full object-contain bg-card p-0.5 border border-border"
                                                        />
                                                    )} */}
                                                    <Link href={`/sublinks/${encodeURIComponent(sublink.contractId)}`} className="hover:underline text-primary">
                                                        {sublink.name} <span className="text-muted-foreground font-normal">({sublink.symbol})</span>
                                                    </Link>
                                                </div>
                                            </td>
                                            <td className="p-4 whitespace-nowrap font-mono text-xs">
                                                <Badge variant="outline">{truncateContractId(sublink.contractId)}</Badge>
                                            </td>
                                            <td className="p-4 whitespace-nowrap">
                                                <div className="flex items-center gap-1">
                                                    {sublink.tokenA?.image && (
                                                        <Image width={16} height={16} src={sublink.tokenA.image} alt={tokenASymbol} className="w-4 h-4 rounded-full object-contain bg-card p-px border border-border" />
                                                    )}
                                                    <span>{tokenASymbol}</span>
                                                    <span className="text-muted-foreground">/</span>
                                                    {sublink.tokenB?.image && (
                                                        <Image width={16} height={16} src={sublink.tokenB.image} alt={tokenBSymbol} className="w-4 h-4 rounded-full object-contain bg-card p-px border border-border" />
                                                    )}
                                                    <span>{tokenBSymbol}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 whitespace-nowrap text-xs">
                                                {/* Placeholder for Direction, e.g., based on tokenA and tokenB network */}
                                                Stacks <span className="text-muted-foreground">&rarr;</span> Blaze Subnet
                                            </td>
                                            <td className="p-4 whitespace-nowrap">
                                                <div className="flex flex-col items-start">
                                                    <span className="font-medium text-foreground">{formattedTotalUsd}</span>
                                                    {/* More specific liquidity details if available */}
                                                </div>
                                            </td>
                                            <td className="p-4 whitespace-nowrap">
                                                <Badge
                                                    variant={updateStatus.status === 'stale' ? 'destructive' : 'outline'}
                                                    className={`capitalize ${updateStatus.status === 'fresh' ? 'border-green-500/50 text-green-600 bg-green-500/10 dark:text-green-400' : ''}`}
                                                >
                                                    {updateStatus.status}
                                                </Badge>
                                                {/* Expand button if more details are shown in an expanded row */}
                                                {/* <button onClick={() => toggleExpand(sublink.contractId)} className="ml-auto text-muted-foreground p-1 px-2 rounded-full hover:bg-accent">
                                                    {isExpandedThis ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                </button> */}
                                            </td>
                                            <td className="p-4 whitespace-nowrap text-right space-x-1">
                                                <Button asChild variant="ghost" size="sm" className="px-2">
                                                    <Link href={`/sublinks/${encodeURIComponent(sublink.contractId)}`} title="Manage Sublink">
                                                        Manage <ExternalLink className="w-3 h-3 ml-1.5" />
                                                    </Link>
                                                </Button>
                                                {/* Refresh button if applicable for sublinks 
                                                <Button
                                                    variant="ghost" size="icon"
                                                    onClick={() => handleRefresh(sublink.contractId)}
                                                    disabled={isRefreshingThis}
                                                    title="Refresh Sublink Data"
                                                >
                                                    <RefreshCw className={`w-4 h-4 ${isRefreshingThis ? 'animate-spin' : ''}`} />
                                                </Button> */}
                                            </td>
                                        </tr>
                                        {/* Optional: Expanded row for more details, if needed in the list itself
                                        {isExpandedThis && (
                                            <tr className="bg-muted/10 border-t border-border">
                                                <td colSpan={7} className="px-6 py-4">
                                                    <p className="text-xs text-muted-foreground">Detailed sublink information here...</p>
                                                    <p>Token A ({tokenASymbol}) Reserves: {formatTokenAmount(liquidityA, decimalsA)}</p>
                                                    <p>Token B ({tokenBSymbol}) Reserves: {formatTokenAmount(liquidityB, decimalsB)}</p>
                                                </td>
                                            </tr>
                                        )} */}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
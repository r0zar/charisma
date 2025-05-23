'use client';

import React, { useState, useEffect } from 'react';
import { refreshVaultData } from '@/app/actions';
import { listPrices, KraxelPriceData } from '@repo/tokens';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Coins, ExternalLink, Flame, ArrowRightLeft } from 'lucide-react';
import Link from 'next/link';
import { Vault } from '@/lib/pool-service';
import Image from 'next/image';

// Add CSS for the flame animation
const flameStyle = `
  @keyframes simplePulse {
    0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
    70% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
    100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
  }
  
  .flame-pulse {
    animation: simplePulse 2s infinite cubic-bezier(0.66, 0, 0, 1);
  }
`;

// Utility functions 
const truncateContractId = (id: string, prefix = 4, suffix = 4) => {
    const [addr, name] = id.split('.');
    if (!addr) return id;
    if (addr.length <= prefix + suffix + 3) return id;
    return `${addr.slice(0, prefix)}...${addr.slice(-suffix)}.${name}`;
};

const formatUsdValue = (value: number | null): string => {
    if (value === null || isNaN(value)) return '—';
    if (value < 0.01 && value > -0.01 && value !== 0) return '< $0.01';
    if (value < 1 && value > -1) return `$${value.toFixed(2)}`;
    if (value < 1000 && value > -1000) return `$${value.toFixed(2)}`;
    if (value < 1000000 && value > -1000000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${(value / 1000000).toFixed(1)}M`;
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
    vaults: (Vault & {
        tvlData?: {
            tokenBalance: number;
            tokenPrice: number;
            tvlUsd: number;
        }
    })[];
    prices?: KraxelPriceData; // Make prices optional
}

export default function SublinkList({ vaults, prices }: SublinkListProps) {
    const [refreshing, setRefreshing] = useState<string | null>(null);

    // Fetch prices client-side if they weren't provided as props
    const [localPrices, setLocalPrices] = useState<KraxelPriceData | null>(prices || null);

    // Only fetch prices if they weren't provided as props
    useEffect(() => {
        if (!prices) {
            const fetchPrices = async () => {
                try {
                    const priceData = await listPrices();
                    setLocalPrices(priceData);
                } catch (error) {
                    console.error('Error fetching prices:', error);
                }
            };
            fetchPrices();
        }
    }, [prices]);

    // Use the provided prices or the locally fetched ones
    const effectivePrices = prices || localPrices;

    const handleRefresh = async (id: string) => {
        setRefreshing(id);
        await refreshVaultData(id);
        window.location.reload(); // Consider optimistic updates instead of reload
        setRefreshing(null);
    };

    if (!vaults || vaults.length === 0) {
        return (
            <Card className="mt-6">
                <CardContent className="pt-6">
                    <div className="text-center py-8 text-muted-foreground">
                        <Coins className="w-12 h-12 mx-auto mb-4 text-muted" />
                        <p className="text-lg font-semibold">No Subnets Found</p>
                        <p className="text-sm mt-1">Subnets will appear here once available.</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="mt-6 overflow-hidden">
            <CardHeader className="border-b border-border">
                <CardTitle className="flex items-center text-lg">
                    <ArrowRightLeft className="w-5 h-5 mr-2 text-primary" /> {/* Changed icon to ArrowRightLeft to match bridge concept */}
                    Token List
                    <Badge variant="secondary" className="ml-auto">
                        {vaults.length} subnet{vaults.length !== 1 ? 's' : ''}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <style jsx>{flameStyle}</style>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-foreground">
                        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider">
                            <tr>
                                <th className="p-4 font-semibold text-muted-foreground">Name</th>
                                <th className="p-4 font-semibold text-muted-foreground">Contract ID</th>
                                <th className="p-4 font-semibold text-muted-foreground">Token</th>
                                <th className="p-4 font-semibold text-muted-foreground">Bridge</th>
                                <th className="p-4 font-semibold text-muted-foreground">TVL</th>
                                <th className="p-4 font-semibold text-muted-foreground text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {vaults.map(sublink => {
                                const isRefreshingThis = refreshing === sublink.contractId;

                                // Use enriched TVL data if available, otherwise show no data
                                const totalUsdLiquidity = sublink.tvlData?.tvlUsd || null;
                                const formattedTotalUsd = formatUsdValue(totalUsdLiquidity);

                                return (
                                    <React.Fragment key={sublink.contractId}>
                                        <tr className={`hover:bg-muted/10 transition-colors`}>
                                            <td className="p-4 whitespace-nowrap font-medium">
                                                <div className="flex items-center gap-2">
                                                    {sublink.image && (
                                                        <Image
                                                            width={28} height={28} src={sublink.image}
                                                            alt={`${sublink.name} logo`}
                                                            className="h-7 w-7 rounded-lg object-contain bg-card p-0.5 border border-border"
                                                        />
                                                    )}
                                                    <Link href={`/sublinks/${encodeURIComponent(sublink.contractId)}`} className="hover:underline text-primary">
                                                        {sublink.name}
                                                    </Link>
                                                </div>
                                            </td>
                                            <td className="p-4 whitespace-nowrap font-mono text-xs">
                                                <Badge variant="outline">{truncateContractId(sublink.contractId)}</Badge>
                                            </td>
                                            <td className="p-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    {sublink.tokenA?.image && (
                                                        <Image width={20} height={20} src={sublink.tokenA.image} alt={sublink.tokenA.symbol} className="w-5 h-5 rounded-full object-contain bg-card p-px border border-border" />
                                                    )}
                                                    <span>{sublink.tokenA?.symbol}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 whitespace-nowrap">
                                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                    <span>Stacks</span>
                                                    <ArrowRightLeft className="w-4 h-4 mx-1 text-primary" />
                                                    <div className="flex items-center">
                                                        <span>Blaze</span>
                                                        <div className="relative ml-1">
                                                            <div className="bg-red-500 rounded-full p-0.5 shadow-sm flame-pulse">
                                                                <Flame className="w-2.5 h-2.5 text-white" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 whitespace-nowrap">
                                                <div className="flex flex-col items-start">
                                                    <span className="font-medium text-foreground">{formattedTotalUsd}</span>
                                                    {sublink.tvlData && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {sublink.tvlData.tokenBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })} {sublink.tokenA?.symbol}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 whitespace-nowrap text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleRefresh(sublink.contractId)}
                                                        disabled={isRefreshingThis}
                                                    >
                                                        {isRefreshingThis ? (
                                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <RefreshCw className="h-4 w-4" />
                                                        )}
                                                        <span className="sr-only">Refresh</span>
                                                    </Button>
                                                    <Link href={`/sublinks/${encodeURIComponent(sublink.contractId)}`}>
                                                        <Button size="sm" variant="default">
                                                            <ExternalLink className="h-4 w-4" />
                                                            <span className="ml-2 hidden sm:inline">View</span>
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
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
'use client';

import React, { useState, useEffect } from 'react';
import { removeVault, refreshVaultData, blacklistVault } from '@/app/actions';
import { listPrices, KraxelPriceData } from '@repo/tokens';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Trash2, ChevronDown, ChevronUp, Coins, Layers, Ban, ArrowUp, ArrowDown } from 'lucide-react';
import Link from 'next/link';
import { Vault } from '@/lib/pool-service';
import Image from 'next/image';
import { useApp } from '@/lib/context/app-context';
import { useUserPoolPositions } from '@/hooks/useUserPoolPositions';

// Format token amount with proper decimals
const formatTokenAmount = (amount: number, decimals: number): string => {
    if (amount === 0) return '0';

    // Convert atomic units to token units
    const formatted = amount / Math.pow(10, decimals);

    // Format based on value size
    if (formatted < 0.001) {
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

// Format USD amount for display
const formatUsdValue = (value: number | null): string => {
    if (value === null || isNaN(value)) return '—';

    if (value < 0.01) {
        return '< $0.01';
    } else if (value < 1) {
        return `$${value.toFixed(2)}`;
    } else if (value < 1000) {
        return `$${value.toFixed(2)}`;
    } else if (value < 1000000) {
        return `$${(value / 1000).toFixed(1)}K`;
    } else {
        return `$${(value / 1000000).toFixed(1)}M`;
    }
};

// Format timestamp to readable date
const formatTimestamp = (timestamp?: number): string => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
};

// Calculate time since last update for status indicator
const getTimeSinceUpdate = (timestamp?: number): { status: 'fresh' | 'normal' | 'stale'; text: string } => {
    if (!timestamp) return { status: 'stale', text: 'Never updated' };

    const now = Date.now();
    const diff = now - timestamp;

    // Less than 1 hour
    if (diff < 60 * 60 * 1000) {
        return { status: 'fresh', text: 'Updated recently' };
    }
    // Less than 24 hours
    else if (diff < 24 * 60 * 60 * 1000) {
        return { status: 'normal', text: 'Updated today' };
    }
    // More than 24 hours
    else {
        return { status: 'stale', text: 'Needs update' };
    }
};

// Calculate USD value based on token amount and price
const calculateUsdValue = (amount: number, decimals: number, contractId: string, prices: KraxelPriceData | null): number | null => {
    if (!prices || !contractId) return null;

    const price = prices[contractId];
    if (!price) return null;

    const tokenUnits = amount / Math.pow(10, decimals);
    return tokenUnits * price;
};

interface Props {
    vaults: Vault[];
    prices?: KraxelPriceData;
}

export default function PoolList({ vaults, prices: serverPrices }: Props) {
    const [refreshing, setRefreshing] = useState<string | null>(null);
    const [removing, setRemoving] = useState<string | null>(null);
    const [blacklisting, setBlacklisting] = useState<string | null>(null);
    const [expandedVault, setExpandedVault] = useState<string | null>(null);
    const [prices, setPrices] = useState<KraxelPriceData | null>(serverPrices || null);
    const [sortBy, setSortBy] = useState<'fee' | 'tvl' | 'myTvl' | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const isDev = process.env.NODE_ENV === 'development';

    const { stxAddress } = useApp();
    const { positions, loading: positionsLoading } = useUserPoolPositions(stxAddress, vaults, prices);

    useEffect(() => {
        if (serverPrices) return;
        const fetchPrices = async () => {
            try {
                const priceData = await listPrices();
                setPrices(priceData);
            } catch (error) {
                console.error('Failed to fetch token prices:', error);
            }
        };
        fetchPrices();
    }, [serverPrices]);

    const handleRefresh = async (id: string) => {
        setRefreshing(id);
        await refreshVaultData(id);
        window.location.reload();
        setRefreshing(null);
    };

    const handleRemove = async (id: string) => {
        setRemoving(id);
        await removeVault(id);
        window.location.reload();
        setRemoving(null);
    };

    const handleBlacklist = async (id: string) => {
        setBlacklisting(id);
        await blacklistVault(id);
        window.location.reload();
        setBlacklisting(null);
    };

    const toggleExpand = (id: string) => {
        setExpandedVault(expandedVault === id ? null : id);
    };

    // Compute TVL for each vault
    const getTvl = (v: Vault) => {
        const usdValueA = calculateUsdValue(v.reservesA || 0, v.tokenA?.decimals || 0, v.tokenA?.contractId as `${string}.${string}`, prices);
        const usdValueB = calculateUsdValue(v.reservesB || 0, v.tokenB?.decimals || 0, v.tokenB?.contractId as `${string}.${string}`, prices);
        let totalUsdValue = 0;
        if (usdValueA !== null) totalUsdValue += usdValueA;
        if (usdValueB !== null) totalUsdValue += usdValueB;
        return (usdValueA === null && usdValueB === null) ? null : totalUsdValue;
    };

    // Sort vaults based on selected column
    const sortedVaults = React.useMemo(() => {
        if (!sortBy) return vaults;
        const sorted = [...vaults];
        if (sortBy === 'fee') {
            sorted.sort((a, b) => sortDir === 'asc' ? a.fee - b.fee : b.fee - a.fee);
        } else if (sortBy === 'tvl') {
            sorted.sort((a, b) => {
                const tvlA = getTvl(a) ?? 0;
                const tvlB = getTvl(b) ?? 0;
                return sortDir === 'asc' ? tvlA - tvlB : tvlB - tvlA;
            });
        } else if (sortBy === 'myTvl') {
            sorted.sort((a, b) => {
                const myA = positions[a.contractId] ?? 0;
                const myB = positions[b.contractId] ?? 0;
                return sortDir === 'asc' ? myA - myB : myB - myA;
            });
        }
        return sorted;
    }, [vaults, sortBy, sortDir, prices, positions]);

    // Handle sort toggling
    const handleSort = (col: 'fee' | 'tvl' | 'myTvl') => {
        if (sortBy === col) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(col);
            setSortDir('desc');
        }
    };

    if (vaults.length === 0) return (
        <Card className="mt-6">
            <CardContent className="pt-6">
                <div className="text-center py-8 text-muted-foreground">
                    <Coins className="w-12 h-12 mx-auto mb-4 text-muted" />
                    <p className="text-lg font-semibold">No vaults found</p>
                    <p className="text-sm mt-1">Add a vault using the form above to get started.</p>
                </div>
            </CardContent>
        </Card>
    );

    return (
        <Card className="mt-6 overflow-hidden">
            <CardHeader className="border-b border-border">
                <CardTitle className="flex items-center">
                    <Layers className="w-5 h-5 mr-2 text-primary" />
                    Liquidity Pools
                    <Badge variant="secondary" className="ml-auto">
                        {vaults.length} pool{vaults.length !== 1 ? 's' : ''}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-foreground">
                        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider">
                            <tr>
                                <th className="p-4 font-semibold text-muted-foreground">Name</th>
                                <th className="p-4 font-semibold text-muted-foreground cursor-pointer select-none" onClick={() => handleSort('myTvl')}>
                                    My TVL
                                    {sortBy === 'myTvl' && (sortDir === 'asc' ? <ArrowUp className="inline w-3 h-3 ml-1" /> : <ArrowDown className="inline w-3 h-3 ml-1" />)}
                                </th>
                                <th className="p-4 font-semibold text-muted-foreground">Tokens</th>
                                <th className="p-4 font-semibold text-muted-foreground cursor-pointer select-none" onClick={() => handleSort('fee')}>
                                    Fee
                                    {sortBy === 'fee' && (sortDir === 'asc' ? <ArrowUp className="inline w-3 h-3 ml-1" /> : <ArrowDown className="inline w-3 h-3 ml-1" />)}
                                </th>
                                <th className="p-4 font-semibold text-muted-foreground cursor-pointer select-none" onClick={() => handleSort('tvl')}>
                                    Liquidity
                                    {sortBy === 'tvl' && (sortDir === 'asc' ? <ArrowUp className="inline w-3 h-3 ml-1" /> : <ArrowDown className="inline w-3 h-3 ml-1" />)}
                                </th>
                                <th className="p-4 font-semibold text-muted-foreground">Status</th>
                                <th className="p-4 font-semibold text-muted-foreground text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {sortedVaults.map(v => {
                                const isRefreshing = refreshing === v.contractId;
                                const isRemoving = removing === v.contractId;
                                const isBlacklisting = blacklisting === v.contractId;
                                const isExpanded = expandedVault === v.contractId;
                                const isLoading = isRefreshing || isRemoving || isBlacklisting;

                                const formattedReservesA = formatTokenAmount(v.reservesA || 0, v.tokenA?.decimals || 0);
                                const formattedReservesB = formatTokenAmount(v.reservesB || 0, v.tokenB?.decimals || 0);

                                const usdValueA = calculateUsdValue(v.reservesA || 0, v.tokenA?.decimals || 0, v.tokenA?.contractId as `${string}.${string}`, prices);
                                const usdValueB = calculateUsdValue(v.reservesB || 0, v.tokenB?.decimals || 0, v.tokenB?.contractId as `${string}.${string}`, prices);

                                // Calculate total USD value from available prices (handle missing prices gracefully)
                                let totalUsdValue = 0;
                                if (usdValueA !== null) totalUsdValue += usdValueA;
                                if (usdValueB !== null) totalUsdValue += usdValueB;
                                // If no prices available at all, show null
                                const finalTotalUsdValue = (usdValueA === null && usdValueB === null) ? null : totalUsdValue;

                                const formattedUsdValueA = formatUsdValue(usdValueA);
                                const formattedUsdValueB = formatUsdValue(usdValueB);
                                const formattedTotalUsdValue = formatUsdValue(finalTotalUsdValue);

                                const lastUpdated = (v as any).reservesLastUpdatedAt;
                                const updateStatus = getTimeSinceUpdate(lastUpdated);

                                return (
                                    <React.Fragment key={v.contractId}>
                                        <tr className={`${isExpanded ? 'bg-muted/20' : 'hover:bg-muted/10'} transition-colors`}>
                                            <td className="p-4 whitespace-nowrap font-medium flex">
                                                <Link href={`/vaults/${v.contractId}`} className="flex items-center gap-2 group">
                                                    {v.image && (
                                                        <div className="flex-shrink-0 h-8 w-8">
                                                            <Image
                                                                width={32}
                                                                height={32}
                                                                src={v.image}
                                                                alt={`${v.name} logo`}
                                                                className="h-8 w-8 rounded-md object-contain bg-card p-0.5 border border-border"
                                                            />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="font-semibold text-foreground group-hover:text-primary group-hover:underline">
                                                            {v.name} <span className="text-muted-foreground font-normal">({v.symbol})</span>
                                                        </div>
                                                        {lastUpdated && (
                                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                                Updated: {formatTimestamp(lastUpdated)}
                                                            </div>
                                                        )}
                                                    </div>
                                                </Link>
                                                <button onClick={() => toggleExpand(v.contractId)} className="ml-auto text-muted-foreground p-1 px-3 rounded-full hover:bg-accent">
                                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </button>
                                            </td>
                                            <td className="p-4 whitespace-nowrap text-sm">
                                                {!stxAddress ? (
                                                    <span className="text-muted-foreground">—</span>
                                                ) : positionsLoading ? (
                                                    <div className="h-4 w-16 bg-muted/50 rounded animate-pulse" />
                                                ) : positions[v.contractId] != null ? (
                                                    <span className="font-medium">{formatUsdValue(positions[v.contractId])}</span>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="p-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <span className="flex items-center">
                                                        {v.tokenA?.image && (
                                                            <img
                                                                src={v.tokenA?.image}
                                                                alt={v.tokenA?.symbol}
                                                                className="w-5 h-5 rounded-full mr-1 object-contain bg-card p-0.5 border border-border"
                                                            />
                                                        )}
                                                        <span className="text-primary font-medium">{v.tokenA?.symbol}</span>
                                                    </span>
                                                    <span className="text-muted-foreground">/</span>
                                                    <span className="flex items-center">
                                                        {v.tokenB?.image && (
                                                            <img
                                                                src={v.tokenB?.image}
                                                                alt={v.tokenB?.symbol}
                                                                className="w-5 h-5 rounded-full mr-1 object-contain bg-card p-0.5 border border-border"
                                                            />
                                                        )}
                                                        <span className="text-secondary font-medium">{v.tokenB?.symbol}</span>
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4 whitespace-nowrap">
                                                <Badge variant="outline">{(v.fee / 10000).toFixed(2)}%</Badge>
                                            </td>
                                            <td className="p-4 whitespace-nowrap">
                                                <div className="flex flex-col items-start">
                                                    <span className="font-medium text-foreground">
                                                        {formattedTotalUsdValue}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {formattedReservesA} {v.tokenA?.symbol} / {formattedReservesB} {v.tokenB?.symbol}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4 whitespace-nowrap">
                                                <Badge
                                                    variant={updateStatus.status === 'stale' ? 'destructive' : 'outline'}
                                                    className={`capitalize ${updateStatus.status === 'fresh' ? 'border-green-500/50 text-green-600 bg-green-500/10 dark:text-green-400' : ''}`}
                                                >
                                                    {updateStatus.status}
                                                </Badge>
                                            </td>
                                            <td className="p-4 whitespace-nowrap text-right space-x-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => { e.stopPropagation(); handleRefresh(v.contractId); }}
                                                    disabled={isLoading}
                                                    title="Refresh Vault Data"
                                                >
                                                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                                                </Button>
                                                {isDev && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={(e) => { e.stopPropagation(); handleBlacklist(v.contractId); }}
                                                        disabled={isLoading}
                                                        title="Add to Blacklist (Dev Only)"
                                                        className="text-orange-600 hover:text-orange-600 hover:bg-orange-600/10"
                                                    >
                                                        <Ban className={`w-4 h-4 ${isBlacklisting ? 'animate-spin' : ''}`} />
                                                    </Button>
                                                )}
                                                {isDev && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={(e) => { e.stopPropagation(); handleRemove(v.contractId); }}
                                                        disabled={isLoading}
                                                        title="Remove Vault (Dev Only)"
                                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-muted/10 border-t border-border">
                                                <td colSpan={7} className="px-6 py-5">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                        <div className="space-y-3">
                                                            <div className="space-y-1">
                                                                <h4 className="text-sm font-medium text-muted-foreground">Contract</h4>
                                                                <p className="text-sm font-mono bg-muted/50 px-2 py-1 rounded inline-block">{v.contractId}</p>
                                                            </div>

                                                            <div className="space-y-1">
                                                                <h4 className="text-sm font-medium text-muted-foreground">Description</h4>
                                                                <p className="text-sm">{v.description || 'N/A'}</p>
                                                            </div>

                                                            <div className="space-y-1">
                                                                <h4 className="text-sm font-medium text-muted-foreground">Engine Contract</h4>
                                                                <p className="text-sm font-mono bg-muted/50 px-2 py-1 rounded inline-block">{v.engineContractId || 'N/A'}</p>
                                                            </div>

                                                            <div className="space-y-1">
                                                                <h4 className="text-sm font-medium text-muted-foreground">External Pool ID</h4>
                                                                <p className="text-sm font-mono bg-muted/50 px-2 py-1 rounded inline-block">{v.externalPoolId || 'N/A'}</p>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-4">
                                                            <div>
                                                                <h4 className="text-sm font-medium text-muted-foreground mb-2">Token Details</h4>
                                                                <div className="bg-muted/30 rounded-lg p-3 mb-2">
                                                                    <div className="flex items-center mb-1">
                                                                        {v.tokenA?.image && (
                                                                            <img
                                                                                src={v.tokenA.image}
                                                                                alt={v.tokenA.symbol}
                                                                                className="w-5 h-5 mr-2 rounded-full object-contain bg-card p-0.5 border border-border"
                                                                            />
                                                                        )}
                                                                        <h5 className="font-medium text-primary">{v.tokenA?.symbol}</h5>
                                                                    </div>
                                                                    <p className="text-xs font-mono mb-1 pl-7">{v.tokenA?.contractId}</p>
                                                                    <div className="flex justify-between text-xs pl-7">
                                                                        <span>Balance: {formattedReservesA}</span>
                                                                        <span>Value: {formattedUsdValueA}</span>
                                                                    </div>
                                                                </div>

                                                                <div className="bg-muted/30 rounded-lg p-3">
                                                                    <div className="flex items-center mb-1">
                                                                        {v.tokenB?.image && (
                                                                            <img
                                                                                src={v.tokenB.image}
                                                                                alt={v.tokenB.symbol}
                                                                                className="w-5 h-5 mr-2 rounded-full object-contain bg-card p-0.5 border border-border"
                                                                            />
                                                                        )}
                                                                        <h5 className="font-medium text-secondary">{v.tokenB?.symbol}</h5>
                                                                    </div>
                                                                    <p className="text-xs font-mono mb-1 pl-7">{v.tokenB?.contractId}</p>
                                                                    <div className="flex justify-between text-xs pl-7">
                                                                        <span>Balance: {formattedReservesB}</span>
                                                                        <span>Value: {formattedUsdValueB}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
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
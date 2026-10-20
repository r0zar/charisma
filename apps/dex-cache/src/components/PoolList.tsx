'use client';

import React, { useState, useEffect } from 'react';
import { listPrices, KraxelPriceData } from '@repo/tokens';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Coins, Layers, ArrowUp, ArrowDown } from 'lucide-react';
import Link from 'next/link';
import { Vault } from '@/lib/pool-service';
import DexBadge from '@/components/DexBadge';
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
    const [expandedVault, setExpandedVault] = useState<string | null>(null);
    const [prices, setPrices] = useState<KraxelPriceData | null>(serverPrices || null);
    const [sortBy, setSortBy] = useState<'fee' | 'tvl' | 'myTvl' | null>('tvl');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

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

    const toggleExpand = (id: string) => {
        setExpandedVault(expandedVault === id ? null : id);
    };

    // Compute TVL for each vault. Vaults that mint their output report capacity, not holdings
    const getTvl = (v: Vault) => {
        if (v.mints?.length) return null;
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
                    <Coins className="w-12 h-12 mx-auto mb-4 text-ink-faint" />
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
                    <Layers className="w-5 h-5 mr-2 text-accent-text" />
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
                                <th className="p-4 font-semibold text-muted-foreground">DEX</th>
                                <th className="p-4 font-semibold text-muted-foreground">Tokens</th>
                                <th className="p-4 font-semibold text-muted-foreground cursor-pointer select-none" onClick={() => handleSort('fee')}>
                                    Fee
                                    {sortBy === 'fee' && (sortDir === 'asc' ? <ArrowUp className="inline w-3 h-3 ml-1" /> : <ArrowDown className="inline w-3 h-3 ml-1" />)}
                                </th>
                                <th className="p-4 font-semibold text-muted-foreground cursor-pointer select-none" onClick={() => handleSort('tvl')}>
                                    Liquidity
                                    {sortBy === 'tvl' && (sortDir === 'asc' ? <ArrowUp className="inline w-3 h-3 ml-1" /> : <ArrowDown className="inline w-3 h-3 ml-1" />)}
                                </th>
                                <th className="p-4 font-semibold text-muted-foreground cursor-pointer select-none" onClick={() => handleSort('myTvl')}>
                                    My TVL
                                    {sortBy === 'myTvl' && (sortDir === 'asc' ? <ArrowUp className="inline w-3 h-3 ml-1" /> : <ArrowDown className="inline w-3 h-3 ml-1" />)}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {sortedVaults.map(v => {
                                const isExpanded = expandedVault === v.contractId;

                                const formattedReservesA = formatTokenAmount(v.reservesA || 0, v.tokenA?.decimals || 0);
                                const formattedReservesB = formatTokenAmount(v.reservesB || 0, v.tokenB?.decimals || 0);

                                const usdValueA = calculateUsdValue(v.reservesA || 0, v.tokenA?.decimals || 0, v.tokenA?.contractId as `${string}.${string}`, prices);
                                const usdValueB = calculateUsdValue(v.reservesB || 0, v.tokenB?.decimals || 0, v.tokenB?.contractId as `${string}.${string}`, prices);

                                const finalTotalUsdValue = getTvl(v);

                                const formattedUsdValueA = formatUsdValue(usdValueA);
                                const formattedUsdValueB = formatUsdValue(usdValueB);
                                const formattedTotalUsdValue = formatUsdValue(finalTotalUsdValue);

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
                                                    <div className="font-semibold text-foreground group-hover:text-accent-text group-hover:underline">
                                                        {v.name} <span className="text-muted-foreground font-normal">({v.symbol})</span>
                                                    </div>
                                                </Link>
                                                <button onClick={() => toggleExpand(v.contractId)} className="ml-auto text-muted-foreground p-1 px-3 rounded-full hover:bg-surface-hover">
                                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </button>
                                            </td>
                                            <td className="p-4 whitespace-nowrap">
                                                <DexBadge protocol={v.protocol} />
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
                                                        <span className="text-accent-text font-medium">{v.tokenA?.symbol}</span>
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
                                                        <span className="text-accent-text font-medium">{v.tokenB?.symbol}</span>
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
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-muted/10 border-t border-border">
                                                <td colSpan={6} className="px-6 py-5">
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
                                                                        <h5 className="font-medium text-accent-text">{v.tokenA?.symbol}</h5>
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
                                                                        <h5 className="font-medium text-accent-text">{v.tokenB?.symbol}</h5>
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
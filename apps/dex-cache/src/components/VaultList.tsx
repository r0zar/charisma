'use client';

import React, { useState, useEffect } from 'react';
import { Vault } from '@repo/dexterity';
import { removeVault, refreshVaultData } from '@/app/actions';
import { listPrices, KraxelPriceData } from '@repo/tokens';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Trash2, ChevronDown, ChevronUp, Coins } from 'lucide-react';

// Utility to truncate contract id for display
const truncateContractId = (id: string, prefix = 4, suffix = 4) => {
    const [addr, name] = id.split('.');
    if (!addr) return id;
    if (addr.length <= prefix + suffix + 3) return id;
    return `${addr.slice(0, prefix)}...${addr.slice(-suffix)}.${name}`;
};

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
}

export default function VaultList({ vaults }: Props) {
    const [refreshing, setRefreshing] = useState<string | null>(null);
    const [removing, setRemoving] = useState<string | null>(null);
    const [expandedVault, setExpandedVault] = useState<string | null>(null);
    const [prices, setPrices] = useState<KraxelPriceData | null>(null);
    const isDev = process.env.NODE_ENV === 'development';

    useEffect(() => {
        const fetchPrices = async () => {
            try {
                const priceData = await listPrices();
                setPrices(priceData);
            } catch (error) {
                console.error('Failed to fetch token prices:', error);
            }
        };
        fetchPrices();
    }, []);

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

    const toggleExpand = (id: string) => {
        setExpandedVault(expandedVault === id ? null : id);
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
                    <Coins className="w-5 h-5 mr-2 text-primary" />
                    Managed Vaults
                    <Badge variant="secondary" className="ml-auto">
                        {vaults.length} vault{vaults.length !== 1 ? 's' : ''}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-foreground">
                        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider">
                            <tr>
                                <th className="p-4 font-semibold text-muted-foreground">Name</th>
                                <th className="p-4 font-semibold text-muted-foreground">Contract</th>
                                <th className="p-4 font-semibold text-muted-foreground">Tokens</th>
                                <th className="p-4 font-semibold text-muted-foreground">Fee</th>
                                <th className="p-4 font-semibold text-muted-foreground">Liquidity</th>
                                <th className="p-4 font-semibold text-muted-foreground">Status</th>
                                <th className="p-4 font-semibold text-muted-foreground text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {vaults.map(v => {
                                const isRefreshing = refreshing === v.contractId;
                                const isRemoving = removing === v.contractId;
                                const isExpanded = expandedVault === v.contractId;

                                const formattedReservesA = formatTokenAmount(v.reservesA || 0, v.tokenA.decimals || 0);
                                const formattedReservesB = formatTokenAmount(v.reservesB || 0, v.tokenB.decimals || 0);

                                const usdValueA = calculateUsdValue(v.reservesA || 0, v.tokenA.decimals || 0, v.tokenA.contractId, prices);
                                const usdValueB = calculateUsdValue(v.reservesB || 0, v.tokenB.decimals || 0, v.tokenB.contractId, prices);
                                const totalUsdValue = (usdValueA !== null && usdValueB !== null) ? (usdValueA + usdValueB) : null;

                                const formattedUsdValueA = formatUsdValue(usdValueA);
                                const formattedUsdValueB = formatUsdValue(usdValueB);
                                const formattedTotalUsdValue = formatUsdValue(totalUsdValue);

                                const lastUpdated = (v as any).reservesLastUpdatedAt;
                                const updateStatus = getTimeSinceUpdate(lastUpdated);

                                return (
                                    <React.Fragment key={v.contractId}>
                                        <tr
                                            className={`${isExpanded ? 'bg-muted/20' : 'hover:bg-muted/10'} cursor-pointer transition-colors`}
                                            onClick={() => toggleExpand(v.contractId)}
                                        >
                                            <td className="p-4 whitespace-nowrap font-medium flex items-center gap-2">
                                                {v.image && (
                                                    <div className="flex-shrink-0 h-8 w-8">
                                                        <img
                                                            src={v.image}
                                                            alt={`${v.name} logo`}
                                                            className="h-8 w-8 rounded-full object-contain bg-card p-0.5 border border-border"
                                                        />
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="font-semibold text-foreground">{v.name} <span className="text-muted-foreground font-normal">({v.symbol})</span></div>
                                                    {lastUpdated && (
                                                        <div className="text-xs text-muted-foreground mt-0.5">
                                                            Updated: {formatTimestamp(lastUpdated)}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="ml-auto text-muted-foreground">
                                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </span>
                                            </td>
                                            <td className="p-4 whitespace-nowrap font-mono text-xs">
                                                <Badge variant="outline">{truncateContractId(v.contractId)}</Badge>
                                            </td>
                                            <td className="p-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <span className="flex items-center">
                                                        {v.tokenA.image && (
                                                            <img
                                                                src={v.tokenA.image}
                                                                alt={v.tokenA.symbol}
                                                                className="w-5 h-5 rounded-full mr-1 object-contain bg-card p-0.5 border border-border"
                                                            />
                                                        )}
                                                        <span className="text-primary font-medium">{v.tokenA.symbol}</span>
                                                    </span>
                                                    <span className="text-muted-foreground">/</span>
                                                    <span className="flex items-center">
                                                        {v.tokenB.image && (
                                                            <img
                                                                src={v.tokenB.image}
                                                                alt={v.tokenB.symbol}
                                                                className="w-5 h-5 rounded-full mr-1 object-contain bg-card p-0.5 border border-border"
                                                            />
                                                        )}
                                                        <span className="text-secondary font-medium">{v.tokenB.symbol}</span>
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <Badge variant="outline">{(v.fee / 10000).toFixed(2)}%</Badge>
                                            </td>
                                            <td className="p-4 whitespace-nowrap">
                                                <div className="text-xs">
                                                    <div className="flex items-baseline gap-1 mb-0.5">
                                                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0"></div>
                                                        <span className="text-primary font-medium">{formattedReservesA}</span>
                                                        <span className="text-muted-foreground mr-1">{v.tokenA.symbol}</span>
                                                        {usdValueA !== null && <span className="text-muted-foreground">({formattedUsdValueA})</span>}
                                                    </div>
                                                    <div className="flex items-baseline gap-1">
                                                        <div className="w-2 h-2 rounded-full bg-secondary flex-shrink-0"></div>
                                                        <span className="text-secondary font-medium">{formattedReservesB}</span>
                                                        <span className="text-muted-foreground mr-1">{v.tokenB.symbol}</span>
                                                        {usdValueB !== null && <span className="text-muted-foreground">({formattedUsdValueB})</span>}
                                                    </div>
                                                    {totalUsdValue !== null && (
                                                        <div className="text-xs mt-1 pt-1 border-t border-border/50 text-muted-foreground">
                                                            Total: <span className="font-medium text-foreground">{formattedTotalUsdValue}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 whitespace-nowrap">
                                                <div className={`
                                                    inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                                                    ${updateStatus.status === 'fresh' ? 'bg-green-500/10 text-green-700 border-green-500/20 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/30' :
                                                        updateStatus.status === 'normal' ? 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/30' :
                                                            'bg-destructive/10 text-destructive border-destructive/20'}
                                                `}>
                                                    <span className={`w-2 h-2 rounded-full mr-1.5
                                                        ${updateStatus.status === 'fresh' ? 'bg-green-500' :
                                                            updateStatus.status === 'normal' ? 'bg-yellow-500' :
                                                                'bg-destructive'}
                                                    `}></span>
                                                    {updateStatus.text}
                                                </div>
                                            </td>
                                            <td className="p-4 whitespace-nowrap text-right">
                                                <div className="flex gap-1 justify-end">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        disabled={isRefreshing || isRemoving}
                                                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleRefresh(v.contractId); }}
                                                        aria-label="Refresh vault"
                                                        className="text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                                    >
                                                        {isRefreshing ? <RefreshCw className="animate-spin h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                                                    </Button>
                                                    {isDev && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            disabled={isRefreshing || isRemoving}
                                                            onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleRemove(v.contractId); }}
                                                            aria-label="Remove vault"
                                                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                        >
                                                            {isRemoving ? <RefreshCw className="animate-spin h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>

                                        {isExpanded && (
                                            <tr className="bg-muted/10">
                                                <td colSpan={7} className="p-0">
                                                    <div className="p-6 text-sm border-y border-border">
                                                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                                                            <div className="md:col-span-1 space-y-3">
                                                                <h4 className="font-semibold text-foreground mb-2">LP Token Details</h4>
                                                                <div className="space-y-1.5 text-xs text-muted-foreground">
                                                                    <div className="flex justify-between items-center">
                                                                        <span>Contract ID:</span>
                                                                        <Badge variant="outline" className="font-mono text-xs">{v.contractId}</Badge>
                                                                    </div>
                                                                    <div className="flex justify-between items-center">
                                                                        <span>Identifier:</span>
                                                                        <span>{v.identifier || '—'}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center">
                                                                        <span>Decimals:</span>
                                                                        <span>{v.decimals}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center">
                                                                        <span>Fee:</span>
                                                                        <Badge variant="outline">{(v.fee / 10000).toFixed(2)}%</Badge>
                                                                    </div>
                                                                    {totalUsdValue !== null && (
                                                                        <div className="flex justify-between items-center font-medium pt-1.5 border-t border-border/50">
                                                                            <span className="text-foreground">Total Value:</span>
                                                                            <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">{formattedTotalUsdValue}</Badge>
                                                                        </div>
                                                                    )}
                                                                    {v.engineContractId && (
                                                                        <div className="flex justify-between items-center">
                                                                            <span>Engine:</span>
                                                                            <span className="font-mono text-xs bg-accent px-1 rounded">{v.engineContractId}</span>
                                                                        </div>
                                                                    )}
                                                                    {v.description && (
                                                                        <div className="pt-2 text-xs italic border-t border-border/50">
                                                                            {v.description}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="md:col-span-1 bg-primary/5 p-4 rounded-md border border-primary/20 space-y-3">
                                                                <h4 className="font-semibold text-primary mb-2 flex items-center">
                                                                    <img src={v.tokenA.image} alt="" className="w-5 h-5 mr-1.5 rounded-full bg-card p-px border border-border" /> {v.tokenA.name} ({v.tokenA.symbol})
                                                                </h4>
                                                                <div className="space-y-1.5 text-xs text-muted-foreground">
                                                                    <div className="flex justify-between items-center">
                                                                        <span>Contract ID:</span>
                                                                        <Badge variant="outline" className="font-mono text-xs">{v.tokenA.contractId}</Badge>
                                                                    </div>
                                                                    <div className="flex justify-between items-center">
                                                                        <span>Decimals:</span>
                                                                        <span>{v.tokenA.decimals}</span>
                                                                    </div>
                                                                    <div className="pt-1.5 border-t border-primary/20">
                                                                        <div className="flex justify-between items-center">
                                                                            <span>Reserves:</span>
                                                                            <span className="text-foreground font-medium text-sm">{formattedReservesA}</span>
                                                                        </div>
                                                                        {usdValueA !== null && (
                                                                            <div className="flex justify-between items-center text-xs">
                                                                                <span>Value:</span>
                                                                                <span className="text-green-400 font-medium">{formattedUsdValueA}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="md:col-span-1 bg-secondary/5 p-4 rounded-md border border-secondary/20 space-y-3">
                                                                <h4 className="font-semibold text-secondary mb-2 flex items-center">
                                                                    <img src={v.tokenB.image} alt="" className="w-5 h-5 mr-1.5 rounded-full bg-card p-px border border-border" /> {v.tokenB.name} ({v.tokenB.symbol})
                                                                </h4>
                                                                <div className="space-y-1.5 text-xs text-muted-foreground">
                                                                    <div className="flex justify-between items-center">
                                                                        <span>Contract ID:</span>
                                                                        <Badge variant="outline" className="font-mono text-xs">{v.tokenB.contractId}</Badge>
                                                                    </div>
                                                                    <div className="flex justify-between items-center">
                                                                        <span>Decimals:</span>
                                                                        <span>{v.tokenB.decimals}</span>
                                                                    </div>
                                                                    <div className="pt-1.5 border-t border-secondary/20">
                                                                        <div className="flex justify-between items-center">
                                                                            <span>Reserves:</span>
                                                                            <span className="text-foreground font-medium text-sm">{formattedReservesB}</span>
                                                                        </div>
                                                                        {usdValueB !== null && (
                                                                            <div className="flex justify-between items-center text-xs">
                                                                                <span>Value:</span>
                                                                                <span className="text-green-400 font-medium">{formattedUsdValueB}</span>
                                                                            </div>
                                                                        )}
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
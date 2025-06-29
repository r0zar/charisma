'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingUp, TrendingDown, Minus, Activity, Zap, RefreshCw, Users, Target } from 'lucide-react';
import type { TokenRateHistory, TokenEnergyRate } from '@/lib/energy/rate-analytics';
import { formatEnergyValue, formatEnergyCompact } from '@/lib/format-energy';
import type { TokenCacheData } from '@repo/tokens';

interface TokenPerformanceData {
    tokenRates: TokenEnergyRate[];
    rateHistories: TokenRateHistory[];
    energyTokenMetadata: TokenCacheData | null;
}

export default function EnergyTokenPerformance() {
    const [data, setData] = useState<TokenPerformanceData | null>(null);
    const [timeframe, setTimeframe] = useState<string>('30d');
    const [sortBy, setSortBy] = useState<string>('energyPerBlock');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchTokenPerformance();
    }, [timeframe]);

    const fetchTokenPerformance = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await fetch(`/api/v1/admin/energy-rate-analytics?timeframe=${timeframe}`);
            if (!response.ok) {
                throw new Error('Failed to fetch token performance data');
            }
            
            const performanceData = await response.json();
            setData(performanceData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            setData(null);
        } finally {
            setLoading(false);
        }
    };

    const getTrendIcon = (direction: 'up' | 'down' | 'stable') => {
        switch (direction) {
            case 'up':
                return <TrendingUp className="h-4 w-4 text-green-500" />;
            case 'down':
                return <TrendingDown className="h-4 w-4 text-red-500" />;
            default:
                return <Minus className="h-4 w-4 text-muted-foreground" />;
        }
    };

    const getTrendColor = (direction: 'up' | 'down' | 'stable') => {
        switch (direction) {
            case 'up':
                return 'text-green-600 bg-green-50 border-green-200';
            case 'down':
                return 'text-red-600 bg-red-50 border-red-200';
            default:
                return 'text-muted-foreground bg-muted/50 border-border';
        }
    };

    const getSortedTokens = () => {
        if (!data) return [];
        
        const tokens = [...data.tokenRates];
        
        switch (sortBy) {
            case 'energyPerBlock':
                return tokens.sort((a, b) => b.energyPerBlock - a.energyPerBlock);
            case 'energyPerHour':
                return tokens.sort((a, b) => b.energyPerHour - a.energyPerHour);
            case 'totalHolders':
                return tokens.sort((a, b) => b.totalHolders - a.totalHolders);
            case 'avgHoldersPerBlock':
                return tokens.sort((a, b) => b.avgHoldersPerBlock - a.avgHoldersPerBlock);
            case 'symbol':
                return tokens.sort((a, b) => a.tokenSymbol.localeCompare(b.tokenSymbol));
            default:
                return tokens;
        }
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        Token Performance
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center h-64">
                        <RefreshCw className="h-6 w-6 animate-spin" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        Token Performance
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    if (!data) return null;

    const sortedTokens = getSortedTokens();
    
    // Calculate summary stats
    const totalEnergyPerBlock = data.tokenRates.reduce((sum, rate) => sum + rate.energyPerBlock, 0);
    const avgUsersPerToken = data.tokenRates.reduce((sum, rate) => sum + rate.totalHolders, 0) / data.tokenRates.length;
    const topPerformer = sortedTokens[0];

    return (
        <div className="space-y-6">
            {/* Controls */}
            <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="flex gap-4">
                    <div className="flex-1 min-w-32">
                        <Select value={timeframe} onValueChange={setTimeframe}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="7d">7 Days</SelectItem>
                                <SelectItem value="30d">30 Days</SelectItem>
                                <SelectItem value="90d">90 Days</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    
                    <div className="flex-1 min-w-48">
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger>
                                <SelectValue placeholder="Sort by..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="energyPerBlock">Energy per Block</SelectItem>
                                <SelectItem value="energyPerHour">Energy per Hour</SelectItem>
                                <SelectItem value="totalHolders">Total Holders</SelectItem>
                                <SelectItem value="avgHoldersPerBlock">Avg Users per Block</SelectItem>
                                <SelectItem value="symbol">Token Symbol</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                
                <Button onClick={fetchTokenPerformance} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Zap className="h-4 w-4" />
                            Total Generation
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatEnergyCompact(totalEnergyPerBlock, data.energyTokenMetadata)}
                        </div>
                        <p className="text-sm text-muted-foreground">per block (all tokens)</p>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Activity className="h-4 w-4" />
                            Active Tokens
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.tokenRates.length}</div>
                        <p className="text-sm text-muted-foreground">generating energy</p>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Avg Holders
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{Math.round(avgUsersPerToken)}</div>
                        <p className="text-sm text-muted-foreground">per token</p>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            Top Performer
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{topPerformer?.tokenSymbol || 'N/A'}</div>
                        <p className="text-sm text-muted-foreground">
                            {topPerformer ? formatEnergyCompact(topPerformer.energyPerBlock, data.energyTokenMetadata) : 'No data'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Top Performing Tokens Showcase */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Top Energy Generating Tokens</CardTitle>
                    <CardDescription>Top 5 performers by energy generation rate</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {sortedTokens.slice(0, 5).map((rate, index) => {
                            const history = data.rateHistories.find(h => h.contractId === rate.contractId);
                            return (
                                <div key={rate.contractId} className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                            <span className="text-lg font-bold">#{index + 1}</span>
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-lg">{rate.tokenSymbol}</h4>
                                            <p className="text-sm text-muted-foreground">{rate.tokenName}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-lg">
                                            {formatEnergyValue(rate.energyPerBlock, data.energyTokenMetadata, { compact: true })}
                                        </p>
                                        <p className="text-sm text-muted-foreground">per block</p>
                                        {history && (
                                            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs mt-1 ${getTrendColor(history.trendDirection)}`}>
                                                {getTrendIcon(history.trendDirection)}
                                                {history.trendDirection}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Detailed Comparison Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Token Comparison Table</CardTitle>
                    <CardDescription>Comprehensive comparison of all energy-generating tokens</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-border">
                            <thead>
                                <tr className="bg-muted/50">
                                    <th className="border border-border p-3 text-left">Rank</th>
                                    <th className="border border-border p-3 text-left">Token</th>
                                    <th className="border border-border p-3 text-right">Energy/Block</th>
                                    <th className="border border-border p-3 text-right">Energy/Hour</th>
                                    <th className="border border-border p-3 text-right">Total Holders</th>
                                    <th className="border border-border p-3 text-right">Avg Users/Block</th>
                                    <th className="border border-border p-3 text-center">Trend</th>
                                    <th className="border border-border p-3 text-right">Market Share</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedTokens.map((rate, index) => {
                                    const history = data.rateHistories.find(h => h.contractId === rate.contractId);
                                    const marketShare = totalEnergyPerBlock > 0 ? (rate.energyPerBlock / totalEnergyPerBlock) * 100 : 0;
                                    
                                    return (
                                        <tr key={rate.contractId} className={index % 2 === 0 ? 'bg-muted/20' : ''}>
                                            <td className="border border-border p-3 text-center font-bold">
                                                #{index + 1}
                                            </td>
                                            <td className="border border-border p-3">
                                                <div>
                                                    <div className="font-medium">{rate.tokenSymbol}</div>
                                                    <div className="text-sm text-muted-foreground">{rate.tokenName}</div>
                                                </div>
                                            </td>
                                            <td className="border border-border p-3 text-right font-semibold">
                                                {formatEnergyValue(rate.energyPerBlock, data.energyTokenMetadata, { compact: true })}
                                            </td>
                                            <td className="border border-border p-3 text-right">
                                                {formatEnergyValue(rate.energyPerHour, data.energyTokenMetadata, { compact: true })}
                                            </td>
                                            <td className="border border-border p-3 text-right">
                                                {rate.totalHolders.toLocaleString()}
                                            </td>
                                            <td className="border border-border p-3 text-right">
                                                {rate.avgHoldersPerBlock.toFixed(1)}
                                            </td>
                                            <td className="border border-border p-3 text-center">
                                                {history && (
                                                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${getTrendColor(history.trendDirection)}`}>
                                                        {getTrendIcon(history.trendDirection)}
                                                        {history.trendDirection}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="border border-border p-3 text-right">
                                                <Badge variant="outline">
                                                    {marketShare.toFixed(1)}%
                                                </Badge>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
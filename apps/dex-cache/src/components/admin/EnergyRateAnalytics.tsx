'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingUp, TrendingDown, Minus, Activity, Zap, Clock, BarChart3, RefreshCw } from 'lucide-react';
import type { TokenRateHistory, TokenEnergyRate } from '@/lib/energy/rate-analytics';
import { formatEnergyValue, formatEnergyCompact } from '@/lib/format-energy';
import type { TokenCacheData } from '@repo/tokens';
import EnergyRateChart from './EnergyRateChart';
import { EnergyRateBreakdown } from './EnergyRateBreakdown';

interface EnergyRateAnalyticsData {
    tokenRates: TokenEnergyRate[];
    rateHistories: TokenRateHistory[];
    energyTokenMetadata: TokenCacheData | null;
}

export default function EnergyRateAnalytics() {
    const [data, setData] = useState<EnergyRateAnalyticsData | null>(null);
    const [selectedToken, setSelectedToken] = useState<string>('all');
    const [timeframe, setTimeframe] = useState<string>('30d');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchRateAnalytics();
    }, [timeframe]);

    const fetchRateAnalytics = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await fetch(`/api/v1/admin/energy-rate-analytics?timeframe=${timeframe}`);
            if (!response.ok) {
                throw new Error('Failed to fetch rate analytics');
            }
            
            const analyticsData = await response.json();
            setData(analyticsData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            setData(null);
        } finally {
            setLoading(false);
        }
    };

    const getSelectedTokenHistory = (): TokenRateHistory | null => {
        if (!data || selectedToken === 'all') return null;
        return data.rateHistories.find(history => history.contractId === selectedToken) || null;
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

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Energy Rate Analytics
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
                        <Activity className="h-5 w-5" />
                        Energy Rate Analytics
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

    const selectedHistory = getSelectedTokenHistory();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Energy Generation Rate Analytics
                </CardTitle>
                <CardDescription>
                    Analyze energy generation rates per block and over time for different tokens
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-4 mb-6">
                    <div className="flex-1 min-w-48">
                        <Select value={selectedToken} onValueChange={setSelectedToken}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select token" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Tokens Comparison</SelectItem>
                                {data.rateHistories.map((history) => (
                                    <SelectItem key={history.contractId} value={history.contractId}>
                                        {history.tokenSymbol || history.tokenName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    
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
                    
                    <Button onClick={fetchRateAnalytics} variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>

                <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="comparison">Token Comparison</TabsTrigger>
                        <TabsTrigger value="trends">Rate Trends</TabsTrigger>
                        <TabsTrigger value="simulation">Rate Calculator</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="overview" className="space-y-6">
                        {/* Current Rates Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Zap className="h-4 w-4" />
                                        Total Energy Rate
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">
                                        {formatEnergyCompact(
                                            data.tokenRates.reduce((sum, rate) => sum + rate.energyPerBlock, 0),
                                            data.energyTokenMetadata
                                        )}
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
                                    <p className="text-sm text-muted-foreground">
                                        generating energy
                                    </p>
                                </CardContent>
                            </Card>
                            
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Clock className="h-4 w-4" />
                                        Avg Block Time
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">~10 min</div>
                                    <p className="text-sm text-muted-foreground">
                                        estimated
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Top Performing Tokens */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Top Energy Generating Tokens</CardTitle>
                                <CardDescription>Ranked by energy generated per block</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {data.tokenRates.slice(0, 5).map((rate, index) => (
                                        <div key={rate.contractId} className="flex items-center justify-between p-3 border rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <span className="text-sm font-medium">#{index + 1}</span>
                                                </div>
                                                <div>
                                                    <h4 className="font-medium">{rate.tokenSymbol}</h4>
                                                    <p className="text-sm text-muted-foreground">{rate.tokenName}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold">
                                                    {formatEnergyValue(rate.energyPerBlock, data.energyTokenMetadata, { compact: true })}
                                                </p>
                                                <p className="text-sm text-muted-foreground">per block</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    
                    <TabsContent value="comparison" className="space-y-6">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse border border-border">
                                <thead>
                                    <tr className="bg-muted/50">
                                        <th className="border border-border p-3 text-left">Token</th>
                                        <th className="border border-border p-3 text-right">Energy/Block</th>
                                        <th className="border border-border p-3 text-right">Energy/Hour</th>
                                        <th className="border border-border p-3 text-right">Avg Users/Block</th>
                                        <th className="border border-border p-3 text-right">Total Holders</th>
                                        <th className="border border-border p-3 text-center">Trend</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.tokenRates.map((rate, index) => {
                                        const history = data.rateHistories.find(h => h.contractId === rate.contractId);
                                        return (
                                            <tr key={rate.contractId} className={index % 2 === 0 ? 'bg-muted/20' : ''}>
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
                                                    {rate.avgHoldersPerBlock.toFixed(1)}
                                                </td>
                                                <td className="border border-border p-3 text-right">
                                                    {rate.totalHolders}
                                                </td>
                                                <td className="border border-border p-3 text-center">
                                                    {history && (
                                                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${getTrendColor(history.trendDirection)}`}>
                                                            {getTrendIcon(history.trendDirection)}
                                                            {history.trendDirection}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </TabsContent>
                    
                    <TabsContent value="trends" className="space-y-6">
                        {selectedHistory ? (
                            <div className="space-y-6">
                                {/* Advanced Chart */}
                                <EnergyRateChart 
                                    tokenHistory={selectedHistory}
                                    energyTokenMetadata={data.energyTokenMetadata}
                                    showUsers={true}
                                />
                                
                                {/* Detailed Statistics */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-lg">Rate Distribution</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-3">
                                                {(() => {
                                                    const rates = selectedHistory.rateHistory.map(p => p.energyPerBlock);
                                                    const sorted = [...rates].sort((a, b) => a - b);
                                                    const q1 = sorted[Math.floor(sorted.length * 0.25)];
                                                    const median = sorted[Math.floor(sorted.length * 0.5)];
                                                    const q3 = sorted[Math.floor(sorted.length * 0.75)];
                                                    
                                                    return (
                                                        <>
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Min:</span>
                                                                <span className="font-medium">
                                                                    {formatEnergyValue(Math.min(...rates), data.energyTokenMetadata, { compact: true })}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Q1 (25%):</span>
                                                                <span className="font-medium">
                                                                    {formatEnergyValue(q1, data.energyTokenMetadata, { compact: true })}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Median:</span>
                                                                <span className="font-medium">
                                                                    {formatEnergyValue(median, data.energyTokenMetadata, { compact: true })}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Q3 (75%):</span>
                                                                <span className="font-medium">
                                                                    {formatEnergyValue(q3, data.energyTokenMetadata, { compact: true })}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Max:</span>
                                                                <span className="font-medium">
                                                                    {formatEnergyValue(Math.max(...rates), data.energyTokenMetadata, { compact: true })}
                                                                </span>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </CardContent>
                                    </Card>
                                    
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-lg">User Activity</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-3">
                                                {(() => {
                                                    const users = selectedHistory.rateHistory.map(p => p.activeUsers);
                                                    const avgUsers = users.reduce((sum, u) => sum + u, 0) / users.length;
                                                    const maxUsers = Math.max(...users);
                                                    const minUsers = Math.min(...users);
                                                    
                                                    return (
                                                        <>
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Avg Users/Day:</span>
                                                                <span className="font-medium">{avgUsers.toFixed(1)}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Peak Day:</span>
                                                                <span className="font-medium">{maxUsers} users</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Lowest Day:</span>
                                                                <span className="font-medium">{minUsers} users</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Avg Energy/User:</span>
                                                                <span className="font-medium">
                                                                    {formatEnergyValue(
                                                                        selectedHistory.rateHistory.reduce((sum, p) => sum + p.energyPerUser, 0) / selectedHistory.rateHistory.length,
                                                                        data.energyTokenMetadata,
                                                                        { compact: true }
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                <BarChart3 className="h-8 w-8 mx-auto mb-2" />
                                <p>Select a specific token to view detailed rate trends</p>
                            </div>
                        )}
                    </TabsContent>
                    
                    <TabsContent value="simulation" className="space-y-6">
                        <EnergyRateBreakdown 
                            tokenData={data.rateHistories.map(history => ({
                                type: "token",
                                contractId: history.contractId,
                                name: history.tokenName,
                                symbol: history.tokenSymbol,
                                decimals: 6, // Default, can be refined with actual metadata
                                total_supply: "1000000000000", // Default, can be refined
                                image: "",
                                description: "",
                                identifier: history.contractId
                            }))}
                            energyTokenMetadata={data.energyTokenMetadata || undefined}
                            historicRates={Object.fromEntries(
                                data.tokenRates.map(rate => [
                                    rate.contractId,
                                    rate.energyPerBlock / 600 // Convert per-block to per-second (10 min blocks)
                                ])
                            )}
                        />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
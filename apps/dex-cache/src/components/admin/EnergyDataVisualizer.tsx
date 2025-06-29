'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from "@/components/ui/alert";
// import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Search, Download, RefreshCw, TrendingUp, Users, Clock, Zap } from 'lucide-react';
import type { EnergyAnalyticsData, EnergyLog, UserEnergyStats } from '@/lib/energy/analytics';
import { formatEnergyValue, formatEnergyCompact, getEnergyTokenSymbol } from '@/lib/format-energy';
import type { TokenCacheData } from '@repo/tokens';
// Note: fetchMetadata is moved to server-side API calls

interface ContractData {
    contractId: string;
    analyticsData: EnergyAnalyticsData;
}

interface ChartData {
    date: string;
    energy: number;
    users: number;
    harvests: number;
}

interface UserActivityData {
    address: string;
    totalEnergy: number;
    harvestCount: number;
    avgEnergyPerHarvest: number;
    lastHarvest: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function EnergyDataVisualizer() {
    const [contractsData, setContractsData] = useState<ContractData[]>([]);
    const [tokenMetadata, setTokenMetadata] = useState<TokenCacheData[]>([]);
    const [energyTokenMetadata, setEnergyTokenMetadata] = useState<TokenCacheData | null>(null);
    const [selectedContract, setSelectedContract] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState('30d');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchEnergyData();
    }, []);

    const fetchEnergyData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            // Fetch energy data, contracts, and energy token metadata via API
            const [energyResponse, metadataResponse, energyTokenResponse] = await Promise.all([
                fetch('/api/v1/admin/energy-analytics'),
                fetch('/api/v1/admin/energy-contracts'),
                fetch('/api/v1/energy/token-metadata') // Endpoint for energy token metadata
            ]);
            
            if (!energyResponse.ok) {
                throw new Error('Failed to fetch energy data');
            }
            
            const energyData = await energyResponse.json();
            setContractsData(energyData.contracts || []);
            
            if (metadataResponse.ok) {
                const contractData = await metadataResponse.json();
                // Extract metadata from the response - this should include full token metadata
                setTokenMetadata(contractData.metadata || []);
            }
            
            if (energyTokenResponse.ok) {
                const energyTokenData = await energyTokenResponse.json();
                setEnergyTokenMetadata(energyTokenData);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            // Fallback to mock data for demonstration
            setContractsData([]);
            setTokenMetadata([]);
            setEnergyTokenMetadata(null);
        } finally {
            setLoading(false);
        }
    };

    const getFilteredData = (): EnergyAnalyticsData | null => {
        if (selectedContract === 'all') {
            // Aggregate all contracts
            const allLogs: EnergyLog[] = [];
            const allUserStats: Record<string, UserEnergyStats> = {};
            let totalEnergy = 0;
            let totalIntegral = 0;
            let totalUsers = 0;
            
            contractsData.forEach(({ analyticsData }) => {
                allLogs.push(...analyticsData.logs);
                Object.entries(analyticsData.userStats).forEach(([address, stats]) => {
                    if (stats) {
                        allUserStats[address] = stats;
                    }
                });
                totalEnergy += analyticsData.stats.totalEnergyHarvested;
                totalIntegral += analyticsData.stats.totalIntegralCalculated;
                totalUsers += analyticsData.stats.uniqueUsers;
            });
            
            return {
                logs: allLogs,
                stats: {
                    totalEnergyHarvested: totalEnergy,
                    totalIntegralCalculated: totalIntegral,
                    uniqueUsers: totalUsers,
                    averageEnergyPerHarvest: allLogs.length > 0 ? totalEnergy / allLogs.length : 0,
                    averageIntegralPerHarvest: allLogs.length > 0 ? totalIntegral / allLogs.length : 0,
                    lastUpdated: Math.max(...contractsData.map(c => c.analyticsData.stats.lastUpdated), 0)
                },
                rates: contractsData[0]?.analyticsData.rates || {
                    overallEnergyPerMinute: 0,
                    overallIntegralPerMinute: 0,
                    topUserRates: [],
                    lastCalculated: 0
                },
                userStats: allUserStats
            };
        } else {
            const contract = contractsData.find(c => c.contractId === selectedContract);
            return contract?.analyticsData || null;
        }
    };

    const generateChartData = (data: EnergyAnalyticsData): ChartData[] => {
        const dailyData: Record<string, { energy: number; users: Set<string>; harvests: number }> = {};
        
        data.logs.forEach(log => {
            if (!log.block_time) return;
            
            const date = new Date(log.block_time * 1000).toISOString().split('T')[0];
            if (!dailyData[date]) {
                dailyData[date] = { energy: 0, users: new Set(), harvests: 0 };
            }
            
            dailyData[date].energy += log.energy;
            dailyData[date].users.add(log.sender);
            dailyData[date].harvests += 1;
        });
        
        return Object.entries(dailyData)
            .map(([date, stats]) => ({
                date,
                energy: Math.round(stats.energy),
                users: stats.users.size,
                harvests: stats.harvests
            }))
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(-30); // Last 30 days
    };

    const generateUserActivityData = (data: EnergyAnalyticsData): UserActivityData[] => {
        return Object.entries(data.userStats)
            .filter(([_, stats]) => stats !== null)
            .map(([address, stats]) => ({
                address,
                totalEnergy: stats!.totalEnergyHarvested, // Keep raw for sorting
                harvestCount: stats!.harvestCount,
                avgEnergyPerHarvest: stats!.averageEnergyPerHarvest, // Keep raw for sorting
                lastHarvest: stats!.lastHarvestTimestamp > 0 
                    ? new Date(stats!.lastHarvestTimestamp).toLocaleDateString()
                    : 'Never'
            }))
            .filter(user => user.address.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => b.totalEnergy - a.totalEnergy)
            .slice(0, 50);
    };

    const data = getFilteredData();
    const chartData = data ? generateChartData(data) : [];
    const userActivityData = data ? generateUserActivityData(data) : [];

    const downloadData = () => {
        if (!data) return;
        
        const csvContent = [
            'Date,Energy,Users,Harvests',
            ...chartData.map(d => `${d.date},${d.energy},${d.users},${d.harvests}`)
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `energy-analytics-${selectedContract}-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Energy Data Visualizer</CardTitle>
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
                    <CardTitle>Energy Data Visualizer</CardTitle>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Energy Data Visualizer
                </CardTitle>
                <CardDescription>Interactive charts and analytics for energy data</CardDescription>
            </CardHeader>
            <CardContent>
                {/* Controls */}
                <div className="flex flex-wrap gap-4 mb-6">
                    <div className="flex-1 min-w-48">
                        <Label htmlFor="contract-select">Contract</Label>
                        <Select value={selectedContract} onValueChange={setSelectedContract}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select contract" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Contracts</SelectItem>
                                {contractsData.map(({ contractId }) => {
                                    const metadata = tokenMetadata.find((token: any) => 
                                        token.contractId === contractId
                                    );
                                    return (
                                        <SelectItem key={contractId} value={contractId}>
                                            <div className="flex items-center gap-2">
                                                {metadata?.image && (
                                                    <img 
                                                        src={metadata.image} 
                                                        alt={metadata.name || contractId.split('.')[1]} 
                                                        className="w-4 h-4 rounded-full"
                                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                    />
                                                )}
                                                <span>
                                                    {metadata?.name || metadata?.symbol || contractId.split('.')[1]}
                                                </span>
                                            </div>
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </div>
                    
                    <div className="flex-1 min-w-48">
                        <Label htmlFor="search">Search Users</Label>
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="search"
                                placeholder="Search by address..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                    </div>
                    
                    <div className="flex gap-2 items-end">
                        <Button onClick={fetchEnergyData} variant="outline" size="sm">
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh
                        </Button>
                        <Button onClick={downloadData} variant="outline" size="sm" disabled={!data}>
                            <Download className="h-4 w-4 mr-2" />
                            Export
                        </Button>
                    </div>
                </div>

                {data ? (
                    <Tabs defaultValue="charts" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="charts">Charts</TabsTrigger>
                            <TabsTrigger value="users">User Activity</TabsTrigger>
                            <TabsTrigger value="raw">Raw Data</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="charts" className="space-y-6">
                            {/* Energy Over Time */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Energy Harvested Over Time</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {chartData.slice(-10).map((item, index) => (
                                                <div key={item.date} className="flex justify-between items-center text-sm">
                                                    <span className="text-muted-foreground">{item.date}</span>
                                                    <div className="flex items-center gap-2">
                                                        <div 
                                                            className="bg-primary h-2 rounded"
                                                            style={{ 
                                                                width: `${Math.min((item.energy / Math.max(...chartData.map(d => d.energy))) * 100, 100)}px`
                                                            }}
                                                        />
                                                        <span className="font-medium w-16 text-right">
                                            {formatEnergyCompact(item.energy, energyTokenMetadata)}
                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                                
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Daily Active Users</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {chartData.slice(-10).map((item, index) => (
                                                <div key={item.date} className="flex justify-between items-center text-sm">
                                                    <span className="text-muted-foreground">{item.date}</span>
                                                    <div className="flex items-center gap-2">
                                                        <div 
                                                            className="bg-green-500 h-2 rounded"
                                                            style={{ 
                                                                width: `${Math.min((item.users / Math.max(...chartData.map(d => d.users))) * 100, 100)}px`
                                                            }}
                                                        />
                                                        <span className="font-medium w-8 text-right">{item.users}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                            
                            {/* Summary Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2">
                                            <Zap className="h-4 w-4 text-primary" />
                                            <div>
                                                <p className="text-sm text-muted-foreground">Total Energy</p>
                                                <p className="font-semibold">
                                                    {formatEnergyCompact(data.stats.totalEnergyHarvested, energyTokenMetadata)} {getEnergyTokenSymbol(energyTokenMetadata)}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2">
                                            <Users className="h-4 w-4 text-green-500" />
                                            <div>
                                                <p className="text-sm text-muted-foreground">Unique Users</p>
                                                <p className="font-semibold">{data.stats.uniqueUsers.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="h-4 w-4 text-blue-500" />
                                            <div>
                                                <p className="text-sm text-muted-foreground">Avg per Harvest</p>
                                                <p className="font-semibold">
                                                    {formatEnergyValue(data.stats.averageEnergyPerHarvest, energyTokenMetadata, { compact: true, maxDecimals: 2 })}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-4 w-4 text-purple-500" />
                                            <div>
                                                <p className="text-sm text-muted-foreground">Last Updated</p>
                                                <p className="font-semibold text-xs">{new Date(data.stats.lastUpdated).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>
                        
                        <TabsContent value="users" className="space-y-4">
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse border border-border">
                                    <thead>
                                        <tr className="bg-muted/50">
                                            <th className="border border-border p-3 text-left">Address</th>
                                            <th className="border border-border p-3 text-right">Total Energy</th>
                                            <th className="border border-border p-3 text-right">Harvests</th>
                                            <th className="border border-border p-3 text-right">Avg/Harvest</th>
                                            <th className="border border-border p-3 text-right">Last Harvest</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {userActivityData.map((user, index) => (
                                            <tr key={user.address} className={index % 2 === 0 ? 'bg-muted/20' : ''}>
                                                <td className="border border-border p-3 font-mono text-sm">
                                                    {user.address.slice(0, 8)}...{user.address.slice(-4)}
                                                </td>
                                                <td className="border border-border p-3 text-right font-semibold">
                                                    {formatEnergyCompact(user.totalEnergy, energyTokenMetadata)}
                                                </td>
                                                <td className="border border-border p-3 text-right">
                                                    {user.harvestCount}
                                                </td>
                                                <td className="border border-border p-3 text-right">
                                                    {formatEnergyValue(user.avgEnergyPerHarvest, energyTokenMetadata, { compact: true, maxDecimals: 2 })}
                                                </td>
                                                <td className="border border-border p-3 text-right text-sm">
                                                    {user.lastHarvest}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </TabsContent>
                        
                        <TabsContent value="raw" className="space-y-4">
                            <div className="bg-muted/50 p-4 rounded-lg overflow-auto max-h-96">
                                <pre className="text-xs">
                                    {JSON.stringify(data, null, 2)}
                                </pre>
                            </div>
                        </TabsContent>
                    </Tabs>
                ) : (
                    <div className="text-center py-8 text-muted-foreground">
                        No energy data available
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
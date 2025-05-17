'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/lib/context/app-context';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    BarChart,
    LineChart,
    Loader2,
    RefreshCw,
    TrendingUp,
    Users,
    Zap,
    Award,
    Clock,
    AlertTriangle
} from 'lucide-react';

interface EnergyStats {
    totalEnergyHarvested: number;
    totalIntegralCalculated: number;
    uniqueUsers: number;
    lastUpdated: number;
    averageEnergyPerHarvest: number;
    averageIntegralPerHarvest: number;
}

interface EnergyRates {
    overallEnergyPerMinute: number;
    overallIntegralPerMinute: number;
    topUserRates: {
        address: string;
        energyPerMinute: number;
    }[];
    lastCalculated: number;
    rateHistoryTimeframes: {
        daily: { timestamp: number; rate: number }[];
        weekly: { timestamp: number; rate: number }[];
        monthly: { timestamp: number; rate: number }[];
    };
}

interface UserEnergyStats {
    address: string;
    totalEnergyHarvested: number;
    totalIntegralCalculated: number;
    harvestCount: number;
    averageEnergyPerHarvest: number;
    lastHarvestTimestamp: number;
    estimatedEnergyRate: number;
    estimatedIntegralRate: number;
    harvestHistory: {
        timestamp: number;
        energy: number;
        integral: number;
        blockHeight?: number;
    }[];
}

interface EnergyAnalyticsProps {
    vaultContractId: string;
}

export function EnergyAnalytics({ vaultContractId }: EnergyAnalyticsProps) {
    const { walletState } = useApp();
    const [stats, setStats] = useState<EnergyStats | null>(null);
    const [rates, setRates] = useState<EnergyRates | null>(null);
    const [userStats, setUserStats] = useState<UserEnergyStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTimeframe, setActiveTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

    // Mock data for demo purposes (replace with actual API calls)
    const mockStats: EnergyStats = {
        totalEnergyHarvested: 12546785492,
        totalIntegralCalculated: 54624589654321,
        uniqueUsers: 47,
        lastUpdated: Date.now() - 3600000, // 1 hour ago
        averageEnergyPerHarvest: 962967492,
        averageIntegralPerHarvest: 4145455521168
    };

    const mockRates: EnergyRates = {
        overallEnergyPerMinute: 123456,
        overallIntegralPerMinute: 6789012,
        topUserRates: [
            { address: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS', energyPerMinute: 215678 },
            { address: 'SP1P72Z3704VMT3DMHPP2CB8TGQWGDBHD3RPR9GZS', energyPerMinute: 187965 },
            { address: 'SP1Z92MPDQEWZXW36VX71Q25HKF5K2EPCJ304F275', energyPerMinute: 156432 }
        ],
        lastCalculated: Date.now() - 1800000, // 30 minutes ago
        rateHistoryTimeframes: {
            daily: Array(10).fill(0).map((_, i) => ({
                timestamp: Date.now() - (10 - i) * 60 * 60 * 1000, // hourly points
                rate: 100000 + Math.random() * 50000
            })),
            weekly: Array(10).fill(0).map((_, i) => ({
                timestamp: Date.now() - (10 - i) * 24 * 60 * 60 * 1000, // daily points
                rate: 90000 + Math.random() * 70000
            })),
            monthly: Array(10).fill(0).map((_, i) => ({
                timestamp: Date.now() - (10 - i) * 3 * 24 * 60 * 60 * 1000, // 3-day points
                rate: 80000 + Math.random() * 100000
            }))
        }
    };

    const mockUserStats: UserEnergyStats = walletState.address ? {
        address: walletState.address,
        totalEnergyHarvested: 5824756920,
        totalIntegralCalculated: 25475893654782,
        harvestCount: 12,
        averageEnergyPerHarvest: 485396410,
        lastHarvestTimestamp: Date.now() - 12 * 60 * 60 * 1000, // 12 hours ago
        estimatedEnergyRate: 134926,
        estimatedIntegralRate: 5861946,
        harvestHistory: Array(12).fill(0).map((_, i) => ({
            timestamp: Date.now() - (12 - i) * 24 * 60 * 60 * 1000,
            energy: 400000000 + Math.random() * 200000000,
            integral: 3000000000000 + Math.random() * 2000000000000,
            blockHeight: 80000 + i * 1000
        }))
    } : null;

    // Fetch data on component mount
    useEffect(() => {
        fetchAnalyticsData();
    }, [vaultContractId]);

    // Fetch user stats when wallet changes
    useEffect(() => {
        if (walletState.connected && walletState.address) {
            fetchUserStats(walletState.address);
        } else {
            setUserStats(null);
        }
    }, [walletState.connected, walletState.address]);

    const fetchAnalyticsData = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // In a real implementation, these would be API calls to the server actions
            // For now, we'll use mock data
            setTimeout(() => {
                setStats(mockStats);
                setRates(mockRates);
                setIsLoading(false);
            }, 1000);
        } catch (err) {
            console.error('Error fetching energy analytics:', err);
            setError('Failed to load energy analytics data');
            setIsLoading(false);
        }
    };

    const fetchUserStats = async (address: string) => {
        try {
            // In a real implementation, this would be an API call
            // For now, we'll use mock data
            setTimeout(() => {
                setUserStats(mockUserStats);
            }, 500);
        } catch (err) {
            console.error(`Error fetching user stats for ${address}:`, err);
            // Don't set global error for user stats failure
        }
    };

    const handleRefreshData = async () => {
        setIsRefreshing(true);
        setError(null);

        try {
            // In a real implementation, this would call the server action to refresh data
            // For now, we'll simulate a refresh
            setTimeout(() => {
                setStats({
                    ...mockStats,
                    lastUpdated: Date.now()
                });
                setRates({
                    ...mockRates,
                    lastCalculated: Date.now()
                });
                if (walletState.connected && walletState.address) {
                    setUserStats({
                        ...mockUserStats!,
                        lastHarvestTimestamp: Date.now() - 2 * 60 * 60 * 1000 // 2 hours ago
                    });
                }
                setIsRefreshing(false);
            }, 2000);
        } catch (err) {
            console.error('Error refreshing energy data:', err);
            setError('Failed to refresh energy data');
            setIsRefreshing(false);
        }
    };

    // Format large numbers for display
    const formatNumber = (num: number, decimals = 2): string => {
        if (num === undefined || num === null) return 'N/A';

        if (num === 0) return '0';

        if (num < 1) {
            return num.toFixed(decimals);
        }

        if (num < 1000) {
            return num.toFixed(decimals);
        }

        if (num < 1000000) {
            return (num / 1000).toFixed(decimals) + 'K';
        }

        if (num < 1000000000) {
            return (num / 1000000).toFixed(decimals) + 'M';
        }

        return (num / 1000000000).toFixed(decimals) + 'B';
    };

    // Format timestamp to readable date
    const formatDate = (timestamp: number): string => {
        return new Date(timestamp).toLocaleString();
    };

    // Format time ago
    const formatTimeAgo = (timestamp: number): string => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);

        if (seconds < 60) return `${seconds} seconds ago`;

        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} minutes ago`;

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} hours ago`;

        const days = Math.floor(hours / 24);
        if (days < 30) return `${days} days ago`;

        const months = Math.floor(days / 30);
        return `${months} months ago`;
    };

    // Truncate address for display
    const truncateAddress = (address: string, start = 6, end = 4): string => {
        if (!address) return '';
        if (address.length <= start + end) return address;
        return `${address.slice(0, start)}...${address.slice(-end)}`;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                <p>Loading energy analytics...</p>
            </div>
        );
    }

    // No data state
    if (!stats && !rates && !isLoading) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <Alert variant="default" className="bg-muted/30 border-muted">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>No analytics data available</AlertTitle>
                        <AlertDescription>
                            Energy analytics data hasn&apos;t been collected yet. Click refresh to start collecting data.
                        </AlertDescription>
                    </Alert>
                    <div className="flex justify-center mt-4">
                        <Button onClick={handleRefreshData} disabled={isRefreshing}>
                            {isRefreshing ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Initializing...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Initialize Analytics
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xl font-bold">
                    <Zap className="h-5 w-5 text-primary inline mr-2" />
                    Energy Analytics
                </CardTitle>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshData}
                    disabled={isRefreshing}
                    className="h-8"
                >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
                </Button>
            </CardHeader>

            {error && (
                <div className="px-6 mb-4">
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                </div>
            )}

            <CardContent className="pt-0">
                <Tabs defaultValue="overview">
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                        <TabsTrigger value="overview">
                            <BarChart className="h-4 w-4 mr-2" />
                            Overview
                        </TabsTrigger>
                        <TabsTrigger value="rates">
                            <TrendingUp className="h-4 w-4 mr-2" />
                            Rates
                        </TabsTrigger>
                        <TabsTrigger value="user">
                            <Users className="h-4 w-4 mr-2" />
                            Your Stats
                        </TabsTrigger>
                    </TabsList>

                    {/* OVERVIEW TAB */}
                    <TabsContent value="overview" className="space-y-4">
                        {stats && (
                            <>
                                <div className="text-xs text-muted-foreground mb-2">
                                    Last updated: {formatDate(stats.lastUpdated)} ({formatTimeAgo(stats.lastUpdated)})
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-muted/30 p-4 rounded-lg">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="text-sm text-muted-foreground mb-1">Total Energy Harvested</div>
                                                <div className="text-2xl font-bold">{formatNumber(stats.totalEnergyHarvested)}</div>
                                            </div>
                                            <div className="p-2 rounded-full bg-primary/20">
                                                <Zap className="h-5 w-5 text-primary" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-muted/30 p-4 rounded-lg">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="text-sm text-muted-foreground mb-1">Unique Users</div>
                                                <div className="text-2xl font-bold">{stats.uniqueUsers}</div>
                                            </div>
                                            <div className="p-2 rounded-full bg-primary/20">
                                                <Users className="h-5 w-5 text-primary" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-muted/30 p-4 rounded-lg">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="text-sm text-muted-foreground mb-1">Avg Energy per Harvest</div>
                                                <div className="text-2xl font-bold">{formatNumber(stats.averageEnergyPerHarvest)}</div>
                                            </div>
                                            <div className="p-2 rounded-full bg-primary/20">
                                                <Award className="h-5 w-5 text-primary" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-muted/30 p-4 rounded-lg mt-6">
                                    <h3 className="text-base font-semibold mb-3">Energy System Performance</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">Total Integral Calculated</div>
                                            <div className="text-xl font-bold">{formatNumber(stats.totalIntegralCalculated)}</div>
                                            <div className="text-xs text-muted-foreground mt-1">Token balance × blocks held</div>
                                        </div>

                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">Energy/Integral Ratio</div>
                                            <div className="text-xl font-bold">
                                                {formatNumber(stats.totalEnergyHarvested / stats.totalIntegralCalculated * 1000000, 6)}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1">Energy per million integral units</div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </TabsContent>

                    {/* RATES TAB */}
                    <TabsContent value="rates" className="space-y-4">
                        {rates && (
                            <>
                                <div className="bg-muted/30 p-4 rounded-lg">
                                    <h3 className="text-base font-semibold mb-3">Energy Accrual Rates</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">Energy per Minute</div>
                                            <div className="text-xl font-bold">{formatNumber(rates.overallEnergyPerMinute)}</div>
                                            <div className="text-xs text-muted-foreground mt-1">Average energy accrual rate</div>
                                        </div>

                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">Integral per Minute</div>
                                            <div className="text-xl font-bold">{formatNumber(rates.overallIntegralPerMinute)}</div>
                                            <div className="text-xs text-muted-foreground mt-1">Average integral accrual rate</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-muted/30 p-4 rounded-lg">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-base font-semibold">Energy Rate History</h3>
                                        <div className="flex space-x-1">
                                            <Button
                                                variant={activeTimeframe === 'daily' ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setActiveTimeframe('daily')}
                                                className="h-7 text-xs"
                                            >
                                                Day
                                            </Button>
                                            <Button
                                                variant={activeTimeframe === 'weekly' ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setActiveTimeframe('weekly')}
                                                className="h-7 text-xs"
                                            >
                                                Week
                                            </Button>
                                            <Button
                                                variant={activeTimeframe === 'monthly' ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setActiveTimeframe('monthly')}
                                                className="h-7 text-xs"
                                            >
                                                Month
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="h-64 bg-muted/80 rounded-lg p-4 flex items-center justify-center">
                                        <div className="text-center text-muted-foreground">
                                            <LineChart className="h-8 w-8 mx-auto mb-2" />
                                            <p>Energy rate chart would appear here</p>
                                            <p className="text-xs mt-1">
                                                Showing {activeTimeframe} rates:
                                                {rates.rateHistoryTimeframes[activeTimeframe].length} data points
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-muted/30 p-4 rounded-lg">
                                    <h3 className="text-base font-semibold mb-3">Top Energy Harvesters</h3>
                                    <div className="space-y-3">
                                        {rates.topUserRates.map((user, index) => (
                                            <div key={user.address} className="flex items-center justify-between">
                                                <div className="flex items-center">
                                                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center mr-3 text-xs font-semibold">
                                                        {index + 1}
                                                    </div>
                                                    <span className="font-mono">{truncateAddress(user.address)}</span>
                                                </div>
                                                <div className="font-semibold">
                                                    {formatNumber(user.energyPerMinute)} / min
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </TabsContent>

                    {/* USER STATS TAB */}
                    <TabsContent value="user" className="space-y-4">
                        {!walletState.connected ? (
                            <div className="text-center py-10">
                                <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold mb-2">Connect Wallet to View Your Stats</h3>
                                <p className="text-muted-foreground max-w-md mx-auto mb-4">
                                    Connect your wallet to see your personal energy harvesting statistics
                                    and earning performance.
                                </p>
                                <Button onClick={() => useApp().connectWallet()}>
                                    Connect Wallet
                                </Button>
                            </div>
                        ) : !userStats ? (
                            <div className="text-center py-10">
                                <AlertTriangle className="h-12 w-12 text-yellow-500/50 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
                                <p className="text-muted-foreground max-w-md mx-auto mb-4">
                                    We don't have any energy harvesting data for your address yet.
                                    Try harvesting some energy first!
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="bg-primary/5 border border-primary/10 p-4 rounded-lg">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-base font-semibold">Your Energy Metrics</h3>
                                        <Badge variant="outline" className="font-mono">
                                            {truncateAddress(userStats.address)}
                                        </Badge>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">Total Energy Harvested</div>
                                            <div className="text-xl font-bold">{formatNumber(userStats.totalEnergyHarvested)}</div>
                                        </div>

                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">Harvest Count</div>
                                            <div className="text-xl font-bold">{userStats.harvestCount}</div>
                                        </div>

                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">Last Harvest</div>
                                            <div className="text-xl font-bold">{formatTimeAgo(userStats.lastHarvestTimestamp)}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-muted/30 p-4 rounded-lg">
                                        <h3 className="text-base font-semibold mb-3">Your Energy Rate</h3>
                                        <div className="space-y-2">
                                            <div>
                                                <div className="text-sm text-muted-foreground mb-1">Energy per Minute</div>
                                                <div className="text-xl font-bold">{formatNumber(userStats.estimatedEnergyRate)}</div>
                                            </div>

                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>Per Hour</span>
                                                <span>{formatNumber(userStats.estimatedEnergyRate * 60)}</span>
                                            </div>

                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>Per Day</span>
                                                <span>{formatNumber(userStats.estimatedEnergyRate * 60 * 24)}</span>
                                            </div>

                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>Per Week</span>
                                                <span>{formatNumber(userStats.estimatedEnergyRate * 60 * 24 * 7)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-muted/30 p-4 rounded-lg">
                                        <h3 className="text-base font-semibold mb-3">Energy Harvests</h3>
                                        <div className="h-40 overflow-auto pr-2">
                                            {userStats.harvestHistory.length === 0 ? (
                                                <div className="text-center text-muted-foreground py-4">
                                                    No harvest history found
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {userStats.harvestHistory.slice().reverse().map((harvest, index) => (
                                                        <div key={index} className="text-xs border border-border/40 rounded p-2">
                                                            <div className="flex justify-between mb-1">
                                                                <span className="text-muted-foreground">
                                                                    {new Date(harvest.timestamp).toLocaleDateString()}
                                                                </span>
                                                                <span className="font-semibold">
                                                                    {formatNumber(harvest.energy)}
                                                                </span>
                                                            </div>
                                                            {harvest.blockHeight && (
                                                                <div className="text-muted-foreground flex justify-between">
                                                                    <span>Block Height</span>
                                                                    <span>{harvest.blockHeight.toLocaleString()}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="h-64 bg-muted/80 rounded-lg p-4 flex items-center justify-center">
                                    <div className="text-center text-muted-foreground">
                                        <BarChart className="h-8 w-8 mx-auto mb-2" />
                                        <p>Energy harvest history chart would appear here</p>
                                        <p className="text-xs mt-1">
                                            Showing {userStats.harvestHistory.length} harvests over time
                                        </p>
                                    </div>
                                </div>
                            </>
                        )}
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}

export default EnergyAnalytics;
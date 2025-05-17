'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/lib/context/app-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    AlertTriangle,
    AlertCircle,
    BarChart2,
    ListChecks,
    ArrowDownUp,
    ExternalLinkIcon,
    InfoIcon
} from 'lucide-react';
import { getTokenMetadataCached, TokenCacheData } from '@repo/tokens'
import Link from 'next/link';
import { fetcHoldToEarnLogs } from '@/lib/energy/analytics';

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
        txId?: string;
    }[];
}

interface HarvestLogTransactionDetails {
    block_height?: number;
    timestamp?: number; // Assuming timestamp might be a unix timestamp number
    // Add other relevant fields from transaction_details if known
}

interface HarvestLog {
    energy: bigint;
    integral: bigint;
    message: string;
    op: string;
    sender: string;
    tx_id: string;
    transaction_details: HarvestLogTransactionDetails | null;
}

interface EnergyAnalyticsProps {
    vaultContractId: string;
}

const ENERGY_TOKEN_CONTRACT_ID = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energy';

export function EnergyAnalytics({ vaultContractId }: EnergyAnalyticsProps) {
    const { walletState } = useApp();
    const [stats, setStats] = useState<EnergyStats | null>(null);
    const [rates, setRates] = useState<EnergyRates | null>(null);
    const [userStats, setUserStats] = useState<UserEnergyStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTimeframe, setActiveTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
    const [isEmptyData, setIsEmptyData] = useState(false);
    const [logs, setLogs] = useState<HarvestLog[]>([]);
    const [visibleLogs, setVisibleLogs] = useState(5);
    const [energyTokenDecimals, setEnergyTokenDecimals] = useState<number | null>(null);

    const engineContractId = 'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dexterity-hold-to-earn'

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
    }, [walletState.connected, walletState.address, vaultContractId]);

    const fetchAnalyticsData = async (refreshing = false) => {
        if (refreshing) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }
        setError(null);

        try {
            // Fetch analytics data from the API
            const response = await fetch(`/api/v1/energy/${engineContractId}${refreshing ? '?refresh=true' : ''}`);

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (data.status === 'success' && data.data) {
                const analyticsData = data.data;

                // Check if we have any data
                if (analyticsData.logs && analyticsData.logs.length === 0) {
                    setIsEmptyData(true);
                } else {
                    setIsEmptyData(false);
                }

                // Set stats data
                if (analyticsData.stats) {
                    setStats(analyticsData.stats);
                }

                // Set rates data
                if (analyticsData.rates) {
                    setRates(analyticsData.rates);
                }

                // If user is connected, check if their data is in the response
                if (walletState.connected && walletState.address && analyticsData.userStats) {
                    const userData = analyticsData.userStats[walletState.address];
                    if (userData) {
                        setUserStats(userData);
                    }
                }
            } else {
                throw new Error(data.error || 'Failed to fetch analytics data');
            }
        } catch (err) {
            console.error('Error fetching energy analytics:', err);
            setError('Failed to load energy analytics data');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const fetchUserStats = async (address: string) => {
        try {
            const response = await fetch(`/api/v1/energy/${vaultContractId}/user?address=${address}`);

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (data.status === 'success') {
                if (data.data === null) {
                    // No data for this user
                    setUserStats(null);
                } else {
                    setUserStats(data.data);
                }
            } else {
                throw new Error(data.error || 'Failed to fetch user stats');
            }
        } catch (err) {
            console.error(`Error fetching user stats for ${address}:`, err);
            // Don't set global error for user stats failure
        }
    };

    const handleRefreshData = async () => {
        setIsRefreshing(true);
        await fetchAnalyticsData(true);
        if (walletState.connected && walletState.address) {
            await fetchUserStats(walletState.address);
        }
    };

    // Format large numbers for display
    const formatNumber = (atomicNum: number, decimals = 2): string => {
        const num = atomicNum / (10 ** decimals);

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

    useEffect(() => {
        const fetchAnalyticsDataAndDecimals = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // Fetch decimals first or in parallel
                console.log(`Fetching decimals for ${ENERGY_TOKEN_CONTRACT_ID}`);
                const metadata: TokenCacheData = await getTokenMetadataCached(ENERGY_TOKEN_CONTRACT_ID);
                if (metadata && typeof metadata.decimals === 'number') {
                    console.log(`Fetched decimals: ${metadata.decimals}`);
                    setEnergyTokenDecimals(metadata.decimals);
                } else {
                    console.warn('Could not retrieve decimals for energy token. Metadata:', metadata);
                    setEnergyTokenDecimals(0); // Default to 0 if not found, logs a warning
                }

                console.log(`Fetching logs for ${vaultContractId}`);
                const fetchedLogs = await fetcHoldToEarnLogs(vaultContractId);
                fetchedLogs.sort((a: HarvestLog, b: HarvestLog) => {
                    const timeA = a.transaction_details?.block_height || a.transaction_details?.timestamp || 0;
                    const timeB = b.transaction_details?.block_height || b.transaction_details?.timestamp || 0;
                    return Number(timeB) - Number(timeA); // Descending order
                });
                setLogs(fetchedLogs);

            } catch (err) {
                console.error("Failed to fetch analytics data or decimals:", err);
                setError("Failed to load analytics. Please try again later.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchAnalyticsDataAndDecimals();
    }, [vaultContractId]);

    // Helper function to format energy based on fetched decimals
    const formatEnergyDisplay = (rawValue: bigint | number, decimals: number | null): string => {
        if (decimals === null || decimals === undefined) {
            return rawValue.toString(); // Fallback if decimals not loaded
        }
        // Ensure rawValue is a number for division
        const valueAsNumber = typeof rawValue === 'bigint' ? Number(rawValue) : rawValue;

        if (decimals === 0) {
            return valueAsNumber.toLocaleString(); // Format as whole number
        }

        const divisor = 10 ** decimals;
        const formatted = valueAsNumber / divisor;

        return formatted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: Math.max(2, decimals) }); // Show at least 2, up to `decimals` places
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
    if (isEmptyData || (!stats && !rates && !isLoading)) {
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
                                        {rates.topUserRates.length > 0 ? (
                                            rates.topUserRates.map((user, index) => (
                                                <div key={user.address + index} className="flex items-center justify-between">
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
                                            ))
                                        ) : (
                                            <div className="text-center text-muted-foreground py-2">
                                                No user rate data available yet
                                            </div>
                                        )}
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
                                            {userStats.harvestHistory?.length === 0 ? (
                                                <div className="text-center text-muted-foreground py-4">
                                                    No harvest history found
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {userStats.harvestHistory?.slice().reverse().map((harvest, index) => (
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
                                            Showing {userStats.harvestHistory?.length} harvests over time
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
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/lib/context/app-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
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
    InfoIcon,
    PauseIcon,
    PlayIcon
} from 'lucide-react';
import { getTokenMetadataCached, TokenCacheData } from '@repo/tokens'
import Link from 'next/link';
import { fetcHoldToEarnLogs } from '@/lib/energy/analytics';
// import EnergyRateChart from '../charts/EnergyRateChart';

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
    hasData?: boolean;
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

function SimpleLineChart({ data, height = 200, width = '100%' }: {
    data: { timestamp: number; rate: number }[],
    height?: number,
    width?: string | number
}) {
    const [hoveredPoint, setHoveredPoint] = useState<{ index: number, x: number, y: number } | null>(null);

    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>No data available</p>
            </div>
        );
    }

    // Find min and max values for scaling
    const maxRate = Math.max(...data.map(d => d.rate));
    const minRate = Math.min(...data.map(d => d.rate));

    // Add 10% padding to the top
    const yMax = maxRate * 1.1;
    const yMin = Math.max(0, minRate * 0.9); // Don't go below 0

    // Calculate timestamps for x-axis
    const timestamps = data.map(d => d.timestamp);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);

    // SVG dimensions and padding
    const paddingX = 40;
    const paddingY = 30;
    const chartWidth = typeof width === 'number' ? width : parseInt(width) || 400;
    const chartHeight = height;
    const innerWidth = chartWidth - (paddingX * 2);
    const innerHeight = chartHeight - (paddingY * 2);

    // Scale functions to convert data values to pixel positions
    const scaleX = (timestamp: number) => {
        return paddingX + (innerWidth * (timestamp - minTime) / (maxTime - minTime));
    };

    const scaleY = (rate: number) => {
        return chartHeight - paddingY - (innerHeight * (rate - yMin) / (yMax - yMin));
    };

    // Generate the SVG path for the line
    const pathData = data.map((point, i) => {
        const x = scaleX(point.timestamp);
        const y = scaleY(point.rate);
        return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
    }).join(' ');

    // Format date for x-axis labels
    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Format date for tooltip
    const formatTooltipDate = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Generate grid lines
    const numYGridLines = 4;
    const yGridLines = Array.from({ length: numYGridLines + 1 }).map((_, i) => {
        const y = paddingY + (innerHeight * i / numYGridLines);
        const value = yMax - ((yMax - yMin) * i / numYGridLines);
        return { y, value };
    });

    return (
        <div className="w-full h-full bg-muted/20 rounded-lg py-2 relative">
            <svg width={width} height={height} className="overflow-visible">
                {/* Background grid lines */}
                {yGridLines.map((line, i) => (
                    <React.Fragment key={`grid-${i}`}>
                        <line
                            x1={paddingX}
                            y1={line.y}
                            x2={chartWidth - paddingX}
                            y2={line.y}
                            stroke="currentColor"
                            strokeOpacity={0.1}
                            strokeDasharray="4,4"
                        />
                        <text
                            x={paddingX - 5}
                            y={line.y + 4}
                            textAnchor="end"
                            fontSize={10}
                            fill="currentColor"
                            opacity={0.7}
                        >
                            {line.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </text>
                    </React.Fragment>
                ))}

                {/* Y-axis line */}
                <line
                    x1={paddingX}
                    y1={paddingY}
                    x2={paddingX}
                    y2={chartHeight - paddingY}
                    stroke="currentColor"
                    strokeOpacity={0.2}
                />

                {/* X-axis line */}
                <line
                    x1={paddingX}
                    y1={chartHeight - paddingY}
                    x2={chartWidth - paddingX}
                    y2={chartHeight - paddingY}
                    stroke="currentColor"
                    strokeOpacity={0.2}
                />

                {/* Area under the line */}
                <path
                    d={`${pathData} L ${scaleX(data[data.length - 1].timestamp)},${chartHeight - paddingY} L ${scaleX(data[0].timestamp)},${chartHeight - paddingY} Z`}
                    fill="hsl(var(--primary))"
                    fillOpacity={0.1}
                />

                {/* Main data line */}
                <path
                    d={pathData}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Data points with interactions */}
                {data.map((point, i) => (
                    <g key={i}>
                        <circle
                            cx={scaleX(point.timestamp)}
                            cy={scaleY(point.rate)}
                            r={4}
                            fill="hsl(var(--background))"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                        />
                        {/* Invisible larger circle for easier hover */}
                        <circle
                            cx={scaleX(point.timestamp)}
                            cy={scaleY(point.rate)}
                            r={10}
                            fill="transparent"
                            onMouseEnter={() => setHoveredPoint({
                                index: i,
                                x: scaleX(point.timestamp),
                                y: scaleY(point.rate)
                            })}
                            onMouseLeave={() => setHoveredPoint(null)}
                            style={{ cursor: 'pointer' }}
                        />
                    </g>
                ))}

                {/* X-axis labels (first and last only) */}
                <text
                    x={paddingX}
                    y={chartHeight - paddingY + 15}
                    textAnchor="middle"
                    fontSize={9}
                    fill="currentColor"
                    opacity={0.7}
                >
                    {formatDate(minTime)}
                </text>

                <text
                    x={chartWidth - paddingX}
                    y={chartHeight - paddingY + 15}
                    textAnchor="middle"
                    fontSize={9}
                    fill="currentColor"
                    opacity={0.7}
                >
                    {formatDate(maxTime)}
                </text>
            </svg>

            {/* Tooltip */}
            {hoveredPoint !== null && (
                <div
                    className="absolute pointer-events-none bg-background border border-border rounded-md shadow-md p-2 text-xs"
                    style={{
                        left: hoveredPoint.x + 10,
                        top: hoveredPoint.y - 40,
                        transform: 'translateY(-100%)',
                        minWidth: '150px',
                        zIndex: 10
                    }}
                >
                    <div className="font-semibold">{formatTooltipDate(data[hoveredPoint.index].timestamp)}</div>
                    <div className="flex justify-between mt-1">
                        <span className="text-muted-foreground">Rate:</span>
                        <span className="font-medium">{data[hoveredPoint.index].rate.toLocaleString(undefined, {
                            maximumFractionDigits: 2
                        })}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

export function EnergyAnalytics({ vaultContractId }: EnergyAnalyticsProps) {
    const { walletState } = useApp();
    const [stats, setStats] = useState<EnergyStats | null>(null);
    const [rates, setRates] = useState<EnergyRates | null>(null);
    const [userStats, setUserStats] = useState<UserEnergyStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isEmptyData, setIsEmptyData] = useState(false);
    const [logs, setLogs] = useState<HarvestLog[]>([]);
    const [visibleLogs, setVisibleLogs] = useState(5);
    const [energyTokenDecimals, setEnergyTokenDecimals] = useState<number | null>(null);
    const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState<boolean>(false);
    const [refreshInterval, setRefreshInterval] = useState<number>(60); // seconds
    const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());
    const autoRefreshInterval = 60000; // 1 minute

    const engineContractId = useMemo(() => {
        const hashIndex = vaultContractId.indexOf('#');
        return hashIndex >= 0 ? vaultContractId.substring(0, hashIndex) : vaultContractId;
    }, [vaultContractId]);

    // Fetch data on component mount
    useEffect(() => {
        fetchAnalyticsData();
    }, [vaultContractId]);

    // Set up periodic refresh to check for data updates from cron job
    useEffect(() => {
        // Check for updates every 3 minutes
        const refreshInterval = 3 * 60 * 1000;
        const intervalId = setInterval(() => {
            // Only refresh if the component is visible (not navigated away)
            if (document.visibilityState === 'visible') {
                console.log('Checking for energy data updates from cron job...');
                // Use regular fetch, not refresh=true, to use cache if available
                fetchAnalyticsData(false);
            }
        }, refreshInterval);

        // Clean up interval on unmount
        return () => clearInterval(intervalId);
    }, [vaultContractId]);

    // Fetch user stats when wallet changes
    useEffect(() => {
        if (walletState.connected && walletState.address) {
            fetchUserStats(walletState.address);
        } else {
            setUserStats(null);
        }
    }, [walletState.connected, walletState.address, vaultContractId]);

    // Setup auto-refresh if enabled
    useEffect(() => {
        let intervalId: NodeJS.Timeout | null = null;

        if (isAutoRefreshEnabled && !isLoading && !isRefreshing) {
            console.log(`Setting up auto-refresh every ${refreshInterval} seconds`);
            intervalId = setInterval(() => {
                console.log('Auto-refreshing energy data...');
                handleRefreshData();
            }, refreshInterval * 1000);
        }

        // Cleanup interval on unmount or when auto-refresh is disabled
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [isAutoRefreshEnabled, refreshInterval, isLoading, isRefreshing]);

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
        setLastRefreshTime(Date.now());
        console.log('Manually refreshing energy data...');

        try {
            // Force a refresh of the API data
            const response = await fetch(`/api/v1/energy/${engineContractId}?refresh=true`);

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (data.status === 'success' && data.data) {
                const analyticsData = data.data;

                // Update stats and rates with fresh data
                if (analyticsData.stats) {
                    setStats(analyticsData.stats);
                }

                if (analyticsData.rates) {
                    setRates(analyticsData.rates);
                }

                console.log('Energy data refreshed successfully');
            }

            // Also refresh user stats if wallet is connected
            if (walletState.connected && walletState.address) {
                await fetchUserStats(walletState.address);
            }
        } catch (err) {
            console.error('Error refreshing energy data:', err);
            setError('Failed to refresh energy data');
        } finally {
            setIsRefreshing(false);
        }
    };

    // Format large numbers for display
    const formatNumber = (atomicNum: number, decimals = 2): string => {
        if (atomicNum === null || atomicNum === undefined) return '0';

        // Handle very small non-zero values
        if (atomicNum > 0 && atomicNum < 0.001) {
            return '< 0.001'; // Show as "less than 0.001" to indicate non-zero but small
        }

        // For large numbers (over 1 million), use compact notation
        if (Math.abs(atomicNum) >= 1_000_000) {
            return new Intl.NumberFormat('en-US', {
                notation: 'compact',
                maximumFractionDigits: decimals
            }).format(atomicNum);
        }

        // Standard formatting for normal-sized numbers
        return new Intl.NumberFormat('en-US', {
            maximumFractionDigits: decimals,
            minimumFractionDigits: decimals > 0 ? 1 : 0
        }).format(atomicNum);
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

        if (valueAsNumber === 0) {
            return '0'; // Simple case for zero
        }

        // If the value is very small (non-zero) but would display as 0, show with scientific notation
        if (decimals > 0) {
            const divisor = 10 ** decimals;
            const formatted = valueAsNumber / divisor;

            // For very small values, use scientific notation to avoid showing 0
            if (formatted > 0 && formatted < 0.001) {
                return formatted.toExponential(2);
            }

            // For normal values, use locale formatting
            return formatted.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: Math.min(6, decimals)  // Show at most 6 decimal places
            });
        }

        // For whole numbers (decimal = 0)
        return valueAsNumber.toLocaleString();
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
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsAutoRefreshEnabled(!isAutoRefreshEnabled)}
                        className="h-8"
                    >
                        <Clock className={`h-3.5 w-3.5 mr-1.5 ${isAutoRefreshEnabled ? 'text-green-500' : 'text-muted-foreground'}`} />
                        {isAutoRefreshEnabled ? 'Auto' : 'Manual'}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefreshData}
                        disabled={isRefreshing}
                        className="h-8"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                        {isRefreshing ? 'Refreshing...' : 'Refresh'}
                    </Button>
                </div>
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
                        <TabsTrigger disabled value="overview">
                            <BarChart className="h-4 w-4 mr-2" />
                            Overview
                        </TabsTrigger>
                        <TabsTrigger value="rates">
                            <TrendingUp className="h-4 w-4 mr-2" />
                            Rates
                        </TabsTrigger>
                        <TabsTrigger disabled value="user">
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
                                    <h3 className="text-base font-semibold mb-3">Current System Rate</h3>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <span className="text-muted-foreground text-sm">Overall Rate:</span>
                                            <span className="font-medium ml-2">{formatNumber(rates?.overallEnergyPerMinute || 0)} Energy/min</span>
                                        </div>
                                        <div>
                                            {isAutoRefreshEnabled ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setIsAutoRefreshEnabled(false)}
                                                    className="text-xs h-8"
                                                >
                                                    <PauseIcon className="mr-1 h-3 w-3" />
                                                    Pause Updates
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setIsAutoRefreshEnabled(true)}
                                                    className="text-xs h-8"
                                                >
                                                    <PlayIcon className="mr-1 h-3 w-3" />
                                                    Auto Update
                                                </Button>
                                            )}
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
                                            {!userStats.hasData && userStats.totalEnergyHarvested === 0 && (
                                                <div className="text-xs text-muted-foreground mt-1">No harvest data yet</div>
                                            )}
                                        </div>

                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">Harvest Count</div>
                                            <div className="text-xl font-bold">{userStats.harvestCount}</div>
                                            {!userStats.hasData && userStats.harvestCount === 0 && (
                                                <div className="text-xs text-muted-foreground mt-1">No harvests yet</div>
                                            )}
                                        </div>

                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">Last Harvest</div>
                                            <div className="text-xl font-bold">
                                                {userStats.hasData ? formatTimeAgo(userStats.lastHarvestTimestamp) : 'N/A'}
                                            </div>
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
                                                {!userStats.hasData && userStats.estimatedEnergyRate > 0 && (
                                                    <div className="text-xs text-muted-foreground mt-1">Estimated rate based on current system data</div>
                                                )}
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
                                                    {!userStats.hasData ? (
                                                        <>
                                                            <p>No harvest records found</p>
                                                            <p className="text-xs mt-2">Try harvesting energy to see your history</p>
                                                        </>
                                                    ) : (
                                                        <>No harvest history found</>
                                                    )}
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
                                        {!userStats.hasData ? (
                                            <>
                                                <InfoIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground/70" />
                                                <p>Once you harvest energy, your history will appear here</p>
                                                <p className="text-xs mt-1">
                                                    Your estimated energy rate is based on system data
                                                </p>
                                                <div className="mt-4">
                                                    <Link
                                                        href={`/api/v1/energy/${vaultContractId}/user?address=${userStats.address}&refresh=true`}
                                                        target="_blank"
                                                        className="text-xs text-primary/70 hover:text-primary flex items-center justify-center gap-1"
                                                    >
                                                        <ExternalLinkIcon className="h-3 w-3" />
                                                        View raw data
                                                    </Link>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <BarChart className="h-8 w-8 mx-auto mb-2" />
                                                <p>Energy harvest history chart would appear here</p>
                                                <p className="text-xs mt-1">
                                                    Showing {userStats.harvestHistory?.length} harvests over time
                                                </p>
                                                <div className="mt-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={handleRefreshData}
                                                        className="text-xs h-7"
                                                    >
                                                        <RefreshCw className="h-3 w-3 mr-1" />
                                                        Refresh Data
                                                    </Button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {process.env.NODE_ENV === 'development' && (
                                    <Alert className="mt-4 bg-muted/20 border border-muted">
                                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                                        <AlertTitle className="text-sm">Debug Information</AlertTitle>
                                        <AlertDescription className="text-xs">
                                            {userStats.hasData ? (
                                                <p>User has harvest data. Found {userStats.harvestHistory.length} harvest records.</p>
                                            ) : (
                                                <p>No harvest records found for this address. System is showing estimated rates.</p>
                                            )}
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </>
                        )}
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}

export default EnergyAnalytics;
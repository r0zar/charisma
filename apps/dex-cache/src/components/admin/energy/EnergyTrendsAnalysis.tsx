'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingUp, BarChart3, RefreshCw, Calendar, Activity } from 'lucide-react';
import type { TokenRateHistory, TokenEnergyRate } from '@/lib/energy/rate-analytics';
import { formatEnergyValue } from '@/lib/format-energy';
import type { TokenCacheData } from '@repo/tokens';
import EnergyRateChart from '../EnergyRateChart';

interface TrendsAnalysisData {
    tokenRates: TokenEnergyRate[];
    rateHistories: TokenRateHistory[];
    energyTokenMetadata: TokenCacheData | null;
}

export default function EnergyTrendsAnalysis() {
    const [data, setData] = useState<TrendsAnalysisData | null>(null);
    const [selectedToken, setSelectedToken] = useState<string>('all');
    const [timeframe, setTimeframe] = useState<string>('30d');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchTrendsData();
    }, [timeframe]);

    const fetchTrendsData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await fetch(`/api/v1/admin/energy-rate-analytics?timeframe=${timeframe}`);
            if (!response.ok) {
                throw new Error('Failed to fetch trends data');
            }
            
            const trendsData = await response.json();
            setData(trendsData);
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

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Trends & Analysis
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
                        <TrendingUp className="h-5 w-5" />
                        Trends & Analysis
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

    // Calculate trend statistics
    const trendStats = data.rateHistories.reduce((acc, history) => {
        switch (history.trendDirection) {
            case 'up':
                acc.upTrending++;
                break;
            case 'down':
                acc.downTrending++;
                break;
            default:
                acc.stable++;
        }
        return acc;
    }, { upTrending: 0, downTrending: 0, stable: 0 });

    return (
        <div className="space-y-6">
            {/* Controls */}
            <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="flex gap-4">
                    <div className="flex-1 min-w-48">
                        <Select value={selectedToken} onValueChange={setSelectedToken}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select token for detailed analysis" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Tokens Overview</SelectItem>
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
                </div>
                
                <Button onClick={fetchTrendsData} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Trend Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-green-500" />
                            Trending Up
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{trendStats.upTrending}</div>
                        <p className="text-sm text-muted-foreground">tokens increasing</p>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />
                            Trending Down
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{trendStats.downTrending}</div>
                        <p className="text-sm text-muted-foreground">tokens decreasing</p>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Activity className="h-4 w-4" />
                            Stable
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{trendStats.stable}</div>
                        <p className="text-sm text-muted-foreground">tokens stable</p>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Time Period
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{timeframe}</div>
                        <p className="text-sm text-muted-foreground">analysis window</p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Chart Section */}
            {selectedHistory ? (
                <div className="space-y-6">
                    {/* Token-Specific Chart */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">
                                Energy Rate Trends: {selectedHistory.tokenSymbol}
                            </CardTitle>
                            <CardDescription>
                                Historical energy generation rates and user activity over time
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <EnergyRateChart 
                                tokenHistory={selectedHistory}
                                energyTokenMetadata={data.energyTokenMetadata}
                                showUsers={true}
                            />
                        </CardContent>
                    </Card>
                    
                    {/* Detailed Statistics for Selected Token */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Rate Distribution</CardTitle>
                                <CardDescription>Statistical breakdown of energy generation rates</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {(() => {
                                        const rates = selectedHistory.rateHistory.map(p => p.energyPerBlock);
                                        const sorted = [...rates].sort((a, b) => a - b);
                                        const q1 = sorted[Math.floor(sorted.length * 0.25)];
                                        const median = sorted[Math.floor(sorted.length * 0.5)];
                                        const q3 = sorted[Math.floor(sorted.length * 0.75)];
                                        const mean = rates.reduce((sum, r) => sum + r, 0) / rates.length;
                                        const variance = rates.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / rates.length;
                                        const stdDev = Math.sqrt(variance);
                                        const coefficientOfVariation = mean > 0 ? (stdDev / mean) * 100 : 0;
                                        
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
                                                    <span className="text-muted-foreground">Mean:</span>
                                                    <span className="font-medium">
                                                        {formatEnergyValue(mean, data.energyTokenMetadata, { compact: true })}
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
                                                <hr className="my-2" />
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Volatility:</span>
                                                    <Badge variant={coefficientOfVariation < 20 ? "default" : coefficientOfVariation < 50 ? "secondary" : "destructive"}>
                                                        {coefficientOfVariation.toFixed(1)}%
                                                    </Badge>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            </CardContent>
                        </Card>
                        
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">User Activity Analysis</CardTitle>
                                <CardDescription>User engagement patterns and correlations</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {(() => {
                                        const users = selectedHistory.rateHistory.map(p => p.activeUsers);
                                        const avgUsers = users.reduce((sum, u) => sum + u, 0) / users.length;
                                        const maxUsers = Math.max(...users);
                                        const minUsers = Math.min(...users);
                                        const avgEnergyPerUser = selectedHistory.rateHistory.reduce((sum, p) => sum + p.energyPerUser, 0) / selectedHistory.rateHistory.length;
                                        
                                        // Calculate correlation between users and energy
                                        const energyRates = selectedHistory.rateHistory.map(p => p.energyPerBlock);
                                        const avgEnergy = energyRates.reduce((sum, e) => sum + e, 0) / energyRates.length;
                                        const avgUserCount = users.reduce((sum, u) => sum + u, 0) / users.length;
                                        
                                        let correlation = 0;
                                        if (users.length > 1) {
                                            const numerator = energyRates.reduce((sum, energy, i) => 
                                                sum + (energy - avgEnergy) * (users[i] - avgUserCount), 0);
                                            const denominator = Math.sqrt(
                                                energyRates.reduce((sum, energy) => sum + Math.pow(energy - avgEnergy, 2), 0) *
                                                users.reduce((sum, user) => sum + Math.pow(user - avgUserCount, 2), 0)
                                            );
                                            correlation = denominator > 0 ? numerator / denominator : 0;
                                        }
                                        
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
                                                        {formatEnergyValue(avgEnergyPerUser, data.energyTokenMetadata, { compact: true })}
                                                    </span>
                                                </div>
                                                <hr className="my-2" />
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">User-Energy Correlation:</span>
                                                    <Badge variant={Math.abs(correlation) > 0.7 ? "default" : Math.abs(correlation) > 0.3 ? "secondary" : "outline"}>
                                                        {(correlation * 100).toFixed(0)}%
                                                    </Badge>
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    {Math.abs(correlation) > 0.7 ? "Strong" : Math.abs(correlation) > 0.3 ? "Moderate" : "Weak"} correlation between user activity and energy generation
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
                /* All Tokens Overview */
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Token Trend Overview</CardTitle>
                        <CardDescription>Summary of trend patterns across all tokens</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {data.rateHistories.map((history) => {
                                const currentRate = data.tokenRates.find(r => r.contractId === history.contractId);
                                const trendColor = history.trendDirection === 'up' ? 'text-green-600' : 
                                                 history.trendDirection === 'down' ? 'text-red-600' : 'text-muted-foreground';
                                
                                return (
                                    <div key={history.contractId} className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="flex items-center gap-4">
                                            <div>
                                                <h4 className="font-medium">{history.tokenSymbol}</h4>
                                                <p className="text-sm text-muted-foreground">{history.tokenName}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold">
                                                {currentRate ? formatEnergyValue(currentRate.energyPerBlock, data.energyTokenMetadata, { compact: true }) : 'N/A'}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="outline" className={trendColor}>
                                                    {history.trendDirection === 'up' ? '↗' : history.trendDirection === 'down' ? '↘' : '→'} 
                                                    {history.trendDirection}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">
                                                    {history.rateHistory.length} data points
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {data.rateHistories.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground">
                                    <BarChart3 className="h-8 w-8 mx-auto mb-2" />
                                    <p>No trend data available for the selected timeframe</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
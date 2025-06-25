'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import type { EnergyRateTimePoint, TokenRateHistory } from '@/lib/energy/rate-analytics';
import { formatEnergyValue } from '@/lib/format-energy';
import type { TokenCacheData } from '@repo/tokens';

interface EnergyRateChartProps {
    tokenHistory: TokenRateHistory;
    energyTokenMetadata: TokenCacheData | null;
    showUsers?: boolean;
}

export default function EnergyRateChart({ 
    tokenHistory, 
    energyTokenMetadata, 
    showUsers = false 
}: EnergyRateChartProps) {
    if (tokenHistory.rateHistory.length === 0) {
        return (
            <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                    No rate history data available for {tokenHistory.tokenSymbol}
                </CardContent>
            </Card>
        );
    }

    const maxRate = Math.max(...tokenHistory.rateHistory.map(p => p.energyPerBlock));
    const maxUsers = Math.max(...tokenHistory.rateHistory.map(p => p.activeUsers));
    const minRate = Math.min(...tokenHistory.rateHistory.map(p => p.energyPerBlock));
    
    // Calculate moving average for smoother trend line
    const calculateMovingAverage = (data: number[], windowSize = 3): number[] => {
        const result: number[] = [];
        for (let i = 0; i < data.length; i++) {
            const start = Math.max(0, i - Math.floor(windowSize / 2));
            const end = Math.min(data.length, i + Math.floor(windowSize / 2) + 1);
            const window = data.slice(start, end);
            const avg = window.reduce((sum, val) => sum + val, 0) / window.length;
            result.push(avg);
        }
        return result;
    };

    const rates = tokenHistory.rateHistory.map(p => p.energyPerBlock);
    const movingAverage = calculateMovingAverage(rates, 5);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>{tokenHistory.tokenSymbol} Energy Generation Rate</span>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline">
                            Avg: {formatEnergyValue(tokenHistory.averageRate, energyTokenMetadata, { compact: true })}
                        </Badge>
                        <Badge 
                            variant={tokenHistory.trendDirection === 'up' ? 'default' : 
                                   tokenHistory.trendDirection === 'down' ? 'destructive' : 'secondary'}
                        >
                            {tokenHistory.trendDirection}
                        </Badge>
                    </div>
                </CardTitle>
                <CardDescription>
                    Energy per block over time • Volatility: {tokenHistory.volatility.toFixed(1)}%
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {/* Legend */}
                    <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-primary rounded"></div>
                            <span>Energy per Block</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-primary/50 rounded"></div>
                            <span>Moving Average</span>
                        </div>
                        {showUsers && (
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-green-500 rounded"></div>
                                <span>Active Users</span>
                            </div>
                        )}
                    </div>

                    {/* Chart Area */}
                    <div className="relative">
                        {/* Y-axis labels */}
                        <div className="absolute left-0 top-0 bottom-0 w-20 flex flex-col justify-between text-xs text-muted-foreground py-2">
                            <span>{formatEnergyValue(maxRate, energyTokenMetadata, { compact: true })}</span>
                            <span>{formatEnergyValue((maxRate + minRate) / 2, energyTokenMetadata, { compact: true })}</span>
                            <span>{formatEnergyValue(minRate, energyTokenMetadata, { compact: true })}</span>
                        </div>

                        {/* Chart content */}
                        <div className="ml-24 relative h-64 border-l border-b border-border">
                            {/* Grid lines */}
                            <div className="absolute inset-0">
                                {[0, 25, 50, 75, 100].map(percent => (
                                    <div 
                                        key={percent}
                                        className="absolute w-full border-t border-dashed border-muted"
                                        style={{ top: `${percent}%` }}
                                    />
                                ))}
                            </div>

                            {/* Data points and lines */}
                            <div className="absolute inset-0 flex items-end">
                                {tokenHistory.rateHistory.map((point, index) => {
                                    const heightPercent = maxRate > 0 ? ((point.energyPerBlock - minRate) / (maxRate - minRate)) * 100 : 0;
                                    const avgHeightPercent = maxRate > 0 ? ((movingAverage[index] - minRate) / (maxRate - minRate)) * 100 : 0;
                                    const userHeightPercent = showUsers && maxUsers > 0 ? (point.activeUsers / maxUsers) * 100 : 0;
                                    const widthPercent = 100 / tokenHistory.rateHistory.length;

                                    return (
                                        <div 
                                            key={point.date}
                                            className="relative flex-1 flex items-end justify-center group"
                                            style={{ minHeight: '100%' }}
                                        >
                                            {/* Actual rate bar */}
                                            <div 
                                                className="bg-primary w-3 rounded-t transition-all duration-200 hover:bg-primary/80"
                                                style={{ height: `${Math.max(heightPercent, 2)}%` }}
                                                title={`${point.date}: ${formatEnergyValue(point.energyPerBlock, energyTokenMetadata)} per block`}
                                            />
                                            
                                            {/* Moving average indicator */}
                                            <div 
                                                className="absolute w-1 bg-primary/50 rounded-full"
                                                style={{ 
                                                    height: '4px',
                                                    bottom: `${Math.max(avgHeightPercent, 2)}%`,
                                                    left: '50%',
                                                    transform: 'translateX(-50%)'
                                                }}
                                            />

                                            {/* Users bar (if enabled) */}
                                            {showUsers && (
                                                <div 
                                                    className="bg-green-500 w-1 rounded-t ml-1"
                                                    style={{ height: `${Math.max(userHeightPercent, 2)}%` }}
                                                    title={`${point.activeUsers} active users`}
                                                />
                                            )}

                                            {/* Tooltip on hover */}
                                            <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-popover border border-border rounded px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                                                <div className="font-medium">{point.date}</div>
                                                <div>Rate: {formatEnergyValue(point.energyPerBlock, energyTokenMetadata)}</div>
                                                <div>Users: {point.activeUsers}</div>
                                                <div>Per User: {formatEnergyValue(point.energyPerUser, energyTokenMetadata)}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* X-axis labels */}
                        <div className="ml-24 mt-2 flex justify-between text-xs text-muted-foreground">
                            <span>{tokenHistory.rateHistory[0]?.date}</span>
                            <span>{tokenHistory.rateHistory[Math.floor(tokenHistory.rateHistory.length / 2)]?.date}</span>
                            <span>{tokenHistory.rateHistory[tokenHistory.rateHistory.length - 1]?.date}</span>
                        </div>
                    </div>

                    {/* Statistics summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
                        <div className="text-center">
                            <div className="text-sm text-muted-foreground">Peak Rate</div>
                            <div className="font-semibold">
                                {formatEnergyValue(maxRate, energyTokenMetadata, { compact: true })}
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-sm text-muted-foreground">Min Rate</div>
                            <div className="font-semibold">
                                {formatEnergyValue(minRate, energyTokenMetadata, { compact: true })}
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-sm text-muted-foreground">Avg Users</div>
                            <div className="font-semibold">
                                {(tokenHistory.rateHistory.reduce((sum, p) => sum + p.activeUsers, 0) / tokenHistory.rateHistory.length).toFixed(1)}
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-sm text-muted-foreground">Data Points</div>
                            <div className="font-semibold">{tokenHistory.rateHistory.length}</div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
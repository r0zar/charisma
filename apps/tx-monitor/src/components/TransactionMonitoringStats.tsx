'use client';

import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { QueueStatsResponse } from '@/lib/types';

async function fetchTransactionStats(): Promise<QueueStatsResponse> {
    try {
        const response = await fetch('/api/v1/queue/stats');
        const data = await response.json();
        
        if (data.success) {
            return data.data;
        }
        
        throw new Error('Failed to fetch transaction stats');
    } catch (error) {
        console.error('Failed to fetch transaction stats:', error);
        throw error;
    }
}

async function processQueue(): Promise<void> {
    const response = await fetch('/api/v1/admin/trigger', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    });
    
    if (!response.ok) {
        throw new Error('Failed to process queue');
    }
}

export function TransactionMonitoringStats() {
    const [stats, setStats] = useState<QueueStatsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadStats = async () => {
        try {
            setError(null);
            const data = await fetchTransactionStats();
            setStats(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load stats');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadStats();
        setIsRefreshing(false);
    };

    const handleProcessQueue = async () => {
        try {
            await processQueue();
            await handleRefresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to process queue');
        }
    };

    useEffect(() => {
        loadStats();
        
        // Auto-refresh every 30 seconds
        const interval = setInterval(loadStats, 30000);
        return () => clearInterval(interval);
    }, []);

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="w-5 h-5" />
                        Transaction Monitoring
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8">Loading...</div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="w-5 h-5" />
                        Transaction Monitoring
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-red-500">
                        Error: {error}
                        <Button onClick={handleRefresh} variant="outline" className="mt-2 ml-2">
                            Retry
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!stats) {
        return null;
    }

    const totalMonitored = stats.totalProcessed;
    const successRate = totalMonitored > 0 
        ? ((stats.totalSuccessful / totalMonitored) * 100).toFixed(1)
        : '0';
    
    const healthColor = stats.processingHealth === 'healthy' ? 'text-green-500' : 
                       stats.processingHealth === 'warning' ? 'text-yellow-500' : 'text-red-500';
    
    const healthBgColor = stats.processingHealth === 'healthy' ? 'bg-green-500' : 
                         stats.processingHealth === 'warning' ? 'bg-yellow-500' : 'bg-red-500';
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-muted-foreground" />
                    Transaction Monitoring
                    <Tooltip>
                        <TooltipTrigger>
                            <Info className="w-4 h-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                            Real-time monitoring of transaction statuses for queued transactions. System automatically checks blockchain confirmations every minute.
                        </TooltipContent>
                    </Tooltip>
                    <div className="ml-auto flex gap-2">
                        <Button
                            onClick={handleRefresh}
                            variant="outline"
                            size="sm"
                            disabled={isRefreshing}
                        >
                            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                            onClick={handleProcessQueue}
                            variant="outline"
                            size="sm"
                        >
                            Process Queue
                        </Button>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">System Health:</span>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Info className="w-4 h-4 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    Overall health of the transaction monitoring system based on success rates and processing times.
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 ${healthBgColor} rounded-full`}></div>
                            <span className="font-mono text-foreground capitalize">
                                {stats.processingHealth}
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Queue Size:</span>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Info className="w-4 h-4 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    Number of transactions currently queued for monitoring.
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        <span className="font-mono text-foreground">{stats.queueSize}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Total Processed:</span>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Info className="w-4 h-4 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    Total number of transactions that have been processed by the monitoring system.
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        <span className="font-mono text-foreground">{totalMonitored}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Successful:</span>
                        </div>
                        <span className="font-mono text-foreground">{stats.totalSuccessful}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <XCircle className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Failed:</span>
                        </div>
                        <span className="font-mono text-foreground">{stats.totalFailed}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Success Rate:</span>
                            <Tooltip>
                                <TooltipTrigger>
                                    <Info className="w-4 h-4 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    Percentage of processed transactions that have been successfully confirmed on the blockchain.
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        <span className="font-mono text-foreground">{successRate}%</span>
                    </div>
                    
                    {stats.oldestTransaction && (
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Oldest Transaction:</span>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Info className="w-4 h-4 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        The oldest transaction currently in the queue and how long it has been waiting.
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <span className="font-mono text-muted-foreground">
                                {stats.oldestTransactionAge ? `${Math.round(stats.oldestTransactionAge / (60 * 1000))}m` : 'N/A'}
                            </span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
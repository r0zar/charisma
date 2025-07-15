'use client';

import React from 'react';
import { Activity, CheckCircle, XCircle, Clock } from 'lucide-react';
import { InfoTooltip } from '@/components/ui/tooltip';

interface TransactionStats {
    totalOrders: number;
    ordersNeedingMonitoring: number;
    pendingTransactions: number;
    confirmedTransactions: number;
    failedTransactions: number;
    lastCheckTime?: string;
    processingHealth: 'healthy' | 'warning' | 'error';
    txMonitor?: {
        queueSize: number;
        oldestTransaction?: string;
        oldestTransactionAge?: number;
        totalProcessed: number;
        totalFailed: number;
        totalSuccessful: number;
        processingHealth: 'healthy' | 'warning' | 'error';
        serviceHealth?: {
            cron: 'healthy' | 'warning' | 'error';
            api: 'healthy' | 'warning' | 'error';
            queue: 'healthy' | 'warning' | 'error';
            kvConnectivity: boolean;
            uptime: number;
        } | null;
    };
}

async function fetchTransactionStats(): Promise<TransactionStats> {
    try {
        const TX_MONITOR_URL = process.env.TX_MONITOR_URL || 'http://localhost:3001';
        
        // Fetch from tx-monitor service
        const [statsResponse, healthResponse] = await Promise.all([
            fetch(`${TX_MONITOR_URL}/api/v1/queue/stats`),
            fetch(`${TX_MONITOR_URL}/api/v1/health`)
        ]);
        
        const [statsData, healthData] = await Promise.all([
            statsResponse.json(),
            healthResponse.json()
        ]);
        
        if (statsData.success && healthData.success) {
            const stats = statsData.data;
            const health = healthData.data;
            
            return {
                totalOrders: stats.totalTransactions || 0,
                ordersNeedingMonitoring: stats.queueSize || 0,
                pendingTransactions: stats.pendingCount || 0,
                confirmedTransactions: stats.confirmedCount || 0,
                failedTransactions: stats.failedCount || 0,
                processingHealth: stats.processingHealth || 'error',
                lastCheckTime: stats.lastChecked || undefined,
                txMonitor: {
                    queueSize: stats.queueSize || 0,
                    oldestTransaction: stats.oldestTransactionId,
                    oldestTransactionAge: stats.oldestTransactionAge,
                    totalProcessed: stats.totalProcessed || 0,
                    totalFailed: stats.failedCount || 0,
                    totalSuccessful: stats.confirmedCount || 0,
                    processingHealth: stats.processingHealth || 'error',
                    serviceHealth: health
                }
            };
        }
        
        throw new Error('Failed to fetch transaction stats from tx-monitor service');
    } catch (error) {
        console.error('Failed to fetch transaction stats:', error);
        return {
            totalOrders: 0,
            ordersNeedingMonitoring: 0,
            pendingTransactions: 0,
            confirmedTransactions: 0,
            failedTransactions: 0,
            processingHealth: 'error' as const,
            lastCheckTime: undefined
        };
    }
}

interface TransactionMonitoringStatsProps {
    stats: TransactionStats;
}

export function TransactionMonitoringStats({ stats }: TransactionMonitoringStatsProps) {
    const totalMonitored = stats.pendingTransactions + stats.confirmedTransactions + stats.failedTransactions;
    const successRate = totalMonitored > 0 
        ? ((stats.confirmedTransactions / totalMonitored) * 100).toFixed(1)
        : '0';
    
    // Simple health calculation based on success rate
    const successRateNum = parseFloat(successRate);
    const processingHealth = successRateNum >= 90 ? 'healthy' : successRateNum >= 70 ? 'warning' : 'error';
    
    const healthColor = processingHealth === 'healthy' ? 'text-green-500' : 
                       processingHealth === 'warning' ? 'text-yellow-500' : 'text-red-500';
    
    const healthBgColor = processingHealth === 'healthy' ? 'bg-green-500' : 
                         processingHealth === 'warning' ? 'bg-yellow-500' : 'bg-red-500';
    
    return (
        <div className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Transaction Monitoring</h3>
                <InfoTooltip content="Real-time monitoring of transaction statuses for broadcasted orders. System automatically checks blockchain confirmations every minute." />
            </div>
            
            <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">System Health:</span>
                        <InfoTooltip content="Overall health of the transaction monitoring system based on success rates and processing times." />
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
                        <span className="text-muted-foreground">Total Monitored:</span>
                        <InfoTooltip content="Number of orders with transactions currently being monitored for blockchain confirmation." />
                    </div>
                    <span className="font-mono text-foreground">{totalMonitored}</span>
                </div>
                
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Confirmed:</span>
                    </div>
                    <span className="font-mono text-foreground">{stats.confirmedTransactions}</span>
                </div>
                
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Pending:</span>
                    </div>
                    <span className="font-mono text-foreground">{stats.pendingTransactions}</span>
                </div>
                
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Failed:</span>
                    </div>
                    <span className="font-mono text-foreground">{stats.failedTransactions}</span>
                </div>
                
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Success Rate:</span>
                        <InfoTooltip content="Percentage of monitored transactions that have been successfully confirmed on the blockchain." />
                    </div>
                    <span className="font-mono text-foreground">{successRate}%</span>
                </div>
                
                {stats.lastCheckTime && (
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Last Check:</span>
                            <InfoTooltip content="When the monitoring system last checked transaction statuses. Updates every minute." />
                        </div>
                        <span className="font-mono text-muted-foreground">
                            {new Date(stats.lastCheckTime).toLocaleTimeString()}
                        </span>
                    </div>
                )}
            </div>
            
            {/* TX Monitor Service Stats */}
            {stats.txMonitor && (
                <div className="mt-6 pt-4 border-t border-border">
                    <div className="flex items-center gap-2 mb-3">
                        <Activity className="w-4 h-4 text-muted-foreground" />
                        <h4 className="font-semibold">TX Monitor Service</h4>
                        <InfoTooltip content="Statistics from the centralized transaction monitoring service." />
                    </div>
                    
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Queue Size:</span>
                            <span className="font-mono text-foreground">{stats.txMonitor.queueSize}</span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Total Processed:</span>
                            <span className="font-mono text-foreground">{stats.txMonitor.totalProcessed}</span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Service Health:</span>
                            <span className={`font-mono capitalize ${
                                stats.txMonitor.processingHealth === 'healthy' ? 'text-green-500' : 
                                stats.txMonitor.processingHealth === 'warning' ? 'text-yellow-500' : 'text-red-500'
                            }`}>
                                {stats.txMonitor.processingHealth}
                            </span>
                        </div>
                        
                        {stats.txMonitor.serviceHealth && (
                            <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">API:</span>
                                    <span className={`font-mono capitalize ${
                                        stats.txMonitor.serviceHealth.api === 'healthy' ? 'text-green-500' : 
                                        stats.txMonitor.serviceHealth.api === 'warning' ? 'text-yellow-500' : 'text-red-500'
                                    }`}>
                                        {stats.txMonitor.serviceHealth.api}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Cron:</span>
                                    <span className={`font-mono capitalize ${
                                        stats.txMonitor.serviceHealth.cron === 'healthy' ? 'text-green-500' : 
                                        stats.txMonitor.serviceHealth.cron === 'warning' ? 'text-yellow-500' : 'text-red-500'
                                    }`}>
                                        {stats.txMonitor.serviceHealth.cron}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Queue:</span>
                                    <span className={`font-mono capitalize ${
                                        stats.txMonitor.serviceHealth.queue === 'healthy' ? 'text-green-500' : 
                                        stats.txMonitor.serviceHealth.queue === 'warning' ? 'text-yellow-500' : 'text-red-500'
                                    }`}>
                                        {stats.txMonitor.serviceHealth.queue}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">KV:</span>
                                    <span className={`font-mono ${
                                        stats.txMonitor.serviceHealth.kvConnectivity ? 'text-green-500' : 'text-red-500'
                                    }`}>
                                        {stats.txMonitor.serviceHealth.kvConnectivity ? 'Connected' : 'Disconnected'}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
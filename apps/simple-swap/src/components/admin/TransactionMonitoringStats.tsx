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
}

async function fetchTransactionStats(): Promise<TransactionStats> {
    try {
        const response = await fetch('/api/admin/transaction-monitor/stats');
        const data = await response.json();
        
        if (data.success) {
            const rawStats = data.data;
            
            // Calculate derived values
            const totalMonitored = rawStats.pendingTransactions + rawStats.confirmedTransactions + rawStats.failedTransactions;
            
            // Determine processing health
            let processingHealth: TransactionStats['processingHealth'] = 'healthy';
            if (totalMonitored === 0) {
                processingHealth = 'healthy'; // No transactions to monitor is fine
            } else if (rawStats.failedTransactions > totalMonitored * 0.1) { // More than 10% failed
                processingHealth = 'error';
            } else if (rawStats.pendingTransactions > totalMonitored * 0.3) { // More than 30% pending
                processingHealth = 'warning';
            }
            
            return {
                ...rawStats,
                processingHealth,
                lastCheckTime: rawStats.lastCheckTime
            };
        }
        
        throw new Error('Failed to fetch transaction stats');
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
        </div>
    );
}
'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, Clock, DollarSign, Activity, CheckCircle, XCircle, Timer, Target, ClipboardList } from 'lucide-react';

interface OrdersStat {
    title: string;
    value: string;
    change: string;
    changeType: 'positive' | 'negative' | 'neutral';
    icon: React.ComponentType<{ className?: string }>;
    description: string;
}

interface OrdersStatsData {
    totalOrders: number;
    openOrders: number;
    filledOrders: number;
    cancelledOrders: number;
    recentActivity: {
        filled24h: number;
        cancelled24h: number;
    };
}

interface TransactionMonitoringStats {
    totalOrders: number;
    ordersNeedingMonitoring: number;
    pendingTransactions: number;
    confirmedTransactions: number;
    failedTransactions: number;
}


interface OrdersStatsProps {
    stats: {
        totalOrders: number;
        ordersNeedingMonitoring: number;
        pendingTransactions: number;
        confirmedTransactions: number;
        failedTransactions: number;
        orderTypes: {
            single: number;
            dca: number;
            sandwich: number;
        };
    };
}

export function OrdersStats({ stats: adminStats }: OrdersStatsProps) {
    const calculatedStats: OrdersStat[] = [
        {
            title: 'Total Orders',
            value: adminStats.totalOrders.toLocaleString(),
            change: adminStats.confirmedTransactions > 0 ? `+${adminStats.confirmedTransactions}` : '0',
            changeType: adminStats.confirmedTransactions > 0 ? 'positive' : 'neutral',
            icon: ClipboardList,
            description: 'All orders in system'
        },
        {
            title: 'Open Orders',
            value: (adminStats.totalOrders - adminStats.ordersNeedingMonitoring).toLocaleString(),
            change: adminStats.totalOrders > 0 ? `${(((adminStats.totalOrders - adminStats.ordersNeedingMonitoring) / adminStats.totalOrders) * 100).toFixed(1)}%` : '0%',
            changeType: 'neutral',
            icon: Clock,
            description: 'Orders awaiting execution'
        },
        {
            title: 'Confirmed Orders',
            value: adminStats.confirmedTransactions.toLocaleString(),
            change: adminStats.confirmedTransactions > 0 ? `+${adminStats.confirmedTransactions}` : '0',
            changeType: adminStats.confirmedTransactions > 0 ? 'positive' : 'neutral',
            icon: CheckCircle,
            description: 'Blockchain confirmed orders'
        },
        {
            title: 'Success Rate',
            value: (() => {
                const totalMonitored = adminStats.pendingTransactions + adminStats.confirmedTransactions + adminStats.failedTransactions;
                return totalMonitored > 0 ? `${((adminStats.confirmedTransactions / totalMonitored) * 100).toFixed(1)}%` : '0%';
            })(),
            change: adminStats.confirmedTransactions > adminStats.failedTransactions ? '+0.3%' : '-0.1%',
            changeType: adminStats.confirmedTransactions > adminStats.failedTransactions ? 'positive' : 'negative',
            icon: Target,
            description: 'Transaction success rate (monitored orders only)'
        }
    ];
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {calculatedStats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                    <div key={index} className="bg-card overflow-hidden shadow rounded-lg border border-border hover:shadow-md transition-shadow">
                        <div className="p-5">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <div className={`w-8 h-8 rounded-md flex items-center justify-center ${index % 4 === 0 ? 'bg-blue-500/20 text-blue-500' :
                                        index % 4 === 1 ? 'bg-green-500/20 text-green-500' :
                                            index % 4 === 2 ? 'bg-purple-500/20 text-purple-500' :
                                                'bg-orange-500/20 text-orange-500'
                                        }`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                </div>
                                <div className="ml-5 w-0 flex-1">
                                    <dl>
                                        <dt className="text-sm font-medium text-muted-foreground truncate">
                                            {stat.title}
                                        </dt>
                                        <dd className="flex items-baseline">
                                            <div className="text-2xl font-semibold text-foreground">
                                                {stat.value}
                                            </div>
                                            <div className={`ml-2 flex items-baseline text-sm font-semibold ${stat.changeType === 'positive' ? 'text-green-600' :
                                                stat.changeType === 'negative' ? 'text-red-600' :
                                                    'text-muted-foreground'
                                                }`}>
                                                {stat.change}
                                            </div>
                                        </dd>
                                        <dd className="text-xs text-muted-foreground mt-1">
                                            {stat.description}
                                        </dd>
                                    </dl>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
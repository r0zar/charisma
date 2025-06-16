'use client';

import React from 'react';
import { TrendingUp, Clock, DollarSign, Activity, CheckCircle, XCircle, Timer, Target } from 'lucide-react';

interface OrdersStat {
    title: string;
    value: string;
    change: string;
    changeType: 'positive' | 'negative' | 'neutral';
    icon: React.ComponentType<{ className?: string }>;
    description: string;
}

const stats: OrdersStat[] = [
    {
        title: 'Total Orders',
        value: '2,847',
        change: '+12.3%',
        changeType: 'positive',
        icon: Activity,
        description: 'All-time order count'
    },
    {
        title: 'Active Orders',
        value: '1,234',
        change: '+5.2%',
        changeType: 'positive',
        icon: Clock,
        description: 'Currently open orders'
    },
    {
        title: 'Executed (24h)',
        value: '89',
        change: '+18.7%',
        changeType: 'positive',
        icon: CheckCircle,
        description: 'Orders filled today'
    },
    {
        title: 'Total Volume',
        value: '$2.4M',
        change: '+24.1%',
        changeType: 'positive',
        icon: DollarSign,
        description: 'Total trading volume'
    },
    {
        title: 'Success Rate',
        value: '98.7%',
        change: '+0.3%',
        changeType: 'positive',
        icon: Target,
        description: 'Order execution success rate'
    },
    {
        title: 'Avg Fill Time',
        value: '2.3s',
        change: '-15.2%',
        changeType: 'positive',
        icon: Timer,
        description: 'Average execution time'
    },
    {
        title: 'Failed Orders',
        value: '23',
        change: '-8.1%',
        changeType: 'positive',
        icon: XCircle,
        description: 'Orders failed in 24h'
    },
    {
        title: 'Price Triggers',
        value: '456',
        change: '+7.4%',
        changeType: 'positive',
        icon: TrendingUp,
        description: 'Orders awaiting price triggers'
    }
];

export function OrdersStats() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat, index) => {
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
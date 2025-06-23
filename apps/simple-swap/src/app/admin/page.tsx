import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { TrendingUp, Settings, Database, Activity, BarChart3, Twitter } from 'lucide-react';
import { ADMIN_CONFIG } from '@/lib/admin-config';

export const metadata: Metadata = {
    title: 'Admin Dashboard | Simple Swap',
    description: 'Administrative interface for Simple Swap management',
};

function StatsSkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-card overflow-hidden shadow rounded-lg border border-border">
                    <div className="p-5">
                        <div className="animate-pulse">
                            <div className="flex items-center">
                                <div className="w-8 h-8 bg-muted rounded-md"></div>
                                <div className="ml-5 flex-1">
                                    <div className="h-4 bg-muted rounded w-24 mb-2"></div>
                                    <div className="h-6 bg-muted rounded w-16"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

const adminActions = [
    {
        title: 'Price Dashboard',
        description: 'Monitor and manage historic price data for tokens',
        href: '/admin/prices',
        icon: <TrendingUp className="w-6 h-6" />,
        color: 'orange',
    },
    {
        title: 'Order Management',
        description: 'View and manage limit orders and perpetual positions',
        href: '/admin/orders',
        icon: <Database className="w-6 h-6" />,
        color: 'blue',
    },
    {
        title: 'Twitter Triggers',
        description: 'Manage Twitter-triggered orders and BNS social trading',
        href: '/admin/twitter-triggers',
        icon: <Twitter className="w-6 h-6" />,
        color: 'blue',
    },
    {
        title: 'Chart Diagnostics',
        description: 'Diagnose and test conditional token chart data loading issues',
        href: '/admin/chart-diagnostics',
        icon: <BarChart3 className="w-6 h-6" />,
        color: 'teal',
    },
    {
        title: 'System Monitoring',
        description: 'Monitor system performance and health metrics',
        href: '/admin/monitoring',
        icon: <Activity className="w-6 h-6" />,
        color: 'green',
    },
    {
        title: 'Configuration',
        description: 'Manage system settings and configurations',
        href: '/admin/config',
        icon: <Settings className="w-6 h-6" />,
        color: 'purple',
    },
];

export default function AdminDashboard() {
    return (
        <div className={`mx-auto px-4 py-8 ${ADMIN_CONFIG.MAX_WIDTH.ADMIN_MAIN} w-full`}>
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground mb-2">
                    Simple Swap Admin Dashboard
                </h1>
                <p className="text-muted-foreground">
                    Manage and monitor the Simple Swap system
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {adminActions.map((action) => (
                    <Link
                        key={action.href}
                        href={action.href}
                        className="block bg-card rounded-lg border border-border p-6 hover:border-primary/50 hover:shadow-md transition-all duration-200"
                    >
                        <div className="flex items-center mb-4">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${action.color === 'red' ? 'bg-red-500/20 text-red-400' :
                                action.color === 'blue' ? 'bg-primary/20 text-primary' :
                                    action.color === 'green' ? 'bg-green-500/20 text-green-400' :
                                        action.color === 'orange' ? 'bg-orange-500/20 text-orange-400' :
                                            action.color === 'teal' ? 'bg-teal-500/20 text-teal-400' :
                                                'bg-secondary/20 text-secondary'
                                }`}>
                                {action.icon}
                            </div>
                            <h3 className="ml-3 text-lg font-medium text-foreground">
                                {action.title}
                            </h3>
                        </div>
                        <p className="text-muted-foreground">
                            {action.description}
                        </p>
                    </Link>
                ))}
            </div>

            <div className="mt-8 bg-secondary/10 border border-secondary/20 rounded-lg p-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-secondary" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h3 className="text-sm font-medium text-secondary">
                            Important Notes
                        </h3>
                        <div className="mt-2 text-sm text-muted-foreground">
                            <ul className="list-disc list-inside space-y-1">
                                <li>Administrative changes may take a few minutes to propagate across the system</li>
                                <li>Price data is automatically updated every {ADMIN_CONFIG.CRON_FREQUENCY_MINUTES} minute via cron jobs</li>
                                <li>Always monitor system performance after making configuration changes</li>
                                <li>Order execution and position monitoring run continuously</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 
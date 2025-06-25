import { Suspense } from 'react';
import Link from 'next/link';
import { getAllVaultData, getBlacklistedVaultIds, getManagedVaultIds } from '@/lib/pool-service';

export const metadata = {
    title: 'Admin Dashboard | DEX Cache',
    description: 'Administrative interface for vault cache management',
};

async function AdminStats() {
    try {
        const [allVaults, blacklistedIds, managedIds] = await Promise.all([
            getAllVaultData(),
            getBlacklistedVaultIds(),
            getManagedVaultIds()
        ]);

        const totalManaged = managedIds.length;
        const blacklistedCount = blacklistedIds.length;
        const activeVaults = totalManaged - blacklistedCount;
        const poolCount = allVaults.filter(vault => vault.type === 'POOL').length;
        const sublinkCount = allVaults.filter(vault => vault.type === 'SUBLINK').length;
        const vaultCount = allVaults.filter(vault => vault.type === 'VAULT').length;

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-card overflow-hidden shadow rounded-lg border border-border">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-primary/20 rounded-md flex items-center justify-center">
                                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14-7l2 2m0 0l2 2m-2-2l-2 2m2-2V9M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                                    </svg>
                                </div>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-muted-foreground truncate">Total Managed</dt>
                                    <dd className="text-lg font-medium text-foreground">{totalManaged}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-card overflow-hidden shadow rounded-lg border border-border">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-green-500/20 rounded-md flex items-center justify-center">
                                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-muted-foreground truncate">Active Vaults</dt>
                                    <dd className="text-lg font-medium text-foreground">{activeVaults}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-card overflow-hidden shadow rounded-lg border border-border">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-red-500/20 rounded-md flex items-center justify-center">
                                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                                    </svg>
                                </div>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-muted-foreground truncate">Blacklisted</dt>
                                    <dd className="text-lg font-medium text-foreground">{blacklistedCount}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-card overflow-hidden shadow rounded-lg border border-border">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-secondary/20 rounded-md flex items-center justify-center">
                                    <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-muted-foreground truncate">Pools</dt>
                                    <dd className="text-lg font-medium text-foreground">{poolCount}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    } catch (error) {
        return (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-8">
                <p className="text-red-400">Error loading stats: {error instanceof Error ? error.message : 'Unknown error'}</p>
            </div>
        );
    }
}

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
        title: 'Vault Blacklist Management',
        description: 'Manage vaults that should be excluded from indexing',
        href: '/admin/blacklist',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
            </svg>
        ),
        color: 'red',
    },
    {
        title: 'KV Management',
        description: 'Manage key-value store data',
        href: '/admin/kv',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
        ),
        color: 'blue',
    },
    {
        title: 'Listing Management',
        description: 'Manage vault listings and metadata',
        href: '/admin/listing',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
        ),
        color: 'green',
    },
    {
        title: 'Pool Analytics',
        description: 'View detailed pool performance metrics',
        href: '/pools',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
        ),
        color: 'purple',
    },
    {
        title: 'Energy Analytics',
        description: 'Monitor hold-to-earn energy system and user analytics',
        href: '/admin/energy',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
        ),
        color: 'yellow',
    },
];

export default function AdminDashboard() {
    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground mb-2">
                    DEX Cache Admin Dashboard
                </h1>
                <p className="text-muted-foreground">
                    Manage and monitor the vault cache system
                </p>
            </div>

            <Suspense fallback={<StatsSkeleton />}>
                <AdminStats />
            </Suspense>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                                        action.color === 'yellow' ? 'bg-yellow-500/20 text-yellow-400' :
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
                                <li>Blacklisted vaults are permanently excluded and cannot be accessed through normal endpoints</li>
                                <li>Always test vault changes in a development environment first</li>
                                <li>Monitor API performance after making bulk changes</li>
                                <li>Vault blacklist functionality is only available in development mode</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 
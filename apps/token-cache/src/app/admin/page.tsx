import { Suspense } from 'react';
import Link from 'next/link';
import { getCacheStats } from '@/lib/tokenService';

export const metadata = {
    title: 'Admin | Charisma Tokens',
    description: 'Administrative interface for token cache management',
};

async function AdminStats() {
    try {
        const stats = await getCacheStats();

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-surface overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-accent-soft rounded-md flex items-center justify-center">
                                    <svg className="w-5 h-5 text-accent-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14-7l2 2m0 0l2 2m-2-2l-2 2m2-2V9M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                                    </svg>
                                </div>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-ink-muted truncate">Total Managed</dt>
                                    <dd className="text-lg font-medium text-ink">{stats.totalManaged}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-surface overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-success-soft rounded-md flex items-center justify-center">
                                    <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-ink-muted truncate">Active Tokens</dt>
                                    <dd className="text-lg font-medium text-ink">{stats.activeTokens}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-surface overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-danger-soft rounded-md flex items-center justify-center">
                                    <svg className="w-5 h-5 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                                    </svg>
                                </div>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-ink-muted truncate">Blacklisted</dt>
                                    <dd className="text-lg font-medium text-ink">{stats.blacklistedCount}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-surface overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-blaze-soft rounded-md flex items-center justify-center">
                                    <svg className="w-5 h-5 text-blaze" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                                    </svg>
                                </div>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-ink-muted truncate">Cached</dt>
                                    <dd className="text-lg font-medium text-ink">{stats.cachedCount}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    } catch (error) {
        return (
            <div className="bg-danger-soft border border-danger/30 rounded-lg p-4 mb-8">
                <p className="text-danger">Error loading stats: {error instanceof Error ? error.message : 'Unknown error'}</p>
            </div>
        );
    }
}

function StatsSkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-surface overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="animate-pulse">
                            <div className="flex items-center">
                                <div className="w-8 h-8 bg-surface-hover rounded-md"></div>
                                <div className="ml-5 flex-1">
                                    <div className="h-4 bg-surface-hover rounded w-24 mb-2"></div>
                                    <div className="h-6 bg-surface-hover rounded w-16"></div>
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
        title: 'Blacklist Management',
        description: 'Manage tokens that should be excluded from indexing (Dev Only)',
        href: '/admin/blacklist',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
            </svg>
        ),
        color: 'red',
        devOnly: true,
    },
    {
        title: 'Bulk Import',
        description: 'Import multiple tokens at once',
        href: '/admin/bulk-import',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
        ),
        color: 'blue',
    },
    {
        title: 'Token Inspection',
        description: 'Inspect and debug individual tokens',
        href: '/inspect',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
        ),
        color: 'green',
    },
    {
        title: 'Cache Statistics',
        description: 'View detailed cache performance metrics',
        href: '/stats',
        icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
        ),
        color: 'purple',
    },
];

export default function AdminDashboard() {
    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-ink mb-2">
                    Admin Dashboard
                </h1>
                <p className="text-ink-body">
                    Manage and monitor the token cache system
                </p>
            </div>

            <Suspense fallback={<StatsSkeleton />}>
                <AdminStats />
            </Suspense>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {adminActions.map((action) => (
                    <Link
                        key={action.href}
                        href={action.href}
                        className="block bg-surface rounded-lg border border-line p-6 hover:border-line hover:shadow-md transition-all duration-200"
                    >
                        <div className="flex items-center mb-4">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${action.color === 'red' ? 'bg-danger-soft text-danger' :
                                action.color === 'blue' ? 'bg-accent-soft text-accent-text' :
                                    action.color === 'green' ? 'bg-success-soft text-success' :
                                        'bg-blaze-soft text-blaze'
                                }`}>
                                {action.icon}
                            </div>
                            <h3 className="ml-3 text-lg font-medium text-ink">
                                {action.title}
                            </h3>
                        </div>
                        <p className="text-ink-body">
                            {action.description}
                        </p>
                    </Link>
                ))}
            </div>

            <div className="mt-8 bg-warning-soft border border-warning/30 rounded-lg p-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-warning" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h3 className="text-sm font-medium text-warning">
                            Important Notes
                        </h3>
                        <div className="mt-2 text-sm text-warning">
                            <ul className="list-disc list-inside space-y-1">
                                <li>Administrative changes may take a few minutes to propagate across the system</li>
                                <li>Blacklisted tokens are permanently excluded and cannot be re-indexed automatically</li>
                                <li>Always test token changes in a development environment first</li>
                                <li>Monitor API performance after making bulk changes</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 
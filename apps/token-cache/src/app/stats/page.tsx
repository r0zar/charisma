'use server';

import { getCacheStats } from "@/lib/tokenService"; // Assuming this function will be created
import Link from "next/link";

// Helper function to format milliseconds into a readable string
function formatDuration(ms: number | null): string {
    if (ms === null) return "N/A";
    if (ms < 1000) return `${ms.toFixed(0)} ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)} s`;
    const minutes = seconds / 60;
    if (minutes < 60) return `${minutes.toFixed(1)} min`;
    const hours = minutes / 60;
    if (hours < 24) return `${hours.toFixed(1)} h`;
    const days = hours / 24;
    return `${days.toFixed(1)} days`;
}

export default async function StatsPage() {
    const stats = await getCacheStats();

    const cachedPercentage = stats.totalManaged > 0
        ? ((stats.cachedCount / stats.totalManaged) * 100).toFixed(1)
        : '0.0';

    const totalApiRequests = stats.apiHits + stats.apiMisses;
    const apiHitRate = totalApiRequests > 0
        ? ((stats.apiHits / totalApiRequests) * 100).toFixed(1)
        : '0.0';

    return (
        <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 md:p-16">
            <div className="w-full max-w-4xl mx-auto"> {/* Increased max-width slightly */}
                <header className="mb-8 flex justify-between items-center">
                    <h1 className="text-2xl sm:text-3xl font-bold">Cache Statistics</h1>
                    <Link href="/" className="text-sm text-accent-text hover:underline">
                        &larr; Back to Token List
                    </Link>
                </header>

                {/* Row 1: Basic Counts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-center">
                    <div className="p-6 bg-surface rounded-lg shadow border border-line ">
                        <dt className="text-sm font-medium text-ink-muted truncate">
                            Total Managed Tokens
                        </dt>
                        <dd className="mt-1 text-3xl font-semibold tracking-tight text-ink ">
                            {stats.totalManaged.toLocaleString()}
                        </dd>
                    </div>

                    <div className="p-6 bg-surface rounded-lg shadow border border-line ">
                        <dt className="text-sm font-medium text-ink-muted truncate">
                            Currently Cached Tokens
                        </dt>
                        <dd className="mt-1 text-3xl font-semibold tracking-tight text-ink ">
                            {stats.cachedCount.toLocaleString()} ({cachedPercentage}%)
                        </dd>
                    </div>
                </div>

                {/* Row 2: API Hit Rate */}
                <h2 className="text-lg font-semibold mb-3 text-ink-body ">API Performance</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-center">
                    <div className="p-6 bg-surface rounded-lg shadow border border-line ">
                        <dt className="text-sm font-medium text-ink-muted truncate">
                            API Cache Hit Rate
                        </dt>
                        <dd className="mt-1 text-3xl font-semibold tracking-tight text-ink ">
                            {apiHitRate}%
                        </dd>
                    </div>
                    <div className="p-6 bg-surface rounded-lg shadow border border-line ">
                        <dt className="text-sm font-medium text-ink-muted truncate">
                            API Hits
                        </dt>
                        <dd className="mt-1 text-3xl font-semibold tracking-tight text-ink ">
                            {stats.apiHits.toLocaleString()}
                        </dd>
                    </div>
                    <div className="p-6 bg-surface rounded-lg shadow border border-line ">
                        <dt className="text-sm font-medium text-ink-muted truncate">
                            API Misses
                        </dt>
                        <dd className="mt-1 text-3xl font-semibold tracking-tight text-ink ">
                            {stats.apiMisses.toLocaleString()}
                        </dd>
                    </div>
                </div>

                {/* Row 3: Cache Freshness */}
                <h2 className="text-lg font-semibold mb-3 text-ink-body ">Cache Freshness</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div className="p-6 bg-surface rounded-lg shadow border border-line ">
                        <dt className="text-sm font-medium text-ink-muted truncate">
                            Average Age
                        </dt>
                        <dd className="mt-1 text-3xl font-semibold tracking-tight text-ink ">
                            {formatDuration(stats.averageCacheAgeMs)}
                        </dd>
                    </div>
                    <div className="p-6 bg-surface rounded-lg shadow border border-line ">
                        <dt className="text-sm font-medium text-ink-muted truncate">
                            Min Age (Newest)
                        </dt>
                        <dd className="mt-1 text-3xl font-semibold tracking-tight text-ink ">
                            {formatDuration(stats.minCacheAgeMs)}
                        </dd>
                    </div>
                    <div className="p-6 bg-surface rounded-lg shadow border border-line ">
                        <dt className="text-sm font-medium text-ink-muted truncate">
                            Max Age (Oldest)
                        </dt>
                        <dd className="mt-1 text-3xl font-semibold tracking-tight text-ink ">
                            {formatDuration(stats.maxCacheAgeMs)}
                        </dd>
                    </div>
                </div>

                <div className="mt-6 text-xs text-center text-ink-muted ">
                    Note: Stats reflect the current state of the managed token list and individual token cache entries in Vercel KV.
                </div>

            </div>
        </main>
    );
} 
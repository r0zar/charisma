'use server';

import { getCacheStats } from "@/lib/tokenService"; // Assuming this function will be created
import Link from "next/link";

export default async function StatsPage() {
    const stats = await getCacheStats();

    const cachedPercentage = stats.totalManaged > 0
        ? ((stats.cachedCount / stats.totalManaged) * 100).toFixed(1)
        : '0.0';

    return (
        <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 md:p-16 bg-gray-50 dark:bg-gray-900">
            <div className="w-full max-w-2xl mx-auto">
                <header className="mb-8 flex justify-between items-center">
                    <h1 className="text-2xl sm:text-3xl font-bold">Cache Statistics</h1>
                    <Link href="/" className="text-sm text-blue-500 hover:underline">
                        &larr; Back to Token List
                    </Link>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                            Total Managed Tokens
                        </dt>
                        <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
                            {stats.totalManaged.toLocaleString()}
                        </dd>
                    </div>

                    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                            Currently Cached Tokens
                        </dt>
                        <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
                            {stats.cachedCount.toLocaleString()} ({cachedPercentage}%)
                        </dd>
                    </div>
                </div>

                <div className="mt-6 text-xs text-center text-gray-500 dark:text-gray-400">
                    Note: Stats reflect the current state of the managed token list and individual token cache entries in Vercel KV.
                </div>

            </div>
        </main>
    );
} 
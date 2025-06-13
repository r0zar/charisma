import { DollarSign, CheckCircle, AlertCircle } from 'lucide-react';
import { kv } from '@vercel/kv';
import {
    getRetentionDays,
    getPriceEpsilonPercent,
    getCronFrequencyMinutes,
    getPageSize,
    isDevelopment,
    formatLocalDateTime,
    formatRelativeTime
} from '@/lib/admin-config';
import { InfoTooltip } from '@/components/ui/tooltip';

async function getCronStatus() {
    try {
        console.log('🔍 Checking cron job health status...');

        // Check 1: Can we access the KV store?
        let kvHealthy = false;
        try {
            await kv.ping();
            kvHealthy = true;
        } catch (error) {
            console.error('❌ KV store is not accessible:', error);
        }

        // Check 2: Do we have recent price data?
        let hasRecentData = false;
        let lastDataTimestamp = null;
        let trackedTokensCount = 0;

        if (kvHealthy) {
            try {
                // Get a sample of tokens to check for recent updates
                const result = await kv.scan('0', {
                    match: 'price:token:*',
                    count: 5 // Just check a few tokens
                });

                const sampleKeys = result[1] as string[];
                trackedTokensCount = sampleKeys.length;

                if (sampleKeys.length > 0) {
                    // Check the most recent update across sample tokens
                    const recentUpdates = await Promise.all(
                        sampleKeys.map(async (key) => {
                            try {
                                const lastEntry = await kv.zrange(key, -1, -1, { withScores: true });
                                return lastEntry.length > 1 ? Number(lastEntry[1]) : 0;
                            } catch {
                                return 0;
                            }
                        })
                    );

                    const mostRecentTimestamp = Math.max(...recentUpdates);
                    if (mostRecentTimestamp > 0) {
                        lastDataTimestamp = new Date(mostRecentTimestamp).toISOString();
                        const timeSinceLastUpdate = Date.now() - mostRecentTimestamp;

                        // Consider data recent if it's less than 3x the cron frequency
                        const maxAcceptableAge = getCronFrequencyMinutes() * 3 * 60 * 1000;
                        hasRecentData = timeSinceLastUpdate < maxAcceptableAge;
                    }
                }
            } catch (error) {
                console.error('❌ Error checking recent data:', error);
            }
        }

        // Determine overall status
        let status = 'unknown';
        let details = '';

        if (!kvHealthy) {
            status = 'error';
            details = 'KV store is not accessible';
        } else if (trackedTokensCount === 0) {
            status = 'inactive';
            details = 'No price data found - cron may not have run yet';
        } else if (!hasRecentData) {
            status = 'stale';
            details = `Last update: ${lastDataTimestamp ? formatLocalDateTime(lastDataTimestamp, 'compact') : 'unknown'}`;
        } else {
            status = 'active';
            details = `${trackedTokensCount} tokens tracked, last update: ${lastDataTimestamp ? formatLocalDateTime(lastDataTimestamp, 'compact') : 'unknown'}`;
        }

        console.log(`✅ Cron status check completed: ${status}`);

        return {
            status,
            details,
            checks: {
                kvHealthy,
                hasRecentData,
                trackedTokensCount,
                lastDataTimestamp
            }
        };

    } catch (error) {
        console.error('💥 Error during cron status check:', error);
        return {
            status: 'error',
            details: 'Failed to check cron status: ' + (error instanceof Error ? error.message : 'Unknown error')
        };
    }
}

export async function SystemStatus() {
    const cronStatusResult = await getCronStatus();

    return (
        <div className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
                <DollarSign className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">System Configuration</h3>
            </div>
            <div className="space-y-4 text-sm">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Retention Period:</span>
                        <InfoTooltip content="How long price data is stored in the system before being automatically cleaned up. Older data beyond this period is removed to manage storage costs and performance." />
                    </div>
                    <span className="font-mono">{getRetentionDays()} days</span>
                </div>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Price Epsilon:</span>
                        <InfoTooltip content="Minimum percentage change required before a new price point is stored. This prevents excessive storage of tiny price fluctuations and reduces noise in the data." />
                    </div>
                    <span className="font-mono">{getPriceEpsilonPercent()}%</span>
                </div>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Update Frequency:</span>
                        <InfoTooltip content="How often the cron job runs to fetch and update price data from external sources. More frequent updates provide better real-time accuracy but use more resources." />
                    </div>
                    <span className="font-mono">{getCronFrequencyMinutes()} min</span>
                </div>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Cron Status:</span>
                        <InfoTooltip content="Comprehensive health status of the price update system: Running (recent data), Stale (data >3min old), Inactive (no data yet), Error (system issues), Unknown (cannot determine). Includes details about last update time and tracked tokens." />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1">
                            {cronStatusResult.status === 'active' ? (
                                <>
                                    <CheckCircle className="w-3 h-3 text-green-500" />
                                    <span className="font-mono text-green-500">Running</span>
                                </>
                            ) : cronStatusResult.status === 'error' ? (
                                <>
                                    <AlertCircle className="w-3 h-3 text-red-500" />
                                    <span className="font-mono text-red-500">Error</span>
                                </>
                            ) : cronStatusResult.status === 'stale' ? (
                                <>
                                    <AlertCircle className="w-3 h-3 text-yellow-500" />
                                    <span className="font-mono text-yellow-500">Stale</span>
                                </>
                            ) : cronStatusResult.status === 'inactive' ? (
                                <>
                                    <AlertCircle className="w-3 h-3 text-orange-500" />
                                    <span className="font-mono text-orange-500">Inactive</span>
                                </>
                            ) : (
                                <>
                                    <AlertCircle className="w-3 h-3 text-gray-500" />
                                    <span className="font-mono text-gray-500">Unknown</span>
                                </>
                            )}
                        </div>
                        {cronStatusResult.details && (
                            <div className="text-xs text-muted-foreground text-right max-w-xs truncate">
                                {cronStatusResult.details}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Load Strategy:</span>
                        <InfoTooltip content="Data loading approach used to handle large datasets efficiently. Pagination loads data in chunks to prevent memory issues and improve page load times. KV Scan uses Vercel's optimized scanning method." />
                    </div>
                    <span className="font-mono text-blue-500">Paginated ({getPageSize()}/page)</span>
                </div>
            </div>

            {/* Environment indicator */}
            <div className="mt-4 pt-4 border-t border-border">
                <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Environment:</span>
                    <span className="font-mono bg-muted px-2 py-1 rounded">
                        {isDevelopment() ? 'development' : 'production'}
                    </span>
                </div>
            </div>
        </div>
    );
} 
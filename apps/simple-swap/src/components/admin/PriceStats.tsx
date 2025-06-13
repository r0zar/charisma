import { TrendingUp, TrendingDown, Activity, Database } from 'lucide-react';
import { getTrackedTokenCount, getTrackedTokensPaginated } from '@/lib/price/store';
import { getPriceStats } from '@/lib/price/metrics';
import { InfoTooltip } from '@/components/ui/tooltip';

async function getOverallPriceStats() {
    try {
        // Get a fast count of total tokens
        const totalTokens = await getTrackedTokenCount();

        // Get a small sample of tokens for calculating averages (just first 20 for speed)
        const { tokens } = await getTrackedTokensPaginated(20);
        const stats = await Promise.all(tokens.map(token => getPriceStats(token)));

        const validPrices = stats.filter(s => s.price !== null);
        const activeTokens = validPrices.length;
        const avgChange24h = validPrices.length > 0
            ? validPrices.reduce((sum, s) => sum + (s.change24h || 0), 0) / validPrices.length
            : 0;

        return {
            totalTokens,
            activeTokens,
            avgChange24h,
            lastUpdated: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error getting overall price stats:', error);
        return {
            totalTokens: 0,
            activeTokens: 0,
            avgChange24h: 0,
            lastUpdated: new Date().toISOString()
        };
    }
}

export async function PriceStats() {
    try {
        const stats = await getOverallPriceStats();

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-card overflow-hidden shadow rounded-lg border border-border">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-primary/20 rounded-md flex items-center justify-center">
                                    <Database className="w-5 h-5 text-primary" />
                                </div>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-muted-foreground truncate flex items-center gap-2">
                                        Total Tokens
                                        <InfoTooltip content="Total number of tokens being tracked in the price monitoring system. This includes both active and inactive tokens." />
                                    </dt>
                                    <dd className="text-lg font-medium text-foreground">
                                        {stats.totalTokens}
                                    </dd>
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
                                    <Activity className="w-5 h-5 text-green-400" />
                                </div>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-muted-foreground truncate flex items-center gap-2">
                                        Active Prices (Sample)
                                        <InfoTooltip content="Number of tokens with current price data from a sample of 20 tokens. This gives a quick health check of the price tracking system." />
                                    </dt>
                                    <dd className="text-lg font-medium text-foreground">
                                        {stats.activeTokens}/20
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-card overflow-hidden shadow rounded-lg border border-border">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className={`w-8 h-8 rounded-md flex items-center justify-center ${stats.avgChange24h >= 0
                                    ? 'bg-green-500/20'
                                    : 'bg-red-500/20'
                                    }`}>
                                    {stats.avgChange24h >= 0 ? (
                                        <TrendingUp className="w-5 h-5 text-green-400" />
                                    ) : (
                                        <TrendingDown className="w-5 h-5 text-red-400" />
                                    )}
                                </div>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-muted-foreground truncate flex items-center gap-2">
                                        Avg 24h Change
                                        <InfoTooltip content="Average 24-hour price change across the sample of active tokens. Provides a market sentiment indicator for tracked assets." />
                                    </dt>
                                    <dd className={`text-lg font-medium ${stats.avgChange24h >= 0
                                        ? 'text-green-400'
                                        : 'text-red-400'
                                        }`}>
                                        {stats.avgChange24h >= 0 ? '+' : ''}{stats.avgChange24h.toFixed(2)}%
                                    </dd>
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
                                    <Activity className="w-5 h-5 text-secondary" />
                                </div>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-muted-foreground truncate flex items-center gap-2">
                                        Last Updated
                                        <InfoTooltip content="Timestamp when these statistics were last calculated. Stats are refreshed each time the admin page loads." />
                                    </dt>
                                    <dd className="text-lg font-medium text-foreground">
                                        {new Date(stats.lastUpdated).toLocaleTimeString()}
                                    </dd>
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
                <p className="text-red-400">
                    Error loading price stats: {error instanceof Error ? error.message : 'Unknown error'}
                </p>
            </div>
        );
    }
} 
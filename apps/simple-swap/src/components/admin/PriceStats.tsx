import { TrendingUp, TrendingDown, Activity, Database } from 'lucide-react';
import { InfoTooltip } from '@/components/ui/tooltip';
import { priceSeriesService } from '@/lib/charts/price-series-service';

async function getOverallPriceStats() {
    try {
        // Get a fast count of total tokens
        const tokens = await priceSeriesService.getAllTokens();

        return {
            totalTokens: tokens.length,
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
                                        {stats.totalTokens}/20
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
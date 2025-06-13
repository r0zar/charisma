"use client";

import { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, Activity, AlertCircle, Eye, EyeOff, ChevronLeft, ChevronRight, Copy, ExternalLink, RefreshCw, Flame } from 'lucide-react';
import type { PriceStats } from '@/lib/price/metrics';
import { getPageSize, getAutoRefreshSeconds, formatLocalDateTime } from '@/lib/admin-config';
import { Button } from '@/components/ui/button';
import { InfoTooltip } from '@/components/ui/tooltip';

interface TokenMetadata {
    contractId: string;
    name: string;
    symbol: string;
    image?: string | null;
    type?: string;
}

interface DataInsights {
    totalDataPoints: number;
    firstSeen: string | null;
    lastSeen: string | null;
    dataQuality: 'good' | 'stale' | 'sparse' | 'no-data' | 'error' | 'unknown';
}

interface EnrichedPriceStats extends PriceStats {
    metadata?: TokenMetadata;
    dataInsights?: DataInsights;
    marketcap?: number | null;
}

interface PriceMatrixData {
    tokens: EnrichedPriceStats[];
    loading: boolean;
    error: string | null;
    hasMore: boolean;
    nextCursor: string;
    total: number;
}

// Helper component for token actions
function TokenActions({ contractId }: { contractId: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(contractId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleExternalLink = () => {
        const url = `https://explorer.hiro.so/address/${contractId}?chain=mainnet`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="flex items-center gap-1">
            <InfoTooltip content={copied ? "Copied to clipboard!" : "Copy contract address to clipboard"} side="top">
                <button
                    onClick={handleCopy}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-muted/50"
                >
                    <Copy className={`w-3 h-3 ${copied ? 'text-green-500' : ''}`} />
                </button>
            </InfoTooltip>
            <InfoTooltip content="View contract on Hiro Explorer" side="top">
                <button
                    onClick={handleExternalLink}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-muted/50"
                >
                    <ExternalLink className="w-3 h-3" />
                </button>
            </InfoTooltip>
        </div>
    );
}

export function PriceMatrix() {
    const [data, setData] = useState<PriceMatrixData>({
        tokens: [],
        loading: true,
        error: null,
        hasMore: false,
        nextCursor: '0',
        total: 0
    });

    const [sortField, setSortField] = useState<keyof PriceStats | 'marketcap'>('marketcap');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [filter, setFilter] = useState('');
    const [showInactive, setShowInactive] = useState(false);
    const [showWithoutMarketCap, setShowWithoutMarketCap] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(getPageSize());
    const [isManualRefreshing, setIsManualRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Track current loaded count for refresh
    const loadedCountRef = useRef(0);

    const fetchPriceData = async (cursor: string = '0', append: boolean = false, limit?: number) => {
        try {
            if (!append) {
                setData(prev => ({ ...prev, loading: true }));
            } else {
                setIsLoadingMore(true);
            }

            const fetchLimit = limit || pageSize;
            const response = await fetch(`/api/admin/prices?limit=${fetchLimit}&cursor=${cursor}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(
                    errorData?.details
                        ? `${errorData.error}: ${errorData.details}`
                        : `HTTP ${response.status}: ${response.statusText}`
                );
            }

            const result = await response.json();

            // Tokens are already enriched with metadata from the API
            const enrichedTokens: EnrichedPriceStats[] = result.tokens;

            setData(prev => {
                let newTokens: EnrichedPriceStats[];

                if (append) {
                    // When appending, deduplicate to prevent duplicates
                    const existingIds = new Set(prev.tokens.map(t => t.contractId));
                    const uniqueNewTokens = enrichedTokens.filter(t => !existingIds.has(t.contractId));
                    newTokens = [...prev.tokens, ...uniqueNewTokens];
                } else {
                    // When replacing, use new tokens directly
                    newTokens = enrichedTokens;
                }

                // Always deduplicate the final list to be safe
                const tokenMap = new Map();
                newTokens.forEach(token => {
                    tokenMap.set(token.contractId, token);
                });
                const deduplicatedTokens = Array.from(tokenMap.values());

                loadedCountRef.current = deduplicatedTokens.length; // Update ref with current count
                return {
                    tokens: deduplicatedTokens,
                    loading: false,
                    error: null,
                    hasMore: result.hasMore,
                    nextCursor: result.nextCursor,
                    total: result.total
                };
            });
        } catch (error) {
            console.error('Error fetching price data:', error);
            setData(prev => ({
                ...prev,
                loading: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            }));
        } finally {
            // Always reset loading states
            if (append) {
                setIsLoadingMore(false);
            }
        }
    };

    const refreshAllCurrentTokens = async (isManual = false) => {
        if (isManual) {
            setIsManualRefreshing(true);
        }

        try {
            // For refresh, maintain the exact number of tokens currently loaded
            const currentCount = loadedCountRef.current;
            await fetchPriceData('0', false, currentCount);
        } finally {
            if (isManual) {
                setIsManualRefreshing(false);
            }
        }
    };

    const handleManualRefresh = () => {
        refreshAllCurrentTokens(true);
    };

    useEffect(() => {
        fetchPriceData();
        const interval = setInterval(() => {
            // Refresh all currently loaded tokens intelligently
            refreshAllCurrentTokens();
        }, getAutoRefreshSeconds() * 1000); // Use centralized config
        return () => clearInterval(interval);
    }, []); // Token metadata is now fetched server-side

    const handleSort = (field: keyof PriceStats | 'marketcap') => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const handleLoadMore = () => {
        if (data.hasMore && !data.loading && !isLoadingMore && !isManualRefreshing) {
            fetchPriceData(data.nextCursor, true);
        }
    };

    const filteredAndSortedTokens = data.tokens
        .filter(token => {
            if (!showInactive && token.price === null) return false;
            if (!showWithoutMarketCap && (token.marketcap === null || token.marketcap === undefined)) return false;
            if (filter && !token.contractId.toLowerCase().includes(filter.toLowerCase())) return false;
            return true;
        })
        .sort((a, b) => {
            let aVal: number;
            let bVal: number;

            if (sortField === 'marketcap') {
                // For marketcap sorting, null/undefined values should go to the end (lowest priority)
                if ((a.marketcap === null || a.marketcap === undefined) && (b.marketcap === null || b.marketcap === undefined)) return 0;
                if (a.marketcap === null || a.marketcap === undefined) return 1; // a goes to end
                if (b.marketcap === null || b.marketcap === undefined) return -1; // b goes to end

                aVal = a.marketcap as number; // Safe since we've checked for null above
                bVal = b.marketcap as number;
            } else {
                // For other fields, handle null values appropriately
                const aFieldVal = a[sortField];
                const bFieldVal = b[sortField];

                if ((aFieldVal === null || aFieldVal === undefined) && (bFieldVal === null || bFieldVal === undefined)) return 0;
                if (aFieldVal === null || aFieldVal === undefined) return sortDirection === 'asc' ? 1 : 1;
                if (bFieldVal === null || bFieldVal === undefined) return sortDirection === 'asc' ? -1 : -1;

                aVal = aFieldVal as number;
                bVal = bFieldVal as number;
            }

            if (sortDirection === 'asc') {
                return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            } else {
                return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
            }
        });

    if (data.loading && data.tokens.length === 0) {
        return (
            <div className="space-y-3">
                {[...Array(15)].map((_, i) => (
                    <div key={i} className="h-16 bg-muted/20 rounded animate-pulse" />
                ))}
            </div>
        );
    }

    if (data.error) {
        return (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-2">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <h3 className="text-red-400 font-medium">Error Loading Price Data</h3>
                </div>
                <p className="text-red-300 text-sm mb-4">{data.error}</p>
                <div className="bg-red-900/30 rounded-lg p-4 text-xs text-red-300/80">
                    <p className="font-medium mb-2">🔧 Troubleshooting Guide:</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li><strong>No data collected:</strong> Run the price cron job at <code className="bg-red-900/50 px-1 rounded">/api/cron/price</code></li>
                        <li><strong>Vercel KV issues:</strong> Check your <code className="bg-red-900/50 px-1 rounded">KV_*</code> environment variables</li>
                        <li><strong>API errors:</strong> Check the server console for detailed logs</li>
                        <li><strong>Empty tokens list:</strong> Price tracking starts after the first cron run</li>
                    </ul>
                    <div className="mt-3 p-2 bg-red-900/40 rounded border border-red-600/30">
                        <p className="font-medium">🚀 Quick Start:</p>
                        <p>Make a GET request to <code className="bg-red-900/50 px-1 rounded">/api/cron/price</code> with your CRON_SECRET to populate initial data.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            placeholder="Filter tokens..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="px-3 py-2 bg-background border border-border rounded-md text-sm"
                        />
                        <InfoTooltip content="Filter tokens by contract ID or name. Search is case-insensitive and matches partial strings." />
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={() => setShowInactive(!showInactive)}
                            variant={showInactive ? "default" : "outline"}
                            size="sm"
                        >
                            {showInactive ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                            Show Inactive
                        </Button>
                        <InfoTooltip content="Toggle visibility of tokens that don't have current price data. Inactive tokens may be delisted or temporarily unavailable." />
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={() => setShowWithoutMarketCap(!showWithoutMarketCap)}
                            variant={showWithoutMarketCap ? "default" : "outline"}
                            size="sm"
                        >
                            {showWithoutMarketCap ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                            Show No Market Cap
                        </Button>
                        <InfoTooltip content="Toggle visibility of tokens that don't have market cap data. These tokens may lack total supply information needed for market cap calculation." />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                        Showing {filteredAndSortedTokens.length} of {data.tokens.length} loaded tokens
                        {isLoadingMore && " • Loading more..."}
                    </span>
                    <InfoTooltip content="Current view shows filtered results from loaded data. Use 'Load More' to fetch additional tokens from the database." />
                </div>
            </div>

            {/* Matrix Table */}
            <div className="bg-card rounded-lg border border-border p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold">Token Price Matrix</h3>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={handleManualRefresh}
                            disabled={data.loading || isManualRefreshing}
                            variant="outline"
                            size="sm"
                        >
                            {isManualRefreshing ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                                    Refreshing...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Refresh
                                </>
                            )}
                        </Button>
                        <InfoTooltip content="Manually refresh all currently loaded tokens with the latest price data. This updates prices without losing your current view position." />

                        {data.hasMore && (
                            <>
                                <Button
                                    onClick={handleLoadMore}
                                    disabled={data.loading || isManualRefreshing || isLoadingMore}
                                    variant="outline"
                                    size="sm"
                                >
                                    {isLoadingMore ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                                            Loading More...
                                        </>
                                    ) : (
                                        <>
                                            <ChevronRight className="w-4 h-4 mr-2" />
                                            Load More
                                        </>
                                    )}
                                </Button>
                                <InfoTooltip content="Load additional tokens from the database. Data is loaded in batches for optimal performance." />
                            </>
                        )}
                    </div>
                </div>
                <div className="overflow-x-auto overflow-y-visible">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-muted/50">
                            <tr>
                                <th
                                    className="px-4 py-3 text-left text-xs font-medium text-muted-foreground tracking-wider cursor-pointer hover:bg-muted/70"
                                    onClick={() => handleSort('contractId')}
                                >
                                    <div className="flex items-center justify-between">
                                        <span>Token {sortField === 'contractId' && (sortDirection === 'asc' ? '↑' : '↓')}</span>
                                        <InfoTooltip content="Token information with quick actions to copy contract address or view on Hiro Explorer" side="bottom" />
                                    </div>
                                </th>
                                <th
                                    className="px-4 py-3 text-right text-xs font-medium text-muted-foreground tracking-wider cursor-pointer hover:bg-muted/70"
                                    onClick={() => handleSort('price')}
                                >
                                    Current Price {sortField === 'price' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    className="px-4 py-3 text-right text-xs font-medium text-muted-foreground tracking-wider cursor-pointer hover:bg-muted/70"
                                    onClick={() => handleSort('marketcap')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        <span>Market Cap {sortField === 'marketcap' && (sortDirection === 'asc' ? '↑' : '↓')}</span>
                                        <InfoTooltip content="Market capitalization calculated as current price × total supply. Shows the total value of all tokens in circulation." side="bottom" />
                                    </div>
                                </th>
                                <th
                                    className="px-4 py-3 text-right text-xs font-medium text-muted-foreground tracking-wider cursor-pointer hover:bg-muted/70"
                                    onClick={() => handleSort('change1h')}
                                >
                                    1h Change {sortField === 'change1h' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    className="px-4 py-3 text-right text-xs font-medium text-muted-foreground tracking-wider cursor-pointer hover:bg-muted/70"
                                    onClick={() => handleSort('change24h')}
                                >
                                    24h Change {sortField === 'change24h' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th
                                    className="px-4 py-3 text-right text-xs font-medium text-muted-foreground tracking-wider cursor-pointer hover:bg-muted/70"
                                    onClick={() => handleSort('change7d')}
                                >
                                    7d Change {sortField === 'change7d' && (sortDirection === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground tracking-wider">
                                    Status
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground tracking-wider">
                                    <div className="flex items-center justify-center gap-2">
                                        <span>Data Points</span>
                                        <InfoTooltip content="Total number of price data points indexed for this token. Higher numbers indicate more comprehensive price history." side="bottom" />
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground tracking-wider">
                                    <div className="flex items-center justify-center gap-2">
                                        <span>Last Updated</span>
                                        <InfoTooltip content="When the most recent price data was recorded. Shows how current the data is and helps identify stale tokens." side="bottom" />
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground tracking-wider">
                                    <div className="flex items-center justify-center gap-2">
                                        <span>Data Quality</span>
                                        <InfoTooltip content="Quality assessment: Good (recent data), Stale (>2hrs old), Sparse (<10 points), No Data (empty), or Error (issues detected)." side="bottom" />
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-card divide-y divide-border">
                            {filteredAndSortedTokens.map((token) => (
                                <tr key={token.contractId} className="hover:bg-muted/20 transition-colors">
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            {token.metadata?.image && (
                                                <img
                                                    src={token.metadata.image}
                                                    alt={token.metadata.name || 'Token'}
                                                    className="w-8 h-8 rounded-full bg-muted flex-shrink-0"
                                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                />
                                            )}
                                            <div className="flex flex-col min-w-0">
                                                <div className="text-sm font-medium text-foreground truncate flex items-center gap-1">
                                                    <span>{token.metadata?.name || token.contractId.split('.')[1] || token.contractId}</span>
                                                    {token.metadata?.type === 'SUBNET' && (
                                                        <InfoTooltip content="Subnet token" side="top">
                                                            <Flame className="w-3 h-3 text-red-500 flex-shrink-0" />
                                                        </InfoTooltip>
                                                    )}
                                                </div>
                                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                    {token.metadata?.symbol && (
                                                        <span className="font-mono">${token.metadata.symbol}</span>
                                                    )}
                                                    <TokenActions contractId={token.contractId} />
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <div className="text-sm font-medium text-foreground">
                                            {token.price ? `$${token.price.toFixed(8)}` : 'N/A'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <div className="text-sm font-medium text-foreground">
                                            {token.marketcap ? (
                                                token.marketcap >= 1000000 ?
                                                    `$${(token.marketcap / 1000000).toFixed(2)}M` :
                                                    token.marketcap >= 1000 ?
                                                        `$${(token.marketcap / 1000).toFixed(2)}K` :
                                                        `$${token.marketcap.toFixed(2)}`
                                            ) : 'N/A'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        {token.change1h !== null ? (
                                            <div className={`inline-flex items-center text-sm font-medium ${token.change1h >= 0 ? 'text-green-400' : 'text-red-400'
                                                }`}>
                                                {token.change1h >= 0 ? (
                                                    <TrendingUp className="w-3 h-3 mr-1" />
                                                ) : (
                                                    <TrendingDown className="w-3 h-3 mr-1" />
                                                )}
                                                {token.change1h >= 0 ? '+' : ''}{token.change1h.toFixed(2)}%
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">N/A</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        {token.change24h !== null ? (
                                            <div className={`inline-flex items-center text-sm font-medium ${token.change24h >= 0 ? 'text-green-400' : 'text-red-400'
                                                }`}>
                                                {token.change24h >= 0 ? (
                                                    <TrendingUp className="w-3 h-3 mr-1" />
                                                ) : (
                                                    <TrendingDown className="w-3 h-3 mr-1" />
                                                )}
                                                {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">N/A</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        {token.change7d !== null ? (
                                            <div className={`inline-flex items-center text-sm font-medium ${token.change7d >= 0 ? 'text-green-400' : 'text-red-400'
                                                }`}>
                                                {token.change7d >= 0 ? (
                                                    <TrendingUp className="w-3 h-3 mr-1" />
                                                ) : (
                                                    <TrendingDown className="w-3 h-3 mr-1" />
                                                )}
                                                {token.change7d >= 0 ? '+' : ''}{token.change7d.toFixed(2)}%
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">N/A</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        {token.price !== null ? (
                                            <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
                                                <Activity className="w-3 h-3" />
                                                Active
                                            </div>
                                        ) : (
                                            <div className="inline-flex items-center gap-1 px-2 py-1 bg-muted text-muted-foreground rounded-full text-xs">
                                                <AlertCircle className="w-3 h-3" />
                                                Inactive
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <div className="text-sm font-mono">
                                            {token.dataInsights?.totalDataPoints ?? 'N/A'}
                                        </div>
                                        {token.dataInsights?.firstSeen && (
                                            <div className="text-xs text-muted-foreground mt-1">
                                                Since {formatLocalDateTime(token.dataInsights.firstSeen, 'date')}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        {token.dataInsights?.lastSeen ? (
                                            <div className="text-sm">
                                                <div className="font-mono text-foreground">
                                                    {formatLocalDateTime(token.dataInsights.lastSeen, 'time')}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {formatLocalDateTime(token.dataInsights.lastSeen, 'date')}
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">N/A</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        {(() => {
                                            const quality = token.dataInsights?.dataQuality ?? 'unknown';
                                            const qualityConfig = {
                                                'good': { color: 'text-green-400', bg: 'bg-green-500/20', label: 'Good' },
                                                'stale': { color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Stale' },
                                                'sparse': { color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Sparse' },
                                                'no-data': { color: 'text-red-400', bg: 'bg-red-500/20', label: 'No Data' },
                                                'error': { color: 'text-red-400', bg: 'bg-red-500/20', label: 'Error' },
                                                'unknown': { color: 'text-muted-foreground', bg: 'bg-muted', label: 'Unknown' }
                                            };
                                            const config = qualityConfig[quality];
                                            return (
                                                <div className={`inline-flex items-center gap-1 px-2 py-1 ${config.bg} ${config.color} rounded-full text-xs`}>
                                                    {quality === 'good' && <Activity className="w-3 h-3" />}
                                                    {quality === 'stale' && <AlertCircle className="w-3 h-3" />}
                                                    {quality === 'sparse' && <TrendingDown className="w-3 h-3" />}
                                                    {(quality === 'no-data' || quality === 'error') && <AlertCircle className="w-3 h-3" />}
                                                    {quality === 'unknown' && <AlertCircle className="w-3 h-3" />}
                                                    {config.label}
                                                </div>
                                            );
                                        })()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {filteredAndSortedTokens.length === 0 && !data.loading && (
                <div className="text-center py-8 text-muted-foreground">
                    {filter ? 'No tokens match your filter.' : 'No price data available.'}
                </div>
            )}

            {/* Loading more indicator */}
            {isLoadingMore && (
                <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Loading additional tokens...
                </div>
            )}
        </div>
    );
} 
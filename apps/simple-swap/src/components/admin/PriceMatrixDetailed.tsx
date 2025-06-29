import React, { useState, useEffect } from 'react';
import { InfoTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Activity, AlertCircle, Eye, EyeOff, Flame } from 'lucide-react';
import { formatLocalDateTime } from '@/lib/admin-config';
import { TokenActions } from './PriceMatrix';

function PriceSeriesDialog({ open, onClose, contractId, symbol }: { open: boolean, onClose: () => void, contractId: string | null, symbol?: string }) {
    const [series, setSeries] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [period, setPeriod] = useState(60 * 60); // default 1 hour in seconds

    useEffect(() => {
        if (!open || !contractId) return;
        setLoading(true);
        setError(null);
        // Last 24h
        const now = Math.floor(Date.now() / 1000);
        const from = now - 24 * 60 * 60;
        const to = now;
        const params = new URLSearchParams({
            contractIds: contractId,
            from: from.toString(),
            to: to.toString(),
            period: period.toString()
        });
        fetch(`/api/price-series/bulk?${params.toString()}`)
            .then(res => res.json())
            .then(data => {
                setSeries(data[contractId] || []);
            })
            .catch(err => setError(err.message || 'Unknown error'))
            .finally(() => setLoading(false));
    }, [open, contractId, period]);

    if (!open || !contractId) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-card rounded-lg shadow-lg p-6 min-w-[340px] max-w-full relative">
                <button className="absolute top-2 right-2 text-muted-foreground hover:text-foreground" onClick={onClose}>&times;</button>
                <h2 className="text-lg font-semibold mb-2">Recent Price Series: <span className="font-mono">{symbol || contractId}</span></h2>
                <div className="mb-3 flex items-center gap-2">
                    <label htmlFor="period-select" className="text-sm">Period:</label>
                    <select
                        id="period-select"
                        value={period}
                        onChange={e => setPeriod(Number(e.target.value))}
                        className="px-2 py-1 border border-border rounded-md text-sm bg-background"
                    >
                        <option value={15 * 60}>15 minutes</option>
                        <option value={60 * 60}>1 hour</option>
                        <option value={4 * 60 * 60}>4 hours</option>
                        <option value={24 * 60 * 60}>1 day</option>
                    </select>
                </div>
                {loading ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                        Loading series...
                    </div>
                ) : error ? (
                    <div className="text-red-500">{error}</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full border text-xs mt-2">
                            <thead>
                                <tr>
                                    <th className="border px-2 py-1 bg-muted">Period Start</th>
                                    <th className="border px-2 py-1 bg-muted">Average</th>
                                    <th className="border px-2 py-1 bg-muted">High</th>
                                    <th className="border px-2 py-1 bg-muted">Low</th>
                                </tr>
                            </thead>
                            <tbody>
                                {series.map((row, i) => (
                                    <tr key={row.start || i}>
                                        <td className="border px-2 py-1 font-mono">{row.start ? new Date(row.start * 1000).toLocaleString() : '-'}</td>
                                        <td className="border px-2 py-1 text-right font-mono">{row.average != null ? row.average.toFixed(6) : '-'}</td>
                                        <td className="border px-2 py-1 text-right font-mono">{row.high != null ? row.high.toFixed(6) : '-'}</td>
                                        <td className="border px-2 py-1 text-right font-mono">{row.low != null ? row.low.toFixed(6) : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export function PriceMatrixDetailed() {
    // Local state for controls
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState('marketcap');
    const [sortDirection, setSortDirection] = useState('desc');
    const [showInactive, setShowInactive] = useState(false);
    const [showWithoutMarketCap, setShowWithoutMarketCap] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(1000);

    // Data state
    const [tokens, setTokens] = useState<any[]>([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogToken, setDialogToken] = useState<any>(null);

    // Fetch data from bulk endpoint
    useEffect(() => {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({
            page: page.toString(),
            pageSize: pageSize.toString(),
            search,
            sortField,
            sortDirection,
            showInactive: showInactive ? 'true' : 'false',
            showWithoutMarketCap: showWithoutMarketCap ? 'true' : 'false',
        });
        fetch(`/api/admin/prices-bulk?${params.toString()}`)
            .then(res => res.json())
            .then(data => {
                setTokens(data.tokens || []);
                setTotalRecords(data.totalRecords || 0);
            })
            .catch(err => setError(err.message || 'Unknown error'))
            .finally(() => setLoading(false));
    }, [page, pageSize, search, sortField, sortDirection, showInactive, showWithoutMarketCap]);

    // Paging helpers
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

    // Controls UI
    return (
        <>
            <PriceSeriesDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                contractId={dialogToken?.contractId || null}
                symbol={dialogToken?.metadata?.symbol}
            />
            <div className="mb-4 flex flex-wrap gap-4 items-center">
                <input
                    type="text"
                    placeholder="Filter tokens..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="px-3 py-2 bg-background border border-border rounded-md text-sm min-w-[180px] max-w-xs flex-1"
                />
                <Button
                    onClick={() => setShowInactive(!showInactive)}
                    variant={showInactive ? 'default' : 'outline'}
                    size="sm"
                >
                    {showInactive ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                    Show Inactive
                </Button>
                <Button
                    onClick={() => setShowWithoutMarketCap(!showWithoutMarketCap)}
                    variant={showWithoutMarketCap ? 'default' : 'outline'}
                    size="sm"
                >
                    {showWithoutMarketCap ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                    Show No Market Cap
                </Button>
                <label className="flex items-center gap-1 text-sm">
                    Page size:
                    <select
                        value={pageSize}
                        onChange={e => setPageSize(Number(e.target.value))}
                        className="px-2 py-2 border border-border rounded-md text-sm bg-background"
                    >
                        {[10, 25, 50, 100, 1000].map(size => (
                            <option key={size} value={size}>{size}</option>
                        ))}
                    </select>
                </label>
                <span className="text-xs text-muted-foreground ml-2">
                    {totalRecords} records, page {page} of {totalPages}
                </span>
                <Button size="sm" disabled={page === 1} onClick={() => setPage(1)}>&laquo;</Button>
                <Button size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>&lsaquo;</Button>
                <Button size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>&rsaquo;</Button>
                <Button size="sm" disabled={page === totalPages} onClick={() => setPage(totalPages)}>&raquo;</Button>
            </div>
            {/* Matrix Table */}
            <div className="bg-card rounded-lg border border-border p-0">
                {loading ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                        Loading tokens...
                    </div>
                ) : error ? (
                    <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <AlertCircle className="w-5 h-5 text-red-400" />
                            <h3 className="text-red-400 font-medium">Error Loading Price Data</h3>
                        </div>
                        <p className="text-red-300 text-sm mb-4">{error}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto overflow-y-visible">
                        <table className="min-w-full divide-y divide-border">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th
                                        className="px-4 py-3 text-left text-xs font-medium text-muted-foreground tracking-wider cursor-pointer hover:bg-muted/70"
                                        onClick={() => setSortField('contractId')}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span>Token {sortField === 'contractId' && (sortDirection === 'asc' ? '↑' : '↓')}</span>
                                            <InfoTooltip content="Token information with quick actions to copy contract address or view on Hiro Explorer" side="bottom" />
                                        </div>
                                    </th>
                                    <th
                                        className="px-4 py-3 text-right text-xs font-medium text-muted-foreground tracking-wider cursor-pointer hover:bg-muted/70"
                                        onClick={() => setSortField('price')}
                                    >
                                        Current Price {sortField === 'price' && (sortDirection === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        className="px-4 py-3 text-right text-xs font-medium text-muted-foreground tracking-wider cursor-pointer hover:bg-muted/70"
                                        onClick={() => setSortField('marketcap')}
                                    >
                                        <div className="flex items-center justify-end gap-2">
                                            <span>Market Cap {sortField === 'marketcap' && (sortDirection === 'asc' ? '↑' : '↓')}</span>
                                            <InfoTooltip content="Market capitalization calculated as current price × total supply. Shows the total value of all tokens in circulation." side="bottom" />
                                        </div>
                                    </th>
                                    <th
                                        className="px-4 py-3 text-right text-xs font-medium text-muted-foreground tracking-wider cursor-pointer hover:bg-muted/70"
                                        onClick={() => setSortField('change1h')}
                                    >
                                        1h Change {sortField === 'change1h' && (sortDirection === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        className="px-4 py-3 text-right text-xs font-medium text-muted-foreground tracking-wider cursor-pointer hover:bg-muted/70"
                                        onClick={() => setSortField('change24h')}
                                    >
                                        24h Change {sortField === 'change24h' && (sortDirection === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th
                                        className="px-4 py-3 text-right text-xs font-medium text-muted-foreground tracking-wider cursor-pointer hover:bg-muted/70"
                                        onClick={() => setSortField('change7d')}
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
                                {tokens.map((token: any) => (
                                    <tr
                                        key={token.contractId + ':' + token.price + ':' + token.marketcap + ':' + token.change1h + ':' + token.change24h + ':' + token.change7d}
                                        className="hover:bg-muted/20 transition-colors cursor-pointer"
                                        onClick={() => { setDialogToken(token); setDialogOpen(true); }}
                                    >
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
                                                <div className={`inline-flex items-center text-sm font-medium ${token.change1h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
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
                                                <div className={`inline-flex items-center text-sm font-medium ${token.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
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
                                                <div className={`inline-flex items-center text-sm font-medium ${token.change7d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
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
                                                const quality = (token.dataInsights?.dataQuality ?? 'unknown') as 'good' | 'stale' | 'sparse' | 'no-data' | 'error' | 'unknown';
                                                const qualityConfig = {
                                                    good: { color: 'text-green-400', bg: 'bg-green-500/20', label: 'Good' },
                                                    stale: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Stale' },
                                                    sparse: { color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Sparse' },
                                                    'no-data': { color: 'text-red-400', bg: 'bg-red-500/20', label: 'No Data' },
                                                    error: { color: 'text-red-400', bg: 'bg-red-500/20', label: 'Error' },
                                                    unknown: { color: 'text-muted-foreground', bg: 'bg-muted', label: 'Unknown' }
                                                } as const;
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
                )}
            </div>
            {tokens.length === 0 && !loading && !error && (
                <div className="text-center py-8 text-muted-foreground">
                    {search ? 'No tokens match your filter.' : 'No price data available.'}
                </div>
            )}
        </>
    );
} 
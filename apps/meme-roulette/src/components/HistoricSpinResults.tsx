'use client';

import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Trophy,
    Clock,
    Users,
    TrendingUp,
    Flame,
    RefreshCw,
    ChevronDown,
    Calendar,
    Target,
    DollarSign
} from 'lucide-react';
import { useHistoricSpins } from '@/hooks/useHistoricSpins';
import { useTokenPrices } from '@/hooks/useTokenPrices';
import TokenAmountDisplay from '@/components/TokenAmountDisplay';

// CHA decimals constant
const CHA_DECIMALS = 6;

const HistoricSpinResults = () => {
    const { data, isLoading, error, hasMore, loadMore, refresh, total } = useHistoricSpins(25);
    const { chaPrice } = useTokenPrices();

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDuration = (ms: number) => {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const getTopTokens = (tokenBets: Record<string, number>) => {
        return Object.entries(tokenBets)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3);
    };

    if (error) {
        return (
            <div className="text-center py-8">
                <div className="text-red-500 mb-4">
                    <Target className="h-8 w-8 mx-auto mb-2" />
                    <p>Failed to load historic results</p>
                    <p className="text-sm text-muted-foreground">{error}</p>
                </div>
                <Button onClick={refresh} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-background/50 md:glass-card px-4 py-6 md:p-6 border-b border-border/20 md:border md:rounded-xl">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-base sm:text-lg font-semibold font-display flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                            Historic Spin Results
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Complete history of all meme roulette rounds and their winners
                        </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-2 border border-border/20">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">{total} Total Rounds</span>
                        </div>
                        <Button onClick={refresh} variant="outline" size="sm" disabled={isLoading}>
                            <RefreshCw className={`h-3 w-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>
            </div>

            {/* Results Table */}
            <div className="bg-background/40 md:glass-card px-4 py-6 md:p-6 border-b border-border/20 md:border md:rounded-xl">
                <div className="rounded-xl overflow-hidden">
                    <Table className="w-full">
                        <TableHeader className="bg-card">
                            <TableRow className="border-b border-border/50">
                                <TableHead className="font-display">Round</TableHead>
                                <TableHead className="font-display">Winner</TableHead>
                                <TableHead className="text-right font-display">Total CHA</TableHead>
                                <TableHead className="text-center font-display hidden sm:table-cell">Participants</TableHead>
                                <TableHead className="text-center font-display hidden md:table-cell">Votes</TableHead>
                                <TableHead className="text-center font-display hidden lg:table-cell">Duration</TableHead>
                                <TableHead className="font-display hidden xl:table-cell">Top Tokens</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && data.length === 0 ? (
                                // Loading skeleton
                                Array.from({ length: 10 }).map((_, index) => (
                                    <TableRow key={index}>
                                        <TableCell>
                                            <div className="space-y-1">
                                                <div className="w-20 h-4 bg-muted/30 rounded animate-pulse" />
                                                <div className="w-16 h-3 bg-muted/30 rounded animate-pulse" />
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 bg-muted/30 rounded-full animate-pulse" />
                                                <div className="w-20 h-4 bg-muted/30 rounded animate-pulse" />
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="w-24 h-4 bg-muted/30 rounded animate-pulse ml-auto" />
                                        </TableCell>
                                        <TableCell className="text-center hidden sm:table-cell">
                                            <div className="w-8 h-4 bg-muted/30 rounded animate-pulse mx-auto" />
                                        </TableCell>
                                        <TableCell className="text-center hidden md:table-cell">
                                            <div className="w-8 h-4 bg-muted/30 rounded animate-pulse mx-auto" />
                                        </TableCell>
                                        <TableCell className="text-center hidden lg:table-cell">
                                            <div className="w-12 h-4 bg-muted/30 rounded animate-pulse mx-auto" />
                                        </TableCell>
                                        <TableCell className="hidden xl:table-cell">
                                            <div className="w-32 h-4 bg-muted/30 rounded animate-pulse" />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : data.length > 0 ? (
                                data.map((spin) => {
                                    const topTokens = getTopTokens(spin.tokenBets);

                                    return (
                                        <TableRow key={spin.roundId} className="hover:bg-muted/20 transition-colors">
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <div className="font-medium font-display text-sm">
                                                        {formatDate(spin.endTime)}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground font-mono">
                                                        {spin.roundId.slice(0, 8)}...
                                                    </div>
                                                </div>
                                            </TableCell>

                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {spin.winningTokenInfo ? (
                                                        <>
                                                            {spin.winningTokenInfo.image ? (
                                                                <img
                                                                    src={spin.winningTokenInfo.image}
                                                                    alt={spin.winningTokenInfo.name}
                                                                    className="w-6 h-6 rounded-full bg-muted/20"
                                                                    onError={(e) => {
                                                                        e.currentTarget.style.display = 'none';
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                                                                    <span className="text-xs font-bold text-primary">
                                                                        {spin.winningTokenInfo.symbol?.[0] || '?'}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <div className="min-w-0">
                                                                <div className="font-medium truncate flex items-center gap-1">
                                                                    <Trophy className="h-3 w-3 text-yellow-500" />
                                                                    {spin.winningTokenInfo.symbol}
                                                                    {spin.isATH && (
                                                                        <Badge variant="outline" className="text-xs bg-orange-500/20 text-orange-400 border-orange-500/30">
                                                                            <Flame className="h-2 w-2 mr-1" />
                                                                            ATH
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-muted-foreground truncate">
                                                                    {spin.winningTokenInfo.name}
                                                                </div>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="flex items-center gap-2 text-muted-foreground">
                                                            <div className="w-6 h-6 rounded-full bg-muted/20 flex items-center justify-center">
                                                                <span className="text-xs">?</span>
                                                            </div>
                                                            <span className="text-sm">No winner</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>

                                            <TableCell className="text-right font-mono">
                                                <TokenAmountDisplay
                                                    amount={spin.totalCHA}
                                                    decimals={CHA_DECIMALS}
                                                    symbol="CHA"
                                                    usdPrice={chaPrice}
                                                    className="text-primary"
                                                    size="sm"
                                                    showUsdInTooltip={true}
                                                />
                                            </TableCell>

                                            <TableCell className="text-center font-mono text-muted-foreground hidden sm:table-cell">
                                                <div className="flex items-center justify-center gap-1">
                                                    <Users className="h-3 w-3" />
                                                    {spin.totalParticipants}
                                                </div>
                                            </TableCell>

                                            <TableCell className="text-center font-mono text-blue-400 hidden md:table-cell">
                                                <div className="flex items-center justify-center gap-1">
                                                    <TrendingUp className="h-3 w-3" />
                                                    {spin.totalVotes}
                                                </div>
                                            </TableCell>

                                            <TableCell className="text-center font-mono text-muted-foreground hidden lg:table-cell">
                                                <div className="flex items-center justify-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {formatDuration(spin.roundDuration)}
                                                </div>
                                            </TableCell>

                                            <TableCell className="hidden xl:table-cell">
                                                <div className="flex flex-wrap gap-1">
                                                    {topTokens.slice(0, 2).map(([tokenId, amount], index) => (
                                                        <Badge
                                                            key={tokenId}
                                                            variant="outline"
                                                            className="text-xs"
                                                        >
                                                            <DollarSign className="h-2 w-2 mr-1" />
                                                            {((amount / spin.totalCHA) * 100).toFixed(0)}%
                                                        </Badge>
                                                    ))}
                                                    {topTokens.length > 2 && (
                                                        <Badge variant="outline" className="text-xs text-muted-foreground">
                                                            +{topTokens.length - 2}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-16">
                                        <div className="flex flex-col items-center justify-center text-center space-y-6 max-w-lg mx-auto">
                                            <Clock className="h-16 w-16 text-muted-foreground/40" />
                                            <div className="space-y-3">
                                                <h3 className="text-xl font-semibold text-foreground">No Historic Data Yet</h3>
                                                <p className="text-muted-foreground text-base leading-relaxed">
                                                    Historic data collection will begin with future rounds.<br />
                                                    Start playing to create history!
                                                </p>
                                            </div>
                                            <div className="text-sm text-muted-foreground/70 bg-muted/20 rounded-lg px-6 py-3 border border-border/30 max-w-md">
                                                <div className="flex items-center justify-center gap-2">
                                                    <span>💡</span>
                                                    <span>This feature will automatically track winners and results from completed rounds</span>
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>

                    {/* Load More Button */}
                    {hasMore && data.length > 0 && (
                        <div className="p-4 text-center border-t border-border/20">
                            <Button
                                onClick={loadMore}
                                variant="outline"
                                disabled={isLoading}
                                className="w-full sm:w-auto"
                            >
                                {isLoading ? (
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <ChevronDown className="h-4 w-4 mr-2" />
                                )}
                                Load More Results
                            </Button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-4 pt-4 border-t border-border/30 flex justify-between items-center text-xs text-muted-foreground">
                    <div>
                        Showing {data.length} of {total} historic rounds
                    </div>
                    <div className="flex items-center gap-1">
                        <span>Powered by</span>
                        <span className="font-bold text-primary">Charisma</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HistoricSpinResults; 
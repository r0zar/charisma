import React, { useMemo } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Trophy } from 'lucide-react';
import Image from 'next/image';
import { useTokenPrices } from '@/hooks/useTokenPrices';

interface CurrentTokenBetsTableProps {
    status: any;
}

export function CurrentTokenBetsTable({ status }: CurrentTokenBetsTableProps) {
    const { chaPrice } = useTokenPrices();

    const formatCHA = (atomicAmount: number) => {
        const decimalAmount = atomicAmount / 1_000_000;
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 6
        }).format(decimalAmount);
    };

    const formatUSD = (chaAmount: number) => {
        if (!chaPrice) return '';
        const decimalAmount = chaAmount / 1_000_000;
        const usdAmount = decimalAmount * chaPrice;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 6
        }).format(usdAmount);
    };

    const tokenBetsData = useMemo(() => {
        if (!status?.tokenBets || !status?.tokens) return [];

        const bets = status.tokenBets;
        const tokens = status.tokens;

        return Object.entries(bets)
            .filter(([tokenId, amount]) => Number(amount) > 0)
            .map(([tokenId, amount]) => {
                const token = tokens.find((t: any) => t.contractId === tokenId);
                return {
                    tokenId,
                    token,
                    amount: Number(amount),
                    symbol: token?.symbol || 'Unknown',
                    name: token?.name || 'Unknown Token',
                    image: token?.image || '',
                    type: token?.type || 'UNKNOWN'
                };
            })
            .sort((a, b) => b.amount - a.amount);
    }, [status?.tokenBets, status?.tokens]);

    const totalCHA = tokenBetsData.reduce((sum, item) => sum + item.amount, 0);

    const getTokenBadgeColor = (type: string) => {
        switch (type?.toUpperCase()) {
            case 'SIP10':
                return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'SUBNET':
                return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
            case 'MEMECOIN':
                return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
            default:
                return 'bg-muted/10 text-muted-foreground border-border';
        }
    };

    if (tokenBetsData.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Current Token Bets
                    </CardTitle>
                    <CardDescription>All tokens with committed CHA in this round</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8">
                        <TrendingUp className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-muted-foreground mb-2">No Bets Yet</h3>
                        <p className="text-muted-foreground">
                            No tokens have received any CHA commitments in this round.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Current Token Bets
                </CardTitle>
                <CardDescription>
                    {tokenBetsData.length} tokens with {formatCHA(totalCHA)} CHA committed total
                    {chaPrice && ` (≈${formatUSD(totalCHA)})`}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="w-[80px] text-center">Rank</TableHead>
                                <TableHead>Token</TableHead>
                                <TableHead className="text-right">Committed CHA</TableHead>
                                <TableHead className="text-right w-[100px]">Share</TableHead>
                                <TableHead className="text-center w-[100px]">Type</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tokenBetsData.map((item, index) => {
                                const percentage = totalCHA > 0 ? (item.amount / totalCHA) * 100 : 0;
                                const isTopToken = index === 0;

                                return (
                                    <TableRow
                                        key={item.tokenId}
                                        className={`hover:bg-muted/50 transition-colors ${isTopToken ? 'bg-primary/5' : ''}`}
                                    >
                                        <TableCell className="text-center">
                                            <div className="flex items-center justify-center">
                                                {isTopToken && (
                                                    <Trophy className="h-4 w-4 text-primary mr-1" />
                                                )}
                                                <span className={`font-bold ${isTopToken ? 'text-primary' : 'text-muted-foreground'}`}>
                                                    #{index + 1}
                                                </span>
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                {item.image && (
                                                    <div className="relative flex-shrink-0">
                                                        <Image
                                                            src={item.image}
                                                            alt={item.symbol}
                                                            width={32}
                                                            height={32}
                                                            className="rounded-full object-cover bg-muted"
                                                            onError={(e) => {
                                                                e.currentTarget.src = '/placeholder-token.png';
                                                            }}
                                                        />
                                                        {isTopToken && (
                                                            <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center">
                                                                <Trophy className="h-2.5 w-2.5" />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-semibold text-foreground truncate">
                                                        {item.symbol}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground truncate">
                                                        {item.name}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground/70 font-mono truncate">
                                                        {item.tokenId.slice(0, 20)}...
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>

                                        <TableCell className="text-right">
                                            <div className="space-y-1">
                                                <div className={`font-bold numeric ${isTopToken ? 'text-primary' : 'text-foreground'}`}>
                                                    {formatCHA(item.amount)} CHA
                                                </div>
                                                {chaPrice && (
                                                    <div className="text-sm text-muted-foreground numeric">
                                                        ≈{formatUSD(item.amount)}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>

                                        <TableCell className="text-right">
                                            <div className="space-y-2">
                                                <div className={`font-bold numeric ${isTopToken ? 'text-primary' : 'text-muted-foreground'}`}>
                                                    {percentage.toFixed(1)}%
                                                </div>
                                                <div className="bg-muted/30 h-2 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-300 ${isTopToken ? 'bg-primary' : 'bg-muted-foreground'}`}
                                                        style={{ width: `${Math.min(100, percentage)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </TableCell>

                                        <TableCell className="text-center">
                                            <Badge variant="outline" className={getTokenBadgeColor(item.type)}>
                                                {item.type || 'UNKNOWN'}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>

                <div className="mt-4 text-center text-sm text-muted-foreground">
                    Tokens are ranked by total CHA committed. Higher amounts increase selection probability.
                </div>
            </CardContent>
        </Card>
    );
} 
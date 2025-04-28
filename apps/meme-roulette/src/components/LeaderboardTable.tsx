'use client';

import React, { useMemo } from 'react';
import { useSpin } from '@/contexts/SpinContext'; // Import the hook for tokenBets
import Image from 'next/image';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton"; // Assuming Skeleton component exists
import type { Token } from '@/types/spin'; // Import Token type if needed for leaderboard item type
import { Trophy, RefreshCw, Rocket, TrendingUp, Medal } from 'lucide-react';

interface LeaderboardTableProps {
    tokens: Token[]; // Expect the full token list as a prop
    tokenBets: Record<string, number>; // Expect tokenBets as a prop
    isLoading: boolean; // Add loading state from HubPage
}

// Define the expected shape of a leaderboard item
interface LeaderboardItem {
    token: Token;
    totalBet: number;
}

export function LeaderboardTable({ tokens, tokenBets, isLoading }: LeaderboardTableProps) {
    // Get leaderboard data and loading status from context
    const {
        leaderboard,
        state: { isFeedLoading, isFeedConnected }
    } = useSpin();

    // --- Calculate Leaderboard Data Here ---
    const leaderboardData = useMemo(() => {
        const bets = tokenBets || {};
        return tokens
            .map(token => ({
                token,
                totalBet: bets[token.id] || 0, // Use tokenBets prop
            }))
            .filter(item => item.totalBet > 0)
            .sort((a, b) => b.totalBet - a.totalBet);
    }, [tokens, tokenBets]);

    // Loading state: Show skeletons if feed is loading or not yet connected and leaderboard is empty
    const showLoadingState = isLoading || leaderboardData.length === 0;

    // Calculate total for percentage calculation
    const totalCHA = leaderboardData.reduce((sum, item) => sum + item.totalBet, 0) || 1; // Avoid division by zero

    if (showLoadingState) {
        return (
            <div className="glass-card p-8 text-center">
                <div className="flex flex-col items-center justify-center gap-4">
                    <div className="rounded-full bg-muted/30 p-4 w-16 h-16 flex items-center justify-center animate-pulse-medium">
                        <RefreshCw className="h-8 w-8 text-primary/60 animate-spin-slow" />
                    </div>
                    <div className="space-y-3">
                        <h3 className="text-xl font-display font-medium">Waiting for First Commitments</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                            Be the first to commit! Place CHA on your favorite token and watch the leaderboard fill up.
                        </p>
                        <div className="mt-6 flex justify-center">
                            <div className="bg-muted/30 px-6 py-4 rounded-lg border border-border/40 max-w-md">
                                <p className="text-sm text-primary/90 font-display">
                                    The token with the most committed CHA has the highest chance of being pumped in the group buy.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (leaderboardData.length === 0) {
        return (
            <div className="glass-card p-8 text-center">
                <div className="flex flex-col items-center justify-center gap-4">
                    <div className="rounded-full bg-muted/30 p-4 w-16 h-16 flex items-center justify-center">
                        <Trophy className="h-8 w-8 text-primary/60" />
                    </div>
                    <div className="space-y-3">
                        <h3 className="text-xl font-display font-medium">No Commitments Yet</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                            Be the first to commit CHA to a token! Your commitment helps determine which token will receive the collective pump.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Medal colors based on ranking
    const getMedalColor = (index: number) => {
        switch (index) {
            case 0: return "text-yellow-400"; // gold
            case 1: return "text-gray-300";   // silver
            case 2: return "text-amber-600";  // bronze
            default: return "text-muted-foreground";
        }
    };

    return (
        <div className="rounded-xl overflow-hidden">
            <Table className="w-full">
                <TableHeader className="bg-card">
                    <TableRow className="border-b border-border/50">
                        <TableHead className="w-[60px] text-center font-display">Rank</TableHead>
                        <TableHead className="font-display">Token</TableHead>
                        <TableHead className="text-right font-display w-[120px]">Committed CHA</TableHead>
                        <TableHead className="text-right font-display w-[100px] hidden sm:table-cell">Share</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {leaderboardData.map((item: LeaderboardItem, index: number) => {
                        // Calculate percentage for this token
                        const percentage = (item.totalBet / totalCHA) * 100;
                        return (
                            <TableRow
                                key={item.token.id}
                                className={`
                                    relative hover:bg-muted/20 transition-colors
                                    ${index === 0 ? 'bg-primary/5' : ''}
                                `}
                            >
                                {/* Percentage bar in background */}

                                {/* Cell contents */}
                                <TableCell className="font-medium text-center relative w-[60px]">
                                    <div className={`
                                        rounded-full w-8 h-8 flex items-center justify-center mx-auto
                                        ${index < 3 ? 'bg-muted/30' : ''}
                                        ${index === 0 ? 'animate-pulse-slow' : ''}
                                    `}>
                                        {index < 3 ? (
                                            <Medal className={`h-4 w-4 ${getMedalColor(index)}`} />
                                        ) : (
                                            <span className="text-sm text-muted-foreground">{index + 1}</span>
                                        )}
                                    </div>
                                </TableCell>

                                <TableCell>
                                    <div className="flex items-center gap-3 relative z-10">
                                        <div className="relative flex-shrink-0">
                                            <Image
                                                src={item.token.imageUrl}
                                                alt={item.token.name}
                                                width={36}
                                                height={36}
                                                className={`
                                                    rounded-full object-cover bg-muted h-9 w-9
                                                    border-2 ${index === 0 ? 'border-primary/50' : 'border-transparent'}
                                                `}
                                                onError={(e) => { e.currentTarget.src = '/placeholder-token.png'; }}
                                            />
                                            {index === 0 && (
                                                <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">
                                                    <TrendingUp className="h-3 w-3" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium font-display truncate">{item.token.name}</div>
                                            <div className="text-xs text-muted-foreground font-mono">{item.token.symbol}</div>
                                        </div>
                                    </div>
                                </TableCell>

                                <TableCell className="text-right font-mono tabular-nums text-primary relative z-10 font-medium w-[120px]">
                                    {item.totalBet.toLocaleString()}
                                </TableCell>

                                <TableCell className="text-right text-muted-foreground relative z-10 hidden sm:table-cell w-[480px] ">
                                    <div className="flex items-center justify-end gap-2 w-full">
                                        <div className="bg-muted/30 h-2 rounded-full overflow-hidden w-full">
                                            <div
                                                className="h-full bg-primary rounded-full w-full"
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-mono tabular-nums">{percentage.toFixed(1)}%</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>

            <div className="text-center text-xs text-muted-foreground px-4 py-3 border-t border-border/30 bg-card/50">
                <p>Tokens with more CHA committed have a higher chance of being selected for the group pump</p>
            </div>
        </div>
    );
}

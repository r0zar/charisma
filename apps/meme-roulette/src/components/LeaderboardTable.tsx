'use client';

import React, { useMemo } from 'react';
import { useSpin } from '@/contexts/SpinContext'; // Import the hook for tokenBets
import Image from 'next/image';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
// Assuming Skeleton component exists
import type { Token } from '@/types/spin'; // Import Token type if needed for leaderboard item type
import { Trophy, RefreshCw, Medal } from 'lucide-react';

// Helper function to format atomic amounts (consider moving to a shared utils file)
const formatAtomicToWholeUnit = (atomicAmount: number | undefined | null, decimalsInput: number | undefined | null, tokenId?: string): string => {
    let decimals = decimalsInput;
    if (atomicAmount === undefined || atomicAmount === null || isNaN(atomicAmount)) {
        return '0.00';
    }
    if (decimals === undefined || decimals === null || isNaN(decimals) || decimals === 0) {
        if (tokenId) {
            console.warn(`LeaderboardTable: Missing or invalid decimals (received: ${decimalsInput}) for token ${tokenId}. Defaulting to 6 decimals for display.`);
        }
        decimals = 6; // Default to 6 if decimals are problematic
    }
    const wholeUnitAmount = atomicAmount / (10 ** decimals);
    return wholeUnitAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
};

// Helper function to format CHA amounts
const formatCHAAmount = (atomicAmount: number, decimals: number = 6) => {
    const wholeAmount = atomicAmount / (10 ** decimals);
    if (wholeAmount >= 1000000) {
        return `${(wholeAmount / 1000000).toFixed(1)}M`;
    } else if (wholeAmount >= 1000) {
        return `${(wholeAmount / 1000).toFixed(1)}K`;
    }
    return wholeAmount.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
};

// Helper function to format USD amounts
const formatUSDAmount = (atomicAmount: number, usdPrice: number | undefined, decimals: number = 6) => {
    if (!usdPrice || atomicAmount === 0) return null;

    const wholeAmount = atomicAmount / (10 ** decimals);
    const usdValue = wholeAmount * usdPrice;

    if (usdValue >= 1000000) {
        return `$${(usdValue / 1000000).toFixed(1)}M`;
    } else if (usdValue >= 1000) {
        return `$${(usdValue / 1000).toFixed(1)}K`;
    } else if (usdValue >= 1) {
        return `$${usdValue.toFixed(2)}`;
    } else {
        return `$${usdValue.toFixed(4)}`;
    }
};

interface LeaderboardTableProps {
    tokens: Token[]; // Expect the full token list as a prop
    tokenBets: Record<string, number>; // Expect tokenBets as a prop
    isLoading: boolean; // Add loading state from HubPage
    chaPrice?: number; // Add CHA USD price for conversions
}

// Define the expected shape of a leaderboard item
interface LeaderboardItem {
    token: Token;
    totalBet: number;
}

export function LeaderboardTable({ tokens, tokenBets, isLoading, chaPrice }: LeaderboardTableProps) {
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
                        const percentage = (item.totalBet / totalCHA) * 100;
                        return (
                            <TableRow
                                key={item.token.id}
                                className="relative hover:bg-muted/20 transition-colors"
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
                                                `}
                                                onError={(e) => { e.currentTarget.src = '/placeholder-token.png'; }}
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium font-display truncate">{item.token.name}</div>
                                            <div className="text-xs text-muted-foreground font-mono">{item.token.symbol}</div>
                                        </div>
                                    </div>
                                </TableCell>

                                <TableCell className="text-right font-mono tabular-nums text-primary relative z-10 font-medium w-[120px]">
                                    <div className="text-right">
                                        <div className="font-bold">{formatCHAAmount(item.totalBet)} CHA</div>
                                        {chaPrice && (
                                            <div className="text-xs text-muted-foreground/60 font-normal">
                                                ≈{formatUSDAmount(item.totalBet, chaPrice)}
                                            </div>
                                        )}
                                    </div>
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

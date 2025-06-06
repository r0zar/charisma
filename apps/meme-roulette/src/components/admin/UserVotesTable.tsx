import React, { useState, useMemo, useEffect } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// Remove collapsible import - using simple expand/collapse instead
import { Users, Search, ChevronDown, ChevronUp, HandCoins, Clock } from 'lucide-react';
import Image from 'next/image';
import { useTokenPrices } from '@/hooks/useTokenPrices';
import { useBnsCache } from '@/hooks/useBnsCache';

interface UserVotesTableProps {
    status: any;
}

interface UserVoteData {
    userId: string;
    votes: any[];
    totalCHA: number;
    uniqueTokens: number;
    firstVoteTime: number;
    lastVoteTime: number;
}

export function UserVotesTable({ status }: UserVotesTableProps) {
    const { chaPrice } = useTokenPrices();
    const { getDisplayNames } = useBnsCache();
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
    const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
    const [loadingDisplayNames, setLoadingDisplayNames] = useState(false);

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

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleString();
    };

    // Helper function to truncate address for display
    const truncateAddress = (address: string): string => {
        if (!address) return 'Anonymous';
        if (address.length <= 12) return address;
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    // Helper to get display name with BNS fallback
    const getDisplayName = (userId: string): string => {
        if (loadingDisplayNames) return 'Loading...';
        return displayNames[userId] || truncateAddress(userId);
    };

    const userVotesData = useMemo(() => {
        if (!status?.userVotes?.votes) return [];

        const userVotes = status.userVotes.votes;
        const userData: UserVoteData[] = [];

        Object.entries(userVotes).forEach(([userId, votes]: [string, any]) => {
            if (!votes || votes.length === 0) return;

            const totalCHA = votes.reduce((sum: number, vote: any) => sum + vote.voteAmountCHA, 0);
            const uniqueTokens = new Set(votes.map((vote: any) => vote.tokenId)).size;
            const voteTimes = votes.map((vote: any) => vote.voteTime).sort((a: number, b: number) => a - b);

            userData.push({
                userId,
                votes,
                totalCHA,
                uniqueTokens,
                firstVoteTime: voteTimes[0],
                lastVoteTime: voteTimes[voteTimes.length - 1]
            });
        });

        return userData.sort((a, b) => b.totalCHA - a.totalCHA);
    }, [status?.userVotes?.votes]);

    // Load BNS display names when user data changes (with optimized caching)
    useEffect(() => {
        const loadDisplayNames = async () => {
            if (userVotesData.length === 0) return;

            setLoadingDisplayNames(true);
            try {
                const userIds = userVotesData.map(user => user.userId);

                // Use client-side BNS cache (handles server API calls + caching)
                const names = await getDisplayNames(userIds);
                setDisplayNames(names);
            } catch (error) {
                console.error('Failed to load display names:', error);
                // Fallback to truncated addresses
                const fallbackNames: Record<string, string> = {};
                userVotesData.forEach(user => {
                    fallbackNames[user.userId] = truncateAddress(user.userId);
                });
                setDisplayNames(fallbackNames);
            } finally {
                setLoadingDisplayNames(false);
            }
        };

        loadDisplayNames();
    }, [userVotesData, getDisplayNames]);

    const filteredData = useMemo(() => {
        if (!searchTerm) return userVotesData;

        const term = searchTerm.toLowerCase();
        return userVotesData.filter(user => {
            const displayName = getDisplayName(user.userId);
            return user.userId.toLowerCase().includes(term) ||
                displayName.toLowerCase().includes(term);
        });
    }, [userVotesData, searchTerm, displayNames, loadingDisplayNames]);

    const toggleUserExpansion = (userId: string) => {
        setExpandedUsers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) {
                newSet.delete(userId);
            } else {
                newSet.add(userId);
            }
            return newSet;
        });
    };

    const getTokenInfo = (tokenId: string) => {
        if (!status?.tokens) return null;
        return status.tokens.find((t: any) => t.contractId === tokenId);
    };

    const totalUsers = userVotesData.length;
    const totalCHA = userVotesData.reduce((sum, user) => sum + user.totalCHA, 0);

    if (userVotesData.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        User Votes
                    </CardTitle>
                    <CardDescription>Detailed breakdown of all user votes in this round</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8">
                        <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-muted-foreground mb-2">No Votes Yet</h3>
                        <p className="text-muted-foreground">
                            No users have placed any votes in this round.
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
                    <Users className="h-5 w-5" />
                    User Votes
                </CardTitle>
                <CardDescription>
                    {totalUsers} users with {formatCHA(totalCHA)} CHA committed total
                    {chaPrice && ` (≈${formatUSD(totalCHA)})`}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {/* Search */}
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by user ID or BNS name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        {searchTerm && (
                            <Button
                                variant="outline"
                                onClick={() => setSearchTerm('')}
                                size="sm"
                            >
                                Clear
                            </Button>
                        )}
                    </div>

                    {/* User List */}
                    <div className="space-y-3">
                        {filteredData.map((user, index) => {
                            const isExpanded = expandedUsers.has(user.userId);
                            const isTopUser = index === 0 && !searchTerm;

                            return (
                                <div key={user.userId} className={`border border-border rounded-lg ${isTopUser ? 'bg-primary/5 border-primary/20' : 'bg-card'}`}>
                                    <Button
                                        variant="ghost"
                                        className="w-full p-4 h-auto justify-between hover:bg-muted/50"
                                        onClick={() => toggleUserExpansion(user.userId)}
                                    >
                                        <div className="flex items-center gap-4 flex-1 text-left">
                                            <div className="flex items-center gap-2">
                                                <div className={`rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold ${isTopUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                                    #{index + 1}
                                                </div>
                                                <HandCoins className="h-4 w-4 text-muted-foreground" />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-foreground text-sm truncate">
                                                    {getDisplayName(user.userId)}
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    {displayNames[user.userId] && displayNames[user.userId] !== truncateAddress(user.userId) && (
                                                        <span className="font-mono text-xs">{truncateAddress(user.userId)} • </span>
                                                    )}
                                                    {user.votes.length} votes • {user.uniqueTokens} tokens
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <div className={`font-bold numeric ${isTopUser ? 'text-primary' : 'text-foreground'}`}>
                                                    {formatCHA(user.totalCHA)} CHA
                                                </div>
                                                {chaPrice && (
                                                    <div className="text-sm text-muted-foreground numeric">
                                                        ≈{formatUSD(user.totalCHA)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {isExpanded ? (
                                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                        )}
                                    </Button>

                                    {isExpanded && (
                                        <div className="px-4 pb-4 space-y-3">
                                            {/* User Summary */}
                                            <div className="grid grid-cols-2 gap-4 p-3 bg-muted/20 rounded-lg text-sm">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-muted-foreground">First Vote:</span>
                                                    <span className="font-mono">{formatTime(user.firstVoteTime)}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-muted-foreground">Last Vote:</span>
                                                    <span className="font-mono">{formatTime(user.lastVoteTime)}</span>
                                                </div>
                                            </div>

                                            {/* Individual Votes */}
                                            <div className="space-y-2">
                                                <h4 className="font-semibold text-sm">Individual Votes</h4>
                                                <div className="border border-border rounded-lg overflow-hidden">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="bg-muted/30">
                                                                <TableHead className="text-xs">Token</TableHead>
                                                                <TableHead className="text-xs text-right">Amount</TableHead>
                                                                <TableHead className="text-xs text-right">Time</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {user.votes
                                                                .sort((a: any, b: any) => b.voteTime - a.voteTime)
                                                                .map((vote: any, voteIndex: number) => {
                                                                    const token = getTokenInfo(vote.tokenId);
                                                                    return (
                                                                        <TableRow key={voteIndex} className="hover:bg-muted/20">
                                                                            <TableCell className="py-2">
                                                                                <div className="flex items-center gap-2">
                                                                                    {token?.image && (
                                                                                        <Image
                                                                                            src={token.image}
                                                                                            alt={token.symbol || 'Token'}
                                                                                            width={20}
                                                                                            height={20}
                                                                                            className="rounded-full object-cover"
                                                                                            onError={(e) => {
                                                                                                e.currentTarget.src = '/placeholder-token.png';
                                                                                            }}
                                                                                        />
                                                                                    )}
                                                                                    <div>
                                                                                        <div className="font-semibold text-xs">
                                                                                            {token?.symbol || 'Unknown'}
                                                                                        </div>
                                                                                        <div className="text-xs text-muted-foreground font-mono">
                                                                                            {vote.tokenId.slice(0, 16)}...
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </TableCell>
                                                                            <TableCell className="py-2 text-right">
                                                                                <div className="space-y-1">
                                                                                    <div className="font-bold text-xs numeric">
                                                                                        {formatCHA(vote.voteAmountCHA)} CHA
                                                                                    </div>
                                                                                    {chaPrice && (
                                                                                        <div className="text-xs text-muted-foreground numeric">
                                                                                            ≈{formatUSD(vote.voteAmountCHA)}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </TableCell>
                                                                            <TableCell className="py-2 text-right">
                                                                                <div className="text-xs font-mono text-muted-foreground">
                                                                                    {formatTime(vote.voteTime)}
                                                                                </div>
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    );
                                                                })}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {filteredData.length === 0 && searchTerm && (
                        <div className="text-center py-8">
                            <Search className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                            <p className="text-muted-foreground">
                                No users found matching "{searchTerm}"
                            </p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
} 
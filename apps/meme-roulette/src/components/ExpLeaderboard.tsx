'use client';

import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Search, Trophy, ArrowUp, ArrowDown, Sparkles, Flame, Clock, Users, RefreshCw, HandCoins, TrendingUp, Zap, History } from 'lucide-react';
import { useSpin } from '@/contexts/SpinContext';
import { useTokenPrices } from '@/hooks/useTokenPrices';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import TokenAmountDisplay from '@/components/TokenAmountDisplay';
import HistoricSpinResults from '@/components/HistoricSpinResults';
import AchievementBadges from '@/components/AchievementBadges';
import { TwitterShareButton } from '@/components/ui/TwitterShareButton';
import type { Vote } from '@/types/spin';

// CHA decimals constant
const CHA_DECIMALS = 6;

const LeaderboardComponent = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortType, setSortType] = useState<'total_cha' | 'total_votes' | 'current_round'>('total_cha');

  const { state: { feedData, myBets, isFeedLoading } } = useSpin();
  const { chaPrice } = useTokenPrices();

  // Use the real leaderboard system
  const { data: leaderboardData, isLoading: isLeaderboardLoading, error } = useLeaderboard({
    type: sortType,
    limit: 100,
    refreshInterval: 30000, // Refresh every 30 seconds
  });

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!leaderboardData?.entries) return [];

    return leaderboardData.entries.filter(entry =>
      entry.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.userId.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [leaderboardData?.entries, searchTerm]);

  const getMedalColor = (rank: number) => {
    switch (rank) {
      case 1: return "text-yellow-400";
      case 2: return "text-gray-300";
      case 3: return "text-amber-600";
      default: return "text-muted-foreground";
    }
  };

  const getSortTypeLabel = (type: string) => {
    switch (type) {
      case 'total_cha': return 'Total CHA';
      case 'total_votes': return 'Total Votes';
      case 'current_round': return 'Current Round';
      default: return 'Total CHA';
    }
  };

  const isLoading = isLeaderboardLoading || isFeedLoading;

  return (
    <div className="flex flex-col gap-0 md:gap-6 mb-0 md:mb-8">
      {/* Main Header */}
      <div className="bg-background/50 md:glass-card px-4 py-6 md:p-6 border-b border-border/20 md:border md:rounded-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-base sm:text-lg font-semibold font-display flex items-center gap-2 mb-2">
              <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Meme Roulette Analytics
            </h1>
            <p className="text-sm text-muted-foreground">Live leaderboards and complete historic results</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="leaderboard" className="w-full">
        <div className="bg-background/40 md:glass-card px-4 py-4 md:p-6 border-b border-border/20 md:border md:rounded-xl">
          <TabsList className="grid w-full grid-cols-3 bg-muted/20">
            <TabsTrigger value="leaderboard" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Trophy className="h-4 w-4 mr-2" />
              Leaderboard
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <History className="h-4 w-4 mr-2" />
              Historic Results
            </TabsTrigger>
            <TabsTrigger value="achievements" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Sparkles className="h-4 w-4 mr-2" />
              Achievement Badges
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="leaderboard" className="mt-0">
          <div className="flex flex-col gap-0 md:gap-6 mb-0 md:mb-8">
            {/* Header Section */}
            <div className="bg-background/50 md:glass-card px-4 py-6 md:p-6 border-b border-border/20 md:border md:rounded-xl">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-base sm:text-lg font-semibold font-display flex items-center gap-2 mb-2">
                    <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    Player Leaderboard
                  </h1>
                  <p className="text-sm text-muted-foreground">Top players ranked by their meme roulette activity</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-2 border border-border/20">
                    <div className="bg-green-500 w-2 h-2 rounded-full animate-pulse"></div>
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{leaderboardData?.totalUsers || 0} Active</span>
                  </div>
                  <div className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-2 border border-border/20">
                    <RefreshCw className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Live</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="bg-background/40 md:glass-card px-4 py-6 md:p-6 border-b border-border/20 md:border md:rounded-xl">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search players..."
                    className="pl-10 bg-background border-border"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <Tabs defaultValue="total_cha" className="w-full md:w-auto" onValueChange={(value) => setSortType(value as typeof sortType)}>
                  <TabsList className="bg-muted/20">
                    <TabsTrigger value="total_cha" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <HandCoins className="h-4 w-4 mr-1" /> Total CHA
                    </TabsTrigger>
                    <TabsTrigger value="total_votes" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <TrendingUp className="h-4 w-4 mr-1" /> Votes
                    </TabsTrigger>
                    <TabsTrigger value="current_round" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <Clock className="h-4 w-4 mr-1" /> This Round
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {/* Leaderboard Table */}
            <div className="bg-background/40 md:glass-card px-4 py-6 md:p-6 border-b border-border/20 md:border md:rounded-xl">
              <div className="rounded-xl overflow-hidden">
                <Table className="w-full">
                  <TableHeader className="bg-card">
                    <TableRow className="border-b border-border/50">
                      <TableHead className="w-[60px] text-center font-display">Rank</TableHead>
                      <TableHead className="font-display">Player</TableHead>
                      <TableHead className="text-right font-display">{getSortTypeLabel(sortType)}</TableHead>
                      <TableHead className="text-right font-display hidden sm:table-cell">Total Votes</TableHead>
                      <TableHead className="text-right font-display hidden md:table-cell">Avg. Vote</TableHead>
                      <TableHead className="text-right font-display hidden lg:table-cell">Biggest Vote</TableHead>
                      <TableHead className="text-right font-display hidden xl:table-cell">Win Rate</TableHead>
                      <TableHead className="text-right font-display hidden md:table-cell">Referrals</TableHead>
                      <TableHead className="font-display hidden sm:table-cell">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      // Loading skeleton
                      Array.from({ length: 5 }).map((_, index) => (
                        <TableRow key={index}>
                          <TableCell className="text-center">
                            <div className="w-8 h-8 bg-muted/30 rounded-full animate-pulse mx-auto" />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 bg-muted/30 rounded-full animate-pulse" />
                              <div className="space-y-1">
                                <div className="w-24 h-4 bg-muted/30 rounded animate-pulse" />
                                <div className="w-16 h-3 bg-muted/30 rounded animate-pulse" />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="w-20 h-4 bg-muted/30 rounded animate-pulse ml-auto" />
                          </TableCell>
                          <TableCell className="text-right hidden sm:table-cell">
                            <div className="w-12 h-4 bg-muted/30 rounded animate-pulse ml-auto" />
                          </TableCell>
                          <TableCell className="text-right hidden md:table-cell">
                            <div className="w-16 h-4 bg-muted/30 rounded animate-pulse ml-auto" />
                          </TableCell>
                          <TableCell className="text-right hidden lg:table-cell">
                            <div className="w-16 h-4 bg-muted/30 rounded animate-pulse ml-auto" />
                          </TableCell>
                          <TableCell className="text-right hidden xl:table-cell">
                            <div className="w-12 h-4 bg-muted/30 rounded animate-pulse ml-auto" />
                          </TableCell>
                          <TableCell className="text-right font-mono text-purple-500 hidden md:table-cell">
                            <div className="w-12 h-4 bg-muted/30 rounded animate-pulse ml-auto" />
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <div className="w-16 h-6 bg-muted/30 rounded animate-pulse" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : filteredData.length > 0 ? filteredData.map((entry) => {
                      const currentUser = feedData?.currentUserBets?.[0]?.userId;
                      const isCurrentUser = entry.userId === currentUser;
                      const winRate = entry.stats.totalRoundsParticipated > 0
                        ? (entry.stats.winCount / entry.stats.totalRoundsParticipated) * 100
                        : 0;

                      return (
                        <TableRow
                          key={entry.userId}
                          className={`relative hover:bg-muted/20 transition-colors ${isCurrentUser ? 'bg-primary/5' : ''}`}
                        >
                          <TableCell className="font-medium text-center relative w-[60px]">
                            <div className={`
                        rounded-full w-8 h-8 flex items-center justify-center mx-auto
                        ${entry.rank <= 3 ? 'bg-muted/30' : ''}
                        ${entry.rank === 1 ? 'animate-pulse-slow' : ''}
                      `}>
                              {entry.rank <= 3 ? (
                                <Trophy className={`h-4 w-4 ${getMedalColor(entry.rank)}`} />
                              ) : (
                                <span className="text-sm text-muted-foreground">{entry.rank}</span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-3 relative z-10">
                              <div className="min-w-0 flex-1">
                                <div className="font-medium font-display truncate flex items-center gap-2">
                                  {entry.displayName}
                                  {isCurrentUser && (
                                    <Badge variant="outline" className="text-xs bg-primary/20 text-primary border-primary/30">
                                      You
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground font-mono">
                                  {entry.stats.achievements.length} achievements
                                </div>
                              </div>
                              {isCurrentUser && entry.rank <= 10 && (
                                <TwitterShareButton
                                  message={entry.rank === 1
                                    ? `🏆 I'm #1 on the Meme Roulette leaderboard! ${(entry.score / 1000000).toLocaleString()} CHA committed across ${entry.stats.totalVotes} votes.`
                                    : entry.rank <= 3
                                      ? `🥉 I'm in the top 3 on the Meme Roulette leaderboard! Ranked #${entry.rank} with ${(entry.score / 1000000).toLocaleString()} CHA committed.`
                                      : `📈 I'm ranked #${entry.rank} on the Meme Roulette leaderboard! ${(entry.score / 1000000).toLocaleString()} CHA committed across ${entry.stats.totalVotes} votes.`
                                  }
                                  size="sm"
                                  variant="ghost"
                                  className="opacity-70 hover:opacity-100"
                                  showIcon={false}
                                />
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-right font-mono tabular-nums text-primary relative z-10 font-medium">
                            <TokenAmountDisplay
                              amount={entry.score}
                              decimals={CHA_DECIMALS}
                              symbol="CHA"
                              usdPrice={chaPrice}
                              className="text-primary"
                              size="sm"
                              showUsdInTooltip={true}
                            />
                          </TableCell>

                          <TableCell className="text-right font-mono text-muted-foreground hidden sm:table-cell">
                            {entry.stats.totalVotes.toLocaleString()}
                          </TableCell>

                          <TableCell className="text-right font-mono text-blue-400 hidden md:table-cell">
                            <TokenAmountDisplay
                              amount={entry.stats.averageVoteSize}
                              decimals={CHA_DECIMALS}
                              symbol="CHA"
                              usdPrice={chaPrice}
                              className="text-blue-400"
                              size="sm"
                              showUsdInTooltip={true}
                            />
                          </TableCell>

                          <TableCell className="text-right font-mono text-green-400 hidden lg:table-cell">
                            <TokenAmountDisplay
                              amount={entry.stats.biggestVote}
                              decimals={CHA_DECIMALS}
                              symbol="CHA"
                              usdPrice={chaPrice}
                              className="text-green-400"
                              size="sm"
                              showUsdInTooltip={true}
                            />
                          </TableCell>

                          <TableCell className="text-right font-mono text-amber-400 hidden xl:table-cell">
                            {winRate.toFixed(1)}%
                          </TableCell>

                          <TableCell className="text-right font-mono text-purple-500 hidden md:table-cell">
                            {typeof entry.referralCount === 'number' ? entry.referralCount : 0}
                          </TableCell>

                          <TableCell className="hidden sm:table-cell">
                            <div className="flex flex-wrap gap-1">
                              {entry.stats.lastActivityTime > Date.now() - (24 * 60 * 60 * 1000) && (
                                <Badge variant="outline" className="text-xs bg-primary/20 text-primary border-primary/30">
                                  Active
                                </Badge>
                              )}
                              {entry.stats.biggestVote >= 100 * (10 ** CHA_DECIMALS) && (
                                <Badge variant="outline" className="text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                                  Whale
                                </Badge>
                              )}
                              {entry.stats.currentStreak >= 5 && (
                                <Badge variant="outline" className="text-xs bg-orange-500/20 text-orange-400 border-orange-500/30">
                                  Streak
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    }) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          <HandCoins className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No voting activity yet. Be the first to vote!</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {/* Coming Soon Features */}
                <div className="mt-6 p-4 bg-muted/10 border border-border/20 rounded-lg">
                  <h3 className="font-medium font-display mb-2 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    Coming Soon Features
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Soon</Badge>
                      <span>XP & Level System</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs bg-green-500/20 text-green-400 border-green-500/30">Live</Badge>
                      <span>Achievement Badges</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Soon</Badge>
                      <span>Earnings Tracking</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Soon</Badge>
                      <span>Historical Rankings</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-4 pt-4 border-t border-border/30 flex justify-between items-center text-xs text-muted-foreground">
                <div>
                  Showing {filteredData.length} of {leaderboardData?.totalUsers || 0} players • Updated live
                </div>
                <div className="flex items-center gap-1">
                  <span>Powered by</span>
                  <span className="font-bold text-primary">Charisma</span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <HistoricSpinResults />
        </TabsContent>

        <TabsContent value="achievements" className="mt-0">
          <AchievementBadges />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LeaderboardComponent;
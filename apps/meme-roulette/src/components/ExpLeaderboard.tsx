'use client';

import React, { useState } from 'react';
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
import { Search, Trophy, ArrowUp, ArrowDown, Sparkles, Flame, Clock, Users, RefreshCw } from 'lucide-react';

// Sample data for the leaderboard
const leaderboardData = [
  {
    id: 1,
    rank: 1,
    username: 'CryptoWhale',
    address: 'cryptowhale.btc',
    xp: 8750,
    level: 42,
    earnings: 12500,
    staked: 5000,
    achievements: 12,
    change: 'up',
    badges: ['OG', 'Whale', 'Diamond']
  },
  {
    id: 2,
    rank: 2,
    username: 'Satoshi2077',
    address: 'satoshi2077.btc',
    xp: 7920,
    level: 38,
    earnings: 9800,
    staked: 12000,
    achievements: 9,
    change: 'same',
    badges: ['Staker', 'Early']
  },
  {
    id: 3,
    rank: 3,
    username: 'BlockNinja',
    address: 'blockninja.btc',
    xp: 7100,
    level: 35,
    earnings: 8750,
    staked: 3200,
    achievements: 15,
    change: 'up',
    badges: ['Collector', 'Strategist']
  },
  {
    id: 4,
    rank: 4,
    username: 'StacksBuilder',
    address: 'stacksbuilder.btc',
    xp: 6800,
    level: 33,
    earnings: 6200,
    staked: 8900,
    achievements: 7,
    change: 'down',
    badges: ['Staker', 'Builder']
  },
  {
    id: 5,
    rank: 5,
    username: 'CryptoQueen',
    address: 'cryptoqueen.btc',
    xp: 6200,
    level: 31,
    earnings: 7500,
    staked: 4300,
    achievements: 10,
    change: 'same',
    badges: ['OG', 'Social']
  },
  {
    id: 6,
    rank: 6,
    username: 'Web3Wizard',
    address: 'web3wiz.btc',
    xp: 5800,
    level: 29,
    earnings: 5200,
    staked: 6700,
    achievements: 8,
    change: 'up',
    badges: ['Explorer', 'Trader']
  },
  {
    id: 7,
    rank: 7,
    username: 'DefiGuru',
    address: 'defiguru.btc',
    xp: 5300,
    level: 27,
    earnings: 4800,
    staked: 9100,
    achievements: 6,
    change: 'up',
    badges: ['Staker', 'Trader']
  },
  {
    id: 8,
    rank: 8,
    username: 'GameMaster',
    address: 'gamemaster.btc',
    xp: 4900,
    level: 25,
    earnings: 3900,
    staked: 2100,
    achievements: 11,
    change: 'down',
    badges: ['Gamer', 'Collector']
  },
  {
    id: 9,
    rank: 9,
    username: 'ChainChampion',
    address: 'chainchamp.btc',
    xp: 4500,
    level: 23,
    earnings: 3200,
    staked: 4600,
    achievements: 5,
    change: 'down',
    badges: ['Explorer', 'Social']
  },
  {
    id: 10,
    rank: 10,
    username: 'StacksHodler',
    address: 'stackshodl.btc',
    xp: 4100,
    level: 21,
    earnings: 2800,
    staked: 7300,
    achievements: 4,
    change: 'up',
    badges: ['Staker', 'Holder']
  },
];

// Badge color mapping
const badgeColors = {
  'OG': 'bg-primary/20 text-primary border-primary/30',
  'Whale': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Diamond': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  'Staker': 'bg-green-500/20 text-green-400 border-green-500/30',
  'Early': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Collector': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  'Strategist': 'bg-red-500/20 text-red-400 border-red-500/30',
  'Builder': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'Social': 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30',
  'Explorer': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Trader': 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  'Gamer': 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  'Holder': 'bg-teal-500/20 text-teal-400 border-teal-500/30'
};

// Format currency with K/M/B suffixes
const formatCurrency = (amount: number) => {
  if (amount >= 1000000000) {
    return `$${(amount / 1000000000).toFixed(2)}B`;
  }
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(2)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(2)}K`;
  }
  return `$${amount}`;
};

// Truncate address for display
const truncateAddress = (address: string) => {
  if (!address.includes('.btc')) {
    const start = address.slice(0, 6);
    const end = address.slice(-4);
    return `${start}...${end}`;
  }
  return address;
};

const LeaderboardComponent = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortType, setSortType] = useState('xp');

  // Filter data based on search term
  const filteredData = leaderboardData.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort data based on selected type
  const sortedData = [...filteredData].sort((a, b) => {
    if (sortType === 'xp') return b.xp - a.xp;
    if (sortType === 'earnings') return b.earnings - a.earnings;
    if (sortType === 'staked') return b.staked - a.staked;
    if (sortType === 'achievements') return b.achievements - a.achievements;
    return 0;
  });

  // Re-rank based on the current sort
  const rankedData = sortedData.map((user, index) => ({
    ...user,
    currentRank: index + 1
  }));

  const getMedalColor = (rank: number) => {
    switch (rank) {
      case 1: return "text-yellow-400";
      case 2: return "text-gray-300";
      case 3: return "text-amber-600";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="flex flex-col gap-0 md:gap-6 mb-0 md:mb-8">
      {/* Header Section */}
      <div className="bg-background/50 md:glass-card px-4 py-6 md:p-6 border-b border-border/20 md:border md:rounded-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-base sm:text-lg font-semibold font-display flex items-center gap-2 mb-2">
              <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Experience Leaderboard
            </h1>
            <p className="text-sm text-muted-foreground">Top players ranked by their contribution and achievements</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-2 border border-border/20">
              <div className="bg-green-500 w-2 h-2 rounded-full animate-pulse"></div>
              <Users className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">1,243 Active</span>
            </div>
            <div className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-2 border border-border/20">
              <RefreshCw className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">5m ago</span>
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

          <Tabs defaultValue="xp" className="w-full md:w-auto" onValueChange={setSortType}>
            <TabsList className="bg-muted/20">
              <TabsTrigger value="xp" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Sparkles className="h-4 w-4 mr-1" /> XP
              </TabsTrigger>
              <TabsTrigger value="earnings" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Flame className="h-4 w-4 mr-1" /> Earnings
              </TabsTrigger>
              <TabsTrigger value="staked" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Flame className="h-4 w-4 mr-1" /> Staked
              </TabsTrigger>
              <TabsTrigger value="achievements" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Trophy className="h-4 w-4 mr-1" /> Achievements
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
                <TableHead className="text-right font-display hidden sm:table-cell">Level</TableHead>
                <TableHead className="text-right font-display">XP</TableHead>
                <TableHead className="text-right font-display hidden md:table-cell">Earnings</TableHead>
                <TableHead className="text-right font-display hidden lg:table-cell">Staked</TableHead>
                <TableHead className="text-right font-display hidden xl:table-cell">Achievements</TableHead>
                <TableHead className="font-display hidden sm:table-cell">Badges</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankedData.map((user) => (
                <TableRow
                  key={user.id}
                  className="relative hover:bg-muted/20 transition-colors"
                >
                  <TableCell className="font-medium text-center relative w-[60px]">
                    <div className={`
                      rounded-full w-8 h-8 flex items-center justify-center mx-auto
                      ${user.currentRank < 4 ? 'bg-muted/30' : ''}
                      ${user.currentRank === 1 ? 'animate-pulse-slow' : ''}
                    `}>
                      {user.currentRank <= 3 ? (
                        <Trophy className={`h-4 w-4 ${getMedalColor(user.currentRank)}`} />
                      ) : (
                        <div className="flex items-center">
                          <span className="text-sm text-muted-foreground">{user.currentRank}</span>
                          {user.change === 'up' && <ArrowUp className="text-green-500 h-3 w-3 ml-1" />}
                          {user.change === 'down' && <ArrowDown className="text-red-500 h-3 w-3 ml-1" />}
                        </div>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-3 relative z-10">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium font-display truncate">{user.username}</div>
                        <div className="text-xs text-muted-foreground font-mono">{truncateAddress(user.address)}</div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-right hidden sm:table-cell">
                    <div className="inline-flex items-center justify-center bg-primary/10 text-primary rounded-md px-2 py-1 text-xs font-medium border border-primary/20">
                      Lvl {user.level}
                    </div>
                  </TableCell>

                  <TableCell className="text-right font-mono tabular-nums text-primary relative z-10 font-medium">
                    {user.xp.toLocaleString()}
                  </TableCell>

                  <TableCell className="text-right font-mono text-green-400 hidden md:table-cell">
                    {formatCurrency(user.earnings)}
                  </TableCell>

                  <TableCell className="text-right font-mono text-blue-400 hidden lg:table-cell">
                    {formatCurrency(user.staked)}
                  </TableCell>

                  <TableCell className="text-right font-mono text-amber-400 hidden xl:table-cell">
                    {user.achievements}
                  </TableCell>

                  <TableCell className="hidden sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {user.badges.slice(0, 2).map((badge, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className={`text-xs ${badgeColors[badge as keyof typeof badgeColors] || 'bg-muted/20 text-muted-foreground border-muted'}`}
                        >
                          {badge}
                        </Badge>
                      ))}
                      {user.badges.length > 2 && (
                        <Badge variant="outline" className="text-xs bg-muted/20 text-muted-foreground border-muted">
                          +{user.badges.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {rankedData.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No players found matching your search.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-border/30 flex justify-between items-center text-xs text-muted-foreground">
          <div>
            Showing {rankedData.length} of {leaderboardData.length} players
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

export default LeaderboardComponent;
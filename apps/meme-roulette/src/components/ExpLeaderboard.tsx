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
import { Search, Trophy, ArrowUp, ArrowDown, Sparkles, Flame, Clock } from 'lucide-react';

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
  'OG': 'bg-purple-600 hover:bg-purple-700',
  'Whale': 'bg-blue-600 hover:bg-blue-700',
  'Diamond': 'bg-indigo-600 hover:bg-indigo-700',
  'Staker': 'bg-green-600 hover:bg-green-700',
  'Early': 'bg-amber-600 hover:bg-amber-700',
  'Collector': 'bg-pink-600 hover:bg-pink-700',
  'Strategist': 'bg-red-600 hover:bg-red-700',
  'Builder': 'bg-cyan-600 hover:bg-cyan-700',
  'Social': 'bg-fuchsia-600 hover:bg-fuchsia-700',
  'Explorer': 'bg-emerald-600 hover:bg-emerald-700',
  'Trader': 'bg-violet-600 hover:bg-violet-700',
  'Gamer': 'bg-rose-600 hover:bg-rose-700',
  'Holder': 'bg-teal-600 hover:bg-teal-700'
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

  return (
    <div className="w-full max-w-6xl mx-auto bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 shadow-xl">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-900 to-indigo-900 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center">
              <Trophy className="mr-2 h-6 w-6 text-yellow-400" />
              Experience Leaderboard
            </h1>
            <p className="text-zinc-300 mt-1">Top players ranked by their contribution and achievements</p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center bg-zinc-800 rounded-md p-1 text-sm">
              <div className="bg-green-500 w-2 h-2 rounded-full animate-pulse mr-2 ml-2"></div>
              <span className="text-zinc-300 mr-2">1,243 Active Players</span>
            </div>
            <div className="flex items-center bg-zinc-800 rounded-md p-1 text-sm">
              <Clock className="h-4 w-4 text-zinc-400 mr-1 ml-1" />
              <span className="text-zinc-300 mr-1">Updated 5m ago</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="p-4 bg-zinc-800 border-b border-zinc-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 h-4 w-4" />
            <Input
              placeholder="Search by username or address"
              className="pl-10 bg-zinc-900 border-zinc-700 placeholder:text-zinc-500 focus:border-violet-500 focus:ring-violet-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Tabs defaultValue="xp" className="w-full md:w-auto" onValueChange={setSortType}>
            <TabsList className="bg-zinc-900">
              <TabsTrigger value="xp" className="data-[state=active]:bg-violet-700">
                <Sparkles className="h-4 w-4 mr-1" /> XP
              </TabsTrigger>
              <TabsTrigger value="earnings" className="data-[state=active]:bg-violet-700">
                <Flame className="h-4 w-4 mr-1" /> Earnings
              </TabsTrigger>
              <TabsTrigger value="staked" className="data-[state=active]:bg-violet-700">
                <Flame className="h-4 w-4 mr-1" /> Staked
              </TabsTrigger>
              <TabsTrigger value="achievements" className="data-[state=active]:bg-violet-700">
                <Trophy className="h-4 w-4 mr-1" /> Achievements
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="p-4">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-zinc-800 bg-zinc-900">
              <TableHead className="text-zinc-300">Rank</TableHead>
              <TableHead className="text-zinc-300">Player</TableHead>
              <TableHead className="text-zinc-300 text-right">Level</TableHead>
              <TableHead className="text-zinc-300 text-right">XP</TableHead>
              <TableHead className="text-zinc-300 text-right">Earnings</TableHead>
              <TableHead className="text-zinc-300 text-right">Staked</TableHead>
              <TableHead className="text-zinc-300 text-right">Achievements</TableHead>
              <TableHead className="text-zinc-300">Badges</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rankedData.map((user) => (
              <TableRow
                key={user.id}
                className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors"
              >
                <TableCell className="font-medium text-zinc-300 w-16">
                  <div className="flex items-center">
                    {user.currentRank <= 3 ? (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${user.currentRank === 1 ? 'bg-yellow-500' :
                        user.currentRank === 2 ? 'bg-zinc-300' : 'bg-amber-700'
                        }`}>
                        {user.currentRank}
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <span className="ml-3 mr-1">{user.currentRank}</span>
                        {user.change === 'up' && <ArrowUp className="text-green-500 h-4 w-4" />}
                        {user.change === 'down' && <ArrowDown className="text-red-500 h-4 w-4" />}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-semibold text-white">{user.username}</div>
                    <div className="text-xs text-zinc-500">{truncateAddress(user.address)}</div>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex items-center justify-center bg-indigo-950 text-indigo-300 rounded-md px-2 py-1 text-sm font-medium">
                    Lvl {user.level}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-zinc-300">
                  {user.xp.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-green-400">
                  {formatCurrency(user.earnings)}
                </TableCell>
                <TableCell className="text-right font-mono text-blue-400">
                  {formatCurrency(user.staked)}
                </TableCell>
                <TableCell className="text-right font-mono text-amber-400">
                  {user.achievements}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {user.badges.map((badge, index) => (
                      <Badge
                        key={index}
                        className={`text-xs ${badgeColors[badge as keyof typeof badgeColors] || 'bg-zinc-600'}`}
                      >
                        {badge}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {rankedData.length === 0 && (
          <div className="text-center py-8 text-zinc-400">
            No players found matching your search.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-zinc-800 border-t border-zinc-700 flex justify-between items-center text-xs text-zinc-400">
        <div>
          Showing {rankedData.length} of {leaderboardData.length} players
        </div>
        <div className="flex items-center">
          <span className="mr-1">Powered by</span>
          <span className="font-bold text-white">Charisma</span>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardComponent;
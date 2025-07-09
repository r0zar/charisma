'use client';

import React, { useState, useMemo } from 'react';
import { 
  Bot, 
  Plus, 
  Search, 
  Filter, 
  Grid, 
  List, 
  Play, 
  Pause, 
  Settings, 
  Trash2, 
  MoreHorizontal,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Fuel,
  Wallet,
  Activity,
  BarChart3,
  Copy,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useBots } from '@/contexts/bot-context';
import { useNotifications } from '@/contexts/notification-context';
import { formatCurrency, formatRelativeTime, truncateAddress } from '@/lib/utils';
import { Bot as BotType } from '@/types/bot';
import Link from 'next/link';

const statusColors = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
  setup: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  inactive: 'bg-muted text-muted-foreground border-border'
};

const statusIcons = {
  active: <CheckCircle className="w-3 h-3" />,
  paused: <Pause className="w-3 h-3" />,
  error: <XCircle className="w-3 h-3" />,
  setup: <Clock className="w-3 h-3" />,
  inactive: <Clock className="w-3 h-3" />
};

interface BotCardProps {
  bot: BotType;
  onStart: (id: string) => void;
  onPause: (id: string) => void;
  onDelete: (id: string) => void;
  viewMode: 'grid' | 'list';
}

function BotCard({ bot, onStart, onPause, onDelete, viewMode }: BotCardProps) {
  const { showSuccess, showError } = useNotifications();
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => showSuccess('Copied to clipboard'))
      .catch(() => showError('Failed to copy to clipboard'));
  };

  const openInExplorer = (address: string) => {
    window.open(`https://explorer.stacks.co/address/${address}`, '_blank');
  };

  if (viewMode === 'list') {
    return (
      <Card className="bg-card border-border hover:bg-card/90 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-12 h-12 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                <Bot className="w-6 h-6 text-blue-400" />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-card-foreground">{bot.name}</h3>
                  <Badge className={`${statusColors[bot.status]} text-xs`}>
                    {statusIcons[bot.status]}
                    <span className="ml-1 capitalize">{bot.status}</span>
                  </Badge>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="capitalize">{bot.strategy}</span>
                  <span>{truncateAddress(bot.walletAddress)}</span>
                  <span>{bot.stxBalance.toFixed(2)} STX</span>
                  <span className={bot.dailyPnL >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {bot.dailyPnL >= 0 ? '+' : ''}{formatCurrency(bot.dailyPnL)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {bot.status === 'active' ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onPause(bot.id)}
                  className="border-yellow-600 text-yellow-400 hover:bg-yellow-500/10"
                >
                  <Pause className="w-4 h-4 mr-1" />
                  Pause
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onStart(bot.id)}
                  className="border-green-600 text-green-400 hover:bg-green-500/10"
                >
                  <Play className="w-4 h-4 mr-1" />
                  Start
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover border-border">
                  <DropdownMenuLabel className="text-popover-foreground">Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem asChild className="text-white hover:bg-gray-800">
                    <Link href={`/bots/${bot.id}`}>
                      <Settings className="w-4 h-4 mr-2" />
                      Configure
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => copyToClipboard(bot.walletAddress)}
                    className="text-popover-foreground hover:bg-accent"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Address
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => openInExplorer(bot.walletAddress)}
                    className="text-popover-foreground hover:bg-accent"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View in Explorer
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem 
                    onClick={() => onDelete(bot.id)}
                    className="text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border hover:bg-card/90 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <Bot className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-medium text-card-foreground">{bot.name}</h3>
              <p className="text-sm text-muted-foreground capitalize">{bot.strategy}</p>
            </div>
          </div>
          <Badge className={`${statusColors[bot.status]} text-xs`}>
            {statusIcons[bot.status]}
            <span className="ml-1 capitalize">{bot.status}</span>
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Performance Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">Daily P&L</div>
            <div className={`font-semibold ${bot.dailyPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {bot.dailyPnL >= 0 ? '+' : ''}{formatCurrency(bot.dailyPnL)}
            </div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">Success Rate</div>
            <div className="font-semibold text-card-foreground">{bot.successRate.toFixed(1)}%</div>
          </div>
        </div>

        {/* Setup Progress */}
        {bot.status === 'setup' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Setup Progress</span>
              <span className="text-card-foreground/80">{bot.setupProgress.completionPercentage}%</span>
            </div>
            <Progress value={bot.setupProgress.completionPercentage} className="h-2" />
          </div>
        )}

        {/* Wallet Info */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-gray-400" />
            <span className="text-gray-400">Wallet</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-card-foreground/80">{truncateAddress(bot.walletAddress)}</span>
            <button
              onClick={() => copyToClipboard(bot.walletAddress)}
              className="text-muted-foreground hover:text-card-foreground"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Fuel className="w-4 h-4 text-gray-400" />
            <span className="text-gray-400">Gas</span>
          </div>
          <span className="text-card-foreground/80">{bot.stxBalance.toFixed(2)} STX</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-gray-400">Last Active</span>
          </div>
          <span className="text-card-foreground/80">{formatRelativeTime(bot.lastActive)}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {bot.status === 'active' ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPause(bot.id)}
              className="flex-1 border-yellow-600 text-yellow-400 hover:bg-yellow-500/10"
            >
              <Pause className="w-4 h-4 mr-1" />
              Pause
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStart(bot.id)}
              className="flex-1 border-green-600 text-green-400 hover:bg-green-500/10"
            >
              <Play className="w-4 h-4 mr-1" />
              Start
            </Button>
          )}
          
          <Button asChild size="sm" variant="outline" className="border-blue-600 text-blue-400 hover:bg-blue-500/10">
            <Link href={`/bots/${bot.id}`}>
              <Settings className="w-4 h-4" />
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700">
              <DropdownMenuItem 
                onClick={() => copyToClipboard(bot.walletAddress)}
                className="text-white hover:bg-gray-800"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Address
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => openInExplorer(bot.walletAddress)}
                className="text-white hover:bg-gray-800"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View in Explorer
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-700" />
              <DropdownMenuItem 
                onClick={() => onDelete(bot.id)}
                className="text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BotsPage() {
  const { bots, loading, startBot, pauseBot, deleteBot } = useBots();
  const { showSuccess, showError } = useNotifications();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [strategyFilter, setStrategyFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredBots = useMemo(() => {
    return bots.filter(bot => {
      const matchesSearch = bot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           bot.walletAddress.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || bot.status === statusFilter;
      const matchesStrategy = strategyFilter === 'all' || bot.strategy === strategyFilter;
      
      return matchesSearch && matchesStatus && matchesStrategy;
    });
  }, [bots, searchQuery, statusFilter, strategyFilter]);

  const handleStart = async (id: string) => {
    try {
      await startBot(id);
      showSuccess('Bot started successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError('Failed to start bot', errorMessage);
    }
  };

  const handlePause = async (id: string) => {
    try {
      await pauseBot(id);
      showSuccess('Bot paused successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError('Failed to pause bot', errorMessage);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBot(id);
      showSuccess('Bot deleted successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError('Failed to delete bot', errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bot className="w-8 h-8 text-blue-400 animate-pulse" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Loading Bots...</h2>
          <p className="text-muted-foreground">Fetching your automation bots</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bot Management</h1>
          <p className="text-muted-foreground">Create, configure, and monitor your DeFi automation bots</p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground border-0">
          <Link href="/bots/create">
            <Plus className="w-4 h-4 mr-2" />
            Create Bot
          </Link>
        </Button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search bots by name or wallet address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-input border-border text-foreground"
          />
        </div>
        
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 bg-input border-border text-foreground">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="setup">Setup</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>

          <Select value={strategyFilter} onValueChange={setStrategyFilter}>
            <SelectTrigger className="w-40 bg-input border-border text-foreground">
              <SelectValue placeholder="Strategy" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">All Strategies</SelectItem>
              <SelectItem value="yield-farming">Yield Farming</SelectItem>
              <SelectItem value="dca">DCA</SelectItem>
              <SelectItem value="arbitrage">Arbitrage</SelectItem>
              <SelectItem value="liquidity-mining">Liquidity Mining</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex border border-gray-700 rounded-lg overflow-hidden">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="border-0 rounded-none"
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="border-0 rounded-none"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredBots.length} {filteredBots.length === 1 ? 'bot' : 'bots'} found
        </p>
        {filteredBots.length > 0 && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              {filteredBots.filter(bot => bot.status === 'active').length} Active
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-yellow-400 rounded-full" />
              {filteredBots.filter(bot => bot.status === 'paused').length} Paused
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-red-400 rounded-full" />
              {filteredBots.filter(bot => bot.status === 'error').length} Error
            </span>
          </div>
        )}
      </div>

      {/* Bots Grid/List */}
      {filteredBots.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Bot className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {searchQuery || statusFilter !== 'all' || strategyFilter !== 'all' 
              ? 'No bots match your filters' 
              : 'No bots created yet'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || statusFilter !== 'all' || strategyFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Create your first automation bot to get started'}
          </p>
          <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground border-0">
            <Link href="/bots/create">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Bot
            </Link>
          </Button>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
          {filteredBots.map((bot) => (
            <BotCard
              key={bot.id}
              bot={bot}
              onStart={handleStart}
              onPause={handlePause}
              onDelete={handleDelete}
              viewMode={viewMode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
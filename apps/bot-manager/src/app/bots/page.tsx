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
  ExternalLink,
  Target
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
import { useBotStateMachine } from '@/contexts/bot-state-machine-context';
import { useToast } from '@/contexts/toast-context';
import { useWallet } from '@/contexts/wallet-context';
import { formatCurrency, formatRelativeTime, truncateAddress } from '@/lib/utils';
import { getStrategyDisplayName, getStrategyType } from '@/lib/features/bots/strategy-parser';
import { Bot as BotType } from '@/schemas/bot.schema';
import { BotAvatar } from '@/components/ui/bot-avatar';
import { usePublicBots } from '@/hooks/usePublicBots';
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
  const { showSuccess, showError } = useToast();
  const { startBot, pauseBot, isTransitioning } = useBotStateMachine();

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
      <Card className="bg-card border-border hover:bg-card/90 transition-colors p-0">
        <CardContent className="px-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <BotAvatar bot={bot} size="lg" />

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-card-foreground">{bot.name}</h3>
                  <div className={`w-2 h-2 rounded-full ${
                    bot.status === 'active' ? 'bg-green-400 animate-pulse' :
                    bot.status === 'paused' ? 'bg-yellow-400' :
                    bot.status === 'error' ? 'bg-red-400' :
                    bot.status === 'setup' ? 'bg-blue-400' :
                    'bg-gray-400'
                  }`} />
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{getStrategyDisplayName(bot.strategy)}</span>
                  <span>{truncateAddress(bot.id)}</span>
                  {bot.status === 'setup' ? (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Settings className="w-3 h-3" />
                      <span>Setup required - configure strategy and activate bot</span>
                    </span>
                  ) : (
                    <>
                      <span className="flex items-center gap-1">
                        <Fuel className="w-3 h-3" />
                        <span className="text-gray-500 italic">No balance data</span>
                      </span>
                      <span className="flex items-center gap-1 text-gray-500">
                        <TrendingUp className="w-3 h-3" />
                        <span className="italic">No P&L data</span>
                      </span>
                      <span className="flex items-center gap-1 text-gray-500">
                        <Target className="w-3 h-3" />
                        <span className="italic">No success rate</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {bot.status === 'active' ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const updated = await pauseBot(bot, 'User paused via list view');
                    if (updated) onPause(bot.id);
                  }}
                  disabled={isTransitioning}
                  className="h-7 text-xs border-yellow-600 text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-50"
                >
                  <Pause className="w-3 h-3 mr-1" />
                  Pause
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const updated = await startBot(bot, 'User started via list view');
                    if (updated) onStart(bot.id);
                  }}
                  disabled={isTransitioning || bot.status === 'setup'}
                  className="h-7 text-xs border-green-600 text-green-400 hover:bg-green-500/10 disabled:opacity-50"
                >
                  <Play className="w-3 h-3 mr-1" />
                  Start
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <MoreHorizontal className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover border-border">
                  <DropdownMenuLabel className="text-popover-foreground">Bot Wallet</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem asChild className="text-popover-foreground hover:bg-accent">
                    <Link href={`/bots/${bot.id}`}>
                      <Settings className="w-4 h-4 mr-2" />
                      Configure
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => copyToClipboard(bot.id)}
                    className="text-popover-foreground hover:bg-accent"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Bot Address
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => openInExplorer(bot.id)}
                    className="text-popover-foreground hover:bg-accent"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View in Explorer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Pokemon card style for grid view
  if (viewMode === 'grid') {
    return (
      <div 
        className="bg-card rounded-lg border-2 border-border/20 hover:bg-card/90 transition-all duration-200 shadow-lg hover:shadow-xl group overflow-hidden" 
        style={{ aspectRatio: '5/7' }}
      >
        {/* Outer Frame - Using CSS Grid for precise control */}
        <div className="h-full grid grid-rows-[auto_1fr_auto] gap-2 p-2">

          {/* Frame Header - Bot name and status */}
          <div className="flex items-center justify-between px-1">
            <Link href={`/bots/${bot.id}`} className="text-sm font-bold text-card-foreground truncate hover:text-blue-400 transition-colors">
              {bot.name}
            </Link>
            <div className={`w-2 h-2 rounded-full ${
              bot.status === 'active' ? 'bg-green-400 animate-pulse' :
              bot.status === 'paused' ? 'bg-yellow-400' :
              bot.status === 'error' ? 'bg-red-400' :
              bot.status === 'setup' ? 'bg-blue-400' :
              'bg-gray-400'
            }`} />
          </div>

          {/* Main Content Area - Image + Body in a flex column */}
          <div className="flex flex-col min-h-0 overflow-hidden">
            {/* Image Section */}
            <div className="bg-gradient-to-br from-muted/50 to-muted/30 border border-border/10 overflow-hidden rounded-md flex-1 max-h-[60%]">
              <div className="w-full h-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center">
                <BotAvatar bot={bot} size="xl" className="w-full h-full object-cover" />
              </div>
            </div>

            {/* Body Section */}
            <div className="bg-card/50 mt-2 flex-1 flex flex-col relative min-h-0">
            {/* Watermarks for different states */}
            {bot.status === 'setup' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none -mt-8">
                <Settings className="w-24 h-24 text-muted-foreground/8" />
              </div>
            )}
            {bot.status === 'active' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none -mt-8">
                <Play className="w-24 h-24 text-green-400/8" />
              </div>
            )}
            
            {/* Strategy Type */}
            <p className="text-xs text-muted-foreground tracking-wider mb-3 text-center relative z-10">
              {getStrategyDisplayName(bot.strategy)}
            </p>

            {/* Stats/Info Section */}
            {bot.status === 'setup' ? (
              /* Setup State - Clean status message */
              <div className="flex flex-col items-center justify-center text-center py-4 mb-3 relative z-10">
                <div className="text-xs text-muted-foreground font-medium">Configuration Required</div>
                <div className="text-xs text-muted-foreground/80">Click to configure strategy</div>
              </div>
            ) : (
              /* Active/Paused/Error State - Info grid */
              <div className="grid grid-cols-2 gap-1.5 mb-3">
                <div className="text-center py-2">
                  <div className="text-xs text-muted-foreground/60">P&L</div>
                  <div className="text-xs text-muted-foreground">--</div>
                </div>
                <div className="text-center py-2">
                  <div className="text-xs text-muted-foreground/60">Success</div>
                  <div className="text-xs text-muted-foreground">--%</div>
                </div>
                <div className="text-center py-2">
                  <div className="text-xs text-muted-foreground/60">Balance</div>
                  <div className="text-xs text-muted-foreground">--</div>
                </div>
                <div className="text-center py-2">
                  <div className="text-xs text-muted-foreground/60">Trades</div>
                  <div className="text-xs text-muted-foreground">--</div>
                </div>
              </div>
            )}
            </div>
          </div>

          {/* Action Area - Grid footer */}
          <div className="border-t border-border/50 pt-2">  
              {bot.status === 'setup' ? (
                /* Setup State - Configure button */
                <Button 
                  asChild 
                  size="sm" 
                  className="w-full h-7 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                >
                  <Link href={`/bots/${bot.id}`}>
                    <Settings className="w-3 h-3 mr-1" />
                    Configure Bot
                  </Link>
                </Button>
              ) : bot.status === 'active' ? (
                /* Active State - Single pause button */
                <Button
                  size="sm"
                  onClick={async () => {
                    const updated = await pauseBot(bot, 'User paused via bot card');
                    if (updated) onPause(bot.id);
                  }}
                  disabled={isTransitioning}
                  className="w-full h-7 text-xs bg-yellow-600 hover:bg-yellow-700 text-white disabled:opacity-50"
                >
                  <Pause className="w-3 h-3 mr-1" />
                  Pause Bot
                </Button>
              ) : (
                /* Other States - Control buttons */
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const updated = await startBot(bot, 'User started via bot card');
                      if (updated) onStart(bot.id);
                    }}
                    disabled={isTransitioning}
                    className="flex-1 h-7 text-xs border-green-600 text-green-400 hover:bg-green-500/10 disabled:opacity-50"
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Start
                  </Button>

                  <Button asChild size="sm" variant="outline" className="h-7 border-blue-600 text-blue-400 hover:bg-blue-500/10">
                    <Link href={`/bots/${bot.id}`}>
                      <Settings className="w-3 h-3" />
                    </Link>
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <MoreHorizontal className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover border-border">
                      <DropdownMenuLabel className="text-popover-foreground">Bot Wallet</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-border" />
                      <DropdownMenuItem
                        onClick={() => copyToClipboard(bot.id)}
                        className="text-popover-foreground hover:bg-accent"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Address
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => openInExplorer(bot.id)}
                        className="text-popover-foreground hover:bg-accent"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Explorer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
          </div>
        </div>
      </div>
    );
  }

  // Original design for list view
  return (
    <Card className="bg-card border-border hover:bg-card/90 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BotAvatar bot={bot} size="md" />
            <div>
              <h3 className="font-medium text-card-foreground">{bot.name}</h3>
              <p className="text-sm text-muted-foreground">{getStrategyDisplayName(bot.strategy)}</p>
            </div>
          </div>
          <div className={`w-2 h-2 rounded-full ${
            bot.status === 'active' ? 'bg-green-400 animate-pulse' :
            bot.status === 'paused' ? 'bg-yellow-400' :
            bot.status === 'error' ? 'bg-red-400' :
            bot.status === 'setup' ? 'bg-blue-400' :
            'bg-gray-400'
          }`} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Performance Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">Daily P&L</div>
            <div className="font-semibold text-gray-500 italic text-sm">
              No data available
            </div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">Success Rate</div>
            <div className="font-semibold text-gray-500 italic text-sm">No data available</div>
          </div>
        </div>

        {/* Wallet Info */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-gray-400" />
            <span className="text-gray-400">Wallet</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-card-foreground/80">{truncateAddress(bot.id)}</span>
            <button
              onClick={() => copyToClipboard(bot.id)}
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
          <span className="text-card-foreground/80">-- STX</span>
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
            <DropdownMenuContent align="end" className="bg-popover border-border">
              <DropdownMenuLabel className="text-popover-foreground">Bot Wallet</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onClick={() => copyToClipboard(bot.id)}
                className="text-popover-foreground hover:bg-accent"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Bot Address
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => openInExplorer(bot.id)}
                className="text-popover-foreground hover:bg-accent"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View in Explorer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card >
  );
}

export default function BotsPage() {
  const { bots, loading, deleteBot } = useBots();
  const { bots: publicBots, stats: publicStats, loading: publicLoading } = usePublicBots();
  const { startBot, pauseBot } = useBotStateMachine();
  const { showSuccess, showError } = useToast();
  const { walletState, connectWallet, isConnecting } = useWallet();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredBots = useMemo(() => {
    return bots.filter(bot => {
      const matchesSearch = bot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bot.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        getStrategyDisplayName(bot.strategy).toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || bot.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [bots, searchQuery, statusFilter]);

  const filteredPublicBots = useMemo(() => {
    if (!publicBots || !Array.isArray(publicBots)) {
      return [];
    }
    
    return publicBots.filter(bot => {
      // Safety check - ensure bot and required properties exist
      if (!bot || !bot.name || !bot.id || !bot.strategy || !bot.status) {
        return false;
      }

      const matchesSearch = bot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bot.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        getStrategyDisplayName(bot.strategy).toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || bot.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [publicBots, searchQuery, statusFilter]);

  const handleStart = async (id: string) => {
    try {
      const bot = bots.find(b => b.id === id);
      if (!bot) {
        showError('Bot not found');
        return;
      }
      const updatedBot = await startBot(bot, 'User started via main page');
      if (updatedBot) {
        showSuccess('Bot started successfully');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError('Failed to start bot', errorMessage);
    }
  };

  const handlePause = async (id: string) => {
    try {
      const bot = bots.find(b => b.id === id);
      if (!bot) {
        showError('Bot not found');
        return;
      }
      const updatedBot = await pauseBot(bot, 'User paused via main page');
      if (updatedBot) {
        showSuccess('Bot paused successfully');
      }
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

  // Authentication guard - require wallet connection
  if (!walletState.connected) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Connect Your Wallet</h2>
          <p className="text-muted-foreground mb-6">
            Connect your wallet to view and manage your bots. Your bots are tied to your wallet address for security.
          </p>
          <Button 
            onClick={connectWallet} 
            disabled={isConnecting}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isConnecting ? (
              <>
                <div className="w-4 h-4 animate-spin rounded-full border-2 border-white/20 border-t-white mr-2" />
                Connecting...
              </>
            ) : (
              <>
                <Wallet className="w-4 h-4 mr-2" />
                Connect Wallet
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-foreground">My Bots</h1>
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
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
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

      {/* My Bots Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">My Bots</h2>
        {filteredBots.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
              <Bot className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {searchQuery || statusFilter !== 'all'
                ? 'No bots match your filters'
                : 'No bots created yet'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || statusFilter !== 'all'
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
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 4xl:grid-cols-7 gap-4' : 'space-y-4'}>
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

      {/* All Bots Section */}
      <div className="space-y-4 mt-12">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">All Bots</h2>
          <div className="text-sm text-muted-foreground">
            {publicStats?.totalBots || 0} bots from {publicStats?.totalUsers || 0} users
          </div>
        </div>
        
        {publicLoading ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <Bot className="w-6 h-6 text-blue-400 animate-pulse" />
            </div>
            <p className="text-muted-foreground">Loading community bots...</p>
          </div>
        ) : filteredPublicBots.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
              <Bot className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No public bots match your filters</h3>
            <p className="text-muted-foreground">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 4xl:grid-cols-7 gap-4' : 'space-y-4'}>
            {filteredPublicBots.slice(0, 20).map((bot) => (
              <div key={`public-${bot.id}`} className="relative">
                {/* Read-only version of BotCard for public bots */}
                <div className="bg-card rounded-lg border-2 border-border/20 hover:bg-card/90 transition-all duration-200 shadow-lg hover:shadow-xl group overflow-hidden opacity-75" style={{ aspectRatio: viewMode === 'grid' ? '5/7' : 'auto' }}>
                  {viewMode === 'grid' ? (
                    // Grid view for public bots
                    <div className="h-full grid grid-rows-[auto_1fr_auto] gap-2 p-2">
                      <div className="flex items-center justify-between px-1">
                        <h3 className="text-sm font-bold text-card-foreground truncate">{bot.name}</h3>
                        <div className={`w-2 h-2 rounded-full ${
                          bot.status === 'active' ? 'bg-green-400 animate-pulse' :
                          bot.status === 'paused' ? 'bg-yellow-400' :
                          bot.status === 'error' ? 'bg-red-400' :
                          bot.status === 'setup' ? 'bg-blue-400' :
                          'bg-gray-400'
                        }`} />
                      </div>
                      
                      <div className="flex flex-col min-h-0 overflow-hidden">
                        <div className="bg-gradient-to-br from-muted/50 to-muted/30 border border-border/10 overflow-hidden rounded-md flex-1 max-h-[60%]">
                          <div className="w-full h-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center">
                            <BotAvatar bot={bot} size="xl" className="w-full h-full object-cover" />
                          </div>
                        </div>
                        
                        <div className="bg-card/50 mt-2 flex-1 flex flex-col relative min-h-0">
                          <p className="text-xs text-muted-foreground tracking-wider mb-3 text-center relative z-10">
                            {getStrategyDisplayName(bot.strategy)}
                          </p>
                          <div className="text-xs text-center text-muted-foreground">
                            by {truncateAddress(bot.ownerId)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="border-t border-border/50 pt-2 text-center">
                        <div className="text-xs text-muted-foreground">Public Bot</div>
                      </div>
                    </div>
                  ) : (
                    // List view for public bots
                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        <BotAvatar bot={bot} size="md" />
                        <div className="flex-1">
                          <h3 className="font-medium text-card-foreground">{bot.name}</h3>
                          <p className="text-sm text-muted-foreground">{getStrategyDisplayName(bot.strategy)}</p>
                          <p className="text-xs text-muted-foreground">by {truncateAddress(bot.ownerId)}</p>
                        </div>
                        <Badge className={statusColors[bot.status]}>
                          {statusIcons[bot.status]}
                          <span className="ml-1 capitalize">{bot.status}</span>
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {filteredPublicBots.length > 20 && (
          <div className="text-center pt-4">
            <p className="text-sm text-muted-foreground">
              Showing first 20 of {filteredPublicBots.length} public bots
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
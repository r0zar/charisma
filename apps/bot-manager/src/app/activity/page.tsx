'use client';

import React, { useState, useMemo } from 'react';
import {
  Activity,
  Clock,
  Bot,
  Search,
  Filter,
  Calendar,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Pause,
  Play,
  Settings,
  Trash2,
  ExternalLink,
  Copy,
  Download,
  RefreshCw,
  Eye,
  Plus,
  Minus,
  Gift
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBots } from '@/contexts/bot-context';
import { cn, formatCurrency, formatRelativeTime, truncateAddress } from '@/lib/utils';

const activityTypes = {
  trade: { icon: TrendingUp, label: 'Trade', color: 'text-blue-400' },
  swap: { icon: RefreshCw, label: 'Swap', color: 'text-green-400' },
  add_liquidity: { icon: Plus, label: 'Add Liquidity', color: 'text-purple-400' },
  remove_liquidity: { icon: Minus, label: 'Remove Liquidity', color: 'text-orange-400' },
  claim_rewards: { icon: Gift, label: 'Claim Rewards', color: 'text-yellow-400' },
  status_change: { icon: Settings, label: 'Status Change', color: 'text-muted-foreground' },
  error: { icon: AlertTriangle, label: 'Error', color: 'text-red-400' }
};

// Activity types mapping for BotActivity to display format
const activityTypeMapping = {
  'yield-farming': 'trade',
  'deposit': 'add_liquidity', 
  'withdrawal': 'remove_liquidity',
  'trade': 'swap',
  'error': 'error'
} as const;

const statusColors = {
  success: 'bg-green-500/20 text-green-400 border-green-500/30',
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  error: 'bg-red-500/20 text-red-400 border-red-500/30'
};

const statusIcons = {
  success: <CheckCircle className="w-3 h-3" />,
  pending: <Clock className="w-3 h-3" />,
  error: <XCircle className="w-3 h-3" />
};

export default function ActivityPage() {
  const { bots, activities } = useBots();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [botFilter, setBotFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');

  // Transform BotActivity to display format
  const transformedActivities = useMemo(() => {
    return activities.map(activity => {
      const bot = bots.find(b => b.id === activity.botId);
      const displayType = activityTypeMapping[activity.type] || activity.type;
      
      return {
        id: activity.id,
        type: displayType,
        botId: activity.botId,
        botName: bot?.name || 'Unknown Bot',
        description: activity.description,
        amount: activity.amount || 0,
        token: activity.token || '',
        status: activity.status === 'failed' ? 'error' : activity.status,
        timestamp: new Date(activity.timestamp).getTime(),
        txHash: activity.txid || '',
        gasUsed: 0, // Not in BotActivity type
        details: activity.error || activity.description
      };
    });
  }, [activities, bots]);

  const filteredActivity = useMemo(() => {
    return transformedActivities.filter(activity => {
      const matchesSearch = activity.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        activity.botName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (activity.txHash && activity.txHash.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesType = typeFilter === 'all' || activity.type === typeFilter;
      const matchesStatus = statusFilter === 'all' || activity.status === statusFilter;
      const matchesBot = botFilter === 'all' || activity.botId === botFilter;

      let matchesTime = true;
      if (timeFilter !== 'all') {
        const now = Date.now();
        const activityTime = activity.timestamp;
        switch (timeFilter) {
          case '1h':
            matchesTime = now - activityTime <= 3600000;
            break;
          case '24h':
            matchesTime = now - activityTime <= 86400000;
            break;
          case '7d':
            matchesTime = now - activityTime <= 604800000;
            break;
          case '30d':
            matchesTime = now - activityTime <= 2592000000;
            break;
        }
      }

      return matchesSearch && matchesType && matchesStatus && matchesBot && matchesTime;
    });
  }, [transformedActivities, searchQuery, typeFilter, statusFilter, botFilter, timeFilter]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const openInExplorer = (hash: string) => {
    if (hash) {
      window.open(`https://explorer.stacks.co/txid/${hash}`, '_blank');
    }
  };

  const getActivityIcon = (type: string) => {
    const activityType = activityTypes[type as keyof typeof activityTypes];
    if (!activityType) return Activity;
    return activityType.icon;
  };

  const getActivityColor = (type: string) => {
    const activityType = activityTypes[type as keyof typeof activityTypes];
    if (!activityType) return 'text-muted-foreground';
    return activityType.color;
  };

  const getActivityLabel = (type: string) => {
    const activityType = activityTypes[type as keyof typeof activityTypes];
    if (!activityType) return 'Activity';
    return activityType.label;
  };

  const stats = useMemo(() => {
    const successful = filteredActivity.filter(a => a.status === 'success').length;
    const pending = filteredActivity.filter(a => a.status === 'pending').length;
    const errors = filteredActivity.filter(a => a.status === 'error').length;
    const totalValue = filteredActivity
      .filter(a => a.status === 'success' && a.amount > 0)
      .reduce((sum, a) => sum + a.amount, 0);

    return { successful, pending, errors, totalValue };
  }, [filteredActivity]);

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Activity & History</h1>
          <p className="text-muted-foreground">Real-time transaction monitoring and bot activity logs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-border text-foreground hover:bg-accent hover:text-accent-foreground">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" className="border-border text-foreground hover:bg-accent hover:text-accent-foreground">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Activities</p>
                <p className="text-2xl font-bold text-card-foreground">{filteredActivity.length}</p>
              </div>
              <Activity className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Successful</p>
                <p className="text-2xl font-bold text-green-400">{stats.successful}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold text-card-foreground">{formatCurrency(stats.totalValue)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search activities, bots, or transaction hashes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-input border-border text-foreground"
              />
            </div>

            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-32 bg-input border-border text-foreground">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="trade">Trades</SelectItem>
                  <SelectItem value="swap">Swaps</SelectItem>
                  <SelectItem value="add_liquidity">Add Liquidity</SelectItem>
                  <SelectItem value="remove_liquidity">Remove Liquidity</SelectItem>
                  <SelectItem value="claim_rewards">Claim Rewards</SelectItem>
                  <SelectItem value="status_change">Status Changes</SelectItem>
                  <SelectItem value="error">Errors</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 bg-input border-border text-foreground">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>

              <Select value={botFilter} onValueChange={setBotFilter}>
                <SelectTrigger className="w-40 bg-input border-border text-foreground">
                  <SelectValue placeholder="Bot" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="all">All Bots</SelectItem>
                  {bots.map((bot) => (
                    <SelectItem key={bot.id} value={bot.id}>
                      {bot.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger className="w-32 bg-input border-border text-foreground">
                  <SelectValue placeholder="Time" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="1h">Last Hour</SelectItem>
                  <SelectItem value="24h">Last 24h</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity List */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredActivity.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No activities found</h3>
              <p className="text-muted-foreground">Try adjusting your filters or search terms</p>
            </div>
          ) : (
            // dividing line between each activity
            <div className="space-y-3">
              {filteredActivity.map((activity) => {
                const IconComponent = getActivityIcon(activity.type);
                return (
                  <div key={activity.id} className="flex items-center justify-between p-4 border border-border/25 bg-card/50 rounded-lg hover:bg-border/10 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full bg-muted flex items-center justify-center`}>
                        <IconComponent className={`w-5 h-5 ${getActivityColor(activity.type)}`} />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-card-foreground">{getActivityLabel(activity.type)}</span>
                          <Badge className={`${statusColors[activity.status as keyof typeof statusColors]} text-xs`}>
                            {statusIcons[activity.status as keyof typeof statusIcons]}
                            <span className="ml-1 capitalize">{activity.status}</span>
                          </Badge>
                        </div>

                        <div className="text-sm text-muted-foreground mb-1">{activity.description}</div>
                        <div className="text-xs text-muted-foreground/70">{activity.details}</div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                          <span>Bot: {activity.botName}</span>
                          <span>{formatRelativeTime(new Date(activity.timestamp).toISOString())}</span>
                          {activity.gasUsed > 0 && <span>Gas: {activity.gasUsed.toLocaleString()}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      {activity.amount > 0 && (
                        <div className="font-medium text-card-foreground mb-1">
                          {formatCurrency(activity.amount)} {activity.token}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        {activity.txHash && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(activity.txHash)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openInExplorer(activity.txHash)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
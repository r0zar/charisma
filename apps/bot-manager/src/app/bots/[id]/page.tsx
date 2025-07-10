'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Bot,
  ArrowLeft,
  Play,
  Pause,
  Settings,
  Trash2,
  Wallet,
  Copy,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Fuel,
  Zap,
  DollarSign,
  PieChart,
  LineChart,
  Calendar,
  Filter,
  Download,
  Upload,
  Eye,
  EyeOff,
  Shield,
  Info,
  Plus,
  Minus,
  ArrowUpDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useBots } from '@/contexts/bot-context';
import { useNotifications } from '@/contexts/notification-context';
import { useGlobalState } from '@/contexts/global-state-context';
import { useWallet } from '@/contexts/wallet-context';
import { formatCurrency, formatRelativeTime, truncateAddress } from '@/lib/utils';
import { getStrategyDisplayName, parseStrategyCode, type StrategyMetadata } from '@/lib/strategy-parser';
import { StrategyCodeEditor } from '@/components/strategy-code-editor';
import { Bot as BotType } from '@/types/bot';
import { BotAvatar } from '@/components/ui/bot-avatar';
import Link from 'next/link';
import { sandboxClient } from '@/lib/sandbox-client';
import type { SandboxStreamEvent } from '@/lib/sandbox-client';

const statusColors = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
  setup: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  inactive: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
};

const statusIcons = {
  active: <CheckCircle className="w-4 h-4" />,
  paused: <Pause className="w-4 h-4" />,
  error: <AlertTriangle className="w-4 h-4" />,
  setup: <Clock className="w-4 h-4" />,
  inactive: <Clock className="w-4 h-4" />
};

// Transform BotActivity to transaction format for display
const transformActivityToTransaction = (activity: any) => ({
  id: activity.id,
  type: activity.type,
  amount: activity.amount || 0,
  from: activity.token || 'STX',
  to: activity.type === 'withdrawal' ? 'Wallet' : activity.type === 'deposit' ? 'Bot' : 'Pool',
  status: activity.status === 'failed' ? 'error' : activity.status,
  timestamp: new Date(activity.timestamp).getTime(),
  txHash: activity.txid || ''
});

// Get the appropriate icon for activity type
const getActivityIcon = (type: string) => {
  switch (type) {
    case 'deposit':
      return Plus;
    case 'withdrawal':
      return Minus;
    case 'trade':
      return ArrowUpDown;
    case 'yield-farming':
      return TrendingUp;
    case 'error':
      return AlertTriangle;
    default:
      return Activity;
  }
};

// Get the appropriate color for activity type
const getActivityColor = (type: string) => {
  switch (type) {
    case 'deposit':
      return 'text-green-400';
    case 'withdrawal':
      return 'text-orange-400';
    case 'trade':
      return 'text-blue-400';
    case 'yield-farming':
      return 'text-purple-400';
    case 'error':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
};

// Get the appropriate background color for activity type
const getActivityBgColor = (type: string) => {
  switch (type) {
    case 'deposit':
      return 'bg-green-500/20';
    case 'withdrawal':
      return 'bg-orange-500/20';
    case 'trade':
      return 'bg-blue-500/20';
    case 'yield-farming':
      return 'bg-purple-500/20';
    case 'error':
      return 'bg-red-500/20';
    default:
      return 'bg-gray-500/20';
  }
};

export default function BotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { bots, activities, loading, startBot, pauseBot, deleteBot } = useBots();
  const { showSuccess, showError } = useNotifications();
  const { appState } = useGlobalState();
  const { getUserId, authenticatedFetchWithTimestamp } = useWallet();

  // Add mounted state to prevent hydration issues
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);
  const [bot, setBot] = useState<BotType | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<Array<{ type: string, level?: string, message: string, timestamp: string }>>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [schedulingSettings, setSchedulingSettings] = useState({
    cronSchedule: '',
    isScheduled: false
  });
  const [executionHistory, setExecutionHistory] = useState<Array<{
    id: string;
    startedAt: string;
    completedAt?: string;
    status: 'pending' | 'success' | 'failure' | 'timeout';
    output?: string;
    error?: string;
    executionTime?: number;
    transactionId?: string;
  }>>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Get bot activities
  const botActivities = useMemo(() => {
    if (!bot) return [];
    // Get activities for this specific bot from both global activities and bot's recentActivity
    const globalBotActivities = activities.filter(activity => activity.botId === bot.id);
    const recentActivities = bot.recentActivity || [];

    // Combine and deduplicate by id
    const allActivities = [...globalBotActivities, ...recentActivities];
    const uniqueActivities = allActivities.filter((activity, index, self) =>
      index === self.findIndex(a => a.id === activity.id)
    );

    return uniqueActivities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10) // Show last 10 activities
      .map(transformActivityToTransaction);
  }, [bot, activities]);

  // Note: Analytics/stats are now handled by separate analytics service
  // Bot schema only contains core bot properties

  useEffect(() => {
    if (bots.length > 0) {
      const foundBot = bots.find(b => b.id === params.id);
      if (foundBot) {
        setBot(foundBot);
        // Sync scheduling settings
        setSchedulingSettings({
          cronSchedule: foundBot.cronSchedule || '',
          isScheduled: foundBot.isScheduled || false
        });
        // Fetch execution history
        fetchExecutionHistory(foundBot.id);
      } else {
        router.push('/bots');
      }
    }
  }, [bots, params.id, router]);

  const handleStart = async () => {
    if (!bot) return;
    try {
      await startBot(bot.id);
      showSuccess('Bot started successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError('Failed to start bot', errorMessage);
    }
  };

  const handlePause = async () => {
    if (!bot) return;
    try {
      await pauseBot(bot.id);
      showSuccess('Bot paused successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError('Failed to pause bot', errorMessage);
    }
  };

  const handleDelete = async () => {
    if (!bot) return;
    try {
      await deleteBot(bot.id);
      showSuccess('Bot deleted successfully');
      router.push('/bots');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError('Failed to delete bot', errorMessage);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate API call
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const fetchExecutionHistory = async (botId: string) => {
    setLoadingHistory(true);
    try {
      const userId = getUserId();
      const response = await fetch(`/api/v1/bots/${botId}/executions?userId=${encodeURIComponent(userId)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch execution history');
      }
      const data = await response.json();
      setExecutionHistory(data.executions || []);
    } catch (error) {
      console.error('Error fetching execution history:', error);
      showError('Failed to load execution history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSaveScheduling = async () => {
    if (!bot) return;

    try {
      const userId = getUserId();
      const message = `update_schedule_${bot.id}`;

      const response = await authenticatedFetchWithTimestamp(`/api/v1/bots/${bot.id}/schedule?userId=${encodeURIComponent(userId)}&default=true`, {
        method: 'PUT',
        message,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cronSchedule: schedulingSettings.cronSchedule,
          isScheduled: schedulingSettings.isScheduled,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update scheduling settings');
      }

      const updatedBot = await response.json();
      setBot(updatedBot);
      showSuccess('Scheduling settings saved successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showError('Failed to save scheduling settings', errorMessage);
      console.error('Error saving scheduling settings:', error);
    }
  };

  const handleTestStrategy = async (code: string) => {
    if (!bot) return;

    setIsExecuting(true);
    setExecutionLogs([]);

    try {
      showSuccess('Testing strategy in sandbox...', 'This may take a moment');

      await sandboxClient.executeStrategyWithStreaming(
        bot.id,
        code,
        (event: SandboxStreamEvent) => {
          // Add log entry for display
          setExecutionLogs(prev => [...prev, {
            type: event.type,
            level: event.level,
            message: event.message || (event.type === 'error' ? event.error : '') || '',
            timestamp: event.timestamp
          }]);

          // Handle specific event types
          if (event.type === 'result') {
            if (event.success) {
              showSuccess('Strategy test completed successfully!',
                `Execution time: ${event.executionTime}ms`
              );
            } else {
              showError('Strategy test failed', event.error || 'Unknown error');
            }
          } else if (event.type === 'error') {
            showError('Strategy execution error', event.error || 'Unknown error');
          } else if (event.type === 'done') {
            setIsExecuting(false);
          }
        },
        {
          testMode: true,
          timeout: 2, // 2 minutes
          enableLogs: true
        }
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showError('Failed to test strategy', errorMessage);
      console.error('Strategy test exception:', error);
      setIsExecuting(false);
    }
  };


  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => showSuccess('Copied to clipboard'))
      .catch(() => showError('Failed to copy to clipboard'));
  };

  const openInExplorer = (address: string) => {
    window.open(`https://explorer.stacks.co/address/${address}`, '_blank');
  };

  if (!mounted || loading || !bot) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bot className="w-8 h-8 text-blue-400 animate-pulse" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Loading Bot Details...</h2>
          <p className="text-muted-foreground">Fetching bot configuration and status</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon" className="text-foreground">
            <Link href="/bots">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <BotAvatar bot={bot} size="lg" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">{bot.name}</h1>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{getStrategyDisplayName(bot.strategy)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="border-border text-foreground"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {bot.status === 'active' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePause}
              className="border-yellow-600 text-yellow-400 hover:bg-yellow-500/10"
            >
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStart}
              className="border-green-600 text-green-400 hover:bg-green-500/10"
            >
              <Play className="w-4 h-4 mr-2" />
              Start
            </Button>
          )}


          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            className="border-red-600 text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Daily P&L</p>
                <p className="text-lg font-semibold text-gray-400">
                  --
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Trades</p>
                <p className="text-lg font-semibold text-card-foreground">--</p>
              </div>
              <Activity className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-lg font-semibold text-card-foreground">--%</p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">STX Balance</p>
                <p className="text-lg font-semibold text-card-foreground">--</p>
              </div>
              <Wallet className="w-8 h-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6 bg-card border-border">
          <TabsTrigger value="overview" className="text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">Overview</TabsTrigger>
          <TabsTrigger value="strategy" className="text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">Strategy</TabsTrigger>
          <TabsTrigger value="scheduling" className="text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">Scheduling</TabsTrigger>
          <TabsTrigger value="wallet" className="text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">Wallet</TabsTrigger>
          <TabsTrigger value="activity" className="text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">Activity</TabsTrigger>
          <TabsTrigger value="analytics" className="text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bot Status */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-card-foreground">Bot Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Current Status</span>
                  <Badge className={`${statusColors[bot.status]}`}>
                    {statusIcons[bot.status]}
                    <span className="ml-1 capitalize">{bot.status}</span>
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Strategy</span>
                  <span className="text-card-foreground">{getStrategyDisplayName(bot.strategy)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last Active</span>
                  <span className="text-card-foreground">{formatRelativeTime(bot.lastActive)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="text-card-foreground">{formatRelativeTime(bot.createdAt)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Scheduling</span>
                  <Badge className={bot.isScheduled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
                    {bot.isScheduled ? 'Auto' : 'Manual'}
                  </Badge>
                </div>

                {bot.isScheduled && bot.nextExecution && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Next Run</span>
                    <span className="text-card-foreground">{formatRelativeTime(bot.nextExecution)}</span>
                  </div>
                )}

              </CardContent>
            </Card>

            {/* Performance Summary */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-card-foreground">Performance Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground">Total P&L</div>
                    <div className="font-semibold text-gray-400">
                      --
                    </div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground">Total Volume</div>
                    <div className="font-semibold text-card-foreground">--</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground">Success Rate</div>
                    <div className="font-semibold text-card-foreground">--%</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground">Avg Trade Size</div>
                    <div className="font-semibold text-card-foreground">
                      --
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {botActivities.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No recent activity
                  </div>
                ) : (
                  botActivities.slice(0, 3).map((tx) => {
                    const IconComponent = getActivityIcon(tx.type);
                    return (
                      <div key={tx.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${getActivityBgColor(tx.type)} flex items-center justify-center`}>
                            <IconComponent className={`w-4 h-4 ${getActivityColor(tx.type)}`} />
                          </div>
                          <div>
                            <div className="font-medium text-card-foreground capitalize">{tx.type.replace('_', ' ')}</div>
                            <div className="text-sm text-muted-foreground">
                              {tx.from} → {tx.to}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-card-foreground">{formatCurrency(tx.amount)}</div>
                          <div className="text-sm text-muted-foreground">{formatRelativeTime(new Date(tx.timestamp).toISOString())}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="strategy" className="space-y-4">
          <Card className="bg-card border-border">
            <CardContent>
              <StrategyCodeEditor
                initialCode={bot.strategy}
                onSave={async (code) => {
                  // Update the bot's strategy code
                  setBot({ ...bot, strategy: code });
                  showSuccess('Strategy code saved successfully');
                }}
                onTest={handleTestStrategy}
                height="400px"
              />
            </CardContent>
          </Card>

          {/* Execution Logs */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Execution Logs
                {isExecuting && (
                  <Badge variant="outline" className="ml-auto border-blue-500/30 text-blue-400">
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    Executing
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm">
                {executionLogs.length === 0 ? (
                  <div className="text-muted-foreground text-center py-8">
                    No execution logs yet. Click "Test Strategy" to see real-time logs.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {executionLogs.map((log, index) => (
                      <div
                        key={index}
                        className={`flex items-start gap-2 text-xs ${log.type === 'error' || log.level === 'error'
                          ? 'text-red-400'
                          : log.type === 'status'
                            ? 'text-blue-400'
                            : log.level === 'warn'
                              ? 'text-yellow-400'
                              : 'text-foreground'
                          }`}
                      >
                        <span className="text-muted-foreground shrink-0 w-24">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="shrink-0 w-12 uppercase text-xs font-semibold">
                          {log.type}
                        </span>
                        <span className="break-all">{log.message || ''}</span>
                      </div>
                    ))}
                  </div>
                )}
                {isExecuting && executionLogs.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-blue-400 mt-2">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Streaming logs...</span>
                  </div>
                )}
              </div>
              {executionLogs.length > 0 && (
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-muted-foreground">
                    {executionLogs.length} log entries
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExecutionLogs([])}
                    className="text-xs"
                  >
                    Clear Logs
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduling" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Scheduling Configuration */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-card-foreground flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Scheduling Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-card-foreground font-medium">Enable Automatic Execution</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow this bot to execute automatically based on the cron schedule
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="enable-scheduling"
                      checked={schedulingSettings.isScheduled}
                      onChange={(e) => setSchedulingSettings(prev => ({ ...prev, isScheduled: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <Label htmlFor="enable-scheduling" className="text-sm font-medium">
                      {schedulingSettings.isScheduled ? 'Enabled' : 'Disabled'}
                    </Label>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-card-foreground">Cron Schedule</Label>
                  <Select
                    value={schedulingSettings.cronSchedule}
                    onValueChange={(value) => setSchedulingSettings(prev => ({ ...prev, cronSchedule: value }))}
                  >
                    <SelectTrigger className="bg-input border-border text-foreground">
                      <SelectValue placeholder="Select execution frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="*/5 * * * *">Every 5 minutes</SelectItem>
                      <SelectItem value="*/15 * * * *">Every 15 minutes</SelectItem>
                      <SelectItem value="*/30 * * * *">Every 30 minutes</SelectItem>
                      <SelectItem value="0 * * * *">Every hour</SelectItem>
                      <SelectItem value="0 */6 * * *">Every 6 hours</SelectItem>
                      <SelectItem value="0 0 * * *">Daily at midnight</SelectItem>
                      <SelectItem value="0 0 * * 1">Weekly (Mondays at midnight)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose how often the bot should execute its strategy
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-card-foreground">Custom Cron Expression</Label>
                  <Input
                    placeholder="0 */4 * * * (every 4 hours)"
                    value={schedulingSettings.cronSchedule}
                    onChange={(e) => setSchedulingSettings(prev => ({ ...prev, cronSchedule: e.target.value }))}
                    className="bg-input border-border text-foreground font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Advanced: Enter a custom cron expression (min hour day month weekday)
                  </p>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleSaveScheduling}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={!schedulingSettings.cronSchedule}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Save Schedule
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSchedulingSettings({ cronSchedule: '', isScheduled: false });
                    }}
                    className="border-border text-foreground"
                  >
                    Reset
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      if (!bot) return;
                      try {
                        showSuccess('Triggering manual execution...', 'This may take a moment');
                        // Manual execution trigger would call the sandbox service
                        // For now, just refresh the execution history
                        await fetchExecutionHistory(bot.id);
                      } catch (error) {
                        showError('Failed to trigger manual execution');
                      }
                    }}
                    className="border-green-600 text-green-400 hover:bg-green-500/10"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Execute Now
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Scheduling Status */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-card-foreground flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Scheduling Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm text-muted-foreground">Current Status</span>
                    <Badge className={bot?.isScheduled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
                      {bot?.isScheduled ? 'Scheduled' : 'Manual Only'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm text-muted-foreground">Cron Expression</span>
                    <span className="text-sm font-mono text-card-foreground">
                      {bot?.cronSchedule || 'Not set'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm text-muted-foreground">Last Execution</span>
                    <span className="text-sm text-card-foreground">
                      {bot?.lastExecution ? formatRelativeTime(bot.lastExecution) : 'Never'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm text-muted-foreground">Next Execution</span>
                    <span className="text-sm text-card-foreground">
                      {bot?.nextExecution ? formatRelativeTime(bot.nextExecution) : 'Not scheduled'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm text-muted-foreground">Total Executions</span>
                    <span className="text-sm font-semibold text-card-foreground">
                      {bot?.executionCount || 0}
                    </span>
                  </div>
                </div>

                {bot?.isScheduled && (
                  <Alert className="bg-blue-500/10 border-blue-500/30">
                    <Info className="w-4 h-4 text-blue-400" />
                    <AlertDescription className="text-blue-300">
                      This bot is configured for automatic execution. It will run based on the cron schedule.
                    </AlertDescription>
                  </Alert>
                )}

                {!bot?.isScheduled && (
                  <Alert className="bg-yellow-500/10 border-yellow-500/30">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    <AlertDescription className="text-yellow-300">
                      Automatic execution is disabled. The bot will only run when manually triggered.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Execution History */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Execution History
                <Badge variant="outline" className="ml-auto">
                  Last 20 executions
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => bot && fetchExecutionHistory(bot.id)}
                  disabled={loadingHistory}
                  className="h-8 w-8 p-0"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {loadingHistory ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="w-16 h-16 mx-auto mb-4 opacity-50 animate-spin" />
                    <h3 className="text-lg font-semibold mb-2">Loading execution history...</h3>
                  </div>
                ) : executionHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">No execution history</h3>
                    <p>This bot hasn't been executed yet through the scheduler.</p>
                  </div>
                ) : (
                  executionHistory.map((execution) => {
                    const duration = execution.executionTime ? `${execution.executionTime}ms` : 'N/A';
                    const statusColor = execution.status === 'success'
                      ? 'bg-green-500/20 text-green-400'
                      : execution.status === 'failure'
                        ? 'bg-red-500/20 text-red-400'
                        : execution.status === 'timeout'
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-blue-500/20 text-blue-400';

                    const statusIcon = execution.status === 'success'
                      ? <CheckCircle className="w-4 h-4" />
                      : execution.status === 'failure'
                        ? <AlertTriangle className="w-4 h-4" />
                        : execution.status === 'timeout'
                          ? <Clock className="w-4 h-4" />
                          : <RefreshCw className="w-4 h-4" />;

                    return (
                      <div key={execution.id} className="p-4 bg-muted rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full ${statusColor} flex items-center justify-center`}>
                              {statusIcon}
                            </div>
                            <div>
                              <div className="font-medium text-card-foreground">
                                Execution #{execution.id.split('-').pop()}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {formatRelativeTime(execution.startedAt)}
                              </div>
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <Badge className={statusColor}>
                              {execution.status}
                            </Badge>
                            <div className="text-xs text-muted-foreground">
                              Duration: {duration}
                            </div>
                          </div>
                        </div>

                        {execution.output && (
                          <div className="bg-background/50 p-3 rounded border-l-4 border-green-500">
                            <div className="text-xs text-muted-foreground mb-1">Output:</div>
                            <div className="text-sm text-card-foreground">{execution.output}</div>
                          </div>
                        )}

                        {execution.error && (
                          <div className="bg-background/50 p-3 rounded border-l-4 border-red-500">
                            <div className="text-xs text-muted-foreground mb-1">Error:</div>
                            <div className="text-sm text-red-400">{execution.error}</div>
                          </div>
                        )}

                        {execution.transactionId && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">Transaction:</span>
                            <button
                              onClick={() => copyToClipboard(execution.transactionId!)}
                              className="text-blue-400 hover:text-blue-300 font-mono"
                            >
                              {execution.transactionId.slice(0, 16)}...
                            </button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(`https://explorer.stacks.co/txid/${execution.transactionId}`, '_blank')}
                              className="h-6 w-6 p-0"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wallet" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground">Wallet Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-card-foreground">Wallet Address</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={bot.walletAddress}
                      disabled
                      className="bg-input border-border text-foreground"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(bot.walletAddress)}
                      className="border-border text-foreground"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openInExplorer(bot.walletAddress)}
                      className="border-border text-foreground"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-card-foreground">Private Key</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type={showPrivateKey ? 'text' : 'password'}
                      value={showPrivateKey ? 'SP1234567890ABCDEF1234567890ABCDEF123456789' : '••••••••••••••••••••••••••••••••••••••••••'}
                      disabled
                      className="bg-input border-border text-foreground"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPrivateKey(!showPrivateKey)}
                      className="border-border text-foreground"
                    >
                      {showPrivateKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <Alert className="bg-yellow-500/10 border-yellow-500/30">
                <Shield className="w-4 h-4 text-yellow-400" />
                <AlertDescription className="text-yellow-300">
                  Keep your private key secure. Never share it with anyone or store it in unsecured locations.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">STX Balance</div>
                  <div className="text-lg font-semibold text-card-foreground">{bot?.stxBalance?.toFixed(2) || '0.00'} STX</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">LP Tokens</div>
                  <div className="text-lg font-semibold text-card-foreground">{bot?.lpTokenBalances?.length || 0}</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">Total Value</div>
                  <div className="text-lg font-semibold text-card-foreground">
                    {formatCurrency(
                      (bot?.stxBalance || 0) +
                      (bot?.lpTokenBalances?.reduce((sum, token) => sum + (token.usdValue || 0), 0) || 0) +
                      (bot?.rewardTokenBalances?.reduce((sum, token) => sum + (token.usdValue || 0), 0) || 0)
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground">Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {botActivities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">No transaction history</h3>
                    <p>This bot hasn't performed any transactions yet.</p>
                  </div>
                ) : (
                  botActivities.map((tx) => {
                    const IconComponent = getActivityIcon(tx.type);
                    return (
                      <div key={tx.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full ${getActivityBgColor(tx.type)} flex items-center justify-center`}>
                            <IconComponent className={`w-5 h-5 ${getActivityColor(tx.type)}`} />
                          </div>
                          <div>
                            <div className="font-medium text-card-foreground capitalize">{tx.type.replace('_', ' ')}</div>
                            <div className="text-sm text-muted-foreground">{tx.from} → {tx.to}</div>
                            <div className="text-xs text-muted-foreground/70">{formatRelativeTime(new Date(tx.timestamp).toISOString())}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-card-foreground">{formatCurrency(tx.amount)}</div>
                          <Badge className={tx.status === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}>
                            {tx.status}
                          </Badge>
                          <div className="text-xs text-muted-foreground mt-1">
                            <button
                              onClick={() => copyToClipboard(tx.txHash)}
                              className="hover:text-card-foreground"
                            >
                              {truncateAddress(tx.txHash)}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-card-foreground">Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <LineChart className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                  <p className="text-muted-foreground">Performance charts coming soon</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-card-foreground">Trade Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <PieChart className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                  <p className="text-muted-foreground">Trade distribution charts coming soon</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
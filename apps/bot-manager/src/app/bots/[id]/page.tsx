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
  Edit,
  Save,
  X,
  Plus,
  Minus,
  ArrowUpDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  const [bot, setBot] = useState<BotType | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<BotType>>({});
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  useEffect(() => {
    if (bots.length > 0) {
      const foundBot = bots.find(b => b.id === params.id);
      if (foundBot) {
        setBot(foundBot);
        setEditData(foundBot);
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

  const handleSaveEdit = () => {
    if (bot && editData) {
      setBot({ ...bot, ...editData });
      setIsEditing(false);
      showSuccess('Settings saved successfully');
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

  if (loading || !bot) {
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
            <div className="w-12 h-12 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <Bot className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{bot.name}</h1>
              <div className="flex items-center gap-2">
                <Badge className={`${statusColors[bot.status]} text-sm`}>
                  {statusIcons[bot.status]}
                  <span className="ml-1 capitalize">{bot.status}</span>
                </Badge>
                <span className="text-sm text-muted-foreground capitalize">{bot.strategy}</span>
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
            onClick={() => setIsEditing(!isEditing)}
            className="border-blue-600 text-blue-400 hover:bg-blue-500/10"
          >
            {isEditing ? (
              <>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </>
            ) : (
              <>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </>
            )}
          </Button>

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
                <p className={`text-lg font-semibold ${bot.dailyPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {bot.dailyPnL >= 0 ? '+' : ''}{formatCurrency(bot.dailyPnL)}
                </p>
              </div>
              {bot.dailyPnL >= 0 ? (
                <TrendingUp className="w-8 h-8 text-green-400" />
              ) : (
                <TrendingDown className="w-8 h-8 text-red-400" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Trades</p>
                <p className="text-lg font-semibold text-card-foreground">0</p>
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
                <p className="text-lg font-semibold text-card-foreground">{bot.successRate.toFixed(1)}%</p>
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
                <p className="text-lg font-semibold text-card-foreground">{bot.stxBalance.toFixed(2)}</p>
              </div>
              <Wallet className="w-8 h-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 bg-card border-border">
          <TabsTrigger value="overview" className="text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">Overview</TabsTrigger>
          <TabsTrigger value="configuration" className="text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">Configuration</TabsTrigger>
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
                  <span className="text-card-foreground capitalize">{bot.strategy}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last Active</span>
                  <span className="text-card-foreground">{formatRelativeTime(bot.lastActive)}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="text-card-foreground">{formatRelativeTime(bot.createdAt)}</span>
                </div>

                {bot.status === 'setup' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Setup Progress</span>
                      <span className="text-card-foreground/80">{bot.setupProgress.completionPercentage}%</span>
                    </div>
                    <Progress value={bot.setupProgress.completionPercentage} className="h-2" />
                    <p className="text-sm text-muted-foreground">{bot.setupProgress.currentStep}</p>
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
                    <div className={`font-semibold ${bot.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {bot.totalPnL >= 0 ? '+' : ''}{formatCurrency(bot.totalPnL)}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground">Total Volume</div>
                    <div className="font-semibold text-card-foreground">{formatCurrency(bot.totalVolume)}</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground">Success Rate</div>
                    <div className="font-semibold text-card-foreground">{bot.successRate.toFixed(1)}%</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground">Avg Trade Size</div>
                    <div className="font-semibold text-card-foreground">
                      {formatCurrency(
                        botActivities.length > 0 
                          ? botActivities.reduce((sum, tx) => sum + (tx.amount || 0), 0) / botActivities.length
                          : 0
                      )}
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

        <TabsContent value="configuration" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground flex items-center justify-between">
                Bot Configuration
                {isEditing && (
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    className="bg-green-500 hover:bg-green-600"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name" className="text-card-foreground">Bot Name</Label>
                  <Input
                    id="name"
                    value={isEditing ? editData.name || '' : bot.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    disabled={!isEditing}
                    className="bg-input border-border text-foreground"
                  />
                </div>
                
                <div>
                  <Label htmlFor="strategy" className="text-card-foreground">Strategy</Label>
                  <Select 
                    value={isEditing ? editData.strategy || bot.strategy : bot.strategy}
                    onValueChange={(value) => setEditData({ ...editData, strategy: value as any })}
                    disabled={!isEditing}
                  >
                    <SelectTrigger className="bg-input border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="yield-farming">Yield Farming</SelectItem>
                      <SelectItem value="dca">Dollar Cost Averaging</SelectItem>
                      <SelectItem value="arbitrage">Arbitrage Trading</SelectItem>
                      <SelectItem value="liquidity-mining">Liquidity Mining</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="maxGasPrice" className="text-card-foreground">Max Gas Price (microSTX)</Label>
                  <Input
                    id="maxGasPrice"
                    type="number"
                    value={isEditing ? editData.maxGasPrice || bot.maxGasPrice : bot.maxGasPrice}
                    onChange={(e) => setEditData({ ...editData, maxGasPrice: parseInt(e.target.value) })}
                    disabled={!isEditing}
                    className="bg-input border-border text-foreground"
                  />
                </div>
                
                <div>
                  <Label htmlFor="slippageTolerance" className="text-card-foreground">Slippage Tolerance (%)</Label>
                  <Input
                    id="slippageTolerance"
                    type="number"
                    step="0.1"
                    value={isEditing ? editData.slippageTolerance || bot.slippageTolerance : bot.slippageTolerance}
                    onChange={(e) => setEditData({ ...editData, slippageTolerance: parseFloat(e.target.value) })}
                    disabled={!isEditing}
                    className="bg-input border-border text-foreground"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="autoRestart" className="text-card-foreground">Auto Restart</Label>
                  <p className="text-sm text-muted-foreground">Automatically restart bot if it encounters errors</p>
                </div>
                <Switch
                  id="autoRestart"
                  checked={isEditing ? editData.autoRestart ?? bot.autoRestart : bot.autoRestart}
                  onCheckedChange={(checked) => setEditData({ ...editData, autoRestart: checked })}
                  disabled={!isEditing}
                />
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
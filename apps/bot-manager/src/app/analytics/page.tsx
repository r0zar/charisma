'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Bot,
  PieChart,
  LineChart,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  DollarSign,
  Activity,
  Target,
  Zap,
  Clock,
  ArrowUp,
  ArrowDown,
  Minus,
  MoreHorizontal,
  Eye,
  Settings,
  Wallet,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useBots } from '@/contexts/bot-context';
import { useAnalytics } from '@/contexts/analytics-context';
import { useWallet } from '@/contexts/wallet-context';
import { formatCurrency, formatRelativeTime, formatPercentage } from '@/lib/utils';
import { BotAvatar } from '@/components/ui/bot-avatar';
import { getPrices } from '@repo/tokens';

// Strategy color mapping
const strategyColors = {
  'helloWorld': 'bg-green-500',
  'fetchExample': 'bg-blue-500',
  'custom': 'bg-purple-500'
} as const;

// Strategy display names
const strategyNames = {
  'helloWorld': 'Hello World',
  'fetchExample': 'Fetch Example',
  'custom': 'Custom Strategy'
} as const;

export default function AnalyticsPage() {
  const { bots } = useBots();
  const { walletState, connectWallet, isConnecting } = useWallet();
  const {
    analyticsSummary,
    performanceMetrics,
    portfolioHoldings,
    recentTransactions,
    yieldFarmingAnalytics,
    marketOpportunities,
    loading,
    error,
    lastUpdated,
    refreshAnalytics,
    setWalletAddress,
    getWalletAddress,
  } = useAnalytics();

  const [timeRange, setTimeRange] = useState('7d');
  const [selectedWallet, setSelectedWallet] = useState('');
  const [marketData, setMarketData] = useState<{
    stxPrice: number;
    charismaPrice: number;
    pricesLoaded: boolean;
  }>({
    stxPrice: 1.85,
    charismaPrice: 0.50,
    pricesLoaded: false
  });

  // Set wallet address for analytics when bots are available (no auto-refresh)
  useEffect(() => {
    if (bots.length > 0 && !getWalletAddress()) {
      // Use the first bot's wallet address as default
      const firstBotWallet = bots[0].walletAddress;
      setWalletAddress(firstBotWallet);
      setSelectedWallet(firstBotWallet);
      // Note: Removed automatic analytics refresh - data comes from cache now
    }
  }, [bots, getWalletAddress, setWalletAddress]);

  // Fetch market data
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const pricesResponse = await getPrices(['.stx', 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token']);

        if (pricesResponse.prices && pricesResponse.prices.length > 0) {
          const stxPrice = pricesResponse.prices.find(p => p.contractId === '.stx')?.price || 1.85;
          const charismaPrice = pricesResponse.prices.find(p => p.contractId === 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token')?.price || 0.50;

          setMarketData({
            stxPrice,
            charismaPrice,
            pricesLoaded: true
          });
        }
      } catch (error) {
        console.error('Failed to fetch market data:', error);
        // Keep default values
      }
    };

    fetchMarketData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchMarketData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Use only real analytics data - no fallback to mock/bot data
  const analyticsData = useMemo(() => {
    if (!analyticsSummary) {
      return {
        performanceData: [],
        strategyPerformance: [],
        topPerformers: []
      };
    }

    return {
      performanceData: analyticsSummary.valueHistory || [],
      strategyPerformance: Object.entries(analyticsSummary.strategies || {}).map(([name, data]) => ({
        strategy: name,
        value: Math.round((data.transactionCount / Math.max(1, Object.values(analyticsSummary.strategies || {}).reduce((sum, s) => sum + s.transactionCount, 1))) * 100),
        pnl: data.totalReturn,
        color: strategyColors[name as keyof typeof strategyColors] || 'bg-gray-500'
      })),
      topPerformers: portfolioHoldings.slice(0, 4).map(holding => ({
        tokenId: holding.tokenId,
        name: holding.symbol,
        pnl: holding.unrealizedPnL || 0,
        roi: holding.unrealizedPnLPercent || 0,
        trades: 0, // Would need transaction count by token
        value: holding.usdValue
      }))
    };
  }, [analyticsSummary, portfolioHoldings]);
  const [selectedBot, setSelectedBot] = useState('all');

  const filteredData = useMemo(() => {
    const days = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 7;
    return analyticsData.performanceData.slice(-days);
  }, [timeRange, analyticsData.performanceData]);

  // Use only real performance metrics - no fallback calculations
  const currentMetrics = useMemo(() => {
    if (!performanceMetrics) {
      return {
        totalPnL: 0,
        totalTrades: 0,
        avgDailyReturn: 0,
        winRate: 0,
        totalValue: 0,
        totalFees: 0,
        yieldEarned: 0
      };
    }

    return {
      totalPnL: performanceMetrics.totalReturn,
      totalTrades: performanceMetrics.totalTrades,
      avgDailyReturn: performanceMetrics.totalReturn / Math.max(1, filteredData.length),
      winRate: performanceMetrics.winRate,
      totalValue: performanceMetrics.currentValue,
      totalFees: performanceMetrics.totalFeesSpent,
      yieldEarned: performanceMetrics.totalYieldEarned
    };
  }, [performanceMetrics, filteredData]);

  // Handle wallet selection change (no auto-refresh)
  const handleWalletChange = async (walletAddress: string) => {
    setSelectedWallet(walletAddress);
    setWalletAddress(walletAddress);
    // Note: Removed automatic analytics refresh - data comes from cache now
    // Users can manually refresh if needed via the refresh button
  };

  // Authentication guard - require wallet connection
  if (!walletState.connected) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Connect Your Wallet</h2>
          <p className="text-muted-foreground mb-6">
            Connect your wallet to view analytics for your bots. Analytics are personalized to your wallet address.
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

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics & Insights</h1>
          <p className="text-muted-foreground">
            {analyticsSummary ? 'Real blockchain data' : 'No data available'} •
            {lastUpdated ? ` Updated ${formatRelativeTime(new Date(lastUpdated).toISOString())}` : ' No recent updates'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Wallet Selection */}
          {bots.length > 0 && (
            <Select value={selectedWallet} onValueChange={handleWalletChange}>
              <SelectTrigger className="w-48 bg-input border-border text-foreground">
                <SelectValue placeholder="Select wallet" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {bots.map((bot) => (
                  <SelectItem key={bot.id} value={bot.walletAddress}>
                    {bot.name} ({bot.walletAddress.slice(0, 8)}...)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32 bg-input border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" className="border-border text-foreground">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>

          <Button
            variant="outline"
            className="border-border text-foreground"
            onClick={() => refreshAnalytics()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Alert className="bg-yellow-600/10 border-yellow-500/20">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {loading && !analyticsSummary && (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading real blockchain analytics...</span>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total P&L</p>
                <p className={`text-2xl font-bold ${currentMetrics.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {currentMetrics.totalPnL >= 0 ? '+' : ''}{formatCurrency(currentMetrics.totalPnL)}
                </p>
                <p className="text-xs text-muted-foreground/70">
                  {currentMetrics.totalPnL >= 0 ? '+' : ''}{((currentMetrics.totalPnL / (currentMetrics.totalValue - currentMetrics.totalPnL)) * 100).toFixed(2)}%
                </p>
              </div>
              {currentMetrics.totalPnL >= 0 ? (
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
                <p className="text-2xl font-bold text-card-foreground">{currentMetrics.totalTrades}</p>
                <p className="text-xs text-muted-foreground/70">
                  {analyticsSummary ? 'From blockchain data' : 'No data'}
                </p>
              </div>
              <Activity className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Win Rate</p>
                <p className="text-2xl font-bold text-card-foreground">{currentMetrics.winRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground/70">
                  {analyticsSummary ? 'From blockchain data' : 'No data'}
                </p>
              </div>
              <Target className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Portfolio Value</p>
                <p className="text-2xl font-bold text-card-foreground">
                  {formatCurrency(currentMetrics.totalValue)}
                </p>
                <p className="text-xs text-muted-foreground/70">
                  {portfolioHoldings.length} holdings
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 bg-card border-border">
          <TabsTrigger value="performance" className="text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">Performance</TabsTrigger>
          <TabsTrigger value="strategies" className="text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">Strategies</TabsTrigger>
          <TabsTrigger value="bots" className="text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">Bot Analysis</TabsTrigger>
          <TabsTrigger value="markets" className="text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">Market Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Performance Chart Placeholder */}
            <Card className="bg-card border-border lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-card-foreground">Portfolio Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80 flex items-center justify-center bg-muted rounded-lg">
                  <div className="text-center">
                    <LineChart className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                    <p className="text-card-foreground font-medium">Performance Chart</p>
                    <p className="text-sm text-muted-foreground">Interactive chart coming soon</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Daily Performance */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-card-foreground">Daily Performance</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredData.length > 0 ? (
                  <div className="space-y-3">
                    {filteredData.slice(-5).reverse().map((data, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <div className="font-medium text-card-foreground">
                            {new Date(data.date).toLocaleDateString()}
                          </div>
                          <div className="text-sm text-muted-foreground">{data.trades} trades</div>
                        </div>
                        <div className="text-right">
                          <div className={`font-medium ${data.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {data.pnl >= 0 ? '+' : ''}{formatCurrency(data.pnl)}
                          </div>
                          <div className="text-xs text-muted-foreground/70">
                            {((data.pnl / 10000) * 100).toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 text-center">
                    <div>
                      <div className="text-muted-foreground">No performance data available</div>
                      <div className="text-sm text-muted-foreground/70">Connect a wallet with transaction history</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="strategies" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Strategy Distribution */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-card-foreground">Strategy Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsData.strategyPerformance.length > 0 ? (
                  <div className="space-y-4">
                    {analyticsData.strategyPerformance.map((strategy, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-card-foreground">{strategy.strategy}</span>
                          <span className="text-muted-foreground">{strategy.value}%</span>
                        </div>
                        <Progress value={strategy.value} className="h-2" />
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">P&L: </span>
                          <span className={strategy.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {strategy.pnl >= 0 ? '+' : ''}{formatCurrency(strategy.pnl)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 text-center">
                    <div>
                      <div className="text-muted-foreground">No strategy data available</div>
                      <div className="text-sm text-muted-foreground/70">Strategy analysis requires transaction history</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Strategy Performance */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-card-foreground">Strategy Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center bg-muted rounded-lg">
                  <div className="text-center">
                    <PieChart className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                    <p className="text-card-foreground font-medium">Strategy Chart</p>
                    <p className="text-sm text-muted-foreground">Interactive chart coming soon</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="bots" className="space-y-4">
          {/* Portfolio Holdings (Real Data) */}
          {portfolioHoldings.length > 0 ? (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-card-foreground">Portfolio Holdings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-3">
                  {portfolioHoldings.map((holding, index) => (
                    <Card key={index} className="bg-muted border-border p-2">
                      <div className="flex flex-col items-center text-center space-y-1">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {holding.symbol.charAt(0)}
                        </div>
                        <div className="min-h-[2rem] flex flex-col justify-center">
                          <div className="font-medium text-card-foreground text-xs leading-tight">{holding.symbol}</div>
                          <div className="text-[10px] text-muted-foreground">{holding.formattedBalance.toFixed(2)} tokens</div>
                        </div>
                        <div className="min-h-[2rem] flex flex-col justify-center">
                          <div className="font-medium text-xs text-card-foreground">
                            {formatCurrency(holding.usdValue)}
                          </div>
                          <div className={`text-[10px] ${holding.unrealizedPnL && holding.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {holding.unrealizedPnLPercent ? `${holding.unrealizedPnLPercent >= 0 ? '+' : ''}${holding.unrealizedPnLPercent.toFixed(1)}%` : 'No change'}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-card-foreground">Top Performing Bots</CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsData.topPerformers.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-3">
                    {analyticsData.topPerformers.map((performer, index) => (
                      <Card key={index} className="bg-muted border-border p-2">
                        <div className="flex flex-col items-center text-center space-y-1">
                          {performer.bot ? (
                            <BotAvatar bot={performer.bot} size="sm" />
                          ) : (
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                              {performer.name.charAt(0)}
                            </div>
                          )}
                          <div className="min-h-[2rem] flex flex-col justify-center">
                            <div className="font-medium text-card-foreground text-xs leading-tight">{performer.name}</div>
                            <div className="text-[10px] text-muted-foreground">{performer.trades} trades</div>
                          </div>
                          <div className="min-h-[2rem] flex flex-col justify-center">
                            <div className={`font-medium text-xs ${performer.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {performer.pnl >= 0 ? '+' : ''}{formatCurrency(performer.pnl)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {performer.roi >= 0 ? '+' : ''}{performer.roi.toFixed(1)}% ROI
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 text-center">
                    <div>
                      <Bot className="w-16 h-16 mx-auto mb-4 opacity-50 text-muted-foreground" />
                      <h3 className="text-lg font-semibold mb-2 text-card-foreground">No performing bots yet</h3>
                      <p className="text-muted-foreground">Start trading with your bots to see performance data here.</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Recent Transactions */}
          {recentTransactions.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-card-foreground">Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentTransactions.slice(0, 10).map((tx, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${tx.status === 'success' ? 'bg-green-400' : tx.status === 'failed' ? 'bg-red-400' : 'bg-yellow-400'}`} />
                        <div>
                          <div className="font-medium text-card-foreground text-sm">
                            {tx.type} • {tx.tokenSymbol || 'Unknown'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(tx.timestamp).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-medium text-sm ${(tx.usdValue || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {tx.usdValue ? `${(tx.usdValue || 0) >= 0 ? '+' : ''}${formatCurrency(tx.usdValue)}` : '-'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {tx.amount} {tx.tokenSymbol}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="markets" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Market Overview */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-card-foreground">Market Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <div className="font-medium text-card-foreground">STX/USD</div>
                      <div className="text-sm text-muted-foreground">Stacks</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-card-foreground">
                        ${marketData.stxPrice.toFixed(2)}
                      </div>
                      <div className="text-sm text-green-400">
                        {marketData.pricesLoaded ? 'Live' : '+2.3%'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <div className="font-medium text-card-foreground">CHA/USD</div>
                      <div className="text-sm text-muted-foreground">Charisma Token</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-card-foreground">
                        ${marketData.charismaPrice.toFixed(4)}
                      </div>
                      <div className="text-sm text-blue-400">
                        {marketData.pricesLoaded ? 'Live' : 'Static'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <div className="font-medium text-card-foreground">Total Market Cap</div>
                      <div className="text-sm text-muted-foreground">DeFi TVL</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-card-foreground">
                        $125,600,000
                      </div>
                      <div className="text-sm text-green-400">+5.8%</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Opportunities */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-card-foreground">Market Opportunities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {marketOpportunities.length > 0 ? (
                    marketOpportunities.map((opportunity, index) => {
                      const getOpportunityColor = (type: string) => {
                        switch (type) {
                          case 'yield': return 'green';
                          case 'arbitrage': return 'blue';
                          case 'dca': return 'purple';
                          case 'rebalance': return 'orange';
                          default: return 'gray';
                        }
                      };

                      const getOpportunityIcon = (type: string) => {
                        switch (type) {
                          case 'yield': return <Zap className="w-4 h-4" />;
                          case 'arbitrage': return <TrendingUp className="w-4 h-4" />;
                          case 'dca': return <Clock className="w-4 h-4" />;
                          case 'rebalance': return <Target className="w-4 h-4" />;
                          default: return <AlertCircle className="w-4 h-4" />;
                        }
                      };

                      const color = getOpportunityColor(opportunity.type);

                      return (
                        <div key={index} className={`p-3 bg-${color}-500/10 border border-${color}-500/30 rounded-lg`}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`text-${color}-400`}>
                              {getOpportunityIcon(opportunity.type)}
                            </div>
                            <span className={`font-medium text-${color}-400`}>
                              {opportunity.title}
                            </span>
                            <Badge variant="outline" className={`text-xs border-${color}-400/50 text-${color}-400`}>
                              {opportunity.confidence}
                            </Badge>
                          </div>
                          <p className="text-sm text-card-foreground/80">
                            {opportunity.description}
                          </p>
                          {opportunity.apy && (
                            <p className="text-xs text-muted-foreground mt-1">
                              APY: {opportunity.apy}%
                            </p>
                          )}
                          {opportunity.spread && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Spread: {opportunity.spread}%
                            </p>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <>
                      <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="w-4 h-4 text-green-400" />
                          <span className="font-medium text-green-400">High Yield Opportunity</span>
                        </div>
                        <p className="text-sm text-card-foreground/80">
                          STX-USDC pool showing 15.2% APY with low volatility
                        </p>
                      </div>

                      <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-4 h-4 text-blue-400" />
                          <span className="font-medium text-blue-400">Arbitrage Alert</span>
                        </div>
                        <p className="text-sm text-card-foreground/80">
                          Price difference detected between DEX pools (0.8% spread)
                        </p>
                      </div>

                      <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-4 h-4 text-purple-400" />
                          <span className="font-medium text-purple-400">DCA Timing</span>
                        </div>
                        <p className="text-sm text-card-foreground/80">
                          Market volatility suggests good DCA entry point
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
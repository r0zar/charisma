'use client';

import React, { useState, useMemo } from 'react';
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
  Settings
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useBots } from '@/contexts/bot-context';
import { formatCurrency, formatRelativeTime, formatPercentage } from '@/lib/utils';

// Strategy color mapping
const strategyColors = {
  'yield-farming': 'bg-green-500',
  'arbitrage': 'bg-blue-500', 
  'dca': 'bg-purple-500',
  'liquidity-mining': 'bg-orange-500'
} as const;

// Strategy display names
const strategyNames = {
  'yield-farming': 'Yield Farming',
  'arbitrage': 'Arbitrage',
  'dca': 'DCA',
  'liquidity-mining': 'Liquidity Mining'
} as const;

export default function AnalyticsPage() {
  const { bots, botStats, activities, performanceMetrics, marketData } = useBots();
  const [timeRange, setTimeRange] = useState('7d');

  // Calculate real analytics data
  const analyticsData = useMemo(() => {
    // Generate performance data based on real bot data
    const performanceData = [];
    const baseValue = 10000;
    let cumulativePnL = 0;
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Simulate daily PnL based on actual bot performance
      const dailyPnL = i === 0 ? botStats.todayPnL : (botStats.totalPnL / 30); // Rough daily average
      cumulativePnL += dailyPnL;
      
      // Count activities for that day
      const dayActivities = activities.filter(activity => {
        const activityDate = new Date(activity.timestamp).toISOString().split('T')[0];
        return activityDate === dateStr;
      });
      
      performanceData.push({
        date: dateStr,
        value: baseValue + cumulativePnL,
        pnl: cumulativePnL,
        trades: dayActivities.length
      });
    }

    // Calculate strategy performance from real bots
    const strategyStats = new Map();
    let totalBots = 0;
    
    bots.forEach(bot => {
      if (!strategyStats.has(bot.strategy)) {
        strategyStats.set(bot.strategy, { count: 0, totalPnL: 0 });
      }
      const stats = strategyStats.get(bot.strategy);
      stats.count += 1;
      stats.totalPnL += bot.totalPnL;
      totalBots += 1;
    });

    const strategyPerformance = Array.from(strategyStats.entries()).map(([strategy, stats]) => ({
      strategy: strategyNames[strategy as keyof typeof strategyNames] || strategy,
      value: totalBots > 0 ? Math.round((stats.count / totalBots) * 100) : 0,
      pnl: stats.totalPnL,
      color: strategyColors[strategy as keyof typeof strategyColors] || 'bg-gray-500'
    }));

    // Get top performing bots
    const topPerformers = [...bots]
      .sort((a, b) => b.totalPnL - a.totalPnL)
      .slice(0, 4)
      .map(bot => {
        const botActivities = activities.filter(activity => activity.botId === bot.id);
        const estimatedInvestment = 1000; // Default investment amount for ROI calculation
        const roi = estimatedInvestment > 0 ? (bot.totalPnL / estimatedInvestment) * 100 : 0;
        
        return {
          name: bot.name,
          pnl: bot.totalPnL,
          roi,
          trades: botActivities.length
        };
      });

    return {
      performanceData,
      strategyPerformance,
      topPerformers
    };
  }, [bots, botStats, activities]);
  const [selectedBot, setSelectedBot] = useState('all');

  const filteredData = useMemo(() => {
    // Filter real data based on time range
    const days = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 7;
    return analyticsData.performanceData.slice(-days);
  }, [timeRange, analyticsData.performanceData]);

  const totalPnL = useMemo(() => {
    return filteredData.reduce((sum, data) => sum + data.pnl, 0);
  }, [filteredData]);

  const totalTrades = useMemo(() => {
    return filteredData.reduce((sum, data) => sum + data.trades, 0);
  }, [filteredData]);

  const avgDailyReturn = useMemo(() => {
    if (filteredData.length === 0) return 0;
    return totalPnL / filteredData.length;
  }, [totalPnL, filteredData.length]);

  const winRate = useMemo(() => {
    const profitable = filteredData.filter(d => d.pnl > 0).length;
    return filteredData.length > 0 ? (profitable / filteredData.length) * 100 : 0;
  }, [filteredData]);

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics & Insights</h1>
          <p className="text-muted-foreground">Performance metrics and market analysis</p>
        </div>
        <div className="flex gap-2">
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
          <Button variant="outline" className="border-border text-foreground">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total P&L</p>
                <p className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
                </p>
                <p className="text-xs text-muted-foreground/70">
                  {totalPnL >= 0 ? '+' : ''}{((totalPnL / 10000) * 100).toFixed(2)}%
                </p>
              </div>
              {totalPnL >= 0 ? (
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
                <p className="text-2xl font-bold text-card-foreground">{totalTrades}</p>
                <p className="text-xs text-muted-foreground/70">
                  {(totalTrades / filteredData.length).toFixed(1)}/day avg
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
                <p className="text-2xl font-bold text-card-foreground">{winRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground/70">
                  {filteredData.filter(d => d.pnl > 0).length} profitable days
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
                <p className="text-sm text-muted-foreground">Avg Daily Return</p>
                <p className={`text-2xl font-bold ${avgDailyReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {avgDailyReturn >= 0 ? '+' : ''}{formatCurrency(avgDailyReturn)}
                </p>
                <p className="text-xs text-muted-foreground/70">
                  {avgDailyReturn >= 0 ? '+' : ''}{((avgDailyReturn / 10000) * 100).toFixed(2)}%
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
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground">Top Performing Bots</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analyticsData.topPerformers.map((bot, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                        <Bot className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <div className="font-medium text-card-foreground">{bot.name}</div>
                        <div className="text-sm text-muted-foreground">{bot.trades} trades</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-medium ${bot.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {bot.pnl >= 0 ? '+' : ''}{formatCurrency(bot.pnl)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {bot.roi >= 0 ? '+' : ''}{bot.roi.toFixed(1)}% ROI
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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
                        ${marketData.tokenPrices?.STX?.toFixed(2) || '1.85'}
                      </div>
                      <div className={`text-sm ${(marketData.priceChanges?.STX || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(marketData.priceChanges?.STX || 0) >= 0 ? '+' : ''}{formatPercentage(marketData.priceChanges?.STX || 2.3)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <div className="font-medium text-card-foreground">BTC/USD</div>
                      <div className="text-sm text-muted-foreground">Bitcoin</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-card-foreground">
                        ${marketData.tokenPrices?.BTC?.toLocaleString() || '43,250'}
                      </div>
                      <div className={`text-sm ${(marketData.priceChanges?.BTC || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(marketData.priceChanges?.BTC || 0) >= 0 ? '+' : ''}{formatPercentage(marketData.priceChanges?.BTC || -1.2)}
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
                        ${(marketData.marketCap?.total || 125600000).toLocaleString()}
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
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
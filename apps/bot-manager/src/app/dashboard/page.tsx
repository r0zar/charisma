'use client';

import React from 'react';
import { 
  Bot, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  AlertTriangle,
  DollarSign,
  Activity,
  Clock,
  ArrowRight,
  Plus,
  Fuel,
  Wallet,
  Target,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useBots } from '@/contexts/bot-context';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';
import Link from 'next/link';

export default function DashboardPage() {
  const { bots, botStats, performanceMetrics, activities, loading } = useBots();

  const recentActivity = activities
    .map(activity => {
      const bot = bots.find(b => b.id === activity.botId);
      return { ...activity, botName: bot?.name || 'Unknown Bot' };
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 6);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bot className="w-8 h-8 text-blue-400 animate-pulse" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Loading Dashboard...</h2>
          <p className="text-white/60">Fetching your bot data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Welcome back!</h1>
          <p className="text-muted-foreground">Here's what's happening with your bots today</p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground border-0">
          <Link href="/bots/create">
            <Plus className="w-4 h-4 mr-2" />
            Create Bot
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-card border-border shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Bots</p>
                <p className="text-2xl font-bold text-card-foreground">{botStats.totalBots}</p>
              </div>
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                <Bot className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Bots</p>
                <p className="text-2xl font-bold text-green-400">{botStats.activeBots}</p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                <Zap className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Gas</p>
                <p className="text-2xl font-bold text-yellow-400">{botStats.totalGas.toFixed(1)} STX</p>
              </div>
              <div className="w-12 h-12 bg-yellow-600/20 rounded-full flex items-center justify-center">
                <Fuel className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Portfolio Value</p>
                <p className="text-2xl font-bold text-card-foreground">{formatCurrency(botStats.totalValue)}</p>
              </div>
              <div className="w-12 h-12 bg-purple-600/20 rounded-full flex items-center justify-center">
                <Wallet className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-card border-border shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader>
            <CardTitle className="text-card-foreground flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Performance Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Daily P&L</span>
                <span className={`font-bold ${botStats.todayPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {botStats.todayPnL >= 0 ? '+' : ''}{formatCurrency(botStats.todayPnL)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total P&L</span>
                <span className={`font-bold ${botStats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {botStats.totalPnL >= 0 ? '+' : ''}{formatCurrency(botStats.totalPnL)}
                </span>
              </div>
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Success Rate</span>
                  <span className="text-sm text-gray-300">
                    {botStats.totalBots > 0 ? ((botStats.activeBots / botStats.totalBots) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <Progress 
                  value={botStats.totalBots > 0 ? (botStats.activeBots / botStats.totalBots) * 100 : 0} 
                  className="h-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader>
            <CardTitle className="text-card-foreground flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button asChild variant="outline" className="h-24 flex-col justify-center">
                <Link href="/bots">
                  <Bot className="w-6 h-6 mb-2" />
                  <span className="text-sm">Manage Bots</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-24 flex-col justify-center">
                <Link href="/activity">
                  <Activity className="w-6 h-6 mb-2" />
                  <span className="text-sm">View Activity</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-24 flex-col justify-center">
                <Link href="/analytics">
                  <BarChart3 className="w-6 h-6 mb-2" />
                  <span className="text-sm">Analytics</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bot Status Overview */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Bot Status Overview
            </span>
            <Button asChild variant="ghost" size="sm" className="text-primary hover:text-primary/80 hover:bg-primary/10">
              <Link href="/bots">
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bots.slice(0, 6).map((bot) => (
              <div key={bot.id} className="p-4 bg-background/50 rounded-lg border border-border hover:border-border/80 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-foreground truncate">{bot.name}</h3>
                  <Badge 
                    variant={bot.status === 'active' ? 'default' : 'secondary'}
                    className={`
                      ${bot.status === 'active' ? 'bg-green-600/20 text-green-400 border-green-600/30' : ''}
                      ${bot.status === 'paused' ? 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30' : ''}
                      ${bot.status === 'error' ? 'bg-red-600/20 text-red-400 border-red-600/30' : ''}
                      ${bot.status === 'setup' ? 'bg-blue-600/20 text-blue-400 border-blue-600/30' : ''}
                    `}
                  >
                    {bot.status}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Strategy</span>
                    <span className="text-foreground/80 capitalize">{bot.strategy}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Daily P&L</span>
                    <span className={`font-medium ${bot.dailyPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {bot.dailyPnL >= 0 ? '+' : ''}{formatCurrency(bot.dailyPnL)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Last Active</span>
                    <span className="text-foreground/80">{formatRelativeTime(bot.lastActive)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Recent Activity
            </span>
            <Button asChild variant="ghost" size="sm" className="text-primary hover:text-primary/80 hover:bg-primary/10">
              <Link href="/activity">
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No recent activity</p>
                <p className="text-sm text-muted-foreground/70">Your bot activities will appear here</p>
              </div>
            ) : (
              recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center gap-4 p-3 bg-background/50 rounded-lg hover:bg-background/70 transition-colors">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.status === 'success' ? 'bg-green-400' :
                    activity.status === 'failed' ? 'bg-red-400' : 'bg-yellow-400'
                  }`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{activity.botName}</span>
                      <Badge variant="outline" className="text-xs">
                        {activity.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{activity.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">{formatRelativeTime(activity.timestamp)}</div>
                    {activity.status === 'success' && (
                      <div className="text-xs text-green-400">Success</div>
                    )}
                    {activity.status === 'failed' && (
                      <div className="text-xs text-red-400">Failed</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
'use client';

import Editor from '@monaco-editor/react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  GitFork,
  Plus,
  TrendingDown,
  TrendingUp,
  Trophy,
  Zap
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

import { BotAvatar } from '@/components/ui/bot-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getMonacoTypeDefinitions } from '@/generated/types';
import { useToast } from '@/contexts/toast-context';
import { useBots } from '@/contexts/bot-context';
import { useUser } from '@clerk/nextjs';
import { formatCurrency } from '@/lib/utils';
import { Bot } from '@/schemas/bot.schema';
import { BotPerformanceService } from '@/lib/services/performance/service';

interface BotPerformanceMarketplaceProps {
  bot: Bot;
}

export function BotPerformanceMarketplace({ bot }: BotPerformanceMarketplaceProps) {
  const { showSuccess, showError } = useToast();
  const { allBots, createBot } = useBots();
  const { isSignedIn, user } = useUser();
  const [isCodeExpanded, setIsCodeExpanded] = useState(false);
  const [isCloning, setIsCloning] = useState(false);

  // Get computed CSS custom property values for Recharts
  const getComputedCSSValue = (property: string) => {
    if (typeof window === 'undefined') return property;
    return getComputedStyle(document.documentElement).getPropertyValue(property).trim();
  };

  const chartColors = {
    primary: getComputedCSSValue('--primary') ? `hsl(${getComputedCSSValue('--primary')})` : '#3b82f6',
    muted: getComputedCSSValue('--muted-foreground') ? `hsl(${getComputedCSSValue('--muted-foreground')})` : '#6b7280',
    card: getComputedCSSValue('--card') ? `hsl(${getComputedCSSValue('--card')})` : '#ffffff',
    border: getComputedCSSValue('--border') ? `hsl(${getComputedCSSValue('--border')})` : '#e5e7eb',
    foreground: getComputedCSSValue('--card-foreground') ? `hsl(${getComputedCSSValue('--card-foreground')})` : '#111827'
  };

  // Calculate performance metrics
  const performanceMetrics = BotPerformanceService.calculatePerformanceMetrics(bot);
  const historicalData = BotPerformanceService.generateHistoricalData(bot);
  const marketplaceMetrics = BotPerformanceService.calculateMarketplaceMetrics(bot, performanceMetrics, allBots);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
      .then(() => showSuccess(`${label} copied to clipboard`))
      .catch(() => showError(`Failed to copy ${label.toLowerCase()}`));
  };

  const handleCloneBot = async () => {
    if (!isSignedIn) {
      showError('Please sign in to clone bots');
      return;
    }

    setIsCloning(true);
    try {
      const newBot = await createBot({
        name: `${bot.name} (Copy)`,
        strategy: bot.strategy,
      });
      showSuccess(`Successfully cloned "${bot.name}" as "${newBot.name}"`);
    } catch (error) {
      showError('Failed to clone bot', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsCloning(false);
    }
  };

  // Setup Monaco Editor types
  const handleEditorDidMount = (editor: any, monaco: any) => {
    const typeDefinitions = getMonacoTypeDefinitions();
    typeDefinitions.forEach(({ content, filePath }: { content: string, filePath: string }) => {
      monaco.languages.typescript.typescriptDefaults.addExtraLib(content, filePath);
    });
  };

  // Format data for Recharts
  const chartData = historicalData.map((point, index) => ({
    date: new Date(point.timestamp).toLocaleDateString(),
    balance: Math.max(0, point.balance || 0),
    profit: point.cumulativeProfit || 0,
    day: index + 1,
  }));

  // Ensure we have at least some variation in the data for proper chart rendering
  const hasVariation = chartData.length > 1 && 
    Math.max(...chartData.map(d => d.balance)) > Math.min(...chartData.map(d => d.balance));

  // If no variation, add some sample data points for demonstration
  const displayData = hasVariation ? chartData : [
    { date: '7/11/2025', balance: 1000, profit: 0, day: 1 },
    { date: '7/12/2025', balance: 1025, profit: 25, day: 2 },
    { date: '7/13/2025', balance: 1035, profit: 35, day: 3 },
    { date: '7/14/2025', balance: 1035, profit: 35, day: 4 }
  ];

  // Debug: Log chart data to console
  console.log('Chart data:', {
    originalData: chartData.slice(0, 3),
    displayData: displayData.slice(0, 3),
    chartColors,
    hasVariation,
    dataLength: displayData.length,
    balanceRange: [Math.min(...displayData.map(d => d.balance)), Math.max(...displayData.map(d => d.balance))]
  });

  // Performance indicators
  const isPositive = performanceMetrics.totalReturn >= 0;
  const returnClass = isPositive ? 'text-green-400' : 'text-red-400';
  const returnIcon = isPositive ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;

  const getRankColor = (rank: number, total: number) => {
    const percentile = rank / total;
    if (percentile <= 0.1) return 'text-yellow-400'; // Top 10%
    if (percentile <= 0.25) return 'text-green-400'; // Top 25%
    if (percentile <= 0.5) return 'text-blue-400'; // Top 50%
    return 'text-gray-400';
  };

  const getRecommendationColor = (strength: string) => {
    switch (strength) {
      case 'high': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'medium': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'low': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'avoid': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Performance Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-muted to-card border border-border shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-secondary/5" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl" />
        
        <div className="relative p-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6 mb-8">
            
            {/* Bot Identity */}
            <div className="flex items-center gap-6">
              <div className="relative">
                <BotAvatar bot={bot} size="xl" className="w-24 h-24 rounded-2xl border-4 border-border/50 shadow-lg" />
                <div className="absolute -bottom-2 -right-2">
                  <Badge className={`px-2 py-1 text-xs font-medium ${getRankColor(marketplaceMetrics.rank, marketplaceMetrics.totalBots)}`}>
                    <Trophy className="w-3 h-3 mr-1" />
                    #{marketplaceMetrics.rank}
                  </Badge>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-card-foreground">{bot.name}</h1>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-2xl font-bold ${returnClass} flex items-center gap-1`}>
                    {returnIcon}
                    {formatCurrency(performanceMetrics.totalReturn)}
                  </span>
                  <span className={`text-lg ${returnClass}`}>
                    ({isPositive ? '+' : ''}{performanceMetrics.totalReturnPercentage.toFixed(2)}%)
                  </span>
                </div>
                <p className="text-muted-foreground">Total Return • {performanceMetrics.totalExecutions} Executions</p>
              </div>
            </div>

            {/* Performance Stats */}
            <div className="flex-1 lg:ml-auto">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-xl border border-border">
                  <div className="text-2xl font-bold text-primary">{formatCurrency(performanceMetrics.currentBalance)}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Current Balance</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-xl border border-border">
                  <div className="text-2xl font-bold text-green-500">{performanceMetrics.successRate.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Success Rate</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-xl border border-border">
                  <div className="text-2xl font-bold text-purple-500">{formatCurrency(performanceMetrics.dailyReturn)}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Daily Avg</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-xl border border-border">
                  <div className="text-2xl font-bold text-amber-500">{marketplaceMetrics.performanceScore.toFixed(0)}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Score</div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={handleCloneBot}
              disabled={isCloning || !isSignedIn}
              className="flex-1 bg-green-600 hover:bg-green-500 text-white font-semibold py-3 px-6 disabled:opacity-50"
            >
              <GitFork className="w-4 h-4 mr-2" />
              {isCloning ? 'Cloning...' : !isSignedIn ? 'Sign in to Clone' : 'Clone This Bot'}
            </Button>
            <Button 
              variant="outline"
              onClick={() => copyToClipboard(bot.strategy, 'Strategy code')}
              className="flex-1 border-primary text-primary hover:bg-primary/10 font-semibold py-3 px-6"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Strategy
            </Button>
            <Button 
              variant="outline"
              className="sm:w-auto font-semibold py-3 px-6"
            >
              <Plus className="w-4 h-4 mr-2" />
              Follow Bot
            </Button>
          </div>
        </div>
      </div>

      {/* Performance Chart */}
      <Card className="shadow-xl relative">
        <CardHeader className="pb-3">
          <CardTitle className="text-card-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Balance History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full relative">
            <div className="absolute inset-0 bg-muted/30 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
              <div className="text-center">
                <div className="text-lg font-semibold text-muted-foreground">Coming Soon</div>
                <div className="text-sm text-muted-foreground">Real execution data</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={displayData}>
                <defs>
                  <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.primary} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: chartColors.muted }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: chartColors.muted }}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: chartColors.card,
                    border: `1px solid ${chartColors.border}`,
                    borderRadius: '8px',
                    color: chartColors.foreground
                  }}
                  formatter={(value, name) => [formatCurrency(value as number), name === 'balance' ? 'Balance' : 'Profit']}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke={chartColors.primary}
                  strokeWidth={2}
                  fill="url(#balanceGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          {/* Chart Summary */}
          <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t border-border relative">
            <div className="absolute inset-0 bg-muted/30 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
              <div className="text-center">
                <div className="text-sm font-semibold text-muted-foreground">Coming Soon</div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Peak Balance</div>
              <div className="text-lg font-semibold text-green-500">
                {formatCurrency(Math.max(...displayData.map(d => d.balance)))}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Win Rate</div>
              <div className="text-lg font-semibold text-primary">
                {performanceMetrics.successRate.toFixed(1)}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Max Drawdown</div>
              <div className="text-lg font-semibold text-red-500">
                -{performanceMetrics.maxDrawdown.toFixed(1)}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Risk Analysis */}
        <Card className="shadow-xl relative">
          <div className="absolute inset-0 bg-muted/30 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
            <div className="text-center">
              <div className="text-lg font-semibold text-muted-foreground">Coming Soon</div>
              <div className="text-sm text-muted-foreground">Risk analytics</div>
            </div>
          </div>
          <CardHeader className="pb-3">
            <CardTitle className="text-card-foreground flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Risk Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Risk Score</span>
              <span className="text-card-foreground font-bold">{marketplaceMetrics.riskScore.toFixed(0)}/100</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Consistency</span>
              <span className="text-card-foreground font-bold">{(performanceMetrics.consistency * 100).toFixed(0)}%</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Win/Loss Ratio</span>
              <span className="text-card-foreground font-bold">{performanceMetrics.winLossRatio.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Volume Traded</span>
              <span className="text-card-foreground font-bold">{formatCurrency(performanceMetrics.volumeTraded)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Marketplace Position */}
        <Card className="shadow-xl relative">
          <div className="absolute inset-0 bg-muted/30 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
            <div className="text-center">
              <div className="text-lg font-semibold text-muted-foreground">Coming Soon</div>
              <div className="text-sm text-muted-foreground">Performance ranking</div>
            </div>
          </div>
          <CardHeader className="pb-3">
            <CardTitle className="text-card-foreground flex items-center gap-2">
              <Trophy className="w-5 h-5 text-purple-500" />
              Marketplace Rank
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className={`text-3xl font-bold ${getRankColor(marketplaceMetrics.rank, marketplaceMetrics.totalBots)}`}>
                #{marketplaceMetrics.rank}
              </div>
              <div className="text-muted-foreground text-sm">out of {marketplaceMetrics.totalBots} bots</div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Performance Score</span>
              <span className="text-card-foreground font-bold">{marketplaceMetrics.performanceScore.toFixed(0)}/100</span>
            </div>

          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card className="shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-card-foreground flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Executions</span>
              <span className="text-card-foreground font-bold">{performanceMetrics.totalExecutions}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Avg Execution Time</span>
              <span className="text-card-foreground font-bold">{(performanceMetrics.averageExecutionTime / 1000).toFixed(1)}s</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Created</span>
              <span className="text-card-foreground font-bold">
                {Math.ceil((Date.now() - new Date(bot.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days ago
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge className={bot.status === 'active' ? 'bg-green-500/20 text-green-500' : 'bg-amber-500/20 text-amber-500'}>
                {bot.status.toUpperCase()}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Similar High-Performing Bots */}
      {allBots.length > 1 && (
        <Card className="shadow-xl relative">
          <div className="absolute inset-0 bg-muted/30 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
            <div className="text-center">
              <div className="text-lg font-semibold text-muted-foreground">Coming Soon</div>
              <div className="text-sm text-muted-foreground">Marketplace recommendations</div>
            </div>
          </div>
          <CardHeader className="pb-3">
            <CardTitle className="text-card-foreground flex items-center gap-2">
              <Trophy className="w-5 h-5 text-purple-500" />
              Similar High-Performing Bots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allBots
                .filter(b => b.id !== bot.id) // Exclude current bot
                .map(similarBot => {
                  const similarMetrics = BotPerformanceService.calculatePerformanceMetrics(similarBot);
                  const similarMarketplace = BotPerformanceService.calculateMarketplaceMetrics(similarBot, similarMetrics, allBots);
                  const isPositiveReturn = similarMetrics.totalReturn >= 0;
                  
                  return (
                    <div 
                      key={similarBot.id}
                      className="p-4 bg-muted/50 rounded-lg border border-border hover:border-accent transition-colors cursor-pointer"
                      onClick={() => window.location.href = `/bots/${similarBot.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <BotAvatar bot={similarBot} size="sm" className="w-10 h-10 rounded-lg" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-card-foreground truncate">{similarBot.name}</h4>
                            <Badge className={`text-xs ${getRankColor(similarMarketplace.rank, similarMarketplace.totalBots)}`}>
                              #{similarMarketplace.rank}
                            </Badge>
                          </div>
                          <div className={`text-sm font-medium ${isPositiveReturn ? 'text-green-500' : 'text-red-500'}`}>
                            {formatCurrency(similarMetrics.totalReturn)} ({isPositiveReturn ? '+' : ''}{similarMetrics.totalReturnPercentage.toFixed(1)}%)
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {similarMetrics.successRate.toFixed(0)}% success • {similarMetrics.totalExecutions} runs
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
                .slice(0, 6) // Show max 6 similar bots
              }
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strategy Code */}
      <Card className="shadow-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-card-foreground flex items-center gap-2">
              <Copy className="w-5 h-5 text-green-500" />
              Strategy Code
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(bot.strategy, 'Strategy code')}
                className="text-muted-foreground hover:text-card-foreground"
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy Code
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCodeExpanded(!isCodeExpanded)}
                className="text-muted-foreground hover:text-card-foreground"
              >
                {isCodeExpanded ? 'Collapse' : 'Expand'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border border-border rounded-lg overflow-hidden">
            <Editor
              height={isCodeExpanded ? '60vh' : '300px'}
              defaultLanguage="typescript"
              value={bot.strategy}
              onMount={handleEditorDidMount}
              theme="vs-dark"
              options={{
                readOnly: true,
                fontSize: 14,
                lineNumbers: 'on',
                minimap: { enabled: isCodeExpanded },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                renderWhitespace: 'none',
                folding: true,
                lineDecorationsWidth: 10,
                lineNumbersMinChars: 3,
                glyphMargin: false,
                automaticLayout: true,
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
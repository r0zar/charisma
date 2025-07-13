'use client';

import {
  Activity,
  AlertTriangle,
  ArrowUpDown,
  BarChart3,
  CheckCircle,
  Clock,
  Minus,
  Pause,
  Plus,
  TrendingUp
} from 'lucide-react';
import React from 'react';

import { CountdownTimer } from '@/components/countdown-timer';
import { getStrategyDisplayName } from '@/components/strategy-code-editor/strategy-utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentBot } from '@/contexts/current-bot-context';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';

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

export default function BotOverviewPage() {
  const { bot } = useCurrentBot();

  // Bot activities have been moved to analytics system
  const botActivities: any[] = [];

  if (!bot) {
    return null; // Layout will handle loading state
  }

  return (
    <div className="space-y-4 mb-96">
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
                <CountdownTimer
                  targetDate={bot.nextExecution}
                  className="text-sm"
                />
              </div>
            )}

          </CardContent>
        </Card>

        {/* Performance Summary */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground">Performance Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No Performance Data</h3>
              <p>Performance metrics will appear here once the bot starts executing trades.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {botActivities.length === 0 ? (
              <div className="text-center py-12">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                    <Activity className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-card-foreground">No Recent Activity</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      Activity from bot executions, trades, and transactions will appear here once the bot starts running.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>Activity updates automatically</span>
                  </div>
                </div>
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
    </div>
  );
}
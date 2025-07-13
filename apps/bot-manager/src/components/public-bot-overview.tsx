'use client';

import {
  Calendar,
  CheckCircle,
  Clock,
  Code,
  Copy,
  ExternalLink,
  GitBranch,
  Package,
  Shield,
  Timer,
  Wallet
} from 'lucide-react';
import React from 'react';

import { CountdownTimer } from '@/components/countdown-timer';
import { getStrategyDisplayName } from '@/components/strategy-code-editor/strategy-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/contexts/toast-context';
import { formatRelativeTime, truncateAddress } from '@/lib/utils';
import { Bot } from '@/schemas/bot.schema';

const statusColors = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
  setup: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  inactive: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
};

const statusIcons = {
  active: <CheckCircle className="w-4 h-4" />,
  paused: <Timer className="w-4 h-4" />,
  error: <ExternalLink className="w-4 h-4" />,
  setup: <Clock className="w-4 h-4" />,
  inactive: <Clock className="w-4 h-4" />
};

interface PublicBotOverviewProps {
  bot: Bot;
}

export function PublicBotOverview({ bot }: PublicBotOverviewProps) {
  const { showSuccess, showError } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
      .then(() => showSuccess(`${label} copied to clipboard`))
      .catch(() => showError(`Failed to copy ${label.toLowerCase()}`));
  };

  const openInExplorer = (address: string) => {
    window.open(`https://explorer.stacks.co/address/${address}`, '_blank');
  };

  // Parse cron schedule to human readable format
  const formatCronSchedule = (cron?: string) => {
    if (!cron) return 'Not scheduled';
    
    // Basic cron parsing - could be enhanced with a cron parser library
    const parts = cron.split(' ');
    if (parts.length >= 5) {
      const [minute, hour, day, month, dayOfWeek] = parts;
      
      if (minute === '0' && hour === '*') return 'Every hour';
      if (minute === '0' && hour === '0') return 'Daily at midnight';
      if (minute === '0' && hour === '12') return 'Daily at noon';
      if (dayOfWeek === '1' && hour === '0') return 'Weekly on Monday';
      
      return `Custom: ${cron}`;
    }
    return cron;
  };

  return (
    <div className="space-y-6 mb-96">
      {/* Public Bot Notice */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <div className="flex items-center gap-2 text-blue-400">
          <Shield className="w-5 h-5" />
          <span className="font-medium">Public Bot View</span>
        </div>
        <p className="text-sm text-blue-300/80 mt-2">
          You are viewing a public bot created by another user. This is a read-only view showing safe, public information about the bot's configuration and status.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Bot Status & Information */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Bot Status & Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Current Status</span>
              <Badge className={statusColors[bot.status]}>
                {statusIcons[bot.status]}
                <span className="ml-1 capitalize">{bot.status}</span>
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Strategy Type</span>
              <span className="text-card-foreground font-medium">{getStrategyDisplayName(bot.strategy)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Created</span>
              <span className="text-card-foreground">{formatRelativeTime(bot.createdAt)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Last Active</span>
              <span className="text-card-foreground">{formatRelativeTime(bot.lastActive)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Executions</span>
              <span className="text-card-foreground font-medium">{bot.executionCount || 0}</span>
            </div>
          </CardContent>
        </Card>

        {/* Scheduling Information */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Scheduling Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Scheduling Mode</span>
              <Badge className={bot.isScheduled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
                {bot.isScheduled ? 'Automated' : 'Manual'}
              </Badge>
            </div>

            {bot.isScheduled && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Schedule</span>
                  <span className="text-card-foreground text-sm">{formatCronSchedule(bot.cronSchedule)}</span>
                </div>

                {bot.lastExecution && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Last Execution</span>
                    <span className="text-card-foreground text-sm">{formatRelativeTime(bot.lastExecution)}</span>
                  </div>
                )}

                {bot.nextExecution && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Next Execution</span>
                    <CountdownTimer
                      targetDate={bot.nextExecution}
                      className="text-sm text-card-foreground"
                    />
                  </div>
                )}
              </>
            )}

            {!bot.isScheduled && (
              <div className="text-center py-4 text-muted-foreground">
                <Timer className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">This bot runs manually by the owner</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Wallet Information */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Wallet Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground text-sm">Bot Wallet Address</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(bot.id, 'Bot address')}
                    className="h-7 w-7 p-0"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openInExplorer(bot.id)}
                    className="h-7 w-7 p-0"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div className="font-mono text-sm bg-muted p-2 rounded border break-all">
                {bot.id}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground text-sm">Owner Address</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(bot.ownerId, 'Owner address')}
                    className="h-7 w-7 p-0"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openInExplorer(bot.ownerId)}
                    className="h-7 w-7 p-0"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div className="font-mono text-sm bg-muted p-2 rounded border break-all">
                {bot.ownerId}
              </div>
            </div>

            {bot.publicKey && (
              <div>
                <span className="text-muted-foreground text-sm">Public Key</span>
                <div className="font-mono text-xs bg-muted p-2 rounded border break-all mt-1">
                  {truncateAddress(bot.publicKey, 20)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Repository & Technical Information */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground flex items-center gap-2">
              <Code className="w-5 h-5" />
              Technical Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {bot.gitRepository && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Repository</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(bot.gitRepository, '_blank')}
                  className="text-blue-400 hover:text-blue-300 p-0 h-auto"
                >
                  <GitBranch className="w-3 h-3 mr-1" />
                  View Source
                </Button>
              </div>
            )}

            {bot.isMonorepo && bot.packagePath && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Package Path</span>
                <span className="text-card-foreground text-sm font-mono">{bot.packagePath}</span>
              </div>
            )}

            {bot.availablePackages && bot.availablePackages.length > 0 && (
              <div>
                <span className="text-muted-foreground text-sm mb-2 block">Available Packages</span>
                <div className="flex flex-wrap gap-1">
                  {bot.availablePackages.slice(0, 6).map((pkg, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      <Package className="w-3 h-3 mr-1" />
                      {pkg.replace('@', '')}
                    </Badge>
                  ))}
                  {bot.availablePackages.length > 6 && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      +{bot.availablePackages.length - 6} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {bot.lastAnalyzed && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Last Analyzed</span>
                <span className="text-card-foreground text-sm">{formatRelativeTime(bot.lastAnalyzed)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
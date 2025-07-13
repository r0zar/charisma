'use client';

import Editor from '@monaco-editor/react';
import {
  Activity,
  Calendar,
  CheckCircle,
  Clock,
  Code,
  Copy,
  ExternalLink,
  GitBranch,
  Package,
  Pause,
  Shield,
  Timer,
  TrendingUp,
  User,
  Wallet,
  Zap
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { CountdownTimer } from '@/components/countdown-timer';
import { getStrategyDisplayName } from '@/components/strategy-code-editor/strategy-utils';
import { BotAvatar } from '@/components/ui/bot-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getMonacoTypeDefinitions } from '@/generated/types';
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
  paused: <Pause className="w-4 h-4" />,
  error: <Zap className="w-4 h-4" />,
  setup: <Clock className="w-4 h-4" />,
  inactive: <Clock className="w-4 h-4" />
};

interface BotStatSheetProps {
  bot: Bot;
}

export function BotStatSheet({ bot }: BotStatSheetProps) {
  const { showSuccess, showError } = useToast();
  const [isCodeExpanded, setIsCodeExpanded] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
      .then(() => showSuccess(`${label} copied to clipboard`))
      .catch(() => showError(`Failed to copy ${label.toLowerCase()}`));
  };

  const openInExplorer = (address: string) => {
    window.open(`https://explorer.stacks.co/address/${address}`, '_blank');
  };

  // Calculate bot age
  const getBotAge = () => {
    const created = new Date(bot.createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1d';
    if (diffDays < 30) return `${diffDays}d`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo`;
    return `${Math.floor(diffDays / 365)}y`;
  };

  // Parse cron schedule to human readable format
  const formatCronSchedule = (cron?: string) => {
    if (!cron) return 'Not scheduled';
    
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

  // Setup Monaco Editor types
  const handleEditorDidMount = (editor: any, monaco: any) => {
    // Add generated type definitions
    const typeDefinitions = getMonacoTypeDefinitions();
    typeDefinitions.forEach(({ content, filePath }: { content: string, filePath: string }) => {
      monaco.languages.typescript.typescriptDefaults.addExtraLib(content, filePath);
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Hero Section - Gaming Card Style */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 shadow-2xl">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-green-500/5" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-3xl" />
        
        <div className="relative p-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
            
            {/* Bot Avatar and Basic Info */}
            <div className="flex items-center gap-6">
              <div className="relative">
                <BotAvatar bot={bot} size="xl" className="w-24 h-24 rounded-2xl border-4 border-slate-600/50 shadow-lg" />
                <div className="absolute -bottom-2 -right-2">
                  <Badge className={`${statusColors[bot.status]} px-2 py-1 text-xs font-medium`}>
                    {statusIcons[bot.status]}
                    <span className="ml-1 capitalize">{bot.status}</span>
                  </Badge>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-white">{bot.name}</h1>
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                    <User className="w-3 h-3 mr-1" />
                    Public Bot
                  </Badge>
                </div>
                <p className="text-slate-400 font-medium">{getStrategyDisplayName(bot.strategy)}</p>
                <p className="text-slate-500 text-sm font-mono">{truncateAddress(bot.id)}</p>
              </div>
            </div>

            {/* Key Stats Bar */}
            <div className="flex-1 lg:ml-auto">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                  <div className="text-2xl font-bold text-green-400">{bot.executionCount || 0}</div>
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Executions</div>
                </div>
                <div className="text-center p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                  <div className="text-2xl font-bold text-blue-400">{getBotAge()}</div>
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Age</div>
                </div>
                <div className="text-center p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                  <div className="text-2xl font-bold text-purple-400 uppercase">{bot.status}</div>
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Status</div>
                </div>
                <div className="text-center p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                  <div className="text-2xl font-bold text-yellow-400 uppercase">{bot.isScheduled ? 'AUTO' : 'MANUAL'}</div>
                  <div className="text-xs text-slate-400 uppercase tracking-wide">Mode</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Core Statistics */}
        <Card className="bg-slate-900/50 border-slate-700/50 shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-200 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              Core Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Current Status
              </span>
              <Badge className={statusColors[bot.status]}>
                {statusIcons[bot.status]}
                <span className="ml-1 capitalize">{bot.status}</span>
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Last Active
              </span>
              <span className="text-slate-200 font-medium">{formatRelativeTime(bot.lastActive)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Total Runs
              </span>
              <span className="text-slate-200 font-bold">{bot.executionCount || 0}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Created
              </span>
              <span className="text-slate-200 font-medium">{formatRelativeTime(bot.createdAt)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Automation Config */}
        <Card className="bg-slate-900/50 border-slate-700/50 shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-200 flex items-center gap-2">
              <Timer className="w-5 h-5 text-green-400" />
              Automation Config
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-lg font-bold text-slate-200 mb-1">Execution Mode</div>
              <Badge className={bot.isScheduled ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-gray-500/20 text-gray-400 border-gray-500/30'}>
                {bot.isScheduled ? 'Automated' : 'Manual'}
              </Badge>
            </div>

            {bot.isScheduled ? (
              <>
                <div className="text-center text-slate-400 text-sm">
                  {formatCronSchedule(bot.cronSchedule)}
                </div>
                
                {bot.nextExecution && (
                  <div className="text-center">
                    <div className="text-slate-400 text-sm mb-1">Next Execution</div>
                    <CountdownTimer
                      targetDate={bot.nextExecution}
                      className="text-green-400 font-mono font-bold"
                    />
                  </div>
                )}

                {bot.lastExecution && (
                  <div className="text-center">
                    <div className="text-slate-400 text-sm mb-1">Last Execution</div>
                    <div className="text-slate-200 text-sm">{formatRelativeTime(bot.lastExecution)}</div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4 text-slate-400">
                <Timer className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Manual execution only</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Technical Specs */}
        <Card className="bg-slate-900/50 border-slate-700/50 shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-200 flex items-center gap-2">
              <Code className="w-5 h-5 text-purple-400" />
              Technical Specs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {bot.gitRepository ? (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Repository</span>
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
            ) : (
              <div className="text-center py-4 text-slate-400">
                <Code className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No repository configured</p>
                <p className="text-xs">Runs in clean environment</p>
              </div>
            )}

            {bot.isMonorepo && bot.packagePath && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Package Path</span>
                <span className="text-slate-200 text-sm font-mono">{bot.packagePath}</span>
              </div>
            )}

            {bot.availablePackages && bot.availablePackages.length > 0 && (
              <div>
                <div className="text-slate-400 text-sm mb-2">Available Packages</div>
                <div className="flex flex-wrap gap-1">
                  {bot.availablePackages.slice(0, 3).map((pkg, index) => (
                    <Badge key={index} variant="outline" className="text-xs border-slate-600 text-slate-300">
                      <Package className="w-3 h-3 mr-1" />
                      {pkg.replace('@', '')}
                    </Badge>
                  ))}
                  {bot.availablePackages.length > 3 && (
                    <Badge variant="outline" className="text-xs text-slate-400 border-slate-600">
                      +{bot.availablePackages.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Wallet & Security - Full Width */}
      <Card className="bg-slate-900/50 border-slate-700/50 shadow-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-slate-200 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-yellow-400" />
            Wallet & Security
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Wallet Addresses */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400 text-sm">Bot Wallet Address</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(bot.id, 'Bot address')}
                      className="h-7 w-7 p-0 text-slate-400 hover:text-slate-200"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openInExplorer(bot.id)}
                      className="h-7 w-7 p-0 text-slate-400 hover:text-slate-200"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div className="font-mono text-sm bg-slate-800 p-3 rounded border border-slate-700 break-all text-slate-200">
                  {bot.id}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400 text-sm">Owner Address</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(bot.ownerId, 'Owner address')}
                      className="h-7 w-7 p-0 text-slate-400 hover:text-slate-200"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openInExplorer(bot.ownerId)}
                      className="h-7 w-7 p-0 text-slate-400 hover:text-slate-200"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div className="font-mono text-sm bg-slate-800 p-3 rounded border border-slate-700 break-all text-slate-200">
                  {bot.ownerId}
                </div>
              </div>
            </div>

            {/* Security Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-green-400" />
                <span className="text-slate-200 font-medium">Security Status</span>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  Encrypted Wallet
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                  <div className="text-lg font-bold text-blue-400">0.00 STX</div>
                  <div className="text-xs text-slate-400">STX Balance</div>
                </div>
                <div className="text-center p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                  <div className="text-lg font-bold text-green-400">$0.00</div>
                  <div className="text-xs text-slate-400">Total Value</div>
                </div>
              </div>

              <div className="bg-slate-800/30 p-3 rounded-lg border border-slate-700/30">
                <div className="text-blue-400 text-sm font-medium mb-2">Security Features</div>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>• Encrypted private key storage</li>
                  <li>• Secure transaction signing</li>
                  <li>• Read-only public information</li>
                  <li>• Owner-controlled execution</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strategy Code Display */}
      <Card className="bg-slate-900/50 border-slate-700/50 shadow-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-slate-200 flex items-center gap-2">
              <Code className="w-5 h-5 text-green-400" />
              Strategy Code
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(bot.strategy, 'Strategy code')}
                className="text-slate-400 hover:text-slate-200"
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy Code
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCodeExpanded(!isCodeExpanded)}
                className="text-slate-400 hover:text-slate-200"
              >
                {isCodeExpanded ? 'Collapse' : 'Expand'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border border-slate-700 rounded-lg overflow-hidden">
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
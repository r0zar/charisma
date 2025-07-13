'use client';

import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Info,
  RefreshCw,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';

import { CountdownTimer } from '@/components/countdown-timer';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useBots } from '@/contexts/bot-context';
import { useCurrentBot } from '@/contexts/current-bot-context';
import { useToast } from '@/contexts/toast-context';
import { useUser } from '@clerk/nextjs';
import { formatRelativeTime } from '@/lib/utils';
import { Bot as BotType } from '@/schemas/bot.schema';

export default function BotSchedulingPage() {
  const { bot } = useCurrentBot();
  const { showSuccess, showError } = useToast();
  const { user } = useUser();
  const { updateBotInContext } = useBots();
  const params = useParams();
  const botId = params?.id as string;
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
    logsUrl?: string;
    logsSize?: number;
  }>>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedExecution, setExpandedExecution] = useState<string | null>(null);
  const [executionLogs, setExecutionLogs] = useState<{ [key: string]: string }>({});
  const [loadingLogs, setLoadingLogs] = useState<string | null>(null);

  useEffect(() => {
    if (bot) {
      // Sync scheduling settings with current bot data
      setSchedulingSettings({
        cronSchedule: bot.cronSchedule || '',
        isScheduled: bot.isScheduled || false
      });
      // Fetch execution history
      fetchExecutionHistory(bot.id);
    }
  }, [bot]);

  const fetchExecutionHistory = async (botId: string) => {
    setLoadingHistory(true);
    try {
      // No need to pass userId - API gets it from Clerk auth automatically
      const response = await fetch(`/api/v1/bots/${botId}/executions`);
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

  const fetchExecutionLogs = async (execution: any) => {
    if (!execution.logsUrl || executionLogs[execution.id]) {
      return; // No logs URL or already loaded
    }

    setLoadingLogs(execution.id);
    try {
      const response = await fetch(execution.logsUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch execution logs');
      }
      const logs = await response.text();
      setExecutionLogs(prev => ({ ...prev, [execution.id]: logs }));
    } catch (error) {
      console.error('Error fetching execution logs:', error);
      showError('Failed to load execution logs');
    } finally {
      setLoadingLogs(null);
    }
  };

  const toggleExecutionExpansion = (executionId: string) => {
    if (expandedExecution === executionId) {
      setExpandedExecution(null);
    } else {
      setExpandedExecution(executionId);
      const execution = executionHistory.find(e => e.id === executionId);
      if (execution && execution.logsUrl) {
        fetchExecutionLogs(execution);
      }
    }
  };

  const handleSaveScheduling = async () => {
    if (!bot) return;

    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`/api/v1/bots/${bot.id}/schedule`, {
        method: 'PUT',
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

      const responseData = await response.json();
      
      // Update bot in context immediately for instant UI feedback
      const updates: Partial<BotType> = {
        isScheduled: schedulingSettings.isScheduled,
        cronSchedule: schedulingSettings.isScheduled ? schedulingSettings.cronSchedule : undefined,
        nextExecution: responseData.schedule?.nextExecution,
        lastExecution: responseData.schedule?.lastExecution,
      };
      
      updateBotInContext(bot.id, updates);
      showSuccess('Scheduling settings saved successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showError('Failed to save scheduling settings', errorMessage);
      console.error('Error saving scheduling settings:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => showSuccess('Copied to clipboard'))
      .catch(() => showError('Failed to copy to clipboard'));
  };

  // Helper function to determine composite execution status
  const getExecutionStatus = (currentBot: BotType | null) => {
    if (!currentBot) return { canExecute: false, status: 'Unknown', color: 'bg-gray-500/20 text-gray-400', priority: 'bot' };
    
    const isScheduled = currentBot.isScheduled && currentBot.cronSchedule;
    
    // Bot status takes priority over scheduling status
    switch (currentBot.status) {
      case 'paused':
        return {
          canExecute: false,
          status: isScheduled ? 'Paused - Schedule Inactive' : 'Paused - Manual Only',
          color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
          priority: 'bot',
          reason: 'Bot is paused',
          action: 'Resume bot to activate schedule'
        };
      case 'error':
        return {
          canExecute: false,
          status: isScheduled ? 'Error - Schedule Suspended' : 'Error - Manual Only',
          color: 'bg-red-500/20 text-red-400 border-red-500/30',
          priority: 'bot',
          reason: 'Bot has errors',
          action: 'Fix bot issues to resume execution'
        };
      case 'inactive':
        return {
          canExecute: false,
          status: isScheduled ? 'Inactive - Schedule Disabled' : 'Inactive - Manual Only',
          color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
          priority: 'bot',
          reason: 'Bot is inactive',
          action: 'Activate bot to enable schedule'
        };
      case 'setup':
        return {
          canExecute: false,
          status: isScheduled ? 'Setup Required - Schedule Pending' : 'Setup Required - Manual Only',
          color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
          priority: 'bot',
          reason: 'Bot setup is incomplete',
          action: 'Complete bot configuration to enable execution'
        };
      case 'active':
        return {
          canExecute: isScheduled,
          status: isScheduled ? 'Active & Scheduled' : 'Active - Manual Only',
          color: isScheduled ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-gray-500/20 text-gray-400 border-gray-500/30',
          priority: isScheduled ? 'scheduled' : 'manual',
          reason: isScheduled ? 'Bot is active and scheduled' : 'No schedule configured',
          action: isScheduled ? undefined : 'Configure schedule for automatic execution'
        };
      default:
        return {
          canExecute: false,
          status: 'Unknown Status',
          color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
          priority: 'bot'
        };
    }
  };

  const executionStatus = getExecutionStatus(bot);

  // Helper function to get dynamic alert content
  const getAlertContent = () => {
    if (!bot) return null;
    
    const isScheduled = bot.isScheduled && bot.cronSchedule;
    
    switch (bot.status) {
      case 'paused':
        if (isScheduled) {
          return {
            type: 'warning' as const,
            icon: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
            message: 'Bot is paused - schedule is temporarily inactive. Resume the bot to reactivate automatic execution according to the cron schedule.',
            bgColor: 'bg-yellow-500/10 border-yellow-500/30',
            textColor: 'text-yellow-300'
          };
        }
        return {
          type: 'warning' as const,
          icon: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
          message: 'Bot is paused and has no schedule. Resume the bot and configure a schedule for automatic execution.',
          bgColor: 'bg-yellow-500/10 border-yellow-500/30',
          textColor: 'text-yellow-300'
        };
      
      case 'error':
        if (isScheduled) {
          return {
            type: 'error' as const,
            icon: <AlertTriangle className="w-4 h-4 text-red-400" />,
            message: 'Bot has errors - schedule is suspended. Check the bot overview and strategy pages to resolve issues before resuming execution.',
            bgColor: 'bg-red-500/10 border-red-500/30',
            textColor: 'text-red-300'
          };
        }
        return {
          type: 'error' as const,
          icon: <AlertTriangle className="w-4 h-4 text-red-400" />,
          message: 'Bot has errors and cannot execute. Fix the issues before configuring automatic execution.',
          bgColor: 'bg-red-500/10 border-red-500/30',
          textColor: 'text-red-300'
        };
      
      case 'inactive':
        if (isScheduled) {
          return {
            type: 'info' as const,
            icon: <Info className="w-4 h-4 text-blue-400" />,
            message: 'Bot is inactive - schedule is disabled. Activate the bot to enable automatic execution.',
            bgColor: 'bg-blue-500/10 border-blue-500/30',
            textColor: 'text-blue-300'
          };
        }
        return {
          type: 'info' as const,
          icon: <Info className="w-4 h-4 text-gray-400" />,
          message: 'Bot is inactive. Activate the bot and configure a schedule for automatic execution.',
          bgColor: 'bg-gray-500/10 border-gray-500/30',
          textColor: 'text-gray-300'
        };
      
      case 'setup':
        if (isScheduled) {
          return {
            type: 'info' as const,
            icon: <Info className="w-4 h-4 text-blue-400" />,
            message: 'Bot setup is incomplete - schedule is pending. Complete the bot configuration to enable automatic execution.',
            bgColor: 'bg-blue-500/10 border-blue-500/30',
            textColor: 'text-blue-300'
          };
        }
        return {
          type: 'info' as const,
          icon: <Info className="w-4 h-4 text-blue-400" />,
          message: 'Bot requires setup. Complete the configuration and add a schedule for automatic execution.',
          bgColor: 'bg-blue-500/10 border-blue-500/30',
          textColor: 'text-blue-300'
        };
      
      case 'active':
        if (isScheduled) {
          return {
            type: 'success' as const,
            icon: <CheckCircle className="w-4 h-4 text-green-400" />,
            message: 'Bot is active and scheduled for automatic execution. It will run according to the configured cron schedule.',
            bgColor: 'bg-green-500/10 border-green-500/30',
            textColor: 'text-green-300'
          };
        }
        return {
          type: 'info' as const,
          icon: <Info className="w-4 h-4 text-gray-400" />,
          message: 'Bot is active but has no schedule. Configure automatic execution above or use the "Execute Now" button for manual runs.',
          bgColor: 'bg-gray-500/10 border-gray-500/30',
          textColor: 'text-gray-300'
        };
      
      default:
        return {
          type: 'info' as const,
          icon: <Info className="w-4 h-4 text-gray-400" />,
          message: 'Bot status unknown. Check the bot configuration.',
          bgColor: 'bg-gray-500/10 border-gray-500/30',
          textColor: 'text-gray-300'
        };
    }
  };

  const alertContent = getAlertContent();

  const colorizeLogLine = (line: string) => {
    // Remove any existing color/style codes
    const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '');
    
    // Define patterns and their corresponding classes
    const patterns = [
      { regex: /^.*\b(ERROR|FATAL|FAIL)\b.*$/i, className: 'text-red-400' },
      { regex: /^.*\b(WARN|WARNING)\b.*$/i, className: 'text-yellow-400' },
      { regex: /^.*\b(INFO|INFORMATION)\b.*$/i, className: 'text-blue-400' },
      { regex: /^.*\b(DEBUG|TRACE)\b.*$/i, className: 'text-gray-400' },
      { regex: /^.*\b(SUCCESS|PASS|OK)\b.*$/i, className: 'text-green-400' },
      { regex: /^\[.*\]/i, className: 'text-purple-400' }, // Timestamps or brackets
      { regex: /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, className: 'text-cyan-400' }, // ISO timestamps
      { regex: /\b\d{2}:\d{2}:\d{2}/, className: 'text-cyan-400' }, // Time stamps
      { regex: /\b(GET|POST|PUT|DELETE|PATCH)\b/i, className: 'text-orange-400' }, // HTTP methods
      { regex: /\b(200|201|204|301|302|400|401|403|404|500|502|503)\b/, className: 'text-pink-400' }, // HTTP status codes
      { regex: /\$\d+|\d+ms|\d+s|\d+%/g, className: 'text-emerald-400' }, // Numbers with units
    ];

    // Apply coloring
    let coloredLine = cleanLine;
    for (const pattern of patterns) {
      if (pattern.regex.test(coloredLine)) {
        return { line: coloredLine, className: pattern.className };
      }
    }

    return { line: coloredLine, className: 'text-card-foreground' };
  };

  const renderColorizedLogs = (logs: string) => {
    const lines = logs.split('\n');
    return lines.map((line, index) => {
      const { line: processedLine, className } = colorizeLogLine(line);
      return (
        <div key={index} className={className}>
          {processedLine}
        </div>
      );
    });
  };

  if (!bot) {
    return null; // Layout will handle loading state
  }

  return (
    <div className="space-y-4 mb-96">
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
              <div className="flex items-center space-x-3">
                <Switch
                  id="enable-scheduling"
                  checked={schedulingSettings.isScheduled}
                  onCheckedChange={(checked) => setSchedulingSettings(prev => ({ ...prev, isScheduled: checked }))}
                />
                <Label htmlFor="enable-scheduling" className="text-sm font-medium text-card-foreground">
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
                <span className="text-sm text-muted-foreground">Execution Status</span>
                <div className="flex items-center gap-2">
                  <Badge className={executionStatus.color}>
                    {executionStatus.status}
                  </Badge>
                  {executionStatus.priority === 'bot' && (
                    <Badge variant="outline" className="text-xs">
                      Bot: {bot?.status}
                    </Badge>
                  )}
                </div>
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
                <div className="text-sm text-card-foreground">
                  {executionStatus.canExecute && bot?.nextExecution ? (
                    <CountdownTimer
                      targetDate={bot.nextExecution}
                      className="text-sm"
                    />
                  ) : executionStatus.canExecute ? (
                    'Calculating...'
                  ) : executionStatus.action ? (
                    <span className="text-muted-foreground italic">{executionStatus.action}</span>
                  ) : (
                    'Not scheduled'
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Total Executions</span>
                <span className="text-sm font-semibold text-card-foreground">
                  {bot?.executionCount || 0}
                </span>
              </div>
            </div>

            {alertContent && (
              <Alert className={alertContent.bgColor}>
                {alertContent.icon}
                <AlertDescription className={alertContent.textColor}>
                  {alertContent.message}
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
            <Badge variant="secondary" className="ml-auto">
              Last 20 executions
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const currentBotId = bot?.id || botId;
                if (currentBotId) {
                  fetchExecutionHistory(currentBotId);
                }
              }}
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

                const isExpanded = expandedExecution === execution.id;
                const hasLogs = Boolean(execution.logsUrl);

                return (
                  <div key={execution.id} className="bg-muted rounded-lg overflow-hidden">
                    <div
                      className={`p-4 space-y-3 ${hasLogs ? 'cursor-pointer hover:bg-muted/80' : ''}`}
                      onClick={hasLogs ? () => toggleExecutionExpansion(execution.id) : undefined}
                    >
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
                          {hasLogs && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <motion.div
                                animate={{ rotate: isExpanded ? 90 : 0 }}
                                transition={{ duration: 0.2, ease: "easeInOut" }}
                              >
                                <ChevronRight className="w-4 h-4" />
                              </motion.div>
                              <FileText className="w-4 h-4" />
                              <span className="text-xs">
                                {execution.logsSize ? `${Math.round(execution.logsSize / 1024)}KB logs` : 'View logs'}
                              </span>
                            </div>
                          )}
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
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(execution.transactionId!);
                            }}
                            className="text-blue-400 hover:text-blue-300 font-mono"
                          >
                            {execution.transactionId.slice(0, 16)}...
                          </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`https://explorer.stacks.co/txid/${execution.transactionId}`, '_blank');
                            }}
                            className="h-6 w-6 p-0"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Expandable Logs Section */}
                    <AnimatePresence>
                      {isExpanded && hasLogs && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{
                            duration: 0.3,
                            ease: "easeInOut",
                            opacity: { duration: 0.2 }
                          }}
                          className="border-t border-border/25 bg-background/30 overflow-hidden"
                        >
                          <motion.div
                            initial={{ y: -10 }}
                            animate={{ y: 0 }}
                            exit={{ y: -10 }}
                            transition={{ duration: 0.2, delay: 0.1 }}
                            className="p-4"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-medium text-card-foreground">Execution Logs</span>
                                {execution.logsSize && (
                                  <Badge variant="secondary" className="text-xs">
                                    {Math.round(execution.logsSize / 1024)}KB
                                  </Badge>
                                )}
                              </div>
                              {loadingLogs === execution.id && (
                                <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                              )}
                            </div>

                            {loadingLogs === execution.id ? (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.2 }}
                                className="bg-background/50 p-4 rounded border text-center text-muted-foreground"
                              >
                                Loading logs...
                              </motion.div>
                            ) : executionLogs[execution.id] ? (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.2, delay: 0.1 }}
                                className="bg-background/50 p-4 rounded border border-border/25"
                              >
                                <div className="text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                                  {renderColorizedLogs(executionLogs[execution.id])}
                                </div>
                              </motion.div>
                            ) : (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.2 }}
                                className="bg-background/50 p-4 rounded border text-center text-muted-foreground"
                              >
                                Failed to load logs
                              </motion.div>
                            )}
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
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
'use client';

import { useUser } from '@clerk/nextjs';
import { AnimatePresence, motion } from 'framer-motion';
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
import { useParams } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';

import { CountdownTimer } from '@/components/countdown-timer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBots } from '@/contexts/bot-context';
import { useToast } from '@/contexts/toast-context';
import { formatRelativeTime } from '@/lib/utils';
import { Bot as BotType } from '@/schemas/bot.schema';

export default function BotSchedulingPage() {
  const { currentBot: bot, updateBotInContext, setCurrentBot } = useBots();
  const { showSuccess, showError } = useToast();
  const { user } = useUser();
  const params = useParams();
  const botId = params?.id as string;
  const [schedulingSettings, setSchedulingSettings] = useState({
    cronSchedule: ''
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
  const [expandedExecution, setExpandedExecution] = useState<string | null>(null);
  const [executionLogs, setExecutionLogs] = useState<{ [key: string]: string }>({});
  const [loadingLogs, setLoadingLogs] = useState<string | null>(null);
  const [showConfiguration, setShowConfiguration] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    if (bot) {
      // Sync scheduling settings with current bot data
      setSchedulingSettings({
        cronSchedule: bot.cronSchedule || ''
      });
      // Use execution history from bot object (loaded via bot API)
      setExecutionHistory(bot.executions || []);
    }
  }, [bot]);

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

    setIsSaving(true);
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
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update scheduling settings');
      }

      const responseData = await response.json();

      // Update bot in context immediately for instant UI feedback
      const updates: Partial<BotType> = {
        cronSchedule: schedulingSettings.cronSchedule || undefined,
        nextExecution: responseData.schedule?.nextExecution,
        lastExecution: responseData.schedule?.lastExecution,
      };

      updateBotInContext(bot.id, updates);
      setShowConfiguration(false);
      showSuccess('Schedule saved successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showError('Failed to save schedule', errorMessage);
      console.error('Error saving schedule:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearSchedule = async () => {
    if (!bot) return;

    setIsClearing(true);
    try {
      const response = await fetch(`/api/v1/bots/${bot.id}/schedule`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to clear schedule');
      }

      // Update local state
      setSchedulingSettings({ cronSchedule: '' });
      const updates: Partial<BotType> = {
        cronSchedule: undefined,
        nextExecution: undefined,
      };
      updateBotInContext(bot.id, updates);

      showSuccess('Schedule cleared successfully');
    } catch (error) {
      console.error('Error clearing schedule:', error);
      showError('Failed to clear schedule. Please try again.');
    } finally {
      setIsClearing(false);
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

    const isScheduled = currentBot.cronSchedule && currentBot.status === 'active';

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



  const colorizeLogLine = (line: string) => {
    // Remove any existing color/style codes
    const cleanLine = line.replace(/\u001b\[[0-9;]*m/g, '');

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
    const coloredLine = cleanLine;
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
    <div className="space-y-6 mb-96">
      {/* Main Status Dashboard */}
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Status Display */}
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30">
                {executionStatus.canExecute ? (
                  <Activity className="w-8 h-8 text-green-400" />
                ) : bot?.cronSchedule ? (
                  <Clock className="w-8 h-8 text-yellow-400" />
                ) : (
                  <Calendar className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-card-foreground">
                    {executionStatus.canExecute ? 'Automated' : bot?.cronSchedule ? 'Scheduled' : 'Manual'}
                  </h2>
                  <Badge className={executionStatus.color}>
                    {executionStatus.status}
                  </Badge>
                </div>
                <p className="text-muted-foreground">
                  {executionStatus.reason}
                </p>
              </div>
            </div>

            {/* Context-Sensitive Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              {!bot?.cronSchedule ? (
                <Button
                  onClick={() => setShowConfiguration(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Set Schedule
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setShowConfiguration(true)}
                    className="border-border text-foreground"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Edit Schedule
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleClearSchedule}
                    className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                    disabled={isClearing}
                  >
                    {isClearing ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Clearing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Clear Schedule
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
            <div className="text-center">
              <div className="text-2xl font-bold text-card-foreground">
                {bot?.cronSchedule ? (
                  <span className="font-mono text-sm bg-muted px-2 py-1 rounded">{bot.cronSchedule}</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Schedule</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-card-foreground">
                {bot?.lastExecution ? formatRelativeTime(bot.lastExecution) : 'Never'}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Last Run</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-card-foreground">
                {bot?.nextExecution ? (
                  // Check if nextExecution is in the future, otherwise show overdue
                  new Date(bot.nextExecution) > new Date() ? (
                    <CountdownTimer targetDate={bot.nextExecution} className="text-lg" />
                  ) : (
                    <span className="text-orange-400">Overdue</span>
                  )
                ) : bot?.cronSchedule ? (
                  <span className="text-muted-foreground">Calculating...</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Next Run</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-card-foreground">{bot?.executionCount || 0}</div>
              <div className="text-xs text-muted-foreground mt-1">Total Runs</div>
            </div>
          </div>

          {/* Mini Execution Timeline */}
          {executionHistory.length > 0 && (
            <div className="mt-6 pt-6 border-t border-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-card-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Recent Executions
                </h3>
                <div className="text-xs text-muted-foreground">
                  Last {Math.min(executionHistory.length, 20)} executions
                </div>
              </div>
              <div className="flex overflow-x-auto gap-2 pb-2 p-2">
                {executionHistory.slice(0, 20).map((execution, index) => {
                  const isLatest = index === 0;
                  const statusColor = execution.status === 'success'
                    ? 'bg-green-500/20 border-green-500/30 text-green-400'
                    : execution.status === 'failure'
                      ? 'bg-red-500/20 border-red-500/30 text-red-400'
                      : execution.status === 'timeout'
                        ? 'bg-orange-500/20 border-orange-500/30 text-orange-400'
                        : 'bg-blue-500/20 border-blue-500/30 text-blue-400';

                  const statusIcon = execution.status === 'success'
                    ? <CheckCircle className="w-3 h-3" />
                    : execution.status === 'failure'
                      ? <AlertTriangle className="w-3 h-3" />
                      : execution.status === 'timeout'
                        ? <Clock className="w-3 h-3" />
                        : <RefreshCw className="w-3 h-3" />;

                  return (
                    <div
                      key={execution.id}
                      className={`flex-shrink-0 p-3 rounded-lg border ${statusColor} ${isLatest ? 'ring-2 ring-blue-500/20' : ''
                        } min-w-[120px] relative group cursor-pointer hover:brightness-105 hover:scale-105 hover:shadow-lg transition-all`}
                      title={`${execution.status} - ${formatRelativeTime(execution.startedAt)}`}
                      onClick={() => {
                        // Scroll to the execution history section
                        const historyElement = document.querySelector('[data-execution-history]');
                        if (historyElement) {
                          historyElement.scrollIntoView({ behavior: 'smooth' });
                          // Find and expand this specific execution
                          const executionElement = document.querySelector(`[data-execution-id="${execution.id}"]`);
                          if (executionElement && execution.logsUrl) {
                            toggleExecutionExpansion(execution.id);
                          }
                        }
                      }}
                    >
                      {isLatest && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                      )}
                      <div className="flex items-center gap-2 mb-1">
                        {statusIcon}
                        <span className="text-xs font-medium capitalize">{execution.status}</span>
                      </div>
                      <div className="text-xs opacity-75">
                        {formatRelativeTime(execution.startedAt)}
                      </div>
                      {execution.executionTime && (
                        <div className="text-xs opacity-60 mt-1">
                          {execution.executionTime}ms
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* View All Link */}
                <div className="flex-shrink-0 flex items-center">
                  <button
                    onClick={() => {
                      const historyElement = document.querySelector('[data-execution-history]');
                      if (historyElement) {
                        historyElement.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    className="p-3 rounded-lg border border-border text-muted-foreground hover:text-card-foreground hover:border-border transition-colors min-w-[80px] flex flex-col items-center justify-center gap-1"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span className="text-xs">View All</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expandable Configuration Panel */}
      <AnimatePresence>
        {showConfiguration && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-card-foreground flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Schedule Configuration
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowConfiguration(false)}
                  >
                    <ChevronRight className="w-4 h-4 rotate-90" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Quick Presets */}
                <div className="space-y-3">
                  <Label className="text-card-foreground text-sm font-medium">Quick Presets</Label>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {[
                      { label: '5 min', value: '*/5 * * * *' },
                      { label: '15 min', value: '*/15 * * * *' },
                      { label: '30 min', value: '*/30 * * * *' },
                      { label: 'Hourly', value: '0 * * * *' },
                      { label: '6 hours', value: '0 */6 * * *' },
                      { label: 'Daily', value: '0 0 * * *' },
                      { label: 'Weekly', value: '0 0 * * 1' },
                      { label: 'Monthly', value: '0 0 1 * *' },
                    ].map((preset) => (
                      <Button
                        key={preset.value}
                        variant="outline"
                        size="sm"
                        onClick={() => setSchedulingSettings({ cronSchedule: preset.value })}
                        className={`text-xs ${schedulingSettings.cronSchedule === preset.value
                          ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                          : 'border-border text-muted-foreground hover:text-card-foreground'
                          }`}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Custom Cron Expression */}
                <div className="space-y-3">
                  <Label className="text-card-foreground text-sm font-medium">Custom Schedule</Label>
                  <Input
                    placeholder="0 */4 * * * (every 4 hours)"
                    value={schedulingSettings.cronSchedule}
                    onChange={(e) => setSchedulingSettings({ cronSchedule: e.target.value })}
                    className="bg-input border-border text-foreground font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Format: minute hour day month weekday. Use{' '}
                    <a
                      href="https://crontab.guru"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      crontab.guru
                    </a>{' '}
                    for help with cron expressions.
                  </p>
                </div>

                {/* How It Works - Condensed */}
                <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-blue-300">Automatic Execution Requirements</h4>
                      <ul className="text-xs text-blue-200/80 space-y-1">
                        <li>• Bot status must be "Active"</li>
                        <li>• Valid cron schedule must be set</li>
                        <li>• Current time matches schedule timing</li>
                      </ul>
                      <p className="text-xs text-blue-200/60">
                        💡 Tip: Change bot status to "Paused" to temporarily stop automatic execution
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleSaveScheduling}
                    className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
                    disabled={!schedulingSettings.cronSchedule || isSaving}
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4 mr-2" />
                        Save Schedule
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSchedulingSettings({ cronSchedule: bot?.cronSchedule || '' });
                      setShowConfiguration(false);
                    }}
                    className="border-border text-foreground"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Execution History */}
      <Card className="bg-card border-border" data-execution-history>
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
                  // Refresh the current bot data (which includes execution history)
                  setCurrentBot(currentBotId);
                }
              }}
              disabled={false}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {executionHistory.length === 0 ? (
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
                  <div key={execution.id} className="bg-muted rounded-lg overflow-hidden" data-execution-id={execution.id}>
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
                            <div className="font-medium text-card-foreground font-mono">
                              <span className="text-muted-foreground text-sm">Execution</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <div className=" text-card-foreground">
                                {formatRelativeTime(execution.startedAt)}
                              </div>
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
                                {/* show 1 decimal place */}
                                {execution.logsSize ? `${(execution.logsSize / 1024).toFixed(1)}KB logs` : 'View logs'}
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
                                    {/* show 1 decimal place */}
                                    {(execution.logsSize / 1024).toFixed(1)}KB
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
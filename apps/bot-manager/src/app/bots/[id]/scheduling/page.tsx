'use client';

import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  ExternalLink,
  Info,
  Play,
  RefreshCw,
} from 'lucide-react';
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
import { useCurrentBot } from '@/contexts/current-bot-context';
import { useToast } from '@/contexts/toast-context';
import { useWallet } from '@/contexts/wallet-context';
import { formatRelativeTime } from '@/lib/utils';
import { Bot as BotType } from '@/schemas/bot.schema';

export default function BotSchedulingPage() {
  const { bot } = useCurrentBot();
  const { showSuccess, showError } = useToast();
  const { getUserId, authenticatedFetchWithTimestamp } = useWallet();

  const [localBot, setLocalBot] = useState<BotType | null>(null);
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
  }>>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (bot) {
      setLocalBot(bot);
      // Sync scheduling settings
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
      const userId = getUserId();
      const response = await fetch(`/api/v1/bots/${botId}/executions?userId=${encodeURIComponent(userId)}`);
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

  const handleSaveScheduling = async () => {
    if (!bot) return;

    try {
      const userId = getUserId();
      const message = `update_schedule_${bot.id}`;

      const response = await authenticatedFetchWithTimestamp(`/api/v1/bots/${bot.id}/schedule?userId=${encodeURIComponent(userId)}`, {
        method: 'PUT',
        message,
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

      const updatedBot = await response.json();
      setLocalBot(updatedBot);
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

  if (!bot) {
    return null; // Layout will handle loading state
  }

  return (
    <div className="space-y-4">
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
              <Button
                variant="outline"
                onClick={async () => {
                  if (!(localBot || bot)) return;
                  try {
                    showSuccess('Triggering manual execution...', 'This may take a moment');
                    // Manual execution trigger would call the sandbox service
                    // For now, just refresh the execution history
                    await fetchExecutionHistory((localBot || bot)!.id);
                  } catch (error) {
                    showError('Failed to trigger manual execution');
                  }
                }}
                className="border-green-600 text-green-400 hover:bg-green-500/10"
              >
                <Play className="w-4 h-4 mr-2" />
                Execute Now
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
                <span className="text-sm text-muted-foreground">Current Status</span>
                <Badge className={(localBot || bot)?.isScheduled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
                  {(localBot || bot)?.isScheduled ? 'Scheduled' : 'Manual Only'}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Cron Expression</span>
                <span className="text-sm font-mono text-card-foreground">
                  {(localBot || bot)?.cronSchedule || 'Not set'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Last Execution</span>
                <span className="text-sm text-card-foreground">
                  {(localBot || bot)?.lastExecution ? formatRelativeTime((localBot || bot)!.lastExecution!) : 'Never'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Next Execution</span>
                <div className="text-sm text-card-foreground">
                  {(localBot || bot)?.nextExecution ? (
                    <CountdownTimer
                      targetDate={(localBot || bot)!.nextExecution!}
                      className="text-sm"
                    />
                  ) : (
                    'Not scheduled'
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Total Executions</span>
                <span className="text-sm font-semibold text-card-foreground">
                  {(localBot || bot)?.executionCount || 0}
                </span>
              </div>
            </div>

            {(localBot || bot)?.isScheduled && (
              <Alert className="bg-blue-500/10 border-blue-500/30">
                <Info className="w-4 h-4 text-blue-400" />
                <AlertDescription className="text-blue-300">
                  This bot is configured for automatic execution. It will run based on the cron schedule.
                </AlertDescription>
              </Alert>
            )}

            {!(localBot || bot)?.isScheduled && (
              <Alert className="bg-yellow-500/10 border-yellow-500/30">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <AlertDescription className="text-yellow-300">
                  Automatic execution is disabled. The bot will only run when manually triggered.
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
            <Badge variant="outline" className="ml-auto">
              Last 20 executions
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (localBot || bot) && fetchExecutionHistory((localBot || bot)!.id)}
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

                return (
                  <div key={execution.id} className="p-4 bg-muted rounded-lg space-y-3">
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
                          onClick={() => copyToClipboard(execution.transactionId!)}
                          className="text-blue-400 hover:text-blue-300 font-mono"
                        >
                          {execution.transactionId.slice(0, 16)}...
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`https://explorer.stacks.co/txid/${execution.transactionId}`, '_blank')}
                          className="h-6 w-6 p-0"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
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
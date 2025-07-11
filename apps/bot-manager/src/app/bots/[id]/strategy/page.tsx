'use client';

import {
  Activity,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { StrategyCodeEditor } from '@/components/strategy-code-editor';
import type { HelpContextualInfo } from '@/lib/help/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useBots } from '@/contexts/bot-context';
import { useCurrentBot } from '@/contexts/current-bot-context';
import { useToast } from '@/contexts/toast-context';
import { useWallet } from '@/contexts/wallet-context';
import type { SandboxStreamEvent } from '@/lib/services/sandbox/client';
import { sandboxClient } from '@/lib/services/sandbox/client';
import { Bot as BotType } from '@/schemas/bot.schema';

export default function BotStrategyPage() {
  const { bot } = useCurrentBot();
  const { updateBot } = useBots();
  const { showSuccess, showError } = useToast();
  const { walletState } = useWallet();

  const [localBot, setLocalBot] = useState<BotType | null>(null);
  const [executionLogs, setExecutionLogs] = useState<Array<{ type: string, level?: string, message: string, timestamp: string }>>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showRepoConfig, setShowRepoConfig] = useState(false);

  // Help contextual info for strategy editor
  const helpContextualInfo: HelpContextualInfo = {
    currentRepository: localBot ? {
      gitUrl: localBot.gitRepository || 'https://github.com/pointblankdev/charisma',
      subPath: localBot.packagePath || 'bots/basic',
      availablePackages: localBot.availablePackages || ['@stacks/transactions', '@bots/basic'],
      buildCommands: localBot.buildCommands || ['pnpm install', 'pnpm build']
    } : undefined
  };

  useEffect(() => {
    if (bot) {
      setLocalBot(bot);
    }
  }, [bot]);

  const handleTestStrategy = async (code: string) => {
    if (!bot) return;

    setIsExecuting(true);
    setExecutionLogs([]);

    try {
      showSuccess('Testing strategy in sandbox...', 'This may take a moment');

      await sandboxClient.executeStrategyWithStreaming(
        bot.id,
        code,
        (event: SandboxStreamEvent) => {
          // Add log entry for display
          setExecutionLogs(prev => [...prev, {
            type: event.type,
            level: event.level,
            message: event.message || (event.type === 'error' ? event.error : '') || '',
            timestamp: event.timestamp
          }]);

          // Handle specific event types
          if (event.type === 'result') {
            if (event.success) {
              showSuccess('Strategy test completed successfully!',
                `Execution time: ${event.executionTime}ms`
              );
            } else {
              showError('Strategy test failed', event.error || 'Unknown error');
            }
          } else if (event.type === 'error') {
            showError('Strategy execution error', event.error || 'Unknown error');
          } else if (event.type === 'done') {
            setIsExecuting(false);
          }
        },
        {
          timeout: 2, // 2 minutes
          enableLogs: true
        }
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showError('Failed to test strategy', errorMessage);
      console.error('Strategy test exception:', error);
      setIsExecuting(false);
    }
  };

  const handleSaveBot = async () => {
    if (!localBot || !bot) return;

    setIsSaving(true);
    try {
      await updateBot(bot.id, {
        strategy: localBot.strategy,
        gitRepository: localBot.gitRepository,
        isMonorepo: localBot.isMonorepo,
        packagePath: localBot.packagePath,
        buildCommands: localBot.buildCommands,
      });
      showSuccess('Bot configuration saved successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showError('Failed to save bot configuration', errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  if (!bot) {
    return null; // Layout will handle loading state
  }

  return (
    <div className="space-y-4">
      {/* Repository Configuration */}
      <Card className="bg-card border-border">
        <CardHeader
          className="cursor-pointer"
          onClick={() => setShowRepoConfig(!showRepoConfig)}
        >
          <div className="flex items-center gap-2">
            {showRepoConfig ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <CardTitle className="text-card-foreground">Run Your Own Code</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            {showRepoConfig ?
              "Configure a starting point for your strategy execution. Specify a git repository to load dependencies and run setup commands, or leave empty to run in a clean Node.js environment." :
              "Click to configure a custom git repository as the starting point for your strategy execution."
            }
          </p>
        </CardHeader>
        {showRepoConfig && (
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="gitRepository" className="text-card-foreground">Git Repository URL (optional)</Label>
              <Input
                id="gitRepository"
                type="url"
                value={localBot?.gitRepository || ''}
                onChange={(e) => localBot && setLocalBot({ ...localBot, gitRepository: e.target.value })}
                placeholder="https://github.com/username/repository.git"
                className="bg-input border-border text-foreground"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Must be a public repository. This becomes the starting point for your strategy execution with access to any dependencies or files in the repo.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isMonorepo"
                checked={localBot?.isMonorepo || false}
                onCheckedChange={(checked) => localBot && setLocalBot({ ...localBot, isMonorepo: checked })}
              />
              <Label htmlFor="isMonorepo" className="text-card-foreground">This is a monorepo</Label>
            </div>

            {localBot?.isMonorepo && (
              <div>
                <Label htmlFor="packagePath" className="text-card-foreground">Package Path</Label>
                <Input
                  id="packagePath"
                  type="text"
                  value={localBot?.packagePath || ''}
                  onChange={(e) => localBot && setLocalBot({ ...localBot, packagePath: e.target.value })}
                  placeholder="packages/polyglot"
                  className="bg-input border-border text-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Path to the package within the monorepo (e.g., "packages/polyglot")
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="buildCommands" className="text-card-foreground">Setup Commands</Label>
              <div className="space-y-2">
                {(localBot?.buildCommands || ['pnpm install', 'pnpm run build']).map((command, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      type="text"
                      value={command}
                      onChange={(e) => {
                        if (localBot) {
                          const newCommands = [...(localBot.buildCommands || ['pnpm install', 'pnpm run build'])];
                          newCommands[index] = e.target.value;
                          setLocalBot({ ...localBot, buildCommands: newCommands });
                        }
                      }}
                      placeholder="pnpm install"
                      className="bg-input border-border text-foreground"
                    />
                    {(localBot?.buildCommands || []).length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          if (localBot) {
                            const newCommands = (localBot.buildCommands || []).filter((_, i) => i !== index);
                            setLocalBot({ ...localBot, buildCommands: newCommands });
                          }
                        }}
                        className="shrink-0"
                      >
                        ×
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (localBot) {
                      const newCommands = [...(localBot.buildCommands || ['pnpm install', 'pnpm run build']), ''];
                      setLocalBot({ ...localBot, buildCommands: newCommands });
                    }
                  }}
                  className="w-full"
                >
                  Add Command
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Commands to run after cloning the repository. Use this to install dependencies, build packages, or run any setup needed for your strategy. Common examples: "pnpm install", "npm run build"
              </p>
            </div>

            <div className="pt-4 border-t border-border flex justify-end">
              <Button
                onClick={handleSaveBot}
                disabled={isSaving}
                size="sm"
              >
                {isSaving ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Strategy Code */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">Strategy Code</CardTitle>
        </CardHeader>
        <CardContent>
          <StrategyCodeEditor
            initialCode={bot?.strategy || ''}
            onSave={async (code) => {
              if (!localBot) return;

              try {
                // Update the local bot's strategy code
                setLocalBot({ ...localBot, strategy: code });

                // Save to database without global loading state
                const response = await fetch(`/api/v1/bots?userId=${walletState.address}&botId=${localBot.id}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ ...localBot, strategy: code }),
                });

                if (!response.ok) {
                  throw new Error('Failed to save strategy');
                }

                showSuccess('Strategy saved successfully');
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Failed to save strategy';
                showError('Save failed', errorMessage);
              }
            }}
            onTest={handleTestStrategy}
            height="400px"
            helpContextualInfo={helpContextualInfo}
          />
        </CardContent>
      </Card>

      {/* Execution Logs */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Execution Logs
            {isExecuting && (
              <Badge variant="outline" className="ml-auto border-blue-500/30 text-blue-400">
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                Executing
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm">
            {executionLogs.length === 0 ? (
              <div className="text-muted-foreground text-center py-8">
                No execution logs yet. Click "Test Strategy" to see real-time logs.
              </div>
            ) : (
              <div className="space-y-1">
                {executionLogs.map((log, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-2 text-xs ${log.type === 'error' || log.level === 'error'
                      ? 'text-red-400'
                      : log.type === 'status'
                        ? 'text-blue-400'
                        : log.level === 'warn'
                          ? 'text-yellow-400'
                          : 'text-foreground'
                      }`}
                  >
                    <span className="text-muted-foreground shrink-0 w-24">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="shrink-0 w-12 uppercase text-xs font-semibold">
                      {log.type}
                    </span>
                    <span className="break-all">{log.message || ''}</span>
                  </div>
                ))}
              </div>
            )}
            {isExecuting && executionLogs.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-blue-400 mt-2">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Streaming logs...</span>
              </div>
            )}
          </div>
          {executionLogs.length > 0 && (
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-muted-foreground">
                {executionLogs.length} log entries
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExecutionLogs([])}
                className="text-xs"
              >
                Clear Logs
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
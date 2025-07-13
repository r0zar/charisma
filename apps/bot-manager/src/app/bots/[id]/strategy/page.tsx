'use client';

import {
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { PublicBotOverview } from '@/components/public-bot-overview';
import { StrategyCodeEditor } from '@/components/strategy-code-editor';
import type { HelpContextualInfo } from '@/components/strategy-editor-help/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useBots } from '@/contexts/bot-context';
import { useToast } from '@/contexts/toast-context';
import { useWallet } from '@/contexts/wallet-context';
import type { SandboxStreamEvent } from '@/lib/services/bots/client';
import { sandboxClient } from '@/lib/services/bots/client';
import { Bot as BotType } from '@/schemas/bot.schema';

export default function BotStrategyPage() {
  const { currentBot: bot, isOwnBot, updateBot } = useBots();
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

    // Only allow execution for owned bots
    if (!isOwnBot) {
      showError('Cannot execute strategy', 'You can only execute bots that you own');
      return;
    }

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

  // Show public overview for non-owned bots
  if (!isOwnBot) {
    return <PublicBotOverview bot={bot} />;
  }

  return (
    <div className="space-y-4 mb-96">
      {/* Repository Configuration */}
      <Card className="bg-card border-border">
        <CardHeader
          className="cursor-pointer p-2 sm:p-3"
          onClick={() => setShowRepoConfig(!showRepoConfig)}
        >
          <div className="flex items-center gap-2">
            {showRepoConfig ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 flex-shrink-0" />}
            <CardTitle className="text-card-foreground text-base sm:text-lg">Run Your Own Code</CardTitle>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
            {showRepoConfig ?
              "Configure a starting point for your strategy execution. Specify a git repository to load dependencies and run setup commands, or leave empty to run in a clean Node.js environment." :
              "Click to configure a custom git repository as the starting point for your strategy execution."
            }
          </p>
        </CardHeader>
        {showRepoConfig && (
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="space-y-2">
              <Label htmlFor="gitRepository" className="text-card-foreground text-sm font-medium">Git Repository URL (optional)</Label>
              <Input
                id="gitRepository"
                type="url"
                value={localBot?.gitRepository || ''}
                onChange={(e) => localBot && setLocalBot({ ...localBot, gitRepository: e.target.value })}
                placeholder="https://github.com/username/repository.git"
                className="bg-input border-border text-foreground text-sm"
              />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Must be a public repository. This becomes the starting point for your strategy execution with access to any dependencies or files in the repo.
              </p>
            </div>

            <div className="flex items-start sm:items-center space-x-3">
              <Switch
                id="isMonorepo"
                checked={localBot?.isMonorepo || false}
                onCheckedChange={(checked) => localBot && setLocalBot({ ...localBot, isMonorepo: checked })}
                className="mt-1 sm:mt-0"
              />
              <div className="space-y-1">
                <Label htmlFor="isMonorepo" className="text-card-foreground text-sm font-medium cursor-pointer">This is a monorepo</Label>
                <p className="text-xs text-muted-foreground">Enable if your repository contains multiple packages</p>
              </div>
            </div>

            {localBot?.isMonorepo && (
              <div className="space-y-2">
                <Label htmlFor="packagePath" className="text-card-foreground text-sm font-medium">Package Path</Label>
                <Input
                  id="packagePath"
                  type="text"
                  value={localBot?.packagePath || ''}
                  onChange={(e) => localBot && setLocalBot({ ...localBot, packagePath: e.target.value })}
                  placeholder="packages/polyglot"
                  className="bg-input border-border text-foreground text-sm"
                />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Path to the package within the monorepo (e.g., "packages/polyglot")
                </p>
              </div>
            )}

            <div className="space-y-3">
              <Label htmlFor="buildCommands" className="text-card-foreground text-sm font-medium">Setup Commands</Label>
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
                      className="bg-input border-border text-foreground text-sm"
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
                        className="shrink-0 h-9 w-9"
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
                  className="w-full text-sm"
                >
                  Add Command
                </Button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Commands to run after cloning the repository. Use this to install dependencies, build packages, or run any setup needed for your strategy. Common examples: "pnpm install", "npm run build"
              </p>
            </div>

            <div className="pt-4 border-t border-border flex flex-col sm:flex-row justify-end gap-2">
              <Button
                onClick={handleSaveBot}
                disabled={isSaving}
                size="sm"
                className="w-full sm:w-auto"
              >
                {isSaving ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Strategy Code */}
      <Card className="bg-card border-border">
        <CardContent className="px-2 sm:px-3 pt-0">
          <StrategyCodeEditor
            initialCode={bot?.strategy || ''}
            canExecute={isOwnBot}
            readOnly={!isOwnBot}
            onSave={isOwnBot ? async (code) => {
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
            } : undefined}
            onTest={handleTestStrategy}
            height="300px"
            helpContextualInfo={helpContextualInfo}
            executionLogs={executionLogs}
            isExecuting={isExecuting}
            onClearLogs={() => setExecutionLogs([])}
          />
        </CardContent>
      </Card>

      {/* Info Alert Section */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex gap-3 items-center flex-col sm:flex-row">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1 text-sm text-blue-300 leading-relaxed">
            <div>Write JavaScript or TypeScript code for your bot strategy.</div>
            <div>Use <code className="bg-blue-500/20 px-1 rounded text-blue-200">const &#123; makeContractCall &#125; = require('@stacks/transactions')</code> to import packages.</div>
            <div>The <code className="bg-blue-500/20 px-1 rounded text-blue-200">bot</code> object provides wallet credentials and context.</div>
          </div>
        </div>
      </div>

    </div>
  );
}
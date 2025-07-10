'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Activity,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCurrentBot } from '@/contexts/current-bot-context';
import { useToast } from '@/contexts/toast-context';
import { StrategyCodeEditor } from '@/components/strategy-code-editor';
import { Bot as BotType } from '@/schemas/bot.schema';
import { sandboxClient } from '@/lib/features/sandbox/client';
import type { SandboxStreamEvent } from '@/lib/features/sandbox/client';

export default function BotStrategyPage() {
  const { bot } = useCurrentBot();
  const { showSuccess, showError } = useToast();

  const [localBot, setLocalBot] = useState<BotType | null>(null);
  const [executionLogs, setExecutionLogs] = useState<Array<{ type: string, level?: string, message: string, timestamp: string }>>([]);
  const [isExecuting, setIsExecuting] = useState(false);

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
          testMode: true,
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

  if (!bot) {
    return null; // Layout will handle loading state
  }

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardContent>
          <StrategyCodeEditor
            initialCode={bot?.strategy || ''}
            onSave={async (code) => {
              // Update the bot's strategy code
              if (localBot) {
                setLocalBot({ ...localBot, strategy: code });
              }
              showSuccess('Strategy code saved successfully');
            }}
            onTest={handleTestStrategy}
            height="400px"
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
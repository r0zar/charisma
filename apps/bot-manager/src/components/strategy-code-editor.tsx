'use client';

import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import {
  Code,
  Play,
  Save,
  RotateCcw,
  FileText,
  AlertCircle,
  CheckCircle,
  Settings,
  Eye,
  Palette,
  Download,
  Upload,
  Zap,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { getStrategyDisplayName } from '@/lib/features/bots/strategy-parser';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { type StrategyMetadata } from '@/lib/features/bots/strategy-parser';

interface StrategyCodeEditorProps {
  initialCode?: string;
  initialMetadata?: StrategyMetadata;
  onCodeChange?: (code: string) => void;
  onMetadataChange?: (metadata: StrategyMetadata) => void;
  onSave?: (code: string) => void;
  onTest?: (code: string) => void;
  readOnly?: boolean;
  height?: string;
  className?: string;
}

export function StrategyCodeEditor({
  initialCode = '',
  initialMetadata,
  onCodeChange,
  onMetadataChange,
  onSave,
  onTest,
  readOnly = false,
  height = '500px',
  className = ''
}: StrategyCodeEditorProps) {
  const [code, setCode] = useState(initialCode);
  const [metadata, setMetadata] = useState<StrategyMetadata>(
    initialMetadata || {
      name: 'My Strategy',
      description: 'Strategy description',
      schedule: {
        cron: '0 */6 * * *', // Every 6 hours
        timezone: 'UTC'
      }
    }
  );
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const editorRef = useRef<any>(null);

  // Simple templates for basic strategy types
  const templates = {
    helloWorld: {
      name: 'Hello World',
      description: 'Simple logging example',
      code: `console.log('🚀 Starting strategy for', bot.name);
console.log('Balance:', bot.balance.STX, 'STX');

if (bot.balance.STX > 1000000) {
  await bot.swap('STX', 'USDA', 500000);
  console.log('✅ Swap completed');
}`
    },
    fetchExample: {
      name: 'Fetch Example',
      description: 'HTTP request and logging',
      code: `console.log('🚀 Starting fetch strategy for', bot.name);

try {
  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
  const data = await response.json();
  console.log('📊 Bitcoin price data:', data.bitcoin.usd);
  
  console.log('Current bot balance:', bot.balance.STX, 'STX');
} catch (error) {
  console.log('❌ Fetch failed:', error.message);
}`
    }
  };

  // Notify parent of code changes
  useEffect(() => {
    onCodeChange?.(code);
  }, [code, onCodeChange]);

  // Metadata functionality removed for simplified interface

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    // Add context object type definitions for IntelliSense
    monaco.languages.typescript.javascriptDefaults.addExtraLib(`
      interface BotContext {
        // Bot metadata
        id: string;
        name: string;
        status: 'active' | 'paused' | 'error' | 'inactive' | 'setup';
        wallet_address: string;
        created_at: string;
        last_active: string;
        
        // Unified balance object
        balance: { [token: string]: number }; // e.g. { STX: 1000000, USDA: 500000, 'STX-USDA-LP': 250000 }
        
        // Bot trading methods (built-in context)
        swap(fromToken: string, toToken: string, amount: number, slippage?: number): Promise<{success: boolean, txid?: string, amountReceived?: number, error?: string}>;
        addLiquidity(token1: string, token2: string, amount1: number, amount2: number, slippage?: number): Promise<{success: boolean, txid?: string, lpTokensReceived?: number, error?: string}>;
        removeLiquidity(lpToken: string, amount: number, slippage?: number): Promise<{success: boolean, txid?: string, tokensReceived?: {[token: string]: number}, error?: string}>;
        claimRewards(contractId: string): Promise<{success: boolean, txid?: string, amountClaimed?: number, error?: string}>;
        stake(contractId: string, amount: number): Promise<{success: boolean, txid?: string, error?: string}>;
        unstake(contractId: string, amount: number): Promise<{success: boolean, txid?: string, error?: string}>;
      }

      declare const bot: BotContext;
    `, 'strategy-context.d.ts');

    // Configure editor options
    editor.updateOptions({
      fontSize: 14,
      lineNumbers: 'on',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      wordWrap: 'on',
      folding: true,
      autoIndent: 'full',
      formatOnPaste: true,
      formatOnType: true
    });
  };

  const handleTemplateSelect = (templateKey: string) => {
    if (!templateKey || templateKey === selectedTemplate) return;

    const template = templates[templateKey as keyof typeof templates];
    if (template) {
      setSelectedTemplate(templateKey);
      setCode(template.code);
    }
  };

  const handleSave = async () => {
    if (!onSave) return;

    setIsSaving(true);
    try {
      await onSave(code);
    } catch (error) {
      console.error('Failed to save strategy:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!onTest) return;

    setIsTesting(true);
    try {
      await onTest(code);
    } catch (error) {
      console.error('Failed to test strategy:', error);
    } finally {
      setIsTesting(false);
    }
  };

  const handleFormat = () => {
    if (editorRef.current) {
      editorRef.current.trigger('editor', 'editor.action.formatDocument');
    }
  };

  const handleReset = () => {
    setCode(initialCode);
    setSelectedTemplate('');
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div className={`${className} ${isFullscreen ? 'fixed inset-0 z-50 bg-background' : ''}`}>
      <div className="space-y-4 h-full">

        {/* Code Editor */}
        <div className="bg-card border-border flex-1">
          <CardHeader>
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-card-foreground flex items-center gap-2">
                <Code className="w-5 h-5" />
                Strategy Code Editor
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                  <SelectTrigger className="w-40 bg-input border-border">
                    <SelectValue placeholder="Load Template" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {Object.entries(templates).map(([key, template]) => (
                      <SelectItem key={key} value={key}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFormat}
                  className="border-gray-600 text-gray-400 hover:bg-gray-500/10"
                >
                  <Palette className="w-4 h-4" />
                </Button>

                {onTest && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTest}
                    disabled={!code.trim() || isTesting}
                    className="border-blue-600 text-blue-400 hover:bg-blue-500/10"
                  >
                    {isTesting ? (
                      <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleFullscreen}
                  className="border-gray-600 text-gray-400 hover:bg-gray-500/10"
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border border-border rounded-none overflow-hidden">
              <Editor
                height={isFullscreen ? '70vh' : height}
                defaultLanguage="javascript"
                value={code}
                onChange={(value) => setCode(value || '')}
                onMount={handleEditorDidMount}
                theme="vs-dark"
                options={{
                  readOnly,
                  fontSize: 14,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  wordWrap: 'on',
                  folding: true
                }}
                className=''
              />
            </div>
            <div className="px-4 py-2 text-xs text-muted-foreground">
              Write plain javascript code here for what you want your bot to do. Bitcoin, Stacks, and other helper libraries are available on the 'bot' object.
            </div>
          </CardContent>
        </div>

        {/* Action Buttons */}
        {!readOnly && (
          <div className="flex items-center gap-2 mt-4">
            {onSave && (
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Strategy
                  </>
                )}
              </Button>
            )}

            <Button
              variant="outline"
              onClick={handleReset}
              className="border-gray-600 text-gray-400 hover:bg-gray-500/10"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
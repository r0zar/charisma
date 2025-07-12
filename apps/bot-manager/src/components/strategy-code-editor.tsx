'use client';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import Editor from '@monaco-editor/react';
import {
  Code,
  HelpCircle,
  Maximize2,
  Minimize2,
  Palette,
  Play,
  RotateCcw,
  Save
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getStrategyTemplates, type StrategyMetadata } from '@/lib/services/bots/strategy-parser';
import { StrategyEditorHelp } from './strategy-editor-help';
import type { HelpContextualInfo } from '@/lib/help/types';
// Note: We define polyglot types inline since Monaco can't resolve monorepo imports

const templates = getStrategyTemplates();

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
  helpContextualInfo?: HelpContextualInfo;
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
  className = '',
  helpContextualInfo
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
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const editorRef = useRef<any>(null);

  // Notify parent of code changes
  useEffect(() => {
    onCodeChange?.(code);
  }, [code, onCodeChange]);

  // Metadata functionality removed for simplified interface

  const handleEditorDidMount = async (editor: any, monaco: any) => {
    editorRef.current = editor;

    // Disable string suggestions but keep other global suggestions
    monaco.languages.registerCompletionItemProvider('typescript', {
      provideCompletionItems: (model: any, position: any) => {
        // Check if we're inside a string
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        // Simple check for being inside quotes
        const inString = (textUntilPosition.match(/"/g) || []).length % 2 === 1 ||
          (textUntilPosition.match(/'/g) || []).length % 2 === 1 ||
          (textUntilPosition.match(/`/g) || []).length % 2 === 1;

        if (inString) {
          // Return empty suggestions if inside a string
          return { suggestions: [] };
        }

        // Return null to let other providers handle it
        return null;
      },
      triggerCharacters: ['"', "'", '`']
    });

    // Setup Monaco type definitions
    await setupMonacoTypes(editor, monaco);

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
      formatOnType: true,
      // Fix IntelliSense popup clipping
      fixedOverflowWidgets: true
    });
  };

  const setupMonacoTypes = async (editor: any, monaco: any) => {
    try {
      // Configure TypeScript compiler options for Node.js environment
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2022,
        module: monaco.languages.typescript.ModuleKind.CommonJS,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        allowNonTsExtensions: true,
        noEmit: true,
        esModuleInterop: true,
        allowJs: true,
        allowSyntheticDefaultImports: true,
        strict: false
      });

      // Add manual type definitions for bot context and common packages
      addBotContextTypes(monaco);

      console.log('Monaco type definitions loaded successfully');

    } catch (error) {
      console.error('Failed to setup Monaco types:', error);
      // Fall back to basic bot context types only
      addBotContextTypes(monaco);
    }
  };

  const addBotContextTypes = (monaco: any) => {
    // Manual type definitions for bot context, Node.js globals, and @stacks/transactions
    monaco.languages.typescript.typescriptDefaults.addExtraLib(`
      // Node.js globals
      declare function require(id: string): any;
      declare namespace NodeJS {
        interface Global {
          require: typeof require;
        }
      }
      declare var process: any;
      declare var console: Console;
      declare var Buffer: any;
      
      // @stacks/transactions module types
      declare module '@stacks/transactions' {
        interface ContractCallOptions {
          contractAddress: string;
          contractName: string;
          functionName: string;
          functionArgs?: any[];
          senderKey: string;
          network?: any;
          fee?: string | number;
          nonce?: string | number;
          anchorMode?: number;
          postConditionMode?: number;
          postConditions?: any[];
        }
        
        export function makeContractCall(options: ContractCallOptions): Promise<any>;
        export function broadcastTransaction(transaction: any, network?: any): Promise<any>;
        
        // Clarity value constructors
        export function uintCV(value: string | number): any;
        export function intCV(value: string | number): any;
        export function boolCV(value: boolean): any;
        export function stringAsciiCV(value: string): any;
        export function stringUtf8CV(value: string): any;
        export function bufferCV(value: Uint8Array): any;
        export function listCV(values: any[]): any;
        export function tupleCV(data: Record<string, any>): any;
        export function standardPrincipalCV(address: string): any;
        export function contractPrincipalCV(address: string, contractName: string): any;
        export function someCV(value: any): any;
        export function noneCV(): any;
        export function okCV(value: any): any;
        export function errCV(value: any): any;
      }
      
      // Bot context types
      interface BotWalletCredentials {
        privateKey?: string;
      }

      interface BotContext {
        // Bot metadata
        id: string; // Bot ID is the wallet address
        name: string;
        status: 'active' | 'paused' | 'error' | 'inactive' | 'setup';
        created_at: string;
        last_active: string;
        walletCredentials: BotWalletCredentials;
      }

      declare const bot: BotContext;
    `, 'file:///node_modules/@types/strategy-globals/index.d.ts');
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
          <CardHeader className="px-0">
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-card-foreground flex items-center gap-2">
                <Code className="w-5 h-5" />
                Text Editor
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
                  onClick={() => setIsHelpOpen(true)}
                  className="border-blue-600 text-blue-400 hover:bg-blue-500/10"
                >
                  <HelpCircle className="w-4 h-4" />
                </Button>

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
            <div className="border border-border rounded-none" style={{ overflow: 'visible' }}>
              <Editor
                height={isFullscreen ? '70vh' : height}
                defaultLanguage="typescript"
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
                  folding: true,
                  fixedOverflowWidgets: true
                }}
                className=''
              />
            </div>
            <div className="px-4 py-2 text-xs text-muted-foreground">
              Write JavaScript or TypeScript code for your bot strategy. Use <code>const &#123; makeContractCall &#125; = require('@stacks/transactions')</code> to import packages. The 'bot' object provides wallet credentials and context.
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

        {/* Help Dialog */}
        <StrategyEditorHelp
          isOpen={isHelpOpen}
          onClose={() => setIsHelpOpen(false)}
          contextualInfo={helpContextualInfo}
        />
      </div>
    </div>
  );
}
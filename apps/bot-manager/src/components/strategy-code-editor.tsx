'use client';
import Editor from '@monaco-editor/react';
import {
  Activity,
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

import { getStrategyTemplates, type StrategyMetadata } from '@/components/strategy-code-editor/strategy-utils';
import type { HelpContextualInfo } from '@/components/strategy-editor-help/types';
import { getMonacoTypeDefinitions } from '@/generated/types';
import { Button } from '@/components/ui/button';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { type ExecutionLog, ExecutionLogsDrawer } from './execution-logs-drawer';
import { StrategyEditorHelp } from './strategy-editor-help';
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
  canExecute?: boolean;
  height?: string;
  className?: string;
  helpContextualInfo?: HelpContextualInfo;
  executionLogs?: ExecutionLog[];
  isExecuting?: boolean;
  onClearLogs?: () => void;
}

export function StrategyCodeEditor({
  initialCode = '',
  initialMetadata,
  onCodeChange,
  onMetadataChange,
  onSave,
  onTest,
  readOnly = false,
  canExecute = true,
  height = '500px',
  className = '',
  helpContextualInfo,
  executionLogs = [],
  isExecuting = false,
  onClearLogs
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
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const editorRef = useRef<any>(null);

  // Notify parent of code changes
  useEffect(() => {
    onCodeChange?.(code);
  }, [code, onCodeChange]);

  // Auto-open logs drawer when execution starts
  useEffect(() => {
    if (isExecuting) {
      setIsLogsOpen(true);
    }
  }, [isExecuting]);

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

      // Add generated type definitions from build-time script
      addGeneratedTypes(monaco);

      console.log('Monaco type definitions loaded successfully');

    } catch (error) {
      console.error('Failed to setup Monaco types:', error);
      // Fall back to generated types only
      addGeneratedTypes(monaco);
    }
  };

  const addGeneratedTypes = (monaco: any) => {
    // Load all generated type definitions from build-time script
    const typeDefinitions = getMonacoTypeDefinitions();

    console.log('typeDefinitions', typeDefinitions);

    typeDefinitions.forEach(({ content, filePath }: { content: string, filePath: string }) => {
      monaco.languages.typescript.typescriptDefaults.addExtraLib(content, filePath);
    });

    console.log(`📚 Loaded ${typeDefinitions.length} type definition files for Monaco Editor`);
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
      <div className="space-y-4 h-full p-2 sm:p-3 bg-card">

        {/* Code Editor */}
        <div className="bg-card border-border flex-1">
          <CardHeader className="px-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-2 mb-2">
              <CardTitle className="text-card-foreground flex items-center gap-2 text-base sm:text-lg">
                <Code className="w-4 h-4 sm:w-5 sm:h-5" /> Text Editor
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                  <SelectTrigger className="w-32 sm:w-40 bg-input border-border text-xs sm:text-sm">
                    <SelectValue placeholder="Template" />
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
                  className="border-gray-600 text-gray-400 hover:bg-gray-500/10 h-8 w-8 sm:h-9 sm:w-9"
                >
                  <Palette className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>

                {onTest && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTest}
                    disabled={!code.trim() || isTesting || !canExecute}
                    className={`h-8 w-8 sm:h-9 sm:w-9 ${canExecute ? 'border-blue-600 text-blue-400 hover:bg-blue-500/10' : 'border-gray-600 text-gray-400 cursor-not-allowed'}`}
                    title={!canExecute ? 'You can only execute bots that you own' : undefined}
                  >
                    {isTesting ? (
                      <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Play className="w-3 h-3 sm:w-4 sm:h-4" />
                    )}
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsLogsOpen(true)}
                  className="border-green-600 text-green-400 hover:bg-green-500/10 h-8 w-8 sm:h-9 sm:w-9"
                >
                  <Activity className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsHelpOpen(true)}
                  className="border-blue-600 text-blue-400 hover:bg-blue-500/10 h-8 w-8 sm:h-9 sm:w-9"
                >
                  <HelpCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleFullscreen}
                  className="border-gray-600 text-gray-400 hover:bg-gray-500/10 h-8 w-8 sm:h-9 sm:w-9"
                >
                  {isFullscreen ? <Minimize2 className="w-3 h-3 sm:w-4 sm:h-4" /> : <Maximize2 className="w-3 h-3 sm:w-4 sm:h-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          <div className="p-0">
            <div className="border border-border rounded-none" style={{ overflow: 'visible' }}>
              <Editor
                height={isFullscreen ? '90vh' : height}
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
          </div>
        </div>

        {/* Action Buttons */}
        {!readOnly && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-4">
            {onSave && (
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto"
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
              className="border-gray-600 text-gray-400 hover:bg-gray-500/10 w-full sm:w-auto"
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

        {/* Execution Logs Drawer */}
        <ExecutionLogsDrawer
          isOpen={isLogsOpen}
          onClose={() => setIsLogsOpen(false)}
          logs={executionLogs}
          isExecuting={isExecuting}
          onClearLogs={onClearLogs || (() => { })}
        />
      </div>
    </div>
  );
}
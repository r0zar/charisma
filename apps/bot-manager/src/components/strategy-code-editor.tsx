'use client';

import Editor from '@monaco-editor/react';
import {
  Code,
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
import { type StrategyMetadata } from '@/lib/features/bots/strategy-parser';
// Note: We define polyglot types inline since Monaco can't resolve monorepo imports

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

console.log('Hello World!')`
    },
    fetchExample: {
      name: 'Fetch Example',
      description: 'HTTP request and logging',
      code: `console.log('🚀 Starting fetch strategy for', bot.name);

try {
  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
  const data = await response.json();
  console.log('📊 Bitcoin price data:', data.bitcoin.usd);
  
  
} catch (error) {
  console.log('❌ Fetch failed:', error.message);
}`
    },
    polyglotExample: {
      name: 'Polyglot Blockchain',
      description: 'Use polyglot functions to interact with Stacks blockchain',
      code: `console.log('🚀 Starting polyglot strategy for', bot.name);

// Check if polyglot library is available
if (!bot.polyglot) {
  console.log('❌ Polyglot library not available');
  return;
}

console.log('✅ Polyglot library loaded');

try {
  // Get recent mempool transactions (pending/unconfirmed)
  console.log('🔍 Checking mempool transactions...');
  const mempoolTxs = await bot.polyglot.getMempoolTransactions({ limit: 10 });
  console.log('📊 Found', mempoolTxs.total, 'transactions in mempool');
  
  if (mempoolTxs.results.length > 0) {
    console.log('📋 Recent mempool transactions:');
    mempoolTxs.results.slice(0, 3).forEach((tx, i) => {
      console.log(\`  \${i + 1}. \${tx.tx_type} - \${tx.tx_id.substring(0, 8)}...\`);
      if (tx.tx_type === 'token_transfer') {
        console.log(\`     Amount: \${tx.token_transfer.amount} microSTX\`);
      }
    });
  }
  
  // Get bot's recent confirmed transactions
  console.log('🔍 Checking bot transaction history...');
  const botTxs = await bot.polyglot.getRecentTransactions({ limit: 5 });
  console.log('📊 Found', botTxs.total, 'recent confirmed transactions');
  
  // Get BNS name for the bot's address
  const bnsName = await bot.polyglot.getPrimaryBnsName(bot.id);
  if (bnsName) {
    console.log('🏷️ Bot BNS Name:', bnsName);
  } else {
    console.log('🏷️ No BNS name found for bot');
  }
  
  // Example: Check a specific contract (Charisma token)
  const charismaContract = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';
  console.log('📄 Getting contract info for Charisma token...');
  const contractInfo = await bot.polyglot.getContractInfo(charismaContract);
  if (contractInfo) {
    console.log('✅ Contract found:', contractInfo.contract_id);
    console.log('📊 Contract source code size:', contractInfo.source_code?.length || 0, 'characters');
  }
  
} catch (error) {
  console.log('❌ Polyglot operation failed:', error.message);
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

    // Configure for Node.js runtime (no DOM/browser APIs)
    // monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    //   // target: monaco.languages.typescript.ScriptTarget.ES2020,
    //   // lib: ['ES2020'] // Include ES2020 but exclude DOM
    // });

    // Disable string suggestions but keep other global suggestions
    monaco.languages.registerCompletionItemProvider('javascript', {
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

    // Add context object type definitions for IntelliSense
    monaco.languages.typescript.javascriptDefaults.addExtraLib(`
      interface BotContext {
        // Bot metadata
        id: string; // Bot ID is the wallet address
        name: string;
        status: 'active' | 'paused' | 'error' | 'inactive' | 'setup';
        created_at: string;
        last_active: string;
        
        /* Polyglot blockchain library - detailed response types */
        polyglot: {
          // Contract interface and read-only functions
          getContractInterface(contractAddress: string, contractName: string, tip?: string): Promise<{
            functions: Array<{ name: string; access: string; args: any[]; outputs: any }>;
            variables: Array<{ name: string; type: string; access: string }>;
            maps: Array<{ name: string; key: string; value: string }>;
            fungible_tokens: Array<{ name: string }>;
            non_fungible_tokens: Array<{ name: string; type: string }>;
          }>;
          callReadOnlyFunction(contractAddress: string, contractName: string, functionName: string, args?: any[], sender?: string): Promise<{ value: any, type: any } | null>;
          callReadOnly(contractId: string, functionName: string, args?: any[]): Promise<any>;
          parseContractAbi(abiString: string): {
            functions: any[];
            variables: any[];
            maps: any[];
            fungible_tokens: any[];
            non_fungible_tokens: any[];
          } | null;
          getContractInfo(contract_id: string, unanchored?: boolean): Promise<{
            tx_id: string;
            canonical: boolean;
            contract_id: string;
            block_height: number;
            source_code: string;
            abi: string;
          } | null>;
          getContractInfoWithParsedAbi(contract_id: string, unanchored?: boolean): Promise<{
            tx_id: string;
            canonical: boolean;
            contract_id: string;
            block_height: number;
            source_code: string;
            abi: string;
            parsed_abi: any;
          } | null>;
          
          // Account and balance functions
          getAccountBalances(principal: string, params?: { unanchored?: boolean; until_block?: string; }): Promise<{
            stx: { balance: string; total_sent: string; total_received: string; lock_tx_id: string; locked: string; lock_height: number; burnchain_lock_height: number; burnchain_unlock_height: number };
            fungible_tokens: { [key: string]: { balance: string; total_sent: string; total_received: string } };
            non_fungible_tokens: { [key: string]: { count: string; total_sent: string; total_received: string } };
          } | null>;
          fetchStxBalance(address: string): Promise<number>;
          getStxTotalSupply(): Promise<number>;
          
          // Transaction functions
          getRecentTransactions(params?: { limit?: number; offset?: number; type?: Array<"coinbase" | "token_transfer" | "smart_contract" | "contract_call" | "poison_microblock">; unanchored?: boolean; }): Promise<{
            limit: number;
            offset: number;
            total: number;
            results: Array<{
              tx_id: string;
              tx_type: string;
              fee_rate: string;
              sender_address: string;
              sponsored: boolean;
              anchor_mode: string;
              block_hash: string;
              block_height: number;
              block_time: number;
              block_time_iso: string;
              burn_block_time: number;
              burn_block_time_iso: string;
              parent_burn_block_time: number;
              canonical: boolean;
              tx_index: number;
              tx_status: string;
              tx_result: any;
              microblock_hash: string;
              microblock_sequence: number;
              microblock_canonical: boolean;
              event_count: number;
              events: any[];
              execution_cost_read_count: number;
              execution_cost_read_length: number;
              execution_cost_runtime: number;
              execution_cost_write_count: number;
              execution_cost_write_length: number;
              token_transfer?: {
                recipient_address: string;
                amount: string;
                memo: string;
              };
            }>;
          }>;
          getMempoolTransactions(params?: { sender_address?: string; recipient_address?: string; address?: string; limit?: number; offset?: number; unanchored?: boolean; }): Promise<{
            limit: number;
            offset: number;
            total: number;
            results: Array<{
              tx_id: string;
              tx_type: string;
              fee_rate: string;
              sender_address: string;
              sponsored: boolean;
              anchor_mode: string;
              tx_status: string;
              receipt_time: number;
              receipt_time_iso: string;
              token_transfer?: {
                recipient_address: string;
                amount: string;
                memo: string;
              };
            }>;
          }>;
          getTransactionDetails(txId: string): Promise<{
            tx_id: string;
            tx_type: string;
            fee_rate: string;
            sender_address: string;
            block_hash: string;
            block_height: number;
            tx_status: string;
            events: any[];
          }>;
          getTransactionEvents(params?: { tx_id?: string; address?: string; limit?: number; offset?: number; type?: Array<'smart_contract_log' | 'stx_lock' | 'stx_asset' | 'fungible_token_asset' | 'non_fungible_token_asset'>; }): Promise<{
            limit: number;
            offset: number;
            total: number;
            results: Array<{
              event_index: number;
              event_type: string;
              tx_id: string;
              contract_log?: {
                contract_id: string;
                topic: string;
                value: any;
              };
              stx_lock_event?: {
                locked_amount: string;
                unlock_height: number;
                locked_address: string;
              };
              asset?: {
                asset_event_type: string;
                asset_id: string;
                sender: string;
                recipient: string;
                amount: string;
              };
            }>;
          }>;
          
          // Contract events
          fetchContractEvents(address: string, options?: { limit?: number; offset?: number; }): Promise<{
            limit: number;
            offset: number;
            total: number;
            results: Array<{
              event_index: number;
              event_type: string;
              tx_id: string;
              contract_log: {
                contract_id: string;
                topic: string;
                value: any;
              };
            }>;
          }>;
          fetcHoldToEarnLogs(contractAddress: string): Promise<Array<{
            energy: bigint;
            integral: bigint;
            message: string;
            op: string;
            sender: string;
            tx_id: string;
            block_height?: number;
            block_time?: number;
            block_time_iso?: string;
            tx_status?: string;
          }>>;
          
          // BNS functions
          getBnsNamesByAddress(address: string, blockchain?: 'bitcoin' | 'stacks'): Promise<string[]>;
          getPrimaryBnsName(address: string, blockchain?: 'bitcoin' | 'stacks'): Promise<string | null>;
          resolveBnsNameToAddress(name: string): Promise<string | null>;
        };
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
      formatOnType: true,
      // Fix IntelliSense popup clipping
      fixedOverflowWidgets: true
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
                  folding: true,
                  fixedOverflowWidgets: true
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
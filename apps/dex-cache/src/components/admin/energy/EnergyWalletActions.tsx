'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Wallet, Zap, Play, Eye, Lock, Unlock, 
  AlertTriangle, Info, ExternalLink, Copy, Coins 
} from 'lucide-react';

interface WalletState {
  isConnected: boolean;
  address?: string;
  network?: string;
}

interface ContractFunction {
  name: string;
  type: 'read-only' | 'public';
  description: string;
  args: Array<{ name: string; type: string; required: boolean; placeholder?: string }>;
  example?: string;
  requiresWallet: boolean;
  gasEstimate?: string;
}

export function EnergyWalletActions() {
  const [walletState, setWalletState] = useState<WalletState>({ isConnected: false });
  const [selectedFunction, setSelectedFunction] = useState<string>('quote');
  const [functionArgs, setFunctionArgs] = useState<Record<string, string>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const contractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energize-v1';

  // Mock wallet functions - in real implementation, these would use Stacks Connect
  const connectWallet = async () => {
    try {
      // Simulate wallet connection
      setWalletState({
        isConnected: true,
        address: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS', // Mock address
        network: 'mainnet'
      });
    } catch (err) {
      setError('Failed to connect wallet');
    }
  };

  const disconnectWallet = () => {
    setWalletState({ isConnected: false });
    setResult(null);
    setError(null);
  };

  // Contract functions based on our validation discoveries
  const contractFunctions: ContractFunction[] = [
    {
      name: 'quote',
      type: 'read-only',
      description: 'Get quote for energy operation (no wallet required)',
      args: [
        { name: 'amount', type: 'uint', required: true, placeholder: '1000000' },
        { name: 'opcode', type: 'optional<buff>', required: false, placeholder: '0x07 (harvest energy)' }
      ],
      example: 'quote(1000000, 0x07)',
      requiresWallet: false
    },
    {
      name: 'get-token-uri',
      type: 'read-only',
      description: 'Get vault metadata URI (no wallet required)',
      args: [],
      example: 'get-token-uri()',
      requiresWallet: false
    },
    {
      name: 'execute',
      type: 'public',
      description: 'Execute energy operation (requires wallet signature)',
      args: [
        { name: 'amount', type: 'uint', required: true, placeholder: '1000000' },
        { name: 'opcode', type: 'optional<buff>', required: false, placeholder: '0x07 (harvest energy)' }
      ],
      example: 'execute(1000000, 0x07)',
      requiresWallet: true,
      gasEstimate: '~5,000 µSTX'
    },
    {
      name: 'harvest-energy',
      type: 'public',
      description: 'Harvest energy rewards (requires wallet signature)',
      args: [],
      example: 'harvest-energy()',
      requiresWallet: true,
      gasEstimate: '~3,000 µSTX'
    }
  ];

  const currentFunction = contractFunctions.find(f => f.name === selectedFunction);

  const handleExecuteFunction = async () => {
    if (!currentFunction) return;

    setIsExecuting(true);
    setError(null);
    setResult(null);

    try {
      if (currentFunction.requiresWallet && !walletState.isConnected) {
        throw new Error('Wallet connection required for this function');
      }

      // For read-only functions, call the API directly
      if (!currentFunction.requiresWallet) {
        const response = await fetch('/api/admin/energy/health');
        const data = await response.json();
        
        if (currentFunction.name === 'quote') {
          setResult({
            type: 'uint',
            value: '4002', // Mock quote result based on our testing
            description: 'Quote result (in base units)'
          });
        } else if (currentFunction.name === 'get-token-uri') {
          setResult({
            type: 'optional<string>',
            value: 'data:application/json;base64,ewogICJuYW1lIjogIkVuZXJnaXplIi...',
            description: 'Token metadata URI'
          });
        }
      } else {
        // For public functions, simulate transaction
        setResult({
          type: 'transaction',
          txId: 'mock-tx-id-' + Date.now(),
          status: 'pending',
          description: 'Transaction submitted to network'
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Function execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const updateFunctionArg = (argName: string, value: string) => {
    setFunctionArgs(prev => ({ ...prev, [argName]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Wallet Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Wallet Connection
          </CardTitle>
          <CardDescription>
            Connect your wallet to interact with the Energize vault contract. You must hold DEX-POOL-V1 tokens to generate energy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${walletState.isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
              <div>
                <p className="font-medium">
                  {walletState.isConnected ? 'Wallet Connected' : 'Wallet Disconnected'}
                </p>
                {walletState.isConnected && walletState.address && (
                  <p className="text-sm text-muted-foreground">
                    {walletState.address.slice(0, 8)}...{walletState.address.slice(-8)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {walletState.isConnected ? (
                <Button variant="outline" onClick={disconnectWallet}>
                  <Unlock className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              ) : (
                <Button onClick={connectWallet}>
                  <Lock className="h-4 w-4 mr-2" />
                  Connect Wallet
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Function Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Contract Interaction
          </CardTitle>
          <CardDescription>
            Interact with Energize vault functions - read-only functions work without wallet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedFunction} onValueChange={setSelectedFunction} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              {contractFunctions.map(func => (
                <TabsTrigger 
                  key={func.name} 
                  value={func.name}
                  className="relative"
                >
                  {func.name}
                  {func.requiresWallet && (
                    <Lock className="h-3 w-3 ml-1 text-muted-foreground" />
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {contractFunctions.map(func => (
              <TabsContent key={func.name} value={func.name} className="space-y-4">
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">{func.name}()</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant={func.requiresWallet ? "destructive" : "default"}>
                        {func.type}
                      </Badge>
                      {func.requiresWallet && (
                        <Badge variant="outline" className="text-xs">
                          <Lock className="h-3 w-3 mr-1" />
                          Wallet Required
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{func.description}</p>
                  
                  {func.example && (
                    <div className="text-xs font-mono bg-background border rounded p-2 mb-3">
                      {func.example}
                    </div>
                  )}

                  {func.gasEstimate && (
                    <div className="text-xs text-muted-foreground">
                      <strong>Estimated Gas:</strong> {func.gasEstimate}
                    </div>
                  )}
                </div>

                {/* Function Arguments */}
                {func.args.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium">Function Arguments</h4>
                    {func.args.map(arg => (
                      <div key={arg.name}>
                        <Label htmlFor={`${func.name}-${arg.name}`}>
                          {arg.name} ({arg.type}) {arg.required && <span className="text-red-500">*</span>}
                        </Label>
                        <Input
                          id={`${func.name}-${arg.name}`}
                          placeholder={arg.placeholder}
                          value={functionArgs[`${func.name}-${arg.name}`] || ''}
                          onChange={(e) => updateFunctionArg(`${func.name}-${arg.name}`, e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Wallet Requirement Alert */}
                {func.requiresWallet && !walletState.isConnected && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Wallet Connection Required</AlertTitle>
                    <AlertDescription>
                      This function requires a wallet signature and gas fees. Connect your wallet to proceed.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Read-only Info */}
                {!func.requiresWallet && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Read-Only Function</AlertTitle>
                    <AlertDescription>
                      This function can be called without a wallet connection or gas fees.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Execute Button */}
                <Button 
                  onClick={handleExecuteFunction}
                  disabled={isExecuting || (func.requiresWallet && !walletState.isConnected)}
                  className="w-full"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {isExecuting ? 'Executing...' : 
                   func.requiresWallet ? 'Submit Transaction' : 'Call Function'}
                </Button>

                {/* Result Display */}
                {result && (
                  <div className="border rounded-lg p-4 bg-green-50">
                    <h4 className="font-medium mb-2">Result</h4>
                    <pre className="text-sm bg-background border rounded p-2 overflow-auto">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Error Display */}
                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Execution Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Contract Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Contract Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Required Token Highlight */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium text-blue-800">Required for Energy Generation</span>
              </div>
              <div className="text-xs text-blue-700">
                <strong>Token:</strong> SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-pool-v1
              </div>
              <div className="text-xs text-blue-600 mt-1">
                Users must hold DEX-POOL-V1 tokens in their wallet to generate energy rewards
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Contract ID:</span>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {contractId}
                </code>
                <Button 
                  onClick={() => navigator.clipboard.writeText(contractId)}
                  variant="ghost" 
                  size="sm"
                  className="h-6 w-6 p-0"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" asChild className="h-6 w-6 p-0">
                  <a 
                    href={`https://explorer.stacks.co/address/${contractId}?chain=mainnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Network:</span>
              <Badge variant="outline">Stacks Mainnet</Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Functions Available:</span>
              <div className="text-sm">
                {contractFunctions.filter(f => !f.requiresWallet).length} read-only, {' '}
                {contractFunctions.filter(f => f.requiresWallet).length} public
              </div>
            </div>

            <div className="text-xs text-muted-foreground pt-2 border-t">
              <strong>Note:</strong> Read-only functions (quote, get-token-uri) can be called without a wallet and don't require gas fees. 
              Public functions (execute, harvest-energy) require wallet connection and gas fees.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
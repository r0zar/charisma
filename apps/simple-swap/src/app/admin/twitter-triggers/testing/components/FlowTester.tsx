'use client';

import React, { useState, useEffect } from 'react';
import { 
    Activity, 
    Play, 
    Loader2, 
    CheckCircle, 
    XCircle, 
    Clock,
    ArrowRight,
    Twitter,
    Hash,
    ShoppingCart
} from 'lucide-react';
import { toast } from 'sonner';
import TokenDropdown from '@/components/TokenDropdown';
import { TokenCacheData } from '@repo/tokens';

interface FlowSimulationResult {
    tweetId: string;
    tweetUrl: string;
    inputToken: string;
    outputToken: string;
    amountIn: string;
    steps: Array<{
        step: number;
        name: string;
        success: boolean;
        duration: number;
        data: any;
    }>;
    summary: {
        totalReplies: number;
        bnsNamesFound: number;
        successfulResolutions: number;
        wouldExecute: number;
        errors: string[];
    };
    testedAt: string;
}

export default function FlowTester() {
    // Form states
    const [tweetUrl, setTweetUrl] = useState('');
    const [selectedInputToken, setSelectedInputToken] = useState<TokenCacheData | null>(null);
    const [selectedOutputToken, setSelectedOutputToken] = useState<TokenCacheData | null>(null);
    const [amount, setAmount] = useState('');
    
    // Token lists
    const [subnetTokens, setSubnetTokens] = useState<TokenCacheData[]>([]);
    const [dexTokens, setDexTokens] = useState<TokenCacheData[]>([]);
    const [tokensLoading, setTokensLoading] = useState(true);
    
    // Test states
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<FlowSimulationResult | null>(null);

    // Load tokens on mount
    useEffect(() => {
        loadTokens();
    }, []);

    const loadTokens = async () => {
        try {
            const { listTokens } = await import('@/app/actions');
            const result = await listTokens();
            
            if (result.success && result.tokens) {
                const allTokens = result.tokens;
                
                const subnetTokenList = allTokens.filter(token => token.type === 'SUBNET');
                const dexTokenList = allTokens;
                
                setSubnetTokens(subnetTokenList);
                setDexTokens(dexTokenList);
            } else {
                throw new Error('Failed to load tokens');
            }
        } catch (error) {
            console.error('Error loading tokens:', error);
            toast.error('Failed to load token lists');
        } finally {
            setTokensLoading(false);
        }
    };

    const testCompleteFlow = async () => {
        if (!tweetUrl || !selectedInputToken || !selectedOutputToken || !amount) {
            toast.error('Please fill in all required fields');
            return;
        }

        setTesting(true);
        setTestResult(null);

        try {
            const amountMicro = (parseFloat(amount) * Math.pow(10, selectedInputToken.decimals || 6)).toString();

            const response = await fetch('/api/v1/twitter-triggers/testing/flow-simulation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tweetUrl: tweetUrl.trim(),
                    inputToken: selectedInputToken.contractId,
                    outputToken: selectedOutputToken.contractId,
                    amountIn: amountMicro,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setTestResult(data.data);
                const { summary } = data.data;
                toast.success(
                    `Flow test complete: ${summary.wouldExecute} orders would execute from ${summary.totalReplies} replies`,
                    {
                        description: `Found ${summary.bnsNamesFound} BNS names, ${summary.successfulResolutions} resolved successfully`
                    }
                );
            } else {
                toast.error(`Flow test failed: ${data.error}`);
            }
        } catch (error) {
            console.error('Flow test error:', error);
            toast.error('Failed to test complete flow');
        } finally {
            setTesting(false);
        }
    };

    const getStepIcon = (step: any) => {
        if (!step.success) return <XCircle className="w-5 h-5 text-red-500" />;
        
        switch (step.step) {
            case 1:
                return <Twitter className="w-5 h-5 text-blue-500" />;
            case 2:
                return <Hash className="w-5 h-5 text-purple-500" />;
            case 3:
                return <ShoppingCart className="w-5 h-5 text-green-500" />;
            default:
                return <CheckCircle className="w-5 h-5 text-green-500" />;
        }
    };

    const getTokenSymbol = (contractId: string) => {
        const token = [...subnetTokens, ...dexTokens].find(t => t.contractId === contractId);
        return token?.symbol || contractId.split('.').pop()?.toUpperCase() || 'Unknown';
    };

    return (
        <div className="space-y-6">
            {/* Flow Test Configuration */}
            <div className="bg-card rounded-lg border border-border p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center">
                        <Activity className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">End-to-End Flow Simulation</h3>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            Tweet URL
                        </label>
                        <input
                            type="url"
                            placeholder="https://twitter.com/username/status/123456789"
                            value={tweetUrl}
                            onChange={(e) => setTweetUrl(e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <TokenDropdown
                                tokens={subnetTokens}
                                selected={selectedInputToken}
                                onSelect={setSelectedInputToken}
                                label="Input Token (Subnet Token)"
                                suppressFlame={false}
                                showBalances={false}
                            />
                        </div>
                        
                        <div>
                            <TokenDropdown
                                tokens={dexTokens}
                                selected={selectedOutputToken}
                                onSelect={setSelectedOutputToken}
                                label="Output Token (DEX Token)"
                                suppressFlame={false}
                                showBalances={false}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            Amount per Trigger
                        </label>
                        <input
                            type="number"
                            placeholder="10.0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            step="0.000001"
                            min="0"
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    
                    <button 
                        onClick={testCompleteFlow}
                        disabled={testing || tokensLoading}
                        className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {testing ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Testing Flow...
                            </>
                        ) : (
                            <>
                                <Play className="w-4 h-4" />
                                Test Complete Flow
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Flow Test Results */}
            {testResult && (
                <div className="bg-card rounded-lg border border-border p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Flow Test Results</h3>
                    
                    {/* Summary */}
                    <div className="bg-muted rounded-lg p-4 mb-4">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                            <div>
                                <span className="text-muted-foreground">Replies Found:</span>
                                <span className="ml-2 font-semibold">{testResult.summary.totalReplies}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">BNS Names:</span>
                                <span className="ml-2 font-semibold">{testResult.summary.bnsNamesFound}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Resolved:</span>
                                <span className="ml-2 font-semibold text-green-600">{testResult.summary.successfulResolutions}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Would Execute:</span>
                                <span className="ml-2 font-semibold text-blue-600">{testResult.summary.wouldExecute}</span>
                            </div>
                        </div>
                        
                        <div className="mt-3 text-sm">
                            <span className="text-muted-foreground">Token Swap:</span>
                            <span className="ml-2 font-mono">
                                {getTokenSymbol(testResult.inputToken)} → {getTokenSymbol(testResult.outputToken)}
                            </span>
                        </div>
                    </div>

                    {/* Step-by-Step Results */}
                    <div className="space-y-4">
                        <h4 className="font-medium text-foreground">Processing Steps</h4>
                        
                        {testResult.steps.map((step, index) => (
                            <div key={step.step} className="border border-border rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        {getStepIcon(step)}
                                        <div>
                                            <div className="font-medium">Step {step.step}: {step.name}</div>
                                            <div className="text-sm text-muted-foreground">
                                                Completed in {step.duration}ms
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {step.success ? (
                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                        ) : (
                                            <XCircle className="w-4 h-4 text-red-500" />
                                        )}
                                        <span className="text-sm">
                                            {step.success ? 'Success' : 'Failed'}
                                        </span>
                                    </div>
                                </div>
                                
                                {/* Step-specific data */}
                                {step.step === 1 && ( // Twitter Scraping
                                    <div className="text-sm space-y-1">
                                        <div>Replies found: <span className="font-semibold">{step.data.repliesFound}</span></div>
                                        {step.data.error && (
                                            <div className="text-red-600">Error: {step.data.error}</div>
                                        )}
                                    </div>
                                )}
                                
                                {step.step === 2 && ( // BNS Processing
                                    <div className="text-sm space-y-2">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>BNS names found: <span className="font-semibold">{step.data.bnsNamesFound}</span></div>
                                            <div>Successfully resolved: <span className="font-semibold text-green-600">{step.data.successfulResolutions}</span></div>
                                        </div>
                                        
                                        {step.data.results && step.data.results.length > 0 && (
                                            <div>
                                                <div className="font-medium mb-2">BNS Resolution Results:</div>
                                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                                    {step.data.results.map((result: any, idx: number) => (
                                                        <div key={idx} className="flex items-center justify-between text-xs bg-background p-2 rounded border">
                                                            <div className="flex items-center gap-2">
                                                                {result.resolutionSuccess ? (
                                                                    <CheckCircle className="w-3 h-3 text-green-500" />
                                                                ) : (
                                                                    <XCircle className="w-3 h-3 text-red-500" />
                                                                )}
                                                                <span>@{result.authorHandle}</span>
                                                                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                                                <span className="font-mono">{result.bnsName}</span>
                                                            </div>
                                                            <div>
                                                                {result.resolutionSuccess ? (
                                                                    <span className="font-mono text-green-600">
                                                                        {result.address?.slice(0, 8)}...{result.address?.slice(-6)}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-red-600">{result.resolutionError}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {step.step === 3 && ( // Order Creation
                                    <div className="text-sm space-y-2">
                                        <div>Orders would create: <span className="font-semibold">{step.data.ordersWouldCreate}</span></div>
                                        
                                        {step.data.simulations && step.data.simulations.length > 0 && (
                                            <div>
                                                <div className="font-medium mb-2">Order Simulations:</div>
                                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                                    {step.data.simulations.map((sim: any, idx: number) => (
                                                        <div key={idx} className="text-xs bg-background p-2 rounded border">
                                                            <div className="font-mono">{sim.bnsName} → {sim.recipientAddress?.slice(0, 8)}...{sim.recipientAddress?.slice(-6)}</div>
                                                            <div className="text-muted-foreground">Order ID: {sim.simulatedOrderId}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Errors */}
                    {testResult.summary.errors.length > 0 && (
                        <div className="mt-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
                            <div className="text-sm text-red-800 dark:text-red-200">
                                <div className="font-medium mb-1">Errors encountered:</div>
                                {testResult.summary.errors.map((error, index) => (
                                    <div key={index} className="text-xs">{error}</div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
'use client';

import React, { useState, useEffect } from 'react';
import { TwitterIcon, Users, Zap, Settings, Loader2, CheckCircle, XCircle, ExternalLink, Trash2, Play, RefreshCw, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import TokenDropdown from '@/components/TokenDropdown';
import { TokenCacheData } from '@repo/tokens';
import { useWallet } from '@/contexts/wallet-context';
import { request } from '@stacks/connect';
import { tupleCV, stringAsciiCV, uintCV, principalCV, optionalCVOf, noneCV } from '@stacks/transactions';

interface TwitterTrigger {
    id: string;
    tweetUrl: string;
    tweetId: string;
    inputToken: string;
    outputToken: string;
    amountIn: string;
    isActive: boolean;
    triggeredCount: number;
    maxTriggers?: number;
    createdAt: string;
    lastChecked?: string;
    nextCheck?: string;
    error?: string;
    orderIds?: string[];  // Pre-signed order UUIDs
    availableOrders?: number;  // Remaining unused orders
}

interface TwitterExecution {
    id: string;
    triggerId: string;
    replierHandle: string;
    bnsName: string;
    recipientAddress?: string;
    orderUuid?: string;
    status: 'pending' | 'bns_resolved' | 'order_created' | 'failed' | 'overflow' | 
            'test_run' | 'test_would_execute' | 'test_failed' | 'test_limited' | 'test_no_orders' | 'test_overflow';
    executedAt: string;
    error?: string;
    twitterReplyId?: string;
    twitterReplyStatus?: 'sent' | 'failed' | 'disabled';
    twitterReplyError?: string;
}

interface BNSTestResult {
    bnsName: string;
    address?: string;
    success: boolean;
    error?: string;
}

export default function TwitterTriggersClient() {
    const [triggers, setTriggers] = useState<TwitterTrigger[]>([]);
    const [executions, setExecutions] = useState<TwitterExecution[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Wallet context
    const { address } = useWallet();
    
    // Token lists
    const [subnetTokens, setSubnetTokens] = useState<TokenCacheData[]>([]);
    const [dexTokens, setDexTokens] = useState<TokenCacheData[]>([]);
    const [tokensLoading, setTokensLoading] = useState(true);
    
    // Form states
    const [tweetUrl, setTweetUrl] = useState('');
    const [selectedInputToken, setSelectedInputToken] = useState<TokenCacheData | null>(null);
    const [selectedOutputToken, setSelectedOutputToken] = useState<TokenCacheData | null>(null);
    const [amount, setAmount] = useState('');
    const [maxTriggers, setMaxTriggers] = useState('');
    const [creating, setCreating] = useState(false);
    
    // Signing flow states
    const [showSigningDialog, setShowSigningDialog] = useState(false);
    const [signingPhase, setSigningPhase] = useState<'preview' | 'signing' | 'complete'>('preview');
    const [currentOrderIndex, setCurrentOrderIndex] = useState(0);
    const [signedOrders, setSignedOrders] = useState<{uuid: string; signature: string; status: 'pending' | 'signing' | 'success' | 'error'; error?: string}[]>([]);
    const [signingErrors, setSigningErrors] = useState<string[]>([]);
    
    // Additional orders signing states for overflow executions
    const [showAdditionalOrdersDialog, setShowAdditionalOrdersDialog] = useState(false);
    const [selectedTriggerId, setSelectedTriggerId] = useState<string | null>(null);
    const [additionalOrdersCount, setAdditionalOrdersCount] = useState('');
    
    // BNS testing states
    const [bnsTestName, setBnsTestName] = useState('');
    const [bnsTestResult, setBnsTestResult] = useState<BNSTestResult | null>(null);
    const [bnsTestLoading, setBnsTestLoading] = useState(false);
    
    // Delete states
    const [deletingTriggers, setDeletingTriggers] = useState<Set<string>>(new Set());
    
    // Manual test states
    const [testingTriggers, setTestingTriggers] = useState<Set<string>>(new Set());
    
    // System status
    const [systemStatus, setSystemStatus] = useState<{
        cronRunning: boolean;
        lastCronRun?: string;
        nextCronRun?: string;
        processingCount: number;
    } | null>(null);

    // Load data on mount
    useEffect(() => {
        loadData();
        loadTokens();
        loadSystemStatus();
        
        // Auto-refresh data every 30 seconds
        const interval = setInterval(() => {
            loadData();
            loadSystemStatus();
        }, 30000);
        
        return () => clearInterval(interval);
    }, []);

    const loadData = async (preserveMockExecutions = false) => {
        try {
            // Only load triggers for now - executions endpoint doesn't exist yet
            const triggersRes = await fetch('/api/v1/twitter-triggers');
            
            if (triggersRes.ok) {
                const triggersData = await triggersRes.json();
                setTriggers(triggersData.data || []);
            } else {
                console.error('Failed to load triggers:', triggersRes.status);
            }
            
            // Load executions 
            try {
                const executionsRes = await fetch('/api/v1/twitter-triggers/executions');
                if (executionsRes.ok) {
                    const executionsData = await executionsRes.json();
                    const newExecutions = executionsData.data || [];
                    
                    if (preserveMockExecutions) {
                        // Preserve existing mock executions (those with status starting with 'test_')
                        setExecutions(prev => {
                            const mockExecutions = prev.filter(exec => 
                                exec.status && exec.status.startsWith('test_')
                            );
                            return [...mockExecutions, ...newExecutions];
                        });
                    } else {
                        setExecutions(newExecutions);
                    }
                } else {
                    console.error('Failed to load executions:', executionsRes.status);
                    if (!preserveMockExecutions) {
                        setExecutions([]); // Empty on error
                    }
                }
            } catch (executionsError) {
                console.error('Error loading executions:', executionsError);
                if (!preserveMockExecutions) {
                    setExecutions([]); // Empty on error
                }
            }
            
        } catch (error) {
            console.error('Error loading data:', error);
            toast.error('Failed to load Twitter triggers data');
        } finally {
            setLoading(false);
        }
    };
    
    const loadSystemStatus = async () => {
        try {
            // TODO: Implement status endpoint
            // const response = await fetch('/api/v1/twitter-triggers/status');
            // For now, set mock status
            setSystemStatus({
                cronRunning: false, // Unknown until endpoint is implemented
                lastCronRun: undefined,
                nextCronRun: undefined,
                processingCount: 0
            });
        } catch (error) {
            console.error('Error loading system status:', error);
        }
    };

    const loadTokens = async () => {
        try {
            // Import the server action dynamically
            const { listTokens } = await import('@/app/actions');
            const result = await listTokens();
            
            if (result.success && result.tokens) {
                const allTokens = result.tokens;
                
                // Only subnet tokens can be used as input tokens
                const subnetTokenList = allTokens.filter(token => 
                    token.type === 'SUBNET'
                );
                
                // All tokens can be output tokens on the DEX
                const dexTokenList = allTokens;
                
                console.log(`[Twitter Triggers] Loaded ${subnetTokenList.length} subnet tokens and ${dexTokenList.length} DEX tokens`);
                
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

    const testBNSResolution = async () => {
        if (!bnsTestName.trim()) {
            toast.error('Please enter a BNS name to test');
            return;
        }

        setBnsTestLoading(true);
        setBnsTestResult(null);

        try {
            const response = await fetch('/api/v1/twitter-triggers/resolve-bns', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ bnsName: bnsTestName.trim() }),
            });

            const data = await response.json();

            if (data.success) {
                setBnsTestResult(data.data);
                if (data.data.success) {
                    toast.success(`BNS resolved: ${data.data.address}`);
                } else {
                    toast.error(`BNS resolution failed: ${data.data.error}`);
                }
            } else {
                toast.error(`Test failed: ${data.error}`);
            }
        } catch (error) {
            console.error('BNS test error:', error);
            toast.error('BNS resolution test failed');
        } finally {
            setBnsTestLoading(false);
        }
    };

    const createTrigger = async () => {
        if (!tweetUrl || !selectedInputToken || !selectedOutputToken || !amount) {
            toast.error('Please fill in all required fields');
            return;
        }
        
        if (!address) {
            toast.error('Please connect your wallet first');
            return;
        }

        // Prepare signing flow
        const maxTriggersNum = maxTriggers ? parseInt(maxTriggers) : 5; // Default to 5 if not specified
        const orderSigningList = Array.from({ length: maxTriggersNum }, (_, i) => ({
            uuid: '',
            signature: '',
            status: 'pending' as const,
            orderIndex: i + 1
        }));
        
        setSignedOrders(orderSigningList);
        setSigningPhase('preview');
        setShowSigningDialog(true);
    };
    
    // Sign individual order (similar to DCA)
    const signOrder = async (orderIndex: number) => {
        if (!selectedInputToken || !selectedOutputToken || !address) {
            throw new Error('Missing required data');
        }
        
        const uuid = globalThis.crypto?.randomUUID() ?? Date.now().toString();
        const amountMicro = (parseFloat(amount) * Math.pow(10, selectedInputToken.decimals || 6)).toString();
        
        const domain = tupleCV({
            name: stringAsciiCV('BLAZE_PROTOCOL'),
            version: stringAsciiCV('v1.0'),
            'chain-id': uintCV(1),
        });
        
        const message = tupleCV({
            contract: principalCV(selectedInputToken.contractId),
            intent: stringAsciiCV('TRANSFER_TOKENS'),
            opcode: noneCV(),
            amount: optionalCVOf(uintCV(BigInt(amountMicro))),
            target: optionalCVOf(principalCV('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-rc9')),
            uuid: stringAsciiCV(uuid),
        });
        
        // @ts-ignore – upstream types don't include method yet
        const res = await request('stx_signStructuredMessage', { domain, message });
        if (!res?.signature) throw new Error('User cancelled the signature');
        
        return { signature: res.signature as string, uuid };
    };
    
    // Create manual order payload
    const createOrderPayload = (signature: string, uuid: string, position: number, strategyId: string) => {
        if (!selectedInputToken || !selectedOutputToken || !address) {
            throw new Error('Missing required data');
        }
        
        const amountMicro = (parseFloat(amount) * Math.pow(10, selectedInputToken.decimals || 6)).toString();
        
        return {
            owner: address,
            inputToken: selectedInputToken.contractId,
            outputToken: selectedOutputToken.contractId,
            amountIn: amountMicro,
            // NO targetPrice, conditionToken, or direction = pure manual order
            recipient: address,  // Default recipient (will be overridden when executed with BNS address)
            signature,
            uuid,
            // Strategy metadata for grouping
            strategyId,
            strategyType: 'twitter' as const,
            strategyPosition: position,
            strategySize: parseInt(maxTriggers) || 1,
            strategyDescription: `Twitter trigger orders for ${tweetUrl}`,
            // Optional metadata
            metadata: {
                orderType: 'twitter_trigger',
                createdFor: 'twitter-trigger-system',
                tweetUrl
            }
        };
    };
    
    // Start signing process
    const startSigning = async () => {
        setSigningPhase('signing');
        setCurrentOrderIndex(0);
        setSigningErrors([]);
        
        // Generate shared strategy ID for all orders
        const strategyId = `twitter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Sign orders sequentially
        for (let i = 0; i < signedOrders.length; i++) {
            setCurrentOrderIndex(i);
            
            // Update order status to signing
            setSignedOrders(prev => prev.map((order, idx) => 
                idx === i ? { ...order, status: 'signing' } : order
            ));
            
            try {
                // Sign the order
                const { signature, uuid } = await signOrder(i);
                
                // Update with signature
                setSignedOrders(prev => prev.map((order, idx) => 
                    idx === i ? { ...order, uuid, signature } : order
                ));
                
                // Create order (position is 1-based)
                const orderPayload = createOrderPayload(signature, uuid, i + 1, strategyId);
                
                const response = await fetch('/api/v1/orders/new', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(orderPayload),
                });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: 'Order creation failed' }));
                    throw new Error(errorData.error || 'Order creation failed');
                }
                
                // Mark as successful
                setSignedOrders(prev => prev.map((order, idx) => 
                    idx === i ? { ...order, status: 'success' } : order
                ));
                
            } catch (error) {
                console.error(`Order ${i + 1} failed:`, error);
                
                const errorMessage = (error as Error).message;
                setSigningErrors(prev => [...prev, `Order ${i + 1}: ${errorMessage}`]);
                
                // Mark as failed
                setSignedOrders(prev => prev.map((order, idx) => 
                    idx === i ? { ...order, status: 'error', error: errorMessage } : order
                ));
            }
        }
        
        setSigningPhase('complete');
    };
    
    // Complete trigger creation
    const completeTriggerCreation = async () => {
        const successfulOrders = signedOrders.filter(order => order.status === 'success');
        
        if (successfulOrders.length === 0) {
            toast.error('No orders were successfully created');
            return;
        }
        
        try {
            const payload = {
                tweetUrl,
                inputToken: selectedInputToken!.contractId,
                outputToken: selectedOutputToken!.contractId,
                amountIn: (parseFloat(amount) * Math.pow(10, selectedInputToken!.decimals || 6)).toString(),
                maxTriggers: successfulOrders.length,
                orderIds: successfulOrders.map(order => order.uuid),
                signature: 'pre_signed_orders' // Indicate we have pre-signed orders
            };
            
            const response = await fetch('/api/v1/twitter-triggers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            
            const data = await response.json();
            
            if (data.success) {
                toast.success(`Twitter trigger created with ${successfulOrders.length} pre-signed orders!`);
                setShowSigningDialog(false);
                clearForm();
                loadData();
            } else {
                toast.error(`Failed to create trigger: ${data.error}`);
            }
        } catch (error) {
            console.error('Create trigger error:', error);
            toast.error('Failed to create Twitter trigger');
        }
    };
    
    const clearForm = () => {
        setTweetUrl('');
        setSelectedInputToken(null);
        setSelectedOutputToken(null);
        setAmount('');
        setMaxTriggers('');
        setSignedOrders([]);
        setSigningErrors([]);
        setCurrentOrderIndex(0);
        setSigningPhase('preview');
    };
    
    // Open additional orders dialog for overflow executions
    const openAdditionalOrdersDialog = (triggerId: string) => {
        const trigger = triggers.find(t => t.id === triggerId);
        if (!trigger) return;
        
        const overflowCount = getOverflowCount(triggerId);
        setSelectedTriggerId(triggerId);
        setAdditionalOrdersCount(overflowCount.toString());
        setShowAdditionalOrdersDialog(true);
    };
    
    // Sign additional orders for overflow executions
    const signAdditionalOrders = async () => {
        if (!selectedTriggerId || !additionalOrdersCount) return;
        
        const trigger = triggers.find(t => t.id === selectedTriggerId);
        if (!trigger) {
            toast.error('Trigger not found');
            return;
        }
        
        const orderCount = parseInt(additionalOrdersCount);
        if (orderCount <= 0) {
            toast.error('Please enter a valid number of orders');
            return;
        }
        
        // Find token information from the trigger
        const inputToken = [...subnetTokens, ...dexTokens].find(t => t.contractId === trigger.inputToken);
        const outputToken = [...subnetTokens, ...dexTokens].find(t => t.contractId === trigger.outputToken);
        
        if (!inputToken || !outputToken) {
            toast.error('Could not find token information for this trigger');
            return;
        }
        
        // Prepare signing flow for additional orders
        const orderSigningList = Array.from({ length: orderCount }, (_, i) => ({
            uuid: '',
            signature: '',
            status: 'pending' as const,
            orderIndex: i + 1
        }));
        
        setSignedOrders(orderSigningList);
        setSigningPhase('preview');
        setShowAdditionalOrdersDialog(false);
        setShowSigningDialog(true);
        
        // Auto-start signing for additional orders
        setTimeout(() => {
            startAdditionalOrdersSigning(trigger, inputToken, outputToken, orderCount);
        }, 100);
    };
    
    // Start signing process for additional orders
    const startAdditionalOrdersSigning = async (trigger: TwitterTrigger, inputToken: TokenCacheData, outputToken: TokenCacheData, orderCount: number) => {
        setSigningPhase('signing');
        setCurrentOrderIndex(0);
        setSigningErrors([]);
        
        // Generate shared strategy ID for all additional orders
        const strategyId = `twitter_additional_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const signedOrdersResults: string[] = [];
        
        // Sign orders sequentially
        for (let i = 0; i < orderCount; i++) {
            setCurrentOrderIndex(i);
            
            // Update order status to signing
            setSignedOrders(prev => prev.map((order, idx) => 
                idx === i ? { ...order, status: 'signing' } : order
            ));
            
            try {
                // Create order payload for additional order
                const amountMicro = trigger.amountIn; // Use same amount as original trigger
                const uuid = globalThis.crypto?.randomUUID() ?? Date.now().toString();
                
                const domain = tupleCV({
                    name: stringAsciiCV('BLAZE_PROTOCOL'),
                    version: stringAsciiCV('v1.0'),
                    'chain-id': uintCV(1),
                });
                
                const message = tupleCV({
                    contract: principalCV(inputToken.contractId),
                    intent: stringAsciiCV('TRANSFER_TOKENS'),
                    opcode: noneCV(),
                    amount: optionalCVOf(uintCV(BigInt(amountMicro))),
                    target: optionalCVOf(principalCV('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-rc9')),
                    uuid: stringAsciiCV(uuid),
                });
                
                // @ts-ignore – upstream types don't include method yet
                const res = await request('stx_signStructuredMessage', { domain, message });
                if (!res?.signature) throw new Error('User cancelled the signature');
                
                const signature = res.signature as string;
                
                // Update with signature
                setSignedOrders(prev => prev.map((order, idx) => 
                    idx === i ? { ...order, uuid, signature } : order
                ));
                
                // Create order payload
                const orderPayload = {
                    owner: address!,
                    inputToken: inputToken.contractId,
                    outputToken: outputToken.contractId,
                    amountIn: amountMicro,
                    recipient: address!, // Default recipient (will be overridden when executed)
                    signature,
                    uuid,
                    // Strategy metadata for grouping
                    strategyId,
                    strategyType: 'twitter' as const,
                    strategyPosition: i + 1,
                    strategySize: orderCount,
                    strategyDescription: `Additional Twitter trigger orders for ${trigger.tweetUrl}`,
                    // Optional metadata
                    metadata: {
                        orderType: 'twitter_trigger_additional',
                        createdFor: 'twitter-trigger-overflow',
                        tweetUrl: trigger.tweetUrl,
                        originalTriggerId: trigger.id
                    }
                };
                
                const response = await fetch('/api/v1/orders/new', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(orderPayload),
                });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: 'Order creation failed' }));
                    throw new Error(errorData.error || 'Order creation failed');
                }
                
                // Mark as successful and store UUID
                setSignedOrders(prev => prev.map((order, idx) => 
                    idx === i ? { ...order, status: 'success' } : order
                ));
                
                signedOrdersResults.push(uuid);
                
            } catch (error) {
                console.error(`Additional order ${i + 1} failed:`, error);
                
                const errorMessage = (error as Error).message;
                setSigningErrors(prev => [...prev, `Order ${i + 1}: ${errorMessage}`]);
                
                // Mark as failed
                setSignedOrders(prev => prev.map((order, idx) => 
                    idx === i ? { ...order, status: 'error', error: errorMessage } : order
                ));
            }
        }
        
        setSigningPhase('complete');
        
        // If we have successful orders, update the trigger with additional order IDs
        if (signedOrdersResults.length > 0) {
            try {
                await updateTriggerWithAdditionalOrders(trigger.id, signedOrdersResults);
            } catch (error) {
                console.error('Failed to update trigger with additional orders:', error);
                setSigningErrors(prev => [...prev, 'Failed to link additional orders to trigger']);
            }
        }
    };
    
    // Update trigger with additional order IDs
    const updateTriggerWithAdditionalOrders = async (triggerId: string, newOrderIds: string[]) => {
        try {
            const response = await fetch(`/api/v1/twitter-triggers/${triggerId}/add-orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ orderIds: newOrderIds }),
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to update trigger' }));
                throw new Error(errorData.error || 'Failed to update trigger');
            }
            
            toast.success(`Successfully added ${newOrderIds.length} additional orders to trigger`);
            loadData(); // Reload triggers to show updated order count
            
        } catch (error) {
            console.error('Error updating trigger with additional orders:', error);
            throw error;
        }
    };
    
    // Complete additional orders creation
    const completeAdditionalOrdersCreation = () => {
        const successfulOrders = signedOrders.filter(order => order.status === 'success');
        
        if (successfulOrders.length === 0) {
            toast.error('No additional orders were successfully created');
            return;
        }
        
        toast.success(`Successfully created ${successfulOrders.length} additional orders!`);
        setShowSigningDialog(false);
        clearAdditionalOrdersForm();
    };
    
    const clearAdditionalOrdersForm = () => {
        setSelectedTriggerId(null);
        setAdditionalOrdersCount('');
        setSignedOrders([]);
        setSigningErrors([]);
        setCurrentOrderIndex(0);
        setSigningPhase('preview');
    };

    const deleteTrigger = async (triggerId: string) => {
        if (deletingTriggers.has(triggerId)) return;
        
        if (!confirm('Are you sure you want to delete this Twitter trigger? This action cannot be undone.')) {
            return;
        }

        setDeletingTriggers(prev => new Set(prev).add(triggerId));

        try {
            const response = await fetch(`/api/v1/twitter-triggers/${triggerId}`, {
                method: 'DELETE',
            });

            const data = await response.json();

            if (data.success) {
                toast.success('Twitter trigger deleted successfully!');
                loadData(); // Reload data
            } else {
                toast.error(`Failed to delete trigger: ${data.error}`);
            }
        } catch (error) {
            console.error('Delete trigger error:', error);
            toast.error('Failed to delete Twitter trigger');
        } finally {
            setDeletingTriggers(prev => {
                const newSet = new Set(prev);
                newSet.delete(triggerId);
                return newSet;
            });
        }
    };
    
    const testTrigger = async (triggerId: string) => {
        if (testingTriggers.has(triggerId)) return;
        
        setTestingTriggers(prev => new Set(prev).add(triggerId));
        
        try {
            const response = await fetch(`/api/v1/twitter-triggers/${triggerId}/test`, {
                method: 'POST',
            });
            
            const data = await response.json();
            
            if (data.success) {
                toast.success(`Test completed: ${data.message || 'Trigger test executed'}`, {
                    description: data.data?.status || 'Manual trigger test executed successfully'
                });
                
                // Add mock executions to the executions list if any were found
                if (data.data?.mockExecutions && data.data.mockExecutions.length > 0) {
                    setExecutions(prev => [
                        ...data.data.mockExecutions, // Add test results at the top
                        ...prev
                    ]);
                    
                    // Auto-clear mock executions after 30 seconds
                    setTimeout(() => {
                        setExecutions(prev => prev.filter(exec => 
                            !exec.status || !exec.status.startsWith('test_')
                        ));
                    }, 30000);
                }
                
                loadData(true); // Reload to see any updates, but preserve mock executions
            } else {
                toast.error(`Test failed: ${data.error}`);
            }
        } catch (error) {
            console.error('Test trigger error:', error);
            toast.error('Failed to test trigger');
        } finally {
            setTestingTriggers(prev => {
                const newSet = new Set(prev);
                newSet.delete(triggerId);
                return newSet;
            });
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };
    
    const formatRelativeTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };

    const formatAmount = (amountMicro: string) => {
        return (parseInt(amountMicro) / 1000000).toFixed(6);
    };

    const getTokenSymbol = (contractId: string) => {
        const token = [...subnetTokens, ...dexTokens].find(t => t.contractId === contractId);
        return token?.symbol || contractId.split('.').pop()?.toUpperCase() || 'Unknown';
    };
    
    // Check if a trigger has overflow executions that need additional orders
    const hasOverflowExecutions = (triggerId: string) => {
        return executions.some(exec => 
            exec.triggerId === triggerId && 
            (exec.status === 'overflow' || exec.status === 'test_overflow')
        );
    };
    
    // Get count of overflow executions for a trigger
    const getOverflowCount = (triggerId: string) => {
        return executions.filter(exec => 
            exec.triggerId === triggerId && 
            (exec.status === 'overflow' || exec.status === 'test_overflow')
        ).length;
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'order_created':
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'failed':
            case 'test_failed':
                return <XCircle className="w-4 h-4 text-red-500" />;
            case 'overflow':
                return <AlertTriangle className="w-4 h-4 text-purple-500" />;
            case 'pending':
            case 'bns_resolved':
                return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
            case 'test_run':
            case 'test_would_execute':
                return <Play className="w-4 h-4 text-green-500" />;
            case 'test_limited':
            case 'test_no_orders':
                return <AlertTriangle className="w-4 h-4 text-orange-500" />;
            case 'test_overflow':
                return <AlertTriangle className="w-4 h-4 text-purple-500" />;
            default:
                return <div className="w-4 h-4 rounded-full bg-gray-300" />;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Loading Twitter triggers...</span>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* System Status */}
            <div className="bg-card rounded-lg border border-border p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground">System Status</h3>
                    <button
                        onClick={() => {
                            loadData();
                            loadSystemStatus();
                        }}
                        className="inline-flex items-center space-x-2 px-3 py-1 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors text-sm"
                    >
                        <RefreshCw className="w-4 h-4" />
                        <span>Refresh</span>
                    </button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                            systemStatus?.cronRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                        }`} />
                        <div>
                            <div className="text-sm font-medium text-foreground">
                                Cron Job
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {systemStatus?.cronRunning ? 'Running' : 'Not implemented'}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                        <Clock className="w-5 h-5 text-blue-500" />
                        <div>
                            <div className="text-sm font-medium text-foreground">
                                Last Check
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {systemStatus?.lastCronRun ? formatRelativeTime(systemStatus.lastCronRun) : 'Not available'}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                        <Clock className="w-5 h-5 text-purple-500" />
                        <div>
                            <div className="text-sm font-medium text-foreground">
                                Next Check
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {systemStatus?.nextCronRun ? formatRelativeTime(systemStatus.nextCronRun) : 'Not available'}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                        <Loader2 className={`w-5 h-5 text-orange-500 ${
                            systemStatus?.processingCount > 0 ? 'animate-spin' : ''
                        }`} />
                        <div>
                            <div className="text-sm font-medium text-foreground">
                                Processing
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {systemStatus?.processingCount || 0} triggers
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-card rounded-lg border border-border p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-foreground">Active Triggers</h3>
                        <div className="w-8 h-8 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center">
                            <Zap className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-foreground mb-1">
                        {triggers.filter(t => t.isActive).length}
                    </div>
                    <p className="text-sm text-muted-foreground">Monitoring tweets for replies</p>
                </div>

                <div className="bg-card rounded-lg border border-border p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-foreground">Total Executions</h3>
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                            <Users className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-foreground mb-1">
                        {executions.length}
                    </div>
                    <p className="text-sm text-muted-foreground">Orders triggered by replies</p>
                </div>

                <div className="bg-card rounded-lg border border-border p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-foreground">BNS Recipients</h3>
                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                            <Settings className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-foreground mb-1">
                        {new Set(executions.filter(e => e.recipientAddress).map(e => e.recipientAddress)).size}
                    </div>
                    <p className="text-sm text-muted-foreground">Unique BNS addresses resolved</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Create New Trigger */}
                <div className="bg-card rounded-lg border border-border p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Create New Trigger</h3>
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
                            <p className="text-xs text-muted-foreground mt-1">
                                The tweet to monitor for BNS (.btc) replies
                            </p>
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
                                <p className="text-xs text-muted-foreground mt-1">
                                    Token to spend from your wallet
                                </p>
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
                                <p className="text-xs text-muted-foreground mt-1">
                                    Token to send to BNS recipient
                                </p>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-foreground">
                                    Amount per Trigger
                                </label>
                                {selectedInputToken && (
                                    <span className="text-xs text-muted-foreground">
                                        in {selectedInputToken.symbol || 'tokens'}
                                    </span>
                                )}
                            </div>
                            <input
                                type="number"
                                placeholder="10.0"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                step="0.000001"
                                min="0"
                                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Amount of {selectedInputToken ? selectedInputToken.symbol || 'input token' : 'input token'} to swap per BNS reply trigger. 
                                <br />
                                <span className="font-mono text-xs">
                                    Example: 10.5 means 10.5 {selectedInputToken ? selectedInputToken.symbol || 'tokens' : 'tokens'} per trigger
                                </span>
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                                Max Triggers (optional)
                            </label>
                            <input
                                type="number"
                                placeholder="Leave blank for unlimited"
                                value={maxTriggers}
                                onChange={(e) => setMaxTriggers(e.target.value)}
                                min="1"
                                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>

                        <button 
                            onClick={createTrigger}
                            disabled={creating || !address}
                            className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {creating ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Creating...
                                </>
                            ) : !address ? (
                                'Connect Wallet to Create Trigger'
                            ) : (
                                'Create Trigger & Sign Orders'
                            )}
                        </button>
                    </div>
                </div>

                {/* BNS Testing */}
                <div className="bg-card rounded-lg border border-border p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">BNS Resolution Testing</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                                Test BNS Name
                            </label>
                            <input
                                type="text"
                                placeholder="username.btc"
                                value={bnsTestName}
                                onChange={(e) => setBnsTestName(e.target.value)}
                                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        
                        <button 
                            onClick={testBNSResolution}
                            disabled={bnsTestLoading}
                            className="w-full bg-secondary text-secondary-foreground py-2 px-4 rounded-lg font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {bnsTestLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Resolving...
                                </>
                            ) : (
                                'Resolve Address'
                            )}
                        </button>
                        
                        <div className="bg-muted rounded-lg p-4">
                            <div className="text-sm text-muted-foreground mb-2">Resolution Result:</div>
                            <div className="font-mono text-sm text-foreground bg-background rounded px-2 py-1">
                                {bnsTestResult ? (
                                    bnsTestResult.success ? (
                                        <span className="text-green-600">
                                            ✅ {bnsTestResult.address}
                                        </span>
                                    ) : (
                                        <span className="text-red-600">
                                            ❌ {bnsTestResult.error}
                                        </span>
                                    )
                                ) : (
                                    'Click "Resolve Address" to test'
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-border">
                        <h4 className="font-medium text-foreground mb-3">Supported BNS Formats</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• <code>@username.btc</code> - Twitter handle format</li>
                            <li>• <code>username.btc</code> - Direct BNS name</li>
                            <li>• <code>@alice.btc 🎯</code> - With emojis/text</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Active Triggers Table */}
            <div className="bg-card rounded-lg border border-border">
                <div className="p-6 border-b border-border">
                    <h3 className="text-lg font-semibold text-foreground">Active Triggers</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        Currently monitoring these tweets for BNS (.btc) replies
                    </p>
                </div>
                
                <div className="p-6">
                    {triggers.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                            <TwitterIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p className="text-lg font-medium mb-2">No active triggers</p>
                            <p className="text-sm">Create your first Twitter trigger to get started</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className="text-left py-3 px-4 font-medium text-foreground">Tweet</th>
                                        <th className="text-left py-3 px-4 font-medium text-foreground">Tokens</th>
                                        <th className="text-left py-3 px-4 font-medium text-foreground">Amount</th>
                                        <th className="text-left py-3 px-4 font-medium text-foreground">Orders</th>
                                        <th className="text-left py-3 px-4 font-medium text-foreground">Status</th>
                                        <th className="text-left py-3 px-4 font-medium text-foreground">Last Checked</th>
                                        <th className="text-left py-3 px-4 font-medium text-foreground">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {triggers.map((trigger) => (
                                        <tr key={trigger.id} className="border-b border-border/50">
                                            <td className="py-3 px-4">
                                                <a 
                                                    href={trigger.tweetUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-500 hover:text-blue-600 flex items-center"
                                                >
                                                    Tweet {trigger.tweetId.slice(-6)}
                                                    <ExternalLink className="w-3 h-3 ml-1" />
                                                </a>
                                            </td>
                                            <td className="py-3 px-4 text-sm">
                                                {getTokenSymbol(trigger.inputToken)} → {getTokenSymbol(trigger.outputToken)}
                                            </td>
                                            <td className="py-3 px-4 text-sm">
                                                {formatAmount(trigger.amountIn)}
                                            </td>
                                            <td className="py-3 px-4 text-sm">
                                                <div className="space-y-1">
                                                    <div>
                                                        {trigger.triggeredCount}/{trigger.maxTriggers || 0} used
                                                    </div>
                                                    {trigger.orderIds && (
                                                        <div className="text-xs text-muted-foreground">
                                                            {trigger.availableOrders || (trigger.orderIds.length - trigger.triggeredCount)} available
                                                        </div>
                                                    )}
                                                    {!trigger.orderIds && (
                                                        <div className="text-xs text-red-600">
                                                            No pre-signed orders
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="space-y-1">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                                        trigger.isActive 
                                                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                                                    }`}>
                                                        {trigger.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                    {trigger.error && (
                                                        <div className="flex items-center space-x-1 text-xs text-red-600">
                                                            <AlertTriangle className="w-3 h-3" />
                                                            <span>Error</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-sm">
                                                <div className="space-y-1">
                                                    <div className="text-muted-foreground">
                                                        {trigger.lastChecked ? formatRelativeTime(trigger.lastChecked) : 'Never'}
                                                    </div>
                                                    {trigger.nextCheck && (
                                                        <div className="text-xs text-blue-600">
                                                            Next: {formatRelativeTime(trigger.nextCheck)}
                                                        </div>
                                                    )}
                                                    {trigger.error && (
                                                        <div className="text-xs text-red-600 truncate max-w-32" title={trigger.error}>
                                                            {trigger.error}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex items-center space-x-2">
                                                    {/* Add Orders button for triggers with overflow executions */}
                                                    {hasOverflowExecutions(trigger.id) && (
                                                        <button
                                                            onClick={() => openAdditionalOrdersDialog(trigger.id)}
                                                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950 transition-colors"
                                                            title={`Add orders for ${getOverflowCount(trigger.id)} overflow execution${getOverflowCount(trigger.id) > 1 ? 's' : ''}`}
                                                        >
                                                            <Zap className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    
                                                    <button
                                                        onClick={() => testTrigger(trigger.id)}
                                                        disabled={testingTriggers.has(trigger.id)}
                                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                        title="Test trigger now"
                                                    >
                                                        {testingTriggers.has(trigger.id) ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Play className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => deleteTrigger(trigger.id)}
                                                        disabled={deletingTriggers.has(trigger.id)}
                                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                        title="Delete trigger"
                                                    >
                                                        {deletingTriggers.has(trigger.id) ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Execution History */}
            <div className="bg-card rounded-lg border border-border">
                <div className="p-6 border-b border-border">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-foreground">Recent Executions</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                Orders triggered by BNS (.btc) replies
                            </p>
                        </div>
                        {executions.some(exec => exec.status && exec.status.startsWith('test_')) && (
                            <button
                                onClick={() => {
                                    setExecutions(prev => prev.filter(exec => 
                                        !exec.status || !exec.status.startsWith('test_')
                                    ));
                                }}
                                className="text-xs px-3 py-1.5 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                            >
                                Clear Test Results
                            </button>
                        )}
                    </div>
                </div>
                
                <div className="p-6">
                    {executions.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p className="text-lg font-medium mb-2">No executions yet</p>
                            <p className="text-sm">Trigger executions will appear here</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className="text-left py-3 px-4 font-medium text-foreground">Replier</th>
                                        <th className="text-left py-3 px-4 font-medium text-foreground">BNS Name</th>
                                        <th className="text-left py-3 px-4 font-medium text-foreground">Address</th>
                                        <th className="text-left py-3 px-4 font-medium text-foreground">Order</th>
                                        <th className="text-left py-3 px-4 font-medium text-foreground">Status</th>
                                        <th className="text-left py-3 px-4 font-medium text-foreground">Reply</th>
                                        <th className="text-left py-3 px-4 font-medium text-foreground">Executed</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {executions.map((execution) => (
                                        <tr key={execution.id} className="border-b border-border/50">
                                            <td className="py-3 px-4">@{execution.replierHandle}</td>
                                            <td className="py-3 px-4 text-sm font-mono">{execution.bnsName}</td>
                                            <td className="py-3 px-4 text-sm font-mono">
                                                {execution.recipientAddress ? (
                                                    `${execution.recipientAddress.slice(0, 8)}...${execution.recipientAddress.slice(-6)}`
                                                ) : (
                                                    '-'
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-sm">
                                                {execution.orderUuid ? (
                                                    <span className="font-mono">{execution.orderUuid.slice(-8)}</span>
                                                ) : (
                                                    '-'
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex items-center">
                                                    {getStatusIcon(execution.status)}
                                                    <span className="ml-2 text-sm capitalize">
                                                        {execution.status === 'test_run' ? 'Test Run' :
                                                         execution.status === 'test_would_execute' ? 'Would Execute' :
                                                         execution.status === 'test_failed' ? 'Test Failed' :
                                                         execution.status === 'test_limited' ? 'Test (Limited)' :
                                                         execution.status === 'test_no_orders' ? 'Test (No Orders)' :
                                                         execution.status === 'test_overflow' ? 'Overflow' :
                                                         execution.status.replace('_', ' ')}
                                                    </span>
                                                    {execution.status.startsWith('test_') && (
                                                        <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs rounded-full">
                                                            TEST
                                                        </span>
                                                    )}
                                                </div>
                                                {execution.error && (
                                                    <div className="mt-1 text-xs text-red-500" title={execution.error}>
                                                        {execution.error.length > 50 ? `${execution.error.substring(0, 50)}...` : execution.error}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-sm">
                                                {execution.twitterReplyStatus === 'sent' && (
                                                    <div className="flex items-center text-green-600">
                                                        <CheckCircle className="w-3 h-3 mr-1" />
                                                        <span className="text-xs">Replied</span>
                                                    </div>
                                                )}
                                                {execution.twitterReplyStatus === 'failed' && (
                                                    <div className="flex items-center text-red-600" title={execution.twitterReplyError || 'Reply failed'}>
                                                        <XCircle className="w-3 h-3 mr-1" />
                                                        <span className="text-xs">Failed</span>
                                                    </div>
                                                )}
                                                {execution.twitterReplyStatus === 'disabled' && (
                                                    <div className="flex items-center text-gray-500">
                                                        <span className="text-xs">Disabled</span>
                                                    </div>
                                                )}
                                                {!execution.twitterReplyStatus && execution.status === 'order_created' && (
                                                    <div className="flex items-center text-yellow-600">
                                                        <Clock className="w-3 h-3 mr-1" />
                                                        <span className="text-xs">Pending</span>
                                                    </div>
                                                )}
                                                {!execution.twitterReplyStatus && execution.status !== 'order_created' && (
                                                    <span className="text-xs text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-muted-foreground">
                                                {formatDate(execution.executedAt)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Additional Orders Dialog */}
            {showAdditionalOrdersDialog && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-4">
                    <div className="bg-card rounded-lg border border-border p-6 w-full max-w-md">
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-foreground mb-2">
                                    Add Additional Orders
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Sign additional orders for overflow executions that need more capacity
                                </p>
                            </div>
                            
                            {selectedTriggerId && (
                                <div className="bg-muted rounded-lg p-4 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Overflow Executions:</span>
                                        <span>{getOverflowCount(selectedTriggerId)} pending</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>Trigger ID:</span>
                                        <span className="truncate ml-2 max-w-48" title={selectedTriggerId}>{selectedTriggerId.slice(-8)}</span>
                                    </div>
                                </div>
                            )}
                            
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Number of Additional Orders
                                </label>
                                <input
                                    type="number"
                                    placeholder="How many additional orders to sign"
                                    value={additionalOrdersCount}
                                    onChange={(e) => setAdditionalOrdersCount(e.target.value)}
                                    min="1"
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Recommended: {selectedTriggerId ? getOverflowCount(selectedTriggerId) : 0} (to cover all overflow executions)
                                </p>
                            </div>
                            
                            <div className="flex space-x-3">
                                <button
                                    onClick={() => {
                                        setShowAdditionalOrdersDialog(false);
                                        clearAdditionalOrdersForm();
                                    }}
                                    className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
                                >
                                    Cancel
                                </button>
                                
                                <button
                                    onClick={signAdditionalOrders}
                                    disabled={!additionalOrdersCount || parseInt(additionalOrdersCount) <= 0}
                                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Sign Orders
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Order Signing Dialog */}
            {showSigningDialog && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-4">
                    <div className="bg-card rounded-lg border border-border p-6 w-full max-w-md">
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-foreground mb-2">
                                    {signingPhase === 'preview' && (selectedTriggerId ? 'Add Additional Orders' : 'Create Twitter Trigger Orders')}
                                    {signingPhase === 'signing' && 'Signing Orders...'}
                                    {signingPhase === 'complete' && 'Orders Created'}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {signingPhase === 'preview' && (selectedTriggerId 
                                        ? `Sign ${signedOrders.length} additional orders for overflow executions`
                                        : `Sign ${signedOrders.length} orders upfront for Twitter trigger execution`)}
                                    {signingPhase === 'signing' && `Signing order ${currentOrderIndex + 1} of ${signedOrders.length}...`}
                                    {signingPhase === 'complete' && (selectedTriggerId 
                                        ? 'Additional orders are ready for overflow executions'
                                        : 'Orders are ready for Twitter trigger execution')}
                                </p>
                            </div>
                            
                            {/* Order Summary */}
                            <div className="bg-muted rounded-lg p-4 space-y-2">
                                {selectedTriggerId ? (
                                    // Additional orders summary
                                    <>
                                        <div className="flex justify-between text-sm">
                                            <span>Trigger ID:</span>
                                            <span className="truncate ml-2 max-w-48" title={selectedTriggerId}>{selectedTriggerId.slice(-8)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span>Additional Orders:</span>
                                            <span>{signedOrders.length}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span>For Overflow Executions:</span>
                                            <span>{getOverflowCount(selectedTriggerId)} pending</span>
                                        </div>
                                    </>
                                ) : (
                                    // New trigger summary
                                    <>
                                        <div className="flex justify-between text-sm">
                                            <span>Tweet URL:</span>
                                            <span className="truncate ml-2 max-w-48" title={tweetUrl}>{tweetUrl}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span>Token Swap:</span>
                                            <span>{selectedInputToken?.symbol} → {selectedOutputToken?.symbol}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span>Amount per Trigger:</span>
                                            <span>{amount} {selectedInputToken?.symbol}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span>Max Triggers:</span>
                                            <span>{signedOrders.length}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                            
                            {/* Progress */}
                            {signingPhase !== 'preview' && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Progress</span>
                                        <span>{signedOrders.filter(o => o.status === 'success').length}/{signedOrders.length} orders</span>
                                    </div>
                                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary rounded-full transition-all duration-300"
                                            style={{ width: `${(signedOrders.filter(o => o.status === 'success').length / signedOrders.length) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                            
                            {/* Orders List */}
                            {signingPhase !== 'preview' && (
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {signedOrders.map((order, index) => (
                                        <div
                                            key={index}
                                            className={`flex items-center justify-between p-3 rounded-lg border text-sm ${
                                                currentOrderIndex === index && signingPhase === 'signing'
                                                    ? 'border-primary bg-primary/10'
                                                    : 'border-border'
                                            }`}
                                        >
                                            <div className="flex items-center space-x-3">
                                                <div className="w-6 h-6 rounded-full bg-muted border flex items-center justify-center text-xs font-medium">
                                                    {index + 1}
                                                </div>
                                                <span>Order {index + 1}</span>
                                            </div>
                                            <div className="flex items-center">
                                                {order.status === 'pending' && (
                                                    <div className="w-4 h-4 rounded-full bg-muted border" />
                                                )}
                                                {order.status === 'signing' && (
                                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                )}
                                                {order.status === 'success' && (
                                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                                )}
                                                {order.status === 'error' && (
                                                    <XCircle className="h-4 w-4 text-red-500" />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            {/* Errors */}
                            {signingErrors.length > 0 && (
                                <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
                                    <div className="text-sm text-red-800 dark:text-red-200">
                                        <div className="font-medium mb-1">Signing Errors:</div>
                                        {signingErrors.map((error, index) => (
                                            <div key={index} className="text-xs">{error}</div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {/* Buttons */}
                            <div className="flex space-x-3">
                                <button
                                    onClick={() => {
                                        setShowSigningDialog(false);
                                        if (selectedTriggerId) {
                                            clearAdditionalOrdersForm();
                                        } else {
                                            clearForm();
                                        }
                                    }}
                                    className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
                                >
                                    Cancel
                                </button>
                                
                                {signingPhase === 'preview' && (
                                    <button
                                        onClick={startSigning}
                                        className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                                    >
                                        Start Signing
                                    </button>
                                )}
                                
                                {signingPhase === 'complete' && (
                                    <button
                                        onClick={selectedTriggerId ? completeAdditionalOrdersCreation : completeTriggerCreation}
                                        disabled={signedOrders.filter(o => o.status === 'success').length === 0}
                                        className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {selectedTriggerId ? 'Add Orders' : 'Create Trigger'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
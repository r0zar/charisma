'use client';

import React, { useState, useEffect } from 'react';
import { 
    Search, 
    Eye, 
    FileText, 
    Database, 
    Loader2,
    ChevronDown,
    ChevronRight,
    ExternalLink,
    Copy
} from 'lucide-react';
import { toast } from 'sonner';

interface InspectionData {
    triggers: any[];
    executions: any[];
    recentTests: any[];
}

export default function DataInspector() {
    const [data, setData] = useState<InspectionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [selectedType, setSelectedType] = useState<'trigger' | 'execution' | 'test' | null>(null);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic']));

    useEffect(() => {
        loadInspectionData();
    }, []);

    const loadInspectionData = async () => {
        setLoading(true);
        try {
            // Load triggers
            const triggersRes = await fetch('/api/v1/twitter-triggers');
            const triggersData = triggersRes.ok ? await triggersRes.json() : { data: [] };

            // Load executions
            const executionsRes = await fetch('/api/v1/twitter-triggers/executions');
            const executionsData = executionsRes.ok ? await executionsRes.json() : { data: [] };

            setData({
                triggers: triggersData.data || [],
                executions: executionsData.data || [],
                recentTests: [] // We could store test results here
            });
        } catch (error) {
            console.error('Error loading inspection data:', error);
            toast.error('Failed to load data for inspection');
        } finally {
            setLoading(false);
        }
    };

    const selectItem = (item: any, type: 'trigger' | 'execution' | 'test') => {
        setSelectedItem(item);
        setSelectedType(type);
        setExpandedSections(new Set(['basic']));
    };

    const toggleSection = (section: string) => {
        const newExpanded = new Set(expandedSections);
        if (newExpanded.has(section)) {
            newExpanded.delete(section);
        } else {
            newExpanded.add(section);
        }
        setExpandedSections(newExpanded);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    const renderJsonSection = (title: string, data: any, sectionKey: string) => {
        const isExpanded = expandedSections.has(sectionKey);
        
        return (
            <div className="border border-border rounded-lg">
                <button
                    onClick={() => toggleSection(sectionKey)}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-muted transition-colors"
                >
                    <span className="font-medium">{title}</span>
                    {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                    ) : (
                        <ChevronRight className="w-4 h-4" />
                    )}
                </button>
                
                {isExpanded && (
                    <div className="border-t border-border p-3">
                        <div className="flex justify-end mb-2">
                            <button
                                onClick={() => copyToClipboard(JSON.stringify(data, null, 2))}
                                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                            >
                                <Copy className="w-3 h-3" />
                                Copy JSON
                            </button>
                        </div>
                        <pre className="text-xs bg-background p-2 rounded border overflow-auto max-h-64">
                            {JSON.stringify(data, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Loading inspection data...</span>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Data Lists */}
            <div className="lg:col-span-1 space-y-4">
                {/* Triggers */}
                <div className="bg-card rounded-lg border border-border p-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Database className="w-4 h-4" />
                        Active Triggers ({data?.triggers.length || 0})
                    </h4>
                    
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {data?.triggers.map((trigger) => (
                            <button
                                key={trigger.id}
                                onClick={() => selectItem(trigger, 'trigger')}
                                className={`w-full text-left p-2 rounded border transition-colors ${
                                    selectedItem?.id === trigger.id && selectedType === 'trigger'
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border hover:bg-muted'
                                }`}
                            >
                                <div className="text-sm font-medium truncate">
                                    Tweet {trigger.tweetId?.slice(-6) || 'Unknown'}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {trigger.triggeredCount || 0}/{trigger.maxTriggers || '∞'} used
                                </div>
                            </button>
                        ))}
                        
                        {(!data?.triggers || data.triggers.length === 0) && (
                            <div className="text-sm text-muted-foreground text-center py-4">
                                No triggers found
                            </div>
                        )}
                    </div>
                </div>

                {/* Executions */}
                <div className="bg-card rounded-lg border border-border p-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Recent Executions ({data?.executions.length || 0})
                    </h4>
                    
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {data?.executions.slice(0, 10).map((execution) => (
                            <button
                                key={execution.id}
                                onClick={() => selectItem(execution, 'execution')}
                                className={`w-full text-left p-2 rounded border transition-colors ${
                                    selectedItem?.id === execution.id && selectedType === 'execution'
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border hover:bg-muted'
                                }`}
                            >
                                <div className="text-sm font-medium truncate">
                                    @{execution.replierHandle}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {execution.bnsName} • {execution.status}
                                </div>
                            </button>
                        ))}
                        
                        {(!data?.executions || data.executions.length === 0) && (
                            <div className="text-sm text-muted-foreground text-center py-4">
                                No executions found
                            </div>
                        )}
                    </div>
                </div>

                <button
                    onClick={loadInspectionData}
                    className="w-full px-3 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors text-sm"
                >
                    Refresh Data
                </button>
            </div>

            {/* Detailed Inspector */}
            <div className="lg:col-span-2">
                {selectedItem ? (
                    <div className="bg-card rounded-lg border border-border p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Eye className="w-5 h-5" />
                                {selectedType === 'trigger' && 'Trigger Inspector'}
                                {selectedType === 'execution' && 'Execution Inspector'}
                                {selectedType === 'test' && 'Test Result Inspector'}
                            </h3>
                            
                            {selectedType === 'trigger' && selectedItem.tweetUrl && (
                                <a
                                    href={selectedItem.tweetUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                >
                                    View Tweet
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>

                        <div className="space-y-4">
                            {/* Basic Information */}
                            {renderJsonSection(
                                'Basic Information',
                                selectedType === 'trigger' ? {
                                    id: selectedItem.id,
                                    tweetId: selectedItem.tweetId,
                                    tweetUrl: selectedItem.tweetUrl,
                                    isActive: selectedItem.isActive,
                                    triggeredCount: selectedItem.triggeredCount,
                                    maxTriggers: selectedItem.maxTriggers,
                                    createdAt: selectedItem.createdAt,
                                    lastChecked: selectedItem.lastChecked
                                } : selectedType === 'execution' ? {
                                    id: selectedItem.id,
                                    triggerId: selectedItem.triggerId,
                                    replierHandle: selectedItem.replierHandle,
                                    bnsName: selectedItem.bnsName,
                                    status: selectedItem.status,
                                    executedAt: selectedItem.executedAt
                                } : selectedItem,
                                'basic'
                            )}

                            {/* Token Information (for triggers) */}
                            {selectedType === 'trigger' && (
                                renderJsonSection(
                                    'Token Configuration',
                                    {
                                        inputToken: selectedItem.inputToken,
                                        outputToken: selectedItem.outputToken,
                                        amountIn: selectedItem.amountIn,
                                        targetPrice: selectedItem.targetPrice,
                                        direction: selectedItem.direction,
                                        conditionToken: selectedItem.conditionToken
                                    },
                                    'tokens'
                                )
                            )}

                            {/* Order Information */}
                            {selectedType === 'trigger' && selectedItem.orderIds && (
                                renderJsonSection(
                                    'Pre-signed Orders',
                                    {
                                        orderIds: selectedItem.orderIds,
                                        availableOrders: selectedItem.availableOrders,
                                        totalOrders: selectedItem.orderIds.length
                                    },
                                    'orders'
                                )
                            )}

                            {/* Execution Details */}
                            {selectedType === 'execution' && (
                                renderJsonSection(
                                    'Execution Details',
                                    {
                                        recipientAddress: selectedItem.recipientAddress,
                                        orderUuid: selectedItem.orderUuid,
                                        txid: selectedItem.txid,
                                        error: selectedItem.error,
                                        twitterReplyStatus: selectedItem.twitterReplyStatus,
                                        twitterReplyError: selectedItem.twitterReplyError
                                    },
                                    'execution'
                                )
                            )}

                            {/* Full Raw Data */}
                            {renderJsonSection(
                                'Complete Raw Data',
                                selectedItem,
                                'raw'
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-card rounded-lg border border-border p-6">
                        <div className="text-center py-12">
                            <Search className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                            <h3 className="text-lg font-medium text-foreground mb-2">
                                Select an Item to Inspect
                            </h3>
                            <p className="text-muted-foreground">
                                Choose a trigger or execution from the left panel to view detailed information
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
'use client';

import React, { useState } from 'react';
import { Search, Copy, ExternalLink, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { StatusResponse } from '@/lib/types';

async function lookupTransaction(txid: string): Promise<StatusResponse> {
    try {
        const response = await fetch(`/api/v1/status/${txid}`);
        const data = await response.json();
        
        if (data.success) {
            return data.data;
        }
        
        throw new Error(data.message || 'Failed to lookup transaction');
    } catch (error) {
        console.error('Failed to lookup transaction:', error);
        throw error;
    }
}

function getStatusIcon(status: string) {
    switch (status) {
        case 'success':
            return <CheckCircle className="w-5 h-5 text-green-500" />;
        case 'abort_by_response':
        case 'abort_by_post_condition':
            return <XCircle className="w-5 h-5 text-red-500" />;
        default:
            return <Clock className="w-5 h-5 text-yellow-500" />;
    }
}

function getStatusColor(status: string): string {
    switch (status) {
        case 'success':
            return 'text-green-500';
        case 'abort_by_response':
        case 'abort_by_post_condition':
            return 'text-red-500';
        default:
            return 'text-yellow-500';
    }
}

async function copyToClipboard(text: string) {
    try {
        await navigator.clipboard.writeText(text);
    } catch (err) {
        console.error('Failed to copy to clipboard:', err);
    }
}

export function TransactionLookup() {
    const [txid, setTxid] = useState('');
    const [result, setResult] = useState<StatusResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLookup = async () => {
        if (!txid.trim()) {
            setError('Please enter a transaction ID');
            return;
        }

        setIsLoading(true);
        setError(null);
        setResult(null);

        try {
            const data = await lookupTransaction(txid.trim());
            setResult(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to lookup transaction');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleLookup();
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Transaction Lookup</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Enter transaction ID (0x...)"
                            value={txid}
                            onChange={(e) => setTxid(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="flex-1"
                        />
                        <Button
                            onClick={handleLookup}
                            disabled={isLoading}
                        >
                            <Search className="w-4 h-4 mr-2" />
                            {isLoading ? 'Checking...' : 'Lookup'}
                        </Button>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                            <p className="text-red-700 text-sm">{error}</p>
                        </div>
                    )}

                    {result && (
                        <div className="p-4 bg-muted rounded-md">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">Status:</span>
                                    {getStatusIcon(result.status)}
                                    <span className={`text-sm font-mono ${getStatusColor(result.status)}`}>
                                        {result.status}
                                    </span>
                                    {result.fromCache && (
                                        <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded">
                                            cached
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">Transaction ID:</span>
                                    <code className="text-sm bg-background px-2 py-1 rounded flex-1">
                                        {result.txid}
                                    </code>
                                    <Button
                                        onClick={() => copyToClipboard(result.txid)}
                                        variant="outline"
                                        size="sm"
                                    >
                                        <Copy className="w-3 h-3" />
                                    </Button>
                                    <Button
                                        onClick={() => window.open(`https://explorer.hiro.so/txid/${result.txid}?chain=mainnet`, '_blank')}
                                        variant="outline"
                                        size="sm"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                    </Button>
                                </div>

                                {result.blockHeight && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">Block Height:</span>
                                        <span className="text-sm font-mono">
                                            {result.blockHeight}
                                        </span>
                                    </div>
                                )}

                                {result.blockTime && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">Block Time:</span>
                                        <span className="text-sm">
                                            {new Date(result.blockTime * 1000).toLocaleString()}
                                        </span>
                                    </div>
                                )}

                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">Checked At:</span>
                                    <span className="text-sm text-muted-foreground">
                                        {new Date(result.checkedAt).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
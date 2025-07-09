'use client';

import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, ExternalLink, Copy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { TransactionInfo } from '@/lib/types';

interface QueueItem extends TransactionInfo {
    addedAt: number;
}

interface QueueResponse {
    queue: QueueItem[];
    total: number;
}

async function fetchQueue(): Promise<QueueResponse> {
    try {
        const response = await fetch('/api/v1/admin/queue');
        const data = await response.json();
        
        if (data.success) {
            return data.data;
        }
        
        throw new Error('Failed to fetch queue');
    } catch (error) {
        console.error('Failed to fetch queue:', error);
        throw error;
    }
}

function getStatusIcon(status: string) {
    switch (status) {
        case 'success':
            return <CheckCircle className="w-4 h-4 text-green-500" />;
        case 'abort_by_response':
        case 'abort_by_post_condition':
            return <XCircle className="w-4 h-4 text-red-500" />;
        default:
            return <Clock className="w-4 h-4 text-yellow-500" />;
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

function formatAge(timestamp: number): string {
    const now = Date.now();
    const ageMs = now - timestamp;
    const ageMinutes = Math.floor(ageMs / (60 * 1000));
    const ageHours = Math.floor(ageMs / (60 * 60 * 1000));
    const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
    
    if (ageDays > 0) {
        return `${ageDays}d ${ageHours % 24}h`;
    } else if (ageHours > 0) {
        return `${ageHours}h ${ageMinutes % 60}m`;
    } else {
        return `${ageMinutes}m`;
    }
}

function shortenTxId(txid: string): string {
    return `${txid.slice(0, 8)}...${txid.slice(-8)}`;
}

async function copyToClipboard(text: string) {
    try {
        await navigator.clipboard.writeText(text);
    } catch (err) {
        console.error('Failed to copy to clipboard:', err);
    }
}

export function TransactionQueue() {
    const [queue, setQueue] = useState<QueueResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadQueue = async () => {
        try {
            setError(null);
            const data = await fetchQueue();
            setQueue(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load queue');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadQueue();
        
        // Auto-refresh every 30 seconds
        const interval = setInterval(loadQueue, 30000);
        return () => clearInterval(interval);
    }, []);

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Transaction Queue</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8">Loading...</div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Transaction Queue</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-red-500">
                        Error: {error}
                        <Button onClick={loadQueue} variant="outline" className="mt-2 ml-2">
                            Retry
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!queue || queue.queue.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Transaction Queue</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        No transactions in queue
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Transaction Queue ({queue.total})</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Status</TableHead>
                                <TableHead>Transaction ID</TableHead>
                                <TableHead>Age</TableHead>
                                <TableHead>Block Height</TableHead>
                                <TableHead>Last Checked</TableHead>
                                <TableHead>Check Count</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {queue.queue.map((item) => (
                                <TableRow key={item.txid}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(item.status)}
                                            <span className={`text-sm font-mono ${getStatusColor(item.status)}`}>
                                                {item.status}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <code className="text-sm bg-muted px-2 py-1 rounded">
                                            {shortenTxId(item.txid)}
                                        </code>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-muted-foreground">
                                            {formatAge(item.addedAt)}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm font-mono">
                                            {item.blockHeight || '-'}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-muted-foreground">
                                            {item.lastChecked ? formatAge(item.lastChecked) : 'Never'}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm font-mono">
                                            {item.checkCount}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                onClick={() => copyToClipboard(item.txid)}
                                                variant="outline"
                                                size="sm"
                                            >
                                                <Copy className="w-3 h-3" />
                                            </Button>
                                            <Button
                                                onClick={() => window.open(`https://explorer.hiro.so/txid/${item.txid}?chain=mainnet`, '_blank')}
                                                variant="outline"
                                                size="sm"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
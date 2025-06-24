'use client';

import React, { useState, useEffect } from 'react';
import { 
    Clock, 
    List, 
    RefreshCw, 
    AlertCircle, 
    CheckCircle, 
    XCircle,
    Users,
    Calendar,
    Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface QueueStatus {
    queueSize: number;
    requestCount: number;
    maxRequests: number;
    rateLimitReset: number;
    rateLimitResetTime: string | null;
    remainingRequests: number;
}

interface QueueItem {
    id: string;
    tweetId: string;
    message: string;
    attempts: number;
    lastAttempt?: number;
    createdAt: number;
}

export default function QueueManager() {
    const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
    const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchQueueStatus = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/v1/twitter-reply-queue');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            setQueueStatus(data.data);
            setLastUpdated(new Date());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch queue status');
        } finally {
            setLoading(false);
        }
    };

    // Auto-refresh every 10 seconds
    useEffect(() => {
        fetchQueueStatus();
        const interval = setInterval(fetchQueueStatus, 10000);
        return () => clearInterval(interval);
    }, []);

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleString();
    };

    const formatDuration = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    };

    const getStatusColor = () => {
        if (!queueStatus) return 'text-muted-foreground';
        if (queueStatus.remainingRequests === 0) return 'text-red-500';
        if (queueStatus.remainingRequests < 5) return 'text-yellow-500';
        return 'text-green-500';
    };

    const getQueueHealthStatus = () => {
        if (!queueStatus) return { status: 'unknown', message: 'Loading...' };
        
        if (queueStatus.remainingRequests === 0) {
            const resetTime = queueStatus.rateLimitResetTime ? new Date(queueStatus.rateLimitResetTime) : null;
            const timeUntilReset = resetTime ? resetTime.getTime() - Date.now() : 0;
            return {
                status: 'rate_limited',
                message: `Rate limited. Resets in ${timeUntilReset > 0 ? formatDuration(timeUntilReset) : 'soon'}`
            };
        }
        
        if (queueStatus.queueSize > 20) {
            return {
                status: 'queue_full',
                message: `Queue is very full (${queueStatus.queueSize} items)`
            };
        }
        
        if (queueStatus.queueSize > 0) {
            return {
                status: 'processing',
                message: `Processing ${queueStatus.queueSize} items`
            };
        }
        
        return {
            status: 'healthy',
            message: 'Queue is empty and ready'
        };
    };

    const healthStatus = getQueueHealthStatus();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Queue Management</h2>
                    <p className="text-muted-foreground">
                        Monitor and manage the Twitter reply queue system
                    </p>
                </div>
                <Button 
                    onClick={fetchQueueStatus} 
                    disabled={loading}
                    variant="outline"
                >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Error Alert */}
            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Error loading queue status: {error}
                    </AlertDescription>
                </Alert>
            )}

            {/* Status Overview */}
            {queueStatus && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Queue Status Card */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Queue Status</CardTitle>
                            <List className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{queueStatus.queueSize}</div>
                            <p className="text-xs text-muted-foreground">
                                items in queue
                            </p>
                            <div className="mt-2">
                                <Badge 
                                    variant={
                                        healthStatus.status === 'healthy' ? 'default' :
                                        healthStatus.status === 'processing' ? 'secondary' :
                                        'destructive'
                                    }
                                >
                                    {healthStatus.message}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Rate Limit Card */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Rate Limit</CardTitle>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                <span className={getStatusColor()}>
                                    {queueStatus.requestCount}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                    /{queueStatus.maxRequests}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                requests used (24h)
                            </p>
                            <div className="mt-2">
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="text-muted-foreground">Remaining:</span>
                                    <span className={getStatusColor()}>
                                        {queueStatus.remainingRequests}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Reset Time Card */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Rate Limit Reset</CardTitle>
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm font-bold">
                                {queueStatus.rateLimitResetTime ? (
                                    <>
                                        <div>{formatTime(queueStatus.rateLimitReset)}</div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {formatDuration(queueStatus.rateLimitReset - Date.now())} remaining
                                        </div>
                                    </>
                                ) : (
                                    <span className="text-muted-foreground">Not set</span>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Queue Details */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <List className="w-5 h-5" />
                        Queue Details
                    </CardTitle>
                    <CardDescription>
                        Current items in the Twitter reply queue
                        {lastUpdated && (
                            <span className="ml-2 text-xs">
                                (Last updated: {lastUpdated.toLocaleTimeString()})
                            </span>
                        )}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {queueStatus?.queueSize === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                            <p className="text-lg font-medium">Queue is empty</p>
                            <p className="text-sm">All replies have been processed</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="text-sm text-muted-foreground">
                                Note: Queue items are stored in Vercel KV. This interface shows status but cannot display individual queue items for security reasons.
                            </div>
                            
                            {queueStatus && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                                    <div>
                                        <div className="text-sm font-medium">Queue Health</div>
                                        <div className="text-xs text-muted-foreground">
                                            {queueStatus.queueSize} items waiting to be processed
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium">Processing Rate</div>
                                        <div className="text-xs text-muted-foreground">
                                            ~2 seconds between requests when processing
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* System Information */}
            <Card>
                <CardHeader>
                    <CardTitle>System Information</CardTitle>
                    <CardDescription>
                        Technical details about the queue system
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-2">
                            <h4 className="font-medium">Rate Limiting</h4>
                            <ul className="space-y-1 text-muted-foreground">
                                <li>• Twitter API v2 Free Tier: 17 requests per 24 hours</li>
                                <li>• Rate limit resets every 24 hours</li>
                                <li>• Queue holds items when rate limited</li>
                            </ul>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-medium">Retry Logic</h4>
                            <ul className="space-y-1 text-muted-foreground">
                                <li>• Exponential backoff: 1s, 4s, 10s</li>
                                <li>• Maximum 3 retry attempts</li>
                                <li>• Failed items are removed after max retries</li>
                            </ul>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-medium">Persistence</h4>
                            <ul className="space-y-1 text-muted-foreground">
                                <li>• Queue persisted in Vercel KV</li>
                                <li>• Survives server restarts</li>
                                <li>• Rate limit state preserved</li>
                            </ul>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-medium">Processing</h4>
                            <ul className="space-y-1 text-muted-foreground">
                                <li>• FIFO (First In, First Out) order</li>
                                <li>• 2 second delay between requests</li>
                                <li>• Automatic background processing</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
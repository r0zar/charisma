'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle, Clock, Pause, Play, RotateCcw, Trash2, Settings, Activity } from 'lucide-react';

interface QueueStatus {
    isProcessing: boolean;
    isPaused: boolean;
    queueSize: number;
    highPriorityCount: number;
    normalPriorityCount: number;
    lowPriorityCount: number;
    requestCount: number;
    maxRequests: number;
    rateLimitReset: number;
    metrics: {
        totalProcessed: number;
        successCount: number;
        failureCount: number;
        apiSuccessCount: number;
        browserlessSuccessCount: number;
        averageProcessingTime: number;
        lastProcessedAt?: number;
    };
    browserlessEnabled: boolean;
    browserlessConnected: boolean;
    browserqlEnabled: boolean;
}

interface QueueItem {
    id: string;
    tweetId: string;
    message: string;
    attempts: number;
    priority: string;
    preferredMethod: string;
    createdAt: number;
    lastAttempt?: number;
}

export function TwitterQueueManager() {
    const [status, setStatus] = useState<QueueStatus | null>(null);
    const [items, setItems] = useState<QueueItem[]>([]);
    const [forceMethod, setForceMethod] = useState<string>('auto');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    
    // Test reply form
    const [testTweetId, setTestTweetId] = useState('');
    const [testMessage, setTestMessage] = useState('');
    const [testPriority, setTestPriority] = useState('normal');
    const [testMethod, setTestMethod] = useState('auto');

    const fetchStatus = async () => {
        try {
            const response = await fetch('/api/admin/twitter-queue');
            const result = await response.json();
            
            if (result.success) {
                setStatus(result.data.status);
                setItems(result.data.recentItems || []);
                setForceMethod(result.data.forceMethod || 'auto');
            }
        } catch (error) {
            console.error('Failed to fetch queue status:', error);
        } finally {
            setLoading(false);
        }
    };

    const executeAction = async (action: string, params: any = {}) => {
        setActionLoading(action);
        try {
            const response = await fetch('/api/admin/twitter-queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...params })
            });
            
            const result = await response.json();
            
            if (result.success) {
                await fetchStatus(); // Refresh status
                
                // Show detailed results for connection tests
                if (action === 'test-connection') {
                    alert('✅ BaaS v2 connection test successful!\n\nThe connection to browserless.io BaaS v2 is working properly.');
                }
                
                if (action === 'test-browserql') {
                    alert('✅ BrowserQL connection test successful!\n\nThe connection to browserless.io BrowserQL is working properly.');
                }
                
                if (action === 'test-both') {
                    const baasStatus = result.data?.baas?.success ? '✅ Success' : '❌ Failed';
                    const bqlStatus = result.data?.browserql?.success ? '✅ Success' : '❌ Failed';
                    alert(`Connection Test Results:\n\nBaaS v2: ${baasStatus}\nBrowserQL: ${bqlStatus}\n\nBoth services are ready for use!`);
                }
                
                return result;
            } else {
                // Show detailed error for connection tests
                if ((action === 'test-connection' || action === 'test-browserql') && result.data?.details) {
                    const details = result.data.details;
                    const serviceName = action === 'test-connection' ? 'BaaS v2' : 'BrowserQL';
                    alert(`❌ ${serviceName} connection test failed:\n\n${result.error}\n\nError Details:\n- Type: ${details.name}\n- Message: ${details.message}`);
                } else if (action === 'test-both') {
                    const baasError = result.data?.baas?.error || 'Unknown error';
                    const bqlError = result.data?.browserql?.error || 'Unknown error';
                    alert(`❌ Connection tests failed:\n\nBaaS v2: ${baasError}\nBrowserQL: ${bqlError}\n\nCheck your browserless configuration.`);
                } else {
                    throw new Error(result.error || 'Action failed');
                }
            }
        } catch (error) {
            console.error(`Action ${action} failed:`, error);
            
            // Show specific error message for connection tests
            if (action === 'test-connection' || action === 'test-browserql' || action === 'test-both') {
                const serviceName = action === 'test-connection' ? 'BaaS v2' : action === 'test-browserql' ? 'BrowserQL' : 'Connection';
                alert(`❌ ${serviceName} test failed:\n\n${(error as Error).message}\n\nPlease check:\n- BROWSERLESS_TOKEN is valid\n- Network connectivity\n- Browserless service status`);
            } else {
                throw error;
            }
        } finally {
            setActionLoading(null);
        }
    };

    const handleTestReply = async () => {
        if (!testTweetId || !testMessage) return;
        
        try {
            await executeAction('test-reply', {
                tweetId: testTweetId,
                message: testMessage,
                priority: testPriority,
                preferredMethod: testMethod
            });
            
            // Clear form
            setTestTweetId('');
            setTestMessage('');
        } catch (error) {
            // Error handling could be improved with toast notifications
            alert('Test reply failed: ' + (error as Error).message);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 5000); // Refresh every 5 seconds
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return <div className="p-4">Loading queue status...</div>;
    }

    if (!status) {
        return <div className="p-4">Failed to load queue status</div>;
    }

    const successRate = status.metrics.totalProcessed > 0 
        ? (status.metrics.successCount / status.metrics.totalProcessed * 100).toFixed(1) 
        : '0';

    const timeUntilReset = status.rateLimitReset - Date.now();
    const hoursUntilReset = Math.max(0, Math.floor(timeUntilReset / (1000 * 60 * 60)));
    const minutesUntilReset = Math.max(0, Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60)));

    return (
        <div className="space-y-6">
            {/* Status Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Queue Status</CardTitle>
                        {status.isProcessing ? (
                            status.isPaused ? <Pause className="h-4 w-4 text-yellow-500" /> : <Activity className="h-4 w-4 text-green-500" />
                        ) : (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{status.queueSize}</div>
                        <p className="text-xs text-muted-foreground">
                            {status.isPaused ? 'Paused' : status.isProcessing ? 'Processing' : 'Stopped'}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">API Limit</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{status.requestCount}/{status.maxRequests}</div>
                        <p className="text-xs text-muted-foreground">
                            Reset in {hoursUntilReset}h {minutesUntilReset}m
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{successRate}%</div>
                        <p className="text-xs text-muted-foreground">
                            {status.metrics.successCount}/{status.metrics.totalProcessed} successful
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Browserless</CardTitle>
                        <div className={`h-2 w-2 rounded-full ${status.browserlessConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {status.browserlessEnabled ? (status.browserlessConnected ? 'ON' : 'OFF') : 'DISABLED'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {status.metrics.browserlessSuccessCount} via browserless
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Controls */}
            <Card>
                <CardHeader>
                    <CardTitle>Queue Controls</CardTitle>
                    <CardDescription>Manage queue processing and settings</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2 mb-4">
                        <Button
                            onClick={() => executeAction(status.isPaused ? 'resume' : 'pause')}
                            disabled={actionLoading === 'pause' || actionLoading === 'resume'}
                            variant={status.isPaused ? 'default' : 'secondary'}
                        >
                            {status.isPaused ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
                            {status.isPaused ? 'Resume' : 'Pause'}
                        </Button>
                        
                        <Button
                            onClick={() => executeAction('retry-failed')}
                            disabled={actionLoading === 'retry-failed'}
                            variant="outline"
                        >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Retry Failed
                        </Button>
                        
                        <Button
                            onClick={() => executeAction('clear')}
                            disabled={actionLoading === 'clear'}
                            variant="destructive"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Clear Queue
                        </Button>
                        
                        <Button
                            onClick={() => executeAction('reset-metrics')}
                            disabled={actionLoading === 'reset-metrics'}
                            variant="outline"
                        >
                            Reset Metrics
                        </Button>
                        
                        {status.browserlessEnabled && (
                            <>
                                <Button
                                    onClick={() => executeAction('init-browserless')}
                                    disabled={actionLoading === 'init-browserless'}
                                    variant="outline"
                                >
                                    Init BaaS v2
                                </Button>
                                
                                <Button
                                    onClick={() => executeAction('test-connection')}
                                    disabled={actionLoading === 'test-connection'}
                                    variant="outline"
                                >
                                    Test BaaS
                                </Button>
                            </>
                        )}
                        
                        {status.browserqlEnabled && (
                            <>
                                <Button
                                    onClick={() => executeAction('test-browserql')}
                                    disabled={actionLoading === 'test-browserql'}
                                    variant="outline"
                                >
                                    Test BrowserQL
                                </Button>
                                
                                {status.browserlessEnabled && (
                                    <Button
                                        onClick={() => executeAction('test-both')}
                                        disabled={actionLoading === 'test-both'}
                                        variant="outline"
                                    >
                                        Test Both
                                    </Button>
                                )}
                            </>
                        )}
                    </div>

                    <div className="flex items-center space-x-4">
                        <Label htmlFor="force-method">Force Method:</Label>
                        <Select value={forceMethod} onValueChange={(value: string) => {
                            setForceMethod(value);
                            executeAction('set-force-method', { method: value });
                        }}>
                            <SelectTrigger className="w-32">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="auto">Auto</SelectItem>
                                <SelectItem value="api">API Only</SelectItem>
                                <SelectItem value="browserless">BaaS v2 Only</SelectItem>
                                <SelectItem value="browserql">BrowserQL Only</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <Tabs defaultValue="queue" className="w-full">
                <TabsList>
                    <TabsTrigger value="queue">Queue Items</TabsTrigger>
                    <TabsTrigger value="metrics">Detailed Metrics</TabsTrigger>
                    <TabsTrigger value="test">Test Reply</TabsTrigger>
                </TabsList>

                <TabsContent value="queue" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Queue Items</CardTitle>
                            <CardDescription>
                                Showing last {items.length} items. Priority breakdown: 
                                <Badge variant="destructive" className="ml-2">{status.highPriorityCount} High</Badge>
                                <Badge variant="secondary" className="ml-1">{status.normalPriorityCount} Normal</Badge>
                                <Badge variant="outline" className="ml-1">{status.lowPriorityCount} Low</Badge>
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {items.length === 0 ? (
                                    <p className="text-muted-foreground">No items in queue</p>
                                ) : (
                                    items.map((item) => (
                                        <div key={item.id} className="flex items-center justify-between p-3 border rounded">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center space-x-2">
                                                    <Badge variant={
                                                        item.priority === 'high' ? 'destructive' : 
                                                        item.priority === 'low' ? 'outline' : 'secondary'
                                                    }>
                                                        {item.priority}
                                                    </Badge>
                                                    <Badge variant="outline">{item.preferredMethod}</Badge>
                                                    <span className="text-sm text-muted-foreground">
                                                        Tweet: {item.tweetId}
                                                    </span>
                                                </div>
                                                <p className="text-sm truncate mt-1">{item.message}</p>
                                                <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-1">
                                                    <span>Attempts: {item.attempts}</span>
                                                    <span>Created: {new Date(item.createdAt).toLocaleString()}</span>
                                                    {item.lastAttempt && (
                                                        <span>Last attempt: {new Date(item.lastAttempt).toLocaleString()}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="metrics" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Processing Stats</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="flex justify-between">
                                    <span>Total Processed:</span>
                                    <span className="font-mono">{status.metrics.totalProcessed}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Successful:</span>
                                    <span className="font-mono text-green-600">{status.metrics.successCount}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Failed:</span>
                                    <span className="font-mono text-red-600">{status.metrics.failureCount}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Avg Time:</span>
                                    <span className="font-mono">{status.metrics.averageProcessingTime.toFixed(0)}ms</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Method Success</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="flex justify-between">
                                    <span>API Success:</span>
                                    <span className="font-mono">{status.metrics.apiSuccessCount}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Browserless Success:</span>
                                    <span className="font-mono">{status.metrics.browserlessSuccessCount}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>API Rate:</span>
                                    <span className="font-mono">
                                        {status.metrics.apiSuccessCount > 0 ? 
                                            (status.metrics.apiSuccessCount / status.metrics.successCount * 100).toFixed(1) : '0'}%
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Browserless Rate:</span>
                                    <span className="font-mono">
                                        {status.metrics.browserlessSuccessCount > 0 ? 
                                            (status.metrics.browserlessSuccessCount / status.metrics.successCount * 100).toFixed(1) : '0'}%
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Last Activity</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {status.metrics.lastProcessedAt ? (
                                    <div className="text-sm">
                                        <p>Last processed:</p>
                                        <p className="font-mono text-muted-foreground">
                                            {new Date(status.metrics.lastProcessedAt).toLocaleString()}
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground">No items processed yet</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="test" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Test Reply</CardTitle>
                            <CardDescription>Queue a test reply to verify system functionality</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="tweet-id">Tweet ID</Label>
                                    <Input
                                        id="tweet-id"
                                        value={testTweetId}
                                        onChange={(e) => setTestTweetId(e.target.value)}
                                        placeholder="1234567890123456789"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="priority">Priority</Label>
                                    <Select value={testPriority} onValueChange={setTestPriority}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="high">High</SelectItem>
                                            <SelectItem value="normal">Normal</SelectItem>
                                            <SelectItem value="low">Low</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="method">Preferred Method</Label>
                                <Select value={testMethod} onValueChange={setTestMethod}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="auto">Auto (fallback enabled)</SelectItem>
                                        <SelectItem value="api">API Only</SelectItem>
                                        <SelectItem value="browserless">Browserless Only</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="message">Message</Label>
                                <Input
                                    id="message"
                                    value={testMessage}
                                    onChange={(e) => setTestMessage(e.target.value)}
                                    placeholder="Test reply message..."
                                />
                            </div>
                            <Button
                                onClick={handleTestReply}
                                disabled={!testTweetId || !testMessage || actionLoading === 'test-reply'}
                            >
                                {actionLoading === 'test-reply' ? 'Queuing...' : 'Queue Test Reply'}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
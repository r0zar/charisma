'use client';

import React, { useState } from 'react';
import { 
    Play, 
    Loader2, 
    CheckCircle, 
    XCircle, 
    ExternalLink,
    AlertTriangle,
    Twitter,
    Hash,
    Plus,
    X,
    MessageSquare,
    Send
} from 'lucide-react';
import { toast } from 'sonner';

interface TwitterScrapingResult {
    tweetId: string;
    tweetUrl: string;
    scrapingResult: {
        success: boolean;
        replies: any[];
        error?: string;
    };
    debugInfo: {
        totalReplies: number;
        scrapingSuccess: boolean;
    };
    testedAt: string;
}

interface BNSBatchResult {
    results: Array<{
        input: string;
        bnsName?: string;
        address?: string;
        success: boolean;
        error?: string;
        extractedFrom?: string;
    }>;
    summary: {
        totalTested: number;
        successful: number;
        failed: number;
        successRate: string;
    };
    testedAt: string;
}

interface TwitterReplyResult {
    success: boolean;
    tweetId?: string;
    message: string;
    replyUrl?: string;
    error?: string;
    debugInfo?: {
        credentialsValid: boolean;
        messageLength: number;
        targetTweetId: string;
    };
    testedAt: string;
}

export default function ComponentTester() {
    // Twitter Scraping Test States
    const [tweetUrl, setTweetUrl] = useState('');
    const [scrapingLoading, setScrapingLoading] = useState(false);
    const [scrapingResult, setScrapingResult] = useState<TwitterScrapingResult | null>(null);
    
    // BNS Batch Test States
    const [bnsNames, setBnsNames] = useState<string[]>(['']);
    const [bnsLoading, setBnsLoading] = useState(false);
    const [bnsResult, setBnsResult] = useState<BNSBatchResult | null>(null);
    
    // Twitter Reply Test States
    const [replyTargetTweetUrl, setReplyTargetTweetUrl] = useState('');
    const [replyMessage, setReplyMessage] = useState('🤖 This is a test reply from the Twitter triggers testing dashboard!');
    const [replyLoading, setReplyLoading] = useState(false);
    const [replyResult, setReplyResult] = useState<TwitterReplyResult | null>(null);

    const testTwitterScraping = async () => {
        if (!tweetUrl.trim()) {
            toast.error('Please enter a Tweet URL');
            return;
        }

        setScrapingLoading(true);
        setScrapingResult(null);

        try {
            const response = await fetch('/api/v1/twitter-triggers/testing/scrape-tweet', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ tweetUrl: tweetUrl.trim() }),
            });

            const data = await response.json();

            if (data.success) {
                setScrapingResult(data.data);
                toast.success(`Found ${data.data.debugInfo.totalReplies} replies`);
            } else {
                toast.error(`Test failed: ${data.error}`);
            }
        } catch (error) {
            console.error('Twitter scraping test error:', error);
            toast.error('Failed to test Twitter scraping');
        } finally {
            setScrapingLoading(false);
        }
    };

    const testBNSBatch = async () => {
        const validNames = bnsNames.filter(name => name.trim());
        
        if (validNames.length === 0) {
            toast.error('Please enter at least one BNS name');
            return;
        }

        setBnsLoading(true);
        setBnsResult(null);

        try {
            const response = await fetch('/api/v1/twitter-triggers/testing/bns-batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ bnsNames: validNames }),
            });

            const data = await response.json();

            if (data.success) {
                setBnsResult(data.data);
                toast.success(`Tested ${data.data.summary.totalTested} BNS names - ${data.data.summary.successRate} success rate`);
            } else {
                toast.error(`Test failed: ${data.error}`);
            }
        } catch (error) {
            console.error('BNS batch test error:', error);
            toast.error('Failed to test BNS batch');
        } finally {
            setBnsLoading(false);
        }
    };

    const addBnsName = () => {
        setBnsNames([...bnsNames, '']);
    };

    const removeBnsName = (index: number) => {
        setBnsNames(bnsNames.filter((_, i) => i !== index));
    };

    const updateBnsName = (index: number, value: string) => {
        const updated = [...bnsNames];
        updated[index] = value;
        setBnsNames(updated);
    };

    const testTwitterReply = async () => {
        if (!replyTargetTweetUrl.trim()) {
            toast.error('Please enter a Tweet URL to reply to');
            return;
        }
        
        if (!replyMessage.trim()) {
            toast.error('Please enter a reply message');
            return;
        }

        setReplyLoading(true);
        setReplyResult(null);

        try {
            const response = await fetch('/api/v1/twitter-triggers/testing/reply-test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    tweetUrl: replyTargetTweetUrl.trim(),
                    message: replyMessage.trim()
                }),
            });

            const data = await response.json();

            if (data.success) {
                setReplyResult(data.data);
                if (data.data.success) {
                    toast.success('Reply sent successfully!');
                } else {
                    toast.error(`Reply failed: ${data.data.error}`);
                }
            } else {
                toast.error(`Test failed: ${data.error}`);
            }
        } catch (error) {
            console.error('Twitter reply test error:', error);
            toast.error('Failed to test Twitter reply');
        } finally {
            setReplyLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Twitter Scraping Test */}
            <div className="bg-card rounded-lg border border-border p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                        <Twitter className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Twitter Scraping Test</h3>
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
                    
                    <button 
                        onClick={testTwitterScraping}
                        disabled={scrapingLoading}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {scrapingLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Play className="w-4 h-4" />
                        )}
                        Test Scraping
                    </button>
                    
                    {/* Results */}
                    {scrapingResult && (
                        <div className="bg-muted rounded-lg p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                {scrapingResult.scrapingResult.success ? (
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                ) : (
                                    <XCircle className="w-5 h-5 text-red-500" />
                                )}
                                <span className="font-medium">
                                    {scrapingResult.scrapingResult.success ? 'Success' : 'Failed'}
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Tweet ID:</span>
                                    <span className="ml-2 font-mono">{scrapingResult.tweetId}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Replies Found:</span>
                                    <span className="ml-2 font-semibold">{scrapingResult.debugInfo.totalReplies}</span>
                                </div>
                            </div>
                            
                            {scrapingResult.scrapingResult.error && (
                                <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950 p-2 rounded">
                                    Error: {scrapingResult.scrapingResult.error}
                                </div>
                            )}
                            
                            {scrapingResult.scrapingResult.replies && scrapingResult.scrapingResult.replies.length > 0 && (
                                <div>
                                    <div className="text-sm font-medium mb-2">Sample Replies:</div>
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {scrapingResult.scrapingResult.replies.slice(0, 3).map((reply, index) => (
                                            <div key={index} className="text-xs bg-background p-2 rounded border">
                                                <div className="font-mono text-muted-foreground">@{reply.authorHandle}</div>
                                                <div className="truncate">{reply.text || 'No text'}</div>
                                            </div>
                                        ))}
                                        {scrapingResult.scrapingResult.replies.length > 3 && (
                                            <div className="text-xs text-muted-foreground">
                                                + {scrapingResult.scrapingResult.replies.length - 3} more replies
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* BNS Batch Resolution Test */}
            <div className="bg-card rounded-lg border border-border p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                        <Hash className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">BNS Batch Resolution Test</h3>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            BNS Names to Test
                        </label>
                        <div className="space-y-2">
                            {bnsNames.map((name, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        placeholder="username.btc or @username.btc"
                                        value={name}
                                        onChange={(e) => updateBnsName(index, e.target.value)}
                                        className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                    {bnsNames.length > 1 && (
                                        <button
                                            onClick={() => removeBnsName(index)}
                                            className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        
                        <button
                            onClick={addBnsName}
                            disabled={bnsNames.length >= 10}
                            className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                        >
                            <Plus className="w-4 h-4" />
                            Add BNS Name (max 10)
                        </button>
                    </div>
                    
                    <button 
                        onClick={testBNSBatch}
                        disabled={bnsLoading || bnsNames.filter(n => n.trim()).length === 0}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {bnsLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Play className="w-4 h-4" />
                        )}
                        Test BNS Resolution
                    </button>
                    
                    {/* Results */}
                    {bnsResult && (
                        <div className="bg-muted rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                    <span className="font-medium">Batch Test Complete</span>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    {bnsResult.summary.successRate} success rate
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Total Tested:</span>
                                    <span className="ml-2 font-semibold">{bnsResult.summary.totalTested}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Successful:</span>
                                    <span className="ml-2 font-semibold text-green-600">{bnsResult.summary.successful}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Failed:</span>
                                    <span className="ml-2 font-semibold text-red-600">{bnsResult.summary.failed}</span>
                                </div>
                            </div>
                            
                            <div>
                                <div className="text-sm font-medium mb-2">Detailed Results:</div>
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                    {bnsResult.results.map((result, index) => (
                                        <div key={index} className="flex items-center justify-between text-xs bg-background p-2 rounded border">
                                            <div className="flex items-center gap-2">
                                                {result.success ? (
                                                    <CheckCircle className="w-3 h-3 text-green-500" />
                                                ) : (
                                                    <XCircle className="w-3 h-3 text-red-500" />
                                                )}
                                                <span className="font-mono">{result.input}</span>
                                                {result.bnsName && result.bnsName !== result.input && (
                                                    <span className="text-muted-foreground">→ {result.bnsName}</span>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                {result.success && result.address ? (
                                                    <span className="font-mono text-green-600">
                                                        {result.address.slice(0, 8)}...{result.address.slice(-6)}
                                                    </span>
                                                ) : (
                                                    <span className="text-red-600">{result.error}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Twitter Reply Test */}
            <div className="bg-card rounded-lg border border-border p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Twitter Reply Test</h3>
                </div>
                
                <div className="space-y-4">
                    <div className="warning-card">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                            <div className="text-sm">
                                <strong>Warning:</strong> This will send a real reply to the specified tweet using your configured Twitter account.
                                Only use this with your own tweets or test tweets.
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            Tweet URL to Reply To
                        </label>
                        <input
                            type="url"
                            placeholder="https://twitter.com/username/status/123456789"
                            value={replyTargetTweetUrl}
                            onChange={(e) => setReplyTargetTweetUrl(e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            The tweet you want to reply to (preferably your own tweet for testing)
                        </p>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            Reply Message
                        </label>
                        <textarea
                            placeholder="Enter your test reply message..."
                            value={replyMessage}
                            onChange={(e) => setReplyMessage(e.target.value)}
                            rows={3}
                            maxLength={280}
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>The message to post as a reply</span>
                            <span>{replyMessage.length}/280 characters</span>
                        </div>
                    </div>
                    
                    <button 
                        onClick={testTwitterReply}
                        disabled={replyLoading || !replyTargetTweetUrl.trim() || !replyMessage.trim()}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {replyLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                        Send Test Reply
                    </button>
                    
                    {/* Results */}
                    {replyResult && (
                        <div className="bg-muted rounded-lg p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                {replyResult.success ? (
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                ) : (
                                    <XCircle className="w-5 h-5 text-red-500" />
                                )}
                                <span className="font-medium">
                                    {replyResult.success ? 'Reply Sent Successfully' : 'Reply Failed'}
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Message:</span>
                                    <div className="mt-1 p-2 bg-background rounded border font-mono text-sm">
                                        {replyResult.message}
                                    </div>
                                </div>
                                
                                {replyResult.success && replyResult.tweetId && (
                                    <div>
                                        <span className="text-muted-foreground">Reply Tweet ID:</span>
                                        <span className="ml-2 font-mono">{replyResult.tweetId}</span>
                                    </div>
                                )}
                                
                                {replyResult.success && replyResult.replyUrl && (
                                    <div>
                                        <span className="text-muted-foreground">View Reply:</span>
                                        <a 
                                            href={replyResult.replyUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="ml-2 text-blue-500 hover:text-blue-600 inline-flex items-center gap-1"
                                        >
                                            Open on Twitter
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                )}
                                
                                {replyResult.debugInfo && (
                                    <div>
                                        <span className="text-muted-foreground">Debug Info:</span>
                                        <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                                Credentials Valid: {replyResult.debugInfo.credentialsValid ? '✅' : '❌'}
                                            </div>
                                            <div>
                                                Message Length: {replyResult.debugInfo.messageLength} chars
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {replyResult.error && (
                                <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950 p-2 rounded">
                                    Error: {replyResult.error}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
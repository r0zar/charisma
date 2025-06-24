'use client';

import React, { useState, useEffect } from 'react';
import { 
    RotateCcw, 
    Play, 
    Loader2, 
    CheckCircle, 
    XCircle, 
    ExternalLink,
    AlertTriangle,
    Eye,
    Users,
    MessageSquare,
    Clock,
    Settings
} from 'lucide-react';
import { toast } from 'sonner';

interface PreviewExecution {
    executionId: string;
    replierHandle: string;
    bnsName: string;
    txid: string;
    executedAt: string;
    currentReplyStatus: string;
    triggerId: string;
}

interface BackfillPreview {
    totalFound: number;
    eligible: number;
    preview: PreviewExecution[];
    filters: {
        limit: number;
        onlyRecentDays: number;
        skipExistingReplies: boolean;
    };
}

interface BackfillResult {
    executionId: string;
    replierHandle: string;
    bnsName: string;
    success: boolean;
    error?: string;
    tweetId?: string;
    skipped?: boolean;
    skipReason?: string;
    previewMessage?: string;
}

interface BackfillResponse {
    summary: {
        totalFound: number;
        eligible: number;
        sent: number;
        failed: number;
        skipped: number;
        results: BackfillResult[];
    };
    dryRun: boolean;
    message: string;
}

export default function BackfillManager() {
    const [preview, setPreview] = useState<BackfillPreview | null>(null);
    const [backfillResult, setBackfillResult] = useState<BackfillResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
    
    // Configuration
    const [limit, setLimit] = useState(25);
    const [onlyRecentDays, setOnlyRecentDays] = useState(7);
    const [skipExistingReplies, setSkipExistingReplies] = useState(true);
    const [includeBNSReminders, setIncludeBNSReminders] = useState(false);

    // Load preview on mount and when settings change
    useEffect(() => {
        loadPreview();
    }, [limit, onlyRecentDays, skipExistingReplies, includeBNSReminders]);

    const loadPreview = async () => {
        setPreviewLoading(true);
        try {
            const params = new URLSearchParams({
                limit: limit.toString(),
                onlyRecentDays: onlyRecentDays.toString(),
                skipExistingReplies: skipExistingReplies.toString(),
                includeBNSReminders: includeBNSReminders.toString()
            });

            const response = await fetch(`/api/admin/twitter-triggers/backfill-replies?${params}`);
            const data = await response.json();

            if (data.success) {
                setPreview(data.data);
            } else {
                toast.error(`Failed to load preview: ${data.error}`);
            }
        } catch (error) {
            console.error('Preview error:', error);
            toast.error('Failed to load backfill preview');
        } finally {
            setPreviewLoading(false);
        }
    };

    const runBackfill = async (dryRun: boolean = true) => {
        setLoading(true);
        setBackfillResult(null);

        try {
            const response = await fetch('/api/admin/twitter-triggers/backfill-replies', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    dryRun,
                    limit,
                    onlyRecentDays,
                    skipExistingReplies,
                    includeBNSReminders
                }),
            });

            const data = await response.json();

            if (data.success) {
                setBackfillResult(data.data);
                
                if (dryRun) {
                    toast.success(`Dry run completed: ${data.data.summary.eligible} executions would receive replies`);
                } else {
                    toast.success(`Backfill completed: ${data.data.summary.sent} replies sent, ${data.data.summary.failed} failed`);
                    // Refresh preview after real run
                    loadPreview();
                }
            } else {
                toast.error(`Backfill failed: ${data.error}`);
            }
        } catch (error) {
            console.error('Backfill error:', error);
            toast.error('Failed to run backfill');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    const formatRelativeTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };

    const toggleMessageExpansion = (executionId: string) => {
        setExpandedMessages(prev => {
            const newSet = new Set(prev);
            if (newSet.has(executionId)) {
                newSet.delete(executionId);
            } else {
                newSet.add(executionId);
            }
            return newSet;
        });
    };

    return (
        <div className="space-y-8">
            {/* Configuration */}
            <div className="bg-card rounded-lg border border-border p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                        <Settings className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Backfill Configuration</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            Limit
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="200"
                            value={limit}
                            onChange={(e) => setLimit(parseInt(e.target.value) || 25)}
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Max executions to process</p>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            Recent Days
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="30"
                            value={onlyRecentDays}
                            onChange={(e) => setOnlyRecentDays(parseInt(e.target.value) || 7)}
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Only executions from last N days (0 = all)</p>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            Skip Existing Replies
                        </label>
                        <div className="flex items-center h-[42px]">
                            <input
                                type="checkbox"
                                checked={skipExistingReplies}
                                onChange={(e) => setSkipExistingReplies(e.target.checked)}
                                className="w-4 h-4 text-primary bg-background border border-border rounded focus:ring-primary focus:ring-2"
                            />
                            <span className="ml-2 text-sm text-foreground">Skip if already replied</span>
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            Include BNS Reminders
                        </label>
                        <div className="flex items-center h-[42px]">
                            <input
                                type="checkbox"
                                checked={includeBNSReminders}
                                onChange={(e) => setIncludeBNSReminders(e.target.checked)}
                                className="w-4 h-4 text-primary bg-background border border-border rounded focus:ring-primary focus:ring-2"
                            />
                            <span className="ml-2 text-sm text-foreground">Send BNS setup reminders</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Include failed executions due to missing BNS</p>
                    </div>
                </div>
            </div>

            {/* Preview */}
            <div className="bg-card rounded-lg border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                            <Eye className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">Eligible Executions Preview</h3>
                    </div>
                    
                    <button
                        onClick={loadPreview}
                        disabled={previewLoading}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors disabled:opacity-50"
                    >
                        {previewLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <RotateCcw className="w-4 h-4" />
                        )}
                        Refresh
                    </button>
                </div>

                {preview && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div className="bg-muted rounded-lg p-3 text-center">
                                <div className="text-lg font-semibold text-foreground">{preview.totalFound}</div>
                                <div className="text-muted-foreground">Total Executions</div>
                            </div>
                            <div className="bg-muted rounded-lg p-3 text-center">
                                <div className="text-lg font-semibold text-green-600">{preview.eligible}</div>
                                <div className="text-muted-foreground">Eligible for Backfill</div>
                            </div>
                            <div className="bg-muted rounded-lg p-3 text-center">
                                <div className="text-lg font-semibold text-blue-600">{preview.filters.limit}</div>
                                <div className="text-muted-foreground">Batch Limit</div>
                            </div>
                            <div className="bg-muted rounded-lg p-3 text-center">
                                <div className="text-lg font-semibold text-purple-600">{preview.filters.onlyRecentDays}</div>
                                <div className="text-muted-foreground">Days Filter</div>
                            </div>
                        </div>

                        {preview.preview.length > 0 ? (
                            <div>
                                <h4 className="font-medium text-foreground mb-2">Sample Executions ({preview.preview.length} shown)</h4>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {preview.preview.map((execution) => (
                                        <div key={execution.executionId} className="flex items-center justify-between p-3 bg-muted rounded-lg text-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                <span className="font-mono">@{execution.replierHandle}</span>
                                                <span className="text-muted-foreground">→</span>
                                                <span className="font-mono">{execution.bnsName}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <span>{formatRelativeTime(execution.executedAt)}</span>
                                                <span className="text-xs bg-background px-2 py-1 rounded">
                                                    {execution.currentReplyStatus}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-muted-foreground py-8">
                                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p className="text-lg font-medium mb-2">No eligible executions found</p>
                                <p className="text-sm">Try adjusting the filters above</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="bg-card rounded-lg border border-border p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Run Backfill</h3>
                </div>

                <div className="warning-card mb-4">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                        <div className="text-sm">
                            <strong>Important:</strong> Backfill will queue real Twitter replies to users. 
                            Always run a dry run first to verify the selection. Check the Queue Management tab to monitor processing.
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => runBackfill(true)}
                        disabled={loading || !preview || preview.eligible === 0}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Eye className="w-4 h-4" />
                        )}
                        Dry Run (Preview Only)
                    </button>
                    
                    <button
                        onClick={() => runBackfill(false)}
                        disabled={loading || !preview || preview.eligible === 0}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Play className="w-4 h-4" />
                        )}
                        Send Real Replies
                    </button>
                </div>
            </div>

            {/* Results */}
            {backfillResult && (
                <div className="bg-card rounded-lg border border-border p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center">
                            <CheckCircle className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">
                            {backfillResult.dryRun ? 'Dry Run Results' : 'Backfill Results'}
                        </h3>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-muted rounded-lg p-3">
                            <p className="text-sm text-foreground">{backfillResult.message}</p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div className="text-center">
                                <div className="text-lg font-semibold text-blue-600">{backfillResult.summary.eligible}</div>
                                <div className="text-muted-foreground">Eligible</div>
                            </div>
                            <div className="text-center">
                                <div className="text-lg font-semibold text-green-600">{backfillResult.summary.sent}</div>
                                <div className="text-muted-foreground">{backfillResult.dryRun ? 'Would Send' : 'Queued'}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-lg font-semibold text-red-600">{backfillResult.summary.failed}</div>
                                <div className="text-muted-foreground">Failed</div>
                            </div>
                            <div className="text-center">
                                <div className="text-lg font-semibold text-yellow-600">{backfillResult.summary.skipped}</div>
                                <div className="text-muted-foreground">Skipped</div>
                            </div>
                        </div>

                        {backfillResult.summary.results.length > 0 && (
                            <div>
                                <h4 className="font-medium text-foreground mb-2">Detailed Results</h4>
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {backfillResult.summary.results.map((result, index) => (
                                        <div key={index} className="bg-muted rounded p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    {result.success ? (
                                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                                    ) : result.skipped ? (
                                                        <Clock className="w-4 h-4 text-yellow-500" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-red-500" />
                                                    )}
                                                    <span className="font-mono text-sm">@{result.replierHandle}</span>
                                                    <span className="text-muted-foreground">→</span>
                                                    <span className="font-mono text-sm">{result.bnsName}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {result.previewMessage && (
                                                        <button
                                                            onClick={() => toggleMessageExpansion(result.executionId)}
                                                            className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                                                        >
                                                            {expandedMessages.has(result.executionId) ? 'Hide Tweet' : 'Preview Tweet'}
                                                        </button>
                                                    )}
                                                    {result.success && result.tweetId && result.tweetId !== 'queued' ? (
                                                        <a
                                                            href={`https://twitter.com/twitter/status/${result.tweetId}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-500 hover:text-blue-600 inline-flex items-center gap-1 text-xs"
                                                        >
                                                            View Reply
                                                            <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    ) : result.success && result.tweetId === 'queued' ? (
                                                        <span className="text-blue-600 text-xs inline-flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            Queued for Processing
                                                        </span>
                                                    ) : result.error ? (
                                                        <span className="text-red-600 text-xs" title={result.error}>
                                                            {result.error.substring(0, 30)}...
                                                        </span>
                                                    ) : result.skipReason ? (
                                                        <span className="text-yellow-600 text-xs" title={result.skipReason}>
                                                            {result.skipReason}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">-</span>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Tweet Preview */}
                                            {result.previewMessage && expandedMessages.has(result.executionId) && (
                                                <div className="mt-3 p-3 bg-background rounded border border-border">
                                                    <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                                        <MessageSquare className="w-3 h-3" />
                                                        Tweet Preview:
                                                    </div>
                                                    <div className="text-sm whitespace-pre-wrap font-mono text-foreground">
                                                        {result.previewMessage}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-2">
                                                        Character count: {result.previewMessage.length}/280
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
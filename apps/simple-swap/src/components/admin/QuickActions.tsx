"use client";

import { useState } from 'react';
import { RefreshCw, Trash2, Bug } from 'lucide-react';
import { ADMIN_CONFIG } from '@/lib/admin-config';
import { Button } from '@/components/ui/button';
import { InfoTooltip } from '@/components/ui/tooltip';

export function QuickActions() {
    const [loading, setLoading] = useState<string | null>(null);
    const [results, setResults] = useState<Record<string, string>>({});

    const handleForcePriceUpdate = async () => {
        setLoading('price-update');
        setResults(prev => ({ ...prev, 'price-update': '' }));

        try {
            // Call the admin endpoint to trigger a price update
            const response = await fetch('/api/admin/force-price-update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const result = await response.json();
                setResults(prev => ({
                    ...prev,
                    'price-update': `✅ Updated ${result.count || 0} tokens`
                }));
            } else {
                const errorData = await response.json().catch(() => null);
                setResults(prev => ({
                    ...prev,
                    'price-update': `❌ Update failed: ${errorData?.error || 'Unknown error'}`
                }));
            }
        } catch (error) {
            setResults(prev => ({
                ...prev,
                'price-update': '❌ Network error'
            }));
        } finally {
            setLoading(null);
            setTimeout(() => {
                setResults(prev => ({ ...prev, 'price-update': '' }));
            }, ADMIN_CONFIG.RESULT_DISPLAY_DURATION);
        }
    };

    const handleClearOldData = async () => {
        setLoading('clear-data');
        setResults(prev => ({ ...prev, 'clear-data': '' }));

        try {
            const response = await fetch('/api/admin/clear-old-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const result = await response.json();
                setResults(prev => ({
                    ...prev,
                    'clear-data': `✅ Cleaned ${result.summary.dataPointsRemoved} old data points from ${result.summary.tokensProcessed} tokens`
                }));
            } else {
                const errorData = await response.json().catch(() => null);
                setResults(prev => ({
                    ...prev,
                    'clear-data': `❌ Cleanup failed: ${errorData?.error || 'Unknown error'}`
                }));
            }
        } catch (error) {
            setResults(prev => ({
                ...prev,
                'clear-data': '❌ Network error during cleanup'
            }));
        } finally {
            setLoading(null);
            setTimeout(() => {
                setResults(prev => ({ ...prev, 'clear-data': '' }));
            }, ADMIN_CONFIG.RESULT_DISPLAY_DURATION);
        }
    };

    const handleDebugToken = async () => {
        setLoading('debug-token');
        setResults(prev => ({ ...prev, 'debug-token': '' }));

        try {
            // Test with a known token to debug the system
            const response = await fetch('/api/admin/prices?limit=1');
            if (response.ok) {
                const data = await response.json();
                setResults(prev => ({
                    ...prev,
                    'debug-token': `🔍 Found ${data.tokens?.length || 0} tokens`
                }));
            } else {
                setResults(prev => ({
                    ...prev,
                    'debug-token': '❌ API test failed'
                }));
            }
        } catch (error) {
            setResults(prev => ({
                ...prev,
                'debug-token': '❌ Debug failed'
            }));
        } finally {
            setLoading(null);
            setTimeout(() => {
                setResults(prev => ({ ...prev, 'debug-token': '' }));
            }, ADMIN_CONFIG.RESULT_DISPLAY_DURATION);
        }
    };

    return (
        <div className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center gap-2 mb-4">
                <h3 className="text-lg font-semibold">Quick Actions</h3>
                <InfoTooltip content="Administrative controls for managing the price tracking system. These actions trigger immediate operations and may take a few moments to complete." />
            </div>
            <div className="space-y-3">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium">Force Price Update</span>
                        <InfoTooltip content="Manually triggers the price cron job to fetch and update all token prices immediately. Useful for testing or when automatic updates are delayed." />
                    </div>
                    <Button
                        onClick={handleForcePriceUpdate}
                        disabled={loading === 'price-update'}
                        variant="outline"
                        className="w-full"
                        size="sm"
                    >
                        {loading === 'price-update' ? (
                            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                            <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Force Price Update
                    </Button>
                    {results['price-update'] && (
                        <div className="mt-1 text-xs px-2 py-1 bg-muted rounded">
                            {results['price-update']}
                        </div>
                    )}
                </div>

                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium">Clear Old Data</span>
                        <InfoTooltip content="Removes price data older than the configured retention period (3 days). This operation scans all tokens and cleans up old data points to free up storage space and improve system performance." />
                    </div>
                    <Button
                        onClick={handleClearOldData}
                        disabled={loading === 'clear-data'}
                        variant="outline"
                        className="w-full"
                        size="sm"
                    >
                        {loading === 'clear-data' ? (
                            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                            <Trash2 className="w-4 h-4 mr-2" />
                        )}
                        Clear Old Data
                    </Button>
                    {results['clear-data'] && (
                        <div className="mt-1 text-xs px-2 py-1 bg-muted rounded">
                            {results['clear-data']}
                        </div>
                    )}
                </div>

                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium">Debug System</span>
                        <InfoTooltip content="Runs diagnostic checks on the price tracking system including API connectivity, token count verification, and data integrity tests. Useful for troubleshooting issues." />
                    </div>
                    <Button
                        onClick={handleDebugToken}
                        disabled={loading === 'debug-token'}
                        variant="outline"
                        className="w-full"
                        size="sm"
                    >
                        {loading === 'debug-token' ? (
                            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                            <Bug className="w-4 h-4 mr-2" />
                        )}
                        Debug System
                    </Button>
                    {results['debug-token'] && (
                        <div className="mt-1 text-xs px-2 py-1 bg-muted rounded">
                            {results['debug-token']}
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
                💡 Actions are logged and may take a few moments to complete
            </div>
        </div>
    );
} 
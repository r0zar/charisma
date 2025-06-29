"use client";

import { useState, useEffect, useRef } from 'react';
import { AlertCircle, Copy, ExternalLink } from 'lucide-react';
import type { PriceStats } from '@/lib/price/metrics';
import { InfoTooltip } from '@/components/ui/tooltip';
import { PriceMatrixDetailed } from './PriceMatrixDetailed';

interface TokenMetadata {
    contractId: string;
    name: string;
    symbol: string;
    image?: string | null;
    type?: string;
}

interface DataInsights {
    totalDataPoints: number;
    firstSeen: string | null;
    lastSeen: string | null;
    dataQuality: 'good' | 'stale' | 'sparse' | 'no-data' | 'error' | 'unknown';
}

interface EnrichedPriceStats extends PriceStats {
    metadata?: TokenMetadata;
    dataInsights?: DataInsights;
    marketcap?: number | null;
}

interface PriceMatrixData {
    tokens: EnrichedPriceStats[];
    loading: boolean;
    error: string | null;
    hasMore: boolean;
    nextCursor: string;
    total: number;
    totalRecords?: number;
}

// Helper component for token actions
export function TokenActions({ contractId }: { contractId: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(contractId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleExternalLink = () => {
        const url = `https://explorer.hiro.so/address/${contractId}?chain=mainnet`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="flex items-center gap-1">
            <InfoTooltip content={copied ? "Copied to clipboard!" : "Copy contract address to clipboard"} side="top">
                <button
                    onClick={handleCopy}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-muted/50"
                >
                    <Copy className={`w-3 h-3 ${copied ? 'text-green-500' : ''}`} />
                </button>
            </InfoTooltip>
            <InfoTooltip content="View contract on Hiro Explorer" side="top">
                <button
                    onClick={handleExternalLink}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-muted/50"
                >
                    <ExternalLink className="w-3 h-3" />
                </button>
            </InfoTooltip>
        </div>
    );
}

export function PriceMatrix() {
    const [data, setData] = useState<PriceMatrixData>({
        tokens: [],
        loading: true,
        error: null,
        hasMore: false,
        nextCursor: '0',
        total: 0
    });
    const [isManualRefreshing, setIsManualRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Track current loaded count for refresh
    const loadedCountRef = useRef(0);

    const fetchPriceData = async () => {
        try {
            setData(prev => ({ ...prev, loading: true }));
            const response = await fetch(`/api/admin/prices`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(
                    errorData?.details
                        ? `${errorData.error}: ${errorData.details}`
                        : `HTTP ${response.status}: ${response.statusText}`
                );
            }
            const result = await response.json();
            setData({
                tokens: result.tokens,
                loading: false,
                error: null,
                hasMore: result.hasMore,
                nextCursor: result.nextCursor,
                total: result.total,
                totalRecords: result.totalRecords
            });
        } catch (error) {
            console.error('Error fetching price data:', error);
            setData(prev => ({
                ...prev,
                loading: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            }));
        }
    };

    const refreshAllCurrentTokens = async (isManual = false) => {
        if (isManual) {
            setIsManualRefreshing(true);
        }

        try {
            // For refresh, maintain the exact number of tokens currently loaded
            const currentCount = loadedCountRef.current;
            await fetchPriceData();
        } finally {
            if (isManual) {
                setIsManualRefreshing(false);
            }
        }
    };

    const handleManualRefresh = () => {
        refreshAllCurrentTokens(true);
    };

    useEffect(() => {
        fetchPriceData();
    }, []); // Only run on mount

    const handleLoadMore = () => {
        if (data.hasMore && !data.loading && !isLoadingMore && !isManualRefreshing) {
            fetchPriceData();
        }
    };

    if (data.loading && data.tokens.length === 0) {
        return (
            <div className="space-y-3">
                {[...Array(15)].map((_, i) => (
                    <div key={i} className="h-16 bg-muted/20 rounded animate-pulse" />
                ))}
            </div>
        );
    }

    if (data.error) {
        return (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-2">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <h3 className="text-red-400 font-medium">Error Loading Price Data</h3>
                </div>
                <p className="text-red-300 text-sm mb-4">{data.error}</p>
                <div className="bg-red-900/30 rounded-lg p-4 text-xs text-red-300/80">
                    <p className="font-medium mb-2">🔧 Troubleshooting Guide:</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li><strong>No data collected:</strong> Run the price cron job at <code className="bg-red-900/50 px-1 rounded">/api/cron/price</code></li>
                        <li><strong>Vercel KV issues:</strong> Check your <code className="bg-red-900/50 px-1 rounded">KV_*</code> environment variables</li>
                        <li><strong>API errors:</strong> Check the server console for detailed logs</li>
                        <li><strong>Empty tokens list:</strong> Price tracking starts after the first cron run</li>
                    </ul>
                    <div className="mt-3 p-2 bg-red-900/40 rounded border border-red-600/30">
                        <p className="font-medium">🚀 Quick Start:</p>
                        <p>Make a GET request to <code className="bg-red-900/50 px-1 rounded">/api/cron/price</code> with your CRON_SECRET to populate initial data.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <PriceMatrixDetailed />
        </div>
    );
} 
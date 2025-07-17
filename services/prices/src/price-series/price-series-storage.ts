/**
 * Price Series Storage - Vercel Blob Integration
 * 
 * Handles storage and retrieval of price series data using Vercel Blob's
 * cost-effective storage with global CDN distribution.
 */

import { put, list, head } from '@vercel/blob';
import type { TokenPriceData, BulkPriceResult } from '../shared/types';

export interface PriceSnapshot {
    timestamp: number;
    prices: Map<string, TokenPriceData>;
    metadata: {
        engineStats?: {
            oracle: number;
            market: number;
            intrinsic: number;
            hybrid: number;
        };
        calculationTime?: number;
        arbitrageOpportunities?: number;
        totalTokens: number;
    };
}

export interface TimeSeriesEntry {
    timestamp: number;
    tokenId: string;
    usdPrice: number;
    sbtcRatio: number;
    source: string;
    reliability: number;
}

export interface ArbitrageOpportunity {
    tokenId: string;
    symbol: string;
    timestamp: number;
    marketPrice: number;
    intrinsicValue: number;
    deviation: number;
    profitable: boolean;
}

/**
 * Price Series Storage using Vercel Blob
 * 
 * Storage Structure:
 * /snapshots/YYYY/MM/DD/HH-MM.json - Full price snapshots every 5 minutes
 * /series/[tokenId]/YYYY-MM.json - Monthly aggregated time series per token
 * /arbitrage/YYYY/MM/DD.json - Daily arbitrage opportunities
 * /latest/current-prices.json - Latest snapshot for instant access
 */
export class PriceSeriesStorage {
    private readonly blobToken: string;

    constructor(blobToken?: string) {
        this.blobToken = blobToken || process.env.BLOB_READ_WRITE_TOKEN || '';
        if (!this.blobToken) {
            throw new Error('Blob token required for price series storage');
        }
    }

    /**
     * Store a new price snapshot
     */
    async storePriceSnapshot(snapshot: PriceSnapshot): Promise<string> {
        const date = new Date(snapshot.timestamp);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hour = String(date.getUTCHours()).padStart(2, '0');
        const minute = String(date.getUTCMinutes()).padStart(2, '0');

        // Convert Map to serializable format
        const serializableSnapshot = {
            timestamp: snapshot.timestamp,
            prices: Array.from(snapshot.prices.entries()).map(([tokenId, price]) => {
                // Avoid duplicate tokenId if price already has it
                const { tokenId: _omit, ...rest } = price;
                return { tokenId, ...rest };
            }),
            metadata: snapshot.metadata
        };

        const snapshotPath = `snapshots/${year}/${month}/${day}/${hour}-${minute}.json`;

        try {
            // Store full snapshot
            const result = await put(snapshotPath, JSON.stringify(serializableSnapshot), {
                access: 'public',
                token: this.blobToken,
                cacheControlMaxAge: 300 // 5 minutes cache
            });
            const snapshotUrl = result.url;

            // Update latest snapshot for instant access
            await put('latest/current-prices.json', JSON.stringify(serializableSnapshot), {
                access: 'public',
                token: this.blobToken,
                allowOverwrite: true,
                cacheControlMaxAge: 60 // 1 minute cache for latest
            });

            // Extract and store arbitrage opportunities
            await this.extractArbitrageOpportunities(snapshot);

            // Update monthly time series for each token (async, don't block)
            this.updateMonthlyTimeSeries(snapshot).catch(error => {
                console.error('[PriceSeriesStorage] Error updating time series:', error);
            });

            console.log(`[PriceSeriesStorage] Stored snapshot: ${snapshotPath} (${snapshot.metadata.totalTokens} tokens) at URL: ${snapshotUrl}`);
            return snapshotUrl;

        } catch (error) {
            console.error('[PriceSeriesStorage] Error storing snapshot:', error);
            throw error;
        }
    }

    /**
     * Get the latest price snapshot (cached response)
     */
    async getLatestSnapshot(): Promise<PriceSnapshot | null> {
        try {
            const BLOB_BASE_URL = process.env.BLOB_BASE_URL;
            if (!BLOB_BASE_URL) {
                throw new Error('BLOB_BASE_URL environment variable is required for PriceSeriesStorage');
            }
            const response = await fetch(`${BLOB_BASE_URL}latest/current-prices.json`);
            if (!response.ok) return null;

            const data = await response.json();

            // Convert back to Map format
            const prices = new Map<string, TokenPriceData>();
            data.prices.forEach((item: any) => {
                const { tokenId, ...priceData } = item;
                prices.set(tokenId, priceData);
            });

            return {
                timestamp: data.timestamp,
                prices,
                metadata: data.metadata
            };

        } catch (error) {
            console.error('[PriceSeriesStorage] Error fetching latest snapshot:', error);
            return null;
        }
    }

    /**
     * Get current price for a specific token
     */
    async getCurrentPrice(tokenId: string): Promise<TokenPriceData | null> {
        const latest = await this.getLatestSnapshot();
        return latest?.prices.get(tokenId) || null;
    }

    /**
     * Get current prices for multiple tokens
     */
    async getCurrentPrices(tokenIds: string[]): Promise<Map<string, TokenPriceData>> {
        const latest = await this.getLatestSnapshot();
        const result = new Map<string, TokenPriceData>();

        if (latest) {
            tokenIds.forEach(tokenId => {
                const price = latest.prices.get(tokenId);
                if (price) {
                    result.set(tokenId, price);
                }
            });
        }

        return result;
    }

    /**
     * Get price history for a token with different timeframes
     */
    async getPriceHistory(
        tokenId: string,
        timeframe: '1m' | '5m' | '1h' | '1d',
        limit: number = 100,
        endTime?: number
    ): Promise<TimeSeriesEntry[]> {
        const end = endTime || Date.now();
        const entries: TimeSeriesEntry[] = [];

        try {
            if (timeframe === '5m') {
                // For 5-minute data, read from snapshots directly
                entries.push(...await this.getSnapshotHistory(tokenId, limit, end));
            } else {
                // For other timeframes, read from aggregated monthly series
                entries.push(...await this.getAggregatedHistory(tokenId, timeframe, limit, end));
            }

            return entries.slice(0, limit);

        } catch (error) {
            console.error(`[PriceSeriesStorage] Error fetching price history for ${tokenId}:`, error);
            return [];
        }
    }

    /**
     * Get arbitrage opportunities for a specific day or recent period
     */
    async getArbitrageOpportunities(
        date?: Date,
        minDeviation: number = 5
    ): Promise<ArbitrageOpportunity[]> {
        const targetDate = date || new Date();
        const year = targetDate.getUTCFullYear();
        const month = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(targetDate.getUTCDate()).padStart(2, '0');

        const arbPath = `arbitrage/${year}/${month}/${day}.json`;

        try {
            const BLOB_BASE_URL = process.env.BLOB_BASE_URL;
            if (!BLOB_BASE_URL) {
                throw new Error('BLOB_BASE_URL environment variable is required for PriceSeriesStorage');
            }
            const response = await fetch(`${BLOB_BASE_URL}${arbPath}`);
            if (!response.ok) return [];

            const opportunities: ArbitrageOpportunity[] = await response.json();
            return opportunities.filter(opp => opp.deviation >= minDeviation);

        } catch (error) {
            console.error('[PriceSeriesStorage] Error fetching arbitrage opportunities:', error);
            return [];
        }
    }

    /**
     * Extract and store arbitrage opportunities from snapshot
     */
    private async extractArbitrageOpportunities(snapshot: PriceSnapshot): Promise<void> {
        const opportunities: ArbitrageOpportunity[] = [];
        const date = new Date(snapshot.timestamp);

        snapshot.prices.forEach((price, tokenId) => {
            if (price.arbitrageOpportunity && price.arbitrageOpportunity.profitable) {
                opportunities.push({
                    tokenId,
                    symbol: price.symbol,
                    timestamp: snapshot.timestamp,
                    marketPrice: price.arbitrageOpportunity.marketPrice || 0,
                    intrinsicValue: price.arbitrageOpportunity.intrinsicValue || 0,
                    deviation: price.arbitrageOpportunity.deviation,
                    profitable: price.arbitrageOpportunity.profitable
                });
            }
        });

        if (opportunities.length > 0) {
            const year = date.getUTCFullYear();
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const day = String(date.getUTCDate()).padStart(2, '0');
            const arbPath = `arbitrage/${year}/${month}/${day}.json`;

            try {
                // Try to read existing opportunities for the day
                let existingOpps: ArbitrageOpportunity[] = [];
                try {
                    const BLOB_BASE_URL = process.env.BLOB_BASE_URL;
                    if (!BLOB_BASE_URL) {
                        throw new Error('BLOB_BASE_URL environment variable is required for PriceSeriesStorage');
                    }
                    const response = await fetch(`${BLOB_BASE_URL}${arbPath}`);
                    if (response.ok) {
                        existingOpps = await response.json();
                    }
                } catch {
                    // File doesn't exist yet, that's fine
                }

                // Append new opportunities
                const allOpps = [...existingOpps, ...opportunities];

                await put(arbPath, JSON.stringify(allOpps), {
                    access: 'public',
                    token: this.blobToken,
                    allowOverwrite: true,
                    cacheControlMaxAge: 3600 // 1 hour cache
                });

                console.log(`[PriceSeriesStorage] Stored ${opportunities.length} arbitrage opportunities for ${year}-${month}-${day}`);

            } catch (error) {
                console.error('[PriceSeriesStorage] Error storing arbitrage opportunities:', error);
            }
        }
    }

    /**
     * Get snapshot-based history (5-minute intervals)
     */
    private async getSnapshotHistory(tokenId: string, limit: number, endTime: number): Promise<TimeSeriesEntry[]> {
        const entries: TimeSeriesEntry[] = [];
        const endDate = new Date(endTime);

        // Go back in time looking for snapshots
        for (let i = 0; i < limit && entries.length < limit; i++) {
            const checkTime = new Date(endTime - (i * 5 * 60 * 1000)); // Go back 5 minutes each iteration
            const year = checkTime.getUTCFullYear();
            const month = String(checkTime.getUTCMonth() + 1).padStart(2, '0');
            const day = String(checkTime.getUTCDate()).padStart(2, '0');
            const hour = String(checkTime.getUTCHours()).padStart(2, '0');
            const minute = String(Math.floor(checkTime.getUTCMinutes() / 5) * 5).padStart(2, '0');

            const snapshotPath = `snapshots/${year}/${month}/${day}/${hour}-${minute}.json`;

            try {
                const BLOB_BASE_URL = process.env.BLOB_BASE_URL;
                if (!BLOB_BASE_URL) {
                    throw new Error('BLOB_BASE_URL environment variable is required for PriceSeriesStorage');
                }
                const response = await fetch(`${BLOB_BASE_URL}${snapshotPath}`);
                if (response.ok) {
                    const snapshot = await response.json();
                    const tokenPrice = snapshot.prices.find((p: any) => p.tokenId === tokenId);

                    if (tokenPrice) {
                        entries.push({
                            timestamp: snapshot.timestamp,
                            tokenId,
                            usdPrice: tokenPrice.usdPrice,
                            sbtcRatio: tokenPrice.sbtcRatio,
                            source: tokenPrice.source,
                            reliability: tokenPrice.reliability
                        });
                    }
                }
            } catch (error) {
                // Snapshot doesn't exist, continue
                continue;
            }
        }

        return entries.reverse(); // Return chronological order
    }

    /**
     * Get aggregated history (1m, 1h, 1d intervals from monthly files)
     */
    private async getAggregatedHistory(
        tokenId: string,
        timeframe: '1m' | '1h' | '1d',
        limit: number,
        endTime: number
    ): Promise<TimeSeriesEntry[]> {
        // Implementation would read from monthly aggregated files
        // For now, return empty - this would be built as usage grows
        return [];
    }

    /**
     * Update monthly time series files (background operation)
     */
    private async updateMonthlyTimeSeries(snapshot: PriceSnapshot): Promise<void> {
        const date = new Date(snapshot.timestamp);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');

        // Update each token's monthly series
        for (const [tokenId, price] of snapshot.prices) {
            const seriesPath = `series/${tokenId}/${year}-${month}.json`;

            try {
                // This would append to monthly aggregated data
                // Implementation depends on how much aggregation we want
                console.log(`[PriceSeriesStorage] Would update monthly series: ${seriesPath}`);
            } catch (error) {
                console.error(`[PriceSeriesStorage] Error updating monthly series for ${tokenId}:`, error);
            }
        }
    }

    /**
     * Get storage statistics
     */
    async getStorageStats(): Promise<{
        totalSnapshots: number;
        oldestSnapshot: number | null;
        newestSnapshot: number | null;
        estimatedStorageGB: number;
    }> {
        try {
            // List all snapshot files to get statistics
            const snapshots = await list({
                prefix: 'snapshots/',
                token: this.blobToken,
                limit: 1000
            });

            const totalSnapshots = snapshots.blobs.length;
            const timestamps = snapshots.blobs
                .map(blob => {
                    // Extract timestamp from path: snapshots/YYYY/MM/DD/HH-MM.json
                    const pathParts = blob.pathname.split('/');
                    if (pathParts.length === 5) {
                        const [, year, month, day, timeFile] = pathParts;
                        const [hour, minute] = timeFile.replace('.json', '').split('-');
                        return new Date(
                            parseInt(year),
                            parseInt(month) - 1,
                            parseInt(day),
                            parseInt(hour),
                            parseInt(minute)
                        ).getTime();
                    }
                    return 0;
                })
                .filter(t => t > 0)
                .sort((a, b) => a - b);

            const totalSize = snapshots.blobs.reduce((sum, blob) => sum + blob.size, 0);
            const estimatedStorageGB = totalSize / (1024 * 1024 * 1024);

            return {
                totalSnapshots,
                oldestSnapshot: timestamps[0] || null,
                newestSnapshot: timestamps[timestamps.length - 1] || null,
                estimatedStorageGB
            };

        } catch (error) {
            console.error('[PriceSeriesStorage] Error getting storage stats:', error);
            return {
                totalSnapshots: 0,
                oldestSnapshot: null,
                newestSnapshot: null,
                estimatedStorageGB: 0
            };
        }
    }
}
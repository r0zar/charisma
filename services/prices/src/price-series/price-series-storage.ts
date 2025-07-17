/**
 * Price Series Storage - Vercel Blob Integration
 * 
 * Handles storage and retrieval of price series data using Vercel Blob's
 * cost-effective storage with global CDN distribution.
 */

import { put, list, head } from '@vercel/blob';
import { kv } from '@vercel/kv';
import type { TokenPriceData, BulkPriceResult, PriceSource } from '../shared/types';

export interface PriceSnapshot {
    timestamp: number;
    prices: Map<string, TokenPriceData>;
    metadata: {
        engineStats?: {
            oracle: number;
            market: number;
            virtual: number;
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
    virtualValue: number;
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
            // Check file size before upload (512MB limit for edge caching)
            const jsonString = JSON.stringify(serializableSnapshot);
            const fileSizeBytes = Buffer.byteLength(jsonString, 'utf8');
            const fileSizeMB = fileSizeBytes / (1024 * 1024);
            
            if (fileSizeMB > 500) {
                console.warn(`[PriceSeriesStorage] WARNING: File size ${fileSizeMB.toFixed(2)}MB approaching 512MB limit`);
            }
            if (fileSizeMB > 512) {
                console.error(`[PriceSeriesStorage] ERROR: File size ${fileSizeMB.toFixed(2)}MB exceeds 512MB limit - will not be edge cached`);
            }

            // Store full snapshot with 1-year cache (immutable historical data)
            const result = await put(snapshotPath, jsonString, {
                access: 'public',
                token: this.blobToken,
                cacheControlMaxAge: 31536000 // 1 year cache for immutable historical data
            });
            const snapshotUrl = result.url;

            // Store latest prices in KV for ultra-fast access
            await this.storeLatestPricesInKV(serializableSnapshot);

            // Keep blob fallback for backward compatibility
            await put('latest/current-prices.json', jsonString, {
                access: 'public',
                token: this.blobToken,
                allowOverwrite: true,
                cacheControlMaxAge: 60 // Short cache as KV is primary
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
     * Store latest prices in KV for ultra-fast access
     */
    private async storeLatestPricesInKV(snapshot: any): Promise<void> {
        try {
            // Store the complete snapshot in KV
            await kv.set('latest:snapshot', snapshot);
            
            // Store individual token prices for fast lookup
            const pipeline = kv.pipeline();
            snapshot.prices.forEach((price: any) => {
                pipeline.set(`latest:price:${price.tokenId}`, price);
            });
            await pipeline.exec();
            
            console.log(`[PriceSeriesStorage] Stored latest prices in KV (${snapshot.prices.length} tokens)`);
        } catch (error) {
            console.error('[PriceSeriesStorage] Error storing latest prices in KV:', error);
            // Don't throw - fallback to blob storage will still work
        }
    }

    /**
     * Helper to convert serialized snapshot back to PriceSnapshot format
     */
    private deserializeSnapshot(data: any): PriceSnapshot {
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
    }

    /**
     * Get the latest price snapshot (KV-first with blob fallback)
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
     * Update individual token price (for real-time updates)
     */
    async updateTokenPrice(tokenId: string, priceData: TokenPriceData): Promise<void> {
        try {
            // Determine TTL based on price source
            const ttl = this.getTTLForSource(priceData.source);
            
            // Store in KV for ultra-fast access
            await kv.set(`latest:price:${tokenId}`, priceData, { ex: ttl });
            
            console.log(`[PriceSeriesStorage] Updated ${tokenId} price: $${priceData.usdPrice} (${priceData.source}, TTL: ${ttl}s)`);
        } catch (error) {
            console.error(`[PriceSeriesStorage] Error updating token price for ${tokenId}:`, error);
            throw error;
        }
    }

    /**
     * Get TTL based on price source type
     */
    private getTTLForSource(source: PriceSource): number {
        switch (source) {
            case 'oracle': return 60;        // 1 minute (fast updates)
            case 'market': return 300;       // 5 minutes (medium updates)
            case 'virtual': return 604800; // 1 week (slow updates for virtual prices)
            case 'hybrid': return 300;       // 5 minutes (default)
            default: return 300;
        }
    }

    /**
     * Get current price for a specific token (KV-first with fallback)
     */
    async getCurrentPrice(tokenId: string): Promise<TokenPriceData | null> {
        try {
            // Try KV first for individual token lookup
            const kvPrice = await kv.get(`latest:price:${tokenId}`);
            if (kvPrice) {
                return kvPrice as TokenPriceData;
            }

            // Fallback to latest snapshot
            const latest = await this.getLatestSnapshot();
            return latest?.prices.get(tokenId) || null;
        } catch (error) {
            console.error(`[PriceSeriesStorage] Error getting current price for ${tokenId}:`, error);
            return null;
        }
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
     * Get all current prices (for virtual price calculations)
     */
    async getAllCurrentPrices(): Promise<Map<string, TokenPriceData>> {
        try {
            const result = new Map<string, TokenPriceData>();
            
            // Get all individual KV price keys
            const keys = await kv.keys('latest:price:*');
            if (keys.length > 0) {
                // Batch get all KV prices
                const kvPrices = await kv.mget(...keys);
                
                keys.forEach((key: string, index: number) => {
                    const tokenId = key.replace('latest:price:', '');
                    const price = kvPrices[index];
                    if (price) {
                        result.set(tokenId, price as TokenPriceData);
                    }
                });
            }
            
            // Fallback to snapshot for any missing tokens
            const snapshot = await this.getLatestSnapshot();
            if (snapshot) {
                snapshot.prices.forEach((price, tokenId) => {
                    if (!result.has(tokenId)) {
                        result.set(tokenId, price);
                    }
                });
            }
            
            return result;
        } catch (error) {
            console.error('[PriceSeriesStorage] Error getting all current prices:', error);
            return new Map();
        }
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
                    virtualValue: price.arbitrageOpportunity.virtualValue || 0,
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
                    cacheControlMaxAge: 31536000 // 1 year cache for historical arbitrage data
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
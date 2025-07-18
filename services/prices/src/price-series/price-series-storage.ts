/**
 * Optimized Price Series Storage - Vercel Blob Integration
 * 
 * Key optimizations:
 * 1. KV metadata indexing instead of expensive list() operations
 * 2. Pre-calculated percentage changes during storage
 * 3. Cache optimization for 512MB limit and better hit rates
 */

import { put, list } from '@vercel/blob';
import { kv } from '@vercel/kv';
import type { TokenPriceData, PriceSource } from '../shared/types';

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
    metadata?: {
        high: number;
        low: number;
        open: number;
        close: number;
        volume: number;
        sampleCount: number;
    };
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

// Configuration for optimization
const CONFIG = {
    MAX_FILE_SIZE_MB: 400, // Keep under 512MB for caching
    CACHE_DURATIONS: {
        IMMUTABLE_SNAPSHOTS: 31536000, // 1 year
        LATEST_PRICES: 300, // 5 minutes
        PERCENTAGE_CHANGES: 300, // 5 minutes
        MONTHLY_SERIES: 2592000 // 30 days
    },
    BATCH_SIZE: 10,
    MAX_CONCURRENT_FETCHES: 5
};

/**
 * Optimized Price Series Storage using Vercel Blob + KV indexing
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
     * OPTIMIZATION 1: Store snapshot with KV metadata indexing (eliminates expensive list operations)
     */
    async storePriceSnapshot(snapshot: PriceSnapshot): Promise<string> {
        const date = new Date(snapshot.timestamp);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hour = String(date.getUTCHours()).padStart(2, '0');
        const minute = String(date.getUTCMinutes()).padStart(2, '0');

        // Convert Map to serializable format with data validation
        const serializableSnapshot = {
            timestamp: snapshot.timestamp,
            prices: Array.from(snapshot.prices.entries()).map(([tokenId, price]) => {
                // Validate price object structure before destructuring
                if (!price || typeof price !== 'object') {
                    console.warn(`[PriceSeriesStorage] Invalid price object for ${tokenId}:`, price);
                    return { tokenId, usdPrice: 0, sbtcRatio: 0, source: 'unknown', reliability: 0 };
                }

                // Safe destructuring - remove tokenId if it exists, otherwise spread all properties
                const { tokenId: _omit, ...rest } = price;
                return { tokenId, ...rest };
            }),
            metadata: snapshot.metadata
        };

        const snapshotPath = `snapshots/${year}/${month}/${day}/${hour}-${minute}.json`;
        const jsonString = JSON.stringify(serializableSnapshot);
        const fileSizeBytes = Buffer.byteLength(jsonString, 'utf8');
        const fileSizeMB = fileSizeBytes / (1024 * 1024);

        // OPTIMIZATION 3: Check file size for cache efficiency
        if (fileSizeMB > CONFIG.MAX_FILE_SIZE_MB) {
            console.warn(`[PriceSeriesStorage] WARNING: File size ${fileSizeMB.toFixed(2)}MB approaching 512MB cache limit`);
            // Could implement file splitting here if needed
        }

        try {
            // Store snapshot with optimized cache headers
            const result = await put(snapshotPath, jsonString, {
                access: 'public',
                token: this.blobToken,
                cacheControlMaxAge: CONFIG.CACHE_DURATIONS.IMMUTABLE_SNAPSHOTS // 1 year for immutable data
            });

            // OPTIMIZATION 1: Store metadata in KV for fast lookups (replaces expensive list operations)
            const hourBucket = Math.floor(snapshot.timestamp / (60 * 60 * 1000)); // Hour-based buckets
            const minuteBucket = Math.floor(snapshot.timestamp / (5 * 60 * 1000)); // 5-minute buckets

            await Promise.all([
                // Store snapshot metadata
                kv.hset('snapshot:metadata', {
                    [snapshotPath]: {
                        timestamp: snapshot.timestamp,
                        url: result.url,
                        size: fileSizeBytes,
                        tokenCount: snapshot.metadata.totalTokens
                    }
                }),

                // Store time-based indexes for fast retrieval
                kv.zadd('snapshots:by-hour', { score: hourBucket, member: snapshotPath }),
                kv.zadd('snapshots:by-5min', { score: minuteBucket, member: snapshotPath }),

                // Store simplified price data for percentage calculations
                kv.set(`snapshot:prices:${minuteBucket}`,
                    Object.fromEntries(
                        Array.from(snapshot.prices.entries()).map(([tokenId, price]) => [
                            tokenId,
                            { usdPrice: price.usdPrice, timestamp: snapshot.timestamp }
                        ])
                    ),
                    { ex: 7 * 24 * 60 * 60 } // 7 days retention
                )
            ]);

            // Store latest prices in KV with optimized TTL
            await this.storeLatestPricesInKV(serializableSnapshot);

            // Store latest with shorter cache for frequently accessed data
            await put('latest/current-prices.json', jsonString, {
                access: 'public',
                token: this.blobToken,
                allowOverwrite: true,
                cacheControlMaxAge: CONFIG.CACHE_DURATIONS.LATEST_PRICES // 5 minutes
            });

            // OPTIMIZATION 2: Pre-calculate percentage changes during storage
            await this.preCalculatePercentageChanges(snapshot);

            // Extract and store arbitrage opportunities
            await this.extractArbitrageOpportunities(snapshot);

            // Update monthly time series (async, don't block)
            this.updateMonthlyTimeSeries(snapshot).catch(error => {
                console.error('[PriceSeriesStorage] Error updating time series:', error);
            });

            console.log(`[PriceSeriesStorage] Stored snapshot: ${snapshotPath} (${snapshot.metadata.totalTokens} tokens, ${fileSizeMB.toFixed(2)}MB)`);
            return result.url;

        } catch (error) {
            console.error('[PriceSeriesStorage] Error storing snapshot:', error);
            throw error;
        }
    }

    /**
     * OPTIMIZATION 2: Pre-calculate percentage changes during storage (massive speed improvement)
     */
    private async preCalculatePercentageChanges(snapshot: PriceSnapshot): Promise<void> {
        try {
            const now = snapshot.timestamp;
            const oneHourAgo = now - (60 * 60 * 1000);
            const oneDayAgo = now - (24 * 60 * 60 * 1000);

            // Get historical data from KV (cheap operations)
            const oneHourBucket = Math.floor(oneHourAgo / (5 * 60 * 1000));
            const oneDayBucket = Math.floor(oneDayAgo / (5 * 60 * 1000));

            const [hourAgoData, dayAgoData] = await Promise.all([
                kv.get(`snapshot:prices:${oneHourBucket}`),
                this.findClosestHistoricalPrices(oneDayAgo, 6) // Look back up to 6 hours for day-ago data
            ]);

            const changes: Record<string, { change1h: number | null; change24h: number | null }> = {};

            // Calculate changes for all tokens
            snapshot.prices.forEach((currentPrice, tokenId) => {
                const current = currentPrice.usdPrice;

                // 1-hour change
                const hourAgoPrice = (hourAgoData as Record<string, any>)?.[tokenId]?.usdPrice;
                const change1h = hourAgoPrice ? ((current - hourAgoPrice) / hourAgoPrice) * 100 : null;

                // 24-hour change
                const dayAgoPrice = (dayAgoData as Record<string, any>)?.[tokenId]?.usdPrice;
                const change24h = dayAgoPrice ? ((current - dayAgoPrice) / dayAgoPrice) * 100 : null;

                changes[tokenId] = { change1h, change24h };
            });

            // Store pre-calculated changes for instant retrieval
            await kv.set('percentage-changes:latest', changes, {
                ex: CONFIG.CACHE_DURATIONS.PERCENTAGE_CHANGES
            });

            console.log(`[PriceSeriesStorage] Pre-calculated percentage changes for ${Object.keys(changes).length} tokens`);

        } catch (error) {
            console.error('[PriceSeriesStorage] Error pre-calculating percentage changes:', error);
        }
    }

    /**
     * Helper: Find closest historical prices using KV index (no expensive list operations)
     */
    private async findClosestHistoricalPrices(targetTime: number, maxHoursBack: number = 6): Promise<any> {
        for (let hoursBack = 0; hoursBack <= maxHoursBack; hoursBack++) {
            const checkTime = targetTime - (hoursBack * 60 * 60 * 1000);
            const bucket = Math.floor(checkTime / (5 * 60 * 1000));

            const prices = await kv.get(`snapshot:prices:${bucket}`);
            if (prices && Object.keys(prices).length > 0) {
                return prices;
            }
        }
        return null;
    }

    /**
     * Store latest prices in KV with optimized batch operations
     */
    private async storeLatestPricesInKV(snapshot: any): Promise<void> {
        try {
            // Store the complete snapshot in KV
            await kv.set('latest:snapshot', snapshot, {
                ex: CONFIG.CACHE_DURATIONS.LATEST_PRICES
            });

            // Batch update individual token prices
            const priceUpdates: Record<string, any> = {};
            snapshot.prices.forEach((price: any) => {
                priceUpdates[`latest:price:${price.tokenId}`] = price;
            });

            // Single batch operation instead of pipeline
            await kv.mset(priceUpdates);

            console.log(`[PriceSeriesStorage] Stored latest prices in KV (${snapshot.prices.length} tokens)`);
        } catch (error) {
            console.error('[PriceSeriesStorage] Error storing latest prices in KV:', error);
        }
    }

    /**
     * OPTIMIZATION 2: Fast percentage changes retrieval with blob fallback
     */
    async getPercentageChanges(tokenIds: string[]): Promise<{
        [tokenId: string]: { change1h: number | null; change24h: number | null }
    }> {
        try {
            // Try KV first (fastest)
            const allChanges = await kv.get('percentage-changes:latest');

            if (allChanges) {
                // Filter for requested tokens
                const result: any = {};
                tokenIds.forEach(tokenId => {
                    result[tokenId] = (allChanges as Record<string, any>)[tokenId] || { change1h: null, change24h: null };
                });
                return result;
            }
        } catch (kvError) {
            console.log('[PriceSeriesStorage] KV unavailable for percentage changes, calculating from snapshots');
        }

        // Fallback: Calculate percentage changes from recent snapshots
        try {
            return await this.calculatePercentageChangesFromSnapshots(tokenIds);
        } catch (error) {
            console.error('[PriceSeriesStorage] Error calculating percentage changes:', error);
            const result: any = {};
            tokenIds.forEach(tokenId => {
                result[tokenId] = { change1h: null, change24h: null };
            });
            return result;
        }
    }

    /**
     * Fallback: Calculate percentage changes from recent snapshots
     */
    private async calculatePercentageChangesFromSnapshots(tokenIds: string[]): Promise<{
        [tokenId: string]: { change1h: number | null; change24h: number | null }
    }> {
        const result: any = {};
        
        // Initialize with null values
        tokenIds.forEach(tokenId => {
            result[tokenId] = { change1h: null, change24h: null };
        });

        try {
            // Get recent snapshots using blob list
            const snapshots = await list({
                prefix: 'snapshots/',
                token: this.blobToken,
                limit: 50 // Get enough snapshots to find 1hr and 24hr ago data
            });

            if (snapshots.blobs.length === 0) {
                return result;
            }

            // Sort by upload time (most recent first)
            const sortedBlobs = snapshots.blobs
                .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

            // Get current prices (from latest snapshot)
            const latestBlob = sortedBlobs[0];
            let currentPrices: Record<string, number> = {};
            
            try {
                const latestResponse = await fetch(latestBlob.url);
                if (latestResponse.ok) {
                    const latestSnapshot = await latestResponse.json();
                    if (latestSnapshot?.prices) {
                        latestSnapshot.prices.forEach((price: any) => {
                            if (tokenIds.includes(price.tokenId)) {
                                currentPrices[price.tokenId] = price.usdPrice;
                            }
                        });
                    }
                }
            } catch (error) {
                console.error('[PriceSeriesStorage] Error fetching latest snapshot for percentage changes:', error);
                return result;
            }

            // Find 1hr ago and 24hr ago data
            const now = Date.now();
            const oneHourAgo = now - (60 * 60 * 1000);
            const oneDayAgo = now - (24 * 60 * 60 * 1000);

            let oneHourPrices: Record<string, number> = {};
            let oneDayPrices: Record<string, number> = {};

            // Process snapshots to find historical prices
            for (const blob of sortedBlobs.slice(1)) { // Skip the latest one
                try {
                    const response = await fetch(blob.url);
                    if (!response.ok) continue;

                    const snapshot = await response.json();
                    if (!snapshot?.timestamp || !snapshot?.prices) continue;

                    const timeDiff1h = Math.abs(snapshot.timestamp - oneHourAgo);
                    const timeDiff24h = Math.abs(snapshot.timestamp - oneDayAgo);

                    // Look for 1hr ago data (within 2 hours tolerance)
                    if (timeDiff1h < 2 * 60 * 60 * 1000 && Object.keys(oneHourPrices).length === 0) {
                        snapshot.prices.forEach((price: any) => {
                            if (tokenIds.includes(price.tokenId)) {
                                oneHourPrices[price.tokenId] = price.usdPrice;
                            }
                        });
                    }

                    // Look for 24hr ago data (within 4 hours tolerance)
                    if (timeDiff24h < 4 * 60 * 60 * 1000 && Object.keys(oneDayPrices).length === 0) {
                        snapshot.prices.forEach((price: any) => {
                            if (tokenIds.includes(price.tokenId)) {
                                oneDayPrices[price.tokenId] = price.usdPrice;
                            }
                        });
                    }

                    // Break if we have both timeframes
                    if (Object.keys(oneHourPrices).length > 0 && Object.keys(oneDayPrices).length > 0) {
                        break;
                    }
                } catch (error) {
                    // Skip this snapshot
                    continue;
                }
            }

            // Calculate percentage changes
            tokenIds.forEach(tokenId => {
                const current = currentPrices[tokenId];
                const oneHourPrice = oneHourPrices[tokenId];
                const oneDayPrice = oneDayPrices[tokenId];

                let change1h = null;
                let change24h = null;

                if (current && oneHourPrice) {
                    change1h = ((current - oneHourPrice) / oneHourPrice) * 100;
                }

                if (current && oneDayPrice) {
                    change24h = ((current - oneDayPrice) / oneDayPrice) * 100;
                }

                result[tokenId] = { change1h, change24h };
            });

            console.log(`[PriceSeriesStorage] Calculated percentage changes for ${tokenIds.length} tokens from snapshots`);
            return result;

        } catch (error) {
            console.error('[PriceSeriesStorage] Error in percentage changes fallback:', error);
            return result;
        }
    }

    /**
     * OPTIMIZATION 1: Fast snapshot history using KV index with blob fallback
     */
    async getSnapshotHistory(tokenId: string, limit: number): Promise<TimeSeriesEntry[]> {
        const startTime = Date.now();
        try {
            // Try KV-optimized approach first
            const kvEntries = await this.getSnapshotHistoryFromKV(tokenId, limit);
            if (kvEntries.length > 0) {
                console.log(`[PriceSeriesStorage] getSnapshotHistory (KV): ${kvEntries.length} entries in ${Date.now() - startTime}ms`);
                return kvEntries;
            }
        } catch (kvError) {
            console.log(`[PriceSeriesStorage] KV unavailable for ${tokenId.substring(0, 15)}, falling back to blob list`);
        }

        // Fallback to blob list() for environments without KV
        try {
            const blobEntries = await this.getSnapshotHistoryFromBlob(tokenId, limit);
            console.log(`[PriceSeriesStorage] getSnapshotHistory (blob): ${blobEntries.length} entries in ${Date.now() - startTime}ms`);
            return blobEntries;
        } catch (blobError) {
            console.error(`[PriceSeriesStorage] Both KV and blob failed for ${tokenId}:`, blobError);
            return [];
        }
    }

    /**
     * KV-based snapshot history (fast when available)
     */
    private async getSnapshotHistoryFromKV(tokenId: string, limit: number): Promise<TimeSeriesEntry[]> {
        const entries: TimeSeriesEntry[] = [];

        // Get recent snapshot paths from KV index (fast)
        const currentBucket = Math.floor(Date.now() / (5 * 60 * 1000));
        const bucketsToCheck = Array.from({ length: limit * 2 }, (_, i) => currentBucket - i);

        // Get snapshot paths in batches
        const snapshotPaths: string[] = [];
        for (let i = 0; i < bucketsToCheck.length; i += 10) {
            const batch = bucketsToCheck.slice(i, i + 10);
            const batchPaths = await Promise.all(
                batch.map(bucket => kv.zrange('snapshots:by-5min', bucket, bucket))
            );
            snapshotPaths.push(...batchPaths.flat().filter((path): path is string => typeof path === 'string'));

            if (snapshotPaths.length >= limit * 3) break; // Get enough paths
        }

        // Get metadata for valid snapshots
        const validPaths = snapshotPaths.slice(0, Math.min(snapshotPaths.length, limit * 2));
        const metadataPromises = validPaths.map(path =>
            kv.hget('snapshot:metadata', path)
        );
        const metadata = await Promise.all(metadataPromises);

        // Fetch snapshots in parallel with concurrency control
        const validSnapshots = validPaths
            .map((path, i) => ({ path, meta: metadata[i] }))
            .filter(({ meta }) => meta && typeof meta === 'object' && 'url' in meta && meta.url)
            .slice(0, limit);

        for (let i = 0; i < validSnapshots.length; i += CONFIG.MAX_CONCURRENT_FETCHES) {
            const batch = validSnapshots.slice(i, i + CONFIG.MAX_CONCURRENT_FETCHES);
            const fetchPromises = batch.map(async ({ meta }) => {
                try {
                    const response = await fetch((meta as any).url);
                    return response.ok ? await response.json() : null;
                } catch {
                    return null;
                }
            });

            const snapshots = await Promise.all(fetchPromises);

            snapshots.forEach(snapshot => {
                if (snapshot?.prices) {
                    const tokenPrice = snapshot.prices.find((p: any) => p.tokenId === tokenId);
                    if (tokenPrice && entries.length < limit) {
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
            });

            if (entries.length >= limit) break;
        }

        return entries.reverse(); // Chronological order
    }

    /**
     * Blob fallback for snapshot history (works without KV)
     */
    private async getSnapshotHistoryFromBlob(tokenId: string, limit: number): Promise<TimeSeriesEntry[]> {
        const entries: TimeSeriesEntry[] = [];
        
        try {
            // Use blob list() to get recent snapshots
            const snapshots = await list({
                prefix: 'snapshots/',
                token: this.blobToken,
                limit: Math.min(limit * 3, 100) // Get more files to ensure we find token data
            });

            // Sort by uploaded time (most recent first)
            const sortedBlobs = snapshots.blobs
                .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
                .slice(0, limit * 2); // Take enough to find data

            // Fetch and process snapshots in parallel with concurrency control
            for (let i = 0; i < sortedBlobs.length; i += CONFIG.MAX_CONCURRENT_FETCHES) {
                const batch = sortedBlobs.slice(i, i + CONFIG.MAX_CONCURRENT_FETCHES);
                const fetchPromises = batch.map(async (blob) => {
                    try {
                        const response = await fetch(blob.url);
                        return response.ok ? await response.json() : null;
                    } catch {
                        return null;
                    }
                });

                const snapshotData = await Promise.all(fetchPromises);

                snapshotData.forEach(snapshot => {
                    if (snapshot?.prices) {
                        const tokenPrice = snapshot.prices.find((p: any) => p.tokenId === tokenId);
                        if (tokenPrice && entries.length < limit) {
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
                });

                if (entries.length >= limit) break;
            }

            return entries.reverse(); // Chronological order
        } catch (error) {
            console.error(`[PriceSeriesStorage] Error in blob fallback:`, error);
            return [];
        }
    }

    /**
     * Get latest snapshot with optimized caching
     */
    async getLatestSnapshot(): Promise<PriceSnapshot | null> {
        try {
            // Try KV first (fastest)
            const kvSnapshot = await kv.get('latest:snapshot');
            if (kvSnapshot && typeof kvSnapshot === 'object' && kvSnapshot !== null) {
                const snapshot = kvSnapshot as any;
                // Convert back to Map format
                const prices = new Map<string, TokenPriceData>();
                if (snapshot.prices && Array.isArray(snapshot.prices)) {
                    snapshot.prices.forEach((item: any) => {
                        const { tokenId, ...priceData } = item;
                        prices.set(tokenId, priceData);
                    });
                }

                return {
                    timestamp: snapshot.timestamp,
                    prices,
                    metadata: snapshot.metadata
                };
            }

            // Fallback to blob
            const BLOB_BASE_URL = process.env.BLOB_BASE_URL;
            if (!BLOB_BASE_URL) {
                throw new Error('BLOB_BASE_URL environment variable is required');
            }

            const response = await fetch(`${BLOB_BASE_URL}latest/current-prices.json`);
            if (!response.ok) return null;

            const data = await response.json();
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
     * Optimized current price retrieval
     */
    async getCurrentPrice(tokenId: string): Promise<TokenPriceData | null> {
        try {
            // Try individual KV lookup first (fastest)
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
     * Optimized bulk price retrieval
     */
    async getCurrentPrices(tokenIds: string[]): Promise<Map<string, TokenPriceData>> {
        try {
            const result = new Map<string, TokenPriceData>();

            // Try to get individual prices from KV first
            const kvKeys = tokenIds.map(id => `latest:price:${id}`);
            const kvPrices = await kv.mget(...kvKeys);

            // Map KV results
            tokenIds.forEach((tokenId, index) => {
                const price = kvPrices[index];
                if (price) {
                    result.set(tokenId, price as TokenPriceData);
                }
            });

            // Get missing prices from snapshot
            const missingTokens = tokenIds.filter(id => !result.has(id));
            if (missingTokens.length > 0) {
                const latest = await this.getLatestSnapshot();
                if (latest) {
                    missingTokens.forEach(tokenId => {
                        const price = latest.prices.get(tokenId);
                        if (price) {
                            result.set(tokenId, price);
                        }
                    });
                }
            }

            return result;
        } catch (error) {
            console.error('[PriceSeriesStorage] Error getting current prices:', error);
            return new Map();
        }
    }

    /**
     * Get all current prices (optimized)
     */
    async getAllCurrentPrices(): Promise<Map<string, TokenPriceData>> {
        try {
            // Get from latest snapshot (most complete)
            const latest = await this.getLatestSnapshot();
            return latest?.prices || new Map();
        } catch (error) {
            console.error('[PriceSeriesStorage] Error getting all current prices:', error);
            return new Map();
        }
    }

    /**
     * Get price history with aggregation fallback (required by API)
     */
    async getPriceHistory(
        tokenId: string,
        timeframe: '1m' | '5m' | '1h' | '1d',
        limit: number = 100,
        endTime?: number
    ): Promise<TimeSeriesEntry[]> {
        const startTime = Date.now();

        try {
            if (timeframe === '5m') {
                // For 5-minute data, use snapshot-based history
                return await this.getSnapshotHistory(tokenId, limit);
            } else {
                // For other timeframes, try aggregated data first, fallback to snapshots
                try {
                    return await this.getAggregatedHistory(tokenId, timeframe as '1h' | '1d', limit, endTime || Date.now());
                } catch (error) {
                    console.log(`[PriceSeriesStorage] Aggregated data unavailable for ${tokenId}, using snapshots`);
                    return await this.getSnapshotHistory(tokenId, limit);
                }
            }
        } catch (error) {
            console.error(`[PriceSeriesStorage] Error getting price history for ${tokenId}:`, error);
            return [];
        }
    }

    /**
     * Get aggregated historical data
     */
    private async getAggregatedHistory(
        tokenId: string,
        timeframe: '1h' | '1d',
        limit: number,
        endTime: number
    ): Promise<TimeSeriesEntry[]> {
        const date = new Date(endTime);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const monthKey = `${year}-${month}`;
        const seriesPath = `series/${tokenId}/${monthKey}.json`;

        try {
            const BLOB_BASE_URL = process.env.BLOB_BASE_URL;
            if (!BLOB_BASE_URL) {
                throw new Error('BLOB_BASE_URL required for aggregated data');
            }

            const response = await fetch(`${BLOB_BASE_URL}${seriesPath}`);
            if (!response.ok) {
                throw new Error(`Aggregated data not found: ${response.status}`);
            }

            const monthlyData: TimeSeriesEntry[] = await response.json();

            // Filter and limit data
            const filteredData = monthlyData
                .filter(entry => entry.timestamp <= endTime)
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, limit);

            return filteredData;
        } catch (error) {
            throw new Error(`Aggregated data unavailable: ${error}`);
        }
    }

    /**
     * Get arbitrage opportunities (required by API)
     */
    async getArbitrageOpportunities(date?: Date, minDeviation: number = 5): Promise<ArbitrageOpportunity[]> {
        try {
            const targetDate = date || new Date();
            const year = targetDate.getUTCFullYear();
            const month = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
            const day = String(targetDate.getUTCDate()).padStart(2, '0');
            const arbPath = `arbitrage/${year}/${month}/${day}.json`;

            const BLOB_BASE_URL = process.env.BLOB_BASE_URL;
            if (!BLOB_BASE_URL) {
                console.warn('[PriceSeriesStorage] BLOB_BASE_URL not configured for arbitrage data');
                return [];
            }

            const response = await fetch(`${BLOB_BASE_URL}${arbPath}`);
            if (!response.ok) {
                console.log(`[PriceSeriesStorage] No arbitrage data for ${arbPath}`);
                return [];
            }

            const opportunities: ArbitrageOpportunity[] = await response.json();

            // Filter by minimum deviation
            return opportunities.filter(opp =>
                Math.abs(opp.deviation) >= minDeviation && opp.profitable
            );

        } catch (error) {
            console.error('[PriceSeriesStorage] Error getting arbitrage opportunities:', error);
            return [];
        }
    }

    /**
     * Get interval in milliseconds for timeframe
     */
    private getIntervalMs(timeframe: string): number {
        switch (timeframe) {
            case '1m': return 60 * 1000;
            case '5m': return 5 * 60 * 1000;
            case '1h': return 60 * 60 * 1000;
            case '1d': return 24 * 60 * 60 * 1000;
            default: return 5 * 60 * 1000;
        }
    }

    /**
     * Update individual token price with optimized TTL
     */
    async updateTokenPrice(tokenId: string, priceData: TokenPriceData): Promise<void> {
        try {
            const ttl = this.getTTLForSource(priceData.source);
            await kv.set(`latest:price:${tokenId}`, priceData, { ex: ttl });
            console.log(`[PriceSeriesStorage] Updated ${tokenId} price: $${priceData.usdPrice}`);
        } catch (error) {
            console.error(`[PriceSeriesStorage] Error updating token price for ${tokenId}:`, error);
            throw error;
        }
    }

    private getTTLForSource(source: PriceSource): number {
        switch (source) {
            case 'oracle': return 60;
            case 'market': return 300;
            case 'virtual': return 604800;
            case 'hybrid': return 300;
            default: return 300;
        }
    }

    /**
     * Extract and store arbitrage opportunities
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
                await put(arbPath, JSON.stringify(opportunities), {
                    access: 'public',
                    token: this.blobToken,
                    allowOverwrite: true,
                    cacheControlMaxAge: CONFIG.CACHE_DURATIONS.IMMUTABLE_SNAPSHOTS
                });

                console.log(`[PriceSeriesStorage] Stored ${opportunities.length} arbitrage opportunities`);
            } catch (error) {
                console.error('[PriceSeriesStorage] Error storing arbitrage opportunities:', error);
            }
        }
    }

    /**
     * Update monthly time series with optimized batching
     */
    private async updateMonthlyTimeSeries(snapshot: PriceSnapshot): Promise<void> {
        // Process in smaller batches to avoid overwhelming the system
        const tokens = Array.from(snapshot.prices.entries());

        for (let i = 0; i < tokens.length; i += CONFIG.BATCH_SIZE) {
            const batch = tokens.slice(i, i + CONFIG.BATCH_SIZE);

            const promises = batch.map(async ([tokenId, price]) => {
                try {
                    const entry: TimeSeriesEntry = {
                        timestamp: snapshot.timestamp,
                        tokenId,
                        usdPrice: price.usdPrice,
                        sbtcRatio: price.sbtcRatio,
                        source: price.source,
                        reliability: price.reliability
                    };
                    await this.storeAggregatedDataPoint(tokenId, entry, snapshot.timestamp);
                } catch (error) {
                    console.error(`[PriceSeriesStorage] Error updating monthly series for ${tokenId}:`, error);
                }
            });

            await Promise.all(promises);

            // Small delay between batches
            if (i + CONFIG.BATCH_SIZE < tokens.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
    }

    /**
     * Store aggregated data point with optimized caching
     */
    private async storeAggregatedDataPoint(tokenId: string, entry: TimeSeriesEntry, timestamp: number): Promise<void> {
        const date = new Date(timestamp);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const monthKey = `${year}-${month}`;
        const seriesPath = `series/${tokenId}/${monthKey}.json`;

        try {
            // Read existing monthly data
            let existingEntries: TimeSeriesEntry[] = [];
            try {
                const BLOB_BASE_URL = process.env.BLOB_BASE_URL;
                if (BLOB_BASE_URL) {
                    const response = await fetch(`${BLOB_BASE_URL}${seriesPath}`);
                    if (response.ok) {
                        existingEntries = await response.json();
                    }
                }
            } catch {
                // File doesn't exist yet
            }

            // Add/update entry
            const existingIndex = existingEntries.findIndex(e =>
                Math.abs(e.timestamp - entry.timestamp) < 60000
            );

            if (existingIndex >= 0) {
                existingEntries[existingIndex] = entry;
            } else {
                existingEntries.push(entry);
            }

            // Sort and limit
            existingEntries.sort((a, b) => b.timestamp - a.timestamp);
            if (existingEntries.length > 10000) {
                existingEntries = existingEntries.slice(0, 10000);
            }

            // Store with optimized cache headers
            await put(seriesPath, JSON.stringify(existingEntries), {
                access: 'public',
                token: this.blobToken,
                allowOverwrite: true,
                cacheControlMaxAge: CONFIG.CACHE_DURATIONS.MONTHLY_SERIES
            });

        } catch (error) {
            console.error(`[PriceSeriesStorage] Error storing aggregated data point for ${tokenId}:`, error);
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
            // Use limited list operation for stats only
            const snapshots = await list({
                prefix: 'snapshots/',
                token: this.blobToken,
                limit: 100 // Reduced limit for cost optimization
            });

            const totalSnapshots = snapshots.blobs.length;
            const totalSize = snapshots.blobs.reduce((sum, blob) => sum + blob.size, 0);
            const estimatedStorageGB = totalSize / (1024 * 1024 * 1024);

            // Get timestamp range from KV instead of processing all blobs
            const [oldestBucket, newestBucket] = await Promise.all([
                kv.zrange('snapshots:by-hour', 0, 0),
                kv.zrange('snapshots:by-hour', -1, -1)
            ]);

            return {
                totalSnapshots,
                oldestSnapshot: oldestBucket[0] && typeof oldestBucket[0] === 'string' ? parseInt(oldestBucket[0]) * 60 * 60 * 1000 : null,
                newestSnapshot: newestBucket[0] && typeof newestBucket[0] === 'string' ? parseInt(newestBucket[0]) * 60 * 60 * 1000 : null,
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
/**
 * Ultra-Simple Blob Storage - Timestamped Price Snapshots
 * 
 * Stores all token prices in timestamped blobs. Each snapshot creates a new blob
 * with accumulated price data. Provides smart extrapolation for missing data.
 */

import { put, list, del } from '@vercel/blob';
import { appendPricesToBlob, serializeBlobData, deserializeBlobData } from './blob-builder';
import { OraclePriceResult } from '../engines/oracle-price-engine';

export interface TokenPriceEntry {
  tokenId: string;
  usdPrice: number;
  sbtcRatio: number;
  source: string;
  timestamp: number;
}

export interface PriceBlobData {
  [tokenId: string]: {
    [timestamp: string]: TokenPriceEntry;
  };
}

export interface TimeSeriesEntry {
  tokenId: string;
  timestamp: number;
  usdPrice: number;
  sbtcRatio: number;
  source: string;
}

export class SimpleBlobStorage {
  private readonly BLOB_PREFIX = 'prices-';
  private readonly BLOB_EXPIRY = 365 * 24 * 60 * 60; // 1 year in seconds

  /**
   * Save a complete price snapshot for all tokens
   */
  async saveSnapshot(prices: Map<string, OraclePriceResult>): Promise<void> {
    try {
      console.log(`[SimpleBlobStorage] Saving snapshot with ${prices.size} tokens`);

      const timestamp = Date.now().toString();
      const latestBlob = await this.getLatestBlob();

      // Add new timestamp data for all tokens
      const updatedBlob = appendPricesToBlob(latestBlob, prices, timestamp);

      // Always create a new blob with accumulated data
      await this.createNewBlob(updatedBlob, timestamp);

      console.log(`[SimpleBlobStorage] Snapshot saved successfully`);
    } catch (error) {
      console.error(`[SimpleBlobStorage] Error saving snapshot:`, error);
      throw error;
    }
  }

  /**
   * Get current price for a specific token
   */
  async getCurrentPrice(tokenId: string): Promise<TokenPriceEntry | null> {
    try {
      const blob = await this.getLatestBlob();
      const tokenData = blob[tokenId];

      if (!tokenData) return null;

      // Get the latest timestamp for this token
      const timestamps = Object.keys(tokenData).sort().reverse();
      return timestamps.length > 0 ? tokenData[timestamps[0]] : null;
    } catch (error) {
      console.error(`[SimpleBlobStorage] Error getting current price for ${tokenId}:`, error);
      return null;
    }
  }

  /**
   * Get current prices for multiple tokens
   */
  async getCurrentPrices(tokenIds: string[]): Promise<Map<string, TokenPriceEntry>> {
    try {
      const blob = await this.getLatestBlob();
      const results = new Map<string, TokenPriceEntry>();

      for (const tokenId of tokenIds) {
        const tokenData = blob[tokenId];
        if (tokenData) {
          const timestamps = Object.keys(tokenData).sort().reverse();
          if (timestamps.length > 0) {
            results.set(tokenId, tokenData[timestamps[0]]);
          }
        }
      }

      return results;
    } catch (error) {
      console.error(`[SimpleBlobStorage] Error getting current prices:`, error);
      return new Map();
    }
  }

  /**
   * Get time-series history for a token with smart extrapolation
   */
  async getTokenHistory(tokenId: string, limit: number = 100): Promise<TimeSeriesEntry[]> {
    try {
      const blob = await this.getLatestBlob();
      const tokenData = blob[tokenId];

      if (!tokenData) return [];

      // Get all timestamps from the blob (from all tokens)
      const allTimestamps = this.getAllTimestamps(blob);
      const tokenTimestamps = Object.keys(tokenData);

      // Create extrapolated time series
      const extrapolated = this.extrapolateTokenData(tokenData, allTimestamps);

      // Convert to TimeSeriesEntry format and limit results
      return extrapolated
        .slice(-limit)
        .map(({ timestamp, data }) => ({
          timestamp: parseInt(timestamp),
          usdPrice: data.usdPrice,
          sbtcRatio: data.sbtcRatio,
          source: data.source,
          quotes: data.quotes
        }));
    } catch (error) {
      console.error(`[SimpleBlobStorage] Error getting token history for ${tokenId}:`, error);
      return [];
    }
  }

  /**
   * Get all available token IDs
   */
  async getAllTokenIds(): Promise<string[]> {
    try {
      const blob = await this.getLatestBlob();
      return Object.keys(blob);
    } catch (error) {
      console.error(`[SimpleBlobStorage] Error getting token IDs:`, error);
      return [];
    }
  }

  private async getLatestBlob(): Promise<PriceBlobData> {
    try {
      // List all price blobs and get the latest one
      const blobs = await list({ prefix: this.BLOB_PREFIX });

      if (blobs.blobs.length === 0) {
        console.log(`[SimpleBlobStorage] No existing blobs found, returning empty data`);
        return {};
      }

      // Sort by timestamp (blob names are prices-{timestamp}.json)
      const sortedBlobs = blobs.blobs
        .filter(blob => blob.url.includes(this.BLOB_PREFIX))
        .sort((a, b) => {
          const timestampA = this.extractTimestampFromUrl(a.url);
          const timestampB = this.extractTimestampFromUrl(b.url);
          return timestampB - timestampA; // Descending order
        });

      if (sortedBlobs.length === 0) return {};

      const latestBlobUrl = sortedBlobs[0].url;
      console.log(`[SimpleBlobStorage] Loading latest blob: ${latestBlobUrl}`);

      const response = await fetch(latestBlobUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch blob: ${response.statusText}`);
      }

      const text = await response.text();
      return text ? deserializeBlobData(text) : {};
    } catch (error) {
      console.error(`[SimpleBlobStorage] Error loading latest blob:`, error);
      return {};
    }
  }


  private async createNewBlob(data: PriceBlobData, timestamp: string): Promise<void> {
    const blobName = `${this.BLOB_PREFIX}${timestamp}.json`;
    const jsonData = serializeBlobData(data);

    await put(blobName, jsonData, {
      access: 'public',
      addRandomSuffix: false,
      cacheControlMaxAge: this.BLOB_EXPIRY,
    });

    console.log(`[SimpleBlobStorage] Created new blob: ${blobName}`);
  }

  /**
   * Clear all existing price blobs - useful for data structure migrations
   */
  async clearAllBlobs(): Promise<void> {
    try {
      console.log('[SimpleBlobStorage] Clearing all existing blobs...');
      
      const blobs = await list({ prefix: this.BLOB_PREFIX });
      
      if (blobs.blobs.length === 0) {
        console.log('[SimpleBlobStorage] No blobs found to clear');
        return;
      }
      
      console.log(`[SimpleBlobStorage] Found ${blobs.blobs.length} blobs to delete`);
      
      // Delete all blobs with our prefix
      const deletePromises = blobs.blobs.map(blob => del(blob.url));
      await Promise.all(deletePromises);
      
      console.log(`[SimpleBlobStorage] Successfully cleared ${blobs.blobs.length} blobs`);
    } catch (error) {
      console.error('[SimpleBlobStorage] Error clearing blobs:', error);
      throw error;
    }
  }


  private getAllTimestamps(blob: PriceBlobData): string[] {
    const timestampSet = new Set<string>();

    Object.values(blob).forEach(tokenData => {
      Object.keys(tokenData).forEach(timestamp => {
        timestampSet.add(timestamp);
      });
    });

    return Array.from(timestampSet).sort();
  }

  private extrapolateTokenData(tokenData: Record<string, TokenPriceEntry>, allTimestamps: string[]): Array<{ timestamp: string; data: TokenPriceEntry }> {
    const result: Array<{ timestamp: string; data: TokenPriceEntry }> = [];
    let lastKnownData: TokenPriceEntry | null = null;

    for (const timestamp of allTimestamps) {
      if (tokenData[timestamp]) {
        // We have actual data for this timestamp
        lastKnownData = tokenData[timestamp];
        result.push({ timestamp, data: lastKnownData });
      } else if (lastKnownData) {
        // Use last known data for missing timestamps
        result.push({ timestamp, data: { ...lastKnownData } });
      }
      // If we don't have any previous data, skip this timestamp
    }

    return result;
  }

  private extractTimestampFromUrl(url: string): number {
    const match = url.match(/prices-(\d+)\.json/);
    return match ? parseInt(match[1]) : 0;
  }

}


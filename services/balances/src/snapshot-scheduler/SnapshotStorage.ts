/**
 * Snapshot Storage - Optimized blob storage for balance snapshots
 */

import { BlobMonitor } from '@modules/blob-monitor';
import { kv } from '@vercel/kv';
import { list } from '@vercel/blob';
import type {
  BalanceSnapshot,
  SnapshotStorageConfig,
  StorageStats,
  SnapshotIndex
} from '../types/snapshot-types';
import {
  SnapshotStorageError,
  SnapshotCompressionError,
  SNAPSHOT_CONSTANTS
} from '../types/snapshot-types';
import {
  generateSnapshotKey,
  compressSnapshot,
  decompressSnapshot,
  validateSnapshot,
  isValidSnapshotSize
} from '../utils/snapshot-utils';

export class SnapshotStorage {
  private blobMonitor: BlobMonitor;
  private config: SnapshotStorageConfig;
  private urlRegistry: Map<string, string> = new Map(); // timestamp -> URL mapping

  constructor(config?: Partial<SnapshotStorageConfig>) {
    this.config = {
      basePath: SNAPSHOT_CONSTANTS.BASE_PATH,
      compressionLevel: SNAPSHOT_CONSTANTS.DEFAULT_COMPRESSION_LEVEL,
      maxFileSize: SNAPSHOT_CONSTANTS.MAX_FILE_SIZE,
      enableMonitoring: true,
      ...config
    };

    this.blobMonitor = new BlobMonitor({
      serviceName: 'balance-snapshots',
      enforcementLevel: 'warn',
      enableCostTracking: true,
      enableCapacityTracking: true
    });
  }

  /**
   * Store a balance snapshot
   */
  async storeSnapshot(snapshot: BalanceSnapshot) {
    const startTime = Date.now();

    try {
      // Validate snapshot
      if (!validateSnapshot(snapshot)) {
        throw new SnapshotStorageError('Invalid snapshot structure');
      }

      // Compress snapshot
      const compressionResult = await compressSnapshot(snapshot, this.config.compressionLevel);

      // Check size limits
      if (!isValidSnapshotSize(compressionResult.compressedSize)) {
        throw new SnapshotCompressionError(
          `Compressed snapshot size ${compressionResult.compressedSize} exceeds limit ${this.config.maxFileSize}`
        );
      }

      // Generate storage key
      const key = generateSnapshotKey(snapshot.timestamp);

      // Store in blob storage
      const putResult = await this.blobMonitor.put(key, compressionResult.compressed, {
        access: 'public',
        contentType: 'application/gzip',
        cacheControlMaxAge: 3600 // 1 hour cache
      });

      console.log(`Stored snapshot ${key} (${compressionResult.compressedSize} bytes, ${(compressionResult.ratio * 100).toFixed(1)}% compression)`);

      // Register the URL for future retrieval
      this.urlRegistry.set(snapshot.timestamp.toString(), putResult.url);

      // Update snapshot index automatically
      await this.updateSnapshotIndex(snapshot.timestamp);

      return {
        key,
        url: putResult.url,
        compressionResult,
        success: true
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`Failed to store snapshot after ${processingTime}ms:`, error);
      throw error;
    }
  }

  /**
   * Update the snapshot index with a new timestamp
   */
  private async updateSnapshotIndex(timestamp: number): Promise<void> {
    try {
      const indexKey = 'snapshot-index';

      // Get existing index
      const existingIndex = await kv.get<SnapshotIndex>(indexKey);

      if (existingIndex) {
        // Update existing index
        const updatedIndex: SnapshotIndex = {
          timestamps: [...existingIndex.timestamps, timestamp].sort((a, b) => a - b),
          count: existingIndex.count + 1,
          oldest: Math.min(existingIndex.oldest, timestamp),
          newest: Math.max(existingIndex.newest, timestamp),
          lastUpdated: Date.now()
        };

        await kv.set(indexKey, updatedIndex);
        console.log(`Updated snapshot index: ${updatedIndex.count} snapshots`);
      } else {
        // Create new index
        const newIndex: SnapshotIndex = {
          timestamps: [timestamp],
          count: 1,
          oldest: timestamp,
          newest: timestamp,
          lastUpdated: Date.now()
        };

        await kv.set(indexKey, newIndex);
        console.log(`Created snapshot index: first snapshot at ${new Date(timestamp).toISOString()}`);
      }
    } catch (error) {
      console.error('Failed to update snapshot index:', error);
      // Don't throw - index update failure shouldn't prevent snapshot storage
    }
  }

  /**
   * Retrieve a balance snapshot
   */
  async getSnapshot(timestamp: number): Promise<BalanceSnapshot | null> {
    try {
      // First check if we have the URL in our registry
      const registeredUrl = this.urlRegistry.get(timestamp.toString());

      if (registeredUrl) {
        // Use the registered URL for direct fetch
        const response = await this.blobMonitor.fetch(registeredUrl);

        if (!response.ok) {
          if (response.status === 404) {
            return null;
          }
          throw new SnapshotStorageError(`Failed to fetch snapshot: ${response.status}`);
        }

        const compressedData = Buffer.from(await response.arrayBuffer());
        const snapshot = await decompressSnapshot(compressedData);

        // Validate decompressed data
        if (!validateSnapshot(snapshot)) {
          throw new SnapshotStorageError('Invalid snapshot data retrieved from storage');
        }

        return snapshot;
      }

      // Fallback: find the blob URL using the list API
      const key = generateSnapshotKey(timestamp);
      const prefix = key.replace('.json.gz', ''); // Remove extension to match prefix
      
      try {
        const blobs = await list({ prefix });
        const matchingBlob = blobs.blobs.find(blob => 
          blob.pathname.includes(`${timestamp}.json`) && blob.pathname.includes('.gz')
        );
        
        if (!matchingBlob) {
          console.log(`No blob found for snapshot ${timestamp} with prefix ${prefix}`);
          return null;
        }
        
        console.log(`Found blob for snapshot ${timestamp}: ${matchingBlob.url}`);
        
        // Cache the URL for future requests
        this.urlRegistry.set(timestamp.toString(), matchingBlob.url);
        
        const response = await this.blobMonitor.fetch(matchingBlob.url);
        
        if (!response.ok) {
          if (response.status === 404) {
            return null;
          }
          throw new SnapshotStorageError(`Failed to fetch snapshot: ${response.status}`);
        }
        
        const compressedData = Buffer.from(await response.arrayBuffer());
        const snapshot = await decompressSnapshot(compressedData);
        
        // Validate decompressed data
        if (!validateSnapshot(snapshot)) {
          throw new SnapshotStorageError('Invalid snapshot data retrieved from storage');
        }
        
        return snapshot;
      } catch (listError) {
        console.error(`Failed to list blobs for snapshot ${timestamp}:`, listError);
        return null;
      }
    } catch (error) {
      console.error(`Failed to get snapshot ${timestamp}:`, error);
      if (error instanceof Error && error.name === 'BlobNotFoundError') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Check if snapshot exists
   */
  async snapshotExists(timestamp: number): Promise<boolean> {
    try {
      // Check if we have the URL in our registry (recent snapshots)
      const registeredUrl = this.urlRegistry.get(timestamp.toString());
      if (registeredUrl) {
        return true; // If it's in our registry, it exists
      }

      // Check the snapshot index (no blob requests needed)
      const index = await kv.get<any>('snapshot-index');
      if (index && index.timestamps) {
        return index.timestamps.includes(timestamp);
      }

      return false; // No registry entry and no index = doesn't exist
    } catch (error) {
      console.error(`Failed to check snapshot existence ${timestamp}:`, error);
      return false;
    }
  }

  /**
   * Delete a snapshot
   */
  async deleteSnapshot(timestamp: number): Promise<boolean> {
    try {
      const key = generateSnapshotKey(timestamp);
      await this.blobMonitor.delete(key);

      // Clean up the URL registry
      this.urlRegistry.delete(timestamp.toString());

      console.log(`Deleted snapshot ${key}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete snapshot ${timestamp}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple snapshots
   */
  async deleteSnapshots(timestamps: number[]): Promise<{
    deleted: number;
    failed: number;
    errors: string[];
  }> {
    const results = {
      deleted: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Process deletions in parallel with limited concurrency
    const deletePromises = timestamps.map(async (timestamp) => {
      try {
        const success = await this.deleteSnapshot(timestamp);
        if (success) {
          results.deleted++;
        } else {
          results.failed++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Failed to delete ${timestamp}: ${error}`);
      }
    });

    await Promise.allSettled(deletePromises);

    console.log(`Deleted ${results.deleted} snapshots, failed ${results.failed}`);
    return results;
  }

  /**
   * Get snapshot metadata without downloading full content
   */
  async getSnapshotMetadata(timestamp: number): Promise<{
    timestamp: number;
    size: number;
    lastModified: string;
    exists: boolean;
  } | null> {
    try {
      // Only get metadata for snapshots in our registry (recent snapshots)
      const registeredUrl = this.urlRegistry.get(timestamp.toString());

      if (registeredUrl) {
        // Use HEAD request on the registered URL
        const response = await fetch(registeredUrl, { method: 'HEAD' });

        if (!response.ok) {
          if (response.status === 404) {
            return null;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return {
          timestamp,
          size: parseInt(response.headers.get('content-length') || '0', 10),
          lastModified: response.headers.get('last-modified') || '',
          exists: true
        };
      }

      // For older snapshots, we don't have URLs so we can't get metadata
      return null;
    } catch (error) {
      console.error(`Failed to get snapshot metadata ${timestamp}:`, error);
      return null;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    try {
      const stats = this.blobMonitor.getStats();

      // Get snapshot index for accurate statistics
      const index = await kv.get<any>('snapshot-index');

      if (index && index.timestamps) {
        // Calculate total and average sizes from recent operations
        let totalSize = 0;
        const totalCompression = 0;
        const compressionCount = 0;

        const recentOps = this.blobMonitor.getRecentOperations(100);
        const putOps = recentOps.filter(op => op.type === 'put');

        for (const op of putOps) {
          if (op.size) {
            totalSize += op.size;
          }
          // Note: compression ratio would need to be tracked separately
        }

        const avgSize = index.timestamps.length > 0 ? totalSize / index.timestamps.length : 0;

        return {
          totalSnapshots: index.timestamps.length,
          totalSize,
          averageSize: Math.round(avgSize),
          compressionRatio: compressionCount > 0 ? totalCompression / compressionCount : 0,
          oldestSnapshot: index.oldest || 0,
          newestSnapshot: index.newest || 0
        };
      }

      return {
        totalSnapshots: 0,
        totalSize: 0,
        averageSize: 0,
        compressionRatio: 0,
        oldestSnapshot: 0,
        newestSnapshot: 0
      };
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return {
        totalSnapshots: 0,
        totalSize: 0,
        averageSize: 0,
        compressionRatio: 0,
        oldestSnapshot: 0,
        newestSnapshot: 0
      };
    }
  }

  /**
   * Get blob monitoring statistics
   */
  getBlobMonitorStats() {
    return this.blobMonitor.getStats();
  }

  /**
   * Get recent blob operations
   */
  getRecentBlobOperations(limit: number = 10) {
    return this.blobMonitor.getRecentOperations(limit);
  }

  /**
   * Get active blob alerts
   */
  getBlobAlerts() {
    return this.blobMonitor.getAlerts();
  }

  /**
   * Clear resolved alerts
   */
  clearResolvedAlerts() {
    return this.blobMonitor.clearResolvedAlerts();
  }

  /**
   * Reset monitoring statistics
   */
  resetStats() {
    return this.blobMonitor.resetStats();
  }

  /**
   * Test storage connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      const testKey = `${this.config.basePath}/test-${Date.now()}.json`;
      const testData = JSON.stringify({ test: true, timestamp: Date.now() });

      // Test write
      const putResult = await this.blobMonitor.put(testKey, testData, {
        access: 'public',
        contentType: 'application/json'
      });

      // Test read using the actual URL returned by put
      const response = await this.blobMonitor.fetch(putResult.url);
      const success = response.ok;

      // Cleanup
      await this.blobMonitor.delete(testKey);

      return success;
    } catch (error) {
      console.error('Storage connection test failed:', error);
      return false;
    }
  }
}
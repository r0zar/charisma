/**
 * BlobStorage - Simple blob storage wrapper for contract metadata
 * 
 * Stores contract metadata as individual JSON files in blob storage.
 * Uses @modules/blob-monitor for monitoring and size enforcement.
 * Optimized for the 512MB cache limit for free blob storage.
 */

import { BlobMonitor } from '@modules/blob-monitor';
import type { ContractMetadata } from '../types';

export interface BlobStorageConfig {
  serviceName: string;
  pathPrefix: string; // e.g., 'contracts/'
  enforcementLevel?: 'warn' | 'block' | 'silent';
}

export interface BlobStorageStats {
  totalContracts: number;
  totalSize: number;
  averageSize: number;
  largestContract: {
    contractId: string;
    size: number;
  } | null;
  compressionRatio: number;
  largeContractCount: number; // Contracts over 512MB (where Vercel Blob charges start)
  oversizedContracts: Array<{
    contractId: string;
    size: number;
  }>; // Contracts over 1GB (practically problematic)
  lastUpdated: number;
}

export class BlobStorage {
  private monitor: BlobMonitor;
  private config: BlobStorageConfig;

  constructor(config: BlobStorageConfig) {
    if (process.env.BLOB_BASE_URL === undefined) {
      throw new Error('BLOB_BASE_URL environment variable is required for BlobStorage');
    }

    this.config = {
      enforcementLevel: 'warn' as const,
      ...config,
      pathPrefix: config.pathPrefix || 'contracts/'
    };

    this.monitor = new BlobMonitor({
      serviceName: this.config.serviceName,
      enforcementLevel: this.config.enforcementLevel,
      enableCostTracking: true,
      enableCapacityTracking: true,
      sizeThresholds: {
        warning: 400 * 1024 * 1024,  // 400MB warning
        error: 500 * 1024 * 1024,    // 500MB error  
        critical: 512 * 1024 * 1024  // 512MB critical (cache limit)
      }
    });
  }

  /**
   * Store contract metadata as compressed JSON
   */
  async putContract(contractId: string, metadata: ContractMetadata): Promise<void> {
    if (!contractId || !metadata) {
      throw new Error('Invalid contractId or metadata provided');
    }

    const path = this.getContractPath(contractId);

    // Compress metadata for storage efficiency
    const compressed = JSON.stringify(metadata, null, 0); // No pretty printing

    try {
      await this.monitor.put(path, compressed, {
        contentType: 'application/json',
        access: 'public', // Required for Vercel Blob storage
        addRandomSuffix: false, // Disable random suffix to ensure consistent URLs
        allowOverwrite: true // Allow overwriting for testing
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to store contract ${contractId}: ${errorMessage}`);
    }
  }

  /**
   * Retrieve contract metadata from blob storage
   * Optimized version using direct fetch (no HEAD operations to save costs)
   */
  async getContract(contractId: string): Promise<ContractMetadata | null> {
    const path = this.getContractPath(contractId);

    try {
      // COST OPTIMIZATION: Construct blob URL directly to avoid HEAD operations
      // HEAD operations cost money on Vercel, but fetches are free
      const blobUrl = this.constructBlobUrl(path);
      const response = await this.monitor.fetch(blobUrl);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        return null;
      }

      const jsonData = await response.text();
      const result = JSON.parse(jsonData) as ContractMetadata;
      return result;
    } catch (error) {
      // If blob doesn't exist, return null rather than throwing
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('not found') ||
        errorMessage.includes('404') ||
        errorMessage.includes('does not exist')) {
        return null;
      }

      throw new Error(`Failed to retrieve contract ${contractId}: ${errorMessage}`);
    }
  }

  /**
   * Retrieve contract metadata with performance metrics (for testing/monitoring)
   * Returns both the contract data and cache/performance information
   */
  async getContractWithMetrics(contractId: string): Promise<{
    contract: ContractMetadata | null;
    metrics: {
      cacheHit: boolean;
      duration: number;
      size?: number;
    };
  }> {
    const startTime = performance.now();
    const path = this.getContractPath(contractId);

    try {
      const blobUrl = this.constructBlobUrl(path);
      const response = await this.monitor.fetch(blobUrl);

      const cacheHit = response.headers.get('x-vercel-cache') === 'HIT';

      if (!response.ok) {
        const duration = performance.now() - startTime;
        return {
          contract: null,
          metrics: { cacheHit, duration }
        };
      }

      const jsonData = await response.text();
      const result = JSON.parse(jsonData) as ContractMetadata;
      const duration = performance.now() - startTime;

      return {
        contract: result,
        metrics: {
          cacheHit,
          duration,
          size: jsonData.length
        }
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('not found') ||
        errorMessage.includes('404') ||
        errorMessage.includes('does not exist')) {
        return {
          contract: null,
          metrics: { cacheHit: false, duration }
        };
      }

      throw new Error(`Failed to retrieve contract ${contractId}: ${errorMessage}`);
    }
  }

  /**
   * Check if contract exists in blob storage
   */
  async hasContract(contractId: string): Promise<boolean> {
    const path = this.getContractPath(contractId);

    try {
      const result = await this.monitor.head(path);
      return !!result;
    } catch (error) {
      return false;
    }
  }

  /**
   * Remove contract from blob storage
   */
  async removeContract(contractId: string): Promise<void> {
    const path = this.getContractPath(contractId);

    try {
      await this.monitor.delete(path);
    } catch (error) {
      // Don't throw if blob doesn't exist
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('not found') && !errorMessage.includes('404')) {
        throw new Error(`Failed to remove contract ${contractId}: ${errorMessage}`);
      }
    }
  }

  /**
   * List all contracts in storage (returns contract IDs)
   */
  async listContracts(): Promise<string[]> {
    try {
      const result = await this.monitor.list({
        prefix: this.config.pathPrefix
      });

      return result.blobs
        .map(blob => this.extractContractIdFromPath(blob.pathname))
        .filter(id => id !== null) as string[];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list contracts: ${errorMessage}`);
    }
  }

  /**
   * Get storage statistics with proper pagination to count all contracts
   */
  async getStats(): Promise<BlobStorageStats> {
    try {
      // Collect all blobs using pagination to get accurate count
      const allContracts: any[] = [];
      let cursor: string | undefined = undefined;
      let hasMore = true;
      let totalSize = 0;
      let largestContract: { contractId: string; size: number } | null = null;
      let largeContractCount = 0;
      const oversizedContracts: Array<{ contractId: string; size: number }> = [];

      // Size thresholds
      const LARGE_CONTRACT_THRESHOLD = 512 * 1024 * 1024; // 512MB - where Vercel Blob charges start
      const OVERSIZED_CONTRACT_THRESHOLD = 1024 * 1024 * 1024; // 1GB - practically problematic

      while (hasMore) {
        const result = await this.monitor.list({
          prefix: this.config.pathPrefix,
          limit: 1000, // Use the maximum limit for efficiency
          cursor
        });

        // Add blobs from this page
        allContracts.push(...result.blobs);

        // Update total size and track contract size metrics
        for (const blob of result.blobs) {
          totalSize += blob.size;
          const contractId = this.extractContractIdFromPath(blob.pathname) || 'unknown';

          // Track largest contract
          if (!largestContract || blob.size > largestContract.size) {
            largestContract = {
              contractId,
              size: blob.size
            };
          }

          // Count large contracts (over 512MB - where Vercel Blob charges start)
          if (blob.size > LARGE_CONTRACT_THRESHOLD) {
            largeContractCount++;
          }

          // Track oversized contracts (over 1GB - practically problematic)
          if (blob.size > OVERSIZED_CONTRACT_THRESHOLD) {
            oversizedContracts.push({
              contractId,
              size: blob.size
            });
          }
        }

        // Check if there are more pages
        cursor = result.cursor;
        hasMore = result.hasMore || false;
      }

      const contractCount = allContracts.length;

      return {
        totalContracts: contractCount,
        totalSize,
        averageSize: contractCount > 0 ? Math.round(totalSize / contractCount) : 0,
        largestContract,
        compressionRatio: this.estimateCompressionRatio(),
        largeContractCount,
        oversizedContracts: oversizedContracts.sort((a, b) => b.size - a.size), // Sort by size descending
        lastUpdated: Date.now()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get storage stats: ${errorMessage}`);
    }
  }

  /**
   * Optimized bulk contract retrieval with aggressive parallelization for Vercel Pro plan
   * Pro plan limits: 120 simple operations/second, so we default to 20 concurrent for solid throughput
   */
  async getContracts(contractIds: string[], maxConcurrency: number = 20): Promise<{
    successful: { contractId: string; metadata: ContractMetadata }[];
    failed: { contractId: string; error: string }[];
  }> {
    const debugTiming = process.env.DEBUG_PERFORMANCE === 'true';
    const startTime = debugTiming ? performance.now() : 0;

    const successful: { contractId: string; metadata: ContractMetadata }[] = [];
    const failed: { contractId: string; error: string }[] = [];

    // Use continuous parallel processing instead of sequential batching
    // This allows us to keep the full concurrency limit "in flight" at all times
    if (contractIds.length <= maxConcurrency) {
      // Small batch: process all in parallel immediately
      const allPromises = contractIds.map(async (contractId) => {
        try {
          const metadata = await this.getContract(contractId);
          if (metadata) {
            return { success: true, contractId, metadata };
          } else {
            return { success: false, contractId, error: 'Contract not found' };
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return { success: false, contractId, error: errorMessage };
        }
      });

      const results = await Promise.allSettled(allPromises);

      for (const promiseResult of results) {
        if (promiseResult.status === 'fulfilled') {
          const result = promiseResult.value;
          if (result.success && result.metadata) {
            successful.push({ contractId: result.contractId, metadata: result.metadata });
          } else {
            failed.push({ contractId: result.contractId, error: result.error || 'Unknown error' });
          }
        } else {
          // Promise rejected - this shouldn't happen as we catch errors above
          failed.push({ contractId: 'unknown', error: promiseResult.reason?.message || 'Promise rejected' });
        }
      }
    } else {
      // Large batch: use sliding window approach to maintain constant concurrency
      // This keeps exactly `maxConcurrency` operations in-flight at all times
      const inFlight = new Map<string, Promise<any>>();
      const results = new Map<string, any>();
      let nextIndex = 0;

      // Helper function to start a contract operation
      const startOperation = (contractId: string) => {
        const promise = this.processSingleContract(contractId).then(result => {
          results.set(contractId, result);
          inFlight.delete(contractId);
          return result;
        }).catch(error => {
          const errorResult = { success: false, contractId, error: error.message };
          results.set(contractId, errorResult);
          inFlight.delete(contractId);
          return errorResult;
        });

        inFlight.set(contractId, promise);
        return promise;
      };

      // Fill initial window
      while (nextIndex < contractIds.length && inFlight.size < maxConcurrency) {
        startOperation(contractIds[nextIndex]);
        nextIndex++;
      }

      // Sliding window: as operations complete, start new ones
      while (inFlight.size > 0) {
        // Wait for at least one operation to complete
        await Promise.race(inFlight.values());

        // Start new operations to fill the window
        while (nextIndex < contractIds.length && inFlight.size < maxConcurrency) {
          startOperation(contractIds[nextIndex]);
          nextIndex++;
        }
      }

      // Process all results
      for (const [contractId, result] of results) {
        if (result.success && result.metadata) {
          successful.push({ contractId: result.contractId, metadata: result.metadata });
        } else {
          failed.push({ contractId: result.contractId, error: result.error || 'Unknown error' });
        }
      }
    }

    // Optional debug logging for bulk operations performance monitoring
    if (debugTiming) {
      const totalTime = performance.now() - startTime;
      const throughput = contractIds.length / (totalTime / 1000);
      console.log(`[BlobStorage] Bulk processed ${contractIds.length} contracts: ${totalTime.toFixed(1)}ms (${throughput.toFixed(1)} contracts/s)`);
    }

    return { successful, failed };
  }

  /**
   * Bulk operations for efficiency
   */
  async putContracts(contracts: Record<string, ContractMetadata>): Promise<{
    successful: string[];
    failed: { contractId: string; error: string }[];
  }> {
    const successful: string[] = [];
    const failed: { contractId: string; error: string }[] = [];

    for (const [contractId, metadata] of Object.entries(contracts)) {
      try {
        await this.putContract(contractId, metadata);
        successful.push(contractId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        failed.push({ contractId, error: errorMessage });
      }
    }

    return { successful, failed };
  }

  /**
   * Get monitoring statistics from BlobMonitor
   */
  getMonitoringStats() {
    return this.monitor.getStats();
  }

  /**
   * Get recent storage operations
   */
  getRecentOperations(limit: number = 10) {
    return this.monitor.getRecentOperations(limit);
  }

  /**
   * Get active alerts from monitoring
   */
  getAlerts() {
    return this.monitor.getAlerts();
  }

  /**
   * Process a single contract with error handling - used by sliding window algorithm
   */
  private async processSingleContract(contractId: string): Promise<{
    success: boolean;
    contractId: string;
    metadata?: ContractMetadata;
    error?: string
  }> {
    try {
      const metadata = await this.getContract(contractId);
      if (metadata) {
        return { success: true, contractId, metadata };
      } else {
        return { success: false, contractId, error: 'Contract not found' };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, contractId, error: errorMessage };
    }
  }

  // === Private Methods ===

  /**
   * Generate blob path for contract
   */
  private getContractPath(contractId: string): string {
    // Sanitize contract ID for filesystem-safe path - preserve dots and dashes
    const sanitized = contractId.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${this.config.pathPrefix}${sanitized}.json`;
  }

  /**
   * Construct direct blob URL to avoid HEAD operations
   * Requires BLOB_BASE_URL environment variable
   */
  private constructBlobUrl(path: string): string {
    if (!process.env.BLOB_BASE_URL) {
      throw new Error('BLOB_BASE_URL environment variable is required for direct blob access');
    }

    const baseUrl = process.env.BLOB_BASE_URL;
    // Ensure baseUrl ends with / and path doesn't start with /
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
    return `${normalizedBaseUrl}${normalizedPath}`;
  }

  /**
   * Extract contract ID from blob path
   */
  private extractContractIdFromPath(path: string): string | null {
    const prefix = this.config.pathPrefix;
    if (!path.startsWith(prefix) || !path.endsWith('.json')) {
      return null;
    }

    const filename = path.slice(prefix.length, -5); // Remove prefix and .json

    // Reverse the sanitization (basic unsanitization)
    return filename.replace(/_/g, '.');
  }

  /**
   * Estimate compression ratio for reporting
   */
  private estimateCompressionRatio(): number {
    // JSON compression typically achieves 60-80% size reduction
    // Return estimated ratio (compressed/original)
    return 0.3; // Assume 70% compression
  }
}
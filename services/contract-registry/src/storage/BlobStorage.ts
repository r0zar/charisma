/**
 * BlobStorage - Simple blob storage wrapper for contract metadata
 * 
 * Stores contract metadata as individual JSON files in blob storage.
 * Uses @modules/blob-monitor for monitoring and size enforcement.
 * Optimized for the 512MB cache limit for free blob storage.
 */

import { BlobMonitor } from '@modules/blob-monitor';
import type { ContractMetadata, ConsolidatedRegistry } from '../types';

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
  async getContract(
    contractId: string,
    autoDiscoveryCallback?: (contractId: string) => Promise<ContractMetadata | null>
  ): Promise<ContractMetadata | null> {
    const path = this.getContractPath(contractId);

    try {
      // COST OPTIMIZATION: Construct blob URL directly to avoid HEAD operations
      // HEAD operations cost money on Vercel, but fetches are free
      const blobUrl = this.constructBlobUrl(path);
      const response = await this.monitor.fetch(blobUrl);

      if (!response.ok) {
        if (response.status === 404) {
          // Try auto-discovery if callback is provided
          if (autoDiscoveryCallback) {
            return await autoDiscoveryCallback(contractId);
          }
          return null;
        }
        return null;
      }

      const jsonData = await response.text();
      const result = JSON.parse(jsonData) as ContractMetadata;
      return result;
    } catch (error) {
      // If blob doesn't exist, try auto-discovery, then return null rather than throwing
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('not found') ||
        errorMessage.includes('404') ||
        errorMessage.includes('does not exist')) {
        if (autoDiscoveryCallback) {
          return await autoDiscoveryCallback(contractId);
        }
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
  async getContracts(
    contractIds: string[], 
    maxConcurrency: number = 20,
    autoDiscoveryCallback?: (contractId: string) => Promise<ContractMetadata | null>
  ): Promise<{
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
          let metadata = await this.getContract(contractId);
          if (metadata) {
            return { success: true, contractId, metadata };
          } else if (autoDiscoveryCallback) {
            // Try auto-discovery
            metadata = await autoDiscoveryCallback(contractId);
            if (metadata) {
              return { success: true, contractId, metadata };
            }
          }
          return { success: false, contractId, error: 'Contract not found' };
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
        const promise = this.processSingleContractWithAutoDiscovery(contractId, autoDiscoveryCallback).then(result => {
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

  private async processSingleContractWithAutoDiscovery(
    contractId: string, 
    autoDiscoveryCallback?: (contractId: string) => Promise<ContractMetadata | null>
  ): Promise<{
    success: boolean;
    contractId: string;
    metadata?: ContractMetadata;
    error?: string
  }> {
    try {
      let metadata = await this.getContract(contractId);
      if (metadata) {
        return { success: true, contractId, metadata };
      } else if (autoDiscoveryCallback) {
        // Try auto-discovery
        metadata = await autoDiscoveryCallback(contractId);
        if (metadata) {
          return { success: true, contractId, metadata };
        }
      }
      return { success: false, contractId, error: 'Contract not found' };
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

  /**
   * Get all contracts (used by consolidated blob manager)
   */
  async getAllContracts(): Promise<string[]> {
    return await this.listContracts();
  }

  /**
   * Get the consolidated blob manager for bulk operations
   */
  getConsolidatedBlobManager(indexManager?: any): ConsolidatedBlobManager {
    return new ConsolidatedBlobManager(this, indexManager);
  }
}

/**
 * ConsolidatedBlobManager - Manages a single consolidated blob containing all contract metadata
 * This reduces individual blob API calls and provides efficient bulk operations
 */
export class ConsolidatedBlobManager {
  private static readonly CONSOLIDATED_PATH = 'consolidated-registry.json';
  private static readonly VERSION = '1.0.0';
  private blobStorage: BlobStorage;
  private indexManager?: any;

  constructor(blobStorage: BlobStorage, indexManager?: any) {
    this.blobStorage = blobStorage;
    this.indexManager = indexManager;
  }

  /**
   * Generate a new consolidated blob from all individual contracts
   * Uses batched processing to avoid rate limits
   */
  async generateConsolidatedBlob(): Promise<ConsolidatedRegistry> {
    const startTime = Date.now();
    console.log('[ConsolidatedBlobManager] Starting consolidated blob generation...');

    try {
      // Get all contract IDs
      const contractIds = await this.blobStorage.getAllContracts();
      console.log(`[ConsolidatedBlobManager] Found ${contractIds.length} contracts to consolidate`);

      // Process contracts in small batches to avoid rate limits
      const contracts: Record<string, ContractMetadata> = {};
      let totalProcessed = 0;
      let totalFailed = 0;
      let totalSize = 0;
      const batchSize = 50; // Small batch size
      const maxConcurrency = 2; // Very conservative concurrency

      console.log(`[ConsolidatedBlobManager] Processing ${contractIds.length} contracts in batches of ${batchSize}...`);

      for (let i = 0; i < contractIds.length; i += batchSize) {
        const batch = contractIds.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(contractIds.length / batchSize);
        
        console.log(`[ConsolidatedBlobManager] Processing batch ${batchNum}/${totalBatches} (${batch.length} contracts)...`);
        
        try {
          // Add delay between batches to respect rate limits
          if (i > 0) {
            console.log('[ConsolidatedBlobManager] Waiting 2s between batches...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

          const result = await this.blobStorage.getContracts(batch, maxConcurrency);
          
          // Add successful contracts to our registry
          result.successful.forEach(({ contractId, metadata }) => {
            contracts[contractId] = metadata;
            totalSize += JSON.stringify(metadata).length;
          });

          totalProcessed += result.successful.length;
          totalFailed += result.failed.length;

          if (result.failed.length > 0) {
            console.warn(`[ConsolidatedBlobManager] Batch ${batchNum}: ${result.failed.length} failures:`, 
              result.failed.slice(0, 3).map(f => f.contractId));
          }

          console.log(`[ConsolidatedBlobManager] Batch ${batchNum} completed: ${result.successful.length} success, ${result.failed.length} failed`);

        } catch (error) {
          console.error(`[ConsolidatedBlobManager] Batch ${batchNum} failed:`, error);
          totalFailed += batch.length;
          
          // Don't fail entire operation for one batch - continue with other batches
          continue;
        }
      }

      const generationTimeMs = Date.now() - startTime;
      const consolidatedRegistry: ConsolidatedRegistry = {
        version: ConsolidatedBlobManager.VERSION,
        generatedAt: Date.now(),
        contractCount: totalProcessed,
        contracts,
        metadata: {
          totalSize,
          compressionRatio: this.blobStorage['estimateCompressionRatio'](),
          lastFullRebuild: Date.now(),
          generationTimeMs
        }
      };

      console.log(`[ConsolidatedBlobManager] Generated consolidated blob in ${generationTimeMs}ms:`);
      console.log(`[ConsolidatedBlobManager]   - Processed: ${totalProcessed} contracts`);
      console.log(`[ConsolidatedBlobManager]   - Failed: ${totalFailed} contracts`);
      console.log(`[ConsolidatedBlobManager]   - Success rate: ${(totalProcessed / (totalProcessed + totalFailed) * 100).toFixed(1)}%`);

      return consolidatedRegistry;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[ConsolidatedBlobManager] Failed to generate consolidated blob:', errorMessage);
      throw new Error(`Failed to generate consolidated blob: ${errorMessage}`);
    }
  }

  /**
   * Load the consolidated blob from storage
   */
  async loadConsolidatedBlob(): Promise<ConsolidatedRegistry | null> {
    try {
      console.log('[ConsolidatedBlobManager] Loading consolidated blob...');
      
      // First try to get the stored URL from the last save operation
      const storedUrl = await this.getStoredConsolidatedBlobUrl();
      
      let blobUrl: string;
      if (storedUrl) {
        console.log(`[ConsolidatedBlobManager] Using stored URL: ${storedUrl}`);
        blobUrl = storedUrl;
      } else {
        // Fallback to constructing URL (may not work due to Vercel's unique suffixes)
        const filePath = this.blobStorage['config'].pathPrefix + ConsolidatedBlobManager.CONSOLIDATED_PATH;
        blobUrl = this.blobStorage['constructBlobUrl'](filePath);
        console.log(`[ConsolidatedBlobManager] No stored URL found, trying constructed URL: ${blobUrl}`);
      }
      
      const response = await this.blobStorage['monitor'].fetch(blobUrl);

      if (!response.ok) {
        if (response.status === 404) {
          console.log('[ConsolidatedBlobManager] No consolidated blob found (404)');
          return null;
        }
        console.error(`[ConsolidatedBlobManager] Failed to fetch consolidated blob: ${response.status} ${response.statusText}`);
        throw new Error(`Failed to fetch consolidated blob: ${response.status} ${response.statusText}`);
      }

      const data = await response.text();
      console.log(`[ConsolidatedBlobManager] Loaded ${data.length} bytes of data`);

      // Parse the JSON data
      const consolidatedRegistry: ConsolidatedRegistry = JSON.parse(data);
      
      // Validate the structure
      if (!consolidatedRegistry.contracts || typeof consolidatedRegistry.contracts !== 'object') {
        throw new Error('Invalid consolidated blob format: missing contracts object');
      }

      console.log(`[ConsolidatedBlobManager] Loaded consolidated blob with ${consolidatedRegistry.contractCount} contracts (v${consolidatedRegistry.version})`);
      return consolidatedRegistry;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[ConsolidatedBlobManager] Failed to load consolidated blob:', errorMessage);
      return null;
    }
  }

  /**
   * Save the consolidated blob to storage
   */
  async saveConsolidatedBlob(registry: ConsolidatedRegistry): Promise<void> {
    try {
      console.log(`[ConsolidatedBlobManager] Saving consolidated blob with ${registry.contractCount} contracts...`);
      
      const jsonData = JSON.stringify(registry, null, 0); // No pretty printing for size
      const filePath = this.blobStorage['config'].pathPrefix + ConsolidatedBlobManager.CONSOLIDATED_PATH;
      
      console.log(`[ConsolidatedBlobManager] Saving to path: ${filePath}`);
      console.log(`[ConsolidatedBlobManager] Data size: ${Math.round(jsonData.length / 1024)}KB`);
      
      const result = await this.blobStorage['monitor'].put(filePath, jsonData, {
        contentType: 'application/json',
        access: 'public',
        allowOverwrite: true
      });
      
      console.log(`[ConsolidatedBlobManager] Save result URL: ${result.url}`);
      console.log(`[ConsolidatedBlobManager] Successfully saved consolidated blob (${Math.round(jsonData.length / 1024)}KB)`);

      // Store the actual URL for future access
      // We'll use KV storage to store the mapping from logical path to actual URL
      await this.storeConsolidatedBlobUrl(result.url);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[ConsolidatedBlobManager] Failed to save consolidated blob:', errorMessage);
      throw new Error(`Failed to save consolidated blob: ${errorMessage}`);
    }
  }

  /**
   * Store the consolidated blob URL in KV for future retrieval
   */
  private async storeConsolidatedBlobUrl(url: string): Promise<void> {
    if (!this.indexManager) {
      console.warn('[ConsolidatedBlobManager] No IndexManager available, cannot store URL mapping');
      return;
    }
    
    try {
      // Use the IndexManager to store the URL mapping
      const key = `${this.blobStorage['config'].serviceName}:consolidated-blob-url`;
      await this.indexManager.kv.set(key, url);
      console.log(`[ConsolidatedBlobManager] Stored blob URL mapping: ${key} -> ${url}`);
    } catch (error) {
      console.warn('[ConsolidatedBlobManager] Failed to store blob URL mapping:', error);
      // Don't fail the whole operation for this
    }
  }

  /**
   * Retrieve the stored consolidated blob URL
   */
  private async getStoredConsolidatedBlobUrl(): Promise<string | null> {
    if (!this.indexManager) {
      console.warn('[ConsolidatedBlobManager] No IndexManager available, cannot retrieve stored URL');
      return null;
    }
    
    try {
      const key = `${this.blobStorage['config'].serviceName}:consolidated-blob-url`;
      const url = await this.indexManager.kv.get(key);
      return url || null;
    } catch (error) {
      console.warn('[ConsolidatedBlobManager] Failed to retrieve stored blob URL:', error);
      return null;
    }
  }

  /**
   * Check if consolidation is needed based on time elapsed or changes
   */
  async isConsolidationNeeded(): Promise<boolean> {
    try {
      const existing = await this.loadConsolidatedBlob();
      
      if (!existing) {
        console.log('[ConsolidatedBlobManager] Consolidation needed: no existing blob');
        return true;
      }

      // Check if it's been more than 24 hours
      const hoursSinceLastBuild = (Date.now() - existing.metadata.lastFullRebuild) / (1000 * 60 * 60);
      if (hoursSinceLastBuild >= 24) {
        console.log(`[ConsolidatedBlobManager] Consolidation needed: ${Math.round(hoursSinceLastBuild)}h since last rebuild`);
        return true;
      }

      // Check if contract count has changed significantly (>5% change)
      const currentContractIds = await this.blobStorage.getAllContracts();
      const countChangePercent = Math.abs(currentContractIds.length - existing.contractCount) / existing.contractCount;
      
      if (countChangePercent > 0.05) {
        console.log(`[ConsolidatedBlobManager] Consolidation needed: ${Math.round(countChangePercent * 100)}% contract count change`);
        return true;
      }

      console.log('[ConsolidatedBlobManager] Consolidation not needed');
      return false;

    } catch (error) {
      console.warn('[ConsolidatedBlobManager] Error checking consolidation need, defaulting to true:', error);
      return true;
    }
  }

  /**
   * Perform full consolidation - generate and save new blob
   */
  async consolidate(): Promise<{ success: boolean; contractCount: number; generationTimeMs: number; error?: string }> {
    try {
      const registry = await this.generateConsolidatedBlob();
      await this.saveConsolidatedBlob(registry);
      
      return {
        success: true,
        contractCount: registry.contractCount,
        generationTimeMs: registry.metadata.generationTimeMs
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        contractCount: 0,
        generationTimeMs: 0,
        error: errorMessage
      };
    }
  }
}
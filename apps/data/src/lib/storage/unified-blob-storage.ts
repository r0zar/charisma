import { put, head, list } from '@vercel/blob';

export interface BlobMetadata {
  path: string;
  size: number;
  lastModified: Date;
  contentType: string;
}

export interface StreamChunk {
  data: any;
  offset: number;
  hasMore: boolean;
}

export interface RootBlob {
  version: string;
  lastUpdated: string;
  addresses: Record<string, any>;
  contracts: Record<string, any>;
  prices: Record<string, any>;
  'price-series': Record<string, any>;
  balances: Record<string, any>;
  metadata: {
    totalSize: number;
    entryCount: number;
    regions: string[];
  };
}

/**
 * Unified Blob Storage Service
 * Combines all blob operations with proper error handling, caching, and debugging
 */
export class UnifiedBlobStorage {
  private readonly ROOT_BLOB_PATH = 'v1/root.json';
  private rootBlobCache: RootBlob | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5000; // 5 second cache for development
  private lastKnownBlobUrl: string | null = null;

  /**
   * Gets the root blob with fallback to initialization
   */
  async getRootBlob(bypassCache = false): Promise<RootBlob> {
    const now = Date.now();

    // Use cached version if valid and not bypassing cache
    if (!bypassCache && this.rootBlobCache && (now - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.rootBlobCache;
    }

    // Try multiple approaches to fetch the blob
    let rootBlob: RootBlob;
    
    try {
      // Approach 1: Try cached URL first if available
      if (this.lastKnownBlobUrl) {
        try {
          const response = await fetch(this.lastKnownBlobUrl);
          if (response.ok) {
            rootBlob = await response.json();
            this.updateCache(rootBlob, now);
            return rootBlob;
          }
        } catch (e) {
          console.log('Cached URL failed, trying list approach');
        }
      }

      // Approach 2: List blobs to find our root
      try {
        const { blobs } = await list({ limit: 100 });
        const rootBlobInfo = blobs.find(blob => blob.pathname === this.ROOT_BLOB_PATH);
        
        if (rootBlobInfo) {
          this.lastKnownBlobUrl = rootBlobInfo.url;
          const response = await fetch(rootBlobInfo.url);
          
          if (response.ok) {
            rootBlob = await response.json();
            this.validateBlobStructure(rootBlob);
            this.updateCache(rootBlob, now);
            return rootBlob;
          } else if (response.status === 403) {
            console.log('Access denied to blob, may need reinitialization');
          }
        }
      } catch (listError) {
        console.log('List approach failed:', listError);
      }

      // Approach 3: Try head() to get URL
      try {
        const blobInfo = await head(this.ROOT_BLOB_PATH);
        this.lastKnownBlobUrl = blobInfo.url;
        
        const response = await fetch(blobInfo.url);
        if (response.ok) {
          rootBlob = await response.json();
          this.validateBlobStructure(rootBlob);
          this.updateCache(rootBlob, now);
          return rootBlob;
        } else if (response.status === 403) {
          console.log('Access denied to blob via head, may need reinitialization');
        }
      } catch (headError) {
        console.log('Head approach failed:', headError);
      }

      // All approaches failed - initialize new blob
      console.log('No existing root blob found, initializing new one');
      rootBlob = await this.initializeRootBlob();
      
    } catch (error) {
      console.log('Error during blob fetch, initializing new one:', error);
      rootBlob = await this.initializeRootBlob();
    }
    
    // Update cache and return
    this.updateCache(rootBlob, now);
    return rootBlob;
  }

  /**
   * Validate blob structure
   */
  private validateBlobStructure(rootBlob: any): void {
    if (!rootBlob.version || !rootBlob.addresses || !rootBlob.contracts || !rootBlob.prices) {
      throw new Error('Invalid root blob structure');
    }
  }

  /**
   * Update cache with new blob data
   */
  private updateCache(rootBlob: RootBlob, timestamp: number): void {
    this.rootBlobCache = rootBlob;
    this.cacheTimestamp = timestamp;
  }

  /**
   * Initialize empty root blob
   */
  private async initializeRootBlob(): Promise<RootBlob> {
    const rootBlob: RootBlob = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      addresses: {},
      contracts: {},
      prices: {},
      'price-series': {},
      balances: {},
      metadata: {
        totalSize: 0,
        entryCount: 0,
        regions: ['us-east-1']
      }
    };

    await this.saveRootBlob(rootBlob);
    return rootBlob;
  }

  /**
   * Save root blob to storage
   */
  private async saveRootBlob(rootBlob: RootBlob): Promise<void> {
    // Update metadata
    rootBlob.lastUpdated = new Date().toISOString();
    rootBlob.metadata.totalSize = JSON.stringify(rootBlob).length;
    rootBlob.metadata.entryCount =
      Object.keys(rootBlob.addresses || {}).length +
      Object.keys(rootBlob.contracts || {}).length +
      Object.keys(rootBlob.prices || {}).length +
      Object.keys(rootBlob['price-series'] || {}).length +
      Object.keys(rootBlob.balances || {}).length;

    const content = JSON.stringify(rootBlob, null, 0);

    try {
      const result = await put(this.ROOT_BLOB_PATH, content, {
        access: 'public',
        contentType: 'application/json',
        cacheControlMaxAge: 300,
        addRandomSuffix: false,
        allowOverwrite: true
      });

      // Store the URL for faster access next time
      this.lastKnownBlobUrl = result.url;

      // Update cache
      this.updateCache(rootBlob, Date.now());
      
      console.log(`Saved root blob (${rootBlob.metadata.entryCount} entries)`);
    } catch (error) {
      console.error('Failed to save root blob:', error);
      throw error;
    }
  }

  /**
   * Store data at a specific path within the root blob
   * @param path - The path to store data at
   * @param data - The data to store
   * @param options - Storage options
   */
  async put<T>(path: string, data: T, options?: {
    allowFullReplace?: boolean;  // Allow replacing entire sections (dangerous)
    merge?: boolean;             // Merge with existing data instead of replace
  }): Promise<void> {
    console.log(`Attempting to save data at path: ${path}`);
    
    const rootBlob = await this.getRootBlob();
    
    // Log current state before modification
    const beforeCount = Object.keys(rootBlob.addresses || {}).length + 
                       Object.keys(rootBlob.contracts || {}).length + 
                       Object.keys(rootBlob.prices || {}).length +
                       Object.keys(rootBlob['price-series'] || {}).length;
    console.log(`Root blob before update: ${beforeCount} entries`);
    
    // Navigate to the nested path and set data
    const pathParts = path.replace('.json', '').split('/');
    let current: any = rootBlob;

    // Navigate to parent
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }

    // Set the final value
    const finalKey = pathParts[pathParts.length - 1];
    current[finalKey] = data;

    // Log state after modification
    const afterCount = Object.keys(rootBlob.addresses || {}).length + 
                      Object.keys(rootBlob.contracts || {}).length + 
                      Object.keys(rootBlob.prices || {}).length +
                      Object.keys(rootBlob['price-series'] || {}).length;
    console.log(`Root blob after update: ${afterCount} entries`);

    // Save the updated root blob
    await this.saveRootBlob(rootBlob);
    console.log(`Successfully saved data at path: ${path}`);
  }

  /**
   * Batch update multiple paths atomically
   */
  async putBatch(updates: Array<{ path: string; data: any }>): Promise<void> {
    console.log(`Batch updating ${updates.length} paths...`);
    
    // Clear cache once before batch operation
    this.clearCache();
    const rootBlob = await this.getRootBlob();
    
    const beforeCount = Object.keys(rootBlob.addresses || {}).length + 
                       Object.keys(rootBlob.contracts || {}).length + 
                       Object.keys(rootBlob.prices || {}).length +
                       Object.keys(rootBlob['price-series'] || {}).length;
    console.log(`Root blob before batch update: ${beforeCount} entries`);

    // Apply all updates to the same root blob instance
    for (const { path, data } of updates) {
      console.log(`  - Applying update to path: ${path}`);
      
      const pathParts = path.replace('.json', '').split('/');
      let current: any = rootBlob;

      // Navigate to parent
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!(part in current)) {
          current[part] = {};
        }
        current = current[part];
      }

      // Set the final value
      const finalKey = pathParts[pathParts.length - 1];
      current[finalKey] = data;
    }

    const afterCount = Object.keys(rootBlob.addresses || {}).length + 
                      Object.keys(rootBlob.contracts || {}).length + 
                      Object.keys(rootBlob.prices || {}).length +
                      Object.keys(rootBlob['price-series'] || {}).length;
    console.log(`Root blob after batch update: ${afterCount} entries`);

    // Save once after all updates
    await this.saveRootBlob(rootBlob);
    console.log('Batch update completed successfully');
  }

  /**
   * Retrieve data from a specific path within the root blob
   */
  async get<T = any>(path: string, options?: {
    stream?: boolean;
    offset?: number;
    limit?: number;
  }): Promise<T | StreamChunk> {
    const rootBlob = await this.getRootBlob();
    
    // Navigate to the nested path
    const pathParts = path.replace('.json', '').split('/');
    let current: any = rootBlob;

    for (const part of pathParts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        throw new Error(`Data not found: ${path}`);
      }
    }

    // For streaming requests, return chunked data
    if (options?.stream) {
      return this.getStream<T>(current, options.offset, options.limit);
    }

    return current as T;
  }

  /**
   * Streaming read for large datasets
   */
  private async getStream<T>(data: any, offset = 0, limit = 1000): Promise<StreamChunk> {
    try {
      // Handle array data with pagination
      if (Array.isArray(data)) {
        const chunk = data.slice(offset, offset + limit);
        return {
          data: chunk,
          offset: offset + chunk.length,
          hasMore: offset + chunk.length < data.length
        };
      }

      // Handle nested object streaming
      if (typeof data === 'object' && data !== null) {
        const entries = Object.entries(data);
        const chunk = Object.fromEntries(entries.slice(offset, offset + limit));

        return {
          data: chunk,
          offset: offset + Object.keys(chunk).length,
          hasMore: offset + Object.keys(chunk).length < entries.length
        };
      }

      // Non-streamable data
      return {
        data,
        offset: 0,
        hasMore: false
      };
    } catch (error) {
      console.error(`Blob storage stream error:`, error);
      throw error;
    }
  }

  /**
   * Get the complete root blob (for API endpoints)
   */
  async getRoot(): Promise<RootBlob> {
    return this.getRootBlob();
  }

  /**
   * Delete data at a specific path within the root blob
   */
  async delete(path: string): Promise<void> {
    console.log(`Attempting to delete data at path: ${path}`);
    
    const rootBlob = await this.getRootBlob();
    
    // Navigate to the nested path and delete
    const pathParts = path.replace('.json', '').split('/');
    let current: any = rootBlob;
    
    // Navigate to parent of the target
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        throw new Error(`Path not found: ${path}`);
      }
    }
    
    // Delete the final key
    const finalKey = pathParts[pathParts.length - 1];
    if (!(finalKey in current)) {
      throw new Error(`Data not found: ${path}`);
    }
    
    delete current[finalKey];
    console.log(`Deleted data at path: ${path}`);
    
    // Save the updated root blob
    await this.saveRootBlob(rootBlob);
    console.log(`Successfully deleted and saved data for path: ${path}`);
  }

  /**
   * Gets metadata for the root blob
   */
  async getMetadata(path: string): Promise<BlobMetadata | null> {
    try {
      const result = await head(this.ROOT_BLOB_PATH);

      return {
        path,
        size: result.size,
        lastModified: new Date(result.uploadedAt),
        contentType: result.contentType || 'application/json'
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      console.error(`Blob metadata error for ${path}:`, error);
      throw error;
    }
  }

  /**
   * Build navigation tree from root blob structure
   */
  async buildNavigationTree(): Promise<any> {
    const rootBlob = await this.getRootBlob();
    const tree: any = {};

    // Add v1 root blob as a folder with its own structure
    const v1Children: any = {};
    
    // Add the root blob metadata file
    v1Children['v1-root.json'] = {
      type: 'file',
      size: JSON.stringify(rootBlob).length,
      lastModified: new Date(rootBlob.lastUpdated),
      path: 'v1',
      metadata: {
        version: rootBlob.version,
        totalSize: rootBlob.metadata.totalSize,
        entryCount: rootBlob.metadata.entryCount
      }
    };

    const buildSubtree = (obj: any, currentPath: string = '') => {
      const subtree: any = {};

      if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
          const newPath = currentPath ? `${currentPath}/${key}` : key;

          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            const hasDirectData = Object.values(value).some(v =>
              typeof v !== 'object' || Array.isArray(v)
            );

            if (hasDirectData) {
              subtree[`${key}.json`] = {
                type: 'file',
                size: JSON.stringify(value).length,
                lastModified: new Date(rootBlob.lastUpdated),
                path: `${newPath}.json`
              };
            } else {
              subtree[key] = {
                type: 'directory',
                children: buildSubtree(value, newPath)
              };
            }
          }
        }
      }

      return subtree;
    };

    // Build addresses section with its own blob file
    const addressesChildren: any = {};
    
    // Add addresses blob file
    try {
      addressesChildren['addresses-blob.json'] = {
        type: 'file',
        size: JSON.stringify(rootBlob.addresses).length,
        lastModified: new Date(rootBlob.lastUpdated),
        path: 'addresses'
      };
    } catch (error) {
      console.log('[UnifiedBlob] Addresses blob unavailable');
    }
    
    // Add individual address entries
    if (rootBlob.addresses && typeof rootBlob.addresses === 'object') {
      for (const [address, addressData] of Object.entries(rootBlob.addresses)) {
        const addressSubtree = buildSubtree(addressData, `addresses/${address}`);
        
        // Add historical subdirectory for each address
        addressSubtree.historical = {
          type: 'directory',
          children: {
            '5m': { type: 'directory', children: {} },
            '1h': { type: 'directory', children: {} },
            '1d': { type: 'directory', children: {} }
          }
        };
        
        addressesChildren[address] = {
          type: 'directory',
          children: addressSubtree
        };
      }
    }

    v1Children.addresses = {
      type: 'directory',
      children: addressesChildren
    };

    // Build contracts section with its own blob file
    const contractsChildren: any = {};
    
    // Add contracts blob file
    try {
      contractsChildren['contracts-blob.json'] = {
        type: 'file',
        size: JSON.stringify(rootBlob.contracts).length,
        lastModified: new Date(rootBlob.lastUpdated),
        path: 'contracts'
      };
    } catch (error) {
      console.log('[UnifiedBlob] Contracts blob unavailable');
    }
    
    // Add individual contract entries
    Object.assign(contractsChildren, buildSubtree(rootBlob.contracts, 'contracts'));

    v1Children.contracts = {
      type: 'directory',
      children: contractsChildren
    };

    // Handle prices with simplified token-based structure
    const pricesChildren: any = {};
    
    // Add prices blob file
    try {
      const pricesData = await this.get('prices');
      if (pricesData && typeof pricesData === 'object') {
        pricesChildren['prices-blob.json'] = {
          type: 'file',
          size: JSON.stringify(pricesData).length,
          lastModified: new Date((pricesData as any).lastUpdated || Date.now()),
          path: 'prices'
        };

        // Look for token data in the prices object
        for (const [key, value] of Object.entries(pricesData)) {
          // Skip metadata fields
          if (key === 'lastUpdated' || key === 'source' || key === 'timestamp') {
            continue;
          }
          
          // If this looks like a contract ID (contains a dot), treat it as a token
          if (typeof key === 'string' && key.includes('.') && value && typeof value === 'object') {
            const simpleName = this.getSimpleTokenName(key);
            pricesChildren[`${simpleName}.json`] = {
              type: 'file',
              size: JSON.stringify(value).length,
              lastModified: new Date((pricesData as any).lastUpdated || Date.now()),
              path: `prices/${key}`,
              contractId: key  // Store the full contract ID for reference
            };
          }
        }
      }
    } catch (error) {
      console.log('[UnifiedBlob] Prices data not available:', error);
      pricesChildren['prices-blob.json'] = {
        type: 'file',
        size: 2,
        lastModified: new Date(),
        path: 'prices'
      };
    }

    v1Children.prices = {
      type: 'directory',
      children: pricesChildren
    };

    // Handle price-series with token-based historical data
    const priceSeriesChildren: any = {};
    
    // Add price-series blob file
    try {
      const priceSeriesData = await this.get('price-series');
      if (priceSeriesData && typeof priceSeriesData === 'object') {
        priceSeriesChildren['price-series-blob.json'] = {
          type: 'file',
          size: JSON.stringify(priceSeriesData).length,
          lastModified: new Date((priceSeriesData as any).lastUpdated || Date.now()),
          path: 'price-series'
        };

        // Look for token data in the price-series object
        for (const [key, value] of Object.entries(priceSeriesData)) {
          // Skip metadata fields
          if (key === 'lastUpdated' || key === 'source' || key === 'timestamp') {
            continue;
          }
          
          // If this looks like a contract ID (contains a dot), treat it as a token series
          if (typeof key === 'string' && key.includes('.') && value && typeof value === 'object') {
            const simpleName = this.getSimpleTokenName(key);
            priceSeriesChildren[`${simpleName}-series.json`] = {
              type: 'file',
              size: JSON.stringify(value).length,
              lastModified: new Date((priceSeriesData as any).lastUpdated || Date.now()),
              path: `price-series/${key}`
            };
          }
        }
      }
    } catch (error) {
      console.log('[UnifiedBlob] Price-series data not available:', error);
      priceSeriesChildren['price-series-blob.json'] = {
        type: 'file',
        size: 2,
        lastModified: new Date(),
        path: 'price-series'
      };
    }

    v1Children['price-series'] = {
      type: 'directory',
      children: priceSeriesChildren
    };

    // Create the main v1 folder
    tree.v1 = {
      type: 'directory',
      children: v1Children
    };

    return tree;
  }

  /**
   * Convert contract ID to simple token name for display
   */
  private getSimpleTokenName(contractId: string): string {
    const parts = contractId.split('.');
    if (parts.length === 2) {
      const tokenName = parts[1];
      // Try to extract readable name from common patterns
      if (tokenName.includes('-token')) {
        return tokenName.replace('-token', '').toUpperCase();
      } else if (tokenName.includes('coin')) {
        return tokenName.replace('coin', '').toUpperCase();
      } else if (tokenName === 'arkadiko-token') {
        return 'DIKO';
      } else if (tokenName === 'alex-token') {
        return 'ALEX';
      } else if (tokenName === 'charisma-token') {
        return 'CHA';
      } else if (tokenName === 'welshcorgicoin-token') {
        return 'WELSH';
      } else if (tokenName === 'sbtc-token') {
        return 'SBTC';
      }
      return tokenName.toUpperCase().slice(0, 10); // Max 10 chars
    }
    return contractId.slice(0, 10);
  }

  /**
   * Clear the cache (for testing/debugging)
   */
  clearCache(): void {
    this.rootBlobCache = null;
    this.cacheTimestamp = 0;
  }

  // DEBUG UTILITIES (from blob-debug.ts)
  
  /**
   * Log detailed information about the current blob state
   */
  async logBlobState(): Promise<void> {
    try {
      console.log('=== BLOB DEBUG STATE ===');
      
      // Clear cache to get fresh data
      this.clearCache();
      
      const rootBlob = await this.getRoot();
      
      console.log('Root blob info:', {
        version: rootBlob.version,
        lastUpdated: rootBlob.lastUpdated,
        totalSize: rootBlob.metadata?.totalSize,
        entryCount: rootBlob.metadata?.entryCount
      });
      
      console.log('Addresses count:', Object.keys(rootBlob.addresses || {}).length);
      console.log('Contracts count:', Object.keys(rootBlob.contracts || {}).length);
      console.log('Prices count:', Object.keys(rootBlob.prices || {}).length);
      
      if (Object.keys(rootBlob.addresses || {}).length > 0) {
        console.log('Address keys:', Object.keys(rootBlob.addresses));
      }
      
      if (Object.keys(rootBlob.contracts || {}).length > 0) {
        console.log('Contract keys:', Object.keys(rootBlob.contracts));
      }
      
      if (Object.keys(rootBlob.prices || {}).length > 0) {
        console.log('Price keys:', Object.keys(rootBlob.prices));
      }
      
      console.log('=== END BLOB DEBUG ===');
      
    } catch (error) {
      console.error('Failed to debug blob state:', error);
    }
  }

  /**
   * Test save and retrieve cycle
   */
  async testSaveRetrieveCycle(path: string, testData: any): Promise<boolean> {
    try {
      console.log(`Testing save/retrieve cycle for path: ${path}`);
      
      // Save test data
      await this.put(path, testData);
      console.log('✓ Save completed');
      
      // Clear cache to force fresh fetch
      this.clearCache();
      
      // Retrieve and compare
      const retrieved = await this.get(path);
      const matches = JSON.stringify(retrieved) === JSON.stringify(testData);
      
      if (matches) {
        console.log('✓ Data matches after save/retrieve cycle');
        return true;
      } else {
        console.log('✗ Data mismatch after save/retrieve cycle');
        console.log('Expected:', testData);
        console.log('Retrieved:', retrieved);
        return false;
      }
      
    } catch (error) {
      console.error('Save/retrieve test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const unifiedBlobStorage = new UnifiedBlobStorage();
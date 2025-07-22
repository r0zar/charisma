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
  metadata: {
    totalSize: number;
    entryCount: number;
    regions: string[];
  };
}

/**
 * Single root blob architecture for optimal CDN caching
 * Uses v1/root.json as single source of truth with atomic updates
 */
export class BlockchainBlobStorage {
  private readonly ROOT_BLOB_PATH = 'v1/root.json';
  private rootBlobCache: RootBlob | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5000; // Shorter cache for debugging
  private lastKnownBlobUrl: string | null = null;

  constructor() {
    // Use simple path - Vercel Blob handles the URL construction
  }

  /**
   * Gets the root blob with local caching
   */
  async getRootBlob(bypassCache = false): Promise<RootBlob> {
    const now = Date.now();

    // Use cached version if valid and not bypassing cache
    if (!bypassCache && this.rootBlobCache && (now - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.rootBlobCache;
    }

    try {
      // First try to fetch using the last known URL from cache
      if (this.lastKnownBlobUrl) {
        try {
          const response = await fetch(this.lastKnownBlobUrl);
          if (response.ok) {
            const rootBlob = await response.json();
            this.rootBlobCache = rootBlob;
            this.cacheTimestamp = now;
            return rootBlob;
          }
        } catch (e) {
          // URL might be stale, continue with listing approach
          console.log('Cached URL failed, trying list approach');
        }
      }

      // List all blobs and find our root blob
      const { blobs } = await list({ limit: 100 });
      const rootBlob = blobs.find(blob => blob.pathname === this.ROOT_BLOB_PATH);

      if (!rootBlob) {
        // Only initialize if we don't have any cached URL at all
        if (!this.lastKnownBlobUrl) {
          return this.initializeRootBlob();
        } else {
          // We had a URL but list failed - this might be a temporary issue
          // Try to use a fallback approach or throw error
          throw new Error('Root blob not found in list but we have a cached URL');
        }
      }

      // Store the URL for next time
      this.lastKnownBlobUrl = rootBlob.url;

      // Get the blob content
      const response = await fetch(rootBlob.url);

      if (!response.ok) {
        throw new Error(`Failed to fetch root blob: ${response.statusText}`);
      }

      const rootBlobData = await response.json();

      // Update cache
      this.rootBlobCache = rootBlobData;
      this.cacheTimestamp = now;

      return rootBlobData;
    } catch (error) {
      console.error('Root blob fetch error:', error);

      // If any error occurs, try to initialize a new root blob
      if (error instanceof Error && error.message.includes('not found')) {
        return this.initializeRootBlob();
      }

      throw error;
    }
  }

  /**
   * Initializes an empty root blob
   */
  private async initializeRootBlob(): Promise<RootBlob> {
    const rootBlob: RootBlob = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      addresses: {},
      contracts: {},
      prices: {},
      metadata: {
        totalSize: 0,
        entryCount: 0,
        regions: []
      }
    };

    await this.putRootBlob(rootBlob);
    return rootBlob;
  }

  /**
   * Retrieves data from the root blob with streaming support
   */
  async get<T = any>(path: string, options?: {
    stream?: boolean;
    offset?: number;
    limit?: number;
  }): Promise<T | StreamChunk> {
    try {
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
    } catch (error) {
      console.error(`Blob storage get error for ${path}:`, error);
      throw error;
    }
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
   * Atomically updates the root blob
   */
  private async putRootBlob(rootBlob: RootBlob): Promise<void> {
    try {
      // Update metadata
      rootBlob.lastUpdated = new Date().toISOString();
      rootBlob.metadata.totalSize = JSON.stringify(rootBlob).length;
      rootBlob.metadata.entryCount =
        Object.keys(rootBlob.addresses).length +
        Object.keys(rootBlob.contracts).length +
        Object.keys(rootBlob.prices).length;

      const content = JSON.stringify(rootBlob, null, 0); // Minified for CDN performance

      const result = await put(this.ROOT_BLOB_PATH, content, {
        access: 'public',
        contentType: 'application/json',
        cacheControlMaxAge: 300, // 5 minutes - reasonable for data warehouse
      });

      // Store the URL for faster access next time
      this.lastKnownBlobUrl = result.url;

      // Update local cache
      this.rootBlobCache = rootBlob;
      this.cacheTimestamp = Date.now();

    } catch (error) {
      console.error('Root blob put error:', error);
      throw error;
    }
  }

  /**
   * Stores data with atomic updates to root blob
   */
  async put<T>(path: string, data: T): Promise<void> {
    try {
      const rootBlob = await this.getRootBlob();

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

      // Atomic update
      await this.putRootBlob(rootBlob);

    } catch (error) {
      console.error(`Blob storage put error for ${path}:`, error);
      throw error;
    }
  }

  /**
   * Updates nested data within a blob
   */
  async updateNested<T>(path: string, updatePath: string[], value: T): Promise<void> {
    try {
      const rootBlob = await this.getRootBlob();

      // Navigate to the full nested location
      const pathParts = path.replace('.json', '').split('/');
      let current: any = rootBlob;

      // Navigate to the base path
      for (const part of pathParts) {
        if (!(part in current)) {
          current[part] = {};
        }
        current = current[part];
      }

      // Navigate to the nested update location
      for (let i = 0; i < updatePath.length - 1; i++) {
        const key = updatePath[i];
        if (!(key in current)) {
          current[key] = {};
        }
        current = current[key];
      }

      // Set the value
      const finalKey = updatePath[updatePath.length - 1];
      current[finalKey] = value;

      await this.putRootBlob(rootBlob);
    } catch (error) {
      console.error(`Blob storage nested update error:`, error);
      throw error;
    }
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
   * Deletes data from the root blob
   */
  async delete(path: string): Promise<void> {
    try {
      const rootBlob = await this.getRootBlob();

      // Navigate to the nested path and delete
      const pathParts = path.replace('.json', '').split('/');
      let current: any = rootBlob;

      // Navigate to parent
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (current && typeof current === 'object' && part in current) {
          current = current[part];
        } else {
          // Path doesn't exist, nothing to delete
          return;
        }
      }

      // Delete the final key
      const finalKey = pathParts[pathParts.length - 1];
      if (current && typeof current === 'object' && finalKey in current) {
        delete current[finalKey];
        await this.putRootBlob(rootBlob);
      }
    } catch (error) {
      console.error(`Blob delete error for ${path}:`, error);
      throw error;
    }
  }

  /**
   * Builds the tree structure for navigation from root blob
   */
  async buildNavigationTree(): Promise<any> {
    const rootBlob = await this.getRootBlob();
    const tree: any = {};

    // Build tree structure from root blob data
    const buildSubtree = (obj: any, currentPath: string = '') => {
      const subtree: any = {};

      if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
          const newPath = currentPath ? `${currentPath}/${key}` : key;

          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            // Check if this looks like data (has non-object children) or is a container
            const hasDirectData = Object.values(value).some(v =>
              typeof v !== 'object' || Array.isArray(v)
            );

            if (hasDirectData) {
              // This is a data file
              subtree[`${key}.json`] = {
                type: 'file',
                size: JSON.stringify(value).length,
                lastModified: new Date(rootBlob.lastUpdated),
                path: `${newPath}.json`
              };
            } else {
              // This is a directory
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

    // Build from each top-level section
    tree.addresses = {
      type: 'directory',
      children: buildSubtree(rootBlob.addresses, 'addresses')
    };

    tree.contracts = {
      type: 'directory',
      children: buildSubtree(rootBlob.contracts, 'contracts')
    };

    tree.prices = {
      type: 'directory',
      children: buildSubtree(rootBlob.prices, 'prices')
    };

    return tree;
  }
}

// Singleton instance
export const blobStorage = new BlockchainBlobStorage();
/**
 * Storage Capacity Tracker
 * Manages centralized blob registry and capacity tracking across all services
 */

import { put, head, list } from '@vercel/blob';
import type {
  BlobInfo,
  BlobOperation,
  ServiceCapacity,
  GlobalCapacity,
  BlobRegistry,
  BlobAlert,
  OptimizationSuggestion
} from '../types';
import { BLOB_SIZE_LIMITS } from '../types';

export class StorageCapacityTracker {
  private serviceName: string;
  private registryPath: string;
  private cache: BlobRegistry | null = null;
  private cacheExpiry: number = 0;
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.registryPath = '__blob_registry__.json';
  }

  /**
   * Record a blob operation and update capacity tracking
   */
  async recordOperation(operation: BlobOperation): Promise<void> {
    try {
      const registry = await this.getRegistry();
      
      // Update service capacity
      if (!registry.services[this.serviceName]) {
        registry.services[this.serviceName] = this.initializeServiceCapacity();
      }

      const service = registry.services[this.serviceName];
      
      // Update operation counts
      switch (operation.type) {
        case 'put':
        case 'copy':
          service.operations.advanced++;
          break;
        case 'fetch':
        case 'head':
          service.operations.simple++;
          break;
      }

      service.lastUpdated = Date.now();
      
      // Save updated registry
      await this.saveRegistry(registry);
    } catch (error) {
      console.error('Failed to record operation:', error);
      // Don't throw - monitoring shouldn't break the main operation
    }
  }

  /**
   * Update blob information in the registry
   */
  async updateBlobInfo(blobInfo: BlobInfo): Promise<void> {
    try {
      const registry = await this.getRegistry();
      
      // Update blob registry
      registry.blobs[blobInfo.path] = blobInfo;
      
      // Update service capacity
      if (!registry.services[this.serviceName]) {
        registry.services[this.serviceName] = this.initializeServiceCapacity();
      }

      const service = registry.services[this.serviceName];
      
      // Recalculate service totals
      const serviceBlobs = Object.values(registry.blobs)
        .filter(blob => blob.serviceName === this.serviceName);
      
      service.totalBlobs = serviceBlobs.length;
      service.totalSize = serviceBlobs.reduce((sum, blob) => sum + blob.size, 0);
      service.averageBlobSize = service.totalBlobs > 0 ? service.totalSize / service.totalBlobs : 0;
      
      // Find largest blob
      const largestBlob = serviceBlobs.reduce((largest, blob) => 
        blob.size > largest.size ? blob : largest, 
        { path: '', size: 0 }
      );
      
      service.largestBlob = largestBlob;
      service.lastUpdated = Date.now();
      
      // Update global stats
      registry.globalStats = this.calculateGlobalStats(registry);
      
      // Check for oversized blobs
      if (blobInfo.size > BLOB_SIZE_LIMITS.CACHE_LIMIT) {
        if (!registry.globalStats.oversizedBlobs.find(b => b.path === blobInfo.path)) {
          registry.globalStats.oversizedBlobs.push(blobInfo);
        }
      }
      
      // Save updated registry
      await this.saveRegistry(registry);
    } catch (error) {
      console.error('Failed to update blob info:', error);
    }
  }

  /**
   * Remove blob from registry
   */
  async removeBlobInfo(path: string): Promise<void> {
    try {
      const registry = await this.getRegistry();
      
      // Remove blob from registry
      delete registry.blobs[path];
      
      // Remove from oversized blobs
      registry.globalStats.oversizedBlobs = registry.globalStats.oversizedBlobs
        .filter(blob => blob.path !== path);
      
      // Recalculate service capacity
      if (registry.services[this.serviceName]) {
        const service = registry.services[this.serviceName];
        const serviceBlobs = Object.values(registry.blobs)
          .filter(blob => blob.serviceName === this.serviceName);
        
        service.totalBlobs = serviceBlobs.length;
        service.totalSize = serviceBlobs.reduce((sum, blob) => sum + blob.size, 0);
        service.averageBlobSize = service.totalBlobs > 0 ? service.totalSize / service.totalBlobs : 0;
        
        // Find largest blob
        const largestBlob = serviceBlobs.reduce((largest, blob) => 
          blob.size > largest.size ? blob : largest, 
          { path: '', size: 0 }
        );
        
        service.largestBlob = largestBlob;
        service.lastUpdated = Date.now();
      }
      
      // Update global stats
      registry.globalStats = this.calculateGlobalStats(registry);
      
      // Save updated registry
      await this.saveRegistry(registry);
    } catch (error) {
      console.error('Failed to remove blob info:', error);
    }
  }

  /**
   * Get service capacity information
   */
  async getServiceCapacity(serviceName?: string): Promise<ServiceCapacity | null> {
    try {
      const registry = await this.getRegistry();
      const targetService = serviceName || this.serviceName;
      return registry.services[targetService] || null;
    } catch (error) {
      console.error('Failed to get service capacity:', error);
      return null;
    }
  }

  /**
   * Get global capacity information
   */
  async getGlobalCapacity(): Promise<GlobalCapacity | null> {
    try {
      const registry = await this.getRegistry();
      return registry.globalStats;
    } catch (error) {
      console.error('Failed to get global capacity:', error);
      return null;
    }
  }

  /**
   * Get all oversized blobs across all services
   */
  async getOversizedBlobs(): Promise<BlobInfo[]> {
    try {
      const registry = await this.getRegistry();
      return registry.globalStats.oversizedBlobs;
    } catch (error) {
      console.error('Failed to get oversized blobs:', error);
      return [];
    }
  }

  /**
   * Get optimization suggestions for all services
   */
  async getOptimizationSuggestions(): Promise<OptimizationSuggestion[]> {
    try {
      const registry = await this.getRegistry();
      const suggestions: OptimizationSuggestion[] = [];
      
      Object.values(registry.blobs).forEach(blob => {
        // Suggest compression for large blobs
        if (blob.size > BLOB_SIZE_LIMITS.WARNING_THRESHOLD && blob.size < BLOB_SIZE_LIMITS.CACHE_LIMIT) {
          suggestions.push({
            path: blob.path,
            currentSize: blob.size,
            suggestedAction: 'compress',
            estimatedSavings: blob.size * 0.3, // Estimate 30% compression
            description: `Compress blob to reduce size and improve cache performance`
          });
        }
        
        // Suggest splitting for oversized blobs
        if (blob.size > BLOB_SIZE_LIMITS.CACHE_LIMIT) {
          suggestions.push({
            path: blob.path,
            currentSize: blob.size,
            suggestedAction: 'split',
            estimatedSavings: blob.size - BLOB_SIZE_LIMITS.CACHE_LIMIT,
            description: `Split oversized blob to avoid cache MISS penalties`
          });
        }
        
        // Suggest archiving for unused blobs
        if (blob.accessCount === 0 && Date.now() - blob.lastModified > 30 * 24 * 60 * 60 * 1000) {
          suggestions.push({
            path: blob.path,
            currentSize: blob.size,
            suggestedAction: 'archive',
            estimatedSavings: blob.size,
            description: `Archive unused blob (last accessed ${Math.floor((Date.now() - blob.lastModified) / (24 * 60 * 60 * 1000))} days ago)`
          });
        }
      });
      
      return suggestions.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
    } catch (error) {
      console.error('Failed to get optimization suggestions:', error);
      return [];
    }
  }

  /**
   * Clean up old registry entries
   */
  async cleanup(): Promise<void> {
    try {
      const registry = await this.getRegistry();
      const now = Date.now();
      const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days
      
      let cleaned = false;
      
      // Remove old blob entries
      Object.keys(registry.blobs).forEach(path => {
        const blob = registry.blobs[path];
        if (now - blob.lastModified > maxAge) {
          delete registry.blobs[path];
          cleaned = true;
        }
      });
      
      // Remove old alerts
      registry.alerts = registry.alerts.filter(alert => 
        now - alert.timestamp < 7 * 24 * 60 * 60 * 1000 // 7 days
      );
      
      if (cleaned) {
        // Recalculate all service capacities
        Object.keys(registry.services).forEach(serviceName => {
          const serviceBlobs = Object.values(registry.blobs)
            .filter(blob => blob.serviceName === serviceName);
          
          const service = registry.services[serviceName];
          service.totalBlobs = serviceBlobs.length;
          service.totalSize = serviceBlobs.reduce((sum, blob) => sum + blob.size, 0);
          service.averageBlobSize = service.totalBlobs > 0 ? service.totalSize / service.totalBlobs : 0;
          
          const largestBlob = serviceBlobs.reduce((largest, blob) => 
            blob.size > largest.size ? blob : largest, 
            { path: '', size: 0 }
          );
          
          service.largestBlob = largestBlob;
        });
        
        // Update global stats
        registry.globalStats = this.calculateGlobalStats(registry);
        registry.lastCleanup = now;
        
        // Save cleaned registry
        await this.saveRegistry(registry);
      }
    } catch (error) {
      console.error('Failed to cleanup registry:', error);
    }
  }

  /**
   * Get blob registry from storage with caching
   */
  private async getRegistry(): Promise<BlobRegistry> {
    const now = Date.now();
    
    // Return cached registry if still valid
    if (this.cache && now < this.cacheExpiry) {
      return this.cache;
    }
    
    try {
      // Try to fetch existing registry
      const response = await fetch(this.getRegistryUrl());
      
      if (response.ok) {
        const registry = await response.json() as BlobRegistry;
        this.cache = registry;
        this.cacheExpiry = now + this.cacheTTL;
        return registry;
      }
    } catch (error) {
      // Registry doesn't exist yet, create new one
    }
    
    // Create new registry
    const registry = this.createNewRegistry();
    this.cache = registry;
    this.cacheExpiry = now + this.cacheTTL;
    
    return registry;
  }

  /**
   * Save registry to blob storage
   */
  private async saveRegistry(registry: BlobRegistry): Promise<void> {
    try {
      registry.lastCleanup = Date.now();
      registry.version = '1.0.0';
      
      const content = JSON.stringify(registry, null, 2);
      await put(this.registryPath, content, {
        access: 'public',
        contentType: 'application/json'
      });
      
      // Update cache
      this.cache = registry;
      this.cacheExpiry = Date.now() + this.cacheTTL;
    } catch (error) {
      console.error('Failed to save registry:', error);
      throw error;
    }
  }

  /**
   * Get registry URL for fetching
   */
  private getRegistryUrl(): string {
    // This would need to be configured based on your blob store setup
    return `https://your-blob-store.com/${this.registryPath}`;
  }

  /**
   * Create new empty registry
   */
  private createNewRegistry(): BlobRegistry {
    return {
      blobs: {},
      services: {},
      globalStats: {
        totalServices: 0,
        totalBlobs: 0,
        totalSize: 0,
        services: {},
        oversizedBlobs: [],
        lastUpdated: Date.now(),
        version: '1.0.0'
      },
      alerts: [],
      lastCleanup: Date.now(),
      version: '1.0.0'
    };
  }

  /**
   * Initialize service capacity
   */
  private initializeServiceCapacity(): ServiceCapacity {
    return {
      serviceName: this.serviceName,
      totalBlobs: 0,
      totalSize: 0,
      averageBlobSize: 0,
      largestBlob: { path: '', size: 0 },
      operations: {
        simple: 0,
        advanced: 0
      },
      lastUpdated: Date.now()
    };
  }

  /**
   * Calculate global statistics
   */
  private calculateGlobalStats(registry: BlobRegistry): GlobalCapacity {
    const services = Object.keys(registry.services);
    const totalBlobs = Object.keys(registry.blobs).length;
    const totalSize = Object.values(registry.blobs).reduce((sum, blob) => sum + blob.size, 0);
    
    return {
      totalServices: services.length,
      totalBlobs,
      totalSize,
      services: { ...registry.services },
      oversizedBlobs: Object.values(registry.blobs).filter(blob => blob.size > BLOB_SIZE_LIMITS.CACHE_LIMIT),
      lastUpdated: Date.now(),
      version: '1.0.0'
    };
  }
}
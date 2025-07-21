/**
 * IndexManager - KV-based fast lookups for contract registry
 * 
 * Maintains indexes in Vercel KV for efficient querying of contract metadata.
 * Provides O(1) lookups for common queries while keeping indexes in sync.
 */

import { kv } from '@vercel/kv';
import type { 
  ContractMetadata, 
  ContractType, 
  ValidationStatus, 
  DiscoveryMethod 
} from '../types';

export interface IndexManagerConfig {
  serviceName: string;
  keyPrefix: string; // e.g., 'registry:'
}

export interface IndexStats {
  totalIndexes: number;
  indexSizes: Record<string, number>;
  lastUpdated: Record<string, number>;
  hitRate: number;
  totalQueries: number;
  cacheHits: number;
}

export class IndexManager {
  private config: IndexManagerConfig;
  private queryStats = {
    total: 0,
    hits: 0
  };

  constructor(config: IndexManagerConfig) {
    this.config = {
      ...config,
      keyPrefix: config.keyPrefix || 'registry:'
    };
  }

  // === Contract CRUD Operations ===

  /**
   * Add contract to all relevant indexes
   */
  async addToIndexes(contractId: string, metadata: ContractMetadata): Promise<void> {
    const operations = [
      // Main contract list
      this.addToSet(this.getKey('contracts:all'), contractId),
      
      // Type index
      this.addToSet(this.getKey(`contracts:type:${metadata.contractType}`), contractId),
      
      // Validation status index
      this.addToSet(this.getKey(`contracts:status:${metadata.validationStatus}`), contractId),
      
      // Discovery method index
      this.addToSet(this.getKey(`contracts:discovery:${metadata.discoveryMethod}`), contractId),
      
      // Trait indexes
      ...metadata.implementedTraits.map(trait => 
        this.addToSet(this.getKey(`contracts:trait:${trait}`), contractId)
      ),
      
      // Blocked status index
      metadata.blocked ? 
        this.addToSet(this.getKey('contracts:blocked'), contractId) :
        this.removeFromSet(this.getKey('contracts:blocked'), contractId)
    ];

    await Promise.all(operations);
    await this.updateIndexTimestamp('add', contractId);
  }

  /**
   * Remove contract from all indexes
   */
  async removeFromIndexes(contractId: string, metadata?: ContractMetadata): Promise<void> {
    const operations = [
      // Main contract list
      this.removeFromSet(this.getKey('contracts:all'), contractId)
    ];

    // If we have metadata, remove from specific indexes
    if (metadata) {
      operations.push(
        this.removeFromSet(this.getKey(`contracts:type:${metadata.contractType}`), contractId),
        this.removeFromSet(this.getKey(`contracts:status:${metadata.validationStatus}`), contractId),
        this.removeFromSet(this.getKey(`contracts:discovery:${metadata.discoveryMethod}`), contractId),
        ...metadata.implementedTraits.map(trait => 
          this.removeFromSet(this.getKey(`contracts:trait:${trait}`), contractId)
        )
      );

      if (metadata.blocked) {
        operations.push(this.removeFromSet(this.getKey('contracts:blocked'), contractId));
      }
    } else {
      // If no metadata provided, remove from all possible indexes (less efficient)
      const allIndexes = await this.getAllIndexKeys();
      operations.push(
        ...allIndexes.map(indexKey => this.removeFromSet(indexKey, contractId))
      );
    }

    await Promise.all(operations);
    await this.updateIndexTimestamp('remove', contractId);
  }

  /**
   * Update contract indexes when metadata changes
   */
  async updateIndexes(contractId: string, oldMetadata: ContractMetadata, newMetadata: ContractMetadata): Promise<void> {
    // Remove from old indexes and add to new ones
    await this.removeFromIndexes(contractId, oldMetadata);
    await this.addToIndexes(contractId, newMetadata);
  }

  // === Query Operations ===

  /**
   * Get all contracts
   */
  async getAllContracts(): Promise<string[]> {
    this.queryStats.total++;
    const result = await this.getSetMembers(this.getKey('contracts:all'));
    if (result.length > 0) this.queryStats.hits++;
    return result;
  }

  /**
   * Get contracts by type
   */
  async getContractsByType(type: ContractType): Promise<string[]> {
    this.queryStats.total++;
    const result = await this.getSetMembers(this.getKey(`contracts:type:${type}`));
    if (result.length > 0) this.queryStats.hits++;
    return result;
  }

  /**
   * Get contracts by trait
   */
  async getContractsByTrait(trait: string): Promise<string[]> {
    this.queryStats.total++;
    const result = await this.getSetMembers(this.getKey(`contracts:trait:${trait}`));
    if (result.length > 0) this.queryStats.hits++;
    return result;
  }

  /**
   * Get contracts by validation status
   */
  async getContractsByStatus(status: ValidationStatus): Promise<string[]> {
    this.queryStats.total++;
    const result = await this.getSetMembers(this.getKey(`contracts:status:${status}`));
    if (result.length > 0) this.queryStats.hits++;
    return result;
  }

  /**
   * Get contracts by discovery method
   */
  async getContractsByDiscovery(method: DiscoveryMethod): Promise<string[]> {
    this.queryStats.total++;
    const result = await this.getSetMembers(this.getKey(`contracts:discovery:${method}`));
    if (result.length > 0) this.queryStats.hits++;
    return result;
  }

  /**
   * Get blocked contracts
   */
  async getBlockedContracts(): Promise<string[]> {
    this.queryStats.total++;
    const result = await this.getSetMembers(this.getKey('contracts:blocked'));
    if (result.length > 0) this.queryStats.hits++;
    return result;
  }

  /**
   * Get contracts that implement multiple traits (intersection)
   */
  async getContractsByTraits(traits: string[]): Promise<string[]> {
    if (traits.length === 0) return [];
    if (traits.length === 1) return this.getContractsByTrait(traits[0]);

    this.queryStats.total++;
    
    // Get all sets for intersection
    const sets = await Promise.all(
      traits.map(trait => this.getSetMembers(this.getKey(`contracts:trait:${trait}`)))
    );

    // Find intersection
    const result = sets.reduce((intersection, currentSet) => 
      intersection.filter(contractId => currentSet.includes(contractId))
    );

    if (result.length > 0) this.queryStats.hits++;
    return result;
  }

  /**
   * Check if contract exists in indexes
   */
  async hasContract(contractId: string): Promise<boolean> {
    this.queryStats.total++;
    const exists = await kv.sismember(this.getKey('contracts:all'), contractId);
    if (exists) this.queryStats.hits++;
    return exists === 1;
  }

  // === Blocklist Operations ===

  /**
   * Add contract to blocklist
   */
  async blockContract(contractId: string): Promise<void> {
    await this.addToSet(this.getKey('contracts:blocked'), contractId);
    await this.updateIndexTimestamp('block', contractId);
  }

  /**
   * Remove contract from blocklist
   */
  async unblockContract(contractId: string): Promise<void> {
    await this.removeFromSet(this.getKey('contracts:blocked'), contractId);
    await this.updateIndexTimestamp('unblock', contractId);
  }

  /**
   * Check if contract is blocked
   */
  async isBlocked(contractId: string): Promise<boolean> {
    this.queryStats.total++;
    const blocked = await kv.sismember(this.getKey('contracts:blocked'), contractId);
    if (blocked) this.queryStats.hits++;
    return blocked === 1;
  }

  // === Management Operations ===

  /**
   * Rebuild all indexes from scratch
   */
  async rebuildIndexes(allContracts: Record<string, ContractMetadata>): Promise<{
    rebuilt: number;
    errors: { contractId: string; error: string }[];
  }> {
    // Clear all existing indexes
    await this.clearAllIndexes();

    const errors: { contractId: string; error: string }[] = [];
    let rebuilt = 0;

    // Rebuild indexes for each contract
    for (const [contractId, metadata] of Object.entries(allContracts)) {
      try {
        await this.addToIndexes(contractId, metadata);
        rebuilt++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({ contractId, error: errorMessage });
      }
    }

    await this.updateIndexTimestamp('rebuild');
    return { rebuilt, errors };
  }

  /**
   * Clear all indexes
   */
  async clearAllIndexes(): Promise<void> {
    const allKeys = await this.getAllIndexKeys();
    if (allKeys.length > 0) {
      await kv.del(...allKeys);
    }
    await this.updateIndexTimestamp('clear');
  }

  /**
   * Get index statistics
   */
  async getStats(): Promise<IndexStats> {
    const allKeys = await this.getAllIndexKeys();
    const indexSizes: Record<string, number> = {};
    const lastUpdated: Record<string, number> = {};

    // Get size of each index
    for (const key of allKeys) {
      try {
        const size = await kv.scard(key);
        const indexName = key.replace(this.config.keyPrefix, '');
        indexSizes[indexName] = size || 0;
        
        // Get last updated timestamp if available
        const timestamp = await kv.get(`${key}:updated`);
        if (timestamp) {
          lastUpdated[indexName] = timestamp as number;
        }
      } catch (error) {
        // Skip keys that aren't sets
        continue;
      }
    }

    return {
      totalIndexes: allKeys.length,
      indexSizes,
      lastUpdated,
      hitRate: this.queryStats.total > 0 ? (this.queryStats.hits / this.queryStats.total) * 100 : 0,
      totalQueries: this.queryStats.total,
      cacheHits: this.queryStats.hits
    };
  }

  /**
   * Reset query statistics
   */
  resetStats(): void {
    this.queryStats = { total: 0, hits: 0 };
  }

  // === Timestamp Tracking ===

  /**
   * Update discovery operation timestamp
   */
  async updateDiscoveryTimestamp(): Promise<void> {
    const timestamp = Date.now();
    await kv.set(this.getKey('timestamps:last_discovery'), timestamp);
  }

  /**
   * Update analysis operation timestamp
   */
  async updateAnalysisTimestamp(): Promise<void> {
    const timestamp = Date.now();
    await kv.set(this.getKey('timestamps:last_analysis'), timestamp);
  }

  /**
   * Get discovery timestamp
   */
  async getDiscoveryTimestamp(): Promise<number> {
    const timestamp = await kv.get(this.getKey('timestamps:last_discovery'));
    return (timestamp as number) || 0;
  }

  /**
   * Get analysis timestamp
   */
  async getAnalysisTimestamp(): Promise<number> {
    const timestamp = await kv.get(this.getKey('timestamps:last_analysis'));
    return (timestamp as number) || 0;
  }

  /**
   * Generic timestamp getter
   */
  async getTimestamp(key: string): Promise<number> {
    const timestamp = await kv.get(this.getKey(`timestamps:${key}`));
    return (timestamp as number) || 0;
  }

  /**
   * Generic timestamp setter
   */
  async setTimestamp(key: string, timestamp: number = Date.now()): Promise<void> {
    await kv.set(this.getKey(`timestamps:${key}`), timestamp);
  }

  // === Private Methods ===

  /**
   * Generate KV key with prefix
   */
  private getKey(suffix: string): string {
    return `${this.config.keyPrefix}${suffix}`;
  }

  /**
   * Add member to a KV set
   */
  private async addToSet(key: string, member: string): Promise<void> {
    await kv.sadd(key, member);
  }

  /**
   * Remove member from a KV set
   */
  private async removeFromSet(key: string, member: string): Promise<void> {
    await kv.srem(key, member);
  }

  /**
   * Get all members of a KV set
   */
  private async getSetMembers(key: string): Promise<string[]> {
    const members = await kv.smembers(key);
    return (members || []) as string[];
  }

  /**
   * Get all index keys
   */
  private async getAllIndexKeys(): Promise<string[]> {
    const pattern = `${this.config.keyPrefix}contracts:*`;
    const keys = await kv.keys(pattern);
    return (keys || []).filter(key => !key.endsWith(':updated'));
  }

  /**
   * Update index operation timestamp
   */
  private async updateIndexTimestamp(operation: string, contractId?: string): Promise<void> {
    const timestamp = Date.now();
    const key = contractId ? 
      `${this.getKey('operations')}:${operation}:${contractId}` :
      `${this.getKey('operations')}:${operation}`;
    
    await kv.set(key, timestamp);
  }
}
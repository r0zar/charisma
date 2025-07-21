/**
 * KV-based storage for current balances
 * Replaces blob storage for current state with fast KV access
 */

import { kv } from '@vercel/kv';
import type {
  BalanceStore,
  BalanceUpdate
} from '../types';
import { StorageError } from '../types';
import { KVBalanceData, KvBalanceStats, AddressMetadata } from '../types/snapshot-types';

export class KVBalanceStore implements BalanceStore {
  private readonly KEY_PREFIX = 'balance:';
  private readonly METADATA_PREFIX = 'balance:meta:';

  /**
   * Generate KV key for balance
   */
  private getBalanceKey(address: string, contractId: string): string {
    return `${this.KEY_PREFIX}${address}:${contractId}`;
  }

  /**
   * Generate KV key for address metadata
   */
  private getMetadataKey(address: string): string {
    return `${this.METADATA_PREFIX}${address}`;
  }

  /**
   * Get balance for specific contract
   */
  async getBalance(address: string, contractId: string): Promise<string | null> {
    try {
      const key = this.getBalanceKey(address, contractId);
      const data = await kv.get<KVBalanceData>(key);

      return data?.balance || null;
    } catch (error) {
      console.warn(`Failed to get balance for ${contractId} of ${address}:`, error);
      return null;
    }
  }

  /**
   * Set balance for specific contract
   */
  async setBalance(address: string, contractId: string, balance: string): Promise<void> {
    try {
      const key = this.getBalanceKey(address, contractId);
      const timestamp = Date.now();

      // Get existing data to preserve metadata
      const existingData = await kv.get<KVBalanceData>(key);

      const balanceData: KVBalanceData = {
        balance,
        lastUpdated: timestamp,
        blockHeight: existingData?.blockHeight
      };

      await kv.set(key, balanceData);

      // Update address metadata
      await this.updateAddressMetadata(address, contractId, timestamp);
    } catch (error) {
      throw new StorageError(`Failed to set balance: ${error}`);
    }
  }

  /**
   * Get all balances for an address
   */
  async getAddressBalances(address: string): Promise<Record<string, string>> {
    try {
      // Get list of contracts for this address
      const contracts = await this.getAddressContracts(address);
      const balances: Record<string, string> = {};

      // Fetch all balances in parallel
      const balancePromises = contracts.map(async (contractId) => {
        const balance = await this.getBalance(address, contractId);
        if (balance && balance !== '0') {
          balances[contractId] = balance;
        }
      });

      await Promise.all(balancePromises);
      return balances;
    } catch (error) {
      console.warn(`Failed to get balances for ${address}:`, error);
      return {};
    }
  }

  /**
   * Batch update multiple balances efficiently
   */
  async setBalancesBatch(updates: BalanceUpdate[]): Promise<void> {
    try {
      const timestamp = Date.now();

      // Prepare all KV operations
      const kvOperations: Promise<void>[] = [];

      for (const update of updates) {
        const key = this.getBalanceKey(update.address, update.contractId);
        const balanceData: KVBalanceData = {
          balance: update.balance,
          lastUpdated: update.timestamp || timestamp,
          blockHeight: update.blockHeight
        };

        kvOperations.push(kv.set(key, balanceData).then(() => { }));

        // Update address metadata
        kvOperations.push(
          this.updateAddressMetadata(update.address, update.contractId, timestamp)
        );
      }

      // Execute all operations in parallel
      await Promise.all(kvOperations);
    } catch (error) {
      throw new StorageError(`Failed to batch update balances: ${error}`);
    }
  }

  /**
   * Invalidate cache for an address (no-op for KV)
   */
  async invalidateAddress(address: string): Promise<void> {
    // No caching in KV implementation
    console.log(`Invalidate address ${address} - no-op for KV store`);
  }

  /**
   * Get last sync time for address or specific contract
   */
  async getLastSync(address: string, contractId?: string): Promise<Date | null> {
    try {
      if (contractId) {
        const key = this.getBalanceKey(address, contractId);
        const data = await kv.get<KVBalanceData>(key);
        return data?.lastUpdated ? new Date(data.lastUpdated) : null;
      }

      // Get address metadata for last sync
      const metadataKey = this.getMetadataKey(address);
      const metadata = await kv.get<{ lastSync: number }>(metadataKey);
      return metadata?.lastSync ? new Date(metadata.lastSync) : null;
    } catch (error) {
      console.warn(`Failed to get last sync for ${address}:`, error);
      return null;
    }
  }

  /**
   * Get all addresses that have balances
   */
  async getAllAddresses(): Promise<string[]> {
    try {
      // This would require scanning KV keys, which is expensive
      // Better to maintain an index of addresses
      const addressIndex = await kv.get<string[]>('balance:addresses:index');
      return addressIndex || [];
    } catch (error) {
      console.warn('Failed to get all addresses:', error);
      return [];
    }
  }

  /**
   * Get all contracts for an address
   */
  async getAddressContracts(address: string): Promise<string[]> {
    try {
      const metadataKey = this.getMetadataKey(address);
      const metadata = await kv.get<{ contracts: string[] }>(metadataKey);
      return metadata?.contracts || [];
    } catch (error) {
      console.warn(`Failed to get contracts for ${address}:`, error);
      return [];
    }
  }

  /**
   * Get all current balances (for snapshot creation)
   */
  async getAllCurrentBalances(): Promise<Record<string, Record<string, KVBalanceData>>> {
    try {
      const addresses = await this.getAllAddresses();
      const allBalances: Record<string, Record<string, KVBalanceData>> = {};

      // Process addresses in parallel
      const addressPromises = addresses.map(async (address) => {
        const contracts = await this.getAddressContracts(address);
        const addressBalances: Record<string, KVBalanceData> = {};

        // Get all balances for this address
        const balancePromises = contracts.map(async (contractId) => {
          const key = this.getBalanceKey(address, contractId);
          const data = await kv.get<KVBalanceData>(key);
          if (data && data.balance !== '0') {
            addressBalances[contractId] = data;
          }
        });

        await Promise.all(balancePromises);

        if (Object.keys(addressBalances).length > 0) {
          allBalances[address] = addressBalances;
        }
      });

      await Promise.all(addressPromises);
      return allBalances;
    } catch (error) {
      console.warn('Failed to get all current balances:', error);
      return {};
    }
  }

  // === Private Helper Methods ===

  /**
   * Update address metadata (contracts and last sync time)
   */
  private async updateAddressMetadata(address: string, contractId: string, timestamp: number): Promise<void> {
    try {
      const metadataKey = this.getMetadataKey(address);
      const existing = await kv.get<AddressMetadata>(metadataKey);

      const contracts = existing?.contracts || [];
      if (!contracts.includes(contractId)) {
        contracts.push(contractId);
      }

      await kv.set(metadataKey, {
        ...existing,
        contracts,
        lastSync: timestamp
      });

      // Update global address index
      await this.updateAddressIndex(address);
    } catch (error) {
      console.warn(`Failed to update metadata for ${address}:`, error);
    }
  }

  /**
   * Update global address index
   */
  private async updateAddressIndex(address: string): Promise<void> {
    try {
      const indexKey = 'balance:addresses:index';
      const existingAddresses = await kv.get<string[]>(indexKey);
      const addresses = existingAddresses || [];

      if (!addresses.includes(address)) {
        addresses.push(address);
        await kv.set(indexKey, addresses);
      }
    } catch (error) {
      console.warn(`Failed to update address index:`, error);
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<KvBalanceStats> {
    try {
      const addresses = await this.getAllAddresses();
      let totalContracts = 0;
      let lastUpdated = 0;

      for (const address of addresses) {
        const contracts = await this.getAddressContracts(address);
        totalContracts += contracts.length;

        const addressLastSync = await this.getLastSync(address);
        if (addressLastSync && addressLastSync.getTime() > lastUpdated) {
          lastUpdated = addressLastSync.getTime();
        }
      }

      // Get snapshot count from KV
      const snapshotIndex = await kv.get<string[]>('balance:snapshots:index');
      const totalSnapshots = snapshotIndex?.length || 0;

      return {
        totalSnapshots,
        totalAddresses: addresses.length,
        totalTokens: totalContracts,
        lastUpdate: lastUpdated > 0 ? new Date(lastUpdated).toISOString() : new Date().toISOString(),
        addresses
      };
    } catch (error) {
      console.warn('Failed to get stats:', error);
      return {
        totalSnapshots: 0,
        totalAddresses: 0,
        totalTokens: 0,
        lastUpdate: new Date().toISOString()
      };
    }
  }

  // === Address Discovery Methods ===

  /**
   * Set comprehensive address metadata (for auto-discovery)
   */
  async setAddressMetadata(address: string, metadata: Partial<AddressMetadata>): Promise<void> {
    try {
      const metadataKey = this.getMetadataKey(address);
      const existing = await kv.get<AddressMetadata>(metadataKey);

      const updatedMetadata: AddressMetadata = {
        contracts: existing?.contracts || [],
        lastSync: existing?.lastSync || Date.now(),
        ...metadata
      };

      await kv.set(metadataKey, updatedMetadata);
      
      // Update global address index
      await this.updateAddressIndex(address);
      
      console.log(`Updated metadata for address ${address}:`, {
        autoDiscovered: metadata.autoDiscovered,
        discoverySource: metadata.discoverySource,
        whaleClassification: metadata.whaleClassification
      });
    } catch (error) {
      throw new StorageError(`Failed to set address metadata: ${error}`);
    }
  }

  /**
   * Get comprehensive address metadata
   */
  async getAddressMetadata(address: string): Promise<AddressMetadata | null> {
    try {
      const metadataKey = this.getMetadataKey(address);
      return await kv.get<AddressMetadata>(metadataKey);
    } catch (error) {
      console.warn(`Failed to get address metadata for ${address}:`, error);
      return null;
    }
  }

  /**
   * Get all auto-discovered addresses
   */
  async getAutoDiscoveredAddresses(): Promise<string[]> {
    try {
      const allAddresses = await this.getAllAddresses();
      const autoDiscoveredAddresses: string[] = [];

      // Check each address for auto-discovery metadata
      for (const address of allAddresses) {
        const metadata = await this.getAddressMetadata(address);
        if (metadata?.autoDiscovered) {
          autoDiscoveredAddresses.push(address);
        }
      }

      return autoDiscoveredAddresses;
    } catch (error) {
      console.warn('Failed to get auto-discovered addresses:', error);
      return [];
    }
  }

  /**
   * Get addresses by whale classification
   */
  async getWhaleAddresses(classification?: 'small' | 'medium' | 'large' | 'mega'): Promise<string[]> {
    try {
      const allAddresses = await this.getAllAddresses();
      const whaleAddresses: string[] = [];

      for (const address of allAddresses) {
        const metadata = await this.getAddressMetadata(address);
        if (metadata?.whaleClassification) {
          if (!classification || metadata.whaleClassification === classification) {
            whaleAddresses.push(address);
          }
        }
      }

      return whaleAddresses;
    } catch (error) {
      console.warn('Failed to get whale addresses:', error);
      return [];
    }
  }

  /**
   * Get addresses by discovery source
   */
  async getAddressesBySource(source: 'token_holders' | 'whale_detection' | 'contract_addresses' | 'transaction_monitor' | 'manual'): Promise<string[]> {
    try {
      const allAddresses = await this.getAllAddresses();
      const sourceAddresses: string[] = [];

      for (const address of allAddresses) {
        const metadata = await this.getAddressMetadata(address);
        if (metadata?.discoverySource === source) {
          sourceAddresses.push(address);
        }
      }

      return sourceAddresses;
    } catch (error) {
      console.warn('Failed to get addresses by source:', error);
      return [];
    }
  }

}
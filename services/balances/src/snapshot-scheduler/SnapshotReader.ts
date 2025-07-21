/**
 * Snapshot Reader - Historical balance data access
 */

import { SnapshotStorage } from './SnapshotStorage';
import { KVBalanceStore } from '../storage/KVBalanceStore';
import type { 
  BalanceSnapshot, 
  SnapshotQuery, 
  SnapshotQueryResult, 
  SnapshotIndex 
} from '../types/snapshot-types';
import { 
  SnapshotError, 
  SNAPSHOT_CONSTANTS 
} from '../types/snapshot-types';
import { 
  findClosestTimestamp, 
  filterTimestamps 
} from '../utils/snapshot-utils';
import { kv } from '@vercel/kv';

export class SnapshotReader {
  private snapshotStorage: SnapshotStorage;
  private kvStore: KVBalanceStore;

  constructor(snapshotStorage: SnapshotStorage, kvStore: KVBalanceStore) {
    this.snapshotStorage = snapshotStorage;
    this.kvStore = kvStore;
  }

  /**
   * Get balance at specific timestamp
   */
  async getBalanceAtTime(
    address: string, 
    contractId: string, 
    timestamp: number
  ): Promise<string | null> {
    try {
      // If timestamp is recent, get from KV
      const timeSinceSnapshot = Date.now() - timestamp;
      if (timeSinceSnapshot < 60 * 60 * 1000) { // Less than 1 hour old
        const currentBalance = await this.kvStore.getBalance(address, contractId);
        if (currentBalance !== null) {
          return currentBalance;
        }
      }

      // Find closest historical snapshot
      const closestSnapshot = await this.findClosestSnapshot(timestamp);
      if (!closestSnapshot) {
        return null;
      }

      // Extract balance from snapshot
      const addressBalances = closestSnapshot.balances[address];
      if (!addressBalances || !addressBalances[contractId]) {
        return null;
      }

      return addressBalances[contractId].balance;
      
    } catch (error) {
      console.error(`Failed to get balance at time for ${address}:${contractId}:`, error);
      return null;
    }
  }

  /**
   * Get all balances for an address at specific timestamp
   */
  async getAddressBalancesAtTime(
    address: string, 
    timestamp: number
  ): Promise<Record<string, string>> {
    try {
      // If timestamp is recent, get from KV
      const timeSinceSnapshot = Date.now() - timestamp;
      if (timeSinceSnapshot < 60 * 60 * 1000) { // Less than 1 hour old
        const currentBalances = await this.kvStore.getAddressBalances(address);
        if (Object.keys(currentBalances).length > 0) {
          return currentBalances;
        }
      }

      // Find closest historical snapshot
      const closestSnapshot = await this.findClosestSnapshot(timestamp);
      if (!closestSnapshot) {
        return {};
      }

      // Extract balances from snapshot
      const addressBalances = closestSnapshot.balances[address];
      if (!addressBalances) {
        return {};
      }

      const result: Record<string, string> = {};
      for (const [contractId, data] of Object.entries(addressBalances)) {
        result[contractId] = data.balance;
      }

      return result;
      
    } catch (error) {
      console.error(`Failed to get address balances at time for ${address}:`, error);
      return {};
    }
  }

  /**
   * Query snapshots with filters
   */
  async querySnapshots(query: SnapshotQuery): Promise<SnapshotQueryResult> {
    const startTime = Date.now();
    
    try {
      // Get snapshot index
      const index = await this.getSnapshotIndex();
      if (!index) {
        return {
          snapshots: [],
          totalFound: 0,
          queryTime: Date.now() - startTime,
          cached: false
        };
      }

      // If querying specific timestamp, find closest
      if (query.timestamp) {
        const closestTimestamp = findClosestTimestamp(index.timestamps, query.timestamp);
        const snapshot = await this.snapshotStorage.getSnapshot(closestTimestamp);
        
        return {
          snapshots: snapshot ? [snapshot] : [],
          totalFound: snapshot ? 1 : 0,
          queryTime: Date.now() - startTime,
          cached: false
        };
      }

      // Filter timestamps by query
      const filteredTimestamps = filterTimestamps(index.timestamps, query);
      
      // Load snapshots in parallel
      const snapshotPromises = filteredTimestamps.map(timestamp => 
        this.snapshotStorage.getSnapshot(timestamp)
      );
      
      const snapshots = (await Promise.all(snapshotPromises))
        .filter((snapshot): snapshot is BalanceSnapshot => snapshot !== null);

      return {
        snapshots,
        totalFound: snapshots.length,
        queryTime: Date.now() - startTime,
        cached: false
      };
      
    } catch (error) {
      console.error('Failed to query snapshots:', error);
      throw new SnapshotError(`Query failed: ${error}`, 'QUERY_ERROR');
    }
  }

  /**
   * Find closest snapshot to timestamp
   */
  async findClosestSnapshot(timestamp: number): Promise<BalanceSnapshot | null> {
    try {
      const index = await this.getSnapshotIndex();
      if (!index || index.timestamps.length === 0) {
        return null;
      }

      const closestTimestamp = findClosestTimestamp(index.timestamps, timestamp);
      return await this.snapshotStorage.getSnapshot(closestTimestamp);
      
    } catch (error) {
      console.error('Failed to find closest snapshot:', error);
      return null;
    }
  }

  /**
   * Get snapshot by exact timestamp
   */
  async getSnapshot(timestamp: number): Promise<BalanceSnapshot | null> {
    try {
      return await this.snapshotStorage.getSnapshot(timestamp);
    } catch (error) {
      console.error(`Failed to get snapshot ${timestamp}:`, error);
      return null;
    }
  }

  /**
   * Get multiple snapshots by timestamps
   */
  async getSnapshots(timestamps: number[]): Promise<BalanceSnapshot[]> {
    try {
      const snapshotPromises = timestamps.map(timestamp => 
        this.snapshotStorage.getSnapshot(timestamp)
      );
      
      const snapshots = await Promise.all(snapshotPromises);
      return snapshots.filter((snapshot): snapshot is BalanceSnapshot => snapshot !== null);
      
    } catch (error) {
      console.error('Failed to get snapshots:', error);
      return [];
    }
  }

  /**
   * Get snapshot index
   */
  async getSnapshotIndex(): Promise<SnapshotIndex | null> {
    try {
      return await kv.get<SnapshotIndex>(SNAPSHOT_CONSTANTS.INDEX_KEY);
    } catch (error) {
      console.warn('Failed to get snapshot index:', error);
      return null;
    }
  }

  /**
   * Get latest snapshot
   */
  async getLatestSnapshot(): Promise<BalanceSnapshot | null> {
    try {
      const index = await this.getSnapshotIndex();
      if (!index || index.timestamps.length === 0) {
        return null;
      }

      const latestTimestamp = index.timestamps[index.timestamps.length - 1];
      return await this.snapshotStorage.getSnapshot(latestTimestamp);
      
    } catch (error) {
      console.error('Failed to get latest snapshot:', error);
      return null;
    }
  }

  /**
   * Get oldest snapshot
   */
  async getOldestSnapshot(): Promise<BalanceSnapshot | null> {
    try {
      const index = await this.getSnapshotIndex();
      if (!index || index.timestamps.length === 0) {
        return null;
      }

      const oldestTimestamp = index.timestamps[0];
      return await this.snapshotStorage.getSnapshot(oldestTimestamp);
      
    } catch (error) {
      console.error('Failed to get oldest snapshot:', error);
      return null;
    }
  }

  /**
   * Get snapshots in date range
   */
  async getSnapshotsInRange(
    fromTimestamp: number, 
    toTimestamp: number, 
    limit?: number
  ): Promise<BalanceSnapshot[]> {
    try {
      const query: SnapshotQuery = {
        from: fromTimestamp,
        to: toTimestamp,
        limit
      };

      const result = await this.querySnapshots(query);
      return result.snapshots;
      
    } catch (error) {
      console.error('Failed to get snapshots in range:', error);
      return [];
    }
  }

  /**
   * Get historical balance time series for address/contract
   */
  async getBalanceHistory(
    address: string, 
    contractId: string, 
    fromTimestamp?: number, 
    toTimestamp?: number, 
    limit?: number
  ): Promise<Array<{ timestamp: number; balance: string }>> {
    try {
      const query: SnapshotQuery = {
        from: fromTimestamp,
        to: toTimestamp,
        limit
      };

      const result = await this.querySnapshots(query);
      const history: Array<{ timestamp: number; balance: string }> = [];

      for (const snapshot of result.snapshots) {
        const addressBalances = snapshot.balances[address];
        if (addressBalances && addressBalances[contractId]) {
          history.push({
            timestamp: snapshot.timestamp,
            balance: addressBalances[contractId].balance
          });
        }
      }

      return history.sort((a, b) => a.timestamp - b.timestamp);
      
    } catch (error) {
      console.error('Failed to get balance history:', error);
      return [];
    }
  }

  /**
   * Get balance trends for address
   */
  async getBalanceTrends(
    address: string, 
    fromTimestamp?: number, 
    toTimestamp?: number
  ): Promise<Record<string, Array<{ timestamp: number; balance: string }>>> {
    try {
      const query: SnapshotQuery = {
        from: fromTimestamp,
        to: toTimestamp
      };

      const result = await this.querySnapshots(query);
      const trends: Record<string, Array<{ timestamp: number; balance: string }>> = {};

      for (const snapshot of result.snapshots) {
        const addressBalances = snapshot.balances[address];
        if (addressBalances) {
          for (const [contractId, data] of Object.entries(addressBalances)) {
            if (!trends[contractId]) {
              trends[contractId] = [];
            }
            trends[contractId].push({
              timestamp: snapshot.timestamp,
              balance: data.balance
            });
          }
        }
      }

      // Sort each trend by timestamp
      for (const contractId in trends) {
        trends[contractId].sort((a, b) => a.timestamp - b.timestamp);
      }

      return trends;
      
    } catch (error) {
      console.error('Failed to get balance trends:', error);
      return {};
    }
  }

  /**
   * Check if snapshot exists
   */
  async snapshotExists(timestamp: number): Promise<boolean> {
    try {
      return await this.snapshotStorage.snapshotExists(timestamp);
    } catch (error) {
      console.error(`Failed to check snapshot existence ${timestamp}:`, error);
      return false;
    }
  }

  /**
   * Get snapshot metadata without loading full content
   */
  async getSnapshotMetadata(timestamp: number): Promise<{
    timestamp: number;
    size: number;
    lastModified: string;
    exists: boolean;
  } | null> {
    try {
      return await this.snapshotStorage.getSnapshotMetadata(timestamp);
    } catch (error) {
      console.error(`Failed to get snapshot metadata ${timestamp}:`, error);
      return null;
    }
  }

  /**
   * Get available timestamps for a date range
   */
  async getAvailableTimestamps(
    fromTimestamp?: number, 
    toTimestamp?: number
  ): Promise<number[]> {
    try {
      const index = await this.getSnapshotIndex();
      if (!index) {
        return [];
      }

      let timestamps = index.timestamps;

      if (fromTimestamp !== undefined) {
        timestamps = timestamps.filter(ts => ts >= fromTimestamp);
      }

      if (toTimestamp !== undefined) {
        timestamps = timestamps.filter(ts => ts <= toTimestamp);
      }

      return timestamps;
      
    } catch (error) {
      console.error('Failed to get available timestamps:', error);
      return [];
    }
  }

  /**
   * Get reader statistics
   */
  async getStats(): Promise<{
    totalSnapshots: number;
    firstSnapshot: number;
    lastSnapshot: number;
    indexLastUpdated: number;
    availableRange: { start: number; end: number };
  }> {
    try {
      const index = await this.getSnapshotIndex();
      if (!index) {
        return {
          totalSnapshots: 0,
          firstSnapshot: 0,
          lastSnapshot: 0,
          indexLastUpdated: 0,
          availableRange: { start: 0, end: 0 }
        };
      }

      return {
        totalSnapshots: index.count,
        firstSnapshot: index.oldest,
        lastSnapshot: index.newest,
        indexLastUpdated: index.lastUpdated,
        availableRange: {
          start: index.oldest,
          end: index.newest
        }
      };
      
    } catch (error) {
      console.error('Failed to get reader stats:', error);
      return {
        totalSnapshots: 0,
        firstSnapshot: 0,
        lastSnapshot: 0,
        indexLastUpdated: 0,
        availableRange: { start: 0, end: 0 }
      };
    }
  }
}
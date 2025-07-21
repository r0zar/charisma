/**
 * Simplified Balance Service
 * Focus on core balance tracking without complex portfolio logic
 */

import type {
  BalanceStore,
  TimeSeriesStore,
  BalanceResult,
  BalanceRequest,
  BalanceMap,
  BalancePoint,
  TimePeriod,
  BulkBalanceRequest,
  BulkBalanceResponse
} from '../types';
import type { BalanceSnapshot } from '../types/snapshot-types';
import {
  ValidationError
} from '../types';
import { periodToTimeRange } from '../utils/time-series';
import { KVBalanceStore } from '../storage/KVBalanceStore';
import { BalanceTimeSeriesStore } from '../storage/BalanceTimeSeriesStore';
import { AddressDiscoveryService } from '../discovery/AddressDiscoveryService';

export interface BalanceServiceOptions {
  enableAutoDiscovery?: boolean;
  discoveryConfig?: {
    minTokenBalance?: string;
    enableAutoCollection?: boolean;
  };
}

export class BalanceService {
  private currentStore: BalanceStore;
  private timeSeriesStore: TimeSeriesStore;
  private discoveryService?: AddressDiscoveryService;
  private enableAutoDiscovery: boolean;

  constructor(
    currentStore?: BalanceStore,
    timeSeriesStore?: TimeSeriesStore,
    options?: BalanceServiceOptions
  ) {
    this.currentStore = currentStore || new KVBalanceStore();
    this.timeSeriesStore = timeSeriesStore || new BalanceTimeSeriesStore();
    this.enableAutoDiscovery = options?.enableAutoDiscovery ?? true;
    
    // Initialize discovery service if auto-discovery is enabled
    if (this.enableAutoDiscovery && this.currentStore instanceof KVBalanceStore) {
      this.discoveryService = new AddressDiscoveryService(this.currentStore, options?.discoveryConfig);
    }
  }

  // === Auto-Discovery Helper Methods ===

  /**
   * Check if an address is already known in the system
   */
  private async isAddressKnown(address: string): Promise<boolean> {
    if (!this.currentStore instanceof KVBalanceStore) {
      return true; // Skip auto-discovery for non-KV stores
    }

    try {
      const kvStore = this.currentStore as KVBalanceStore;
      const metadata = await kvStore.getAddressMetadata(address);
      return metadata !== null;
    } catch (error) {
      console.warn(`Failed to check if address ${address} is known:`, error);
      return false;
    }
  }

  /**
   * Auto-discover and add a new address to the system
   */
  private async autoDiscoverAddress(address: string, context?: { contractId?: string }): Promise<void> {
    if (!this.enableAutoDiscovery || !this.discoveryService) {
      return;
    }

    try {
      console.log(`🔍 Auto-discovering new address: ${address}`);
      
      // Add the address with auto-discovery metadata
      const kvStore = this.currentStore as KVBalanceStore;
      await kvStore.setAddressMetadata(address, {
        autoDiscovered: true,
        discoverySource: 'manual', // Since it was requested manually
        discoveredAt: Date.now(),
        lastSync: Date.now(),
        contracts: context?.contractId ? [context.contractId] : []
      });

      // Trigger balance collection for the address if enabled
      if (this.discoveryService) {
        await this.discoveryService.collectAddressBalances([address]);
      }

      console.log(`✅ Auto-discovery completed for address: ${address}`);
    } catch (error) {
      console.warn(`Failed to auto-discover address ${address}:`, error);
    }
  }

  // === Current Balance Methods ===

  /**
   * Get current balance for a specific contract
   */
  async getBalance(address: string, contractId: string): Promise<string> {
    try {
      this.validateAddress(address);
      this.validateContractId(contractId);

      // Auto-discover address if not known and auto-discovery is enabled
      if (this.enableAutoDiscovery && !(await this.isAddressKnown(address))) {
        await this.autoDiscoverAddress(address, { contractId });
      }

      const balance = await this.currentStore.getBalance(address, contractId);
      return balance || '0';
    } catch (error) {
      // Re-throw validation errors
      if (error instanceof ValidationError) {
        throw error;
      }
      console.warn(`Failed to get balance for ${contractId} of ${address}:`, error);
      return '0';
    }
  }

  /**
   * Get balances for specific contracts or all contracts
   */
  async getBalances(address: string, contractIds?: string[]): Promise<BalanceMap> {
    try {
      this.validateAddress(address);

      // Auto-discover address if not known and auto-discovery is enabled
      if (this.enableAutoDiscovery && !(await this.isAddressKnown(address))) {
        await this.autoDiscoverAddress(address);
      }

      const allBalances = await this.currentStore.getAddressBalances(address);

      if (!contractIds) {
        return allBalances;
      }

      // Filter to requested contracts
      const filtered: BalanceMap = {};
      for (const contractId of contractIds) {
        filtered[contractId] = allBalances[contractId] || '0';
      }

      return filtered;
    } catch (error) {
      // Re-throw validation errors
      if (error instanceof ValidationError) {
        throw error;
      }
      console.warn(`Failed to get balances for ${address}:`, error);
      return {};
    }
  }

  /**
   * Get all balances for an address with metadata
   */
  async getAllBalances(address: string): Promise<BalanceResult[]> {
    try {
      this.validateAddress(address);

      // Auto-discover address if not known and auto-discovery is enabled
      if (this.enableAutoDiscovery && !(await this.isAddressKnown(address))) {
        await this.autoDiscoverAddress(address);
      }

      const balances = await this.currentStore.getAddressBalances(address);
      const results: BalanceResult[] = [];

      for (const [contractId, balance] of Object.entries(balances)) {
        if (BigInt(balance as string) > 0) { // Only include non-zero balances
          const lastSync = await this.currentStore.getLastSync(address, contractId);

          results.push({
            address,
            contractId,
            balance,
            lastUpdated: lastSync?.getTime() || 0
          });
        }
      }

      return results;
    } catch (error) {
      // Re-throw validation errors
      if (error instanceof ValidationError) {
        throw error;
      }
      console.warn(`Failed to get all balances for ${address}:`, error);
      return [];
    }
  }

  /**
   * Bulk balance requests for efficiency
   */
  async getBulkBalances(request: BulkBalanceRequest): Promise<BulkBalanceResponse> {
    const startTime = Date.now();

    try {
      const { addresses, contractIds, includeZeroBalances = false } = request;
      const results: Record<string, Record<string, string>> = {};
      let cacheHits = 0;

      // Process each address
      for (const address of addresses) {
        this.validateAddress(address);

        // Auto-discover address if not known and auto-discovery is enabled  
        if (this.enableAutoDiscovery && !(await this.isAddressKnown(address))) {
          await this.autoDiscoverAddress(address);
        }

        const balances = await this.getBalances(address, contractIds);

        // Filter zero balances if requested
        if (!includeZeroBalances) {
          const filtered: Record<string, string> = {};
          for (const [contractId, balance] of Object.entries(balances)) {
            if (BigInt(balance) > 0) {
              filtered[contractId] = balance;
            }
          }
          results[address] = filtered;
        } else {
          results[address] = balances;
        }

        cacheHits++; // Assume cache hit for now
      }

      return {
        success: true,
        data: results,
        metadata: {
          totalAddresses: addresses.length,
          totalContracts: contractIds?.length || 0,
          executionTime: Date.now() - startTime,
          cacheHits
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          totalAddresses: request.addresses.length,
          totalContracts: request.contractIds?.length || 0,
          executionTime: Date.now() - startTime,
          cacheHits: 0
        }
      };
    }
  }

  /**
   * Batch balance requests for efficiency
   */
  async getBalancesBatch(requests: BalanceRequest[]): Promise<BalanceResult[]> {
    try {
      // Group requests by address for efficiency
      const addressGroups = new Map<string, string[]>();
      for (const request of requests) {
        if (!addressGroups.has(request.address)) {
          addressGroups.set(request.address, []);
        }
        addressGroups.get(request.address)!.push(request.contractId);
      }

      const results: BalanceResult[] = [];

      // Process each address group
      for (const [address, contractIds] of addressGroups) {
        const balances = await this.getBalances(address, contractIds);

        for (const contractId of contractIds) {
          const lastSync = await this.currentStore.getLastSync(address, contractId);

          results.push({
            address,
            contractId,
            balance: balances[contractId] || '0',
            lastUpdated: lastSync?.getTime() || 0
          });
        }
      }

      return results;
    } catch (error) {
      console.warn('Failed to process batch balance requests:', error);
      return [];
    }
  }

  // === Time Series Methods ===

  /**
   * Get balance history for charts and analysis
   */
  async getBalanceHistory(
    address: string,
    contractId: string,
    period: TimePeriod = '30d'
  ): Promise<BalancePoint[]> {
    try {
      this.validateAddress(address);
      this.validateContractId(contractId);

      const timeRange = periodToTimeRange(period);

      return this.timeSeriesStore.getBalanceHistory(address, contractId, {
        from: timeRange.from,
        to: timeRange.to,
        granularity: timeRange.granularity,
        limit: 100
      });
    } catch (error) {
      console.warn(`Failed to get balance history for ${address}/${contractId}:`, error);
      return [];
    }
  }

  /**
   * Get balance history for multiple contracts
   */
  async getBulkBalanceHistory(
    addresses: string[],
    contractIds: string[],
    period: TimePeriod = '30d'
  ): Promise<Record<string, Record<string, BalancePoint[]>>> {
    try {
      const results: Record<string, Record<string, BalancePoint[]>> = {};

      // Process each address
      for (const address of addresses) {
        this.validateAddress(address);
        results[address] = {};

        // Process each contract for this address
        for (const contractId of contractIds) {
          const history = await this.getBalanceHistory(address, contractId, period);
          results[address][contractId] = history;
        }
      }

      return results;
    } catch (error) {
      console.warn('Failed to get bulk balance history:', error);
      return {};
    }
  }

  /**
   * Get daily snapshots for an address
   */
  async getBalanceSnapshots(
    address: string,
    period: TimePeriod = '30d'
  ): Promise<BalanceSnapshot[]> {
    try {
      this.validateAddress(address);

      const timeRange = periodToTimeRange(period);

      return this.timeSeriesStore.getDailySnapshots(
        address,
        timeRange.from,
        timeRange.to
      );
    } catch (error) {
      console.warn(`Failed to get balance snapshots for ${address}:`, error);
      return [];
    }
  }


  // === Validation Methods ===

  /**
   * Validate Stacks address format
   */
  private validateAddress(address: string): void {
    if (!address || typeof address !== 'string') {
      throw new ValidationError('Invalid address: must be a non-empty string');
    }

    if (!/^S[PTM][0-9A-Z]{36,44}$/.test(address)) {
      throw new ValidationError('Invalid Stacks address format');
    }
  }

  /**
   * Validate contract ID format
   */
  private validateContractId(contractId: string): void {
    if (!contractId || typeof contractId !== 'string') {
      throw new ValidationError('Invalid contract ID: must be a non-empty string');
    }

    const parts = contractId.split('.');
    if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) {
      throw new ValidationError('Invalid contract ID format');
    }
  }

  /**
   * Validate balance string
   */
  private validateBalance(balance: string): void {
    if (!balance || typeof balance !== 'string') {
      throw new ValidationError('Invalid balance: must be a non-empty string');
    }

    try {
      const bigintBalance = BigInt(balance);
      if (bigintBalance < 0) {
        throw new ValidationError('Invalid balance: must be non-negative');
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError('Invalid balance: must be a valid integer string');
    }
  }

  // === Cache Management ===

  /**
   * Clear all cached data
   */
  clearCache(): void {
    if ('clearCache' in this.currentStore) {
      (this.currentStore as any).clearCache();
    }
    if ('clearCache' in this.timeSeriesStore) {
      (this.timeSeriesStore as any).clearCache();
    }
  }

  /**
   * Get service statistics
   */
  async getStats(): Promise<{
    currentStore?: any;
    timeSeriesStore?: any;
    blobMonitoring?: any;
  }> {
    return {
      currentStore: 'getStats' in this.currentStore
        ? await (this.currentStore as any).getStats()
        : undefined,
      timeSeriesStore: 'getCacheStats' in this.timeSeriesStore
        ? (this.timeSeriesStore as any).getCacheStats()
        : undefined,
      blobMonitoring: this.getBlobMonitoringStats()
    };
  }

  /**
   * Get comprehensive blob monitoring statistics
   */
  getBlobMonitoringStats(): {
    currentStore?: any;
    timeSeriesStore?: any;
    recentOperations?: any;
    activeAlerts?: any;
  } {
    return {
      currentStore: undefined, // KV store doesn't have blob monitoring
      timeSeriesStore: 'getBlobMonitorStats' in this.timeSeriesStore
        ? (this.timeSeriesStore as any).getBlobMonitorStats()
        : undefined,
      recentOperations: this.getRecentBlobOperations(),
      activeAlerts: this.getBlobAlerts()
    };
  }

  /**
   * Get recent blob operations across all stores
   */
  getRecentBlobOperations(limit: number = 10) {
    const operations = [];

    // KV store doesn't have blob operations

    if ('getRecentBlobOperations' in this.timeSeriesStore) {
      operations.push(...(this.timeSeriesStore as any).getRecentBlobOperations(limit));
    }

    return operations
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get active blob alerts across all stores
   */
  getBlobAlerts() {
    const alerts = [];

    // KV store doesn't have blob alerts

    if ('getBlobAlerts' in this.timeSeriesStore) {
      alerts.push(...(this.timeSeriesStore as any).getBlobAlerts());
    }

    return alerts.sort((a, b) => b.timestamp - a.timestamp);
  }

  // === Auto-Discovery Management Methods ===

  /**
   * Enable or disable auto-discovery for new addresses
   */
  setAutoDiscovery(enabled: boolean): void {
    this.enableAutoDiscovery = enabled;
    
    if (enabled && !this.discoveryService && this.currentStore instanceof KVBalanceStore) {
      this.discoveryService = new AddressDiscoveryService(this.currentStore);
    }
  }

  /**
   * Get current auto-discovery status
   */
  isAutoDiscoveryEnabled(): boolean {
    return this.enableAutoDiscovery;
  }

  /**
   * Manually add an address to the system
   */
  async addAddress(address: string, metadata?: {
    discoverySource?: 'manual' | 'token_holders' | 'whale_detection' | 'transaction_monitor';
    autoDiscovered?: boolean;
  }): Promise<void> {
    try {
      this.validateAddress(address);

      if (this.currentStore instanceof KVBalanceStore) {
        const kvStore = this.currentStore as KVBalanceStore;
        await kvStore.setAddressMetadata(address, {
          autoDiscovered: metadata?.autoDiscovered ?? false,
          discoverySource: metadata?.discoverySource ?? 'manual',
          discoveredAt: Date.now(),
          lastSync: Date.now(),
          contracts: []
        });

        console.log(`✅ Manually added address to system: ${address}`);
      }
    } catch (error) {
      console.error(`Failed to manually add address ${address}:`, error);
      throw error;
    }
  }

  /**
   * Get auto-discovery statistics
   */
  async getAutoDiscoveryStats(): Promise<{
    enabled: boolean;
    totalAddresses: number;
    autoDiscoveredCount: number;
    lastDiscoveryTime?: Date;
  }> {
    if (!this.currentStore instanceof KVBalanceStore) {
      return {
        enabled: false,
        totalAddresses: 0,
        autoDiscoveredCount: 0
      };
    }

    try {
      const kvStore = this.currentStore as KVBalanceStore;
      const allAddresses = await kvStore.getAllAddresses();
      const autoDiscoveredAddresses = await kvStore.getAutoDiscoveredAddresses();

      return {
        enabled: this.enableAutoDiscovery,
        totalAddresses: allAddresses.length,
        autoDiscoveredCount: autoDiscoveredAddresses.length,
        lastDiscoveryTime: autoDiscoveredAddresses.length > 0 ? new Date() : undefined
      };
    } catch (error) {
      console.warn('Failed to get auto-discovery stats:', error);
      return {
        enabled: this.enableAutoDiscovery,
        totalAddresses: 0,
        autoDiscoveredCount: 0
      };
    }
  }
}
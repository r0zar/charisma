/**
 * Address Discovery Service - Core orchestration for automated address discovery
 */

import type { BalanceStore } from '../types';
import { TokenHolderScanner } from './TokenHolderScanner';
import { WhaleDetectionService } from './WhaleDetectionService';
import { ContractAddressScanner } from './ContractAddressScanner';
import { KVBalanceStore } from '../storage/KVBalanceStore';

export interface AddressDiscoveryConfig {
  // Token holder discovery
  minTokenBalance?: string;
  topHolderPercentage?: number;
  maxHoldersPerToken?: number;
  
  // Contract address discovery
  includeContractAddresses?: boolean;
  maxContractsToScan?: number;
  contractTypes?: ('sip-010' | 'sip-009' | 'defi' | 'dao' | 'other')[];
  
  // Whale detection thresholds
  whaleThresholdUSD?: number;
  enableAutoCollection?: boolean;
  
  // Rate limiting
  batchSize?: number;
  rateLimitMs?: number;
  maxConcurrent?: number;
}

export interface DiscoveryResult {
  addresses: string[];
  source: 'token_holders' | 'whale_detection' | 'contract_addresses' | 'transaction_monitor' | 'manual';
  metadata: {
    tokenContract?: string;
    balanceAmount?: string;
    whaleClassification?: 'small' | 'medium' | 'large' | 'mega';
    contractType?: 'sip-010' | 'sip-009' | 'defi' | 'dao' | 'other';
    contractName?: string;
    totalTokensHeld?: number;
    confidenceScore?: number;
    discoveredAt: number;
  };
  success: boolean;
  error?: string;
}

export interface DiscoveryStats {
  totalAddressesDiscovered: number;
  addressesBySource: Record<string, number>;
  successRate: number;
  lastDiscoveryRun: number;
  avgDiscoveryTime: number;
  apiCallsUsed: number;
}

export class AddressDiscoveryService {
  private balanceStore: BalanceStore;
  private tokenHolderScanner: TokenHolderScanner;
  private whaleDetectionService: WhaleDetectionService;
  private contractAddressScanner: ContractAddressScanner;
  private config: AddressDiscoveryConfig;
  
  // Discovery state
  private isRunning: boolean = false;
  private stats: DiscoveryStats = {
    totalAddressesDiscovered: 0,
    addressesBySource: {},
    successRate: 0,
    lastDiscoveryRun: 0,
    avgDiscoveryTime: 0,
    apiCallsUsed: 0
  };

  constructor(
    balanceStore?: BalanceStore,
    config?: AddressDiscoveryConfig
  ) {
    this.balanceStore = balanceStore || new KVBalanceStore();
    this.config = {
      minTokenBalance: '1000', // Minimum balance to consider
      topHolderPercentage: 10, // Track top 10% of holders
      maxHoldersPerToken: 100, // Max addresses per token
      includeContractAddresses: true, // Include contract addresses by default
      maxContractsToScan: 30, // Max contracts to scan
      contractTypes: ['sip-010', 'sip-009', 'defi', 'dao'], // Include all useful contract types
      whaleThresholdUSD: 10000, // $10k+ USD value threshold
      enableAutoCollection: true,
      batchSize: 50, // Process 50 addresses at once
      rateLimitMs: 1000, // 1 second between API calls
      maxConcurrent: 3, // Max concurrent API requests
      ...config
    };

    this.tokenHolderScanner = new TokenHolderScanner(this.balanceStore, {
      batchSize: this.config.batchSize!,
      rateLimitMs: this.config.rateLimitMs!,
      maxConcurrent: this.config.maxConcurrent!
    });

    this.whaleDetectionService = new WhaleDetectionService(this.balanceStore, {
      thresholdUSD: this.config.whaleThresholdUSD!
    });

    this.contractAddressScanner = new ContractAddressScanner(this.balanceStore, {
      batchSize: this.config.batchSize!,
      rateLimitMs: this.config.rateLimitMs!,
      maxConcurrent: this.config.maxConcurrent!,
      includeTokenContracts: this.config.contractTypes?.includes('sip-010') || false,
      includeNFTContracts: this.config.contractTypes?.includes('sip-009') || false,
      includeDeFiContracts: this.config.contractTypes?.includes('defi') || false
    });
  }

  /**
   * Run comprehensive address discovery across all methods
   */
  async runDiscovery(): Promise<DiscoveryResult[]> {
    if (this.isRunning) {
      throw new Error('Discovery already in progress');
    }

    console.log('🔍 Starting comprehensive address discovery...');
    const startTime = Date.now();
    this.isRunning = true;

    const results: DiscoveryResult[] = [];

    try {
      // Phase 1: Discover token holders
      console.log('📊 Phase 1: Discovering token holders...');
      const tokenHolderResults = await this.discoverTokenHolders();
      results.push(...tokenHolderResults);

      // Phase 2: Discover contract addresses (if enabled)
      if (this.config.includeContractAddresses) {
        console.log('🏭 Phase 2: Discovering contract addresses...');
        const contractResults = await this.discoverContractAddresses();
        results.push(...contractResults);
      }

      // Phase 3: Whale detection on discovered addresses
      const allDiscoveredAddresses = [...tokenHolderResults];
      if (this.config.includeContractAddresses) {
        const contractResults = results.filter(r => r.source === 'contract_addresses');
        allDiscoveredAddresses.push(...contractResults);
      }
      
      console.log('🐋 Phase 3: Running whale detection...');
      const whaleResults = await this.detectWhales(allDiscoveredAddresses);
      results.push(...whaleResults);

      // Phase 4: Auto-add high-value addresses to collection targets
      if (this.config.enableAutoCollection) {
        console.log('🎯 Phase 4: Auto-adding collection targets...');
        await this.autoAddCollectionTargets(results);
      }

      // Update statistics
      const endTime = Date.now();
      this.updateStats(results, endTime - startTime);

      console.log(`✅ Discovery completed: ${results.length} results, ${results.filter(r => r.success).length} successful`);
      return results;

    } catch (error) {
      console.error('❌ Discovery failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Discover addresses holding significant amounts of tracked tokens
   */
  async discoverTokenHolders(): Promise<DiscoveryResult[]> {
    try {
      const holderResults = await this.tokenHolderScanner.scanTopHolders({
        topPercentage: this.config.topHolderPercentage!,
        maxAddresses: this.config.maxHoldersPerToken!,
        minBalance: this.config.minTokenBalance!
      });

      return holderResults.map(result => ({
        addresses: [result.address],
        source: 'token_holders' as const,
        metadata: {
          tokenContract: result.tokenContract,
          balanceAmount: result.balance,
          confidenceScore: 0.8, // High confidence for token holder data
          discoveredAt: Date.now()
        },
        success: result.success,
        error: result.error
      }));

    } catch (error) {
      console.error('Token holder discovery failed:', error);
      return [{
        addresses: [],
        source: 'token_holders',
        metadata: { discoveredAt: Date.now() },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }];
    }
  }

  /**
   * Discover contract addresses that hold tokens
   */
  async discoverContractAddresses(): Promise<DiscoveryResult[]> {
    try {
      const contractResults = await this.contractAddressScanner.scanContractAddresses({
        contractTypes: this.config.contractTypes,
        maxContracts: this.config.maxContractsToScan!,
        minTokenBalance: this.config.minTokenBalance!,
        onlyWithTokenBalances: true // Only include contracts that actually hold tokens
      });

      return contractResults.map(result => ({
        addresses: [result.address],
        source: 'contract_addresses' as const,
        metadata: {
          contractType: result.contractType,
          contractName: result.contractName,
          totalTokensHeld: result.totalTokensHeld,
          balanceAmount: result.totalTokensHeld.toString(),
          confidenceScore: result.success ? 0.9 : 0, // High confidence for successful contract scans
          discoveredAt: Date.now()
        },
        success: result.success,
        error: result.error
      }));

    } catch (error) {
      console.error('Contract address discovery failed:', error);
      return [{
        addresses: [],
        source: 'contract_addresses',
        metadata: { discoveredAt: Date.now() },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }];
    }
  }

  /**
   * Run whale detection on discovered addresses
   */
  async detectWhales(discoveryResults: DiscoveryResult[]): Promise<DiscoveryResult[]> {
    const addresses = discoveryResults
      .filter(r => r.success)
      .flatMap(r => r.addresses);

    if (addresses.length === 0) {
      return [];
    }

    try {
      const whaleResults = await this.whaleDetectionService.classifyAddresses(addresses);
      
      return whaleResults
        .filter(result => result.classification !== 'none') // Filter out non-whale addresses
        .map(result => ({
          addresses: [result.address],
          source: 'whale_detection' as const,
          metadata: {
            whaleClassification: result.classification as 'small' | 'medium' | 'large' | 'mega',
            balanceAmount: result.totalValue,
            confidenceScore: result.confidence,
            discoveredAt: Date.now()
          },
          success: result.success,
        error: result.error
      }));

    } catch (error) {
      console.error('Whale detection failed:', error);
      return [{
        addresses: [],
        source: 'whale_detection',
        metadata: { discoveredAt: Date.now() },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }];
    }
  }

  /**
   * Automatically add high-value addresses as collection targets
   */
  private async autoAddCollectionTargets(results: DiscoveryResult[]): Promise<void> {
    const whaleAddresses = results
      .filter(r => r.success && r.source === 'whale_detection')
      .filter(r => ['medium', 'large', 'mega'].includes(r.metadata.whaleClassification || ''))
      .flatMap(r => r.addresses);

    console.log(`Adding ${whaleAddresses.length} whale addresses as auto-collection targets`);

    // Store metadata about auto-discovered addresses
    for (const address of whaleAddresses) {
      const result = results.find(r => r.addresses.includes(address));
      if (result) {
        await this.balanceStore.setAddressMetadata(address, {
          autoDiscovered: true,
          discoverySource: result.source,
          discoveryMetadata: result.metadata,
          autoCollectionEnabled: true
        });
      }
    }
  }

  /**
   * Update discovery statistics
   */
  private updateStats(results: DiscoveryResult[], executionTime: number): void {
    const successfulResults = results.filter(r => r.success);
    
    this.stats.totalAddressesDiscovered = successfulResults.reduce(
      (total, r) => total + r.addresses.length, 0
    );

    // Count by source
    this.stats.addressesBySource = {};
    for (const result of successfulResults) {
      this.stats.addressesBySource[result.source] = 
        (this.stats.addressesBySource[result.source] || 0) + result.addresses.length;
    }

    this.stats.successRate = results.length > 0 ? 
      (successfulResults.length / results.length) * 100 : 0;
    
    this.stats.lastDiscoveryRun = Date.now();
    this.stats.avgDiscoveryTime = executionTime;
    
    console.log('📈 Discovery Stats:', this.stats);
  }

  /**
   * Get current discovery statistics
   */
  getStats(): DiscoveryStats {
    return { ...this.stats };
  }

  /**
   * Check if discovery is currently running
   */
  isDiscoveryRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get current configuration
   */
  getConfig(): AddressDiscoveryConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AddressDiscoveryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update dependent services
    this.tokenHolderScanner.updateConfig({
      batchSize: this.config.batchSize!,
      rateLimitMs: this.config.rateLimitMs!,
      maxConcurrent: this.config.maxConcurrent!
    });

    this.whaleDetectionService.updateConfig({
      thresholdUSD: this.config.whaleThresholdUSD!
    });

    this.contractAddressScanner.updateConfig({
      batchSize: this.config.batchSize!,
      rateLimitMs: this.config.rateLimitMs!,
      maxConcurrent: this.config.maxConcurrent!,
      includeTokenContracts: this.config.contractTypes?.includes('sip-010') || false,
      includeNFTContracts: this.config.contractTypes?.includes('sip-009') || false,
      includeDeFiContracts: this.config.contractTypes?.includes('defi') || false
    });
  }
}
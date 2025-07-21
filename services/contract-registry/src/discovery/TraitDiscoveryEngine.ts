/**
 * TraitDiscoveryEngine - Discovers contracts implementing specific traits
 * 
 * Uses getContractInfoWithParsedAbi from @repo/polyglot to analyze known contracts
 * and discover their trait implementations.
 */

import { searchContractsByTrait, TraitSearchConfig } from '@repo/polyglot';
import type {
  DiscoveryResult,
  DiscoveryMethod,
  DiscoveryConfig,
  TraitDiscoveryConfig,
  SIPDiscoveryConfig
} from '../types/discovery-types';
import type { TraitDefinition } from '../analysis/TraitAnalyzer';

export interface TraitDiscoveryEngineConfig {
  apiKey?: string;
  baseUrl: string;
  timeout: number;
  debug: boolean;
  batchSize: number;
  maxRetries: number;
  retryDelay: number;
  blacklist: string[];
  maxContracts?: number; // Maximum number of contracts to discover in one search
}

export interface DiscoveredContract {
  contract_id: string;
  tx_id: string;
  block_height: number;
  clarity_version?: string;
  discoveryMethod: DiscoveryMethod;
  discoveredAt: number;
}

export interface TraitSearchParams {
  trait: TraitDefinition; // Trait definition for analysis
  limit?: number;
  offset?: number;
  blacklist?: string[];
}

export class TraitDiscoveryEngine {
  private config: TraitDiscoveryEngineConfig;

  constructor(config: Partial<TraitDiscoveryEngineConfig> = {}) {
    this.config = {
      baseUrl: 'https://api.hiro.so',
      timeout: 30000,
      debug: false,
      batchSize: 50,
      maxRetries: 3,
      retryDelay: 5000,
      blacklist: [],
      maxContracts: 10000, // Default limit to prevent memory issues
      ...config
    };
  }

  /**
   * Discover contracts implementing a specific trait
   */
  async discoverByTrait(traitConfig: TraitDiscoveryConfig): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const discoveredContracts: DiscoveredContract[] = [];
    const errorContracts: { contractId: string; error: string }[] = [];

    try {
      if (!traitConfig.enabled) {
        return this.createEmptyResult('trait-search', startTime, 'Trait discovery disabled');
      }

      const searchParams: TraitSearchParams = {
        trait: traitConfig.trait,
        blacklist: this.config.blacklist
      };

      // Perform paginated search
      const contracts = await this.searchContractsByTrait(searchParams);

      // The contracts are already processed and deduplicated by searchContractsByTrait
      discoveredContracts.push(...contracts);

      return {
        success: true,
        method: 'trait-search',
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        contractsFound: contracts.length,
        contractsProcessed: contracts.length,
        contractsAdded: discoveredContracts.length,
        contractsUpdated: 0,
        contractsSkipped: 0,
        contractsErrored: errorContracts.length,
        newContracts: discoveredContracts.map(c => c.contract_id),
        errorContracts
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return this.createFailedResult('trait-search', startTime, errorMessage);
    }
  }

  /**
   * Discover contracts implementing SIP standards
   */
  async discoverBySipStandard(sipConfig: SIPDiscoveryConfig): Promise<DiscoveryResult> {
    const startTime = Date.now();

    try {
      if (!sipConfig.enabled) {
        return this.createEmptyResult('sip-scan', startTime, 'SIP discovery disabled');
      }

      // Convert SIP config to trait config for trait-based search
      const traitConfig: TraitDiscoveryConfig = {
        trait: sipConfig.trait,
        enabled: true,
        priority: 1,
        batchSize: this.config.batchSize
      };

      // Reuse trait discovery logic
      const result = await this.discoverByTrait(traitConfig);

      // Update method to reflect SIP-specific discovery
      return {
        ...result,
        method: 'sip-scan'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return this.createFailedResult('sip-scan', startTime, errorMessage);
    }
  }

  /**
   * Perform API-based contract scanning
   */
  async discoverByApiScan(config: DiscoveryConfig): Promise<DiscoveryResult> {
    const startTime = Date.now();

    try {
      if (!config.enabled) {
        return this.createEmptyResult('api-scan', startTime, 'API scan disabled');
      }

      // This could be extended to scan other APIs like:
      // - Recent contract deployments
      // - Popular contract lists
      // - Token registries
      // For now, returning empty result as placeholder

      return {
        success: true,
        method: 'api-scan',
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        contractsFound: 0,
        contractsProcessed: 0,
        contractsAdded: 0,
        contractsUpdated: 0,
        contractsSkipped: 0,
        contractsErrored: 0,
        newContracts: [],
        errorContracts: []
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return this.createFailedResult('api-scan', startTime, errorMessage);
    }
  }

  /**
   * Search for contracts implementing a specific trait using the Hiro API
   */
  private async searchContractsByTrait(params: TraitSearchParams): Promise<DiscoveredContract[]> {
    const allContracts: DiscoveredContract[] = [];

    if (this.config.debug) {
      console.log(`🔍 Searching for contracts implementing trait: ${params.trait.name}`);
    }

    try {
      // Configure search parameters
      const searchConfig: TraitSearchConfig = {
        apiKey: this.config.apiKey,
        debug: this.config.debug
      };

      // Use the polyglot function to search for contracts by trait
      const foundContracts = await searchContractsByTrait(
        params.trait,
        searchConfig,
        params.blacklist || this.config.blacklist,
        this.config.maxContracts
      );

      if (this.config.debug) {
        console.log(`📊 Found ${foundContracts.length} contracts from API`);
      }

      // Convert API results to DiscoveredContract format
      for (const contract of foundContracts) {
        allContracts.push({
          contract_id: contract.contract_id,
          tx_id: contract.tx_id,
          block_height: contract.block_height,
          clarity_version: contract.clarity_version?.toString(),
          discoveryMethod: 'trait-search',
          discoveredAt: Date.now()
        });

        if (this.config.debug) {
          console.log(`✅ Found trait implementation: ${contract.contract_id}`);
        }
      }

    } catch (error) {
      if (this.config.debug) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`❌ Error searching contracts by trait: ${errorMessage}`);
      }

      // Return empty array on error - let the caller handle the failure
      return [];
    }

    if (this.config.debug) {
      console.log(`📊 Search complete: ${allContracts.length} contracts found`);
    }

    // Deduplicate contracts to ensure we only keep the most recent deployment of each contract
    const deduplicatedContracts = this.deduplicateContracts(allContracts);
    
    if (this.config.debug && deduplicatedContracts.length !== allContracts.length) {
      console.log(`🔧 Deduplicated ${allContracts.length} contracts to ${deduplicatedContracts.length}`);
    }

    return deduplicatedContracts;
  }


  /**
   * Deduplicate contracts, keeping only the one with highest block height for each contract ID
   */
  private deduplicateContracts(contracts: DiscoveredContract[]): DiscoveredContract[] {
    const contractsMap = new Map<string, DiscoveredContract>();

    contracts.forEach(contract => {
      const existing = contractsMap.get(contract.contract_id);

      // Keep the contract with the highest block height (most recent deployment)
      if (!existing || contract.block_height > existing.block_height) {
        contractsMap.set(contract.contract_id, contract);
      }
    });

    // Sort by block height (oldest first for consistent ordering)
    return Array.from(contractsMap.values())
      .sort((a, b) => a.block_height - b.block_height);
  }

  /**
   * Create an empty discovery result
   */
  private createEmptyResult(method: DiscoveryMethod, startTime: number, reason?: string): DiscoveryResult {
    return {
      success: true,
      method,
      timestamp: Date.now(),
      duration: Date.now() - startTime,
      contractsFound: 0,
      contractsProcessed: 0,
      contractsAdded: 0,
      contractsUpdated: 0,
      contractsSkipped: 0,
      contractsErrored: 0,
      newContracts: [],
      errorContracts: [],
      error: reason
    };
  }

  /**
   * Create a failed discovery result
   */
  private createFailedResult(method: DiscoveryMethod, startTime: number, error: string): DiscoveryResult {
    return {
      success: false,
      method,
      timestamp: Date.now(),
      duration: Date.now() - startTime,
      contractsFound: 0,
      contractsProcessed: 0,
      contractsAdded: 0,
      contractsUpdated: 0,
      contractsSkipped: 0,
      contractsErrored: 0,
      newContracts: [],
      errorContracts: [],
      error
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<TraitDiscoveryEngineConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): TraitDiscoveryEngineConfig {
    return { ...this.config };
  }

  /**
   * Add contracts to blacklist
   */
  addToBlacklist(contractIds: string[]): void {
    this.config.blacklist = [...this.config.blacklist, ...contractIds];
  }

  /**
   * Remove contracts from blacklist
   */
  removeFromBlacklist(contractIds: string[]): void {
    this.config.blacklist = this.config.blacklist.filter(id => !contractIds.includes(id));
  }

  /**
   * Get current blacklist
   */
  getBlacklist(): string[] {
    return [...this.config.blacklist];
  }
}
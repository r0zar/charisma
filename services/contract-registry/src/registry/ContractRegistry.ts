/**
 * ContractRegistry - Main orchestrator for contract registry service
 * 
 * Coordinates BlobStorage, IndexManager, TraitAnalyzer, and TraitDiscoveryEngine
 * to provide a comprehensive contract management system.
 */

import type {
  ContractMetadata,
  ContractType,
  DiscoveryMethod,
  ContractQuery,
  ContractSearchResponse,
  RegistryAPI,
  RegistryConfig,
  RegistryStats,
  RegistryHealthCheck,
  AddContractResult,
  UpdateContractResult,
  RemoveContractResult,
  SyncResult,
  RegistryOperationResult,
  DiscoveryOrchestrationConfig,
  DiscoveryOrchestrationResult,
  DiscoveryResult
} from '../types';

import { BlobStorage, type BlobStorageConfig } from '../storage/BlobStorage';
import { IndexManager, type IndexManagerConfig } from '../storage/IndexManager';
import { TraitAnalyzer, type TraitAnalyzerConfig } from '../analysis/TraitAnalyzer';
import { TraitDiscoveryEngine, type TraitDiscoveryEngineConfig } from '../discovery/TraitDiscoveryEngine';
import { mergeWithDefaults } from '../utils/config';
import { listTokens } from '@repo/tokens';

export interface ContractRegistryConfig extends RegistryConfig {
  blobStorage: Partial<BlobStorageConfig>;
  indexManager: Partial<IndexManagerConfig>;
  traitAnalyzer: Partial<TraitAnalyzerConfig>;
  discoveryEngine: Partial<TraitDiscoveryEngineConfig>;
}

export class ContractRegistry implements RegistryAPI {
  private config: RegistryConfig;
  private blobStorage: BlobStorage;
  private indexManager: IndexManager;
  private traitAnalyzer: TraitAnalyzer;
  private discoveryEngine: TraitDiscoveryEngine;

  constructor(config: ContractRegistryConfig) {
    // Merge user config with defaults
    this.config = mergeWithDefaults(config.serviceName, config);

    // Initialize storage layer
    this.blobStorage = new BlobStorage({
      serviceName: this.config.serviceName,
      pathPrefix: this.config.blobStoragePrefix,
      ...config.blobStorage
    });

    // Initialize index manager
    this.indexManager = new IndexManager({
      serviceName: this.config.serviceName,
      keyPrefix: `${this.config.serviceName}:`,
      ...config.indexManager
    });

    // Initialize trait analyzer
    this.traitAnalyzer = new TraitAnalyzer({
      timeout: this.config.analysisTimeout,
      enableSourceAnalysis: this.config.enableAnalysis,
      ...config.traitAnalyzer
    });

    // Initialize discovery engine
    this.discoveryEngine = new TraitDiscoveryEngine({
      timeout: this.config.analysisTimeout,
      debug: process.env.NODE_ENV === 'development',
      ...config.discoveryEngine
    });
  }

  // === Core Contract Operations ===

  /**
   * Get contract metadata (with auto-discovery if enabled)
   */
  async getContract(contractId: string): Promise<ContractMetadata | null> {
    try {
      // Set up auto-discovery callback if enabled
      const autoDiscoveryCallback = this.config.enableAutoDiscovery 
        ? async (contractId: string) => {
            console.log(`🔍 Auto-discovering contract: ${contractId}`);
            const addResult = await this.addContract(contractId);
            if (addResult.success && addResult.metadata) {
              console.log(`✅ Auto-discovery successful for ${contractId}`);
              return addResult.metadata;
            } else {
              console.warn(`⚠️ Auto-discovery failed for ${contractId}: ${addResult.error}`);
              return null;
            }
          }
        : undefined;

      // Use BlobStorage with auto-discovery callback
      return await this.blobStorage.getContract(contractId, autoDiscoveryCallback);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to get contract ${contractId}:`, errorMessage);
      return null;
    }
  }

  /**
   * Add contract to registry with full analysis
   */
  async addContract(contractId: string): Promise<AddContractResult> {
    const startTime = Date.now();

    try {
      // Check if contract already exists
      const existing = await this.blobStorage.hasContract(contractId);
      if (existing) {
        const metadata = await this.blobStorage.getContract(contractId);
        if (metadata) {
          // Check if existing contract needs analysis
          const needsAnalysis = this.config.enableAnalysis &&
            (!metadata.sourceCode || !metadata.abi || !metadata.lastAnalyzed);

          if (needsAnalysis) {
            // Re-analyze existing contract that lacks full analysis
            try {
              const analysis = await this.traitAnalyzer.analyzeContract(contractId);

              // Update metadata with analysis results
              const updatedMetadata: ContractMetadata = {
                ...metadata,
                contractType: analysis.contractType,
                implementedTraits: analysis.implementedTraits,
                sourceCode: analysis.sourceCode,
                abi: analysis.abi,
                parsedAbi: analysis.parsedAbi,
                clarityVersion: analysis.clarityVersion,
                sourceMetadata: analysis.sourceMetadata,
                discoveryMethod: metadata.discoveryMethod || 'trait-search', // Preserve or set discovery method
                lastAnalyzed: Date.now(),
                lastUpdated: Date.now()
              };

              // Store updated metadata
              await this.blobStorage.putContract(contractId, updatedMetadata);
              await this.indexManager.addToIndexes(contractId, updatedMetadata);

              // Update analysis timestamp
              await this.indexManager.updateAnalysisTimestamp();

              return {
                success: true,
                timestamp: Date.now(),
                duration: Date.now() - startTime,
                contractId,
                wasExisting: true,
                wasAnalyzed: true,
                metadata: updatedMetadata
              };
            } catch (error) {
              // If analysis fails, just ensure indexing and continue
              await this.indexManager.addToIndexes(contractId, metadata);
            }
          } else {
            // Contract exists and is fully analyzed, just ensure it's indexed
            await this.indexManager.addToIndexes(contractId, metadata);
          }
        }
        return {
          success: true,
          timestamp: Date.now(),
          duration: Date.now() - startTime,
          contractId,
          wasExisting: true,
          metadata: metadata || undefined
        };
      }

      // Analyze contract if analysis is enabled
      let metadata: ContractMetadata;
      if (this.config.enableAnalysis) {
        const analysis = await this.traitAnalyzer.analyzeContract(contractId);

        metadata = {
          contractId,
          contractAddress: contractId.split('.')[0],
          contractName: contractId.split('.')[1],
          blockHeight: analysis.deploymentInfo.blockHeight,
          txId: analysis.deploymentInfo.txId,
          deployedAt: Date.now(), // TODO: Get actual deployment timestamp
          contractType: analysis.contractType,
          implementedTraits: analysis.implementedTraits,
          sourceCode: analysis.sourceCode,
          abi: analysis.abi,
          parsedAbi: analysis.parsedAbi,
          clarityVersion: analysis.clarityVersion,
          sourceMetadata: analysis.sourceMetadata,
          discoveryMethod: 'manual',
          discoveredAt: Date.now(),
          lastAnalyzed: Date.now(),
          lastUpdated: Date.now(),
          validationStatus: 'valid'
        };

        // Update analysis timestamp after successful analysis
        await this.indexManager.updateAnalysisTimestamp();
      } else {
        // Minimal metadata if analysis is disabled
        metadata = {
          contractId,
          contractAddress: contractId.split('.')[0],
          contractName: contractId.split('.')[1],
          blockHeight: 0,
          txId: '',
          deployedAt: Date.now(),
          contractType: 'unknown',
          implementedTraits: [],
          sourceCode: '',
          abi: '',
          discoveryMethod: 'manual',
          discoveredAt: Date.now(),
          lastAnalyzed: Date.now(),
          lastUpdated: Date.now(),
          validationStatus: 'pending'
        };
      }

      // Store metadata
      await this.blobStorage.putContract(contractId, metadata);

      // Update indexes
      await this.indexManager.addToIndexes(contractId, metadata);

      return {
        success: true,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        contractId,
        wasExisting: false,
        metadata
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        error: errorMessage
      };
    }
  }

  /**
   * Update contract metadata
   */
  async updateContract(contractId: string, updates: Partial<ContractMetadata>): Promise<UpdateContractResult> {
    const startTime = Date.now();

    try {
      const existing = await this.blobStorage.getContract(contractId);
      if (!existing) {
        return {
          success: false,
          timestamp: Date.now(),
          duration: Date.now() - startTime,
          error: `Contract ${contractId} not found`
        };
      }

      // Merge updates with existing metadata
      const updatedMetadata: ContractMetadata = {
        ...existing,
        ...updates,
        lastUpdated: Date.now()
      };

      // Store updated metadata
      await this.blobStorage.putContract(contractId, updatedMetadata);

      // Update indexes
      await this.indexManager.updateIndexes(contractId, existing, updatedMetadata);

      return {
        success: true,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        contractId,
        updatedFields: Object.keys(updates),
        previousMetadata: existing,
        newMetadata: updatedMetadata
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        error: errorMessage
      };
    }
  }

  /**
   * Remove contract from registry
   */
  async removeContract(contractId: string): Promise<RemoveContractResult> {
    const startTime = Date.now();

    try {
      const existing = await this.blobStorage.getContract(contractId);

      // Remove from blob storage
      await this.blobStorage.removeContract(contractId);

      // Remove from indexes
      await this.indexManager.removeFromIndexes(contractId, existing || undefined);

      return {
        success: true,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        contractId,
        wasRemoved: !!existing
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        error: errorMessage
      };
    }
  }

  // === Query Operations ===

  /**
   * Get all contract IDs
   */
  async getAllContracts(): Promise<string[]> {
    return await this.indexManager.getAllContracts();
  }

  /**
   * Get contracts by type
   */
  async getContractsByType(type: ContractType): Promise<string[]> {
    return await this.indexManager.getContractsByType(type);
  }

  /**
   * Get contracts implementing a specific trait
   */
  async getContractsByTrait(trait: string): Promise<string[]> {
    return await this.indexManager.getContractsByTrait(trait);
  }

  /**
   * Get contracts by discovery method
   */
  async getContractsByDiscovery(method: DiscoveryMethod): Promise<string[]> {
    return await this.indexManager.getContractsByDiscovery(method);
  }

  /**
   * Get fungible token contracts (SIP010 tokens)
   * Uses consolidated blob for better performance when available
   */
  async getFungibleTokens(): Promise<ContractMetadata[]> {
    try {
      // Try to use consolidated blob first for better performance
      const consolidatedManager = this.blobStorage.getConsolidatedBlobManager(this.indexManager);
      const consolidatedBlob = await consolidatedManager.loadConsolidatedBlob();
      
      if (consolidatedBlob) {
        console.log(`[ContractRegistry] Using consolidated blob for getFungibleTokens (${consolidatedBlob.contractCount} contracts)`);
        const tokens: ContractMetadata[] = [];
        
        // Filter tokens from consolidated blob
        for (const [contractId, metadata] of Object.entries(consolidatedBlob.contracts)) {
          const typedMetadata = metadata as ContractMetadata;
          if (typedMetadata.contractType === 'token') {
            tokens.push(typedMetadata);
          }
        }
        
        console.log(`[ContractRegistry] Found ${tokens.length} fungible tokens from consolidated blob`);
        return tokens;
      }
    } catch (error) {
      console.warn('[ContractRegistry] Failed to load consolidated blob, falling back to individual fetches:', error);
    }

    // Fallback to individual contract fetches
    console.log('[ContractRegistry] Using fallback method for getFungibleTokens');
    const tokenIds = await this.getContractsByType('token');
    const result = await this.getContracts(tokenIds);
    return result.successful.map(item => item.metadata);
  }

  /**
   * Get non-fungible token contracts (SIP009 NFTs)
   * Uses consolidated blob for better performance when available
   */
  async getNonFungibleTokens(): Promise<ContractMetadata[]> {
    try {
      // Try to use consolidated blob first for better performance
      const consolidatedManager = this.blobStorage.getConsolidatedBlobManager(this.indexManager);
      const consolidatedBlob = await consolidatedManager.loadConsolidatedBlob();
      
      if (consolidatedBlob) {
        console.log(`[ContractRegistry] Using consolidated blob for getNonFungibleTokens (${consolidatedBlob.contractCount} contracts)`);
        const nfts: ContractMetadata[] = [];
        
        // Filter NFTs from consolidated blob
        for (const [contractId, metadata] of Object.entries(consolidatedBlob.contracts)) {
          const typedMetadata = metadata as ContractMetadata;
          if (typedMetadata.contractType === 'nft') {
            nfts.push(typedMetadata);
          }
        }
        
        console.log(`[ContractRegistry] Found ${nfts.length} non-fungible tokens from consolidated blob`);
        return nfts;
      }
    } catch (error) {
      console.warn('[ContractRegistry] Failed to load consolidated blob, falling back to individual fetches:', error);
    }

    // Fallback to individual contract fetches
    console.log('[ContractRegistry] Using fallback method for getNonFungibleTokens');
    const nftIds = await this.getContractsByType('nft');
    const result = await this.getContracts(nftIds);
    return result.successful.map(item => item.metadata);
  }

  /**
   * Get multiple contracts by ID with optimized bulk retrieval (with auto-discovery)
   * Uses high-performance parallel processing optimized for Vercel Pro plan limits
   */
  async getContracts(contractIds: string[], maxConcurrency?: number): Promise<{
    successful: { contractId: string; metadata: ContractMetadata }[];
    failed: { contractId: string; error: string }[];
  }> {
    // Set up auto-discovery callback for BlobStorage if enabled
    const autoDiscoveryCallback = this.config.enableAutoDiscovery 
      ? async (contractId: string) => {
          console.log(`🔍 Auto-discovering contract: ${contractId}`);
          const addResult = await this.addContract(contractId);
          if (addResult.success && addResult.metadata) {
            console.log(`✅ Auto-discovery successful for ${contractId}`);
            return addResult.metadata;
          } else {
            console.warn(`⚠️ Auto-discovery failed for ${contractId}: ${addResult.error}`);
            return null;
          }
        }
      : undefined;

    return await this.blobStorage.getContracts(contractIds, maxConcurrency, autoDiscoveryCallback);
  }

  /**
   * Search contracts with complex queries
   */
  async searchContracts(query: ContractQuery): Promise<ContractSearchResponse> {
    const startTime = Date.now();

    try {
      // Start with all contracts or filter by criteria
      let contractIds: string[] = [];

      if (query.contractType) {
        contractIds = await this.indexManager.getContractsByType(query.contractType);
      } else if (query.implementedTraits && query.implementedTraits.length > 0) {
        contractIds = await this.indexManager.getContractsByTraits(query.implementedTraits);
      } else if (query.validationStatus) {
        contractIds = await this.indexManager.getContractsByStatus(query.validationStatus);
      } else if (query.discoveryMethod) {
        contractIds = await this.indexManager.getContractsByDiscovery(query.discoveryMethod);
      } else {
        contractIds = await this.indexManager.getAllContracts();
      }

      // Apply additional filters
      if (query.discoveredAfter || query.discoveredBefore) {
        // TODO: Implement date-based filtering (would require additional indexes)
      }

      // Apply pagination to contract IDs
      const offset = query.offset || 0;
      const limit = query.limit || 50;
      const total = contractIds.length;
      const paginatedIds = contractIds.slice(offset, offset + limit);

      // Fetch metadata for paginated results only
      const bulkResult = await this.blobStorage.getContracts(paginatedIds, 3);
      const paginatedContracts = bulkResult.successful.map(result => result.metadata);

      return {
        contracts: paginatedContracts,
        total,
        offset,
        limit,
        queryTime: Date.now() - startTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Search contracts failed:', errorMessage);
      return {
        contracts: [],
        total: 0,
        offset: query.offset || 0,
        limit: query.limit || 50,
        queryTime: Date.now() - startTime
      };
    }
  }

  // === Discovery Operations ===

  /**
   * Discover new contracts using all available methods
   */
  async discoverNewContracts(): Promise<DiscoveryOrchestrationResult> {
    if (!this.config.enableDiscovery) {
      return {
        success: false,
        timestamp: Date.now(),
        duration: 0,
        totalContractsFound: 0,
        totalContractsProcessed: 0,
        totalContractsAdded: 0,
        results: [],
        errors: ['Discovery is disabled']
      };
    }

    // Use default discovery configuration for backward compatibility
    const defaultConfig: DiscoveryOrchestrationConfig = {
      traits: [
        {
          trait: {
            name: 'Transfer Function',
            description: 'Basic transfer function trait',
            functions: [
              {
                name: "transfer",
                access: "public",
                args: [
                  { name: "amount", type: "uint128" },
                  { name: "sender", type: "principal" },
                  { name: "recipient", type: "principal" },
                  { name: "memo", type: { optional: { buffer: { length: 34 } } } }
                ],
                outputs: {
                  type: {
                    response: {
                      ok: "bool",
                      error: "uint128"
                    }
                  }
                }
              }
            ]
          },
          enabled: true,
          priority: 1,
          batchSize: 10
        }
      ],
      sipStandards: [
        {
          sipNumber: 'SIP010',
          trait: {
            name: 'SIP010',
            description: 'Standard Fungible Token (SIP010)',
            functions: [
              // Using minimal syntax for trait discovery - args: [] required even when empty
              { name: "transfer", access: "public", args: [] },
              { name: "get-name", access: "read_only", args: [] },
              { name: "get-symbol", access: "read_only", args: [] },
              { name: "get-decimals", access: "read_only", args: [] },
              { name: "get-balance", access: "read_only", args: [] }, // Minimal - don't specify account param
              { name: "get-total-supply", access: "read_only", args: [] }
            ]
          },
          enabled: true
        },
        {
          sipNumber: 'SIP009',
          trait: {
            name: 'SIP009',
            description: 'Standard Non-Fungible Token (SIP009)',
            functions: [
              // Using minimal syntax for trait discovery - args: [] required for pattern matching
              // Actual compliance validation happens separately via ABI analysis
              { name: "get-last-token-id", access: "read_only", args: [] },
              { name: "get-token-uri", access: "read_only", args: [] },
              { name: "get-owner", access: "read_only", args: [] },
              { name: "transfer", access: "public", args: [] }
            ]
          },
          enabled: true
        }
      ],
      apiScan: {
        enabled: false,
        batchSize: 50,
        maxRetries: 3,
        retryDelay: 1000,
        timeout: 30000,
        blacklist: []
      }
    };

    return await this.discoverContracts(defaultConfig);
  }

  /**
   * Discover contracts using specified configuration
   */
  async discoverContracts(config: DiscoveryOrchestrationConfig): Promise<DiscoveryOrchestrationResult> {
    const startTime = Date.now();
    const results: DiscoveryResult[] = [];
    const errors: string[] = [];

    try {
      // Execute trait-based discovery
      if (config.traits) {
        for (const traitConfig of config.traits) {
          try {
            const result = await this.discoveryEngine.discoverByTrait(traitConfig);
            console.log(`✅ Trait discovery for "${traitConfig.trait.name}" completed: Found ${result.contractsFound} contracts`);
            results.push(result);

            // Store discovered contracts
            for (const contractId of result.newContracts) {
              try {
                await this.addContract(contractId);
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                errors.push(`Failed to add contract ${contractId}: ${errorMessage}`);
              }
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            errors.push(`Trait discovery failed: ${errorMessage}`);
          }
        }
      }

      // Execute SIP standard discovery
      if (config.sipStandards) {
        for (const sipConfig of config.sipStandards) {
          try {
            const result = await this.discoveryEngine.discoverBySipStandard(sipConfig);
            results.push(result);

            // Store discovered contracts
            for (const contractId of result.newContracts) {
              try {
                await this.addContract(contractId);
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                errors.push(`Failed to add contract ${contractId}: ${errorMessage}`);
              }
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            errors.push(`SIP discovery failed: ${errorMessage}`);
          }
        }
      }

      // Execute API scan discovery
      if (config.apiScan && config.apiScan.enabled) {
        try {
          const result = await this.discoveryEngine.discoverByApiScan(config.apiScan);
          results.push(result);

          // Store discovered contracts
          for (const contractId of result.newContracts) {
            try {
              await this.addContract(contractId);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              errors.push(`Failed to add contract ${contractId}: ${errorMessage}`);
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push(`API scan failed: ${errorMessage}`);
        }
      }

      // Calculate totals
      const totalContractsFound = results.reduce((sum, result) => sum + result.contractsFound, 0);
      const totalContractsProcessed = results.reduce((sum, result) => sum + result.contractsProcessed, 0);
      const totalContractsAdded = results.reduce((sum, result) => sum + result.contractsAdded, 0);

      // Update discovery timestamp if we found any contracts
      if (totalContractsFound > 0) {
        await this.indexManager.updateDiscoveryTimestamp();
      }

      return {
        success: true,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        totalContractsFound,
        totalContractsProcessed,
        totalContractsAdded,
        results,
        errors
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Discovery orchestration failed: ${errorMessage}`);

      return {
        success: false,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        totalContractsFound: 0,
        totalContractsProcessed: 0,
        totalContractsAdded: 0,
        results,
        errors
      };
    }
  }

  /**
   * Analyze a specific contract
   */
  async analyzeContract(contractId: string): Promise<any> {
    if (!this.config.enableAnalysis) {
      return { success: false, error: 'Analysis is disabled' };
    }

    try {
      const analysis = await this.traitAnalyzer.analyzeContract(contractId);

      // Update analysis timestamp after successful analysis
      await this.indexManager.updateAnalysisTimestamp();

      return { success: true, analysis };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Sync with token cache from @repo/tokens
   */
  async syncWithTokenCache(): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      // Get all tokens from the token cache
      const tokens = await listTokens();

      let added = 0;
      let updated = 0;
      let skipped = 0;
      let errors = 0;
      const newContracts: string[] = [];
      const updatedContracts: string[] = [];
      const errorContracts: { contractId: string; error: string }[] = [];

      for (const token of tokens) {
        if (!token.contractId || !token.contractId.includes('.')) {
          skipped++;
          continue;
        }

        try {
          const existing = await this.blobStorage.hasContract(token.contractId);

          if (!existing) {
            // Add new contract
            const result = await this.addContract(token.contractId);
            if (result.success) {
              added++;
              newContracts.push(token.contractId);
            } else {
              errors++;
              errorContracts.push({ contractId: token.contractId, error: result.error || 'Unknown error' });
            }
          } else {
            // Update existing contract with token metadata
            const result = await this.updateContract(token.contractId, {
              tokenMetadata: token,
              lastUpdated: Date.now()
            });
            if (result.success) {
              updated++;
              updatedContracts.push(token.contractId);
            } else {
              errors++;
              errorContracts.push({ contractId: token.contractId, error: result.error || 'Unknown error' });
            }
          }
        } catch (error) {
          errors++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          errorContracts.push({ contractId: token.contractId, error: errorMessage });
        }
      }

      return {
        success: true,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        source: '@repo/tokens',
        totalProcessed: tokens.length,
        added,
        updated,
        skipped,
        errors,
        newContracts,
        updatedContracts,
        errorContracts
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        source: '@repo/tokens',
        totalProcessed: 0,
        added: 0,
        updated: 0,
        skipped: 0,
        errors: 1,
        error: errorMessage
      };
    }
  }

  // === Management Operations ===

  /**
   * Block a contract
   */
  async blockContract(contractId: string, reason: string): Promise<RegistryOperationResult> {
    const startTime = Date.now();

    try {
      const existing = await this.blobStorage.getContract(contractId);
      if (!existing) {
        return {
          success: false,
          timestamp: Date.now(),
          duration: Date.now() - startTime,
          error: `Contract ${contractId} not found`
        };
      }

      // Update metadata with blocked status
      const updates: Partial<ContractMetadata> = {
        validationStatus: 'blocked',
        blocked: {
          reason,
          blockedAt: Date.now(),
          blockedBy: 'system' // TODO: Add actual user context
        }
      };

      await this.updateContract(contractId, updates);
      await this.indexManager.blockContract(contractId);

      return {
        success: true,
        timestamp: Date.now(),
        duration: Date.now() - startTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        error: errorMessage
      };
    }
  }

  /**
   * Unblock a contract
   */
  async unblockContract(contractId: string): Promise<RegistryOperationResult> {
    const startTime = Date.now();

    try {
      const existing = await this.blobStorage.getContract(contractId);
      if (!existing) {
        return {
          success: false,
          timestamp: Date.now(),
          duration: Date.now() - startTime,
          error: `Contract ${contractId} not found`
        };
      }

      // Remove blocked status
      const updates: Partial<ContractMetadata> = {
        validationStatus: 'valid',
        blocked: undefined
      };

      await this.updateContract(contractId, updates);
      await this.indexManager.unblockContract(contractId);

      return {
        success: true,
        timestamp: Date.now(),
        duration: Date.now() - startTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
        error: errorMessage
      };
    }
  }

  /**
   * Check if contract is blocked
   */
  async isBlocked(contractId: string): Promise<boolean> {
    return await this.indexManager.isBlocked(contractId);
  }

  // === Stats and Health ===

  /**
   * Calculate analysis time metrics from contract metadata
   * Optimized version that only samples a small subset to avoid timeouts
   */
  private async calculateAnalysisMetrics(): Promise<{ totalTime: number; averageTime: number }> {
    try {
      // Get all contracts to calculate analysis times
      const allContractIds = await this.indexManager.getAllContracts();

      if (allContractIds.length === 0) {
        return { totalTime: 0, averageTime: 0 };
      }

      // Use a much smaller sample to avoid timeouts (max 10 contracts)
      const sampleSize = Math.min(10, allContractIds.length);
      const sampleContracts = allContractIds.slice(0, sampleSize);

      let totalAnalysisTime = 0;
      let contractsWithAnalysisTime = 0;

      // Use optimized bulk retrieval with controlled concurrency
      const bulkResult = await this.blobStorage.getContracts(sampleContracts, 5);
      const results = [];

      for (const { metadata } of bulkResult.successful) {
        if (metadata && metadata.lastAnalyzed && metadata.discoveredAt) {
          const analysisTime = metadata.lastAnalyzed - metadata.discoveredAt;
          if (analysisTime > 0 && analysisTime < 300000) { // Reasonable analysis time (< 5 mins)
            results.push({ analysisTime, valid: true });
          } else {
            results.push({ analysisTime: 0, valid: false });
          }
        } else {
          results.push({ analysisTime: 0, valid: false });
        }
      }

      // Add failed contracts as invalid results
      for (let i = 0; i < bulkResult.failed.length; i++) {
        results.push({ analysisTime: 0, valid: false });
      }

      for (const result of results) {
        if (result.valid) {
          totalAnalysisTime += result.analysisTime;
          contractsWithAnalysisTime++;
        }
      }

      const averageTime = contractsWithAnalysisTime > 0
        ? Math.round(totalAnalysisTime / contractsWithAnalysisTime)
        : 0;

      // Extrapolate total time based on sample
      const estimatedTotalTime = contractsWithAnalysisTime > 0
        ? Math.round((totalAnalysisTime / sampleSize) * allContractIds.length)
        : 0;

      return {
        totalTime: estimatedTotalTime,
        averageTime
      };
    } catch (error) {
      console.warn('Failed to calculate analysis metrics:', error);
      return { totalTime: 0, averageTime: 0 };
    }
  }

  /**
   * Get the blob storage instance for advanced operations
   */
  getBlobStorage(): BlobStorage {
    return this.blobStorage;
  }

  /**
   * Get registry statistics
   */
  async getStats(): Promise<RegistryStats> {
    try {
      const blobStats = await this.blobStorage.getStats();
      const indexStats = await this.indexManager.getStats();

      // Get categorical data from indexes in parallel
      const [
        tokenContracts,
        nftContracts,
        vaultContracts,
        unknownContracts,
        validContracts,
        invalidContracts,
        blockedContracts,
        pendingContracts,
        lastDiscovery,
        lastAnalysis
      ] = await Promise.all([
        this.indexManager.getContractsByType('token'),
        this.indexManager.getContractsByType('nft'),
        this.indexManager.getContractsByType('vault'),
        this.indexManager.getContractsByType('unknown'),
        this.indexManager.getContractsByStatus('valid'),
        this.indexManager.getContractsByStatus('invalid'),
        this.indexManager.getContractsByStatus('blocked'),
        this.indexManager.getContractsByStatus('pending'),
        this.indexManager.getDiscoveryTimestamp(),
        this.indexManager.getAnalysisTimestamp()
      ]);

      // Calculate analysis time metrics
      const analysisMetrics = await this.calculateAnalysisMetrics();

      return {
        totalContracts: blobStats.totalContracts,
        contractsByType: {
          token: tokenContracts.length,
          nft: nftContracts.length,
          vault: vaultContracts.length,
          unknown: unknownContracts.length
        },
        contractsByStatus: {
          valid: validContracts.length,
          invalid: invalidContracts.length,
          blocked: blockedContracts.length,
          pending: pendingContracts.length
        },
        blockedContracts: blockedContracts.length,
        lastDiscovery,
        lastAnalysis,
        totalAnalysisTime: analysisMetrics.totalTime,
        averageAnalysisTime: analysisMetrics.averageTime,
        cacheHitRate: indexStats.hitRate
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to get registry stats:', errorMessage);

      return {
        totalContracts: 0,
        contractsByType: { token: 0, nft: 0, vault: 0, unknown: 0 },
        contractsByStatus: { valid: 0, invalid: 0, blocked: 0, pending: 0 },
        blockedContracts: 0,
        lastDiscovery: 0,
        lastAnalysis: 0,
        totalAnalysisTime: 0,
        averageAnalysisTime: 0,
        cacheHitRate: 0
      };
    }
  }

  /**
   * Get registry health status
   */
  async getHealth(): Promise<RegistryHealthCheck> {
    const issues: string[] = [];

    try {
      // Check blob storage
      const blobStats = await this.blobStorage.getStats();
      const blobHealthy = blobStats.totalContracts >= 0;

      // Check KV indexes
      const indexStats = await this.indexManager.getStats();
      const indexHealthy = indexStats.totalIndexes >= 0;

      // Check analyzer (basic check)
      const analyzerHealthy = this.config.enableAnalysis;

      // Check discovery engine (basic check)
      const discoveryHealthy = this.config.enableDiscovery;

      if (!blobHealthy) issues.push('Blob storage not responding');
      if (!indexHealthy) issues.push('KV indexes not responding');

      return {
        healthy: issues.length === 0,
        components: {
          blobStorage: blobHealthy,
          kvIndexes: indexHealthy,
          analyzer: analyzerHealthy,
          discovery: discoveryHealthy
        },
        lastCheck: Date.now(),
        issues: issues.length > 0 ? issues : undefined
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        healthy: false,
        components: {
          blobStorage: false,
          kvIndexes: false,
          analyzer: false,
          discovery: false
        },
        lastCheck: Date.now(),
        issues: [`Health check failed: ${errorMessage}`]
      };
    }
  }
}
/**
 * Registry operation types and configuration interfaces
 */

import type { ContractMetadata, ContractType, DiscoveryMethod, ValidationStatus, ContractQuery, ContractSearchResponse } from './contract-types';

// Registry configuration
export interface RegistryConfig {
  serviceName: string;
  enableAnalysis: boolean;
  enableDiscovery: boolean;
  enableAutoDiscovery?: boolean; // Auto-discover contracts when requested but not found
  blobStoragePrefix: string;
  analysisTimeout: number; // Analysis timeout in milliseconds
}

// Registry statistics
export interface RegistryStats {
  totalContracts: number;
  contractsByType: Record<ContractType, number>;
  contractsByStatus: Record<ValidationStatus, number>;
  blockedContracts: number;
  lastDiscovery: number;
  lastAnalysis: number;
  totalAnalysisTime: number;
  averageAnalysisTime: number;
  cacheHitRate: number;
}

// Registry operation result base
export interface RegistryOperationResult {
  success: boolean;
  error?: string;
  timestamp: number;
  duration: number;
}

// Contract addition result
export interface AddContractResult extends RegistryOperationResult {
  contractId?: string;
  wasExisting?: boolean;
  wasAnalyzed?: boolean;
  metadata?: ContractMetadata;
}

// Contract removal result
export interface RemoveContractResult extends RegistryOperationResult {
  contractId?: string;
  wasRemoved?: boolean;
}

// Contract update result
export interface UpdateContractResult extends RegistryOperationResult {
  contractId?: string;
  updatedFields?: string[];
  previousMetadata?: ContractMetadata;
  newMetadata?: ContractMetadata;
}

// Bulk operation result
export interface BulkOperationResult extends RegistryOperationResult {
  totalRequested: number;
  successful: number;
  failed: number;
  failedContracts?: { contractId: string; error: string }[];
}

// Registry sync result (for token cache migration)
export interface SyncResult extends RegistryOperationResult {
  source: string;
  totalProcessed: number;
  added: number;
  updated: number;
  skipped: number;
  errors: number;
  newContracts?: string[];
  updatedContracts?: string[];
  errorContracts?: { contractId: string; error: string }[];
}

// Index operation result
export interface IndexOperationResult extends RegistryOperationResult {
  indexType: string;
  operation: 'add' | 'remove' | 'update' | 'rebuild';
  affectedCount?: number;
}

// Registry health check result
export interface RegistryHealthCheck {
  healthy: boolean;
  components: {
    blobStorage: boolean;
    kvIndexes: boolean;
    analyzer: boolean;
    discovery: boolean;
  };
  lastCheck: number;
  issues?: string[];
}

// Registry API interface
export interface RegistryAPI {
  // Core contract operations
  getContract(contractId: string): Promise<ContractMetadata | null>;
  addContract(contractId: string): Promise<AddContractResult>;
  updateContract(contractId: string, updates: Partial<ContractMetadata>): Promise<UpdateContractResult>;
  removeContract(contractId: string): Promise<RemoveContractResult>;

  // Query operations
  getAllContracts(): Promise<string[]>;
  getContractsByType(type: ContractType): Promise<string[]>;
  getContractsByTrait(trait: string): Promise<string[]>;
  getContractsByDiscovery(method: DiscoveryMethod): Promise<string[]>;
  getFungibleTokens(): Promise<ContractMetadata[]>;
  getNonFungibleTokens(): Promise<ContractMetadata[]>;
  searchContracts(query: ContractQuery): Promise<ContractSearchResponse>;

  // Discovery operations
  discoverNewContracts(): Promise<any>;
  analyzeContract(contractId: string): Promise<any>;
  syncWithTokenCache(): Promise<SyncResult>;

  // Management operations
  blockContract(contractId: string, reason: string): Promise<RegistryOperationResult>;
  unblockContract(contractId: string): Promise<RegistryOperationResult>;
  isBlocked(contractId: string): Promise<boolean>;

  // Stats and health
  getStats(): Promise<RegistryStats>;
  getHealth(): Promise<RegistryHealthCheck>;
}

// Configuration defaults
export const DEFAULT_REGISTRY_CONFIG: RegistryConfig = {
  serviceName: 'contract-registry',
  enableAnalysis: true,
  enableDiscovery: true,
  blobStoragePrefix: 'contracts/',
  analysisTimeout: 30 * 1000 // 30 seconds
};


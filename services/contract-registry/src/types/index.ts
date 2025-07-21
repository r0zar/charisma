/**
 * Contract Registry Types
 * Export all type definitions for the contract registry service
 */

// Core contract types
export type {
  ContractType,
  DiscoveryMethod,
  ValidationStatus,
  BlockedContractInfo,
  SourceMetadata,
  ContractMetadata,
  ContractAnalysis,
  ContractQuery,
  ContractUpdateRequest,
  TraitImplementation,
  ContractListResponse,
  ContractSearchResponse
} from './contract-types';

// Registry operation types
export type {
  RegistryConfig,
  RegistryStats,
  RegistryOperationResult,
  AddContractResult,
  RemoveContractResult,
  UpdateContractResult,
  BulkOperationResult,
  SyncResult,
  IndexOperationResult,
  RegistryHealthCheck,
  RegistryAPI
} from './registry-types';

export {
  DEFAULT_REGISTRY_CONFIG
} from './registry-types';

// Discovery types
export type {
  DiscoveryConfig,
  DiscoveryMethod as DiscoveryMethodType,
  DiscoverySource,
  DiscoveryResult,
  TraitDiscoveryConfig,
  SIPDiscoveryConfig,
  DiscoveryPlan,
  DiscoveryQueueItem,
  DiscoveryStatus,
  TraitMatchResult,
  DiscoveryStats,
  DiscoveryOrchestrationConfig,
  DiscoveryOrchestrationResult
} from './discovery-types';

export {
  DEFAULT_DISCOVERY_CONFIG,
  SIP_TRAITS
} from './discovery-types';
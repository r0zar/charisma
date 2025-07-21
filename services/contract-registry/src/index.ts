/**
 * @services/contract-registry
 * 
 * Comprehensive contract registry service for trait-aware contract management.
 * Provides contract discovery, analysis, storage, and fast lookups.
 */

// Main registry orchestrator
export { ContractRegistry } from './registry/ContractRegistry';
export type { ContractRegistryConfig } from './registry/ContractRegistry';

// Storage layer
export { BlobStorage } from './storage/BlobStorage';
export type { BlobStorageConfig, BlobStorageStats } from './storage/BlobStorage';

export { IndexManager } from './storage/IndexManager';
export type { IndexManagerConfig, IndexStats } from './storage/IndexManager';

// Analysis layer
export { TraitAnalyzer } from './analysis/TraitAnalyzer';
export type {
  TraitAnalyzerConfig,
  TraitDefinition,
  TraitValidationResult
} from './analysis/TraitAnalyzer';

// Discovery layer
export { TraitDiscoveryEngine } from './discovery/TraitDiscoveryEngine';
export type {
  TraitDiscoveryEngineConfig,
  DiscoveredContract,
  TraitSearchParams
} from './discovery/TraitDiscoveryEngine';

// All types and interfaces
export * from './types';

// Configuration utilities
export { createDefaultConfig, mergeWithDefaults } from './utils/config';
/**
 * Configuration utilities for the contract registry service
 */

import type { ContractRegistryConfig } from '../registry/ContractRegistry';

/**
 * Create default configuration for the contract registry
 */
export function createDefaultConfig(serviceName: string): ContractRegistryConfig {
  return {
    serviceName,
    enableAnalysis: true,
    enableDiscovery: true,
    enableAutoDiscovery: true, // Enable auto-discovery by default
    blobStoragePrefix: 'contracts/',
    analysisTimeout: 30 * 1000, // 30 seconds
    blobStorage: {
      enforcementLevel: 'warn'
    },
    indexManager: {},
    traitAnalyzer: {
      enableSourceAnalysis: true,
      enableRuntimeCheck: false
    },
    discoveryEngine: {
      debug: process.env.NODE_ENV === 'development',
      batchSize: 50,
      maxRetries: 3,
      blacklist: []
    }
  };
}

/**
 * Merge user configuration with defaults
 */
export function mergeWithDefaults(serviceName: string, userConfig: Partial<ContractRegistryConfig> = {}): ContractRegistryConfig {
  const defaults = createDefaultConfig(serviceName);
  
  return {
    ...defaults,
    ...userConfig,
    // Deep merge nested objects
    blobStorage: {
      ...defaults.blobStorage,
      ...userConfig.blobStorage
    },
    indexManager: {
      ...defaults.indexManager,
      ...userConfig.indexManager
    },
    traitAnalyzer: {
      ...defaults.traitAnalyzer,
      ...userConfig.traitAnalyzer
    },
    discoveryEngine: {
      ...defaults.discoveryEngine,
      ...userConfig.discoveryEngine
    }
  };
}
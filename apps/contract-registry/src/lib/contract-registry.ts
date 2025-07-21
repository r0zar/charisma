/**
 * Contract Registry Client
 * 
 * Client wrapper for the @services/contract-registry service
 */

import { ContractRegistry, createDefaultConfig, type DiscoveryMethod } from '@services/contract-registry';

let registryInstance: ContractRegistry | null = null;

/**
 * Get or create a contract registry instance
 */
export function getContractRegistry(): ContractRegistry {
  if (!registryInstance) {
    // Use the same config factory as the working service test script
    const config = createDefaultConfig('mainnet-contract-registry');
    registryInstance = new ContractRegistry(config);
  }
  return registryInstance;
}

/**
 * Re-export types from the service for consistency
 */
export type {
  RegistryStats,
  RegistryHealthCheck,
  BlobStorageStats,
  IndexStats,
  ContractMetadata,
  ContractQuery,
  ContractSearchResponse,
  DiscoveryMethod
} from '@services/contract-registry';

/**
 * UI-specific stats interfaces that transform service data
 */
export interface UIRegistryStats {
  totalContracts: number;
  contractsByType: {
    token: number;
    nft: number;
    vault: number;
    unknown: number;
  };
  validationStatus: {
    valid: number;
    invalid: number;
    blocked: number;
    pending: number;
  };
  recentAdditions: number;
}

export interface UIStorageStats {
  blobStorage: {
    totalSize: number;
    totalContracts: number;
    averageSize: number;
    largestContract: {
      contractId: string;
      size: number;
    } | null;
    compressionRatio: number;
    largeContractCount: number; // Contracts over 512MB (where Vercel Blob charges start)
    oversizedContracts: Array<{
      contractId: string;
      size: number;
    }>; // Contracts over 1GB (practically problematic)
  };
  indexStorage: {
    cacheHitRate: number;
    ttlStats: {
      avgTTL: number;
      totalKeys: number;
    };
  };
}

export interface UIDiscoveryStats {
  contractsByMethod: Record<string, number>;
  traitDistribution: Record<string, number>;
  successRate: number;
  avgDiscoveryTime: number;
}

export interface UIHealthStats {
  status: 'healthy' | 'warning' | 'error';
  apiResponseTime: number;
  errorRate: number;
  lastHealthCheck: number;
}

export interface AllStats {
  registry: UIRegistryStats;
  storage: UIStorageStats;
  discovery: UIDiscoveryStats;
  health: UIHealthStats;
}

/**
 * Validate and sanitize registry statistics to ensure data consistency
 */
function validateAndSanitizeStats(registryStats: any, blobStats: any) {
  const totalContracts = Math.max(0, registryStats.totalContracts || 0);
  const issues: string[] = [];

  // Validate contract type counts
  const typeStats = {
    token: Math.max(0, registryStats.contractsByType?.token || 0),
    nft: Math.max(0, registryStats.contractsByType?.nft || 0),
    vault: Math.max(0, registryStats.contractsByType?.vault || 0),
    unknown: Math.max(0, registryStats.contractsByType?.unknown || 0)
  };

  const typeSum = Object.values(typeStats).reduce((sum, count) => sum + count, 0);
  
  // Check for significant discrepancies (allow small differences due to race conditions)
  const typeDifference = Math.abs(typeSum - totalContracts);
  const discrepancyThreshold = Math.max(10, totalContracts * 0.01); // Allow 1% or 10 contracts difference
  
  if (typeDifference > discrepancyThreshold) {
    if (typeSum > totalContracts && totalContracts > 0) {
      issues.push(`Type counts (${typeSum}) exceed total contracts (${totalContracts}) by ${typeDifference}. Scaling down.`);
      const scaleFactor = totalContracts / typeSum;
      typeStats.token = Math.floor(typeStats.token * scaleFactor);
      typeStats.nft = Math.floor(typeStats.nft * scaleFactor);
      typeStats.vault = Math.floor(typeStats.vault * scaleFactor);
      typeStats.unknown = Math.max(0, totalContracts - typeStats.token - typeStats.nft - typeStats.vault);
    } else if (typeSum < totalContracts) {
      issues.push(`Type counts (${typeSum}) less than total contracts (${totalContracts}) by ${typeDifference}. Adding to unknown.`);
      typeStats.unknown += (totalContracts - typeSum);
    }
  }

  // Validate status counts
  const statusStats = {
    valid: Math.max(0, registryStats.contractsByStatus?.valid || 0),
    invalid: Math.max(0, registryStats.contractsByStatus?.invalid || 0),
    blocked: Math.max(0, registryStats.contractsByStatus?.blocked || 0),
    pending: Math.max(0, registryStats.contractsByStatus?.pending || 0)
  };

  const statusSum = Object.values(statusStats).reduce((sum, count) => sum + count, 0);

  // Check for significant status count discrepancies
  const statusDifference = Math.abs(statusSum - totalContracts);
  
  if (statusDifference > discrepancyThreshold) {
    if (statusSum > totalContracts && totalContracts > 0) {
      issues.push(`Status counts (${statusSum}) exceed total contracts (${totalContracts}) by ${statusDifference}. Scaling down.`);
      const scaleFactor = totalContracts / statusSum;
      statusStats.valid = Math.floor(statusStats.valid * scaleFactor);
      statusStats.invalid = Math.floor(statusStats.invalid * scaleFactor);
      statusStats.blocked = Math.floor(statusStats.blocked * scaleFactor);
      statusStats.pending = Math.max(0, totalContracts - statusStats.valid - statusStats.invalid - statusStats.blocked);
    } else if (statusSum < totalContracts) {
      issues.push(`Status counts (${statusSum}) less than total contracts (${totalContracts}) by ${statusDifference}. Adding to pending.`);
      statusStats.pending += (totalContracts - statusSum);
    }
  }

  // Validate cache hit rate (should be 0-1 ratio)
  let cacheHitRate = registryStats.cacheHitRate || 0;
  if (cacheHitRate > 1) {
    issues.push(`Cache hit rate (${cacheHitRate}) > 1. Converting to proper ratio.`);
    // If it's a percentage, convert to ratio
    if (cacheHitRate > 100) {
      cacheHitRate = Math.min(cacheHitRate / 10000, 1); // Handle cases like 5555.6
    } else {
      cacheHitRate = Math.min(cacheHitRate / 100, 1); // Convert percentage to ratio
    }
  }
  cacheHitRate = Math.min(Math.max(cacheHitRate, 0), 1); // Clamp to 0-1

  // Log data quality issues
  if (issues.length > 0) {
    console.warn('📊 Data quality issues detected:', issues);
    console.warn('Raw stats:', { 
      totalContracts, 
      rawTypeSum: Object.values(registryStats.contractsByType || {}).reduce((s: number, c) => s + (typeof c === 'number' ? c : 0), 0),
      rawStatusSum: Object.values(registryStats.contractsByStatus || {}).reduce((s: number, c) => s + (typeof c === 'number' ? c : 0), 0),
      rawCacheHitRate: registryStats.cacheHitRate
    });
  }

  return {
    totalContracts,
    contractsByType: typeStats,
    contractsByStatus: statusStats,
    cacheHitRate,
    dataQualityIssues: issues,
    // Pass through other stats
    averageAnalysisTime: registryStats.averageAnalysisTime || 0
  };
}

/**
 * Fetch all stats from the contract registry
 */
export async function fetchAllStats(): Promise<AllStats> {
  const registry = getContractRegistry();

  try {
    const startTime = Date.now();

    // Get registry stats and health in parallel
    const [rawRegistryStats, blobStats, healthCheck] = await Promise.all([
      registry.getStats(),
      registry['blobStorage'].getStats(), // Access the internal blobStorage
      registry.getHealth()
    ]);

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // Validate and sanitize the statistics
    const registryStats = validateAndSanitizeStats(rawRegistryStats, blobStats);

    // Calculate real discovery stats by querying discovery method indexes
    const discoveryStats = await calculateRealDiscoveryStats(registryStats);

    // Transform to our expected format
    return {
      registry: {
        totalContracts: registryStats.totalContracts,
        contractsByType: registryStats.contractsByType,
        validationStatus: registryStats.contractsByStatus,
        recentAdditions: 0 // Recent additions not tracked by service - would need historical data
      },
      storage: {
        blobStorage: {
          totalSize: Math.max(0, blobStats.totalSize || 0),
          totalContracts: Math.max(0, blobStats.totalContracts || 0),
          averageSize: Math.max(0, blobStats.averageSize || 0),
          largestContract: blobStats.largestContract || null,
          compressionRatio: Math.min(Math.max(blobStats.compressionRatio || 0, 0), 1), // Clamp to 0-1
          largeContractCount: blobStats.largeContractCount || 0,
          oversizedContracts: blobStats.oversizedContracts || []
        },
        indexStorage: {
          cacheHitRate: registryStats.cacheHitRate,
          ttlStats: {
            avgTTL: 3600, // Default TTL value
            totalKeys: registryStats.totalContracts // Conservative estimate: 1 key per contract
          }
        }
      },
      discovery: discoveryStats,
      health: {
        status: healthCheck.healthy ? 'healthy' : 'error',
        apiResponseTime: Math.max(0, responseTime),
        errorRate: healthCheck.issues ? Math.min(healthCheck.issues.length * 0.1, 1.0) : 0, // Convert issue count to rate (max 1.0)
        lastHealthCheck: healthCheck.lastCheck || Date.now()
      }
    };
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    throw error;
  }
}

/**
 * Calculate real discovery stats by querying discovery method indexes
 */
async function calculateRealDiscoveryStats(stats: any): Promise<UIDiscoveryStats> {
  const registry = getContractRegistry();
  
  try {
    // Get counts for each discovery method using the public API
    const [
      traitSearchContracts,
      sipScanContracts,
      apiScanContracts,
      manualContracts
    ] = await Promise.all([
      registry.getContractsByDiscovery('trait-search' as DiscoveryMethod),
      registry.getContractsByDiscovery('sip-scan' as DiscoveryMethod),
      registry.getContractsByDiscovery('api-scan' as DiscoveryMethod),
      registry.getContractsByDiscovery('manual' as DiscoveryMethod)
    ]);

    return {
      contractsByMethod: {
        'trait-search': traitSearchContracts.length,
        'sip-scan': sipScanContracts.length,
        'api-scan': apiScanContracts.length,
        'manual': manualContracts.length
      },
      traitDistribution: {
        'SIP010': stats.contractsByType.token,
        'SIP069': stats.contractsByType.nft,
        'Vault': stats.contractsByType.vault,
        'Custom': stats.contractsByType.unknown
      },
      successRate: stats.totalContracts > 0 ? 1.0 : 0, // All stored contracts are successfully discovered
      avgDiscoveryTime: stats.averageAnalysisTime || 0 // Use real analysis time from service
    };
  } catch (error) {
    console.warn('Failed to fetch real discovery stats, falling back to placeholder:', error);
    
    // Fallback to placeholder implementation
    return calculateDiscoveryStatsPlaceholder(stats);
  }
}

/**
 * Calculate discovery stats from registry stats (placeholder implementation)
 * Note: Used as fallback when real discovery method tracking fails
 */
function calculateDiscoveryStatsPlaceholder(stats: any): UIDiscoveryStats {
  const totalContracts = stats.totalContracts;

  return {
    contractsByMethod: {
      'trait-search': totalContracts, // All contracts - fallback behavior
      'sip-scan': 0,
      'api-scan': 0,
      'manual': 0
    },
    traitDistribution: {
      'SIP010': stats.contractsByType.token,
      'SIP069': stats.contractsByType.nft,
      'Vault': stats.contractsByType.vault,
      'Custom': stats.contractsByType.unknown
    },
    successRate: totalContracts > 0 ? 1.0 : 0, // All stored contracts are successfully discovered
    avgDiscoveryTime: stats.averageAnalysisTime || 0 // Use real analysis time from service
  };
}

/**
 * Fetch registry stats only
 */
export async function fetchRegistryStats(): Promise<UIRegistryStats> {
  const allStats = await fetchAllStats();
  return allStats.registry;
}

/**
 * Fetch storage stats only
 */
export async function fetchStorageStats(): Promise<UIStorageStats> {
  const allStats = await fetchAllStats();
  return allStats.storage;
}

/**
 * Fetch discovery stats only
 */
export async function fetchDiscoveryStats(): Promise<UIDiscoveryStats> {
  const allStats = await fetchAllStats();
  return allStats.discovery;
}

/**
 * Fetch health stats only
 */
export async function fetchHealthStats(): Promise<UIHealthStats> {
  const allStats = await fetchAllStats();
  return allStats.health;
}
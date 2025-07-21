/**
 * Discovery operation types and interfaces
 */


// Discovery configuration
export interface DiscoveryConfig {
  enabled: boolean;
  batchSize: number;
  maxRetries: number;
  retryDelay: number; // milliseconds
  timeout: number; // milliseconds
  blacklist: string[]; // contracts to skip
}

// Discovery method types
export type DiscoveryMethod = 'trait-search' | 'sip-scan' | 'api-scan' | 'manual';

// Discovery source configuration
export interface DiscoverySource {
  name: string;
  method: DiscoveryMethod;
  enabled: boolean;
  config: any;
}

// Discovery operation result
export interface DiscoveryResult {
  success: boolean;
  method: DiscoveryMethod;
  timestamp: number;
  duration: number;
  contractsFound: number;
  contractsProcessed: number;
  contractsAdded: number;
  contractsUpdated: number;
  contractsSkipped: number;
  contractsErrored: number;
  newContracts: string[];
  errorContracts: { contractId: string; error: string }[];
  error?: string;
}

// Trait discovery configuration
export interface TraitDiscoveryConfig {
  trait: any; // Trait ABI definition
  enabled: boolean;
  priority: number;
  batchSize: number;
}

// SIP standard discovery configuration
export interface SIPDiscoveryConfig {
  sipNumber: string; // 'SIP009', 'SIP010', etc.
  trait: any; // SIP trait definition
  enabled: boolean;
}

// Discovery plan for scheduled operations
export interface DiscoveryPlan {
  id: string;
  name: string;
  sources: DiscoverySource[];
  schedule?: string; // cron expression
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
}

// Discovery queue item
export interface DiscoveryQueueItem {
  contractId: string;
  method: DiscoveryMethod;
  priority: number;
  attempts: number;
  maxAttempts: number;
  addedAt: number;
  lastAttempt?: number;
  error?: string;
}

// Discovery status tracking
export interface DiscoveryStatus {
  isRunning: boolean;
  currentMethod?: DiscoveryMethod;
  progress?: {
    current: number;
    total: number;
    percentage: number;
  };
  lastRun?: DiscoveryResult;
  queueSize: number;
  errors: number;
}

// Discovery orchestration configuration
export interface DiscoveryOrchestrationConfig {
  traits?: TraitDiscoveryConfig[];
  sipStandards?: SIPDiscoveryConfig[];
  apiScan?: DiscoveryConfig;
}

// Discovery orchestration result
export interface DiscoveryOrchestrationResult {
  success: boolean;
  timestamp: number;
  duration: number;
  totalContractsFound: number;
  totalContractsProcessed: number;
  totalContractsAdded: number;
  results: DiscoveryResult[];
  errors: string[];
}

// Trait matching result
export interface TraitMatchResult {
  contractId: string;
  matched: boolean;
  traits: string[];
  confidence: number; // 0-1
  validationMethod: 'abi' | 'source' | 'runtime';
  validatedAt: number;
}

// Discovery statistics
export interface DiscoveryStats {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  totalContractsFound: number;
  totalContractsProcessed: number;
  averageRunTime: number;
  averageContractsPerRun: number;
  lastSuccessfulRun?: number;
  lastFailedRun?: number;
  errorRate: number;
  discoveryMethods: Record<DiscoveryMethod, {
    runs: number;
    contracts: number;
    errors: number;
    averageTime: number;
  }>;
}


// Default discovery configuration
export const DEFAULT_DISCOVERY_CONFIG: DiscoveryConfig = {
  enabled: true,
  batchSize: 50,
  maxRetries: 3,
  retryDelay: 5000, // 5 seconds
  timeout: 30000, // 30 seconds
  blacklist: []
};

// Common SIP trait definitions for discovery
export const SIP_TRAITS = {
  SIP009: {
    functions: [
      'get-last-token-id',
      'get-token-uri',
      'get-owner',
      'transfer'
    ]
  },
  SIP010: {
    functions: [
      'transfer',
      'get-name',
      'get-symbol',
      'get-decimals',
      'get-balance',
      'get-total-supply'
    ]
  }
};
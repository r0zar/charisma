/**
 * Snapshot-specific types for balance service
 */

// === Snapshot Types ===

export interface Snapshot {
  timestamp: number;
  key: string;
  success: boolean;
  duration: number;
  compressionRatio: number;
}

export interface BalanceSnapshot {
  timestamp: number;
  totalAddresses: number;
  totalContracts: number;
  balances: Record<string, Record<string, KVBalanceData>>;
  metadata: SnapshotMetadata;
}

export interface SnapshotMetadata {
  createdAt: number;
  processingTime: number;
  compressionRatio: number;
  originalSize: number;
  compressedSize: number;
  version: string;
}

export interface SnapshotIndex {
  timestamps: number[];
  count: number;
  oldest: number;
  newest: number;
  lastUpdated: number;
}

// === Scheduler Types ===

export interface SchedulerConfig {
  interval: number; // milliseconds
  enabled: boolean;
  maxRetries: number;
  retryDelay: number;
  compressionLevel: number;
  maxSnapshotAge: number; // milliseconds
}

export interface SchedulerStats {
  lastSnapshotTime: number;
  lastSnapshotDuration: number;
  totalSnapshots: number;
  failedSnapshots: number;
  averageProcessingTime: number;
  averageCompressionRatio: number;
  nextSnapshotTime: number;
}

// === Query Types ===

export interface SnapshotQuery {
  timestamp?: number;
  from?: number;
  to?: number;
  limit?: number;
  includeMetadata?: boolean;
}

export interface SnapshotQueryResult {
  snapshots: BalanceSnapshot[];
  totalFound: number;
  queryTime: number;
  cached: boolean;
}

// === Storage Types ===

export interface SnapshotStorageConfig {
  basePath: string;
  compressionLevel: number;
  maxFileSize: number;
  enableMonitoring: boolean;
}

export interface StorageStats {
  totalSnapshots: number;
  totalSize: number;
  averageSize: number;
  compressionRatio: number;
  oldestSnapshot: number;
  newestSnapshot: number;
}

export interface KVBalanceData {
  balance: string;
  lastUpdated: number;
  blockHeight?: number;
}

export interface KvBalanceStats {
  totalSnapshots: number;
  totalAddresses: number;
  totalTokens: number;
  lastUpdate: string;
  addresses?: string[];
}

// === Address Discovery Types ===

export interface AddressMetadata {
  // Core metadata
  contracts: string[];
  lastSync: number;
  
  // Auto-discovery metadata
  autoDiscovered?: boolean;
  discoverySource?: 'token_holders' | 'whale_detection' | 'contract_addresses' | 'transaction_monitor' | 'manual';
  discoveryMetadata?: {
    tokenContract?: string;
    balanceAmount?: string;
    whaleClassification?: 'small' | 'medium' | 'large' | 'mega';
    contractType?: 'sip-010' | 'sip-009' | 'defi' | 'dao' | 'other';
    contractName?: string;
    totalTokensHeld?: number;
    confidenceScore?: number;
    discoveredAt: number;
  };
  
  // Collection settings
  autoCollectionEnabled?: boolean;
  collectionPriority?: 'low' | 'medium' | 'high';
  
  // Whale classification
  whaleClassification?: 'small' | 'medium' | 'large' | 'mega';
  totalValueUSD?: number;
  lastWhaleUpdate?: number;
  
  // Tags and notes
  tags?: string[];
  notes?: string;
  
  // Performance tracking
  collectionSuccessRate?: number;
  lastCollectionAttempt?: number;
  lastCollectionSuccess?: number;
}

// === Error Types ===

export class SnapshotError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'SnapshotError';
  }
}

export class SnapshotStorageError extends SnapshotError {
  constructor(message: string, details?: any) {
    super(message, 'SNAPSHOT_STORAGE_ERROR', details);
  }
}

export class SnapshotCompressionError extends SnapshotError {
  constructor(message: string, details?: any) {
    super(message, 'SNAPSHOT_COMPRESSION_ERROR', details);
  }
}

export class SnapshotSchedulerError extends SnapshotError {
  constructor(message: string, details?: any) {
    super(message, 'SNAPSHOT_SCHEDULER_ERROR', details);
  }
}

// === Utility Types ===

export interface CompressionResult {
  compressed: Buffer;
  originalSize: number;
  compressedSize: number;
  ratio: number;
  algorithm: string;
}

export interface RetentionPolicy {
  maxAge: number; // milliseconds
  maxCount: number;
  cleanupInterval: number; // milliseconds
}

// === Constants ===

export const SNAPSHOT_CONSTANTS = {
  MAX_FILE_SIZE: 400 * 1024 * 1024, // 400MB (under 512MB limit)
  DEFAULT_COMPRESSION_LEVEL: 6,
  BASE_PATH: 'balances/snapshots',
  INDEX_KEY: 'balances:snapshots:index',
  METADATA_KEY: 'balances:snapshots:metadata',
  VERSION: '1.0.0'
} as const;

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  interval: 15 * 60 * 1000, // 15 minutes
  enabled: true,
  maxRetries: 3,
  retryDelay: 5000, // 5 seconds
  compressionLevel: 6,
  maxSnapshotAge: 24 * 60 * 60 * 1000 // 24 hours
};

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  maxCount: 2880, // 30 days * 24 hours * 4 snapshots per hour
  cleanupInterval: 60 * 60 * 1000 // 1 hour
};
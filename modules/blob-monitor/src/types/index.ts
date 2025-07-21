/**
 * Blob Monitor Types and Interfaces
 */

// === Core Monitoring Types ===

export type EnforcementLevel = 'warn' | 'block' | 'silent';

export interface BlobOperation {
  type: 'put' | 'head' | 'list' | 'fetch' | 'copy' | 'delete';
  path: string;
  size?: number;
  timestamp: number;
  serviceName: string;
  cacheHit?: boolean;
  operationId: string;
}

export interface BlobInfo {
  path: string;
  size: number;
  createdAt: number;
  lastModified: number;
  serviceName: string;
  cacheStatus: 'hit' | 'miss' | 'unknown';
  accessCount: number;
  totalTransferBytes: number;
}

export interface BlobSizeWarning {
  path: string;
  size: number;
  threshold: number;
  percentage: number;
  message: string;
  timestamp: number;
}

// === Configuration Types ===

export interface BlobMonitorConfig {
  serviceName: string;
  enforcementLevel?: EnforcementLevel;
  sizeThresholds?: {
    warning: number;    // Default: 400MB
    error: number;      // Default: 500MB
    critical: number;   // Default: 512MB
  };
  costThresholds?: {
    dailyWarning: number;   // Default: $5/day
    monthlyWarning: number; // Default: $50/month
  };
  enableCostTracking?: boolean;
  enableCapacityTracking?: boolean;
  cacheTTL?: number;
}

// === Storage Capacity Types ===

export interface ServiceCapacity {
  serviceName: string;
  totalBlobs: number;
  totalSize: number;
  averageBlobSize: number;
  largestBlob: {
    path: string;
    size: number;
  };
  operations: {
    simple: number;
    advanced: number;
  };
  lastUpdated: number;
}

export interface GlobalCapacity {
  totalServices: number;
  totalBlobs: number;
  totalSize: number;
  services: Record<string, ServiceCapacity>;
  oversizedBlobs: BlobInfo[];
  lastUpdated: number;
  version: string;
}

// === Cost Calculation Types ===

export interface CostBreakdown {
  storage: number;           // GB-month * $0.023
  simpleOperations: number;  // Cache MISSes * $0.40/1M
  advancedOperations: number; // put/copy/list * $5.00/1M
  dataTransfer: number;      // GB * $0.050
  fastOriginTransfer: number; // Cache MISS GB * $0.06
  total: number;
}

export interface CostProjection {
  current: CostBreakdown;
  projected: {
    daily: CostBreakdown;
    monthly: CostBreakdown;
    yearly: CostBreakdown;
  };
  trends: {
    storageGrowth: number;    // GB/month
    operationGrowth: number;  // operations/month
  };
  recommendations: string[];
}

// === Alert Types ===

export interface BlobAlert {
  level: 'info' | 'warning' | 'error' | 'critical';
  type: 'size' | 'cost' | 'performance' | 'capacity';
  message: string;
  details: {
    path?: string;
    size?: number;
    cost?: number;
    threshold?: number;
    serviceName: string;
  };
  timestamp: number;
  resolved: boolean;
}

export interface AlertRule {
  type: 'size' | 'cost' | 'performance' | 'capacity';
  threshold: number;
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  enabled: boolean;
}

// === Monitoring Stats Types ===

export interface MonitoringStats {
  totalOperations: number;
  operationBreakdown: Record<string, number>;
  cacheHitRate: number;
  averageResponseTime: number;
  totalCost: number;
  costBreakdown: CostBreakdown;
  alerts: BlobAlert[];
  uptime: number;
  lastReset: number;
}

// === Storage Registry Types ===

export interface BlobRegistry {
  blobs: Record<string, BlobInfo>;
  services: Record<string, ServiceCapacity>;
  globalStats: GlobalCapacity;
  alerts: BlobAlert[];
  lastCleanup: number;
  version: string;
}

// === Error Types ===

export class BlobMonitorError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'BlobMonitorError';
  }
}

export class BlobSizeError extends BlobMonitorError {
  constructor(path: string, size: number, limit: number) {
    super(
      `Blob ${path} exceeds size limit: ${(size / 1024 / 1024).toFixed(2)}MB > ${(limit / 1024 / 1024).toFixed(2)}MB`,
      'BLOB_SIZE_ERROR',
      { path, size, limit }
    );
  }
}

export class CostThresholdError extends BlobMonitorError {
  constructor(cost: number, threshold: number) {
    super(
      `Blob costs exceed threshold: $${cost.toFixed(2)} > $${threshold.toFixed(2)}`,
      'COST_THRESHOLD_ERROR',
      { cost, threshold }
    );
  }
}

// === Utility Types ===

export interface BlobMetrics {
  path: string;
  size: number;
  compressionRatio?: number;
  accessFrequency: number;
  costPerAccess: number;
  recommendations: string[];
}

export interface OptimizationSuggestion {
  path: string;
  currentSize: number;
  suggestedAction: 'compress' | 'split' | 'archive' | 'delete';
  estimatedSavings: number;
  description: string;
}

// === Constants ===

export const BLOB_SIZE_LIMITS = {
  CACHE_LIMIT: 512 * 1024 * 1024,    // 512MB - cache limit
  WARNING_THRESHOLD: 400 * 1024 * 1024, // 400MB - 80% warning
  ERROR_THRESHOLD: 500 * 1024 * 1024,   // 500MB - 98% error
  MAX_SIZE: 5 * 1024 * 1024 * 1024 * 1024 // 5TB - absolute max
} as const;

export const COST_LIMITS = {
  STORAGE_PER_GB: 0.023,          // $0.023 per GB/month
  SIMPLE_OPERATIONS: 0.40,        // $0.40 per million
  ADVANCED_OPERATIONS: 5.00,      // $5.00 per million
  DATA_TRANSFER: 0.050,           // $0.050 per GB
  FAST_ORIGIN_TRANSFER: 0.06      // $0.06 per GB
} as const;

export const FREE_TIERS = {
  STORAGE: 5 * 1024 * 1024 * 1024,      // 5GB
  SIMPLE_OPERATIONS: 100000,             // 100K
  ADVANCED_OPERATIONS: 10000,            // 10K
  DATA_TRANSFER: 100 * 1024 * 1024 * 1024 // 100GB
} as const;
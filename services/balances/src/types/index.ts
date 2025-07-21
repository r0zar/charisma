/**
 * Simplified Balance Service Types
 * Focus on core balance tracking without complex portfolio logic
 */

// === Core Balance Types ===

export interface BalancePoint {
  balance: string;
  timestamp: number;
  blockHeight?: number;
  txHash?: string;
}

export interface BalanceMetadata {
  firstSeen: number;
  lastUpdated: number;
}

export interface BalanceTimeSeries {
  contractId: string;
  points: BalancePoint[];
  metadata: BalanceMetadata;
}

// BalanceSnapshot is now exported from snapshot-types.ts

// === Service Types ===

export type BalanceMap = Record<string, string>;

export interface BalanceResult {
  address: string;
  contractId: string;
  balance: string;
  lastUpdated: number;
  metadata?: BalanceMetadata;
}

export interface BalanceRequest {
  address: string;
  contractId: string;
}

export interface BalanceUpdate {
  address: string;
  contractId: string;
  balance: string;
  timestamp: number;
  blockHeight?: number;
  txHash?: string;
}

// === Storage Types ===

export interface CurrentBalanceData {
  address: string;
  lastSync: number;
  balances: Record<string, {
    balance: string;
    lastUpdated: number;
  }>;
}

export interface MonthlyTimeSeriesData {
  address: string;
  period: string; // "2024-01"
  data: Record<string, BalanceTimeSeries>;
}

export interface DailySnapshotData {
  address: string;
  year: number;
  dailySnapshots: Record<string, Record<string, string>>;
}

export interface CachedBlob<T = any> {
  data: T;
  timestamp: number;
  expires: number;
}

// === Query Options ===

export interface HistoryQueryOptions {
  from?: number;
  to?: number;
  granularity?: 'hour' | 'day' | 'week';
  limit?: number;
}

export type TimePeriod = '1d' | '7d' | '30d' | '1y' | 'all';

export interface TimeRange {
  from: number;
  to: number;
  granularity: 'hour' | 'day' | 'week';
}

// === Bulk Request/Response Types ===

export interface BulkBalanceRequest {
  addresses: string[];
  contractIds?: string[];
  includeZeroBalances?: boolean;
}

export interface BulkBalanceResponse {
  success: boolean;
  data?: Record<string, Record<string, string>>;
  metadata: {
    totalAddresses: number;
    totalContracts: number;
    executionTime: number;
    cacheHits: number;
  };
  error?: string;
}

export interface BalanceSeriesRequest {
  addresses: string[];
  contractIds: string[];
  period: TimePeriod;
  granularity?: 'hour' | 'day' | 'week';
  includeSnapshots?: boolean;
  limit?: number;
}

export interface BalanceSeriesResponse {
  success: boolean;
  data?: {
    timeSeries: Record<string, Record<string, BalancePoint[]>>;
    snapshots?: Record<string, any[]>; // Use any[] instead of BalanceSnapshot[] to avoid circular dependency
    metadata: {
      totalRequests: number;
      cacheHits: number;
      cacheMisses: number;
      executionTime: number;
      blobsAccessed: number;
    };
  };
  error?: string;
}

// === Configuration ===

export interface BalanceServiceConfig {
  cacheTimeouts: {
    current: number;
    timeSeries: number;
    snapshots: number;
  };
  maxPointsPerMonth: number;
  blobCacheControl: number;
  syncConcurrency: number;
}

// === Storage Interfaces ===

export interface BalanceStore {
  getBalance(address: string, contractId: string): Promise<string | null>;
  setBalance(address: string, contractId: string, balance: string): Promise<void>;
  getAddressBalances(address: string): Promise<Record<string, string>>;
  setBalancesBatch(updates: BalanceUpdate[]): Promise<void>;
  invalidateAddress(address: string): Promise<void>;
  getLastSync(address: string, contractId?: string): Promise<Date | null>;
}

export interface TimeSeriesStore {
  appendBalancePoint(
    address: string,
    contractId: string,
    point: BalancePoint
  ): Promise<void>;

  getBalanceHistory(
    address: string,
    contractId: string,
    options: HistoryQueryOptions
  ): Promise<BalancePoint[]>;

  getDailySnapshots(
    address: string,
    from: number,
    to: number
  ): Promise<any[]>; // Use any[] instead of BalanceSnapshot[] to avoid circular dependency

  createSnapshot(address: string, timestamp: number): Promise<void>;
}

// === Error Types ===

export class BalanceServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'BalanceServiceError';
  }
}

export class StorageError extends BalanceServiceError {
  constructor(message: string, details?: any) {
    super(message, 'STORAGE_ERROR', details);
  }
}

export class ValidationError extends BalanceServiceError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
  }
}

// === Utility Types ===

export type Granularity = 'hour' | 'day' | 'week' | 'month';

export interface StorageStrategy {
  maxAge: number;
  granularity: Granularity;
}

export const STORAGE_STRATEGIES: Record<string, StorageStrategy> = {
  recent: { maxAge: 24 * 60 * 60 * 1000, granularity: 'hour' },
  daily: { maxAge: 7 * 24 * 60 * 60 * 1000, granularity: 'hour' },
  weekly: { maxAge: 30 * 24 * 60 * 60 * 1000, granularity: 'day' },
  archived: { maxAge: Infinity, granularity: 'week' }
};
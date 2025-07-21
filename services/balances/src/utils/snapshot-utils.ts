/**
 * Snapshot utility functions
 */

import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import type { 
  BalanceSnapshot, 
  CompressionResult, 
  SnapshotQuery 
} from '../types/snapshot-types';
import { SNAPSHOT_CONSTANTS } from '../types/snapshot-types';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

/**
 * Generate snapshot blob key from timestamp
 */
export function generateSnapshotKey(timestamp: number): string {
  return `${SNAPSHOT_CONSTANTS.BASE_PATH}/${timestamp}.json.gz`;
}

/**
 * Extract timestamp from snapshot key
 */
export function extractTimestampFromKey(key: string): number {
  const match = key.match(/\/(\d+)\.json\.gz$/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Compress snapshot data
 */
export async function compressSnapshot(
  snapshot: BalanceSnapshot,
  level: number = SNAPSHOT_CONSTANTS.DEFAULT_COMPRESSION_LEVEL
): Promise<CompressionResult> {
  try {
    const jsonString = JSON.stringify(snapshot);
    const originalBuffer = Buffer.from(jsonString, 'utf8');
    const originalSize = originalBuffer.length;
    
    const compressed = await gzipAsync(originalBuffer, { level });
    const compressedSize = compressed.length;
    const ratio = compressedSize / originalSize;
    
    return {
      compressed,
      originalSize,
      compressedSize,
      ratio,
      algorithm: 'gzip'
    };
  } catch (error) {
    throw new Error(`Failed to compress snapshot: ${error}`);
  }
}

/**
 * Decompress snapshot data
 */
export async function decompressSnapshot(compressedData: Buffer): Promise<BalanceSnapshot> {
  try {
    const decompressed = await gunzipAsync(compressedData);
    const jsonString = decompressed.toString('utf8');
    return JSON.parse(jsonString) as BalanceSnapshot;
  } catch (error) {
    throw new Error(`Failed to decompress snapshot: ${error}`);
  }
}

/**
 * Validate snapshot data structure
 */
export function validateSnapshot(snapshot: any): snapshot is BalanceSnapshot {
  if (!snapshot || typeof snapshot !== 'object') {
    return false;
  }
  
  const required = ['timestamp', 'totalAddresses', 'totalContracts', 'balances', 'metadata'];
  
  for (const field of required) {
    if (!(field in snapshot)) {
      return false;
    }
  }
  
  // Validate timestamp
  if (typeof snapshot.timestamp !== 'number' || snapshot.timestamp <= 0) {
    return false;
  }
  
  // Validate counts
  if (typeof snapshot.totalAddresses !== 'number' || snapshot.totalAddresses < 0) {
    return false;
  }
  
  if (typeof snapshot.totalContracts !== 'number' || snapshot.totalContracts < 0) {
    return false;
  }
  
  // Validate balances structure
  if (typeof snapshot.balances !== 'object') {
    return false;
  }
  
  // Validate metadata
  if (!snapshot.metadata || typeof snapshot.metadata !== 'object') {
    return false;
  }
  
  return true;
}

/**
 * Find closest timestamp in array
 */
export function findClosestTimestamp(timestamps: number[], target: number): number {
  if (timestamps.length === 0) {
    return 0;
  }
  
  // Sort timestamps in ascending order
  const sorted = [...timestamps].sort((a, b) => a - b);
  
  // If target is before first timestamp, return first
  if (target <= sorted[0]) {
    return sorted[0];
  }
  
  // If target is after last timestamp, return last
  if (target >= sorted[sorted.length - 1]) {
    return sorted[sorted.length - 1];
  }
  
  // Binary search for closest timestamp
  let left = 0;
  let right = sorted.length - 1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midTimestamp = sorted[mid];
    
    if (midTimestamp === target) {
      return midTimestamp;
    } else if (midTimestamp < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  
  // Choose the closest between left and right
  const leftTimestamp = sorted[right];
  const rightTimestamp = sorted[left];
  
  if (rightTimestamp === undefined) {
    return leftTimestamp;
  }
  
  if (leftTimestamp === undefined) {
    return rightTimestamp;
  }
  
  const leftDiff = Math.abs(target - leftTimestamp);
  const rightDiff = Math.abs(target - rightTimestamp);
  
  return leftDiff <= rightDiff ? leftTimestamp : rightTimestamp;
}

/**
 * Filter timestamps by query parameters
 */
export function filterTimestamps(
  timestamps: number[],
  query: SnapshotQuery
): number[] {
  let filtered = [...timestamps];
  
  // Filter by timestamp range
  if (query.from !== undefined) {
    filtered = filtered.filter(ts => ts >= query.from!);
  }
  
  if (query.to !== undefined) {
    filtered = filtered.filter(ts => ts <= query.to!);
  }
  
  // Sort in descending order (newest first)
  filtered.sort((a, b) => b - a);
  
  // Apply limit
  if (query.limit !== undefined && query.limit > 0) {
    filtered = filtered.slice(0, query.limit);
  }
  
  return filtered;
}

/**
 * Calculate snapshot statistics
 */
export function calculateSnapshotStats(snapshots: BalanceSnapshot[]): {
  totalSnapshots: number;
  totalAddresses: number;
  totalContracts: number;
  averageAddresses: number;
  averageContracts: number;
  timeRange: { start: number; end: number };
  averageProcessingTime: number;
  averageCompressionRatio: number;
} {
  if (snapshots.length === 0) {
    return {
      totalSnapshots: 0,
      totalAddresses: 0,
      totalContracts: 0,
      averageAddresses: 0,
      averageContracts: 0,
      timeRange: { start: 0, end: 0 },
      averageProcessingTime: 0,
      averageCompressionRatio: 0
    };
  }
  
  const totalSnapshots = snapshots.length;
  const totalAddresses = snapshots.reduce((sum, s) => sum + s.totalAddresses, 0);
  const totalContracts = snapshots.reduce((sum, s) => sum + s.totalContracts, 0);
  
  const timestamps = snapshots.map(s => s.timestamp).sort((a, b) => a - b);
  const timeRange = {
    start: timestamps[0],
    end: timestamps[timestamps.length - 1]
  };
  
  const totalProcessingTime = snapshots.reduce((sum, s) => sum + s.metadata.processingTime, 0);
  const totalCompressionRatio = snapshots.reduce((sum, s) => sum + s.metadata.compressionRatio, 0);
  
  return {
    totalSnapshots,
    totalAddresses,
    totalContracts,
    averageAddresses: totalAddresses / totalSnapshots,
    averageContracts: totalContracts / totalSnapshots,
    timeRange,
    averageProcessingTime: totalProcessingTime / totalSnapshots,
    averageCompressionRatio: totalCompressionRatio / totalSnapshots
  };
}

/**
 * Create snapshot metadata
 */
export function createSnapshotMetadata(
  processingTime: number,
  compressionResult: CompressionResult
): {
  createdAt: number;
  processingTime: number;
  compressionRatio: number;
  originalSize: number;
  compressedSize: number;
  version: string;
} {
  return {
    createdAt: Date.now(),
    processingTime,
    compressionRatio: compressionResult.ratio,
    originalSize: compressionResult.originalSize,
    compressedSize: compressionResult.compressedSize,
    version: SNAPSHOT_CONSTANTS.VERSION
  };
}

/**
 * Estimate snapshot size before compression
 */
export function estimateSnapshotSize(
  addressCount: number,
  contractCount: number,
  avgBalanceSize: number = 50
): number {
  // Rough estimation based on JSON structure
  const baseSize = 200; // Base snapshot structure
  const addressOverhead = addressCount * 100; // Address keys and metadata
  const contractOverhead = contractCount * 80; // Contract keys and metadata
  const balanceData = contractCount * avgBalanceSize; // Balance data
  
  return baseSize + addressOverhead + contractOverhead + balanceData;
}

/**
 * Check if snapshot size is within limits
 */
export function isValidSnapshotSize(size: number): boolean {
  return size <= SNAPSHOT_CONSTANTS.MAX_FILE_SIZE;
}

/**
 * Generate snapshot filename for debugging
 */
export function generateSnapshotFilename(timestamp: number): string {
  const date = new Date(timestamp);
  return `snapshot-${date.toISOString().replace(/[:.]/g, '-')}.json.gz`;
}

/**
 * Parse snapshot query from URL parameters
 */
export function parseSnapshotQuery(params: Record<string, string>): SnapshotQuery {
  const query: SnapshotQuery = {};
  
  if (params.timestamp) {
    query.timestamp = parseInt(params.timestamp, 10);
  }
  
  if (params.from) {
    query.from = parseInt(params.from, 10);
  }
  
  if (params.to) {
    query.to = parseInt(params.to, 10);
  }
  
  if (params.limit) {
    query.limit = parseInt(params.limit, 10);
  }
  
  if (params.includeMetadata) {
    query.includeMetadata = params.includeMetadata === 'true';
  }
  
  return query;
}
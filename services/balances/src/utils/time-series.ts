/**
 * Time series utility functions
 */

import type { 
  BalancePoint, 
  Granularity, 
  TimePeriod, 
  TimeRange 
} from '../types';

/**
 * Convert time period string to time range
 */
export function periodToTimeRange(period: TimePeriod): TimeRange {
  const now = Date.now();
  
  switch (period) {
    case '1d':
      return {
        from: now - 24 * 60 * 60 * 1000,
        to: now,
        granularity: 'hour'
      };
    case '7d':
      return {
        from: now - 7 * 24 * 60 * 60 * 1000,
        to: now,
        granularity: 'hour'
      };
    case '30d':
      return {
        from: now - 30 * 24 * 60 * 60 * 1000,
        to: now,
        granularity: 'day'
      };
    case '1y':
      return {
        from: now - 365 * 24 * 60 * 60 * 1000,
        to: now,
        granularity: 'week'
      };
    case 'all':
    default:
      return {
        from: 0,
        to: now,
        granularity: 'week'
      };
  }
}

/**
 * Get month key for blob storage path
 */
export function getMonthKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get month range for a time period
 */
export function getMonthRange(from?: number, to?: number): string[] {
  const start = from ? new Date(from) : new Date(2024, 0, 1);
  const end = to ? new Date(to) : new Date();
  
  const months: string[] = [];
  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  
  while (current <= end) {
    months.push(getMonthKey(current.getTime()));
    current.setMonth(current.getMonth() + 1);
  }
  
  return months;
}

/**
 * Downsample time series data points
 */
export function downsample(
  points: BalancePoint[], 
  granularity: Granularity, 
  limit: number
): BalancePoint[] {
  if (points.length <= limit) {
    return points;
  }
  
  // Calculate the interval based on granularity
  let interval: number;
  switch (granularity) {
    case 'hour':
      interval = 60 * 60 * 1000;
      break;
    case 'day':
      interval = 24 * 60 * 60 * 1000;
      break;
    case 'week':
      interval = 7 * 24 * 60 * 60 * 1000;
      break;
    case 'month':
      interval = 30 * 24 * 60 * 60 * 1000;
      break;
    default:
      interval = 24 * 60 * 60 * 1000; // Default to daily
  }
  
  // Group points by interval
  const buckets = new Map<number, BalancePoint[]>();
  
  for (const point of points) {
    const bucketKey = Math.floor(point.timestamp / interval) * interval;
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, []);
    }
    buckets.get(bucketKey)!.push(point);
  }
  
  // Take the last point from each bucket (most recent in that interval)
  const downsampled: BalancePoint[] = [];
  for (const [bucketTime, bucketPoints] of buckets) {
    const latest = bucketPoints.reduce((latest, point) => 
      point.timestamp > latest.timestamp ? point : latest
    );
    downsampled.push(latest);
  }
  
  // Sort by timestamp and limit results
  downsampled.sort((a, b) => a.timestamp - b.timestamp);
  
  if (downsampled.length <= limit) {
    return downsampled;
  }
  
  // If still too many points, take every nth point
  const step = Math.ceil(downsampled.length / limit);
  return downsampled.filter((_, index) => index % step === 0);
}

/**
 * Create time series chunks for efficient storage
 */
export function chunkTimeSeries<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Calculate time series aggregation statistics
 */
export function calculateStats(points: BalancePoint[]): {
  min: string;
  max: string;
  first: string;
  last: string;
  count: number;
} {
  if (points.length === 0) {
    return {
      min: '0',
      max: '0',
      first: '0',
      last: '0',
      count: 0
    };
  }
  
  const balances = points.map(p => BigInt(p.balance));
  const sorted = [...balances].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  
  return {
    min: sorted[0].toString(),
    max: sorted[sorted.length - 1].toString(),
    first: points[0].balance,
    last: points[points.length - 1].balance,
    count: points.length
  };
}

/**
 * Merge overlapping time series data
 */
export function mergeTimeSeries(
  existing: BalancePoint[], 
  newPoints: BalancePoint[]
): BalancePoint[] {
  const combined = [...existing, ...newPoints];
  
  // Remove duplicates based on timestamp
  const unique = new Map<number, BalancePoint>();
  for (const point of combined) {
    const existing = unique.get(point.timestamp);
    if (!existing || point.timestamp > existing.timestamp) {
      unique.set(point.timestamp, point);
    }
  }
  
  return Array.from(unique.values()).sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Get optimal storage granularity based on data age
 */
export function getOptimalGranularity(timestamp: number): Granularity {
  const age = Date.now() - timestamp;
  const day = 24 * 60 * 60 * 1000;
  
  if (age < day) return 'hour';
  if (age < 7 * day) return 'hour';
  if (age < 30 * day) return 'day';
  return 'week';
}

/**
 * Create daily snapshot from time series data
 */
export function createDailySnapshot(
  points: BalancePoint[], 
  targetDate: number
): BalancePoint | null {
  if (points.length === 0) return null;
  
  // Find the latest point before or at the target date
  const validPoints = points.filter(p => p.timestamp <= targetDate);
  if (validPoints.length === 0) return null;
  
  return validPoints.reduce((latest, point) => 
    point.timestamp > latest.timestamp ? point : latest
  );
}

/**
 * Validate time series data integrity
 */
export function validateTimeSeries(points: BalancePoint[]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (points.length === 0) {
    return { isValid: true, errors: [] };
  }
  
  // Check sorting
  for (let i = 1; i < points.length; i++) {
    if (points[i].timestamp < points[i - 1].timestamp) {
      errors.push(`Points not sorted at index ${i}`);
      break;
    }
  }
  
  // Check for invalid balances
  for (let i = 0; i < points.length; i++) {
    try {
      BigInt(points[i].balance);
    } catch {
      errors.push(`Invalid balance at index ${i}: ${points[i].balance}`);
    }
  }
  
  // Check for duplicate timestamps
  const timestamps = new Set();
  for (let i = 0; i < points.length; i++) {
    if (timestamps.has(points[i].timestamp)) {
      errors.push(`Duplicate timestamp at index ${i}: ${points[i].timestamp}`);
    }
    timestamps.add(points[i].timestamp);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
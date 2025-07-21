/**
 * Utility Helper Functions
 * Common utilities for blob monitoring and cost calculations
 */

import { randomBytes } from 'crypto';

/**
 * Generate unique operation ID
 */
export function generateOperationId(): string {
  return `${Date.now()}-${randomBytes(4).toString('hex')}`;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format cost to currency string
 */
export function formatCost(cost: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(cost);
}

/**
 * Calculate percentage with proper rounding
 */
export function calculatePercentage(value: number, total: number, decimals: number = 1): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100 * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * Format time duration to human-readable string
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Parse blob URL to extract path
 */
export function parseBlobUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
  } catch {
    return url;
  }
}

/**
 * Calculate compression ratio
 */
export function calculateCompressionRatio(originalSize: number, compressedSize: number): number {
  if (originalSize === 0) return 0;
  return (1 - compressedSize / originalSize) * 100;
}

/**
 * Estimate blob access frequency based on history
 */
export function estimateAccessFrequency(
  accessCount: number,
  createdAt: number,
  now: number = Date.now()
): number {
  const ageInDays = Math.max(1, (now - createdAt) / (24 * 60 * 60 * 1000));
  return accessCount / ageInDays;
}

/**
 * Check if blob size is within safe limits
 */
export function isSafeSize(size: number, limit: number = 512 * 1024 * 1024): boolean {
  return size <= limit;
}

/**
 * Calculate cache hit rate
 */
export function calculateCacheHitRate(hits: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((hits / total) * 100 * 10) / 10;
}

/**
 * Generate alert message based on blob size and threshold
 */
export function generateSizeAlertMessage(
  path: string,
  size: number,
  threshold: number,
  type: 'warning' | 'error' | 'critical'
): string {
  const percentage = calculatePercentage(size, 512 * 1024 * 1024);
  const sizeStr = formatBytes(size);
  
  switch (type) {
    case 'warning':
      return `⚠️  Blob ${path} is ${percentage}% of 512MB limit (${sizeStr})`;
    case 'error':
      return `🚨 Blob ${path} is ${percentage}% of 512MB limit (${sizeStr}) - approaching cache limit`;
    case 'critical':
      return `🚨 CRITICAL: Blob ${path} exceeds 512MB (${sizeStr}) - will cause cache MISS on every access!`;
    default:
      return `Blob ${path} size: ${sizeStr}`;
  }
}

/**
 * Generate cost alert message
 */
export function generateCostAlertMessage(
  cost: number,
  threshold: number,
  period: 'daily' | 'monthly' | 'yearly'
): string {
  const costStr = formatCost(cost);
  const thresholdStr = formatCost(threshold);
  
  return `💰 ${period.charAt(0).toUpperCase() + period.slice(1)} costs ${costStr} exceed threshold ${thresholdStr}`;
}

/**
 * Sanitize blob path for safe storage
 */
export function sanitizeBlobPath(path: string): string {
  return path.replace(/[^a-zA-Z0-9._/-]/g, '_');
}

/**
 * Calculate estimated monthly cost based on current usage
 */
export function estimateMonthlyCost(
  dailyOperations: number,
  averageBlobSize: number,
  cacheHitRate: number = 0.8
): number {
  const COST_LIMITS = {
    STORAGE_PER_GB: 0.023,
    SIMPLE_OPERATIONS: 0.40,
    ADVANCED_OPERATIONS: 5.00,
    DATA_TRANSFER: 0.050,
    FAST_ORIGIN_TRANSFER: 0.06
  };
  
  const dailyStorageGB = (dailyOperations * averageBlobSize) / (1024 * 1024 * 1024);
  const monthlyStorageGB = dailyStorageGB * 30;
  
  const monthlyOperations = dailyOperations * 30;
  const cacheHits = monthlyOperations * cacheHitRate;
  const cacheMisses = monthlyOperations - cacheHits;
  
  const storageCost = monthlyStorageGB * COST_LIMITS.STORAGE_PER_GB;
  const simpleOpsCost = (cacheHits / 1000000) * COST_LIMITS.SIMPLE_OPERATIONS;
  const advancedOpsCost = (dailyOperations * 30 / 1000000) * COST_LIMITS.ADVANCED_OPERATIONS; // Put operations
  const transferCost = monthlyStorageGB * COST_LIMITS.DATA_TRANSFER;
  const fastOriginCost = (cacheMisses * averageBlobSize / (1024 * 1024 * 1024)) * COST_LIMITS.FAST_ORIGIN_TRANSFER;
  
  return storageCost + simpleOpsCost + advancedOpsCost + transferCost + fastOriginCost;
}

/**
 * Get time-based bucket for grouping operations
 */
export function getTimeBucket(timestamp: number, interval: 'hour' | 'day' | 'week' | 'month'): string {
  const date = new Date(timestamp);
  
  switch (interval) {
    case 'hour':
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:00`;
    case 'day':
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    case 'week':
      const weekStart = new Date(date.getTime() - (date.getDay() * 24 * 60 * 60 * 1000));
      return `${weekStart.getFullYear()}-W${Math.ceil(weekStart.getDate() / 7)}`;
    case 'month':
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    default:
      return date.toISOString().split('T')[0];
  }
}

/**
 * Debounce function for reducing frequent operations
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Throttle function for limiting operation frequency
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as any;
  if (typeof obj === 'object') {
    const cloned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  return obj;
}

/**
 * Validate environment variable
 */
export function validateEnvVar(
  value: string | undefined,
  allowedValues: string[],
  defaultValue: string
): string {
  if (!value) return defaultValue;
  const normalized = value.toLowerCase();
  return allowedValues.includes(normalized) ? normalized : defaultValue;
}

/**
 * Create retry function with exponential backoff
 */
export function createRetryFunction<T>(
  maxAttempts: number = 3,
  baseDelay: number = 1000
) {
  return async function retry(fn: () => Promise<T>): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxAttempts) {
          throw lastError;
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  };
}
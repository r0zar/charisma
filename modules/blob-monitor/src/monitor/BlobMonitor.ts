/**
 * Main Blob Monitor Class
 * Wraps Vercel Blob operations with monitoring and size enforcement
 */

import { put, head, list, copy, del } from '@vercel/blob';
import type {
  BlobMonitorConfig,
  BlobOperation,
  BlobSizeWarning,
  BlobAlert,
  MonitoringStats,
  EnforcementLevel,
  BlobInfo
} from '../types';
import {
  BlobMonitorError,
  BlobSizeError,
  BLOB_SIZE_LIMITS,
  COST_LIMITS
} from '../types';
import { StorageCapacityTracker } from '../capacity/StorageCapacityTracker';
import { CostCalculator } from '../cost/CostCalculator';
import { generateOperationId, formatBytes, formatCost } from '../utils/helpers';

export class BlobMonitor {
  private config: Required<BlobMonitorConfig>;
  private capacityTracker: StorageCapacityTracker;
  private costCalculator: CostCalculator;
  private operationHistory: BlobOperation[] = [];
  private alerts: BlobAlert[] = [];
  private stats: MonitoringStats;

  constructor(config: BlobMonitorConfig) {
    this.config = {
      serviceName: config.serviceName,
      enforcementLevel: config.enforcementLevel || this.getEnforcementFromEnv(),
      sizeThresholds: {
        warning: BLOB_SIZE_LIMITS.WARNING_THRESHOLD,
        error: BLOB_SIZE_LIMITS.ERROR_THRESHOLD,
        critical: BLOB_SIZE_LIMITS.CACHE_LIMIT,
        ...config.sizeThresholds
      },
      costThresholds: {
        dailyWarning: 5.00,
        monthlyWarning: 50.00,
        ...config.costThresholds
      },
      enableCostTracking: config.enableCostTracking ?? true,
      enableCapacityTracking: config.enableCapacityTracking ?? true,
      cacheTTL: config.cacheTTL || 5 * 60 * 1000 // 5 minutes
    };

    this.capacityTracker = new StorageCapacityTracker(this.config.serviceName);
    this.costCalculator = new CostCalculator();
    this.stats = this.initializeStats();
  }

  // === Wrapped Blob Operations ===

  /**
   * Monitored put operation with size enforcement
   */
  async put(
    pathname: string,
    bodyOrOptions: any,
    options?: any
  ) {
    const operationId = generateOperationId();
    const timestamp = Date.now();

    try {
      // Calculate payload size
      const payloadSize = this.calculatePayloadSize(bodyOrOptions);

      // Validate size before upload
      this.validateBlobSize(pathname, payloadSize);

      // Record operation
      const operation: BlobOperation = {
        type: 'put',
        path: pathname,
        size: payloadSize,
        timestamp,
        serviceName: this.config.serviceName,
        operationId
      };

      // Perform the actual upload
      const result = await put(pathname, bodyOrOptions, options);

      // Update tracking
      await this.recordOperation(operation);
      await this.updateCapacityTracking(pathname, payloadSize);

      return result;
    } catch (error) {
      this.recordError(operationId, error);
      throw error;
    }
  }

  /**
   * Monitored head operation
   */
  async head(pathname: string) {
    const operationId = generateOperationId();
    const timestamp = Date.now();

    try {
      const result = await head(pathname);

      const operation: BlobOperation = {
        type: 'head',
        path: pathname,
        timestamp,
        serviceName: this.config.serviceName,
        operationId
      };

      await this.recordOperation(operation);
      return result;
    } catch (error) {
      this.recordError(operationId, error);
      throw error;
    }
  }

  /**
   * Monitored list operation
   */
  async list(options?: any) {
    const operationId = generateOperationId();
    const timestamp = Date.now();

    try {
      const result = await list(options);

      const operation: BlobOperation = {
        type: 'list',
        path: 'list-operation',
        timestamp,
        serviceName: this.config.serviceName,
        operationId
      };

      await this.recordOperation(operation);
      return result;
    } catch (error) {
      this.recordError(operationId, error);
      throw error;
    }
  }

  /**
   * Monitored copy operation
   */
  async copy(
    fromUrl: string,
    toPathname: string,
    options?: any
  ) {
    const operationId = generateOperationId();
    const timestamp = Date.now();

    try {
      const result = await copy(fromUrl, toPathname, options);

      const operation: BlobOperation = {
        type: 'copy',
        path: toPathname,
        timestamp,
        serviceName: this.config.serviceName,
        operationId
      };

      await this.recordOperation(operation);
      return result;
    } catch (error) {
      this.recordError(operationId, error);
      throw error;
    }
  }

  /**
   * Monitored delete operation
   */
  async delete(pathname: string | string[]) {
    const operationId = generateOperationId();
    const timestamp = Date.now();

    try {
      const result = await del(pathname);

      const paths = Array.isArray(pathname) ? pathname : [pathname];

      for (const path of paths) {
        const operation: BlobOperation = {
          type: 'delete',
          path,
          timestamp,
          serviceName: this.config.serviceName,
          operationId
        };

        await this.recordOperation(operation);
        await this.removeFromCapacityTracking(path);
      }

      return result;
    } catch (error) {
      this.recordError(operationId, error);
      throw error;
    }
  }

  /**
   * Monitored fetch operation for existing blobs
   */
  async fetch(url: string): Promise<Response> {
    const operationId = generateOperationId();
    const timestamp = Date.now();

    try {
      const response = await fetch(url);

      // Determine if it was a cache hit or miss
      const cacheHit = response.headers.get('x-vercel-cache') === 'HIT';

      const operation: BlobOperation = {
        type: 'fetch',
        path: url,
        timestamp,
        serviceName: this.config.serviceName,
        cacheHit,
        operationId
      };

      await this.recordOperation(operation);
      return response;
    } catch (error) {
      this.recordError(operationId, error);
      throw error;
    }
  }

  /**
   * Convenience alias for fetch() method
   */
  get = this.fetch;

  // === Size Validation ===

  /**
   * Validate blob size against configured limits
   */
  private validateBlobSize(pathname: string, size: number): void {
    const { sizeThresholds, enforcementLevel } = this.config;

    // Progressive warnings
    if (size > sizeThresholds.warning) {
      const percentage = (size / BLOB_SIZE_LIMITS.CACHE_LIMIT) * 100;
      const warning: BlobSizeWarning = {
        path: pathname,
        size,
        threshold: sizeThresholds.warning,
        percentage,
        message: `Blob approaching 512MB limit (${formatBytes(size)} - ${percentage.toFixed(1)}%)`,
        timestamp: Date.now()
      };

      console.warn(`⚠️  ${warning.message}`);
      this.recordAlert('warning', 'size', warning.message, { path: pathname, size, threshold: sizeThresholds.warning });
    }

    if (size > sizeThresholds.error) {
      const percentage = (size / BLOB_SIZE_LIMITS.CACHE_LIMIT) * 100;
      const message = `Blob at ${percentage.toFixed(1)}% of 512MB limit (${formatBytes(size)})`;
      console.error(`🚨 ${message}`);
      this.recordAlert('error', 'size', message, { path: pathname, size, threshold: sizeThresholds.error });
    }

    // Critical size enforcement
    if (size > sizeThresholds.critical) {
      const message = `CRITICAL: Blob ${pathname} exceeds 512MB (${formatBytes(size)}) - will cause cache MISS on every access!`;

      switch (enforcementLevel) {
        case 'block':
          this.recordAlert('critical', 'size', message, { path: pathname, size, threshold: sizeThresholds.critical });
          throw new BlobSizeError(pathname, size, sizeThresholds.critical);

        case 'warn':
          console.error(`🚨 ${message}`);
          console.error(`💡 Set BLOB_512MB_ENFORCEMENT=block to prevent this`);
          console.error(`💰 This blob will incur Simple Operation + Fast Origin Transfer charges on every access`);
          this.recordAlert('critical', 'size', message, { path: pathname, size, threshold: sizeThresholds.critical });
          break;

        case 'silent':
          // Still record the alert for tracking
          this.recordAlert('critical', 'size', message, { path: pathname, size, threshold: sizeThresholds.critical });
          break;
      }
    }
  }

  /**
   * Calculate payload size for different input types
   */
  private calculatePayloadSize(payload: any): number {
    if (typeof payload === 'string') {
      return Buffer.byteLength(payload, 'utf8');
    }

    if (payload instanceof Buffer) {
      return payload.length;
    }

    if (payload instanceof ArrayBuffer) {
      return payload.byteLength;
    }

    if (payload && typeof payload === 'object') {
      return Buffer.byteLength(JSON.stringify(payload), 'utf8');
    }

    return 0;
  }

  // === Operation Recording ===

  /**
   * Record a blob operation
   */
  private async recordOperation(operation: BlobOperation): Promise<void> {
    this.operationHistory.push(operation);
    this.updateStats(operation);

    // Keep only recent operations in memory
    if (this.operationHistory.length > 1000) {
      this.operationHistory = this.operationHistory.slice(-500);
    }

    // Update capacity tracking if enabled
    if (this.config.enableCapacityTracking) {
      await this.capacityTracker.recordOperation(operation);
    }

    // Update cost tracking if enabled
    if (this.config.enableCostTracking) {
      await this.costCalculator.recordOperation(operation);
    }
  }

  /**
   * Record an error
   */
  private recordError(operationId: string, error: any): void {
    this.recordAlert('error', 'performance', `Operation ${operationId} failed: ${error.message}`, {
      serviceName: this.config.serviceName
    });
  }

  /**
   * Record an alert
   */
  private recordAlert(
    level: 'info' | 'warning' | 'error' | 'critical',
    type: 'size' | 'cost' | 'performance' | 'capacity',
    message: string,
    details: any
  ): void {
    const alert: BlobAlert = {
      level,
      type,
      message,
      details: {
        ...details,
        serviceName: this.config.serviceName
      },
      timestamp: Date.now(),
      resolved: false
    };

    this.alerts.push(alert);

    // Keep only recent alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-50);
    }
  }

  // === Capacity Tracking ===

  /**
   * Update capacity tracking for a blob
   */
  private async updateCapacityTracking(pathname: string, size: number): Promise<void> {
    if (!this.config.enableCapacityTracking) return;

    const blobInfo: BlobInfo = {
      path: pathname,
      size,
      createdAt: Date.now(),
      lastModified: Date.now(),
      serviceName: this.config.serviceName,
      cacheStatus: size > BLOB_SIZE_LIMITS.CACHE_LIMIT ? 'miss' : 'unknown',
      accessCount: 1,
      totalTransferBytes: size
    };

    await this.capacityTracker.updateBlobInfo(blobInfo);
  }

  /**
   * Remove blob from capacity tracking
   */
  private async removeFromCapacityTracking(pathname: string): Promise<void> {
    if (!this.config.enableCapacityTracking) return;
    await this.capacityTracker.removeBlobInfo(pathname);
  }

  // === Stats & Monitoring ===

  /**
   * Update internal statistics
   */
  private updateStats(operation: BlobOperation): void {
    this.stats.totalOperations++;
    this.stats.operationBreakdown[operation.type] = (this.stats.operationBreakdown[operation.type] || 0) + 1;

    if (operation.cacheHit !== undefined) {
      // Update cache hit rate calculation
      const totalCacheableOps = this.operationHistory.filter(op => op.cacheHit !== undefined).length;
      const hits = this.operationHistory.filter(op => op.cacheHit === true).length;
      this.stats.cacheHitRate = totalCacheableOps > 0 ? (hits / totalCacheableOps) * 100 : 0;
    }
  }

  /**
   * Initialize statistics
   */
  private initializeStats(): MonitoringStats {
    return {
      totalOperations: 0,
      operationBreakdown: {},
      cacheHitRate: 0,
      averageResponseTime: 0,
      totalCost: 0,
      costBreakdown: {
        storage: 0,
        simpleOperations: 0,
        advancedOperations: 0,
        dataTransfer: 0,
        fastOriginTransfer: 0,
        total: 0
      },
      alerts: [],
      uptime: Date.now(),
      lastReset: Date.now()
    };
  }

  // === Utility Methods ===

  /**
   * Get enforcement level from environment variable
   */
  private getEnforcementFromEnv(): EnforcementLevel {
    const env = process.env.BLOB_512MB_ENFORCEMENT?.toLowerCase();
    if (env === 'block' || env === 'warn' || env === 'silent') {
      return env;
    }
    return 'warn'; // Safe default
  }

  /**
   * Get current monitoring statistics
   */
  getStats(): MonitoringStats {
    return {
      ...this.stats,
      alerts: [...this.alerts]
    };
  }

  /**
   * Get recent operations
   */
  getRecentOperations(limit: number = 10): BlobOperation[] {
    return this.operationHistory.slice(-limit);
  }

  /**
   * Get active alerts
   */
  getAlerts(): BlobAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Clear resolved alerts
   */
  clearResolvedAlerts(): void {
    this.alerts = this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = this.initializeStats();
    this.operationHistory = [];
    this.alerts = [];
  }
}
/**
 * Balance Snapshot Scheduler - Automated historical snapshot creation
 */

import { KVBalanceStore } from '../storage/KVBalanceStore';
import { SnapshotStorage } from './SnapshotStorage';
import type {
  BalanceSnapshot,
  SchedulerConfig,
  SchedulerStats,
  SnapshotIndex,
  Snapshot
} from '../types/snapshot-types';
import {
  SnapshotSchedulerError,
  DEFAULT_SCHEDULER_CONFIG,
  SNAPSHOT_CONSTANTS
} from '../types/snapshot-types';
import {
  createSnapshotMetadata,
  compressSnapshot
} from '../utils/snapshot-utils';
import { kv } from '@vercel/kv';

export class BalanceSnapshotScheduler {
  private kvStore: KVBalanceStore;
  private snapshotStorage: SnapshotStorage;
  private config: SchedulerConfig;

  // KV keys for persistent state
  private readonly SCHEDULER_STATE_KEY = 'balances:scheduler:state';
  private readonly SCHEDULER_STATS_KEY = 'balances:scheduler:stats';
  private readonly SCHEDULER_CONFIG_KEY = 'balances:scheduler:config';

  constructor(
    kvStore: KVBalanceStore,
    snapshotStorage: SnapshotStorage,
    config?: Partial<SchedulerConfig>
  ) {
    this.kvStore = kvStore;
    this.snapshotStorage = snapshotStorage;
    this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config };
  }

  // === State Management ===

  /**
   * Get persistent scheduler state
   */
  private async getSchedulerState(): Promise<{
    isRunning: boolean;
    lastSnapshotTime: number;
    nextSnapshotTime: number;
  }> {
    try {
      const state = await kv.get<any>(this.SCHEDULER_STATE_KEY);
      return state || {
        isRunning: false,
        lastSnapshotTime: 0,
        nextSnapshotTime: 0
      };
    } catch (error) {
      console.warn('Failed to get scheduler state from KV:', error);
      return {
        isRunning: false,
        lastSnapshotTime: 0,
        nextSnapshotTime: 0
      };
    }
  }

  /**
   * Set persistent scheduler state
   */
  private async setSchedulerState(state: {
    isRunning: boolean;
    lastSnapshotTime: number;
    nextSnapshotTime: number;
  }): Promise<void> {
    try {
      await kv.set(this.SCHEDULER_STATE_KEY, state);
    } catch (error) {
      console.warn('Failed to set scheduler state in KV:', error);
    }
  }

  /**
   * Get persistent scheduler stats
   */
  private async getSchedulerStats(): Promise<SchedulerStats> {
    try {
      const stats = await kv.get<SchedulerStats>(this.SCHEDULER_STATS_KEY);
      return stats || {
        lastSnapshotTime: 0,
        lastSnapshotDuration: 0,
        totalSnapshots: 0,
        failedSnapshots: 0,
        averageProcessingTime: 0,
        averageCompressionRatio: 0,
        nextSnapshotTime: 0
      };
    } catch (error) {
      console.warn('Failed to get scheduler stats from KV:', error);
      return {
        lastSnapshotTime: 0,
        lastSnapshotDuration: 0,
        totalSnapshots: 0,
        failedSnapshots: 0,
        averageProcessingTime: 0,
        averageCompressionRatio: 0,
        nextSnapshotTime: 0
      };
    }
  }

  /**
   * Set persistent scheduler stats
   */
  private async setSchedulerStats(stats: SchedulerStats): Promise<void> {
    try {
      await kv.set(this.SCHEDULER_STATS_KEY, stats);
    } catch (error) {
      console.warn('Failed to set scheduler stats in KV:', error);
    }
  }

  /**
   * Get persistent scheduler config
   */
  private async getSchedulerConfig(): Promise<SchedulerConfig> {
    try {
      const config = await kv.get<SchedulerConfig>(this.SCHEDULER_CONFIG_KEY);
      return config || this.config;
    } catch (error) {
      console.warn('Failed to get scheduler config from KV:', error);
      return this.config;
    }
  }

  /**
   * Set persistent scheduler config
   */
  private async setSchedulerConfig(config: SchedulerConfig): Promise<void> {
    try {
      await kv.set(this.SCHEDULER_CONFIG_KEY, config);
    } catch (error) {
      console.warn('Failed to set scheduler config in KV:', error);
    }
  }

  // === Scheduler Methods ===

  /**
   * Check if scheduler should run based on config and timing
   */
  async shouldTakeSnapshot(): Promise<boolean> {
    const config = await this.getSchedulerConfig();
    const state = await this.getSchedulerState();

    if (!config.enabled) {
      return false;
    }

    const now = Date.now();
    const timeSinceLastSnapshot = now - state.lastSnapshotTime;

    // Take snapshot if enough time has passed
    return timeSinceLastSnapshot >= config.interval;
  }

  /**
   * Check if it's time for the next scheduled snapshot
   */
  async isTimeForSnapshot(): Promise<boolean> {
    const state = await this.getSchedulerState();
    const now = Date.now();

    return now >= state.nextSnapshotTime;
  }

  /**
   * Initialize scheduler state in KV
   */
  async initializeScheduler(): Promise<void> {
    const config = await this.getSchedulerConfig();
    const state = await this.getSchedulerState();

    // Initialize config if not exists
    if (!await kv.exists(this.SCHEDULER_CONFIG_KEY)) {
      await this.setSchedulerConfig(this.config);
    }

    // Initialize state if not exists
    if (!await kv.exists(this.SCHEDULER_STATE_KEY)) {
      await this.setSchedulerState({
        isRunning: false,
        lastSnapshotTime: 0,
        nextSnapshotTime: Date.now() + config.interval
      });
    }

    // Initialize stats if not exists
    if (!await kv.exists(this.SCHEDULER_STATS_KEY)) {
      await this.setSchedulerStats({
        lastSnapshotTime: 0,
        lastSnapshotDuration: 0,
        totalSnapshots: 0,
        failedSnapshots: 0,
        averageProcessingTime: 0,
        averageCompressionRatio: 0,
        nextSnapshotTime: Date.now() + config.interval
      });
    }
  }

  /**
   * Create a snapshot immediately
   */
  async createSnapshot(): Promise<Snapshot> {
    const startTime = Date.now();
    const timestamp = startTime;

    try {
      console.log(`Creating snapshot at ${new Date(timestamp).toISOString()}`);

      // Get all current balances from KV
      const currentBalances = await this.kvStore.getAllCurrentBalances();

      // Calculate totals
      const totalAddresses = Object.keys(currentBalances).length;
      let totalContracts = 0;

      for (const addressBalances of Object.values(currentBalances)) {
        totalContracts += Object.keys(addressBalances).length;
      }

      // Create compression result for metadata
      const testCompressionResult = await compressSnapshot({
        timestamp,
        totalAddresses,
        totalContracts,
        balances: currentBalances,
        metadata: {
          createdAt: startTime,
          processingTime: 0,
          compressionRatio: 0,
          originalSize: 0,
          compressedSize: 0,
          version: SNAPSHOT_CONSTANTS.VERSION
        }
      });

      // Create snapshot
      const snapshot: BalanceSnapshot = {
        timestamp,
        totalAddresses,
        totalContracts,
        balances: currentBalances,
        metadata: createSnapshotMetadata(
          Date.now() - startTime,
          testCompressionResult
        )
      };

      // Store snapshot
      const result = await this.snapshotStorage.storeSnapshot(snapshot);
      const duration = Date.now() - startTime;

      // Update snapshot index
      await this.updateSnapshotIndex(timestamp);

      // Update stats in KV
      await this.updatePersistentStats({
        lastSnapshotTime: timestamp,
        lastSnapshotDuration: duration,
        processingTime: duration,
        compressionRatio: result.compressionResult.ratio,
        success: true
      });

      // Update state for next snapshot
      const config = await this.getSchedulerConfig();
      await this.setSchedulerState({
        isRunning: false,
        lastSnapshotTime: timestamp,
        nextSnapshotTime: timestamp + config.interval
      });

      console.log(`Snapshot created successfully: ${result.key} (${duration}ms)`);

      return {
        timestamp,
        key: result.key,
        success: true,
        duration,
        compressionRatio: result.compressionResult.ratio
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      // Update failure stats in KV
      await this.updatePersistentStats({
        lastSnapshotTime: timestamp,
        lastSnapshotDuration: duration,
        processingTime: duration,
        compressionRatio: 0,
        success: false
      });

      console.error(`Failed to create snapshot:`, error);

      throw new SnapshotSchedulerError(
        `Failed to create snapshot: ${error}`,
        { timestamp, duration }
      );
    }
  }

  /**
   * Update persistent stats in KV
   */
  private async updatePersistentStats(update: {
    lastSnapshotTime: number;
    lastSnapshotDuration: number;
    processingTime: number;
    compressionRatio: number;
    success: boolean;
  }): Promise<void> {
    try {
      const currentStats = await this.getSchedulerStats();

      // Update basic stats
      currentStats.lastSnapshotTime = update.lastSnapshotTime;
      currentStats.lastSnapshotDuration = update.lastSnapshotDuration;
      currentStats.nextSnapshotTime = update.lastSnapshotTime + (await this.getSchedulerConfig()).interval;

      if (update.success) {
        currentStats.totalSnapshots++;

        // Update averages
        const totalProcessingTime = currentStats.averageProcessingTime * (currentStats.totalSnapshots - 1) + update.processingTime;
        currentStats.averageProcessingTime = totalProcessingTime / currentStats.totalSnapshots;

        const totalCompressionRatio = currentStats.averageCompressionRatio * (currentStats.totalSnapshots - 1) + update.compressionRatio;
        currentStats.averageCompressionRatio = totalCompressionRatio / currentStats.totalSnapshots;
      } else {
        currentStats.failedSnapshots++;
      }

      await this.setSchedulerStats(currentStats);
    } catch (error) {
      console.warn('Failed to update persistent stats:', error);
    }
  }

  /**
   * Retry failed snapshot with exponential backoff
   */
  async retrySnapshot(): Promise<void> {
    const config = await this.getSchedulerConfig();

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        console.log(`Retrying snapshot creation (attempt ${attempt}/${config.maxRetries})`);

        await new Promise(resolve => setTimeout(resolve, config.retryDelay * attempt));
        await this.createSnapshot();

        console.log('Snapshot retry successful');
        return;

      } catch (error) {
        console.error(`Retry attempt ${attempt} failed:`, error);

        if (attempt === config.maxRetries) {
          console.error('All retry attempts failed');
        }
      }
    }
  }

  /**
   * Update snapshot index in KV
   */
  private async updateSnapshotIndex(timestamp: number): Promise<void> {
    try {
      const indexKey = SNAPSHOT_CONSTANTS.INDEX_KEY;
      const existing = await kv.get<SnapshotIndex>(indexKey);

      const timestamps = existing?.timestamps || [];
      timestamps.push(timestamp);
      timestamps.sort((a: number, b: number) => a - b); // Keep sorted

      const snapshotIndex: SnapshotIndex = {
        timestamps,
        count: timestamps.length,
        oldest: timestamps[0] || 0,
        newest: timestamps[timestamps.length - 1] || 0,
        lastUpdated: Date.now()
      };

      await kv.set(indexKey, snapshotIndex);

    } catch (error) {
      console.warn('Failed to update snapshot index:', error);
    }
  }

  /**
   * Enable/disable scheduler 
   */
  async setSchedulerEnabled(enabled: boolean): Promise<void> {
    const config = await this.getSchedulerConfig();
    config.enabled = enabled;
    await this.setSchedulerConfig(config);

    console.log(`Scheduler ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get scheduler configuration
   */
  async getConfig(): Promise<SchedulerConfig> {
    return await this.getSchedulerConfig();
  }

  /**
   * Update scheduler configuration
   */
  async updateConfig(newConfig: Partial<SchedulerConfig>): Promise<void> {
    const currentConfig = await this.getSchedulerConfig();
    const updatedConfig = { ...currentConfig, ...newConfig };

    await this.setSchedulerConfig(updatedConfig);

    // Update next snapshot time if interval changed
    if (newConfig.interval !== undefined) {
      const state = await this.getSchedulerState();
      const newNextTime = state.lastSnapshotTime + newConfig.interval;
      await this.setSchedulerState({
        ...state,
        nextSnapshotTime: newNextTime
      });
    }

    console.log('Updated scheduler configuration');
  }

  /**
   * Get scheduler statistics
   */
  async getStats(): Promise<SchedulerStats> {
    return await this.getSchedulerStats();
  }

  /**
   * Get detailed scheduler status
   */
  async getStatus(): Promise<{
    isRunning: boolean;
    config: SchedulerConfig;
    stats: SchedulerStats;
    nextSnapshotIn: number;
  }> {
    const [state, config, stats] = await Promise.all([
      this.getSchedulerState(),
      this.getSchedulerConfig(),
      this.getSchedulerStats()
    ]);

    return {
      isRunning: state.isRunning,
      config,
      stats,
      nextSnapshotIn: Math.max(0, stats.nextSnapshotTime - Date.now())
    };
  }

  /**
   * Check if scheduler is healthy
   */
  async isHealthy(): Promise<boolean> {
    const [state, config, stats] = await Promise.all([
      this.getSchedulerState(),
      this.getSchedulerConfig(),
      this.getSchedulerStats()
    ]);

    if (!config.enabled) {
      return true; // Healthy if disabled
    }

    const now = Date.now();
    const timeSinceLastSnapshot = now - stats.lastSnapshotTime;
    const maxAge = config.maxSnapshotAge;

    // Check if last snapshot is too old
    if (stats.lastSnapshotTime > 0 && timeSinceLastSnapshot > maxAge) {
      return false;
    }

    // Check failure rate
    const failureRate = stats.totalSnapshots > 0
      ? stats.failedSnapshots / stats.totalSnapshots
      : 0;

    return failureRate < 0.1; // Less than 10% failure rate
  }

  /**
   * Get snapshot index from KV
   */
  async getSnapshotIndex(): Promise<SnapshotIndex | null> {
    try {
      return await kv.get<SnapshotIndex>(SNAPSHOT_CONSTANTS.INDEX_KEY);
    } catch (error) {
      console.warn('Failed to get snapshot index:', error);
      return null;
    }
  }

  /**
   * Clean up old snapshots based on retention policy
   */
  async cleanupOldSnapshots(maxAge: number): Promise<{
    deleted: number;
    failed: number;
    errors: string[];
  }> {
    try {
      const index = await this.getSnapshotIndex();
      if (!index) {
        return { deleted: 0, failed: 0, errors: [] };
      }

      const cutoffTime = Date.now() - maxAge;
      const oldTimestamps = index.timestamps.filter(ts => ts < cutoffTime);

      if (oldTimestamps.length === 0) {
        return { deleted: 0, failed: 0, errors: [] };
      }

      console.log(`Cleaning up ${oldTimestamps.length} old snapshots`);

      // Delete old snapshots
      const result = await this.snapshotStorage.deleteSnapshots(oldTimestamps);

      // Update index
      const remainingTimestamps = index.timestamps.filter(ts => ts >= cutoffTime);
      const updatedIndex: SnapshotIndex = {
        timestamps: remainingTimestamps,
        count: remainingTimestamps.length,
        oldest: remainingTimestamps[0] || 0,
        newest: remainingTimestamps[remainingTimestamps.length - 1] || 0,
        lastUpdated: Date.now()
      };

      await kv.set(SNAPSHOT_CONSTANTS.INDEX_KEY, updatedIndex);

      return result;

    } catch (error) {
      console.error('Failed to cleanup old snapshots:', error);
      return { deleted: 0, failed: 1, errors: [`Cleanup failed: ${error}`] };
    }
  }
}
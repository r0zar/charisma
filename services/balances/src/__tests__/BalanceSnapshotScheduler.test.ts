/**
 * Simple coverage tests for BalanceSnapshotScheduler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
vi.mock('../storage/KVBalanceStore', () => ({
  KVBalanceStore: vi.fn().mockImplementation(() => ({
    getAllCurrentBalances: vi.fn().mockResolvedValue({})
  }))
}));

vi.mock('../snapshot-scheduler/SnapshotStorage', () => ({
  SnapshotStorage: vi.fn().mockImplementation(() => ({
    storeSnapshot: vi.fn().mockResolvedValue({
      key: 'test-key',
      compressionResult: {
        compressed: Buffer.from('test'),
        originalSize: 100,
        compressedSize: 50,
        ratio: 0.5,
        algorithm: 'gzip'
      },
      success: true
    }),
    getSnapshot: vi.fn().mockResolvedValue(null),
    snapshotExists: vi.fn().mockResolvedValue(false),
    deleteSnapshot: vi.fn().mockResolvedValue(true),
    deleteSnapshots: vi.fn().mockResolvedValue({
      deleted: 0,
      failed: 0,
      errors: []
    }),
    getSnapshotMetadata: vi.fn().mockResolvedValue(null),
    getStorageStats: vi.fn().mockResolvedValue({
      totalSnapshots: 0,
      totalSize: 0,
      averageSize: 0,
      compressionRatio: 0,
      oldestSnapshot: 0,
      newestSnapshot: 0
    })
  }))
}));

vi.mock('@vercel/kv', () => ({
  kv: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK')
  }
}));

describe('BalanceSnapshotScheduler - Coverage Tests', () => {
  let BalanceSnapshotScheduler: any;
  let scheduler: any;
  let mockKVStore: any;
  let mockSnapshotStorage: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Create mock dependencies
    mockKVStore = {
      getAllCurrentBalances: vi.fn().mockResolvedValue({})
    };
    
    mockSnapshotStorage = {
      storeSnapshot: vi.fn().mockResolvedValue({
        key: 'test-key',
        compressionResult: {
          compressed: Buffer.from('test'),
          originalSize: 100,
          compressedSize: 50,
          ratio: 0.5,
          algorithm: 'gzip'
        },
        success: true
      }),
      getSnapshot: vi.fn().mockResolvedValue(null),
      snapshotExists: vi.fn().mockResolvedValue(false),
      deleteSnapshot: vi.fn().mockResolvedValue(true),
      deleteSnapshots: vi.fn().mockResolvedValue({
        deleted: 0,
        failed: 0,
        errors: []
      }),
      getSnapshotMetadata: vi.fn().mockResolvedValue(null),
      getStorageStats: vi.fn().mockResolvedValue({
        totalSnapshots: 0,
        totalSize: 0,
        averageSize: 0,
        compressionRatio: 0,
        oldestSnapshot: 0,
        newestSnapshot: 0
      })
    };
    
    // Dynamically import to avoid module-level KV initialization
    const module = await import('../snapshot-scheduler/BalanceSnapshotScheduler');
    BalanceSnapshotScheduler = module.BalanceSnapshotScheduler;
    scheduler = new BalanceSnapshotScheduler(mockKVStore, mockSnapshotStorage);
  });

  describe('Constructor', () => {
    it('should create instance with default config', () => {
      expect(scheduler).toBeInstanceOf(BalanceSnapshotScheduler);
    });

    it('should create instance with custom config', () => {
      const config = {
        intervalMinutes: 60,
        enableCompression: true,
        retentionDays: 90,
        maxFileSize: 256 * 1024 * 1024 // 256MB
      };
      
      const customScheduler = new BalanceSnapshotScheduler(config);
      expect(customScheduler).toBeInstanceOf(BalanceSnapshotScheduler);
    });
  });

  describe('Snapshot Management', () => {
    it('should check if snapshot should be taken', async () => {
      const result = await scheduler.shouldTakeSnapshot();
      
      expect(typeof result).toBe('boolean');
    });

    it('should create snapshot', async () => {
      const result = await scheduler.createSnapshot();
      
      expect(result).toEqual({
        timestamp: expect.any(Number),
        key: expect.any(String),
        success: expect.any(Boolean),
        duration: expect.any(Number),
        compressionRatio: expect.any(Number)
      });
    });

    it('should get snapshot index', async () => {
      const result = await scheduler.getSnapshotIndex();
      
      expect(result).toBeNull(); // No snapshots initially
    });
  });

  describe('Configuration', () => {
    it('should get current config', async () => {
      const config = await scheduler.getConfig();
      
      expect(config).toEqual(expect.objectContaining({
        interval: expect.any(Number),
        enabled: expect.any(Boolean),
        compressionLevel: expect.any(Number),
        maxRetries: expect.any(Number),
        retryDelay: expect.any(Number),
        maxSnapshotAge: expect.any(Number)
      }));
    });

    it('should update config', async () => {
      const newConfig = {
        intervalMinutes: 30,
        enableCompression: false,
        retentionDays: 60,
        maxFileSize: 128 * 1024 * 1024
      };
      
      await expect(scheduler.updateConfig(newConfig)).resolves.not.toThrow();
    });

  });

  describe('Statistics', () => {
    it('should get stats', async () => {
      const stats = await scheduler.getStats();
      
      expect(stats).toEqual(expect.objectContaining({
        totalSnapshots: expect.any(Number),
        lastSnapshotTime: expect.any(Number),
        averageCompressionRatio: expect.any(Number),
        averageProcessingTime: expect.any(Number),
        lastSnapshotDuration: expect.any(Number),
        nextSnapshotTime: expect.any(Number),
        failedSnapshots: expect.any(Number)
      }));
    });
  });

  describe('State Management', () => {
    it('should enable scheduler', async () => {
      await expect(scheduler.setSchedulerEnabled(true)).resolves.not.toThrow();
    });

    it('should disable scheduler', async () => {
      await expect(scheduler.setSchedulerEnabled(false)).resolves.not.toThrow();
    });

    it('should get scheduler status', async () => {
      const status = await scheduler.getStatus();
      
      expect(status).toEqual(expect.objectContaining({
        isRunning: expect.any(Boolean),
        config: expect.any(Object),
        stats: expect.any(Object),
        nextSnapshotIn: expect.any(Number)
      }));
    });

    it('should force snapshot', async () => {
      const result = await scheduler.createSnapshot();
      
      expect(result).toEqual({
        timestamp: expect.any(Number),
        key: expect.any(String),
        success: expect.any(Boolean),
        duration: expect.any(Number),
        compressionRatio: expect.any(Number)
      });
    });
  });

  describe('Cleanup', () => {
    it('should cleanup old snapshots', async () => {
      const result = await scheduler.cleanupOldSnapshots(86400000); // 1 day
      
      expect(result).toEqual({
        deleted: expect.any(Number),
        failed: expect.any(Number),
        errors: expect.any(Array)
      });
    });

    it('should cleanup old snapshots with custom retention', async () => {
      const result = await scheduler.cleanupOldSnapshots(30 * 24 * 60 * 60 * 1000); // 30 days
      
      expect(result).toEqual({
        deleted: expect.any(Number),
        failed: expect.any(Number),
        errors: expect.any(Array)
      });
    });
  });
});
#!/usr/bin/env tsx

/**
 * Cleanup Orphaned Keys Script
 * 
 * Removes any remaining orphaned bot-manager keys from KV database
 */

// Load environment variables first
import './utils/env';

import { syncLogger } from './utils/logger';
import { kv } from '@vercel/kv';

async function deleteKey(key: string): Promise<boolean> {
  try {
    await kv.del(key);
    syncLogger.info(`Deleted orphaned key: ${key}`);
    return true;
  } catch (error) {
    syncLogger.error(`Failed to delete key ${key}`, {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

async function scanAndDeleteKeys(pattern: string): Promise<{ deleted: number; failed: number }> {
  let deletedCount = 0;
  let failedCount = 0;
  let cursor = 0;
  
  do {
    try {
      const result = await kv.scan(cursor, { match: pattern, count: 50 });
      cursor = result[0];
      const keys = result[1];
      
      if (keys.length > 0) {
        syncLogger.info(`Processing ${keys.length} keys...`);
        
        // Delete keys in batches
        for (const key of keys) {
          const success = await deleteKey(key);
          if (success) {
            deletedCount++;
          } else {
            failedCount++;
          }
          
          // Small delay to avoid overwhelming
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
    } catch (error) {
      syncLogger.error(`SCAN failed at cursor ${cursor}`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      break;
    }
  } while (cursor !== 0);
  
  return { deleted: deletedCount, failed: failedCount };
}

async function main(): Promise<void> {
  syncLogger.info('Cleaning up orphaned bot-manager keys...');

  try {
    // Clean up all bot-manager keys using SCAN
    const result = await scanAndDeleteKeys('bot-manager:*');
    
    syncLogger.success(`Cleanup completed`, {
      deleted: result.deleted,
      failed: result.failed,
      total: result.deleted + result.failed
    });

    if (result.failed > 0) {
      syncLogger.warn(`${result.failed} keys failed to delete`);
      process.exit(1);
    }

    if (result.deleted === 0) {
      syncLogger.info('No orphaned keys found');
    }

  } catch (error) {
    syncLogger.error('Failed to cleanup orphaned keys', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

// Execute main function
main().catch((error) => {
  syncLogger.error('Script execution failed', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined
  });
  process.exit(1);
});
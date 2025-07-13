#!/usr/bin/env tsx

/**
 * Debug KV Keys Script
 * 
 * Inspects all remaining bot-manager keys in the KV database
 */

// Load environment variables first
import './utils/env';

import { syncLogger } from './utils/logger';
import { kv } from '@vercel/kv';

async function scanKeys(pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = 0;
  
  do {
    try {
      const result = await kv.scan(cursor, { match: pattern, count: 100 });
      cursor = result[0];
      keys.push(...result[1]);
    } catch (error) {
      syncLogger.error(`SCAN failed at cursor ${cursor}`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      break;
    }
  } while (cursor !== 0);
  
  return keys;
}

async function main(): Promise<void> {
  syncLogger.info('Checking all remaining bot-manager keys in KV...');

  try {
    // Get all bot-manager keys using SCAN
    const allKeys = await scanKeys('bot-manager:*');
    syncLogger.info(`Found ${allKeys.length} bot-manager keys in KV`);

    if (allKeys.length === 0) {
      syncLogger.info('No bot-manager keys found in KV');
      return;
    }

    // Show first 10 keys for inspection
    const sampleKeys = allKeys.slice(0, 10);
    syncLogger.info('Sample keys found:', { sampleKeys, totalCount: allKeys.length });

    // Check each sample key
    for (const key of sampleKeys) {
      try {
        const keyType = await kv.type(key);
        let data;
        
        // Get data based on type
        switch (keyType) {
          case 'string':
            data = await kv.get(key);
            break;
          case 'set':
            data = await kv.smembers(key);
            break;
          case 'list':
            data = await kv.lrange(key, 0, -1);
            break;
          case 'hash':
            data = await kv.hgetall(key);
            break;
          default:
            data = 'Unknown type';
        }

        syncLogger.info(`Key: ${key}`, {
          type: keyType,
          data: data
        });
      } catch (error) {
        syncLogger.error(`Failed to get data for key ${key}`, {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Count keys by type
    const keysByType: Record<string, string[]> = {};
    for (const key of allKeys) {
      const parts = key.split(':');
      const type = parts[2] || 'unknown';
      if (!keysByType[type]) keysByType[type] = [];
      keysByType[type].push(key);
    }

    syncLogger.info('Keys by type:', {
      summary: Object.fromEntries(
        Object.entries(keysByType).map(([type, keys]) => [type, keys.length])
      )
    });

  } catch (error) {
    syncLogger.error('Failed to inspect KV keys', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
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
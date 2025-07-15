/**
 * Activity ingestion pipeline
 * Pulls data from existing systems (orders, swaps, bots, etc.) and converts to unified timeline
 */

import { kv } from '@vercel/kv';
import { ActivityItem } from './types';
import { 
  adaptLimitOrder, 
  adaptSwapRecord, 
  adaptTwitterTrigger, 
  adaptBotActivity, 
  adaptPerpetualPosition 
} from './adapters';
import { addActivity, updateActivity } from './storage';
import type { LimitOrder } from '../orders/types';
import type { SwapRecord } from '../swaps/types';
import type { TwitterTriggerExecution } from '../twitter-triggers/types';
import type { BotActivityRecord } from '../../types/bot';
import type { PerpetualPosition } from '../perps/types';

// Source data hash keys (from existing systems)
const SOURCE_KEYS = {
  ORDERS: 'orders',
  SWAPS: 'swap-records',
  PERPS: 'perpetual_positions',
  BOT_ACTIVITIES: 'bot_activity',
  TWITTER_EXECUTIONS: 'twitter_executions:all' // This is a set, not hash
} as const;

/**
 * Ingest orders from existing order system
 */
async function ingestOrders(): Promise<ActivityItem[]> {
  try {
    console.log('Ingesting orders...');
    const orderData = await kv.hgetall(SOURCE_KEYS.ORDERS);
    
    if (!orderData) {
      console.log('No order data found');
      return [];
    }
    
    const activities: ActivityItem[] = [];
    
    for (const [uuid, orderJson] of Object.entries(orderData)) {
      try {
        const order = JSON.parse(orderJson as string) as LimitOrder;
        const activity = adaptLimitOrder(order);
        activities.push(activity);
        
        // Store in activity timeline
        await addActivity(activity);
        
      } catch (error) {
        console.error(`Error processing order ${uuid}:`, error);
      }
    }
    
    console.log(`Ingested ${activities.length} orders`);
    return activities;
    
  } catch (error) {
    console.error('Error ingesting orders:', error);
    return [];
  }
}

/**
 * Ingest swaps from existing swap system
 */
async function ingestSwaps(): Promise<ActivityItem[]> {
  try {
    console.log('Ingesting swaps...');
    const swapData = await kv.hgetall(SOURCE_KEYS.SWAPS);
    
    if (!swapData) {
      console.log('No swap data found');
      return [];
    }
    
    const activities: ActivityItem[] = [];
    
    for (const [id, swapJson] of Object.entries(swapData)) {
      try {
        const swap = JSON.parse(swapJson as string) as SwapRecord;
        const activity = adaptSwapRecord(swap);
        activities.push(activity);
        
        // Store in activity timeline
        await addActivity(activity);
        
      } catch (error) {
        console.error(`Error processing swap ${id}:`, error);
      }
    }
    
    console.log(`Ingested ${activities.length} swaps`);
    return activities;
    
  } catch (error) {
    console.error('Error ingesting swaps:', error);
    return [];
  }
}

/**
 * Ingest perpetual positions
 */
async function ingestPerpetualPositions(): Promise<ActivityItem[]> {
  try {
    console.log('Ingesting perpetual positions...');
    const perpData = await kv.hgetall(SOURCE_KEYS.PERPS);
    
    if (!perpData) {
      console.log('No perp data found');
      return [];
    }
    
    const activities: ActivityItem[] = [];
    
    for (const [uuid, perpJson] of Object.entries(perpData)) {
      try {
        const position = JSON.parse(perpJson as string) as PerpetualPosition;
        const activity = adaptPerpetualPosition(position);
        activities.push(activity);
        
        // Store in activity timeline
        await addActivity(activity);
        
      } catch (error) {
        console.error(`Error processing perp position ${uuid}:`, error);
      }
    }
    
    console.log(`Ingested ${activities.length} perpetual positions`);
    return activities;
    
  } catch (error) {
    console.error('Error ingesting perpetual positions:', error);
    return [];
  }
}

/**
 * Ingest bot activities
 */
async function ingestBotActivities(): Promise<ActivityItem[]> {
  try {
    console.log('Ingesting bot activities...');
    const botData = await kv.hgetall(SOURCE_KEYS.BOT_ACTIVITIES);
    
    if (!botData) {
      console.log('No bot activity data found');
      return [];
    }
    
    const activities: ActivityItem[] = [];
    
    for (const [id, botJson] of Object.entries(botData)) {
      try {
        const botActivity = JSON.parse(botJson as string) as BotActivityRecord;
        const activity = adaptBotActivity(botActivity);
        activities.push(activity);
        
        // Store in activity timeline
        await addActivity(activity);
        
      } catch (error) {
        console.error(`Error processing bot activity ${id}:`, error);
      }
    }
    
    console.log(`Ingested ${activities.length} bot activities`);
    return activities;
    
  } catch (error) {
    console.error('Error ingesting bot activities:', error);
    return [];
  }
}

/**
 * Ingest Twitter trigger executions
 */
async function ingestTwitterExecutions(): Promise<ActivityItem[]> {
  try {
    console.log('Ingesting Twitter executions...');
    
    // Twitter executions are stored in a set, need to get individual keys
    const executionIds = await kv.smembers(SOURCE_KEYS.TWITTER_EXECUTIONS);
    
    if (!executionIds || executionIds.length === 0) {
      console.log('No Twitter execution data found');
      return [];
    }
    
    const activities: ActivityItem[] = [];
    
    // Fetch individual Twitter executions
    for (const executionId of executionIds) {
      try {
        const executionData = await kv.get(`twitter_execution:${executionId}`);
        
        if (executionData) {
          const execution = JSON.parse(executionData as string) as TwitterTriggerExecution;
          const activity = adaptTwitterTrigger(execution);
          activities.push(activity);
          
          // Store in activity timeline
          await addActivity(activity);
        }
        
      } catch (error) {
        console.error(`Error processing Twitter execution ${executionId}:`, error);
      }
    }
    
    console.log(`Ingested ${activities.length} Twitter executions`);
    return activities;
    
  } catch (error) {
    console.error('Error ingesting Twitter executions:', error);
    return [];
  }
}

/**
 * Run full ingestion pipeline
 */
export async function runFullIngestion(): Promise<{
  totalActivities: number;
  orders: number;
  swaps: number;
  perps: number;
  bots: number;
  twitter: number;
  errors: string[];
}> {
  console.log('Starting full activity ingestion pipeline...');
  
  const results = {
    totalActivities: 0,
    orders: 0,
    swaps: 0,
    perps: 0,
    bots: 0,
    twitter: 0,
    errors: [] as string[]
  };
  
  try {
    // Run all ingestion functions in parallel
    const [orders, swaps, perps, bots, twitter] = await Promise.allSettled([
      ingestOrders(),
      ingestSwaps(),
      ingestPerpetualPositions(),
      ingestBotActivities(),
      ingestTwitterExecutions()
    ]);
    
    // Process results
    if (orders.status === 'fulfilled') {
      results.orders = orders.value.length;
      results.totalActivities += orders.value.length;
    } else {
      results.errors.push(`Orders ingestion failed: ${orders.reason}`);
    }
    
    if (swaps.status === 'fulfilled') {
      results.swaps = swaps.value.length;
      results.totalActivities += swaps.value.length;
    } else {
      results.errors.push(`Swaps ingestion failed: ${swaps.reason}`);
    }
    
    if (perps.status === 'fulfilled') {
      results.perps = perps.value.length;
      results.totalActivities += perps.value.length;
    } else {
      results.errors.push(`Perps ingestion failed: ${perps.reason}`);
    }
    
    if (bots.status === 'fulfilled') {
      results.bots = bots.value.length;
      results.totalActivities += bots.value.length;
    } else {
      results.errors.push(`Bots ingestion failed: ${bots.reason}`);
    }
    
    if (twitter.status === 'fulfilled') {
      results.twitter = twitter.value.length;
      results.totalActivities += twitter.value.length;
    } else {
      results.errors.push(`Twitter ingestion failed: ${twitter.reason}`);
    }
    
    console.log('Full ingestion completed:', results);
    return results;
    
  } catch (error) {
    console.error('Error in full ingestion pipeline:', error);
    results.errors.push(`Pipeline error: ${error}`);
    return results;
  }
}

/**
 * Incremental ingestion - check for new/updated records since last sync
 */
export async function runIncrementalIngestion(lastSyncTimestamp?: number): Promise<{
  newActivities: number;
  updatedActivities: number;
  errors: string[];
}> {
  console.log('Starting incremental activity ingestion...');
  
  const results = {
    newActivities: 0,
    updatedActivities: 0,
    errors: [] as string[]
  };
  
  try {
    // For incremental sync, we'd need to track last modified timestamps
    // For now, we'll implement a simple approach that checks recent data
    
    const cutoffTime = lastSyncTimestamp || (Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
    
    // Check for new orders
    const orderData = await kv.hgetall(SOURCE_KEYS.ORDERS);
    if (orderData) {
      for (const [uuid, orderJson] of Object.entries(orderData)) {
        try {
          const order = JSON.parse(orderJson as string) as LimitOrder;
          const orderTime = new Date(order.createdAt).getTime();
          
          if (orderTime > cutoffTime) {
            const activity = adaptLimitOrder(order);
            await addActivity(activity);
            results.newActivities++;
          }
        } catch (error) {
          results.errors.push(`Error processing order ${uuid}: ${error}`);
        }
      }
    }
    
    // Similar logic for other data sources...
    // This would be expanded for production use
    
    console.log('Incremental ingestion completed:', results);
    return results;
    
  } catch (error) {
    console.error('Error in incremental ingestion:', error);
    results.errors.push(`Incremental sync error: ${error}`);
    return results;
  }
}

/**
 * Sync single record (for real-time updates)
 */
export async function syncSingleRecord(
  recordId: string, 
  sourceType: 'order' | 'swap' | 'twitter' | 'bot' | 'perp',
  operation: 'create' | 'update' | 'delete' = 'create'
): Promise<boolean> {
  try {
    if (operation === 'delete') {
      // Handle deletion
      const { deleteActivity } = await import('./storage');
      await deleteActivity(recordId);
      return true;
    }
    
    // Handle create/update
    let sourceData: any = null;
    
    switch (sourceType) {
      case 'order':
        sourceData = await kv.hget(SOURCE_KEYS.ORDERS, recordId);
        if (sourceData) {
          const order = JSON.parse(sourceData as string) as LimitOrder;
          const activity = adaptLimitOrder(order);
          
          if (operation === 'update') {
            await updateActivity(recordId, activity);
          } else {
            await addActivity(activity);
          }
        }
        break;
        
      case 'swap':
        sourceData = await kv.hget(SOURCE_KEYS.SWAPS, recordId);
        if (sourceData) {
          const swap = JSON.parse(sourceData as string) as SwapRecord;
          const activity = adaptSwapRecord(swap);
          
          if (operation === 'update') {
            await updateActivity(recordId, activity);
          } else {
            await addActivity(activity);
          }
        }
        break;
        
      // Add other source types as needed
    }
    
    return true;
    
  } catch (error) {
    console.error(`Error syncing ${sourceType} record ${recordId}:`, error);
    return false;
  }
}

/**
 * Clean up old activities (maintenance function)
 */
export async function cleanupOldActivities(olderThanDays = 90): Promise<number> {
  try {
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    
    // Get activities older than cutoff
    const oldActivityIds = await kv.zrange(
      'activity_timeline:by_time',
      0,
      cutoffTime,
      { byScore: true }
    );
    
    // Delete old activities
    let deletedCount = 0;
    for (const activityId of oldActivityIds) {
      try {
        const { deleteActivity } = await import('./storage');
        await deleteActivity(activityId as string);
        deletedCount++;
      } catch (error) {
        console.error(`Error deleting old activity ${activityId}:`, error);
      }
    }
    
    console.log(`Cleaned up ${deletedCount} old activities`);
    return deletedCount;
    
  } catch (error) {
    console.error('Error cleaning up old activities:', error);
    return 0;
  }
}
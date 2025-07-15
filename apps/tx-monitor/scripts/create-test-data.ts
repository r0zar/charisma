#!/usr/bin/env node

/**
 * Debugging script to create controlled test data for debugging
 * Usage: pnpm script scripts/create-test-data.ts
 */

import { logger } from './logger';
import { addActivity } from '../src/lib/activity-storage';
import { storeMetricsSnapshot } from '../src/lib/transaction-monitor';
import { kv } from '@vercel/kv';
import type { ActivityItem } from '../src/lib/activity-types';

async function createTestData() {
  await logger.info('🧪 Starting test data creation');
  
  try {
    // Step 1: Create test activities with various timestamps
    await logger.info('📊 Creating test activities...');
    
    const testActivities: ActivityItem[] = [
      {
        id: `test-activity-1-${Date.now()}`,
        type: 'instant_swap',
        timestamp: Date.now() - (6 * 60 * 60 * 1000), // 6 hours ago
        status: 'completed',
        owner: 'SP1TEST1234567890ABCDEF',
        fromToken: {
          symbol: 'STX',
          amount: '1000000',
          contractId: 'STX',
          decimals: 6,
          usdValue: 1000
        },
        toToken: {
          symbol: 'USDC',
          amount: '1000000',
          contractId: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard',
          decimals: 6,
          usdValue: 1000
        },
        txid: 'test-txid-1-' + Date.now(),
        replyCount: 0,
        hasReplies: false,
        metadata: {
          notes: 'Test activity for debugging - 6 hours ago',
          isTestData: true
        }
      },
      {
        id: `test-activity-2-${Date.now()}`,
        type: 'instant_swap',
        timestamp: Date.now() - (3 * 60 * 60 * 1000), // 3 hours ago
        status: 'pending',
        owner: 'SP1TEST1234567890ABCDEF',
        fromToken: {
          symbol: 'USDC',
          amount: '500000',
          contractId: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard',
          decimals: 6,
          usdValue: 500
        },
        toToken: {
          symbol: 'STX',
          amount: '500000',
          contractId: 'STX',
          decimals: 6,
          usdValue: 500
        },
        txid: 'test-txid-2-' + Date.now(),
        replyCount: 0,
        hasReplies: false,
        metadata: {
          notes: 'Test activity for debugging - 3 hours ago',
          isTestData: true
        }
      },
      {
        id: `test-activity-3-${Date.now()}`,
        type: 'instant_swap',
        timestamp: Date.now() - (1 * 60 * 60 * 1000), // 1 hour ago
        status: 'failed',
        owner: 'SP1TEST1234567890ABCDEF',
        fromToken: {
          symbol: 'STX',
          amount: '2000000',
          contractId: 'STX',
          decimals: 6,
          usdValue: 2000
        },
        toToken: {
          symbol: 'USDC',
          amount: '2000000',
          contractId: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard',
          decimals: 6,
          usdValue: 2000
        },
        txid: 'test-txid-3-' + Date.now(),
        replyCount: 0,
        hasReplies: false,
        metadata: {
          notes: 'Test activity for debugging - 1 hour ago',
          isTestData: true
        }
      },
      {
        id: `test-activity-4-${Date.now()}`,
        type: 'order_filled',
        timestamp: Date.now() - (30 * 60 * 1000), // 30 minutes ago
        status: 'completed',
        owner: 'SP2TEST1234567890ABCDEF',
        fromToken: {
          symbol: 'USDC',
          amount: '750000',
          contractId: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard',
          decimals: 6,
          usdValue: 750
        },
        toToken: {
          symbol: 'STX',
          amount: '750000',
          contractId: 'STX',
          decimals: 6,
          usdValue: 750
        },
        txid: 'test-txid-4-' + Date.now(),
        replyCount: 0,
        hasReplies: false,
        metadata: {
          notes: 'Test activity for debugging - 30 minutes ago',
          isTestData: true
        }
      },
      {
        id: `test-activity-5-${Date.now()}`,
        type: 'instant_swap',
        timestamp: Date.now() - (10 * 60 * 1000), // 10 minutes ago
        status: 'processing',
        owner: 'SP3TEST1234567890ABCDEF',
        fromToken: {
          symbol: 'STX',
          amount: '300000',
          contractId: 'STX',
          decimals: 6,
          usdValue: 300
        },
        toToken: {
          symbol: 'USDC',
          amount: '300000',
          contractId: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard',
          decimals: 6,
          usdValue: 300
        },
        txid: 'test-txid-5-' + Date.now(),
        replyCount: 0,
        hasReplies: false,
        metadata: {
          notes: 'Test activity for debugging - 10 minutes ago',
          isTestData: true
        }
      }
    ];
    
    // Add all test activities
    for (const activity of testActivities) {
      await addActivity(activity);
      await logger.info(`✅ Created test activity: ${activity.id} (${activity.type}, ${activity.status})`);
    }
    
    await logger.success(`✅ Created ${testActivities.length} test activities`);
    
    // Step 2: Create multiple metrics snapshots with known data
    await logger.info('📊 Creating test metrics snapshots...');
    
    // Store several snapshots at different hours to create chart data
    const hoursToCreate = [6, 5, 4, 3, 2, 1, 0]; // 6 hours ago to now
    
    for (const hoursAgo of hoursToCreate) {
      const targetTime = Date.now() - (hoursAgo * 60 * 60 * 1000);
      const hourKey = Math.floor(targetTime / (60 * 60 * 1000));
      
      // Create predictable test data
      const testSnapshot = {
        timestamp: targetTime,
        queueSize: Math.max(0, 10 - hoursAgo * 2), // Decreasing queue size
        processed: hoursAgo * 2, // Increasing processed
        successful: Math.floor(hoursAgo * 1.5), // Increasing successful
        failed: Math.floor(hoursAgo * 0.5), // Increasing failed
        processingHealth: 'healthy' as const,
        activities: {
          completed: hoursAgo * 2, // Increasing completed
          pending: Math.max(0, 5 - hoursAgo), // Decreasing pending
          failed: Math.floor(hoursAgo * 0.3), // Increasing failed
          cancelled: Math.floor(hoursAgo * 0.2), // Increasing cancelled
          processing: Math.max(0, 3 - Math.floor(hoursAgo * 0.5)) // Decreasing processing
        }
      };
      
      await kv.set(`tx:metrics:${hourKey}`, testSnapshot, { ex: 7 * 24 * 60 * 60 });
      
      await logger.info(`📊 Created test metrics snapshot for ${hoursAgo}h ago: processed=${testSnapshot.processed}, activities.completed=${testSnapshot.activities.completed}`);
    }
    
    await logger.success(`✅ Created ${hoursToCreate.length} test metrics snapshots`);
    
    // Step 3: Update cumulative data
    await logger.info('📊 Updating cumulative test data...');
    
    const testCumulative = {
      processed: 50,
      successful: 40,
      failed: 10,
      activities: {
        completed: 30,
        pending: 8,
        failed: 5,
        cancelled: 3,
        processing: 2
      }
    };
    
    await kv.set('tx:metrics:cumulative', testCumulative, { ex: 7 * 24 * 60 * 60 });
    
    await logger.success('✅ Updated cumulative test data');
    
    // Step 4: Trigger a real metrics snapshot to test with live data
    await logger.info('🔄 Triggering real metrics snapshot...');
    
    await storeMetricsSnapshot();
    
    await logger.success('✅ Triggered real metrics snapshot');
    
    // Step 5: Verify test data was created correctly
    await logger.info('🔍 Verifying test data creation...');
    
    // Check activities
    const { getActivityStats } = await import('../src/lib/activity-storage');
    const activityStats = await getActivityStats();
    
    await logger.info(`📊 Activity Stats After Test Data:
      📈 Total: ${activityStats.total}
      🕒 Oldest Age: ${activityStats.oldestActivityAge ? `${Math.round(activityStats.oldestActivityAge / (60 * 1000))} minutes` : 'N/A'}
      📊 By Status: ${JSON.stringify(activityStats.byStatus)}`);
    
    // Check metrics
    const { getMetricsHistory } = await import('../src/lib/transaction-monitor');
    const metricsHistory = await getMetricsHistory(8);
    
    await logger.info(`📊 Metrics History After Test Data:
      📈 Total Records: ${metricsHistory.total}
      📊 Array Length: ${metricsHistory.metrics.length}
      🕒 Period: ${metricsHistory.period}`);
    
    // Check if activity data is in metrics
    const metricsWithActivities = metricsHistory.metrics.filter(m => m.activities);
    await logger.info(`📊 Metrics with activity data: ${metricsWithActivities.length}/${metricsHistory.metrics.length}`);
    
    if (metricsWithActivities.length > 0) {
      const sample = metricsWithActivities[0];
      await logger.info(`📊 Sample activity metrics: completed=${sample.activities?.completed}, pending=${sample.activities?.pending}`);
    }
    
    await logger.success('✅ Test data creation completed successfully');
    
    // Step 6: Instructions for cleanup
    await logger.info('🧹 Cleanup Instructions:');
    await logger.info('To remove test data, run the following commands:');
    await logger.info('1. Check for test activities: Search for activities with metadata.isTestData = true');
    await logger.info('2. Delete test metrics: Remove keys matching tx:metrics:* for test hours');
    await logger.info('3. Reset cumulative data: You may need to reset tx:metrics:cumulative');
    
  } catch (error) {
    await logger.error(`❌ Test data creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    // Log the full error for debugging
    if (error instanceof Error) {
      await logger.error(`📋 Error Details: ${error.stack}`);
    }
    
    throw error;
  }
}

// Run the test data creation
createTestData().catch(async (error) => {
  await logger.error(`💥 Script failed: ${error}`);
  process.exit(1);
});
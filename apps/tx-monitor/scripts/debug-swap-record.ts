#!/usr/bin/env node

/**
 * Script to debug swap record data
 * Usage: pnpm script scripts/debug-swap-record.ts
 */

import { logger } from './logger';
import { getActivity } from '../src/lib/activity-storage';
import { kv } from '@vercel/kv';

async function debugSwapRecord() {
  await logger.info('🔍 Starting swap record debug');
  
  try {
    const activityId = '6392b34b-b611-4dbc-b075-49cbf8470e27';
    
    await logger.info(`📊 Fetching activity: ${activityId}`);
    
    const activity = await getActivity(activityId);
    
    if (!activity) {
      await logger.error(`❌ Activity not found: ${activityId}`);
      return;
    }
    
    await logger.info(`🔍 Activity found - looking for corresponding swap record...`);
    
    // Try to find the swap record using the activity ID as the swap ID
    let swapData = await kv.hget('swap-records', activityId);
    
    if (!swapData) {
      await logger.info(`📊 No swap record found with activity ID, searching all swap records...`);
      
      // Get all swap records
      const allSwapRecords = await kv.hgetall('swap-records');
      
      if (!allSwapRecords) {
        await logger.warn(`⚠️ No swap records found at all`);
        return;
      }
      
      await logger.info(`📊 Found ${Object.keys(allSwapRecords).length} swap records, searching for matching transaction...`);
      
      // Look for a swap record with matching transaction ID
      for (const [swapId, recordData] of Object.entries(allSwapRecords)) {
        try {
          const record = typeof recordData === 'string' ? JSON.parse(recordData) : recordData;
          if (record.txid === activity.txid) {
            await logger.info(`📋 Found matching swap record by txid: ${swapId}`);
            swapData = recordData;
            break;
          }
        } catch (e) {
          await logger.warn(`⚠️ Failed to parse swap record ${swapId}: ${e}`);
        }
      }
    }
    
    if (!swapData) {
      await logger.error(`❌ No swap record found for activity ${activityId}`);
      await logger.info(`🔍 This might explain why the activity has incomplete data`);
      return;
    }
    
    const swap = typeof swapData === 'string' ? JSON.parse(swapData) : swapData;
    
    await logger.info('📋 Complete Swap Record Data:');
    await logger.info(JSON.stringify(swap, null, 2));
    
    await logger.info('\n🔍 Detailed Swap Field Analysis:');
    
    await logger.info(`📊 Swap ID: ${swap.id || 'N/A'}`);
    await logger.info(`📊 TXID: ${swap.txid || 'N/A'}`);
    await logger.info(`📊 Owner: ${swap.owner || 'N/A'}`);
    await logger.info(`📊 Status: ${swap.status || 'N/A'}`);
    await logger.info(`📊 Timestamp: ${swap.timestamp} (${swap.timestamp ? new Date(swap.timestamp).toLocaleString() : 'N/A'})`);
    
    await logger.info(`📈 Input Token: ${swap.inputToken || 'N/A'}`);
    await logger.info(`📈 Input Amount: ${swap.inputAmount || 'N/A'} (type: ${typeof swap.inputAmount})`);
    
    await logger.info(`📉 Output Token: ${swap.outputToken || 'N/A'}`);
    await logger.info(`📉 Output Amount: ${swap.outputAmount || 'N/A'} (type: ${typeof swap.outputAmount})`);
    
    await logger.info(`📊 Route Path: ${JSON.stringify(swap.routePath || [])}`);
    await logger.info(`📊 Price Impact: ${swap.priceImpact || 'N/A'}`);
    
    if (swap.metadata) {
      await logger.info(`📋 Metadata: ${JSON.stringify(swap.metadata, null, 2)}`);
    }
    
    // Test price API call for both tokens
    await logger.info('\n🔍 Testing price API calls...');
    
    await testPriceApi(swap.inputToken);
    await testPriceApi(swap.outputToken);
    
    await logger.success('✅ Swap record debug completed');
    
  } catch (error) {
    await logger.error(`❌ Debug failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    if (error instanceof Error) {
      await logger.error(`📋 Error Details: ${error.stack}`);
    }
    
    throw error;
  }
}

async function testPriceApi(tokenId: string) {
  try {
    await logger.info(`🔍 Testing charisma-party price API for token: ${tokenId}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const pricesUrl = `${process.env.NEXT_PUBLIC_CHARISMA_PARTY_URL || 'https://party.charisma.rocks'}/parties/prices?tokens=${encodeURIComponent(tokenId)}`;
    
    await logger.info(`📊 API URL: ${pricesUrl}`);
    
    const response = await fetch(pricesUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      }
    });
    
    clearTimeout(timeoutId);
    
    await logger.info(`📊 Price API Response Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      await logger.info(`📊 Price Response: ${JSON.stringify(data, null, 2)}`);
      
      if (data.prices && Array.isArray(data.prices) && data.prices.length > 0) {
        const priceUpdate = data.prices.find((p: any) => p.contractId === tokenId);
        if (priceUpdate) {
          await logger.success(`✅ Found price for ${tokenId}: $${priceUpdate.price}`);
        } else {
          await logger.warn(`⚠️ No price found for ${tokenId} in response`);
        }
      } else {
        await logger.warn(`⚠️ No prices array in response`);
      }
    } else {
      const errorText = await response.text();
      await logger.warn(`⚠️ Price API Error: ${errorText}`);
    }
    
  } catch (error) {
    await logger.error(`❌ Charisma-party price API call failed for ${tokenId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Run the debug
debugSwapRecord().catch(async (error) => {
  await logger.error(`💥 Script failed: ${error}`);
  process.exit(1);
});
#!/usr/bin/env node

/**
 * Debugging script to validate API endpoint responses
 * Usage: pnpm script scripts/validate-api-responses.ts
 */

import { logger } from './logger';

const BASE_URL = 'http://localhost:3012';

interface ApiEndpoint {
  name: string;
  path: string;
  params?: Record<string, string>;
}

const endpoints: ApiEndpoint[] = [
  { name: 'Queue Stats', path: '/api/v1/queue/stats' },
  { name: 'Activity Stats', path: '/api/v1/activities/stats' },
  { name: 'Health Check', path: '/api/v1/health' },
  { name: 'Metrics History (6h)', path: '/api/v1/metrics/history', params: { hours: '6' } },
  { name: 'Metrics History (24h)', path: '/api/v1/metrics/history', params: { hours: '24' } },
  { name: 'Metrics History (48h)', path: '/api/v1/metrics/history', params: { hours: '48' } },
];

async function validateApiResponses() {
  await logger.info('🌐 Starting API response validation');
  
  try {
    let successCount = 0;
    let failureCount = 0;
    
    for (const endpoint of endpoints) {
      await logger.info(`🔍 Testing ${endpoint.name}...`);
      
      try {
        // Build URL with parameters
        const url = new URL(`${BASE_URL}${endpoint.path}`);
        if (endpoint.params) {
          Object.entries(endpoint.params).forEach(([key, value]) => {
            url.searchParams.append(key, value);
          });
        }
        
        const response = await fetch(url.toString());
        const data = await response.json();
        
        if (!response.ok) {
          await logger.error(`❌ ${endpoint.name} failed with status ${response.status}`);
          await logger.error(`   Response: ${JSON.stringify(data, null, 2)}`);
          failureCount++;
          continue;
        }
        
        if (!data.success) {
          await logger.error(`❌ ${endpoint.name} returned success=false`);
          await logger.error(`   Error: ${data.error || 'Unknown error'}`);
          failureCount++;
          continue;
        }
        
        await logger.success(`✅ ${endpoint.name} - OK`);
        
        // Validate specific endpoint responses
        await validateEndpointResponse(endpoint, data);
        
        successCount++;
        
      } catch (error) {
        await logger.error(`❌ ${endpoint.name} failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        failureCount++;
      }
    }
    
    await logger.info(`📊 API Validation Summary:
      ✅ Successful: ${successCount}
      ❌ Failed: ${failureCount}
      📊 Total: ${endpoints.length}`);
    
    if (failureCount > 0) {
      await logger.error(`❌ ${failureCount} API endpoints failed validation`);
    } else {
      await logger.success('✅ All API endpoints passed validation');
    }
    
  } catch (error) {
    await logger.error(`❌ API validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

async function validateEndpointResponse(endpoint: ApiEndpoint, data: any) {
  switch (endpoint.name) {
    case 'Queue Stats':
      await validateQueueStats(data.data);
      break;
    case 'Activity Stats':
      await validateActivityStats(data.data);
      break;
    case 'Health Check':
      await validateHealthCheck(data.data);
      break;
    case 'Metrics History (6h)':
    case 'Metrics History (24h)':
    case 'Metrics History (48h)':
      await validateMetricsHistory(data.data, endpoint.params?.hours || '24');
      break;
  }
}

async function validateQueueStats(data: any) {
  const required = ['queueSize', 'processingHealth', 'totalProcessed', 'totalFailed', 'totalSuccessful'];
  const missing = required.filter(field => !(field in data));
  
  if (missing.length > 0) {
    await logger.error(`   ❌ Missing required fields: ${missing.join(', ')}`);
  } else {
    await logger.info(`   📊 Queue Size: ${data.queueSize}, Health: ${data.processingHealth}`);
  }
}

async function validateActivityStats(data: any) {
  const required = ['total', 'byType', 'byStatus'];
  const missing = required.filter(field => !(field in data));
  
  if (missing.length > 0) {
    await logger.error(`   ❌ Missing required fields: ${missing.join(', ')}`);
  } else {
    await logger.info(`   📊 Total Activities: ${data.total}`);
    await logger.info(`   📋 By Status: ${JSON.stringify(data.byStatus)}`);
    
    if (data.oldestActivityAge) {
      await logger.info(`   🕒 Oldest Activity Age: ${Math.round(data.oldestActivityAge / (60 * 1000))} minutes`);
    }
  }
}

async function validateHealthCheck(data: any) {
  const required = ['cron', 'api', 'queue', 'kvConnectivity'];
  const missing = required.filter(field => !(field in data));
  
  if (missing.length > 0) {
    await logger.error(`   ❌ Missing required fields: ${missing.join(', ')}`);
  } else {
    await logger.info(`   🏥 Cron: ${data.cron}, API: ${data.api}, Queue: ${data.queue}`);
  }
}

async function validateMetricsHistory(data: any, hours: string) {
  const required = ['metrics', 'period', 'total'];
  const missing = required.filter(field => !(field in data));
  
  if (missing.length > 0) {
    await logger.error(`   ❌ Missing required fields: ${missing.join(', ')}`);
    return;
  }
  
  await logger.info(`   📊 Period: ${data.period}, Total: ${data.total}, Array Length: ${data.metrics.length}`);
  
  if (!Array.isArray(data.metrics)) {
    await logger.error('   ❌ Metrics is not an array');
    return;
  }
  
  if (data.metrics.length === 0) {
    await logger.warn('   ⚠️ No metrics data found');
    return;
  }
  
  // Check first metric structure
  const firstMetric = data.metrics[0];
  const metricRequired = ['timestamp', 'queueSize', 'processed', 'successful', 'failed'];
  const metricMissing = metricRequired.filter(field => !(field in firstMetric));
  
  if (metricMissing.length > 0) {
    await logger.error(`   ❌ First metric missing fields: ${metricMissing.join(', ')}`);
  }
  
  // Check if activity metrics are present
  const metricsWithActivities = data.metrics.filter((m: any) => m.activities);
  await logger.info(`   📊 Metrics with activity data: ${metricsWithActivities.length}/${data.metrics.length}`);
  
  if (metricsWithActivities.length === 0) {
    await logger.error('   ❌ No metrics contain activity data - charts will show empty activity lines!');
  } else {
    const sample = metricsWithActivities[0];
    await logger.info(`   📋 Sample activity metrics: completed=${sample.activities.completed}, pending=${sample.activities.pending}, failed=${sample.activities.failed}`);
  }
  
  // Check period format
  if (data.period !== `${hours}h`) {
    await logger.error(`   ❌ Period mismatch: expected ${hours}h, got ${data.period}`);
  }
}

// Run the validation
validateApiResponses().catch(async (error) => {
  await logger.error(`💥 Script failed: ${error}`);
  process.exit(1);
});
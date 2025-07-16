#!/usr/bin/env tsx

import { logger } from './logger';

async function testCrossOriginRequest() {
  logger.info('🔍 Testing cross-origin requests to profitability API...');

  const txMonitorUrl = 'http://localhost:3012';
  const simpleSwapUrl = 'http://localhost:3002';
  const testActivityId = '6392b34b-b611-4dbc-b075-49cbf8470e27';

  try {
    // Test 1: Direct request to tx-monitor (this should work)
    logger.info('📡 Testing direct request to tx-monitor...');
    const directResponse = await fetch(`${txMonitorUrl}/api/v1/activities/${testActivityId}/profitability`);
    logger.info('Direct request result:', {
      status: directResponse.status,
      ok: directResponse.ok,
      headers: Object.fromEntries(directResponse.headers.entries())
    });

    if (directResponse.ok) {
      const directData = await directResponse.text();
      logger.info('✅ Direct request successful');
      try {
        const parsed = JSON.parse(directData);
        logger.info(`Direct response data available: ${!!parsed.data}`);
      } catch (e) {
        logger.info(`Direct response (raw): ${directData.substring(0, 200)}`);
      }
    } else {
      const errorText = await directResponse.text();
      logger.error(`❌ Direct request failed: ${errorText}`);
    }

    // Test 2: Check CORS headers
    logger.info('🌐 Testing CORS preflight request...');
    const preflightResponse = await fetch(`${txMonitorUrl}/api/v1/activities/${testActivityId}/profitability`, {
      method: 'OPTIONS',
      headers: {
        'Origin': simpleSwapUrl,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });

    logger.info('CORS preflight result:', {
      status: preflightResponse.status,
      corsHeaders: {
        'Access-Control-Allow-Origin': preflightResponse.headers.get('Access-Control-Allow-Origin'),
        'Access-Control-Allow-Methods': preflightResponse.headers.get('Access-Control-Allow-Methods'),
        'Access-Control-Allow-Headers': preflightResponse.headers.get('Access-Control-Allow-Headers')
      }
    });

    // Test 3: Simulate request with Origin header (like browser would send)
    logger.info('🌍 Testing request with Origin header...');
    const originResponse = await fetch(`${txMonitorUrl}/api/v1/activities/${testActivityId}/profitability`, {
      headers: {
        'Origin': simpleSwapUrl,
        'Content-Type': 'application/json'
      }
    });

    logger.info('Request with Origin result:', {
      status: originResponse.status,
      ok: originResponse.ok,
      corsOrigin: originResponse.headers.get('Access-Control-Allow-Origin')
    });

    // Test 4: Check if simple-swap can reach tx-monitor health endpoint
    logger.info('🏥 Testing health endpoint accessibility...');
    const healthResponse = await fetch(`${txMonitorUrl}/api/v1/health`);
    logger.info('Health endpoint result:', {
      status: healthResponse.status,
      ok: healthResponse.ok
    });

    // Test 5: Test bulk endpoint
    logger.info('📦 Testing bulk profitability endpoint...');
    const bulkResponse = await fetch(`${txMonitorUrl}/api/v1/activities/profitability/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': simpleSwapUrl
      },
      body: JSON.stringify({
        activityIds: [testActivityId],
        includeChartData: true
      })
    });

    logger.info('Bulk endpoint result:', {
      status: bulkResponse.status,
      ok: bulkResponse.ok
    });

    if (bulkResponse.ok) {
      const bulkData = await bulkResponse.text();
      logger.info('✅ Bulk endpoint successful');
      try {
        const parsed = JSON.parse(bulkData);
        logger.info('Bulk response structure:', {
          success: parsed.success,
          dataKeys: Object.keys(parsed.data || {}),
          metadata: parsed.metadata
        });
      } catch (e) {
        logger.info('Bulk response (raw):', bulkData.substring(0, 200));
      }
    } else {
      const bulkError = await bulkResponse.text();
      logger.error('❌ Bulk endpoint failed:', bulkError);
    }

    // Test 6: Check environment variable resolution
    logger.info('🔧 Environment variable check...');
    logger.info('Process env NEXT_PUBLIC_TX_MONITOR_URL:', process.env.NEXT_PUBLIC_TX_MONITOR_URL);
    
    // Test the actual URL from environment
    const envUrl = process.env.NEXT_PUBLIC_TX_MONITOR_URL || 'http://localhost:3012';
    if (envUrl !== txMonitorUrl) {
      logger.warn('⚠️  Environment URL differs from test URL:', {
        environment: envUrl,
        testing: txMonitorUrl
      });
      
      const envTestResponse = await fetch(`${envUrl}/api/v1/health`);
      logger.info('Environment URL health check:', {
        status: envTestResponse.status,
        ok: envTestResponse.ok
      });
    }

  } catch (error) {
    logger.error('💥 Cross-origin test failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

// Run the test
testCrossOriginRequest().catch(console.error);
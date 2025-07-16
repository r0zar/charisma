#!/usr/bin/env tsx

import { logger } from './logger';

async function testProfitabilityAPI() {
  logger.info('🔍 Testing profitability API endpoints...');

  const baseUrl = 'http://localhost:3012'; // tx-monitor is running on 3012
  const testActivityId = '6392b34b-b611-4dbc-b075-49cbf8470e27'; // From our debug results

  try {
    // Test 1: Check if the API is running
    logger.info('🏥 Testing health endpoint...');
    try {
      const healthResponse = await fetch(`${baseUrl}/api/v1/health`);
      logger.info('Health check status:', { status: healthResponse.status });
      
      if (healthResponse.ok) {
        const healthData = await healthResponse.text();
        logger.info('Health response:', { data: healthData });
      }
    } catch (error) {
      logger.error('❌ Health check failed:', { error: error instanceof Error ? error.message : 'Unknown error' });
      logger.error('🚨 tx-monitor server might not be running on port 3001', {});
      return;
    }

    // Test 2: Test profitability endpoint
    logger.info(`🎯 Testing profitability endpoint for activity: ${testActivityId}`);
    const profitabilityUrl = `${baseUrl}/api/v1/activities/${testActivityId}/profitability`;
    
    try {
      const response = await fetch(profitabilityUrl);
      logger.info('Profitability API response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      const responseBody = await response.text();
      logger.info('Raw response body:', { body: responseBody });
      
      if (response.ok) {
        try {
          const jsonData = JSON.parse(responseBody);
          logger.info('✅ Profitability API success:', { data: jsonData });
        } catch {
          logger.info('✅ Profitability API response (text):', { response: responseBody });
        }
      } else {
        logger.error('❌ Profitability API error response:', { response: responseBody });
        // Try to parse as JSON to get structured error
        try {
          const errorData = JSON.parse(responseBody);
          logger.error('Structured error:', { error: errorData });
        } catch {
          // Already logged as text above
        }
      }
    } catch (error) {
      logger.error('💥 Profitability API request failed:', { error: error instanceof Error ? error.message : 'Unknown error' });
    }

    // Test 3: Test different activity IDs
    logger.info('🔄 Testing multiple activity IDs...', {});
    const activityIds = [
      '6392b34b-b611-4dbc-b075-49cbf8470e27',
      '7696f8eb-a51c-4689-aba3-85601aff34e3',
      '91485dc2-727e-4246-b8a0-31445578f173'
    ];

    for (const activityId of activityIds) {
      try {
        const response = await fetch(`${baseUrl}/api/v1/activities/${activityId}/profitability`);
        logger.info(`Activity ${activityId}:`, {
          status: response.status,
          hasData: response.ok
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          logger.info(`Error for ${activityId}:`, { error: errorText });
        }
      } catch (error) {
        logger.error(`Failed to test ${activityId}:`, { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    // Test 4: Check what port simple-swap is expecting
    logger.info('🔍 Checking simple-swap configuration...', {});
    const simpleSwapUrl = process.env.NEXT_PUBLIC_TX_MONITOR_URL || 'http://localhost:3001';
    logger.info('Simple-swap expects tx-monitor at:', { url: simpleSwapUrl });

    if (simpleSwapUrl !== baseUrl) {
      logger.warn('⚠️  URL mismatch detected!', {});
      logger.info('Expected by simple-swap:', { url: simpleSwapUrl });
      logger.info('Testing against:', { url: baseUrl });
      
      // Test the URL that simple-swap is expecting
      try {
        const response = await fetch(`${simpleSwapUrl}/api/v1/health`);
        logger.info(`Health check at ${simpleSwapUrl}:`, { status: response.status });
      } catch (error) {
        logger.error(`Health check failed at ${simpleSwapUrl}:`, { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

  } catch (error) {
    logger.error('💥 API test failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

// Run the test
testProfitabilityAPI().catch(console.error);
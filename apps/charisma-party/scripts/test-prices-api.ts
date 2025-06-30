#!/usr/bin/env tsx

/**
 * Test script for charisma-party PricesParty API in production
 * Tests both HTTP endpoints and WebSocket connections
 * 
 * Usage: pnpm script test-prices-api
 */

import WebSocket from 'ws';

// Configuration
const PROD_HOST = 'https://charisma-party.r0zar.partykit.dev';
const PROD_WS_HOST = 'wss://charisma-party.r0zar.partykit.dev';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration?: number;
  data?: any;
}

const results: TestResult[] = [];

function log(message: string) {
  console.log(`🧪 ${message}`);
}

function logResult(result: TestResult) {
  const emoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
  const duration = result.duration ? ` (${result.duration}ms)` : '';
  console.log(`${emoji} ${result.test}${duration}: ${result.message}`);
  results.push(result);
}

async function testHttpEndpoints() {
  log('Testing HTTP endpoints...');

  // Test 1: GET all prices
  try {
    const start = Date.now();
    const response = await fetch(`${PROD_HOST}/parties/prices/main`);
    const duration = Date.now() - start;
    
    if (response.ok) {
      const data = await response.json();
      logResult({
        test: 'GET /parties/prices/main',
        status: 'PASS',
        message: `Retrieved ${Object.keys(data.prices || {}).length} price entries`,
        duration,
        data: { statusCode: response.status, priceCount: Object.keys(data.prices || {}).length }
      });

      // Show sample price data
      if (data.prices && Object.keys(data.prices).length > 0) {
        const firstPrice = Object.entries(data.prices)[0] as [string, any];
        console.log(`   📊 Sample price: ${firstPrice[0].slice(-10)} = $${firstPrice[1].price}`);
      }
    } else {
      logResult({
        test: 'GET /parties/prices/main',
        status: 'FAIL',
        message: `HTTP ${response.status}: ${response.statusText}`,
        duration
      });
    }
  } catch (error) {
    logResult({
      test: 'GET /parties/prices/main',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  // Test 2: GET specific contract prices
  const testContract = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';
  try {
    const start = Date.now();
    const response = await fetch(`${PROD_HOST}/parties/prices/main?contracts=${testContract}`);
    const duration = Date.now() - start;
    
    if (response.ok) {
      const data = await response.json();
      logResult({
        test: 'GET /parties/prices/main?contracts=...',
        status: 'PASS',
        message: `Retrieved ${Object.keys(data.prices || {}).length} price entries for contract`,
        duration,
        data: { statusCode: response.status, priceCount: Object.keys(data.prices || {}).length }
      });
    } else {
      logResult({
        test: 'GET /parties/prices/main?contracts=...',
        status: 'FAIL',
        message: `HTTP ${response.status}: ${response.statusText}`,
        duration
      });
    }
  } catch (error) {
    logResult({
      test: 'GET /parties/prices/main?contracts=...',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  // Test 3: POST manual update
  try {
    const start = Date.now();
    const response = await fetch(`${PROD_HOST}/parties/prices/main`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const duration = Date.now() - start;
    
    if (response.ok) {
      const data = await response.json();
      logResult({
        test: 'POST /parties/prices/main (manual update)',
        status: 'PASS',
        message: `Manual update triggered: ${data.status}`,
        duration,
        data: { statusCode: response.status, response: data }
      });
    } else {
      logResult({
        test: 'POST /parties/prices/main (manual update)',
        status: 'FAIL',
        message: `HTTP ${response.status}: ${response.statusText}`,
        duration
      });
    }
  } catch (error) {
    logResult({
      test: 'POST /parties/prices/main (manual update)',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

async function testWebSocketConnection() {
  log('Testing WebSocket connection...');

  return new Promise<void>((resolve) => {
    const start = Date.now();
    let connectionDuration: number;
    let serverInfoReceived = false;
    let priceBatchReceived = false;
    let priceUpdateCount = 0;
    let closeScheduled = false;
    
    const ws = new WebSocket(`${PROD_WS_HOST}/parties/prices/main`);
    
    // Set timeout for test
    const timeout = setTimeout(() => {
      ws.close();
      logResult({
        test: 'WebSocket Connection Timeout',
        status: 'FAIL',
        message: 'Connection timed out after 15 seconds'
      });
      resolve();
    }, 15000);

    ws.on('open', () => {
      connectionDuration = Date.now() - start;
      logResult({
        test: 'WebSocket Connection',
        status: 'PASS',
        message: 'Connected successfully',
        duration: connectionDuration
      });

      // Send subscription message
      const subscribeMessage = {
        type: 'SUBSCRIBE',
        contractIds: [], // Empty = subscribe to all
        clientId: 'test-script'
      };
      
      ws.send(JSON.stringify(subscribeMessage));
      log(`   Sent subscription for all prices`);
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'SERVER_INFO':
            serverInfoReceived = true;
            logResult({
              test: 'WebSocket SERVER_INFO',
              status: 'PASS',
              message: `Server info received: ${message.party}, dev mode: ${message.isLocalDev}`,
              data: message
            });
            break;
            
          case 'PRICE_BATCH':
            priceBatchReceived = true;
            logResult({
              test: 'WebSocket PRICE_BATCH',
              status: 'PASS',
              message: `Received ${message.prices?.length || 0} price entries`,
              data: { priceCount: message.prices?.length, timestamp: message.timestamp }
            });

            // Show sample prices
            if (message.prices && message.prices.length > 0) {
              console.log(`   📊 Sample prices from batch:`);
              message.prices.slice(0, 3).forEach((price: any, i: number) => {
                const contractName = price.contractId.split('.').pop() || price.contractId;
                console.log(`      ${i + 1}. ${contractName}: $${price.price}`);
              });
            }
            break;
            
          case 'PRICE_UPDATE':
            priceUpdateCount++;
            const contractName = message.contractId.split('.').pop() || message.contractId;
            
            if (priceUpdateCount <= 5) { // Only log first few to avoid spam
              logResult({
                test: `WebSocket PRICE_UPDATE #${priceUpdateCount}`,
                status: 'PASS',
                message: `${contractName} = $${message.price}`,
                data: {
                  contractId: message.contractId,
                  price: message.price,
                  timestamp: message.timestamp,
                  source: message.source
                }
              });
            } else if (priceUpdateCount === 6) {
              console.log(`   📊 Received ${priceUpdateCount}+ price updates (hiding additional ones)`);
            }
            break;
            
          case 'ERROR':
            logResult({
              test: 'WebSocket ERROR',
              status: 'FAIL',
              message: `Server error: ${message.message}`,
              data: message
            });
            break;
        }
        
        // Close after receiving expected data
        if (serverInfoReceived && priceBatchReceived && !closeScheduled) {
          closeScheduled = true;
          setTimeout(() => {
            if (priceUpdateCount > 0) {
              console.log(`   📊 Total price updates received: ${priceUpdateCount}`);
            }
            ws.close();
          }, 2000); // Wait a bit for any additional messages
        }
        
      } catch (error) {
        logResult({
          test: 'WebSocket Message Parsing',
          status: 'FAIL',
          message: `Failed to parse message: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    });

    ws.on('close', (code, reason) => {
      clearTimeout(timeout);
      logResult({
        test: 'WebSocket Disconnection',
        status: 'PASS',
        message: `Disconnected cleanly: ${code} ${reason.toString()}`,
        data: { code, reason: reason.toString() }
      });
      resolve();
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      logResult({
        test: 'WebSocket Connection',
        status: 'FAIL',
        message: `Connection error: ${error.message}`,
        data: error
      });
      resolve();
    });
  });
}

async function testWebSocketMessages() {
  log('Testing WebSocket message types...');

  return new Promise<void>((resolve) => {
    const ws = new WebSocket(`${PROD_WS_HOST}/parties/prices/main`);
    
    const timeout = setTimeout(() => {
      ws.close();
      resolve();
    }, 8000);

    ws.on('open', () => {
      // Test different message types
      const tests = [
        {
          name: 'PING',
          message: { type: 'PING', timestamp: Date.now() }
        },
        {
          name: 'MANUAL_UPDATE',
          message: { type: 'MANUAL_UPDATE' }
        },
        {
          name: 'Invalid message type',
          message: { type: 'INVALID_TYPE' }
        }
      ];

      tests.forEach((test, index) => {
        setTimeout(() => {
          const messageStr = JSON.stringify(test.message);
          ws.send(messageStr);
          log(`   Sent ${test.name} message`);
        }, index * 1000);
      });

      // Test malformed JSON
      setTimeout(() => {
        ws.send('invalid-json');
        log(`   Sent malformed JSON`);
      }, tests.length * 1000);
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'PONG') {
          logResult({
            test: 'PING/PONG Response',
            status: 'PASS',
            message: `PONG received with timestamp: ${message.timestamp}`,
            data: message
          });
        } else if (message.type === 'ERROR') {
          logResult({
            test: 'Error Handling',
            status: 'PASS',
            message: `Error properly handled: ${message.message}`,
            data: message
          });
        }
      } catch (error) {
        // Expected for malformed JSON test
      }
    });

    ws.on('close', () => {
      clearTimeout(timeout);
      resolve();
    });

    ws.on('error', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

function printSummary() {
  console.log('\\n' + '='.repeat(60));
  log('📊 Test Summary:');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️ Skipped: ${skipped}`);
  console.log(`📋 Total: ${results.length}`);
  
  if (failed > 0) {
    console.log('\\n🔍 Failed Tests:');
    results.filter(r => r.status === 'FAIL').forEach(result => {
      console.log(`   ❌ ${result.test}: ${result.message}`);
    });
  }
  
  const successRate = results.length > 0 ? ((passed / results.length) * 100).toFixed(1) : '0.0';
  console.log(`\\n🎯 Success Rate: ${successRate}%`);
  
  if (passed === results.length && results.length > 0) {
    console.log('\\n🎉 All tests passed! The PricesParty API is working correctly in production.');
  } else if (failed > 0) {
    console.log('\\n⚠️  Some tests failed. Check the production deployment.');
  }
}

async function main() {
  console.log('🚀 Testing charisma-party PricesParty API in Production');
  console.log(`🌐 Host: ${PROD_HOST}`);
  console.log(`🔌 WebSocket: ${PROD_WS_HOST}`);
  console.log('=' .repeat(60));
  
  try {
    // Test HTTP endpoints
    await testHttpEndpoints();
    
    console.log('');
    
    // Test WebSocket connection and real-time features
    await testWebSocketConnection();
    
    console.log('');
    
    // Test WebSocket message handling
    await testWebSocketMessages();
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  } finally {
    printSummary();
  }
}

// Run the script
main().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
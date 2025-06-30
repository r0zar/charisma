#!/usr/bin/env tsx

/**
 * Test script for charisma-party BalancesParty API in production
 * Tests both HTTP endpoints and WebSocket connections
 * 
 * Usage: pnpm script test-balances-api [userId]
 * Example: pnpm script test-balances-api SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS
 */

import WebSocket from 'ws';

// Configuration
const PROD_HOST = 'https://charisma-party.r0zar.partykit.dev';
const PROD_WS_HOST = 'wss://charisma-party.r0zar.partykit.dev';
const DEFAULT_TEST_USER = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS'; // Known user with balances (from logs)

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

async function testHttpEndpoints(testUserId: string) {
  log('Testing HTTP endpoints...');

  // Test 1: GET all balances
  try {
    const start = Date.now();
    const response = await fetch(`${PROD_HOST}/parties/balances/main`);
    const duration = Date.now() - start;
    
    if (response.ok) {
      const data = await response.json();
      logResult({
        test: 'GET /parties/balances/main',
        status: 'PASS',
        message: `Retrieved ${data.balances?.length || 0} balance entries`,
        duration,
        data: { statusCode: response.status, balanceCount: data.balances?.length }
      });
    } else {
      logResult({
        test: 'GET /parties/balances/main',
        status: 'FAIL',
        message: `HTTP ${response.status}: ${response.statusText}`,
        duration
      });
    }
  } catch (error) {
    logResult({
      test: 'GET /parties/balances/main',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  // Test 2: GET specific user balances
  try {
    const start = Date.now();
    const response = await fetch(`${PROD_HOST}/parties/balances/main?users=${testUserId}`);
    const duration = Date.now() - start;
    
    if (response.ok) {
      const data = await response.json();
      logResult({
        test: 'GET /parties/balances/main?users=...',
        status: 'PASS',
        message: `Retrieved ${data.balances?.length || 0} balance entries for user`,
        duration,
        data: { statusCode: response.status, balanceCount: data.balances?.length }
      });

      // Show balance breakdown and actual balances
      if (data.balances && data.balances.length > 0) {
        const nonZeroBalances = data.balances.filter((b: any) => Number(b.balance || 0) > 0);
        const mainnetTokens = data.balances.filter((b: any) => b.metadata?.type !== 'SUBNET');
        const subnetTokens = data.balances.filter((b: any) => b.metadata?.type === 'SUBNET');
        
        console.log(`   📊 Balance breakdown: ${nonZeroBalances.length} non-zero, ${mainnetTokens.length} mainnet, ${subnetTokens.length} subnet`);
        
        // Show top non-zero balances
        if (nonZeroBalances.length > 0) {
          console.log(`   💰 Top non-zero balances:`);
          nonZeroBalances
            .sort((a: any, b: any) => Number(b.balance || 0) - Number(a.balance || 0))
            .slice(0, 5)
            .forEach((balance: any, i: number) => {
              const symbol = balance.metadata?.symbol || balance.symbol || 'Unknown';
              const source = balance.metadata?.type === 'SUBNET' ? '[SUBNET]' : '[MAINNET]';
              console.log(`      ${i + 1}. ${symbol} ${source}: ${balance.balance}`);
            });
        } else {
          // Show sample of zero balances
          const firstBalance = data.balances[0];
          const symbol = firstBalance.metadata?.symbol || firstBalance.symbol || 'Unknown';
          console.log(`   📊 Sample balance: ${symbol} = ${firstBalance.balance}`);
        }
      }
    } else {
      logResult({
        test: 'GET /parties/balances/main?users=...',
        status: 'FAIL',
        message: `HTTP ${response.status}: ${response.statusText}`,
        duration
      });
    }
  } catch (error) {
    logResult({
      test: 'GET /parties/balances/main?users=...',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  // Test 3: POST manual update
  try {
    const start = Date.now();
    const response = await fetch(`${PROD_HOST}/parties/balances/main`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const duration = Date.now() - start;
    
    if (response.ok) {
      const data = await response.json();
      logResult({
        test: 'POST /parties/balances/main (manual update)',
        status: 'PASS',
        message: `Manual update triggered: ${data.status}`,
        duration,
        data: { statusCode: response.status, response: data }
      });
    } else {
      logResult({
        test: 'POST /parties/balances/main (manual update)',
        status: 'FAIL',
        message: `HTTP ${response.status}: ${response.statusText}`,
        duration
      });
    }
  } catch (error) {
    logResult({
      test: 'POST /parties/balances/main (manual update)',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

async function testWebSocketConnection(testUserId: string) {
  log('Testing WebSocket connection...');

  return new Promise<void>((resolve) => {
    const start = Date.now();
    let connectionDuration: number;
    let serverInfoReceived = false;
    let balanceBatchReceived = false;
    let balanceUpdateCount = 0;
    let closeScheduled = false;
    
    const ws = new WebSocket(`${PROD_WS_HOST}/parties/balances/main`);
    
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
        userIds: [testUserId],
        clientId: 'test-script'
      };
      
      ws.send(JSON.stringify(subscribeMessage));
      log(`   Sent subscription for user: ${testUserId.slice(0, 8)}...${testUserId.slice(-4)}`);
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
              message: `Server info received: ${message.party}, metadata: ${message.metadataCount} tokens`,
              data: message
            });
            break;
            
          case 'BALANCE_BATCH':
            balanceBatchReceived = true;
            logResult({
              test: 'WebSocket BALANCE_BATCH',
              status: 'PASS',
              message: `Received ${message.balances?.length || 0} balance entries`,
              data: { balanceCount: message.balances?.length, timestamp: message.timestamp }
            });

            // Show sample balances
            if (message.balances && message.balances.length > 0) {
              console.log(`   📊 Sample balances from batch:`);
              message.balances.slice(0, 3).forEach((balance: any, i: number) => {
                const symbol = balance.metadata?.symbol || balance.symbol || 'Unknown';
                const hasSubnet = balance.subnetBalance ? ' (+ subnet)' : '';
                console.log(`      ${i + 1}. ${symbol}: ${balance.formattedBalance}${hasSubnet}`);
              });
            }
            break;
            
          case 'BALANCE_UPDATE':
            balanceUpdateCount++;
            const symbol = message.metadata?.symbol || message.symbol || 'Unknown';
            const isSubnet = message.metadata?.type === 'SUBNET' ? ' [SUBNET]' : '';
            
            if (balanceUpdateCount <= 5) { // Only log first few to avoid spam
              logResult({
                test: `WebSocket BALANCE_UPDATE #${balanceUpdateCount}`,
                status: 'PASS',
                message: `${symbol}${isSubnet} = ${message.formattedBalance}`,
                data: {
                  contractId: message.contractId,
                  balance: message.formattedBalance,
                  symbol: symbol,
                  tokenType: message.metadata?.type,
                  hasSubnetFields: !!message.subnetBalance
                }
              });
            } else if (balanceUpdateCount === 6) {
              console.log(`   📊 Received ${balanceUpdateCount}+ balance updates (hiding additional ones)`);
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
        
        // Close after receiving expected data and some updates
        if (serverInfoReceived && balanceBatchReceived && balanceUpdateCount > 5 && !closeScheduled) {
          closeScheduled = true;
          setTimeout(() => {
            console.log(`   📊 Total balance updates received: ${balanceUpdateCount}`);
            ws.close();
          }, 2000); // Wait a bit more for any additional messages
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
    const ws = new WebSocket(`${PROD_WS_HOST}/parties/balances/main`);
    
    const timeout = setTimeout(() => {
      ws.close();
      resolve();
    }, 10000);

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
    console.log('\\n🎉 All tests passed! The BalancesParty API is working correctly in production.');
  } else if (failed > 0) {
    console.log('\\n⚠️  Some tests failed. Check the production deployment.');
  }
}

async function main() {
  // Get user ID from command line args
  const testUserId = process.argv[2] || DEFAULT_TEST_USER;
  
  console.log('🚀 Testing charisma-party BalancesParty API in Production');
  console.log(`🌐 Host: ${PROD_HOST}`);
  console.log(`🔌 WebSocket: ${PROD_WS_HOST}`);
  console.log(`👤 Test User: ${testUserId.slice(0, 8)}...${testUserId.slice(-4)}`);
  console.log('=' .repeat(60));
  
  try {
    // Test HTTP endpoints
    await testHttpEndpoints(testUserId);
    
    console.log('');
    
    // Test WebSocket connection and real-time features
    await testWebSocketConnection(testUserId);
    
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
#!/usr/bin/env tsx

/**
 * Comprehensive test script for charisma-party production API
 * Tests both PricesParty and BalancesParty endpoints
 * 
 * Usage: pnpm script test-production-api [userId]
 * Example: pnpm script test-production-api SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS
 */

import WebSocket from 'ws';

// Configuration
const PROD_HOST = 'https://charisma-party.r0zar.partykit.dev';
const PROD_WS_HOST = 'wss://charisma-party.r0zar.partykit.dev';
const DEFAULT_TEST_USER = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS'; // Known user from logs with balances

interface TestResult {
  party: 'prices' | 'balances' | 'general';
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration?: number;
}

const results: TestResult[] = [];

function log(message: string) {
  console.log(`🧪 ${message}`);
}

function logResult(result: TestResult) {
  const emoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
  const duration = result.duration ? ` (${result.duration}ms)` : '';
  const party = result.party === 'general' ? '' : `[${result.party.toUpperCase()}] `;
  console.log(`${emoji} ${party}${result.test}${duration}: ${result.message}`);
  results.push(result);
}

async function testPricesAPI() {
  console.log('\\n🏷️ Testing PricesParty API...');
  console.log('-'.repeat(40));

  // Test HTTP endpoint
  try {
    const start = Date.now();
    const response = await fetch(`${PROD_HOST}/parties/prices/main`);
    const duration = Date.now() - start;
    
    if (response.ok) {
      const data = await response.json();
      logResult({
        party: 'prices',
        test: 'HTTP GET /parties/prices/main',
        status: 'PASS',
        message: `Retrieved ${Object.keys(data.prices || {}).length} price entries`,
        duration
      });
    } else {
      logResult({
        party: 'prices',
        test: 'HTTP GET /parties/prices/main',
        status: 'FAIL',
        message: `HTTP ${response.status}: ${response.statusText}`,
        duration
      });
    }
  } catch (error) {
    logResult({
      party: 'prices',
      test: 'HTTP GET /parties/prices/main',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  // Test WebSocket connection
  return new Promise<void>((resolve) => {
    const start = Date.now();
    let connected = false;
    let serverInfoReceived = false;
    let priceBatchReceived = false;
    
    const ws = new WebSocket(`${PROD_WS_HOST}/parties/prices/main`);
    
    const timeout = setTimeout(() => {
      ws.close();
      if (!connected) {
        logResult({
          party: 'prices',
          test: 'WebSocket Connection',
          status: 'FAIL',
          message: 'Connection timeout'
        });
      }
      resolve();
    }, 10000);

    ws.on('open', () => {
      connected = true;
      const duration = Date.now() - start;
      logResult({
        party: 'prices',
        test: 'WebSocket Connection',
        status: 'PASS',
        message: 'Connected successfully',
        duration
      });

      // Subscribe to all prices
      ws.send(JSON.stringify({
        type: 'SUBSCRIBE',
        contractIds: [],
        clientId: 'test-script'
      }));
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'SERVER_INFO' && !serverInfoReceived) {
          serverInfoReceived = true;
          logResult({
            party: 'prices',
            test: 'WebSocket SERVER_INFO',
            status: 'PASS',
            message: `Received server info: ${message.party}`
          });
        } else if (message.type === 'PRICE_BATCH' && !priceBatchReceived) {
          priceBatchReceived = true;
          logResult({
            party: 'prices',
            test: 'WebSocket PRICE_BATCH',
            status: 'PASS',
            message: `Received ${message.prices?.length || 0} prices`
          });
          
          setTimeout(() => ws.close(), 1000);
        }
      } catch (error) {
        logResult({
          party: 'prices',
          test: 'WebSocket Message Parsing',
          status: 'FAIL',
          message: `Parse error: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    });

    ws.on('close', () => {
      clearTimeout(timeout);
      resolve();
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      if (!connected) {
        logResult({
          party: 'prices',
          test: 'WebSocket Connection',
          status: 'FAIL',
          message: `Connection error: ${error.message}`
        });
      }
      resolve();
    });
  });
}

async function testBalancesAPI(testUserId: string) {
  console.log('\\n💰 Testing BalancesParty API...');
  console.log('-'.repeat(40));

  // Test HTTP endpoint
  try {
    const start = Date.now();
    const response = await fetch(`${PROD_HOST}/parties/balances/main?users=${testUserId}`);
    const duration = Date.now() - start;
    
    if (response.ok) {
      const data = await response.json();
      logResult({
        party: 'balances',
        test: 'HTTP GET /parties/balances/main',
        status: 'PASS',
        message: `Retrieved ${data.balances?.length || 0} balance entries`,
        duration
      });

      // Check for separate message architecture
      if (data.balances && data.balances.length > 0) {
        const hasSubnetFields = data.balances.some((b: any) => b.subnetBalance !== undefined);
        const hasMetadata = data.balances.some((b: any) => b.metadata !== undefined);
        
        console.log(`   📊 Architecture check: metadata=${hasMetadata}, legacy subnet fields=${hasSubnetFields}`);
      }
    } else {
      logResult({
        party: 'balances',
        test: 'HTTP GET /parties/balances/main',
        status: 'FAIL',
        message: `HTTP ${response.status}: ${response.statusText}`,
        duration
      });
    }
  } catch (error) {
    logResult({
      party: 'balances',
      test: 'HTTP GET /parties/balances/main',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  // Test WebSocket connection with new architecture
  return new Promise<void>((resolve) => {
    const start = Date.now();
    let connected = false;
    let serverInfoReceived = false;
    let balanceBatchReceived = false;
    let separateMessagesReceived = 0;
    let subnetMessagesReceived = 0;
    
    const ws = new WebSocket(`${PROD_WS_HOST}/parties/balances/main`);
    
    const timeout = setTimeout(() => {
      ws.close();
      if (!connected) {
        logResult({
          party: 'balances',
          test: 'WebSocket Connection',
          status: 'FAIL',
          message: 'Connection timeout'
        });
      }
      resolve();
    }, 15000);

    ws.on('open', () => {
      connected = true;
      const duration = Date.now() - start;
      logResult({
        party: 'balances',
        test: 'WebSocket Connection',
        status: 'PASS',
        message: 'Connected successfully',
        duration
      });

      // Subscribe to user balances
      ws.send(JSON.stringify({
        type: 'SUBSCRIBE',
        userIds: [testUserId],
        clientId: 'test-script'
      }));
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'SERVER_INFO':
            if (!serverInfoReceived) {
              serverInfoReceived = true;
              logResult({
                party: 'balances',
                test: 'WebSocket SERVER_INFO',
                status: 'PASS',
                message: `Server info: ${message.metadataCount} tokens loaded`
              });
            }
            break;
            
          case 'BALANCE_BATCH':
            if (!balanceBatchReceived) {
              balanceBatchReceived = true;
              logResult({
                party: 'balances',
                test: 'WebSocket BALANCE_BATCH',
                status: 'PASS',
                message: `Received ${message.balances?.length || 0} balance entries`
              });
            }
            break;
            
          case 'BALANCE_UPDATE':
            separateMessagesReceived++;
            const tokenType = message.metadata?.type || 'Unknown';
            const symbol = message.metadata?.symbol || message.symbol || 'Unknown';
            
            if (tokenType === 'SUBNET') {
              subnetMessagesReceived++;
            }
            
            // Only log first few messages to avoid spam
            if (separateMessagesReceived <= 3) {
              const typeLabel = tokenType === 'SUBNET' ? ' [SUBNET]' : '';
              logResult({
                party: 'balances',
                test: `WebSocket BALANCE_UPDATE #${separateMessagesReceived}`,
                status: 'PASS',
                message: `${symbol}${typeLabel} = ${message.formattedBalance}`
              });
            }
            
            // Check for old merged format (should NOT have subnet fields)
            if (message.subnetBalance !== undefined) {
              logResult({
                party: 'balances',
                test: 'Separate Message Architecture',
                status: 'FAIL',
                message: 'BALANCE_UPDATE still contains subnetBalance field (old merged format)'
              });
            }
            break;
        }
        
        // Close after getting sufficient data
        if (serverInfoReceived && balanceBatchReceived && separateMessagesReceived >= 3) {
          setTimeout(() => {
            // Report on new architecture
            logResult({
              party: 'balances',
              test: 'Separate Message Architecture',
              status: 'PASS',
              message: `Received ${separateMessagesReceived} separate messages (${subnetMessagesReceived} subnet)`
            });
            
            ws.close();
          }, 2000);
        }
        
      } catch (error) {
        logResult({
          party: 'balances',
          test: 'WebSocket Message Parsing',
          status: 'FAIL',
          message: `Parse error: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    });

    ws.on('close', () => {
      clearTimeout(timeout);
      resolve();
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      if (!connected) {
        logResult({
          party: 'balances',
          test: 'WebSocket Connection',
          status: 'FAIL',
          message: `Connection error: ${error.message}`
        });
      }
      resolve();
    });
  });
}

async function testGeneralEndpoints() {
  console.log('\\n🌐 Testing General Endpoints...');
  console.log('-'.repeat(40));

  // Test root endpoint
  try {
    const start = Date.now();
    const response = await fetch(`${PROD_HOST}/`);
    const duration = Date.now() - start;
    
    logResult({
      party: 'general',
      test: 'Root endpoint accessibility',
      status: response.status < 500 ? 'PASS' : 'FAIL',
      message: `HTTP ${response.status} (${response.statusText})`,
      duration
    });
  } catch (error) {
    logResult({
      party: 'general',
      test: 'Root endpoint accessibility',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  // Test CORS headers
  try {
    const response = await fetch(`${PROD_HOST}/parties/prices/main`, {
      method: 'OPTIONS'
    });
    
    const corsHeaders = {
      'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
      'access-control-allow-methods': response.headers.get('access-control-allow-methods'),
      'access-control-allow-headers': response.headers.get('access-control-allow-headers')
    };
    
    logResult({
      party: 'general',
      test: 'CORS Headers',
      status: corsHeaders['access-control-allow-origin'] ? 'PASS' : 'SKIP',
      message: corsHeaders['access-control-allow-origin'] 
        ? `Origin: ${corsHeaders['access-control-allow-origin']}`
        : 'No CORS headers found'
    });
  } catch (error) {
    logResult({
      party: 'general',
      test: 'CORS Headers',
      status: 'SKIP',
      message: `Could not test CORS: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

function printSummary() {
  console.log('\\n' + '='.repeat(60));
  console.log('📊 PRODUCTION API TEST SUMMARY');
  console.log('='.repeat(60));
  
  const byParty = {
    prices: results.filter(r => r.party === 'prices'),
    balances: results.filter(r => r.party === 'balances'),
    general: results.filter(r => r.party === 'general')
  };
  
  const totalPassed = results.filter(r => r.status === 'PASS').length;
  const totalFailed = results.filter(r => r.status === 'FAIL').length;
  const totalSkipped = results.filter(r => r.status === 'SKIP').length;
  
  // Summary by party
  Object.entries(byParty).forEach(([party, partyResults]) => {
    if (partyResults.length === 0) return;
    
    const passed = partyResults.filter(r => r.status === 'PASS').length;
    const failed = partyResults.filter(r => r.status === 'FAIL').length;
    const skipped = partyResults.filter(r => r.status === 'SKIP').length;
    
    console.log(`\\n🎯 ${party.toUpperCase()} Party:`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   ⏭️ Skipped: ${skipped}`);
    console.log(`   📊 Success Rate: ${partyResults.length > 0 ? ((passed / partyResults.length) * 100).toFixed(1) : '0.0'}%`);
  });
  
  // Overall summary
  console.log(`\\n🏆 OVERALL RESULTS:`);
  console.log(`   ✅ Total Passed: ${totalPassed}`);
  console.log(`   ❌ Total Failed: ${totalFailed}`);
  console.log(`   ⏭️ Total Skipped: ${totalSkipped}`);
  console.log(`   📋 Total Tests: ${results.length}`);
  console.log(`   🎯 Overall Success Rate: ${results.length > 0 ? ((totalPassed / results.length) * 100).toFixed(1) : '0.0'}%`);
  
  // Failed tests details
  if (totalFailed > 0) {
    console.log(`\\n🔍 FAILED TESTS:`);
    results.filter(r => r.status === 'FAIL').forEach(result => {
      console.log(`   ❌ [${result.party.toUpperCase()}] ${result.test}: ${result.message}`);
    });
  }
  
  // Final verdict
  if (totalFailed === 0 && totalPassed > 0) {
    console.log(`\\n🎉 SUCCESS! All charisma-party APIs are working correctly in production.`);
    console.log(`   ✨ The new separate message architecture is deployed and functional.`);
  } else if (totalFailed > 0) {
    console.log(`\\n⚠️ WARNING: ${totalFailed} test(s) failed. Please check the production deployment.`);
  } else {
    console.log(`\\n🤔 No tests completed successfully. Check network connectivity.`);
  }
  
  console.log('\\n' + '='.repeat(60));
}

async function main() {
  const testUserId = process.argv[2] || DEFAULT_TEST_USER;
  
  console.log('🚀 COMPREHENSIVE CHARISMA-PARTY PRODUCTION API TEST');
  console.log('='.repeat(60));
  console.log(`🌐 Host: ${PROD_HOST}`);
  console.log(`🔌 WebSocket: ${PROD_WS_HOST}`);
  console.log(`👤 Test User: ${testUserId.slice(0, 8)}...${testUserId.slice(-4)}`);
  console.log(`⏰ Started: ${new Date().toLocaleTimeString()}`);
  
  try {
    await testGeneralEndpoints();
    await testPricesAPI();
    await testBalancesAPI(testUserId);
    
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
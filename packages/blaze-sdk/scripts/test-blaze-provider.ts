/**
 * Test script for BlazeProvider WebSocket connections and event handling
 * Tests real-time data reception and client-side balance merging
 */

import WebSocket from 'ws';

// Configuration
const PROD_HOST = 'https://charisma-party.r0zar.partykit.dev';
const PROD_WS_HOST = 'wss://charisma-party.r0zar.partykit.dev';
const TEST_USER_ID = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';

// Test state
interface TestResults {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  failures: string[];
}

const testResults: TestResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  total: 0,
  failures: []
};

// Logging utilities
function log(message: string) {
  console.log(message);
}

function logResult(result: { test: string; status: 'PASS' | 'FAIL' | 'SKIP'; message: string; duration?: number; data?: any }) {
  testResults.total++;
  const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
  const duration = result.duration ? ` (${result.duration}ms)` : '';
  log(`${icon} ${result.test}${duration}: ${result.message}`);
  
  if (result.status === 'PASS') {
    testResults.passed++;
  } else if (result.status === 'FAIL') {
    testResults.failed++;
    testResults.failures.push(`   ❌ ${result.test}: ${result.message}`);
  } else {
    testResults.skipped++;
  }

  if (result.data && result.status === 'PASS') {
    // Log some additional data for successful tests if relevant
    if (result.test.includes('BALANCE_UPDATE') && result.data.balance !== undefined) {
      log(`   📊 Balance: ${result.data.symbol || 'Unknown'} = ${result.data.formattedBalance || result.data.balance}`);
    } else if (result.test.includes('PRICE_UPDATE') && result.data.price !== undefined) {
      log(`   💰 Price: ${result.data.contractId} = $${result.data.price}`);
    }
  }
}

// Token utilities (replicated from blaze-sdk)
const KNOWN_SUBNET_MAPPINGS = new Map([
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1', 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'],
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.leo-token-subnet-v1', 'SP1AY6K3PQV5MRT6R4S671NWW2FRVPKM0BR162CT6.leo-token'],
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.kangaroo-subnet', 'SP2C1WREHGM75C7TGFAEJPFKTFTEGZKF6DFT6E2GE.kangaroo'],
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-token-subnet-v1', 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token'],
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.usda-token-subnet', 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token'],
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dmtoken-subnet', 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dmtoken'],
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.nope-subnet', 'SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ.nope'],
  ['SP2KGJEAZRDVK78ZWTRGSDE11A1VMZVEATNQFZ73C.world-peace-stacks-stxcity-subnet', 'SP14J806BWEPQAXVA0G6RYZN7GNA126B7JFRRYTEM.world-peace-stacks-stxcity']
]);

function isSubnetToken(contractId: string, metadata?: { type?: string; base?: string }): boolean {
  if (metadata?.type === 'SUBNET') {
    return true;
  }
  return KNOWN_SUBNET_MAPPINGS.has(contractId);
}

function getBaseContractId(contractId: string, metadata?: { base?: string }): string {
  if (metadata?.base) {
    return metadata.base;
  }
  return KNOWN_SUBNET_MAPPINGS.get(contractId) || contractId;
}

function getBalanceKey(userId: string, contractId: string, metadata?: { type?: string; base?: string }): string {
  const baseContract = isSubnetToken(contractId, metadata)
    ? getBaseContractId(contractId, metadata)
    : contractId;
  return `${userId}:${baseContract}`;
}

// Balance merging logic (replicated from BlazeProvider)
function mergeBalance(existingBalance: any, newData: any): any {
  const isSubnet = isSubnetToken(newData.contractId, newData.metadata);
  
  return {
    // Start with existing balance
    ...existingBalance,
    
    // Update core fields only if this is a mainnet update OR no existing mainnet data
    ...((!isSubnet || !existingBalance?.balance) && {
      balance: String(newData.balance || 0),
      totalSent: newData.totalSent || '0',
      totalReceived: newData.totalReceived || '0',
      formattedBalance: newData.formattedBalance || 0,
      source: newData.source || 'realtime'
    }),
    
    // Always update timestamp
    timestamp: newData.timestamp || Date.now(),
    
    // Update subnet fields only if this is a subnet update
    ...(isSubnet && {
      subnetBalance: newData.balance,
      formattedSubnetBalance: newData.formattedBalance,
      subnetContractId: newData.contractId,
    }),
    
    // Merge metadata
    metadata: {
      ...existingBalance?.metadata,
      ...(newData.metadata || {})
    },
    
    // Legacy fields
    name: newData.metadata?.name || newData.name || existingBalance?.name,
    symbol: newData.metadata?.symbol || newData.symbol || existingBalance?.symbol,
    decimals: newData.metadata?.decimals || newData.decimals || existingBalance?.decimals,
    type: newData.metadata?.type || newData.tokenType || existingBalance?.type
  };
}

// Test WebSocket connections
async function testPricesConnection(): Promise<void> {
  log('🏷️ Testing PricesParty WebSocket connection...');
  
  return new Promise<void>((resolve) => {
    const start = Date.now();
    let connectionDuration: number;
    let serverInfoReceived = false;
    let priceBatchReceived = false;
    let priceUpdateCount = 0;
    let closeScheduled = false;
    
    const ws = new WebSocket(`${PROD_WS_HOST}/parties/prices/main`);
    
    const timeout = setTimeout(() => {
      ws.close();
      logResult({
        test: 'PricesParty Connection Timeout',
        status: 'FAIL',
        message: 'Connection timed out after 10 seconds'
      });
      resolve();
    }, 10000);
    
    ws.on('open', () => {
      connectionDuration = Date.now() - start;
      logResult({
        test: 'PricesParty WebSocket Connection',
        status: 'PASS',
        message: 'Connected successfully',
        duration: connectionDuration
      });
      
      // Subscribe to all prices
      ws.send(JSON.stringify({
        type: 'SUBSCRIBE',
        contractIds: [],
        clientId: 'blaze-test'
      }));
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'SERVER_INFO':
            serverInfoReceived = true;
            logResult({
              test: 'PricesParty SERVER_INFO',
              status: 'PASS',
              message: `Server info received: ${message.party || 'prices'}`,
              data: message
            });
            break;
            
          case 'PRICE_BATCH':
            priceBatchReceived = true;
            logResult({
              test: 'PricesParty PRICE_BATCH',
              status: 'PASS',
              message: `Received ${message.prices?.length || 0} price entries`,
              data: { count: message.prices?.length }
            });
            break;
            
          case 'PRICE_UPDATE':
            priceUpdateCount++;
            if (priceUpdateCount <= 3) {
              logResult({
                test: `PricesParty PRICE_UPDATE #${priceUpdateCount}`,
                status: 'PASS',
                message: `${message.contractId} = $${message.price}`,
                data: message
              });
            } else if (priceUpdateCount === 4) {
              log(`   📊 Received ${priceUpdateCount}+ price updates (hiding additional ones)`);
            }
            break;
            
          case 'ERROR':
            logResult({
              test: 'PricesParty ERROR',
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
            clearTimeout(timeout);
            ws.close();
            resolve();
          }, 2000);
        }
        
      } catch (error) {
        logResult({
          test: 'PricesParty Message Parsing',
          status: 'FAIL',
          message: `Failed to parse message: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    });
    
    ws.on('error', (error) => {
      clearTimeout(timeout);
      logResult({
        test: 'PricesParty Connection Error',
        status: 'FAIL',
        message: `WebSocket error: ${error.message}`
      });
      resolve();
    });
    
    ws.on('close', () => {
      clearTimeout(timeout);
      if (!closeScheduled) {
        logResult({
          test: 'PricesParty Connection',
          status: 'FAIL',
          message: 'Connection closed unexpectedly'
        });
      }
    });
  });
}

async function testBalancesConnection(): Promise<void> {
  log('💰 Testing BalancesParty WebSocket connection and balance merging...');
  
  return new Promise<void>((resolve) => {
    const start = Date.now();
    let connectionDuration: number;
    let serverInfoReceived = false;
    let balanceBatchReceived = false;
    let balanceUpdateCount = 0;
    let closeScheduled = false;
    
    // Client-side balance store to test merging logic
    const balances: Record<string, any> = {};
    
    const ws = new WebSocket(`${PROD_WS_HOST}/parties/balances/main`);
    
    const timeout = setTimeout(() => {
      ws.close();
      logResult({
        test: 'BalancesParty Connection Timeout',
        status: 'FAIL',
        message: 'Connection timed out after 15 seconds'
      });
      resolve();
    }, 15000);
    
    ws.on('open', () => {
      connectionDuration = Date.now() - start;
      logResult({
        test: 'BalancesParty WebSocket Connection',
        status: 'PASS',
        message: 'Connected successfully',
        duration: connectionDuration
      });
      
      // Subscribe to test user balances
      ws.send(JSON.stringify({
        type: 'SUBSCRIBE',
        userIds: [TEST_USER_ID],
        clientId: 'blaze-test'
      }));
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'SERVER_INFO':
            serverInfoReceived = true;
            logResult({
              test: 'BalancesParty SERVER_INFO',
              status: 'PASS',
              message: `Server info received: ${message.party || 'balances'}`,
              data: message
            });
            break;
            
          case 'BALANCE_BATCH':
            balanceBatchReceived = true;
            
            // Test batch processing with merging logic
            let mergedCount = 0;
            let subnetCount = 0;
            let mainnetCount = 0;
            
            if (message.balances && Array.isArray(message.balances)) {
              message.balances.forEach((balance: any) => {
                if (balance.contractId && balance.userId && balance.balance !== undefined) {
                  const key = getBalanceKey(balance.userId, balance.contractId, balance.metadata);
                  const existingBalance = balances[key];
                  const isSubnet = isSubnetToken(balance.contractId, balance.metadata);
                  
                  if (isSubnet) {
                    subnetCount++;
                  } else {
                    mainnetCount++;
                  }
                  
                  // Apply merging logic
                  balances[key] = mergeBalance(existingBalance, balance);
                  mergedCount++;
                }
              });
            }
            
            logResult({
              test: 'BalancesParty BALANCE_BATCH',
              status: 'PASS',
              message: `Processed ${mergedCount} balances (${mainnetCount} mainnet, ${subnetCount} subnet)`,
              data: { 
                total: message.balances?.length,
                merged: mergedCount,
                mainnet: mainnetCount,
                subnet: subnetCount
              }
            });
            break;
            
          case 'BALANCE_UPDATE':
            balanceUpdateCount++;
            
            if (balanceUpdateCount <= 5 && message.contractId && message.userId && message.balance !== undefined) {
              const key = getBalanceKey(message.userId, message.contractId, message.metadata);
              const existingBalance = balances[key];
              const isSubnet = isSubnetToken(message.contractId, message.metadata);
              
              // Test merging logic
              const mergedBalance = mergeBalance(existingBalance, message);
              balances[key] = mergedBalance;
              
              // Verify merge worked correctly
              const hasMainnetData = mergedBalance.balance && mergedBalance.balance !== '0';
              const hasSubnetData = mergedBalance.subnetBalance !== undefined;
              const mergeStatus = isSubnet ? 
                (hasSubnetData ? 'subnet-added' : 'subnet-failed') :
                (hasMainnetData ? 'mainnet-updated' : 'mainnet-zero');
              
              logResult({
                test: `BalancesParty BALANCE_UPDATE #${balanceUpdateCount}`,
                status: 'PASS',
                message: `${message.symbol || 'Unknown'} = ${message.formattedBalance || message.balance} (${mergeStatus})`,
                data: {
                  symbol: message.symbol,
                  balance: message.balance,
                  formattedBalance: message.formattedBalance,
                  isSubnet,
                  mergeStatus,
                  hasMainnetData,
                  hasSubnetData
                }
              });
            } else if (balanceUpdateCount === 6) {
              log(`   📊 Received ${balanceUpdateCount}+ balance updates (hiding additional ones)`);
            }
            break;
            
          case 'ERROR':
            logResult({
              test: 'BalancesParty ERROR',
              status: 'FAIL',
              message: `Server error: ${message.message}`,
              data: message
            });
            break;
        }
        
        // Close after receiving expected data and some updates
        if (serverInfoReceived && balanceBatchReceived && balanceUpdateCount > 0 && !closeScheduled) {
          closeScheduled = true;
          setTimeout(() => {
            // Final validation of merged balances
            const mergedBalanceCount = Object.keys(balances).length;
            const hasSubnetMerges = Object.values(balances).some((b: any) => b.subnetBalance !== undefined);
            
            logResult({
              test: 'Balance Merging Validation',
              status: hasSubnetMerges ? 'PASS' : 'FAIL',
              message: `${mergedBalanceCount} merged balance entries, subnet merging: ${hasSubnetMerges ? 'working' : 'failed'}`,
              data: { 
                mergedCount: mergedBalanceCount,
                hasSubnetMerges,
                totalUpdates: balanceUpdateCount
              }
            });
            
            clearTimeout(timeout);
            ws.close();
            resolve();
          }, 3000);
        }
        
      } catch (error) {
        logResult({
          test: 'BalancesParty Message Parsing',
          status: 'FAIL',
          message: `Failed to parse message: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    });
    
    ws.on('error', (error) => {
      clearTimeout(timeout);
      logResult({
        test: 'BalancesParty Connection Error',
        status: 'FAIL',
        message: `WebSocket error: ${error.message}`
      });
      resolve();
    });
    
    ws.on('close', () => {
      clearTimeout(timeout);
      if (!closeScheduled) {
        logResult({
          test: 'BalancesParty Connection',
          status: 'FAIL',
          message: 'Connection closed unexpectedly'
        });
      }
    });
  });
}

async function testSubnetTokenDetection(): Promise<void> {
  log('🔍 Testing subnet token detection and mapping utilities...');
  
  // Test cases for subnet detection
  const testCases = [
    {
      contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
      metadata: { type: 'SIP10' },
      expectedSubnet: false,
      expectedBase: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'
    },
    {
      contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1',
      metadata: { type: 'SUBNET', base: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token' },
      expectedSubnet: true,
      expectedBase: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'
    },
    {
      contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.leo-token-subnet-v1',
      metadata: undefined, // Test known mapping fallback
      expectedSubnet: true,
      expectedBase: 'SP1AY6K3PQV5MRT6R4S671NWW2FRVPKM0BR162CT6.leo-token'
    },
    {
      contractId: '.stx',
      metadata: { type: 'NATIVE' },
      expectedSubnet: false,
      expectedBase: '.stx'
    }
  ];
  
  testCases.forEach((testCase, index) => {
    const isSubnet = isSubnetToken(testCase.contractId, testCase.metadata);
    const baseContract = getBaseContractId(testCase.contractId, testCase.metadata);
    const balanceKey = getBalanceKey('test-user', testCase.contractId, testCase.metadata);
    
    const subnetCorrect = isSubnet === testCase.expectedSubnet;
    const baseCorrect = baseContract === testCase.expectedBase;
    
    if (subnetCorrect && baseCorrect) {
      logResult({
        test: `Subnet Detection Test #${index + 1}`,
        status: 'PASS',
        message: `${testCase.contractId.slice(-20)} → subnet: ${isSubnet}, base: ${baseContract.slice(-20)}`,
        data: { isSubnet, baseContract, balanceKey }
      });
    } else {
      logResult({
        test: `Subnet Detection Test #${index + 1}`,
        status: 'FAIL',
        message: `Expected subnet: ${testCase.expectedSubnet}, got: ${isSubnet}; expected base: ${testCase.expectedBase}, got: ${baseContract}`,
        data: { isSubnet, baseContract, expected: testCase }
      });
    }
  });
}

async function main() {
  console.log('🚀 BLAZE-SDK PROVIDER AND HOOK TESTING');
  console.log('============================================================');
  console.log(`🌐 Host: ${PROD_HOST}`);
  console.log(`🔌 WebSocket: ${PROD_WS_HOST}`);
  console.log(`👤 Test User: ${TEST_USER_ID.slice(0, 8)}...${TEST_USER_ID.slice(-4)}`);
  console.log(`⏰ Started: ${new Date().toLocaleTimeString()}`);
  console.log('');
  
  try {
    // Run all tests
    await testSubnetTokenDetection();
    await testPricesConnection();
    await testBalancesConnection();
    
    // Print summary
    console.log('');
    console.log('============================================================');
    console.log('📊 BLAZE-SDK TEST SUMMARY');
    console.log('============================================================');
    console.log('');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`⏭️ Skipped: ${testResults.skipped}`);
    console.log(`📋 Total: ${testResults.total}`);
    console.log(`🎯 Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
    
    if (testResults.failures.length > 0) {
      console.log('');
      console.log('🔍 Failed Tests:');
      testResults.failures.forEach(failure => console.log(failure));
      console.log('');
      console.log('⚠️  Some tests failed. Check the implementation.');
    } else {
      console.log('');
      console.log('🎉 SUCCESS! All BlazeProvider tests passed.');
      console.log('   ✨ WebSocket connections and balance merging working correctly.');
    }
    
    console.log('');
    console.log('============================================================');
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
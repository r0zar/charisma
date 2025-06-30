#!/usr/bin/env tsx

/**
 * Production Cache Investigation Script
 * Investigates the BalancesParty cache state and data flow in production
 * 
 * Usage: pnpm script production-cache-investigation [userId]
 * Example: pnpm script production-cache-investigation SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS
 */

import { 
  fetchUserBalances, 
  loadTokenMetadata, 
  createBalanceUpdateMessage 
} from '../src/balances-lib.js';
import { isSubnetToken } from '../src/types/balance-types.js';
import WebSocket from 'ws';

// Configuration
const DEFAULT_TEST_USER = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
const PROD_HOST = 'https://charisma-party.r0zar.partykit.dev';
const PROD_WS_HOST = 'wss://charisma-party.r0zar.partykit.dev';

interface CacheTestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration?: number;
  data?: any;
}

const results: CacheTestResult[] = [];

function log(message: string) {
  console.log(`🔍 ${message}`);
}

function logResult(result: CacheTestResult) {
  const emoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
  const duration = result.duration ? ` (${result.duration}ms)` : '';
  console.log(`${emoji} ${result.test}${duration}: ${result.message}`);
  results.push(result);
}

async function testProductionCacheState(userId: string) {
  log('Testing production cache state via WebSocket...');
  
  return new Promise<any>((resolve) => {
    const start = Date.now();
    const ws = new WebSocket(`${PROD_WS_HOST}/parties/balances`);
    let messageCount = 0;
    let stxFound = false;
    let allMessages: any[] = [];
    
    const timeout = setTimeout(() => {
      ws.close();
      const duration = Date.now() - start;
      
      logResult({
        test: 'Production Cache WebSocket',
        status: 'PASS',
        message: `Received ${messageCount} cached messages, STX found: ${stxFound}`,
        duration,
        data: {
          messageCount,
          stxFound,
          sampleMessages: allMessages.slice(0, 3),
          stxMessages: allMessages.filter(m => 
            m.contractId === '.stx' || 
            (m.metadata?.symbol === 'STX') ||
            (m.symbol === 'STX')
          )
        }
      });
      
      resolve({ messageCount, stxFound, allMessages });
    }, 5000);
    
    ws.on('open', () => {
      console.log('   📡 WebSocket connected to production BalancesParty');
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        messageCount++;
        allMessages.push(message);
        
        // Check for STX
        if (message.contractId === '.stx' || 
            (message.metadata?.symbol === 'STX') ||
            (message.symbol === 'STX')) {
          stxFound = true;
          console.log(`   💰 STX message found: balance=${message.balance}, user=${message.userId}`);
        }
        
        // Log first few messages for analysis
        if (messageCount <= 5) {
          console.log(`   📨 Message ${messageCount}: ${message.contractId || 'unknown'} (${message.metadata?.symbol || message.symbol || 'no-symbol'})`);
        }
      } catch (error) {
        console.warn(`   ⚠️ Failed to parse WebSocket message: ${error}`);
      }
    });
    
    ws.on('error', (error) => {
      clearTimeout(timeout);
      logResult({
        test: 'Production Cache WebSocket',
        status: 'FAIL',
        message: `WebSocket error: ${error.message}`
      });
      resolve(null);
    });
    
    ws.on('close', () => {
      clearTimeout(timeout);
      console.log('   📡 WebSocket connection closed');
    });
  });
}

async function testProductionHTTPWithQuery(userId: string) {
  log('Testing production HTTP endpoint with user query...');
  
  try {
    const start = Date.now();
    const response = await fetch(`${PROD_HOST}/parties/balances/main?users=${userId}&debug=true`);
    const duration = Date.now() - start;
    
    if (!response.ok) {
      logResult({
        test: 'Production HTTP with Query',
        status: 'FAIL',
        message: `HTTP ${response.status}: ${response.statusText}`,
        duration
      });
      return null;
    }
    
    const data = await response.json();
    const balances = data.balances || [];
    
    // Analyze the response
    const stxBalances = balances.filter((b: any) => 
      b.contractId === '.stx' ||
      (b.metadata?.symbol === 'STX') ||
      (b.symbol === 'STX')
    );
    
    const nonZeroBalances = balances.filter((b: any) => 
      Number(b.balance || 0) > 0
    );
    
    logResult({
      test: 'Production HTTP with Query',
      status: 'PASS',
      message: `Retrieved ${balances.length} balances, ${stxBalances.length} STX, ${nonZeroBalances.length} non-zero`,
      duration,
      data: {
        totalBalances: balances.length,
        stxBalanceCount: stxBalances.length,
        nonZeroCount: nonZeroBalances.length,
        stxBalances: stxBalances.map((b: any) => ({
          contractId: b.contractId,
          balance: b.balance,
          userId: b.userId
        })),
        responseHeaders: Object.fromEntries(response.headers.entries()),
        serverInfo: {
          party: data.party,
          serverTime: data.serverTime,
          debugInfo: data.debug
        }
      }
    });
    
    return { balances, stxBalances, nonZeroBalances, data };
    
  } catch (error) {
    logResult({
      test: 'Production HTTP with Query',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    return null;
  }
}

async function testProductionHTTPWithoutQuery() {
  log('Testing production HTTP endpoint without user query...');
  
  try {
    const start = Date.now();
    const response = await fetch(`${PROD_HOST}/parties/balances/main`);
    const duration = Date.now() - start;
    
    if (!response.ok) {
      logResult({
        test: 'Production HTTP without Query',
        status: 'FAIL',
        message: `HTTP ${response.status}: ${response.statusText}`,
        duration
      });
      return null;
    }
    
    const data = await response.json();
    const balances = data.balances || [];
    
    logResult({
      test: 'Production HTTP without Query',
      status: 'PASS',
      message: `Retrieved ${balances.length} cached balances`,
      duration,
      data: {
        totalBalances: balances.length,
        sampleBalances: balances.slice(0, 5).map((b: any) => ({
          contractId: b.contractId,
          balance: b.balance,
          symbol: b.metadata?.symbol || b.symbol
        }))
      }
    });
    
    return { balances, data };
    
  } catch (error) {
    logResult({
      test: 'Production HTTP without Query',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    return null;
  }
}

async function compareLocalSimulationWithProduction(userId: string) {
  log('Comparing local simulation with production cache...');
  
  try {
    const start = Date.now();
    
    // Run local simulation
    const tokenRecords = await loadTokenMetadata();
    const rawBalances = await fetchUserBalances([userId], tokenRecords);
    
    // Process into messages like BalancesParty does
    const simulatedMessages: any[] = [];
    
    for (const tokenRecord of tokenRecords.values()) {
      if (isSubnetToken(tokenRecord)) continue;
      
      const key = `${userId}:${tokenRecord.contractId}`;
      const balanceData = Object.values(rawBalances).find((b: any) => 
        b.userId === userId && b.contractId === tokenRecord.contractId
      );
      
      if (balanceData) {
        const message = createBalanceUpdateMessage(tokenRecord, userId, {
          balance: balanceData.balance,
          totalSent: balanceData.totalSent,
          totalReceived: balanceData.totalReceived,
          timestamp: Date.now(),
          source: 'simulation'
        });
        simulatedMessages.push(message);
      } else {
        // Create zero balance message
        const message = createBalanceUpdateMessage(tokenRecord, userId, {
          balance: 0,
          totalSent: '0',
          totalReceived: '0',
          timestamp: Date.now(),
          source: 'default-zero'
        });
        simulatedMessages.push(message);
      }
    }
    
    const duration = Date.now() - start;
    
    // Find STX in simulation
    const simulatedSTX = simulatedMessages.find(m => 
      m.contractId === '.stx' || 
      (m.metadata?.symbol === 'STX')
    );
    
    logResult({
      test: 'Local Simulation Analysis',
      status: 'PASS',
      message: `Generated ${simulatedMessages.length} messages, STX balance: ${simulatedSTX?.balance || 0}`,
      duration,
      data: {
        totalMessages: simulatedMessages.length,
        tokenRecordsLoaded: tokenRecords.size,
        rawBalanceEntries: Object.keys(rawBalances).length,
        stxBalance: simulatedSTX?.balance || 0,
        stxMessage: simulatedSTX ? {
          contractId: simulatedSTX.contractId,
          balance: simulatedSTX.balance,
          formattedBalance: simulatedSTX.formattedBalance
        } : null
      }
    });
    
    return { simulatedMessages, simulatedSTX, tokenRecords, rawBalances };
    
  } catch (error) {
    logResult({
      test: 'Local Simulation Analysis',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    return null;
  }
}

async function investigateDataFlow(userId: string) {
  log('Investigating complete data flow from raw data to production...');
  
  console.log('\n🔍 PRODUCTION CACHE INVESTIGATION:');
  console.log('='.repeat(70));
  
  // Step 1: Local simulation
  const simulationResult = await compareLocalSimulationWithProduction(userId);
  if (simulationResult) {
    console.log(`1️⃣ Local Simulation: ${simulationResult.simulatedMessages.length} messages, STX=${simulationResult.simulatedSTX?.balance || 0}`);
  }
  
  // Step 2: Production cache via WebSocket
  const cacheResult = await testProductionCacheState(userId);
  if (cacheResult) {
    console.log(`2️⃣ Production Cache (WS): ${cacheResult.messageCount} messages, STX found=${cacheResult.stxFound}`);
  }
  
  // Step 3: Production HTTP without query
  const httpNoQueryResult = await testProductionHTTPWithoutQuery();
  if (httpNoQueryResult) {
    console.log(`3️⃣ Production HTTP (no query): ${httpNoQueryResult.balances.length} messages`);
  }
  
  // Step 4: Production HTTP with user query
  const httpWithQueryResult = await testProductionHTTPWithQuery(userId);
  if (httpWithQueryResult) {
    console.log(`4️⃣ Production HTTP (with query): ${httpWithQueryResult.balances.length} messages, STX=${httpWithQueryResult.stxBalances.length}`);
  }
  
  console.log('='.repeat(70));
  
  // Analysis
  if (simulationResult && httpWithQueryResult) {
    const simulated = simulationResult.simulatedMessages.length;
    const production = httpWithQueryResult.balances.length;
    const dataLoss = simulated - production;
    const dataLossPercent = ((dataLoss / simulated) * 100).toFixed(1);
    
    console.log('\n💡 DATA FLOW ANALYSIS:');
    console.log('='.repeat(50));
    console.log(`📊 Expected Messages: ${simulated}`);
    console.log(`🌐 Production Messages: ${production}`);
    console.log(`📉 Data Loss: ${dataLoss} messages (${dataLossPercent}%)`);
    
    const simulatedSTXBalance = simulationResult.simulatedSTX?.balance || 0;
    const productionSTXBalance = httpWithQueryResult.stxBalances[0]?.balance || 0;
    
    console.log(`💰 STX Expected: ${simulatedSTXBalance.toLocaleString()}`);
    console.log(`💰 STX Production: ${productionSTXBalance}`);
    console.log(`💸 STX Loss: ${(simulatedSTXBalance - productionSTXBalance).toLocaleString()}`);
    
    if (dataLoss > 500) {
      console.log('\n🚨 CRITICAL: Massive data loss detected!');
      console.log('   ➤ 80%+ of balance data is missing from production');
      console.log('   ➤ Likely cause: BalancesParty cache corruption or filtering bug');
      console.log('   ➤ Recommendation: Restart BalancesParty or clear cache');
    } else if (dataLoss > 0) {
      console.log('\n⚠️ WARNING: Partial data loss detected');
      console.log('   ➤ Some balance data is missing from production');
      console.log('   ➤ May be due to cache staleness or selective filtering');
    } else {
      console.log('\n✅ SUCCESS: No data loss detected');
      console.log('   ➤ Production cache matches simulation');
    }
    
    console.log('='.repeat(50));
  }
}

function printSummary() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 PRODUCTION CACHE INVESTIGATION SUMMARY');
  console.log('='.repeat(80));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️ Skipped: ${skipped}`);
  console.log(`📋 Total: ${results.length}`);
  
  if (failed > 0) {
    console.log('\n🔍 Failed Tests:');
    results.filter(r => r.status === 'FAIL').forEach(result => {
      console.log(`   ❌ ${result.test}: ${result.message}`);
    });
  }
  
  const successRate = results.length > 0 ? ((passed / results.length) * 100).toFixed(1) : '0.0';
  console.log(`\n🎯 Success Rate: ${successRate}%`);
  
  console.log('\n💡 NEXT STEPS:');
  console.log('   1. If cache shows fewer messages than simulation: BalancesParty cache issue');
  console.log('   2. If WebSocket differs from HTTP: Response filtering issue');
  console.log('   3. If both match but low count: Data processing pipeline issue');
  console.log('   4. Consider redeploying BalancesParty to reset cache state');
  
  console.log('\n' + '='.repeat(80));
}

async function main() {
  const userId = process.argv[2] || DEFAULT_TEST_USER;
  
  console.log('🔬 PRODUCTION CACHE INVESTIGATION');
  console.log('='.repeat(80));
  console.log(`👤 Test User: ${userId.slice(0, 8)}...${userId.slice(-4)}`);
  console.log(`🌐 Production: ${PROD_HOST}`);
  console.log(`📡 WebSocket: ${PROD_WS_HOST}`);
  console.log(`⏰ Started: ${new Date().toLocaleTimeString()}`);
  console.log('='.repeat(80));
  
  try {
    await investigateDataFlow(userId);
  } catch (error) {
    console.error('❌ Investigation failed:', error);
    process.exit(1);
  } finally {
    printSummary();
  }
}

// Run the investigation
main().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
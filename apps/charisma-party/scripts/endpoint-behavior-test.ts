#!/usr/bin/env tsx

/**
 * Endpoint Behavior Simulation Script
 * Simulates the exact BalancesParty HTTP endpoint behavior to compare with production
 * 
 * Usage: pnpm script endpoint-behavior-test [userId]
 * Example: pnpm script endpoint-behavior-test SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS
 */

import { 
  fetchUserBalances, 
  loadTokenMetadata, 
  createBalanceUpdateMessage,
  formatBalance 
} from '../src/balances-lib.js';
import { isSubnetToken } from '../src/types/balance-types.js';

// Configuration
const DEFAULT_TEST_USER = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
const PROD_HOST = 'https://charisma-party.r0zar.partykit.dev';

interface EndpointTestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration?: number;
  data?: any;
}

interface WebSocketTokenBalance {
  userId: string;
  mainnetContractId: string;
  mainnetBalance: number;
  mainnetTotalSent: string;
  mainnetTotalReceived: string;
  subnetBalance?: number;
  subnetTotalSent?: string;
  subnetTotalReceived?: string;
  subnetContractId?: string;
  lastUpdated: number;
}

const results: EndpointTestResult[] = [];

function log(message: string) {
  console.log(`🧪 ${message}`);
}

function logResult(result: EndpointTestResult) {
  const emoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
  const duration = result.duration ? ` (${result.duration}ms)` : '';
  console.log(`${emoji} ${result.test}${duration}: ${result.message}`);
  results.push(result);
}

async function simulateBalancesPartyLogic(userIds: string[]) {
  log('Simulating exact BalancesParty logic...');
  
  try {
    const start = Date.now();
    
    // Step 1: Load token metadata (same as production)
    const tokenRecords = await loadTokenMetadata();
    console.log(`   🏷️ Loaded ${tokenRecords.size} token records`);
    
    // Step 2: Fetch user balances (same as production)
    const rawBalances = await fetchUserBalances(userIds, tokenRecords);
    console.log(`   💰 Fetched ${Object.keys(rawBalances).length} raw balance entries`);
    
    // Step 3: Process balances into WebSocketTokenBalance format (same as production)
    const balances = new Map<string, WebSocketTokenBalance>();
    const now = Date.now();
    
    for (const [, balanceData] of Object.entries(rawBalances)) {
      const { userId, contractId } = balanceData;
      
      // Find token record with fallback logic (same as production)
      const tokenRecord = tokenRecords.get(contractId);
      if (!tokenRecord) {
        console.warn(`   🔍 No token record found for ${contractId}`);
        continue;
      }
      
      const isSubnet = isSubnetToken(tokenRecord);
      const mainnetContractId = isSubnet ? tokenRecord.base! : tokenRecord.contractId;
      const key = `${userId}:${mainnetContractId}`;
      
      let balance = balances.get(key);
      if (!balance) {
        balance = {
          userId,
          mainnetContractId,
          mainnetBalance: 0,
          mainnetTotalSent: '0',
          mainnetTotalReceived: '0',
          lastUpdated: now
        };
      }
      
      // Update mainnet or subnet portion (same as production)
      if (isSubnet) {
        balance.subnetBalance = balanceData.balance;
        balance.subnetTotalSent = balanceData.totalSent;
        balance.subnetTotalReceived = balanceData.totalReceived;
        balance.subnetContractId = contractId;
      } else {
        balance.mainnetBalance = balanceData.balance;
        balance.mainnetTotalSent = balanceData.totalSent;
        balance.mainnetTotalReceived = balanceData.totalReceived;
      }
      
      balance.lastUpdated = now;
      balances.set(key, balance);
    }
    
    // Step 4: Create balance messages for users (same as production)
    const messages: any[] = [];
    
    for (const tokenRecord of tokenRecords.values()) {
      if (isSubnetToken(tokenRecord)) continue; // Skip subnet tokens in message creation
      
      for (const userId of userIds) {
        const key = `${userId}:${tokenRecord.contractId}`;
        const balance = balances.get(key);
        
        if (balance) {
          const message = createBalanceUpdateMessage(tokenRecord, userId, {
            balance: balance.mainnetBalance,
            totalSent: balance.mainnetTotalSent,
            totalReceived: balance.mainnetTotalReceived,
            timestamp: balance.lastUpdated,
            source: 'simulated'
          });
          messages.push(message);
        } else {
          // Create zero balance with metadata (same as production)
          const message = createBalanceUpdateMessage(tokenRecord, userId, {
            balance: 0,
            totalSent: '0',
            totalReceived: '0',
            timestamp: now,
            source: 'default-zero'
          });
          messages.push(message);
        }
      }
    }
    
    const duration = Date.now() - start;
    
    logResult({
      test: 'BalancesParty Logic Simulation',
      status: 'PASS',
      message: `Generated ${messages.length} balance messages for ${userIds.length} users`,
      duration,
      data: {
        tokenRecords: tokenRecords.size,
        rawBalances: Object.keys(rawBalances).length,
        processedBalances: balances.size,
        messages: messages.length,
        userIds: userIds.length
      }
    });
    
    return { messages, balances, tokenRecords, rawBalances };
    
  } catch (error) {
    logResult({
      test: 'BalancesParty Logic Simulation',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    return null;
  }
}

async function fetchProductionEndpoint(userIds: string[]) {
  log('Fetching from production endpoint...');
  
  try {
    const start = Date.now();
    const userParam = userIds.join(',');
    const response = await fetch(`${PROD_HOST}/parties/balances/main?users=${userParam}`);
    const duration = Date.now() - start;
    
    if (!response.ok) {
      logResult({
        test: 'Production Endpoint Fetch',
        status: 'FAIL',
        message: `HTTP ${response.status}: ${response.statusText}`,
        duration
      });
      return null;
    }
    
    const data = await response.json();
    
    logResult({
      test: 'Production Endpoint Fetch',
      status: 'PASS',
      message: `Retrieved ${data.balances?.length || 0} balance entries`,
      duration,
      data: {
        balanceCount: data.balances?.length || 0,
        party: data.party,
        serverTime: data.serverTime
      }
    });
    
    return data.balances || [];
    
  } catch (error) {
    logResult({
      test: 'Production Endpoint Fetch',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    return null;
  }
}

function compareSimulationWithProduction(simulatedMessages: any[], productionBalances: any[]) {
  log('Comparing simulation with production endpoint...');
  
  // Create maps for comparison
  const simulatedMap = new Map();
  simulatedMessages.forEach(msg => {
    const key = `${msg.userId}:${msg.contractId}`;
    simulatedMap.set(key, msg);
  });
  
  const productionMap = new Map();
  productionBalances.forEach(balance => {
    const key = `${balance.userId || 'unknown'}:${balance.contractId}`;
    productionMap.set(key, balance);
  });
  
  // Compare counts
  logResult({
    test: 'Message Count Comparison',
    status: simulatedMessages.length === productionBalances.length ? 'PASS' : 'FAIL',
    message: `Simulated: ${simulatedMessages.length}, Production: ${productionBalances.length}`,
    data: {
      simulated: simulatedMessages.length,
      production: productionBalances.length,
      difference: Math.abs(simulatedMessages.length - productionBalances.length)
    }
  });
  
  // Find matches and differences
  const simulatedKeys = new Set(simulatedMap.keys());
  const productionKeys = new Set(productionMap.keys());
  
  const onlyInSimulated = Array.from(simulatedKeys).filter(key => !productionKeys.has(key));
  const onlyInProduction = Array.from(productionKeys).filter(key => !simulatedKeys.has(key));
  const inBoth = Array.from(simulatedKeys).filter(key => productionKeys.has(key));
  
  logResult({
    test: 'Token Coverage Comparison',
    status: (onlyInSimulated.length === 0 && onlyInProduction.length === 0) ? 'PASS' : 'FAIL',
    message: `Matched: ${inBoth.length}, Only in simulation: ${onlyInSimulated.length}, Only in production: ${onlyInProduction.length}`,
    data: {
      matched: inBoth.length,
      onlyInSimulated: onlyInSimulated.slice(0, 5),
      onlyInProduction: onlyInProduction.slice(0, 5)
    }
  });
  
  // Compare balance values for matching tokens
  let balanceMatches = 0;
  let balanceMismatches = 0;
  const significantMismatches: any[] = [];
  
  inBoth.forEach(key => {
    const simulated = simulatedMap.get(key);
    const production = productionMap.get(key);
    
    const simulatedBalance = Number(simulated.balance || 0);
    const productionBalance = Number(production.balance || 0);
    
    if (simulatedBalance === productionBalance) {
      balanceMatches++;
    } else {
      balanceMismatches++;
      if (simulatedBalance > 0 || productionBalance > 0) {
        significantMismatches.push({
          key,
          simulated: simulatedBalance,
          production: productionBalance,
          symbol: simulated.metadata?.symbol || simulated.symbol
        });
      }
    }
  });
  
  logResult({
    test: 'Balance Value Comparison',
    status: balanceMismatches === 0 ? 'PASS' : 'FAIL',
    message: `Matches: ${balanceMatches}, Mismatches: ${balanceMismatches} (${significantMismatches.length} significant)`,
    data: {
      matches: balanceMatches,
      mismatches: balanceMismatches,
      significantMismatches: significantMismatches.slice(0, 5)
    }
  });
  
  // Check for STX specifically
  const stxSimulated = simulatedMap.get(`${DEFAULT_TEST_USER}:.stx`);
  const stxProduction = productionMap.get(`${DEFAULT_TEST_USER}:.stx`) || 
                      Array.from(productionMap.values()).find((b: any) => 
                        b.contractId === '.stx' || (b.metadata?.symbol === 'STX')
                      );
  
  if (stxSimulated && stxProduction) {
    const simulatedStx = Number(stxSimulated.balance || 0);
    const productionStx = Number(stxProduction.balance || 0);
    
    logResult({
      test: 'STX Balance Specific Check',
      status: simulatedStx === productionStx ? 'PASS' : 'FAIL',
      message: `Simulated: ${simulatedStx}, Production: ${productionStx}`,
      data: {
        simulated: simulatedStx,
        production: productionStx,
        difference: Math.abs(simulatedStx - productionStx)
      }
    });
  } else {
    logResult({
      test: 'STX Balance Specific Check',
      status: 'FAIL',
      message: `STX not found - Simulated: ${!!stxSimulated}, Production: ${!!stxProduction}`,
      data: {
        simulatedPresent: !!stxSimulated,
        productionPresent: !!stxProduction
      }
    });
  }
}

function printDetailedAnalysis(simulationResult: any, productionBalances: any[]) {
  if (!simulationResult) return;
  
  console.log('\n' + '='.repeat(80));
  console.log('🔍 DETAILED ANALYSIS');
  console.log('='.repeat(80));
  
  console.log(`📊 Data Flow Summary:`);
  console.log(`   Token Records Loaded: ${simulationResult.tokenRecords.size}`);
  console.log(`   Raw Balances Fetched: ${Object.keys(simulationResult.rawBalances).length}`);
  console.log(`   Processed WebSocket Balances: ${simulationResult.balances.size}`);
  console.log(`   Generated Messages: ${simulationResult.messages.length}`);
  console.log(`   Production Messages: ${productionBalances.length}`);
  
  // Check if simulation matches expected behavior
  const expectedMessageCount = simulationResult.tokenRecords.size; // Should create one message per token
  const actualMessageCount = simulationResult.messages.length;
  
  console.log(`\n🎯 Expected vs Actual:`);
  console.log(`   Expected Messages: ~${expectedMessageCount} (one per token)`);
  console.log(`   Simulated Messages: ${actualMessageCount}`);
  console.log(`   Production Messages: ${productionBalances.length}`);
  
  // Show sample data
  if (simulationResult.messages.length > 0) {
    console.log(`\n📋 Sample Simulated Message:`);
    const sample = simulationResult.messages[0];
    console.log(`   Contract ID: ${sample.contractId}`);
    console.log(`   Symbol: ${sample.metadata?.symbol || sample.symbol}`);
    console.log(`   Balance: ${sample.balance}`);
    console.log(`   User ID: ${sample.userId}`);
  }
  
  if (productionBalances.length > 0) {
    console.log(`\n📋 Sample Production Message:`);
    const sample = productionBalances[0];
    console.log(`   Contract ID: ${sample.contractId}`);
    console.log(`   Symbol: ${sample.metadata?.symbol || sample.symbol}`);
    console.log(`   Balance: ${sample.balance}`);
    console.log(`   User ID: ${sample.userId || 'missing'}`);
  }
}

function printSummary() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 ENDPOINT BEHAVIOR TEST SUMMARY');
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
  
  if (failed === 0) {
    console.log('\n🎉 Simulation matches production perfectly!');
    console.log('   The issue must be in the production environment or caching.');
  } else {
    console.log('\n⚠️ Simulation differs from production.');
    console.log('   This identifies specific logic differences to investigate.');
  }
  
  console.log('\n' + '='.repeat(80));
}

async function main() {
  const userId = process.argv[2] || DEFAULT_TEST_USER;
  const userIds = [userId];
  
  console.log('🔬 ENDPOINT BEHAVIOR SIMULATION TEST');
  console.log('='.repeat(80));
  console.log(`👤 Test User: ${userId.slice(0, 8)}...${userId.slice(-4)}`);
  console.log(`🌐 Production: ${PROD_HOST}`);
  console.log(`⏰ Started: ${new Date().toLocaleTimeString()}`);
  console.log('='.repeat(80));
  
  try {
    // Run simulation and production fetch in parallel
    const [simulationResult, productionBalances] = await Promise.all([
      simulateBalancesPartyLogic(userIds),
      fetchProductionEndpoint(userIds)
    ]);
    
    if (!simulationResult || !productionBalances) {
      console.error('❌ Failed to get data from simulation or production');
      process.exit(1);
    }
    
    // Compare results
    compareSimulationWithProduction(simulationResult.messages, productionBalances);
    
    // Print detailed analysis
    printDetailedAnalysis(simulationResult, productionBalances);
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  } finally {
    printSummary();
  }
}

// Run the tests
main().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
#!/usr/bin/env tsx

/**
 * STX Balance Deep Dive Investigation Script
 * Specifically investigates the critical STX balance discrepancy (0 vs 4,051)
 * 
 * Usage: pnpm script stx-balance-trace [userId]
 * Example: pnpm script stx-balance-trace SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS
 */

import { 
  fetchUserBalances, 
  loadTokenMetadata,
  createBalanceUpdateMessage 
} from '../src/balances-lib.js';
import { getAccountBalances } from '@repo/polyglot';

// Configuration
const DEFAULT_TEST_USER = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
const PROD_HOST = 'https://charisma-party.r0zar.partykit.dev';

interface STXTestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration?: number;
  data?: any;
}

const results: STXTestResult[] = [];

function log(message: string) {
  console.log(`🔍 ${message}`);
}

function logResult(result: STXTestResult) {
  const emoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
  const duration = result.duration ? ` (${result.duration}ms)` : '';
  console.log(`${emoji} ${result.test}${duration}: ${result.message}`);
  results.push(result);
}

async function testDirectSTXBalance(userId: string) {
  log('Testing direct STX balance via Stacks API...');
  
  try {
    const start = Date.now();
    const accountBalances = await getAccountBalances(userId);
    const duration = Date.now() - start;
    
    const stxBalance = accountBalances.stx?.balance || 0;
    const stxLocked = accountBalances.stx?.locked || 0;
    const stxTotal = Number(stxBalance) + Number(stxLocked);
    
    logResult({
      test: 'Direct STX API Call',
      status: 'PASS',
      message: `STX balance: ${stxBalance} (locked: ${stxLocked}, total: ${stxTotal})`,
      duration,
      data: {
        stxBalance: Number(stxBalance),
        stxLocked: Number(stxLocked),
        stxTotal,
        rawAccountBalances: accountBalances
      }
    });
    
    return { stxBalance: Number(stxBalance), stxLocked: Number(stxLocked), stxTotal };
    
  } catch (error) {
    logResult({
      test: 'Direct STX API Call',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    return null;
  }
}

async function testSTXTokenMetadata() {
  log('Testing STX token metadata loading...');
  
  try {
    const start = Date.now();
    const tokenRecords = await loadTokenMetadata();
    const duration = Date.now() - start;
    
    // Look for STX in various ways
    const stxByContractId = tokenRecords.get('.stx');
    const stxBySymbol = Array.from(tokenRecords.values()).find(r => r.symbol === 'STX');
    const stxByIdentifier = Array.from(tokenRecords.values()).find(r => r.identifier === 'STX');
    
    const stxRecord = stxByContractId || stxBySymbol || stxByIdentifier;
    
    logResult({
      test: 'STX Token Metadata',
      status: stxRecord ? 'PASS' : 'FAIL',
      message: stxRecord ? 
        `STX metadata found: ${stxRecord.symbol} (${stxRecord.contractId})` :
        'STX metadata not found',
      duration,
      data: {
        stxByContractId: !!stxByContractId,
        stxBySymbol: !!stxBySymbol,
        stxByIdentifier: !!stxByIdentifier,
        stxRecord: stxRecord ? {
          contractId: stxRecord.contractId,
          symbol: stxRecord.symbol,
          decimals: stxRecord.decimals,
          type: stxRecord.type,
          identifier: stxRecord.identifier
        } : null,
        totalTokens: tokenRecords.size
      }
    });
    
    return { stxRecord, tokenRecords };
    
  } catch (error) {
    logResult({
      test: 'STX Token Metadata',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    return null;
  }
}

async function testSTXInBalancesFetch(userId: string, tokenRecords: Map<string, any>) {
  log('Testing STX in fetchUserBalances result...');
  
  try {
    const start = Date.now();
    const rawBalances = await fetchUserBalances([userId], tokenRecords);
    const duration = Date.now() - start;
    
    // Look for STX in raw balances
    const stxEntries = Object.entries(rawBalances).filter(([key, data]) => {
      return data.contractId === '.stx' || 
             data.contractId.includes('stx') ||
             key.includes('.stx') ||
             key.includes('stx');
    });
    
    logResult({
      test: 'STX in Raw Balances',
      status: stxEntries.length > 0 ? 'PASS' : 'FAIL',
      message: stxEntries.length > 0 ? 
        `STX found: ${stxEntries.length} entries` :
        'STX not found in raw balances',
      duration,
      data: {
        stxEntryCount: stxEntries.length,
        stxEntries: stxEntries.map(([key, data]) => ({
          key,
          contractId: data.contractId,
          balance: data.balance,
          userId: data.userId
        })),
        totalRawBalances: Object.keys(rawBalances).length,
        allKeys: Object.keys(rawBalances).slice(0, 10),
        allContractIds: Object.values(rawBalances).map((b: any) => b.contractId).slice(0, 10)
      }
    });
    
    return { stxEntries, rawBalances };
    
  } catch (error) {
    logResult({
      test: 'STX in Raw Balances',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    return null;
  }
}

async function testSTXMessageCreation(userId: string, stxRecord: any) {
  if (!stxRecord) return null;
  
  log('Testing STX balance message creation...');
  
  try {
    const start = Date.now();
    
    // Create message with expected STX balance
    const expectedBalance = 4051697964; // From deep analysis
    const stxMessage = createBalanceUpdateMessage(stxRecord, userId, {
      balance: expectedBalance,
      totalSent: '0',
      totalReceived: '0',
      timestamp: Date.now(),
      source: 'test'
    });
    
    const duration = Date.now() - start;
    
    logResult({
      test: 'STX Message Creation',
      status: 'PASS',
      message: `STX message created successfully`,
      duration,
      data: {
        message: stxMessage,
        contractId: stxMessage.contractId,
        symbol: stxMessage.metadata?.symbol || stxMessage.symbol,
        balance: stxMessage.balance,
        formattedBalance: stxMessage.formattedBalance
      }
    });
    
    // Test with zero balance
    const zeroStxMessage = createBalanceUpdateMessage(stxRecord, userId, {
      balance: 0,
      totalSent: '0',
      totalReceived: '0',
      timestamp: Date.now(),
      source: 'test-zero'
    });
    
    logResult({
      test: 'STX Zero Balance Message',
      status: 'PASS',
      message: `STX zero message created: ${zeroStxMessage.balance}`,
      data: {
        message: zeroStxMessage,
        balance: zeroStxMessage.balance,
        formattedBalance: zeroStxMessage.formattedBalance
      }
    });
    
    return { stxMessage, zeroStxMessage };
    
  } catch (error) {
    logResult({
      test: 'STX Message Creation',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    return null;
  }
}

async function testProductionSTXResponse(userId: string) {
  log('Testing production STX response...');
  
  try {
    const start = Date.now();
    const response = await fetch(`${PROD_HOST}/parties/balances/main?users=${userId}`);
    const duration = Date.now() - start;
    
    if (!response.ok) {
      logResult({
        test: 'Production STX Response',
        status: 'FAIL',
        message: `HTTP ${response.status}: ${response.statusText}`,
        duration
      });
      return null;
    }
    
    const data = await response.json();
    const balances = data.balances || [];
    
    // Look for STX in production response
    const stxBalances = balances.filter((b: any) => 
      b.contractId === '.stx' ||
      b.contractId.includes('stx') ||
      (b.metadata?.symbol === 'STX') ||
      (b.symbol === 'STX')
    );
    
    logResult({
      test: 'Production STX Response',
      status: 'PASS',
      message: `Retrieved ${balances.length} balances, ${stxBalances.length} STX entries`,
      duration,
      data: {
        totalBalances: balances.length,
        stxBalanceCount: stxBalances.length,
        stxBalances: stxBalances.map((b: any) => ({
          contractId: b.contractId,
          symbol: b.metadata?.symbol || b.symbol,
          balance: b.balance,
          formattedBalance: b.formattedBalance
        })),
        sampleBalances: balances.slice(0, 5).map((b: any) => ({
          contractId: b.contractId,
          symbol: b.metadata?.symbol || b.symbol,
          balance: b.balance
        }))
      }
    });
    
    return { stxBalances, allBalances: balances };
    
  } catch (error) {
    logResult({
      test: 'Production STX Response',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    return null;
  }
}

async function traceSTXDataFlow(userId: string) {
  log('Tracing complete STX data flow...');
  
  console.log('\n🔍 STX Data Flow Trace:');
  console.log('='.repeat(60));
  
  // Step 1: Direct API
  const directSTX = await testDirectSTXBalance(userId);
  if (directSTX) {
    console.log(`1️⃣ Direct Stacks API: ${directSTX.stxTotal} STX (${directSTX.stxBalance} + ${directSTX.stxLocked} locked)`);
  }
  
  // Step 2: Token metadata
  const metadataResult = await testSTXTokenMetadata();
  if (metadataResult?.stxRecord) {
    console.log(`2️⃣ Token Metadata: STX record found (${metadataResult.stxRecord.contractId})`);
  } else {
    console.log(`2️⃣ Token Metadata: ❌ STX record NOT found`);
  }
  
  // Step 3: Raw balances
  if (metadataResult?.tokenRecords) {
    const balanceResult = await testSTXInBalancesFetch(userId, metadataResult.tokenRecords);
    if (balanceResult?.stxEntries && balanceResult.stxEntries.length > 0) {
      const stxEntry = balanceResult.stxEntries[0][1];
      console.log(`3️⃣ Raw Balances: STX found with balance ${stxEntry.balance}`);
    } else {
      console.log(`3️⃣ Raw Balances: ❌ STX NOT found in fetchUserBalances`);
    }
  }
  
  // Step 4: Message creation
  if (metadataResult?.stxRecord) {
    const messageResult = await testSTXMessageCreation(userId, metadataResult.stxRecord);
    if (messageResult) {
      console.log(`4️⃣ Message Creation: STX message created successfully`);
    }
  }
  
  // Step 5: Production endpoint
  const productionResult = await testProductionSTXResponse(userId);
  if (productionResult?.stxBalances && productionResult.stxBalances.length > 0) {
    const prodSTX = productionResult.stxBalances[0];
    console.log(`5️⃣ Production Endpoint: STX balance = ${prodSTX.balance}`);
  } else {
    console.log(`5️⃣ Production Endpoint: ❌ STX NOT found in production response`);
  }
  
  console.log('='.repeat(60));
}

function analyzeSTXDiscrepancy(directSTX: any, productionResult: any) {
  if (!directSTX || !productionResult) return;
  
  log('Analyzing STX discrepancy...');
  
  const directBalance = directSTX.stxTotal;
  const productionSTX = productionResult.stxBalances?.[0];
  const productionBalance = productionSTX ? Number(productionSTX.balance) : 0;
  
  const discrepancy = Math.abs(directBalance - productionBalance);
  const expectedFromDeepAnalysis = 4051697964;
  
  console.log('\n💡 STX DISCREPANCY ANALYSIS:');
  console.log('='.repeat(60));
  console.log(`🔗 Direct Stacks API: ${directBalance.toLocaleString()} micro-STX`);
  console.log(`🌐 Production Endpoint: ${productionBalance.toLocaleString()} micro-STX`);
  console.log(`📊 Expected (Deep Analysis): ${expectedFromDeepAnalysis.toLocaleString()} micro-STX`);
  console.log(`📏 Discrepancy: ${discrepancy.toLocaleString()} micro-STX`);
  console.log(`💰 In STX: ${(discrepancy / 1_000_000).toFixed(2)} STX`);
  
  // Diagnosis
  if (directBalance === expectedFromDeepAnalysis && productionBalance === 0) {
    console.log('\n🔍 DIAGNOSIS: Production endpoint is returning 0 for STX while direct API shows correct balance');
    console.log('   ➤ Issue is likely in BalancesParty caching or message creation logic');
    console.log('   ➤ STX token may be filtered out or not processed correctly');
  } else if (directBalance !== expectedFromDeepAnalysis) {
    console.log('\n🔍 DIAGNOSIS: Direct API balance differs from expected value');
    console.log('   ➤ Check if user balance changed or if there are multiple balance sources');
  } else {
    console.log('\n🔍 DIAGNOSIS: Unable to determine root cause');
  }
  
  console.log('='.repeat(60));
}

function printSummary() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 STX BALANCE TRACE SUMMARY');
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
  console.log('   1. If STX is found in direct API but not production: Check BalancesParty caching');
  console.log('   2. If STX is found in raw balances but not production: Check message creation logic');
  console.log('   3. If STX metadata is missing: Check token summaries API');
  console.log('   4. If all steps work: Check production environment differences');
  
  console.log('\n' + '='.repeat(80));
}

async function main() {
  const userId = process.argv[2] || DEFAULT_TEST_USER;
  
  console.log('🔬 STX BALANCE DEEP DIVE INVESTIGATION');
  console.log('='.repeat(80));
  console.log(`👤 Test User: ${userId.slice(0, 8)}...${userId.slice(-4)}`);
  console.log(`🎯 Expected STX: 4,051.697964 STX (4,051,697,964 micro-STX)`);
  console.log(`⏰ Started: ${new Date().toLocaleTimeString()}`);
  console.log('='.repeat(80));
  
  try {
    // Trace the complete STX data flow
    await traceSTXDataFlow(userId);
    
    // Get final results for analysis
    const directSTX = await testDirectSTXBalance(userId);
    const productionResult = await testProductionSTXResponse(userId);
    
    // Analyze the discrepancy
    analyzeSTXDiscrepancy(directSTX, productionResult);
    
  } catch (error) {
    console.error('❌ STX trace failed:', error);
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
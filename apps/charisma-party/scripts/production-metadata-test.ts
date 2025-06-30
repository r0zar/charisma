#!/usr/bin/env tsx

/**
 * Production Metadata Testing Script
 * Tests token metadata loading in production context to validate BalancesParty behavior
 * 
 * Usage: pnpm script production-metadata-test
 */

import { loadTokenMetadata, fetchTokenSummariesFromAPI } from '../src/balances-lib.js';

interface MetadataTestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration?: number;
  data?: any;
}

const results: MetadataTestResult[] = [];

function log(message: string) {
  console.log(`🧪 ${message}`);
}

function logResult(result: MetadataTestResult) {
  const emoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
  const duration = result.duration ? ` (${result.duration}ms)` : '';
  console.log(`${emoji} ${result.test}${duration}: ${result.message}`);
  results.push(result);
}

async function testTokenSummariesAPI() {
  log('Testing token summaries API directly...');
  
  try {
    const start = Date.now();
    const summaries = await fetchTokenSummariesFromAPI();
    const duration = Date.now() - start;
    
    logResult({
      test: 'Token Summaries API',
      status: 'PASS',
      message: `Retrieved ${summaries.length} token summaries`,
      duration,
      data: { count: summaries.length, firstToken: summaries[0] }
    });
    
    // Test specific token presence
    const stxToken = summaries.find(s => s.contractId === '.stx');
    const alexToken = summaries.find(s => s.symbol === 'ALEX');
    const subnetTokens = summaries.filter(s => s.type === 'SUBNET');
    
    logResult({
      test: 'Key Token Presence',
      status: (stxToken && alexToken) ? 'PASS' : 'FAIL',
      message: `STX: ${stxToken ? '✓' : '✗'}, ALEX: ${alexToken ? '✓' : '✗'}, Subnet tokens: ${subnetTokens.length}`,
      data: { stxToken, alexToken, subnetCount: subnetTokens.length }
    });
    
    return summaries;
    
  } catch (error) {
    logResult({
      test: 'Token Summaries API',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    return null;
  }
}

async function testTokenMetadataLoading() {
  log('Testing token metadata loading (full process)...');
  
  try {
    const start = Date.now();
    const tokenRecords = await loadTokenMetadata();
    const duration = Date.now() - start;
    
    logResult({
      test: 'Token Metadata Loading',
      status: 'PASS',
      message: `Loaded ${tokenRecords.size} token records`,
      duration,
      data: { count: tokenRecords.size }
    });
    
    // Test specific records
    const stxRecord = tokenRecords.get('.stx');
    const alexRecord = Array.from(tokenRecords.values()).find(r => r.symbol === 'ALEX');
    const subnetRecords = Array.from(tokenRecords.values()).filter(r => r.type === 'SUBNET');
    
    logResult({
      test: 'Key Token Records',
      status: (stxRecord && alexRecord) ? 'PASS' : 'FAIL',
      message: `STX record: ${stxRecord ? '✓' : '✗'}, ALEX record: ${alexRecord ? '✓' : '✗'}, Subnet records: ${subnetRecords.length}`,
      data: { 
        stxRecord: stxRecord ? { symbol: stxRecord.symbol, decimals: stxRecord.decimals } : null,
        alexRecord: alexRecord ? { symbol: alexRecord.symbol, contractId: alexRecord.contractId } : null,
        subnetCount: subnetRecords.length
      }
    });
    
    // Test record structure
    if (stxRecord) {
      const hasRequiredFields = !!(stxRecord.symbol && stxRecord.decimals !== undefined && stxRecord.contractId);
      logResult({
        test: 'Token Record Structure',
        status: hasRequiredFields ? 'PASS' : 'FAIL',
        message: `Required fields present: ${hasRequiredFields}`,
        data: {
          symbol: stxRecord.symbol,
          decimals: stxRecord.decimals,
          contractId: stxRecord.contractId,
          type: stxRecord.type,
          price: stxRecord.price
        }
      });
    }
    
    return tokenRecords;
    
  } catch (error) {
    logResult({
      test: 'Token Metadata Loading',
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    });
    return null;
  }
}

async function testEnvironmentVariables() {
  log('Testing environment variables...');
  
  const requiredVars = [
    'TOKEN_SUMMARIES_URL',
    'NEXT_PUBLIC_TOKEN_SUMMARIES_URL',
    'HIRO_API_KEY'
  ];
  
  const envStatus: Record<string, string | undefined> = {};
  
  requiredVars.forEach(varName => {
    envStatus[varName] = process.env[varName];
  });
  
  const tokenSummariesUrl = process.env.TOKEN_SUMMARIES_URL || 
                           process.env.NEXT_PUBLIC_TOKEN_SUMMARIES_URL ||
                           'https://invest.charisma.rocks/api/v1/tokens/all?includePricing=true';
  
  logResult({
    test: 'Environment Variables',
    status: 'PASS',
    message: `Token summaries URL: ${tokenSummariesUrl}`,
    data: envStatus
  });
  
  // Test URL accessibility
  try {
    const start = Date.now();
    const response = await fetch(tokenSummariesUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'charisma-party-debug'
      }
    });
    const duration = Date.now() - start;
    
    logResult({
      test: 'URL Accessibility',
      status: response.ok ? 'PASS' : 'FAIL',
      message: `${tokenSummariesUrl} returned ${response.status}`,
      duration,
      data: { status: response.status, statusText: response.statusText }
    });
    
  } catch (error) {
    logResult({
      test: 'URL Accessibility',
      status: 'FAIL',
      message: `Failed to fetch: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

async function testProductionContext() {
  log('Testing production context simulation...');
  
  // Simulate production environment
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  
  try {
    const tokenRecords = await loadTokenMetadata();
    
    logResult({
      test: 'Production Context Loading',
      status: 'PASS',
      message: `Loaded ${tokenRecords.size} records in production context`,
      data: { count: tokenRecords.size }
    });
    
  } catch (error) {
    logResult({
      test: 'Production Context Loading',
      status: 'FAIL',
      message: `Error in production context: ${error instanceof Error ? error.message : String(error)}`
    });
  } finally {
    // Restore original environment
    process.env.NODE_ENV = originalEnv;
  }
}

function analyzeDiscrepancies(summaries: any[] | null, tokenRecords: Map<string, any> | null) {
  if (!summaries || !tokenRecords) return;
  
  log('Analyzing data discrepancies...');
  
  const summaryIds = new Set(summaries.map(s => s.contractId));
  const recordIds = new Set(tokenRecords.keys());
  
  const onlyInSummaries = Array.from(summaryIds).filter(id => !recordIds.has(id));
  const onlyInRecords = Array.from(recordIds).filter(id => !summaryIds.has(id));
  const inBoth = Array.from(summaryIds).filter(id => recordIds.has(id));
  
  logResult({
    test: 'Data Consistency',
    status: (onlyInSummaries.length === 0 && onlyInRecords.length === 0) ? 'PASS' : 'FAIL',
    message: `Matched: ${inBoth.length}, Only in summaries: ${onlyInSummaries.length}, Only in records: ${onlyInRecords.length}`,
    data: {
      matched: inBoth.length,
      onlyInSummaries: onlyInSummaries.slice(0, 5),
      onlyInRecords: onlyInRecords.slice(0, 5)
    }
  });
  
  // Check for critical tokens
  const criticalTokens = ['.stx', 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex'];
  const missingCritical = criticalTokens.filter(id => !recordIds.has(id));
  
  if (missingCritical.length > 0) {
    logResult({
      test: 'Critical Token Presence',
      status: 'FAIL',
      message: `Missing critical tokens: ${missingCritical.join(', ')}`,
      data: { missing: missingCritical }
    });
  } else {
    logResult({
      test: 'Critical Token Presence',
      status: 'PASS',
      message: 'All critical tokens present',
      data: { critical: criticalTokens }
    });
  }
}

function printSummary() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 PRODUCTION METADATA TEST SUMMARY');
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
    console.log('\n🎉 All metadata tests passed! Token loading is working correctly.');
  } else {
    console.log('\n⚠️ Some metadata tests failed. This may explain the production balance discrepancies.');
  }
  
  console.log('\n' + '='.repeat(80));
}

async function main() {
  console.log('🔬 PRODUCTION METADATA TESTING');
  console.log('='.repeat(80));
  console.log(`⏰ Started: ${new Date().toLocaleTimeString()}`);
  console.log('='.repeat(80));
  
  try {
    // Test environment setup
    await testEnvironmentVariables();
    
    // Test token summaries API directly
    const summaries = await testTokenSummariesAPI();
    
    // Test full metadata loading process
    const tokenRecords = await testTokenMetadataLoading();
    
    // Test production context
    await testProductionContext();
    
    // Analyze discrepancies
    analyzeDiscrepancies(summaries, tokenRecords);
    
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
import { NextResponse } from 'next/server';
import { unifiedBlobStorage } from '@/lib/storage/unified-blob-storage';

export const runtime = 'edge';

/**
 * Test endpoint for partial update protection
 * GET /api/cron/test-oracle
 */
export async function GET() {
  const startTime = Date.now();
  
  try {
    console.log('[TestOracle] Testing partial update protection...');
    
    const results = {
      tests: [] as any[],
      summary: {
        passed: 0,
        failed: 0,
        total: 0
      }
    };

    // Test 1: Try to replace entire contracts section (should fail)
    try {
      await unifiedBlobStorage.put('contracts', { test: 'dangerous replacement' });
      results.tests.push({
        name: 'Dangerous contracts replacement',
        status: 'FAILED',
        reason: 'Should have thrown error but did not'
      });
      results.summary.failed++;
    } catch (error) {
      results.tests.push({
        name: 'Dangerous contracts replacement',
        status: 'PASSED',
        reason: error instanceof Error ? error.message : 'Unknown error'
      });
      results.summary.passed++;
    }
    results.summary.total++;

    // Test 2: Try to replace entire addresses section (should fail)
    try {
      await unifiedBlobStorage.put('addresses', { test: 'dangerous replacement' });
      results.tests.push({
        name: 'Dangerous addresses replacement',
        status: 'FAILED',
        reason: 'Should have thrown error but did not'
      });
      results.summary.failed++;
    } catch (error) {
      results.tests.push({
        name: 'Dangerous addresses replacement',
        status: 'PASSED',
        reason: error instanceof Error ? error.message : 'Unknown error'
      });
      results.summary.passed++;
    }
    results.summary.total++;

    // Test 3: Try to replace entire balances section (should fail)
    try {
      await unifiedBlobStorage.put('balances', { test: 'dangerous replacement' });
      results.tests.push({
        name: 'Dangerous balances replacement',
        status: 'FAILED',
        reason: 'Should have thrown error but did not'
      });
      results.summary.failed++;
    } catch (error) {
      results.tests.push({
        name: 'Dangerous balances replacement',
        status: 'PASSED',
        reason: error instanceof Error ? error.message : 'Unknown error'
      });
      results.summary.passed++;
    }
    results.summary.total++;

    // Test 4: Safe individual contract update (should pass)
    try {
      await unifiedBlobStorage.put('contracts/test-contract.test', {
        contractId: 'test-contract.test',
        name: 'Test Contract',
        source: 'test-oracle'
      });
      results.tests.push({
        name: 'Safe individual contract update',
        status: 'PASSED',
        reason: 'Successfully updated individual contract'
      });
      results.summary.passed++;
    } catch (error) {
      results.tests.push({
        name: 'Safe individual contract update',
        status: 'FAILED',
        reason: error instanceof Error ? error.message : 'Unknown error'
      });
      results.summary.failed++;
    }
    results.summary.total++;

    // Test 5: Safe individual balance update (should pass)
    try {
      await unifiedBlobStorage.put('balances/test-address', {
        address: 'test-address',
        balance: '1000',
        source: 'test-oracle'
      });
      results.tests.push({
        name: 'Safe individual balance update',
        status: 'PASSED',
        reason: 'Successfully updated individual balance'
      });
      results.summary.passed++;
    } catch (error) {
      results.tests.push({
        name: 'Safe individual balance update',
        status: 'FAILED',
        reason: error instanceof Error ? error.message : 'Unknown error'
      });
      results.summary.failed++;
    }
    results.summary.total++;

    // Test 6: Force replace with flag (should pass)
    try {
      await unifiedBlobStorage.put('contracts', {
        'test-contract.forced': {
          contractId: 'test-contract.forced',
          name: 'Force Replaced Contract',
          source: 'test-oracle-forced'
        },
        lastUpdated: new Date().toISOString(),
        source: 'test-oracle-forced-replacement'
      }, { allowFullReplace: true });
      
      results.tests.push({
        name: 'Force replace with flag',
        status: 'PASSED',
        reason: 'Successfully forced replacement with allowFullReplace flag'
      });
      results.summary.passed++;
    } catch (error) {
      results.tests.push({
        name: 'Force replace with flag',
        status: 'FAILED',
        reason: error instanceof Error ? error.message : 'Unknown error'
      });
      results.summary.failed++;
    }
    results.summary.total++;

    // Test 7: Merge functionality test
    try {
      // First add some data
      await unifiedBlobStorage.put('contracts/merge-test.test', {
        contractId: 'merge-test.test',
        name: 'Original Name',
        version: 1
      });
      
      // Then merge with additional data
      await unifiedBlobStorage.put('contracts/merge-test.test', {
        description: 'Added via merge',
        version: 2
      }, { merge: true });
      
      results.tests.push({
        name: 'Merge functionality test',
        status: 'PASSED',
        reason: 'Successfully merged contract data'
      });
      results.summary.passed++;
    } catch (error) {
      results.tests.push({
        name: 'Merge functionality test',
        status: 'FAILED',
        reason: error instanceof Error ? error.message : 'Unknown error'
      });
      results.summary.failed++;
    }
    results.summary.total++;
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      processingTime: `${processingTime}ms`,
      results,
      source: 'test-oracle'
    });
    
  } catch (error) {
    console.error('[TestOracle] Error:', error);
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      processingTime: `${processingTime}ms`,
      error: 'Test oracle failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Also support POST for cron services
export const POST = GET;
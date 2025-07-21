#!/usr/bin/env tsx
/**
 * E2E Test Runner
 * Runs all E2E tests and provides a summary
 */

import './utils';
import { execSync } from 'child_process';

interface TestResult {
  name: string;
  command: string;
  passed: boolean;
  duration: number;
  error?: string;
}

const tests = [
  {
    name: 'Connection Test',
    command: 'npm run test:e2e:connection',
    description: 'Tests blob storage connectivity'
  },
  {
    name: 'KV Storage Test',
    command: 'npm run test:e2e:kv',
    description: 'Tests KV storage operations'
  },
  {
    name: 'Balance Reads Test',
    command: 'npm run test:e2e:balance',
    description: 'Tests balance service read operations'
  },
  {
    name: 'Snapshot E2E Test',
    command: 'npm run test:e2e:snapshot',
    description: 'Tests complete snapshot workflow'
  },
  {
    name: 'Comprehensive Test',
    command: 'npm run test:e2e:all',
    description: 'Tests all components together'
  }
];

async function runE2ETests() {
  console.log('🚀 Running E2E Test Suite...');
  console.log('================================');
  
  const startTime = Date.now();
  const results: TestResult[] = [];
  
  for (const test of tests) {
    console.log(`\n🔄 Running ${test.name}...`);
    console.log(`   ${test.description}`);
    
    const testStartTime = Date.now();
    
    try {
      execSync(test.command, { 
        stdio: 'inherit',
        timeout: 30000 // 30 second timeout
      });
      
      const duration = Date.now() - testStartTime;
      results.push({
        name: test.name,
        command: test.command,
        passed: true,
        duration
      });
      
      console.log(`✅ ${test.name} completed in ${(duration / 1000).toFixed(2)}s`);
      
    } catch (error) {
      const duration = Date.now() - testStartTime;
      results.push({
        name: test.name,
        command: test.command,
        passed: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      console.log(`❌ ${test.name} failed after ${(duration / 1000).toFixed(2)}s`);
    }
  }
  
  // Summary
  const totalDuration = Date.now() - startTime;
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = results.filter(r => !r.passed).length;
  const successRate = Math.round((passedTests / results.length) * 100);
  
  console.log('\n📋 E2E Test Summary:');
  console.log('====================');
  console.log(`⏱️  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`✅ Passed: ${passedTests}/${results.length}`);
  console.log(`❌ Failed: ${failedTests}/${results.length}`);
  console.log(`📊 Success Rate: ${successRate}%`);
  
  console.log('\n📊 Test Results:');
  console.log('----------------');
  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const duration = `${(result.duration / 1000).toFixed(2)}s`;
    console.log(`${status} ${result.name.padEnd(20)} (${duration})`);
    
    if (!result.passed && result.error) {
      console.log(`     Error: ${result.error}`);
    }
  });
  
  if (passedTests === results.length) {
    console.success('\n🎉 All E2E tests passed!');
    console.log('🚀 Balance service is ready for production use!');
  } else {
    console.error(`\n⚠️  ${failedTests} test(s) failed. Please check the logs above.`);
  }
  
  // Exit with appropriate code
  process.exit(failedTests > 0 ? 1 : 0);
}

// Run the tests
runE2ETests().catch(console.error);
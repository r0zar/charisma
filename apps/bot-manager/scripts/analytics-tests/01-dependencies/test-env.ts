#!/usr/bin/env node

/**
 * Test Environment Setup
 * Tests environment variables and KV cache functionality
 * Usage: node --import tsx scripts/analytics-tests/01-dependencies/test-env.ts
 */

import { kv } from '@vercel/kv';
import { logger, logExecution, logResult, logError } from '../../logger';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testEnvironmentVariables() {
  console.log('\n🔍 Test 1: Environment Variables');
  console.log('==================================');
  
  const envVars = {
    KV_REST_API_URL: process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
    KV_REST_API_READ_ONLY_TOKEN: process.env.KV_REST_API_READ_ONLY_TOKEN,
    NEXT_PUBLIC_DATA_PHASE: process.env.NEXT_PUBLIC_DATA_PHASE,
    NEXT_PUBLIC_CACHE_ENABLED: process.env.NEXT_PUBLIC_CACHE_ENABLED,
    PARTYKIT_URL: process.env.PARTYKIT_URL,
  };
  
  console.log('📋 Environment Variables Status:');
  Object.entries(envVars).forEach(([key, value]) => {
    const status = value ? '✅' : '❌';
    const displayValue = value ? (key.includes('TOKEN') ? '***HIDDEN***' : value) : 'NOT SET';
    console.log(`   ${status} ${key}: ${displayValue}`);
  });
  
  const requiredEnvVars = ['KV_REST_API_URL', 'KV_REST_API_TOKEN'];
  const missingRequired = requiredEnvVars.filter(key => !envVars[key as keyof typeof envVars]);
  
  const success = missingRequired.length === 0;
  
  await logger.info('Environment variables check completed');
  
  if (success) {
    console.log('✅ All required environment variables are set');
  } else {
    console.log(`❌ Missing required variables: ${missingRequired.join(', ')}`);
  }
  
  return { success, missingRequired, envVars };
}

async function testKVConnection() {
  console.log('\n🔍 Test 2: KV Cache Connection');
  console.log('================================');
  
  try {
    // Test basic connection by trying to read a non-existent key
    console.log('📡 Testing KV connection...');
    const testResult = await kv.get('test-connection-key');
    
    console.log('✅ KV connection successful');
    console.log(`📊 Test result: ${testResult === null ? 'null (expected)' : testResult}`);
    
    await logger.success('KV connection test passed');
    return { success: true };
  } catch (error) {
    console.error('❌ KV connection failed:', error instanceof Error ? error.message : String(error));
    await logger.error('KV connection test failed');
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function testKVOperations() {
  console.log('\n🔍 Test 3: KV Cache Operations');
  console.log('================================');
  
  const testKey = 'analytics-test-' + Date.now();
  const testData = {
    message: 'Hello from analytics test',
    timestamp: new Date().toISOString(),
    data: { test: true, number: 42 }
  };
  
  try {
    // Test write operation
    console.log(`📝 Testing write operation (key: ${testKey})`);
    await kv.set(testKey, testData, { ex: 60 }); // Expire in 60 seconds
    console.log('✅ Write operation successful');
    
    // Test read operation
    console.log('📖 Testing read operation');
    const readResult = await kv.get(testKey);
    console.log('✅ Read operation successful');
    console.log(`📊 Data matches: ${JSON.stringify(readResult) === JSON.stringify(testData)}`);
    
    // Test delete operation
    console.log('🗑️  Testing delete operation');
    const deleteResult = await kv.del(testKey);
    console.log(`✅ Delete operation successful (${deleteResult} key deleted)`);
    
    // Verify deletion
    console.log('🔍 Verifying deletion');
    const verifyResult = await kv.get(testKey);
    const deletionVerified = verifyResult === null;
    console.log(`✅ Deletion verified: ${deletionVerified}`);
    
    await logger.success('KV operations test passed');
    
    return { 
      success: true, 
      dataMatches: JSON.stringify(readResult) === JSON.stringify(testData),
      deletionVerified 
    };
  } catch (error) {
    console.error('❌ KV operations failed:', error instanceof Error ? error.message : String(error));
    await logger.error('KV operations test failed');
    
    // Cleanup attempt
    try {
      await kv.del(testKey);
    } catch (cleanupError) {
      console.log('⚠️  Cleanup also failed (this is ok)');
    }
    
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function testKVPerformance() {
  console.log('\n🔍 Test 4: KV Cache Performance');
  console.log('=================================');
  
  const testKey = 'analytics-perf-test-' + Date.now();
  const testData = {
    largeArray: Array(1000).fill({ id: 1, name: 'test', value: Math.random() }),
    timestamp: new Date().toISOString(),
  };
  
  try {
    // Test write performance
    console.log('⏱️  Testing write performance...');
    const writeStart = Date.now();
    await kv.set(testKey, testData, { ex: 30 });
    const writeTime = Date.now() - writeStart;
    console.log(`✅ Write completed in ${writeTime}ms`);
    
    // Test read performance
    console.log('⏱️  Testing read performance...');
    const readStart = Date.now();
    const readResult = await kv.get(testKey);
    const readTime = Date.now() - readStart;
    console.log(`✅ Read completed in ${readTime}ms`);
    
    // Test multiple reads (cache performance)
    console.log('⏱️  Testing multiple reads...');
    const multiReadStart = Date.now();
    await Promise.all([
      kv.get(testKey),
      kv.get(testKey),
      kv.get(testKey),
    ]);
    const multiReadTime = Date.now() - multiReadStart;
    console.log(`✅ 3 parallel reads completed in ${multiReadTime}ms`);
    
    // Cleanup
    await kv.del(testKey);
    
    const performanceGood = writeTime < 1000 && readTime < 500 && multiReadTime < 1000;
    
    await logger.info('KV performance test completed');
    
    if (performanceGood) {
      console.log('✅ KV performance is acceptable');
    } else {
      console.log('⚠️  KV performance may be slow but functional');
    }
    
    return { 
      success: true, 
      writeTime, 
      readTime, 
      multiReadTime,
      performanceGood 
    };
  } catch (error) {
    console.error('❌ KV performance test failed:', error instanceof Error ? error.message : String(error));
    await logger.error('KV performance test failed');
    
    // Cleanup attempt
    try {
      await kv.del(testKey);
    } catch (cleanupError) {
      console.log('⚠️  Cleanup also failed (this is ok)');
    }
    
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  try {
    const startTime = Date.now();
    
    await logExecution('Environment Setup Test', 'Testing environment variables and KV cache functionality');
    
    console.log('🧪 Environment Setup Test');
    console.log('==========================');
    console.log('Testing environment variables and KV cache functionality\n');
    
    // Run all tests
    const test1 = await testEnvironmentVariables();
    const test2 = await testKVConnection();
    const test3 = await testKVOperations();
    const test4 = await testKVPerformance();
    
    // Summary
    console.log('\n📊 Test Summary');
    console.log('================');
    console.log(`✅ Environment variables: ${test1.success ? 'PASS' : 'FAIL'}`);
    console.log(`✅ KV connection: ${test2.success ? 'PASS' : 'FAIL'}`);
    console.log(`✅ KV operations: ${test3.success ? 'PASS' : 'FAIL'}`);
    console.log(`✅ KV performance: ${test4.success ? 'PASS' : 'FAIL'}`);
    
    const allPassed = test1.success && test2.success && test3.success && test4.success;
    
    const duration = Date.now() - startTime;
    await logResult('Environment Setup Test', {
      exitCode: allPassed ? 0 : 1,
      stdout: allPassed ? 'All tests passed' : 'Some tests failed',
      summary: {
        environmentVariables: test1.success,
        kvConnection: test2.success,
        kvOperations: test3.success,
        kvPerformance: test4.success,
        missingEnvVars: test1.missingRequired || [],
        totalDuration: duration + 'ms',
      }
    }, duration);
    
    if (allPassed) {
      console.log('\n🎉 All Environment tests PASSED!');
      console.log('✅ Environment setup is working correctly');
    } else {
      console.log('\n❌ Some Environment tests FAILED!');
      console.log('🔧 Check the logs for detailed error information');
      
      if (!test1.success) {
        console.log('\n💡 Environment Variables Issues:');
        console.log('   • Ensure .env.local file exists and contains required variables');
        console.log('   • Check KV_REST_API_URL and KV_REST_API_TOKEN are set correctly');
      }
      
      if (!test2.success || !test3.success) {
        console.log('\n💡 KV Cache Issues:');
        console.log('   • Verify Vercel KV credentials are correct');
        console.log('   • Check network connectivity to Vercel KV service');
        console.log('   • Ensure KV store is properly configured in Vercel dashboard');
      }
      
      process.exit(1);
    }
    
  } catch (error) {
    await logError('Environment Setup Test failed', error instanceof Error ? error : new Error(String(error)));
    console.error('\n❌ Test script failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Execute main function
main().catch(async (error) => {
  await logError('Environment Setup Test crashed', error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
});
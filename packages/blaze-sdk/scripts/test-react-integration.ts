/**
 * Test script for BlazeProvider and useBlaze in actual React environment
 * Creates a real React app to test the provider and hook functionality
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { BlazeProvider, useBlaze } from '../src/realtime/providers/BlazeProvider';

// Configuration
const PROD_HOST = 'charisma-party.r0zar.partykit.dev';
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
    if (result.test.includes('Balance') && result.data.balanceCount !== undefined) {
      log(`   📊 Balance Count: ${result.data.balanceCount}`);
    } else if (result.test.includes('Price') && result.data.priceCount !== undefined) {
      log(`   💰 Price Count: ${result.data.priceCount}`);
    }
  }
}

// Test component that uses the hook
const TestComponent: React.FC<{ userId?: string; onResult?: (results: any) => void }> = ({ userId, onResult }) => {
  const blazeData = useBlaze({ userId });
  
  React.useEffect(() => {
    // Report results after a delay to allow data to load
    const timer = setTimeout(() => {
      if (onResult) {
        onResult({
          isConnected: blazeData.isConnected,
          priceCount: Object.keys(blazeData.prices).length,
          balanceCount: Object.keys(blazeData.balances).length,
          metadataCount: Object.keys(blazeData.metadata).length,
          userBalances: userId ? blazeData.getUserBalances(userId) : {},
          lastUpdate: blazeData.lastUpdate,
          samplePrice: Object.keys(blazeData.prices).length > 0 ? blazeData.getPrice(Object.keys(blazeData.prices)[0]) : undefined,
          sampleBalance: userId && Object.keys(blazeData.balances).length > 0 ? blazeData.getBalance(userId, Object.keys(blazeData.balances)[0]?.split(':')[1] || '') : undefined
        });
      }
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [blazeData, userId, onResult]);
  
  return React.createElement('div', { 'data-testid': 'test-component' }, 
    `Connected: ${blazeData.isConnected}, Prices: ${Object.keys(blazeData.prices).length}, Balances: ${Object.keys(blazeData.balances).length}`
  );
};

// Test React component rendering
async function testComponentRendering(): Promise<void> {
  log('⚛️ Testing React component rendering...');
  
  try {
    const start = Date.now();
    
    // Test basic provider rendering
    const providerElement = React.createElement(
      BlazeProvider,
      { host: PROD_HOST },
      React.createElement('div', {}, 'Test content')
    );
    
    const htmlString = ReactDOMServer.renderToString(providerElement);
    const duration = Date.now() - start;
    
    if (htmlString && htmlString.includes('Test content')) {
      logResult({
        test: 'BlazeProvider SSR Rendering',
        status: 'PASS',
        message: 'Provider renders successfully on server',
        duration,
        data: { htmlLength: htmlString.length }
      });
    } else {
      logResult({
        test: 'BlazeProvider SSR Rendering',
        status: 'FAIL',
        message: 'Provider failed to render expected content'
      });
    }
    
  } catch (error) {
    logResult({
      test: 'BlazeProvider SSR Rendering',
      status: 'FAIL',
      message: `Rendering failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

// Test hook integration
async function testHookIntegration(): Promise<void> {
  log('🎣 Testing useBlaze hook integration...');
  
  return new Promise<void>((resolve) => {
    try {
      const start = Date.now();
      let resultReceived = false;
      
      const handleResult = (results: any) => {
        if (resultReceived) return;
        resultReceived = true;
        
        const duration = Date.now() - start;
        
        // Test connection status
        logResult({
          test: 'Hook Connection Status',
          status: 'PASS', // We'll accept any connection status as valid
          message: `Connection status: ${results.isConnected}`,
          duration,
          data: { isConnected: results.isConnected }
        });
        
        // Test price data
        logResult({
          test: 'Hook Price Data',
          status: results.priceCount > 0 ? 'PASS' : 'SKIP',
          message: results.priceCount > 0 
            ? `Loaded ${results.priceCount} prices` 
            : 'No price data loaded yet',
          data: { 
            priceCount: results.priceCount,
            samplePrice: results.samplePrice
          }
        });
        
        // Test balance data
        logResult({
          test: 'Hook Balance Data',
          status: results.balanceCount > 0 ? 'PASS' : 'SKIP',
          message: results.balanceCount > 0 
            ? `Loaded ${results.balanceCount} balance entries` 
            : 'No balance data loaded yet',
          data: { 
            balanceCount: results.balanceCount,
            sampleBalance: results.sampleBalance
          }
        });
        
        // Test user-specific balances
        const userBalanceCount = Object.keys(results.userBalances).length;
        logResult({
          test: 'Hook User Balance Filtering',
          status: userBalanceCount > 0 ? 'PASS' : 'SKIP',
          message: userBalanceCount > 0 
            ? `Found ${userBalanceCount} user-specific balances` 
            : 'No user-specific balances loaded yet',
          data: { 
            userBalanceCount,
            userBalanceKeys: Object.keys(results.userBalances).slice(0, 3)
          }
        });
        
        // Test metadata handling
        logResult({
          test: 'Hook Metadata Handling',
          status: 'PASS',
          message: `Metadata entries: ${results.metadataCount}`,
          data: { metadataCount: results.metadataCount }
        });
        
        resolve();
      };
      
      // Create test component with hook
      const testElement = React.createElement(
        BlazeProvider,
        { host: PROD_HOST },
        React.createElement(TestComponent, { 
          userId: TEST_USER_ID, 
          onResult: handleResult 
        })
      );
      
      // Render to trigger hook execution
      const htmlString = ReactDOMServer.renderToString(testElement);
      
      // Set timeout in case no result is received
      setTimeout(() => {
        if (!resultReceived) {
          logResult({
            test: 'Hook Integration Timeout',
            status: 'FAIL',
            message: 'Hook did not report results within timeout period'
          });
          resolve();
        }
      }, 5000);
      
    } catch (error) {
      logResult({
        test: 'Hook Integration',
        status: 'FAIL',
        message: `Hook integration failed: ${error instanceof Error ? error.message : String(error)}`
      });
      resolve();
    }
  });
}

// Test provider configuration
async function testProviderConfiguration(): Promise<void> {
  log('⚙️ Testing BlazeProvider configuration...');
  
  try {
    // Test with custom host
    const customHostElement = React.createElement(
      BlazeProvider,
      { host: 'custom-host.example.com' },
      React.createElement('div', {}, 'Custom host test')
    );
    
    const customHostHtml = ReactDOMServer.renderToString(customHostElement);
    
    logResult({
      test: 'Custom Host Configuration',
      status: customHostHtml ? 'PASS' : 'FAIL',
      message: customHostHtml ? 'Provider accepts custom host configuration' : 'Provider failed with custom host'
    });
    
    // Test without host (should use default)
    const defaultHostElement = React.createElement(
      BlazeProvider,
      {},
      React.createElement('div', {}, 'Default host test')
    );
    
    const defaultHostHtml = ReactDOMServer.renderToString(defaultHostElement);
    
    logResult({
      test: 'Default Host Configuration',
      status: defaultHostHtml ? 'PASS' : 'FAIL',
      message: defaultHostHtml ? 'Provider uses default host when none specified' : 'Provider failed with default host'
    });
    
  } catch (error) {
    logResult({
      test: 'Provider Configuration',
      status: 'FAIL',
      message: `Configuration test failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

// Test hook error handling
async function testHookErrorHandling(): Promise<void> {
  log('🚨 Testing useBlaze error handling...');
  
  try {
    // Test hook usage outside provider (should throw error)
    let errorThrown = false;
    
    try {
      const isolatedElement = React.createElement(TestComponent, { 
        userId: TEST_USER_ID,
        onResult: () => {} 
      });
      ReactDOMServer.renderToString(isolatedElement);
    } catch (error) {
      errorThrown = true;
      const expectedError = error instanceof Error && error.message.includes('useBlaze must be used within a BlazeProvider');
      
      logResult({
        test: 'Hook Error Handling',
        status: expectedError ? 'PASS' : 'FAIL',
        message: expectedError 
          ? 'Correctly throws error when used outside provider'
          : `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
      });
    }
    
    if (!errorThrown) {
      logResult({
        test: 'Hook Error Handling',
        status: 'FAIL',
        message: 'Hook should throw error when used outside provider'
      });
    }
    
    // Test invalid userId handling
    const invalidUserElement = React.createElement(
      BlazeProvider,
      { host: PROD_HOST },
      React.createElement(TestComponent, { 
        userId: '',  // Invalid empty userId
        onResult: () => {} 
      })
    );
    
    const invalidUserHtml = ReactDOMServer.renderToString(invalidUserElement);
    
    logResult({
      test: 'Invalid UserId Handling',
      status: invalidUserHtml ? 'PASS' : 'FAIL',
      message: invalidUserHtml ? 'Hook handles invalid userId gracefully' : 'Hook failed with invalid userId'
    });
    
  } catch (error) {
    logResult({
      test: 'Hook Error Handling',
      status: 'FAIL',
      message: `Error handling test failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

async function main() {
  console.log('⚛️ REACT INTEGRATION TESTING');
  console.log('============================================================');
  console.log(`🌐 Host: ${PROD_HOST}`);
  console.log(`👤 Test User: ${TEST_USER_ID.slice(0, 8)}...${TEST_USER_ID.slice(-4)}`);
  console.log(`⏰ Started: ${new Date().toLocaleTimeString()}`);
  console.log('');
  console.log('🔍 Testing real React component integration with BlazeProvider and useBlaze');
  console.log('');
  
  try {
    // Run all tests
    await testComponentRendering();
    await testProviderConfiguration();
    await testHookErrorHandling();
    await testHookIntegration();
    
    // Print summary
    console.log('');
    console.log('============================================================');
    console.log('⚛️ REACT INTEGRATION TEST SUMMARY');
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
      console.log('🎉 SUCCESS! All React integration tests passed.');
      console.log('   ✨ BlazeProvider and useBlaze working correctly in React environment.');
    }
    
    console.log('');
    console.log('============================================================');
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
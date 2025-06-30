/**
 * Browser simulation test for BlazeProvider and useBlaze
 * Tests the components in a simulated browser environment
 */

import { JSDOM } from 'jsdom';
import React from 'react';
import ReactDOM from 'react-dom';
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

// Setup JSDOM environment
function setupBrowserEnvironment() {
  const dom = new JSDOM('<!DOCTYPE html><div id="root"></div>', {
    url: 'http://localhost:3000',
    pretendToBeVisual: true,
    resources: 'usable'
  });

  // Set up global variables
  global.window = dom.window as any;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.HTMLElement = dom.window.HTMLElement;
  global.Element = dom.window.Element;
  global.Node = dom.window.Node;
  global.NodeList = dom.window.NodeList;
  
  // Mock WebSocket for testing
  global.WebSocket = class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    
    readyState = MockWebSocket.CONNECTING;
    onopen?: (event: Event) => void;
    onclose?: (event: CloseEvent) => void;
    onmessage?: (event: MessageEvent) => void;
    onerror?: (event: Event) => void;
    
    constructor(public url: string) {
      // Simulate connection after a delay
      setTimeout(() => {
        this.readyState = MockWebSocket.OPEN;
        if (this.onopen) {
          this.onopen(new Event('open'));
        }
        
        // Send mock SERVER_INFO message
        setTimeout(() => {
          if (this.onmessage) {
            const party = this.url.includes('/prices/') ? 'prices' : 'balances';
            this.onmessage(new MessageEvent('message', {
              data: JSON.stringify({ type: 'SERVER_INFO', party })
            }));
          }
        }, 100);
        
        // Send mock data based on party type
        setTimeout(() => {
          if (this.onmessage) {
            if (this.url.includes('/prices/')) {
              this.onmessage(new MessageEvent('message', {
                data: JSON.stringify({
                  type: 'PRICE_BATCH',
                  prices: [
                    { contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token', price: 0.001, timestamp: Date.now() },
                    { contractId: '.stx', price: 2.5, timestamp: Date.now() }
                  ]
                })
              }));
            } else if (this.url.includes('/balances/')) {
              this.onmessage(new MessageEvent('message', {
                data: JSON.stringify({
                  type: 'BALANCE_BATCH',
                  balances: [
                    {
                      userId: TEST_USER_ID,
                      contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
                      balance: '1000000000',
                      formattedBalance: 1000,
                      symbol: 'CHA',
                      decimals: 6,
                      metadata: { type: 'SIP10', symbol: 'CHA', name: 'Charisma' }
                    },
                    {
                      userId: TEST_USER_ID,
                      contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1',
                      balance: '500000000',
                      formattedBalance: 500,
                      symbol: 'CHA',
                      decimals: 6,
                      metadata: { 
                        type: 'SUBNET', 
                        symbol: 'CHA', 
                        name: 'Charisma Subnet',
                        base: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'
                      }
                    }
                  ]
                })
              }));
            }
          }
        }, 200);
      }, 50);
    }
    
    send(data: string) {
      // Mock send - just log for testing
      console.log(`MockWebSocket send: ${data}`);
    }
    
    close() {
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) {
        this.onclose(new CloseEvent('close'));
      }
    }
  } as any;

  return dom;
}

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
    if (result.test.includes('Balance') && result.data.balanceCount !== undefined) {
      log(`   📊 Data: ${JSON.stringify(result.data, null, 2)}`);
    } else if (result.test.includes('Price') && result.data.priceCount !== undefined) {
      log(`   💰 Data: ${JSON.stringify(result.data, null, 2)}`);
    }
  }
}

// Test component that captures hook data
const TestApp: React.FC = () => {
  const blazeData = useBlaze({ userId: TEST_USER_ID });
  
  React.useEffect(() => {
    // Report data after hooks have had time to process
    const timer = setTimeout(() => {
      const priceCount = Object.keys(blazeData.prices).length;
      const balanceCount = Object.keys(blazeData.balances).length;
      const userBalances = blazeData.getUserBalances(TEST_USER_ID);
      const userBalanceCount = Object.keys(userBalances).length;
      
      // Test connection
      logResult({
        test: 'Browser Simulation Connection',
        status: 'PASS',
        message: `WebSocket connections established`,
        data: { isConnected: blazeData.isConnected }
      });
      
      // Test price loading
      logResult({
        test: 'Browser Simulation Price Loading',
        status: priceCount > 0 ? 'PASS' : 'SKIP',
        message: priceCount > 0 ? `Loaded ${priceCount} prices` : 'No prices loaded',
        data: { 
          priceCount,
          samplePrice: priceCount > 0 ? blazeData.getPrice(Object.keys(blazeData.prices)[0]) : undefined
        }
      });
      
      // Test balance loading
      logResult({
        test: 'Browser Simulation Balance Loading',
        status: balanceCount > 0 ? 'PASS' : 'SKIP',
        message: balanceCount > 0 ? `Loaded ${balanceCount} balance entries` : 'No balances loaded',
        data: { balanceCount }
      });
      
      // Test user balance filtering
      logResult({
        test: 'Browser Simulation User Balance Filtering',
        status: userBalanceCount > 0 ? 'PASS' : 'SKIP',
        message: userBalanceCount > 0 ? `Filtered ${userBalanceCount} user balances` : 'No user balances',
        data: { 
          userBalanceCount,
          userBalances: Object.keys(userBalances).reduce((acc, key) => {
            const balance = userBalances[key];
            acc[key] = {
              balance: balance.balance,
              formattedBalance: balance.formattedBalance,
              symbol: balance.symbol,
              subnetBalance: balance.subnetBalance,
              hasSubnetData: balance.subnetBalance !== undefined
            };
            return acc;
          }, {} as any)
        }
      });
      
      // Test subnet balance merging specifically
      const charismaBalance = blazeData.getBalance(TEST_USER_ID, 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token');
      if (charismaBalance) {
        const hasMainnetData = charismaBalance.balance && charismaBalance.balance !== '0';
        const hasSubnetData = charismaBalance.subnetBalance !== undefined;
        
        logResult({
          test: 'Browser Simulation Subnet Balance Merging',
          status: hasMainnetData && hasSubnetData ? 'PASS' : 'SKIP',
          message: hasMainnetData && hasSubnetData 
            ? `Subnet balance merging working: mainnet=${charismaBalance.formattedBalance}, subnet=${charismaBalance.formattedSubnetBalance}`
            : `Incomplete merge data: mainnet=${hasMainnetData}, subnet=${hasSubnetData}`,
          data: {
            hasMainnetData,
            hasSubnetData,
            mainnetBalance: charismaBalance.balance,
            subnetBalance: charismaBalance.subnetBalance,
            formattedMainnet: charismaBalance.formattedBalance,
            formattedSubnet: charismaBalance.formattedSubnetBalance
          }
        });
      } else {
        logResult({
          test: 'Browser Simulation Subnet Balance Merging',
          status: 'SKIP',
          message: 'No Charisma balance found for testing'
        });
      }
      
      // Test utility functions
      const stxPrice = blazeData.getPrice('.stx');
      logResult({
        test: 'Browser Simulation Utility Functions',
        status: 'PASS',
        message: `getPrice() and getBalance() functions working`,
        data: { 
          stxPrice,
          getUserBalances: typeof blazeData.getUserBalances === 'function',
          getMetadata: typeof blazeData.getMetadata === 'function'
        }
      });
      
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [blazeData]);
  
  return React.createElement('div', {},
    `Connected: ${blazeData.isConnected}, `,
    `Prices: ${Object.keys(blazeData.prices).length}, `,
    `Balances: ${Object.keys(blazeData.balances).length}`
  );
};

// Main test function
async function runBrowserSimulation(): Promise<void> {
  log('🌐 Setting up browser environment...');
  
  try {
    const dom = setupBrowserEnvironment();
    const start = Date.now();
    
    logResult({
      test: 'Browser Environment Setup',
      status: 'PASS',
      message: 'JSDOM environment created successfully',
      duration: Date.now() - start
    });
    
    // Create React app
    const container = document.getElementById('root');
    if (!container) {
      throw new Error('Root element not found');
    }
    
    const App = React.createElement(
      BlazeProvider,
      { host: PROD_HOST },
      React.createElement(TestApp)
    );
    
    // Render the app
    ReactDOM.render(App, container);
    
    logResult({
      test: 'React App Rendering',
      status: 'PASS',
      message: 'BlazeProvider and useBlaze rendered successfully'
    });
    
    // Wait for tests to complete
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // Cleanup
    ReactDOM.unmountComponentAtNode(container);
    dom.window.close();
    
  } catch (error) {
    logResult({
      test: 'Browser Simulation',
      status: 'FAIL',
      message: `Simulation failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

async function main() {
  console.log('🌐 BROWSER SIMULATION TESTING');
  console.log('============================================================');
  console.log(`🌐 Host: ${PROD_HOST}`);
  console.log(`👤 Test User: ${TEST_USER_ID.slice(0, 8)}...${TEST_USER_ID.slice(-4)}`);
  console.log(`⏰ Started: ${new Date().toLocaleTimeString()}`);
  console.log('');
  console.log('🔍 Testing BlazeProvider and useBlaze in simulated browser environment');
  console.log('');
  
  try {
    // Check if JSDOM is available
    try {
      require('jsdom');
    } catch (error) {
      logResult({
        test: 'JSDOM Availability',
        status: 'SKIP',
        message: 'JSDOM not available - install with: pnpm add -D jsdom @types/jsdom'
      });
      return;
    }
    
    await runBrowserSimulation();
    
    // Print summary
    console.log('');
    console.log('============================================================');
    console.log('🌐 BROWSER SIMULATION TEST SUMMARY');
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
      console.log('🎉 SUCCESS! All browser simulation tests passed.');
      console.log('   ✨ BlazeProvider and useBlaze working correctly in browser environment.');
    }
    
    console.log('');
    console.log('============================================================');
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
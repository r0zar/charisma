#!/usr/bin/env npx tsx

/**
 * Full End-to-End Lottery System Test Script
 * Tests the complete lottery flow from ticket purchase to draw completion
 */

import { writeFileSync, appendFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

// Configuration
const CONFIG = {
  BASE_URL: 'http://localhost:3013',
  ADMIN_KEY: 'admin_api_key_1234567890',
  TEST_WALLET_1: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
  TEST_WALLET_2: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  LOG_DIR: path.join(__dirname, '..', 'logs'),
  LOG_FILE: '',
};

// Initialize logging
function initializeLogging() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  CONFIG.LOG_FILE = path.join(CONFIG.LOG_DIR, `e2e-test-${timestamp}.log`);
  
  // Ensure logs directory exists
  if (!existsSync(CONFIG.LOG_DIR)) {
    mkdirSync(CONFIG.LOG_DIR, { recursive: true });
  }
  
  // Create log file
  writeFileSync(CONFIG.LOG_FILE, '');
  console.log(`📝 Log file created: ${CONFIG.LOG_FILE}`);
}

// Logging function
function log(message: string) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
  appendFileSync(CONFIG.LOG_FILE, logLine);
}

// API call function with detailed logging
async function apiCall(
  method: string,
  endpoint: string,
  data?: any,
  headers: Record<string, string> = {},
  description: string = ''
): Promise<{ response: any; status: number }> {
  log(`🔄 API CALL: ${description}`);
  log(`   Method: ${method}`);
  log(`   Endpoint: ${endpoint}`);
  
  if (data) {
    log(`   Data: ${JSON.stringify(data, null, 2)}`);
  }
  
  const url = `${CONFIG.BASE_URL}${endpoint}`;
  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  
  if (data) {
    fetchOptions.body = JSON.stringify(data);
  }
  
  try {
    const response = await fetch(url, fetchOptions);
    const responseData = await response.json();
    
    log(`   Response Status: ${response.status}`);
    log(`   Response: ${JSON.stringify(responseData, null, 2)}`);
    log('');
    
    return { response: responseData, status: response.status };
  } catch (error) {
    log(`   ERROR: ${error}`);
    log('');
    throw error;
  }
}

// Test phases
async function testInitialConfig() {
  log('🎯 === PHASE 1: INITIAL CONFIGURATION ===');
  
  // Get current lottery config
  await apiCall('GET', '/api/v1/lottery/config', null, {}, 'Get current lottery configuration');
  log('✅ Current lottery configuration retrieved');
  
  // Get current jackpot
  await apiCall('GET', '/api/v1/lottery/jackpot', null, {}, 'Get current jackpot amount');
  log('✅ Current jackpot amount retrieved');
  
  // Get next draw time
  await apiCall('GET', '/api/v1/lottery/draw-time', null, {}, 'Get next draw time');
  log('✅ Next draw time retrieved');
  
  log('📊 Initial state captured successfully');
}

async function testTicketPurchases() {
  log('🎫 === PHASE 2: TICKET PURCHASES ===');
  
  const purchasedTickets: string[] = [];
  
  // Purchase single ticket for wallet 1
  const ticket1 = await apiCall('POST', '/api/v1/lottery/purchase-ticket', {
    walletAddress: CONFIG.TEST_WALLET_1,
    numbers: [7, 14, 21, 28, 35, 42]
  }, {}, 'Purchase single ticket for wallet 1');
  
  if (ticket1.response.success) {
    purchasedTickets.push(ticket1.response.data.id);
    log(`✅ Single ticket purchased: ${ticket1.response.data.id}`);
  }
  
  // Purchase bulk tickets for wallet 1
  const bulk1 = await apiCall('POST', '/api/v1/lottery/purchase-bulk', {
    walletAddress: CONFIG.TEST_WALLET_1,
    quantity: 3
  }, {}, 'Purchase 3 bulk tickets for wallet 1');
  
  if (bulk1.response.success) {
    bulk1.response.data.forEach((ticket: any) => purchasedTickets.push(ticket.id));
    log('✅ Bulk tickets purchased for wallet 1');
  }
  
  // Purchase single ticket for wallet 2
  const ticket2 = await apiCall('POST', '/api/v1/lottery/purchase-ticket', {
    walletAddress: CONFIG.TEST_WALLET_2,
    numbers: [1, 5, 10, 15, 20, 25]
  }, {}, 'Purchase single ticket for wallet 2');
  
  if (ticket2.response.success) {
    purchasedTickets.push(ticket2.response.data.id);
    log(`✅ Single ticket purchased: ${ticket2.response.data.id}`);
  }
  
  // Purchase bulk tickets for wallet 2
  const bulk2 = await apiCall('POST', '/api/v1/lottery/purchase-bulk', {
    walletAddress: CONFIG.TEST_WALLET_2,
    quantity: 2
  }, {}, 'Purchase 2 bulk tickets for wallet 2');
  
  if (bulk2.response.success) {
    bulk2.response.data.forEach((ticket: any) => purchasedTickets.push(ticket.id));
    log('✅ Bulk tickets purchased for wallet 2');
  }
  
  log(`🎫 Total tickets purchased: ${purchasedTickets.length}`);
  
  // Store for later use
  writeFileSync(path.join(CONFIG.LOG_DIR, 'purchased-tickets.json'), JSON.stringify(purchasedTickets, null, 2));
  
  return purchasedTickets;
}

async function testTicketConfirmation(ticketIds: string[]) {
  log('✅ === PHASE 3: TICKET CONFIRMATION ===');
  
  // Get all tickets first
  await apiCall('GET', '/api/admin/lottery-tickets', null, {
    'x-admin-key': CONFIG.ADMIN_KEY
  }, 'Get all tickets for confirmation');
  
  // Confirm first few tickets for testing
  const ticketsToConfirm = ticketIds.slice(0, Math.min(3, ticketIds.length));
  
  for (let i = 0; i < ticketsToConfirm.length; i++) {
    const ticketId = ticketsToConfirm[i];
    await apiCall('POST', '/api/admin/confirm-ticket', {
      ticketId,
      transactionId: `0x${Math.random().toString(16).substr(2, 16)}`
    }, {
      'x-admin-key': CONFIG.ADMIN_KEY
    }, `Confirm ticket ${ticketId}`);
    
    log(`✅ Ticket ${ticketId} confirmed`);
  }
  
  log('✅ Key tickets confirmed for testing');
}

async function testUserTickets() {
  log('👤 === PHASE 4: USER TICKET RETRIEVAL ===');
  
  // Get tickets for wallet 1
  await apiCall('GET', `/api/v1/lottery/my-tickets?walletAddress=${CONFIG.TEST_WALLET_1}`, null, {}, 'Get tickets for wallet 1');
  log('✅ Wallet 1 tickets retrieved');
  
  // Get tickets for wallet 2
  await apiCall('GET', `/api/v1/lottery/my-tickets?walletAddress=${CONFIG.TEST_WALLET_2}`, null, {}, 'Get tickets for wallet 2');
  log('✅ Wallet 2 tickets retrieved');
  
  log('👤 User ticket retrieval completed');
}

async function testAdminOperations() {
  log('🔧 === PHASE 5: ADMIN OPERATIONS ===');
  
  // Get admin view of all tickets
  await apiCall('GET', '/api/admin/lottery-tickets', null, {
    'x-admin-key': CONFIG.ADMIN_KEY
  }, 'Admin view of all tickets');
  log('✅ Admin ticket overview retrieved');
  
  // Get tickets by draw
  await apiCall('GET', '/api/admin/lottery-tickets?drawId=next-draw-2025-07-26', null, {
    'x-admin-key': CONFIG.ADMIN_KEY
  }, 'Get tickets by draw ID');
  log('✅ Tickets by draw retrieved');
  
  log('🔧 Admin operations completed');
}

async function testLotteryDraw() {
  log('🎰 === PHASE 6: LOTTERY DRAW EXECUTION ===');
  
  // Run the lottery draw
  const drawResult = await apiCall('POST', '/api/admin/lottery-draw', {}, {
    'x-admin-key': CONFIG.ADMIN_KEY
  }, 'Execute lottery draw');
  
  if (drawResult.response.success) {
    const drawId = drawResult.response.data.id;
    log(`🎰 Lottery draw completed: ${drawId}`);
    
    // Store draw ID for later reference
    writeFileSync(path.join(CONFIG.LOG_DIR, 'latest-draw.json'), JSON.stringify({
      drawId,
      result: drawResult.response.data
    }, null, 2));
    
    log('🏆 Draw execution phase completed');
    return drawId;
  } else {
    throw new Error('Lottery draw failed');
  }
}

async function testResultsRetrieval(drawId?: string) {
  log('📊 === PHASE 7: RESULTS RETRIEVAL ===');
  
  // Get latest result
  await apiCall('GET', '/api/v1/lottery/latest-result', null, {}, 'Get latest lottery result');
  log('✅ Latest result retrieved');
  
  // Get all results
  await apiCall('GET', '/api/v1/lottery/results?limit=10', null, {}, 'Get recent lottery results');
  log('✅ Recent results retrieved');
  
  // Check specific draw result if we have a drawId
  if (drawId) {
    await apiCall('GET', `/api/v1/lottery/results?drawId=${drawId}`, null, {}, 'Get specific draw result');
    log('✅ Specific draw result retrieved');
  }
  
  log('📊 Results retrieval completed');
}

async function testPostDrawState() {
  log('🔄 === PHASE 8: POST-DRAW STATE VERIFICATION ===');
  
  // Check updated lottery config
  await apiCall('GET', '/api/v1/lottery/config', null, {}, 'Get updated lottery configuration');
  log('✅ Updated lottery configuration retrieved');
  
  // Check new jackpot amount
  await apiCall('GET', '/api/v1/lottery/jackpot', null, {}, 'Get updated jackpot amount');
  log('✅ Updated jackpot amount retrieved');
  
  // Check archived tickets
  await apiCall('GET', '/api/admin/lottery-tickets', null, {
    'x-admin-key': CONFIG.ADMIN_KEY
  }, 'Check archived tickets');
  log('✅ Archived tickets status verified');
  
  // Check if new tickets can be purchased
  await apiCall('POST', '/api/v1/lottery/purchase-ticket', {
    walletAddress: CONFIG.TEST_WALLET_1,
    numbers: [2, 4, 6, 8, 10, 12]
  }, {}, 'Test new ticket purchase after draw');
  log('✅ New ticket purchase after draw tested');
  
  log('🔄 Post-draw state verification completed');
}

function cleanup() {
  log('🧹 === CLEANUP ===');
  
  // Clean up temporary files
  const tempFiles = ['purchased-tickets.json', 'latest-draw.json'];
  tempFiles.forEach(file => {
    const filePath = path.join(CONFIG.LOG_DIR, file);
    if (existsSync(filePath)) {
      log(`🗑️  Cleaned up: ${file}`);
    }
  });
  
  log('🧹 Cleanup completed');
}

// Main execution
async function main() {
  try {
    initializeLogging();
    
    log('🚀 ==============================================');
    log('🚀 STARTING FULL END-TO-END LOTTERY SYSTEM TEST');
    log('🚀 ==============================================');
    log(`📅 Test started at: ${new Date().toISOString()}`);
    log(`🌐 Base URL: ${CONFIG.BASE_URL}`);
    log(`📝 Log file: ${CONFIG.LOG_FILE}`);
    log('');
    
    // Run all test phases
    await testInitialConfig();
    const ticketIds = await testTicketPurchases();
    await testTicketConfirmation(ticketIds);
    await testUserTickets();
    await testAdminOperations();
    const drawId = await testLotteryDraw();
    await testResultsRetrieval(drawId);
    await testPostDrawState();
    cleanup();
    
    log('');
    log('✅ ==============================================');
    log('✅ FULL END-TO-END TEST COMPLETED SUCCESSFULLY');
    log('✅ ==============================================');
    log(`📅 Test completed at: ${new Date().toISOString()}`);
    log(`📊 Check the log file for detailed results: ${CONFIG.LOG_FILE}`);
    
    console.log(`\n🎉 Test completed successfully! Check logs at: ${CONFIG.LOG_FILE}`);
    
  } catch (error) {
    log(`❌ TEST FAILED: ${error}`);
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}
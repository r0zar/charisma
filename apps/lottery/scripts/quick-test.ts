#!/usr/bin/env npx tsx

/**
 * Quick Lottery System Test - Minimal flow for development testing
 */

import { writeFileSync, appendFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

const CONFIG = {
  BASE_URL: 'http://localhost:3013',
  ADMIN_KEY: 'admin_api_key_1234567890',
  WALLET: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
  LOG_DIR: path.join(__dirname, '..', 'logs'),
  LOG_FILE: '',
};

function initializeLogging() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  CONFIG.LOG_FILE = path.join(CONFIG.LOG_DIR, `quick-test-${timestamp}.log`);
  
  if (!existsSync(CONFIG.LOG_DIR)) {
    mkdirSync(CONFIG.LOG_DIR, { recursive: true });
  }
  
  writeFileSync(CONFIG.LOG_FILE, '');
  console.log(`📝 Log file: ${CONFIG.LOG_FILE}`);
}

function log(message: string) {
  const timestamp = new Date().toLocaleTimeString();
  const logLine = `[${new Date().toISOString()}] ${message}\n`;
  
  console.log(`[${timestamp}] ${message}`);
  appendFileSync(CONFIG.LOG_FILE, logLine);
}

async function apiCall(method: string, endpoint: string, data?: any, headers: Record<string, string> = {}) {
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
  
  const response = await fetch(url, fetchOptions);
  const responseData = await response.json();
  
  // Log to file
  appendFileSync(CONFIG.LOG_FILE, `\n=== ${method} ${endpoint} ===\n`);
  appendFileSync(CONFIG.LOG_FILE, `Request: ${JSON.stringify(data, null, 2)}\n`);
  appendFileSync(CONFIG.LOG_FILE, `Response: ${JSON.stringify(responseData, null, 2)}\n`);
  
  return { response: responseData, status: response.status };
}

async function main() {
  try {
    initializeLogging();
    log('🚀 Starting quick lottery test...');
    
    // 1. Check system status
    log('📊 Getting current system status...');
    await apiCall('GET', '/api/v1/lottery/jackpot');
    
    // 2. Purchase a ticket
    log('🎫 Purchasing test ticket...');
    const ticketResult = await apiCall('POST', '/api/v1/lottery/purchase-ticket', {
      walletAddress: CONFIG.WALLET,
      numbers: [1, 2, 3, 4, 5, 6]
    });
    
    if (!ticketResult.response.success) {
      throw new Error('Failed to purchase ticket');
    }
    
    const ticketId = ticketResult.response.data.id;
    log(`✅ Ticket purchased: ${ticketId}`);
    
    // 3. Test the new ticket confirmation endpoint
    log('✅ Testing ticket confirmation API...');
    const confirmResult = await apiCall('POST', '/api/v1/lottery/confirm-ticket', {
      ticketId,
      transactionId: '0xtest123',
      walletAddress: CONFIG.WALLET,
      expectedAmount: 5
    });
    
    if (!confirmResult.response.success) {
      log('⚠️ New confirmation API failed (expected for test transaction), using admin endpoint...');
      log(`Error: ${confirmResult.response.error}`);
      // Fallback to admin endpoint for testing
      await apiCall('POST', '/api/admin/confirm-ticket', {
        ticketId,
        transactionId: '0xtest123'
      }, {
        'x-admin-key': CONFIG.ADMIN_KEY
      });
    } else {
      log('✅ New confirmation API succeeded!');
    }
    
    // 4. Run lottery draw
    log('🎰 Running lottery draw...');
    const drawResult = await apiCall('POST', '/api/admin/lottery-draw', {}, {
      'x-admin-key': CONFIG.ADMIN_KEY
    });
    
    if (drawResult.response.success) {
      log('🏆 Draw completed successfully!');
      
      // 5. Get results
      log('📊 Getting latest results...');
      await apiCall('GET', '/api/v1/lottery/latest-result');
      
      log('✅ Quick test completed successfully!');
    } else {
      log(`❌ Draw failed: ${JSON.stringify(drawResult.response)}`);
    }
    
    log(`📝 Full log: ${CONFIG.LOG_FILE}`);
    console.log(`\n🎉 Quick test completed! Check logs at: ${CONFIG.LOG_FILE}`);
    
  } catch (error) {
    log(`❌ Test failed: ${error}`);
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
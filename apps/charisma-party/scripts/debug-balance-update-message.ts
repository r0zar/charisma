#!/usr/bin/env tsx

/**
 * Debug Script 3: Test createBalanceUpdateMessage function
 * 
 * This script tests the createBalanceUpdateMessage function to see
 * how enriched token records are being converted to balance messages.
 */

import { loadTokenMetadata, createBalanceUpdateMessage } from '../src/balances-lib.js';

console.log('🔍 DEBUG: Testing createBalanceUpdateMessage function...');
console.log('========================================================');

async function testCreateBalanceUpdateMessage() {
  try {
    // First load token metadata
    console.log('🏷️ Loading token metadata...');
    const tokenRecords = await loadTokenMetadata();
    
    if (tokenRecords.size === 0) {
      console.log('❌ No token records loaded, cannot test createBalanceUpdateMessage');
      return;
    }
    
    console.log(`✅ Loaded ${tokenRecords.size} token records`);
    
    // Find a token with price data
    const tokenWithPrice = Array.from(tokenRecords.values()).find(record => 
      record.price !== null && record.price !== undefined && typeof record.price === 'number'
    );
    
    // Find a token without price data  
    const tokenWithoutPrice = Array.from(tokenRecords.values()).find(record => 
      record.price === null || record.price === undefined || typeof record.price !== 'number'
    );
    
    // Test user ID
    const testUserId = 'SP1KMAA7TPZ5AZZ9Q9QKQP0Z1NXX87VZ2FDX8S8Q9';
    
    // Mock balance info
    const mockBalanceInfo = {
      balance: 1000000000, // 1000 tokens (assuming 6 decimals)
      totalSent: '500000000',
      totalReceived: '1500000000', 
      formattedBalance: 1000,
      timestamp: Date.now(),
      source: 'hiro-api'
    };
    
    console.log(`\n🧪 Test Cases:`);
    console.log(`- Test User ID: ${testUserId}`);
    console.log(`- Mock Balance Info:`, JSON.stringify(mockBalanceInfo, null, 2));
    
    // Test Case 1: Token WITH price data
    if (tokenWithPrice) {
      console.log(`\n🔢 TEST CASE 1: Token WITH price data`);
      console.log(`=====================================`);
      console.log(`Testing token: ${tokenWithPrice.symbol} (${tokenWithPrice.name})`);
      console.log(`Contract ID: ${tokenWithPrice.contractId}`);
      console.log(`Price: $${tokenWithPrice.price}`);
      console.log(`24h Change: ${tokenWithPrice.change24h}%`);
      
      try {
        const message = createBalanceUpdateMessage(tokenWithPrice, testUserId, mockBalanceInfo);
        
        console.log(`\n📤 Generated BalanceUpdateMessage:`);
        console.log(JSON.stringify(message, null, 2));
        
        // Analyze the message structure
        console.log(`\n🔍 Message Analysis:`);
        console.log(`- type: "${message.type}"`);
        console.log(`- userId: "${message.userId}"`);
        console.log(`- contractId: "${message.contractId}"`);
        console.log(`- balance: ${message.balance} (${typeof message.balance})`);
        console.log(`- formattedBalance: ${message.formattedBalance} (${typeof message.formattedBalance})`);
        
        console.log(`\n💰 Metadata Structure:`);
        console.log(`- metadata exists: ${!!message.metadata}`);
        if (message.metadata) {
          console.log(`- metadata.price: ${message.metadata.price} (${typeof message.metadata.price})`);
          console.log(`- metadata.change24h: ${message.metadata.change24h} (${typeof message.metadata.change24h})`);
          console.log(`- metadata.change7d: ${message.metadata.change7d} (${typeof message.metadata.change7d})`);
          console.log(`- metadata.marketCap: ${message.metadata.marketCap} (${typeof message.metadata.marketCap})`);
          console.log(`- metadata.verified: ${message.metadata.verified} (${typeof message.metadata.verified})`);
          console.log(`- metadata.type: "${message.metadata.type}"`);
        }
        
        console.log(`\n📜 Legacy Fields (deprecated):`);
        console.log(`- name: "${message.name}"`);
        console.log(`- symbol: "${message.symbol}"`);
        console.log(`- decimals: ${message.decimals}`);
        console.log(`- tokenType: "${message.tokenType}"`);
        
      } catch (error) {
        console.log(`❌ Error creating message for token with price:`, error);
        console.log(`❌ Error details:`, {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    } else {
      console.log(`\n⚠️  No tokens with price data found for test case 1`);
    }
    
    // Test Case 2: Token WITHOUT price data
    if (tokenWithoutPrice) {
      console.log(`\n❌ TEST CASE 2: Token WITHOUT price data`);
      console.log(`========================================`);
      console.log(`Testing token: ${tokenWithoutPrice.symbol} (${tokenWithoutPrice.name})`);
      console.log(`Contract ID: ${tokenWithoutPrice.contractId}`);
      console.log(`Price: ${tokenWithoutPrice.price} (${typeof tokenWithoutPrice.price})`);
      console.log(`Source: ${tokenWithoutPrice.metadataSource}`);
      
      try {
        const message = createBalanceUpdateMessage(tokenWithoutPrice, testUserId, mockBalanceInfo);
        
        console.log(`\n📤 Generated BalanceUpdateMessage:`);
        console.log(JSON.stringify(message, null, 2));
        
        console.log(`\n💰 Price Data in Message:`);
        if (message.metadata) {
          console.log(`- metadata.price: ${message.metadata.price} (${typeof message.metadata.price})`);
          console.log(`- metadata.change24h: ${message.metadata.change24h} (${typeof message.metadata.change24h})`);
          console.log(`- metadata.marketCap: ${message.metadata.marketCap} (${typeof message.metadata.marketCap})`);
        }
        
      } catch (error) {
        console.log(`❌ Error creating message for token without price:`, error);
        console.log(`❌ Error details:`, {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    } else {
      console.log(`\n⚠️  No tokens without price data found for test case 2`);
    }
    
    // Test Case 3: Subnet token (if available)
    const subnetToken = Array.from(tokenRecords.values()).find(record => 
      record.type === 'SUBNET'
    );
    
    if (subnetToken) {
      console.log(`\n🏗️  TEST CASE 3: Subnet token`);
      console.log(`==============================`);
      console.log(`Testing subnet token: ${subnetToken.symbol} (${subnetToken.name})`);
      console.log(`Contract ID: ${subnetToken.contractId}`);
      console.log(`Base Token: ${subnetToken.base}`);
      
      const subnetBalanceInfo = {
        contractId: subnetToken.contractId,
        balance: 500000000,
        totalSent: '0',
        totalReceived: '500000000',
        formattedBalance: 500,
        timestamp: Date.now(),
        source: 'subnet-contract-call'
      };
      
      try {
        // For subnet tokens, we need the base token record
        const baseTokenRecord = Array.from(tokenRecords.values()).find(record => 
          record.contractId === subnetToken.base
        );
        
        if (baseTokenRecord) {
          const message = createBalanceUpdateMessage(baseTokenRecord, testUserId, mockBalanceInfo, subnetBalanceInfo);
          
          console.log(`\n📤 Generated BalanceUpdateMessage with subnet data:`);
          console.log(JSON.stringify(message, null, 2));
          
          console.log(`\n🏗️  Subnet Fields:`);
          console.log(`- subnetBalance: ${message.subnetBalance}`);
          console.log(`- formattedSubnetBalance: ${message.formattedSubnetBalance}`);
          console.log(`- subnetContractId: "${message.subnetContractId}"`);
          
        } else {
          console.log(`❌ Base token record not found for subnet token`);
        }
        
      } catch (error) {
        console.log(`❌ Error creating message for subnet token:`, error);
      }
    } else {
      console.log(`\n⚠️  No subnet tokens found for test case 3`);
    }
    
    console.log(`\n✅ createBalanceUpdateMessage test completed!`);
    
  } catch (error) {
    console.log(`❌ Error in createBalanceUpdateMessage test:`, error);
    console.log(`❌ Error details:`, {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

testCreateBalanceUpdateMessage().catch(console.error);
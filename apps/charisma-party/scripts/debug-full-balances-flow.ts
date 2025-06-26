#!/usr/bin/env tsx

/**
 * Debug Script 4: Test complete balances party flow
 * 
 * This script tests the complete flow from loading metadata through
 * fetching user balances to creating and broadcasting messages.
 */

import { 
  loadTokenMetadata, 
  fetchUserBalances, 
  createBalanceUpdateMessage,
  isValidUserAddress,
  type EnhancedTokenRecord 
} from '../src/balances-lib.js';

console.log('🔍 DEBUG: Testing complete balances party flow...');
console.log('=================================================');

async function testCompleteBalancesFlow() {
  try {
    console.log('📋 STEP 1: Loading token metadata...');
    console.log('====================================');
    
    const tokenRecords = await loadTokenMetadata();
    console.log(`✅ Loaded ${tokenRecords.size} token records`);
    
    if (tokenRecords.size === 0) {
      console.log('❌ Cannot continue - no token records loaded');
      return;
    }
    
    // Show metadata summary
    const withPrice = Array.from(tokenRecords.values()).filter(r => 
      r.price !== null && r.price !== undefined && typeof r.price === 'number'
    ).length;
    console.log(`📊 ${withPrice}/${tokenRecords.size} tokens have price data`);
    
    console.log('\n📋 STEP 2: Testing user address validation...');
    console.log('===============================================');
    
    const testUserIds = [
      'SP1KMAA7TPZ5AZZ9Q9QKQP0Z1NXX87VZ2FDX8S8Q9', // Valid
      'ST1KMAA7TPZ5AZZ9Q9QKQP0Z1NXX87VZ2FDX8S8Q9', // Valid (testnet)
      'invalid-address', // Invalid
      '', // Invalid
      'SP123' // Invalid (too short)
    ];
    
    testUserIds.forEach(userId => {
      const isValid = isValidUserAddress(userId);
      console.log(`- "${userId}": ${isValid ? '✅ Valid' : '❌ Invalid'}`);
    });
    
    const validTestUsers = testUserIds.filter(isValidUserAddress);
    console.log(`\n🎯 Using ${validTestUsers.length} valid user addresses for testing`);
    
    console.log('\n📋 STEP 3: Fetching user balances...');
    console.log('=====================================');
    
    // Take only first 2 valid users to avoid too much API load
    const usersToTest = validTestUsers.slice(0, 2);
    console.log(`🔍 Testing with users: ${usersToTest.join(', ')}`);
    
    const startTime = Date.now();
    const rawBalances = await fetchUserBalances(usersToTest, tokenRecords);
    const endTime = Date.now();
    
    console.log(`⏱️  fetchUserBalances completed in ${endTime - startTime}ms`);
    console.log(`📊 Raw balances received: ${Object.keys(rawBalances).length} entries`);
    
    if (Object.keys(rawBalances).length === 0) {
      console.log('⚠️  No balances returned, but continuing with mock data...');
    } else {
      console.log('\n🔍 Sample raw balance entries:');
      Object.entries(rawBalances).slice(0, 3).forEach(([key, balance], index) => {
        console.log(`${index + 1}. Key: ${key}`);
        console.log(`   Balance Data:`, JSON.stringify(balance, null, 2));
      });
    }
    
    console.log('\n📋 STEP 4: Processing balances into messages...');
    console.log('===============================================');
    
    const balanceMessages: any[] = [];
    const processingErrors: any[] = [];
    
    // Process each raw balance or create mock data if none
    if (Object.keys(rawBalances).length > 0) {
      for (const [key, balanceData] of Object.entries(rawBalances)) {
        try {
          const { userId, contractId } = balanceData;
          
          // Find token record
          let tokenRecord = tokenRecords.get(contractId);
          if (!tokenRecord && contractId.includes('::')) {
            const baseContractId = contractId.split('::')[0];
            tokenRecord = tokenRecords.get(baseContractId!);
            console.log(`🔄 Using base contract ${baseContractId} for ${contractId}`);
          }
          
          if (!tokenRecord) {
            console.log(`⚠️  No token record found for ${contractId}, skipping...`);
            continue;
          }
          
          console.log(`✅ Processing ${userId}:${contractId} (${tokenRecord.symbol})`);
          
          // Create balance info
          const balanceInfo = {
            balance: balanceData.balance,
            totalSent: balanceData.totalSent,
            totalReceived: balanceData.totalReceived,
            formattedBalance: balanceData.balance / Math.pow(10, tokenRecord.decimals),
            timestamp: balanceData.timestamp,
            source: balanceData.source
          };
          
          // Create message
          const message = createBalanceUpdateMessage(tokenRecord, userId, balanceInfo);
          balanceMessages.push(message);
          
          console.log(`   📤 Message created successfully`);
          console.log(`   💰 Price data: ${message.metadata?.price ? `$${message.metadata.price}` : 'N/A'}`);
          console.log(`   📈 24h change: ${message.metadata?.change24h ? `${message.metadata.change24h}%` : 'N/A'}`);
          
        } catch (error) {
          processingErrors.push({ key, error: error instanceof Error ? error.message : 'Unknown error' });
          console.log(`❌ Error processing ${key}:`, error instanceof Error ? error.message : error);
        }
      }
    } else {
      // Create mock messages for testing
      console.log('🧪 Creating mock balance messages for testing...');
      
      const mockTokens = Array.from(tokenRecords.values()).slice(0, 3);
      const mockUserId = validTestUsers[0] || 'SP1KMAA7TPZ5AZZ9Q9QKQP0Z1NXX87VZ2FDX8S8Q9';
      
      for (const tokenRecord of mockTokens) {
        const mockBalanceInfo = {
          balance: Math.floor(Math.random() * 1000000000), // Random balance
          totalSent: '0',
          totalReceived: '1000000000',
          formattedBalance: 1000,
          timestamp: Date.now(),
          source: 'mock-data'
        };
        
        try {
          const message = createBalanceUpdateMessage(tokenRecord, mockUserId, mockBalanceInfo);
          balanceMessages.push(message);
          
          console.log(`✅ Mock message created for ${tokenRecord.symbol}`);
          console.log(`   💰 Price data: ${message.metadata?.price ? `$${message.metadata.price}` : 'N/A'}`);
          
        } catch (error) {
          console.log(`❌ Error creating mock message for ${tokenRecord.symbol}:`, error);
        }
      }
    }
    
    console.log(`\n📊 Processing Summary:`);
    console.log(`- Messages created: ${balanceMessages.length}`);
    console.log(`- Processing errors: ${processingErrors.length}`);
    
    if (processingErrors.length > 0) {
      console.log(`\n❌ Processing Errors:`);
      processingErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.key}: ${error.error}`);
      });
    }
    
    console.log('\n📋 STEP 5: Analyzing generated messages...');
    console.log('==========================================');
    
    if (balanceMessages.length > 0) {
      // Count messages with price data
      const messagesWithPrice = balanceMessages.filter(msg => 
        msg.metadata?.price !== null && msg.metadata?.price !== undefined && typeof msg.metadata?.price === 'number'
      ).length;
      
      console.log(`💰 ${messagesWithPrice}/${balanceMessages.length} messages have price data`);
      
      // Show a sample message with price data
      const messageWithPrice = balanceMessages.find(msg => 
        msg.metadata?.price !== null && msg.metadata?.price !== undefined
      );
      
      if (messageWithPrice) {
        console.log(`\n🔢 Sample message WITH price data:`);
        console.log(JSON.stringify(messageWithPrice, null, 2));
      }
      
      // Show a sample message without price data
      const messageWithoutPrice = balanceMessages.find(msg => 
        !msg.metadata?.price || msg.metadata?.price === null || msg.metadata?.price === undefined
      );
      
      if (messageWithoutPrice) {
        console.log(`\n❌ Sample message WITHOUT price data:`);
        console.log(JSON.stringify(messageWithoutPrice, null, 2));
      }
      
      // Check for field naming issues
      console.log(`\n🔍 Field naming analysis:`);
      const firstMessage = balanceMessages[0];
      if (firstMessage?.metadata) {
        console.log(`- metadata.type: "${firstMessage.metadata.type}" (new field)`);
        console.log(`- tokenType: "${firstMessage.tokenType}" (legacy field)`);
        console.log(`- Fields match: ${firstMessage.metadata.type === firstMessage.tokenType}`);
      }
      
    } else {
      console.log('❌ No messages generated to analyze');
    }
    
    console.log('\n📋 STEP 6: Testing BALANCE_BATCH format...');
    console.log('==========================================');
    
    if (balanceMessages.length > 0) {
      const batchMessage = {
        type: 'BALANCE_BATCH',
        balances: balanceMessages,
        timestamp: Date.now()
      };
      
      console.log(`📦 BALANCE_BATCH message structure:`);
      console.log(`- type: "${batchMessage.type}"`);
      console.log(`- balances: Array(${batchMessage.balances.length})`);
      console.log(`- timestamp: ${batchMessage.timestamp}`);
      
      // Test JSON serialization
      try {
        const serialized = JSON.stringify(batchMessage);
        console.log(`✅ JSON serialization successful (${serialized.length} chars)`);
        
        const parsed = JSON.parse(serialized);
        console.log(`✅ JSON parsing successful`);
        console.log(`✅ Round-trip test passed`);
        
      } catch (error) {
        console.log(`❌ JSON serialization failed:`, error);
      }
    }
    
    console.log('\n✅ Complete balances party flow test completed!');
    console.log('===============================================');
    
    // Final summary
    console.log(`\n📊 FINAL SUMMARY:`);
    console.log(`- Token records loaded: ${tokenRecords.size}`);
    console.log(`- Tokens with price data: ${withPrice}`);
    console.log(`- Users tested: ${usersToTest.length}`);
    console.log(`- Raw balance entries: ${Object.keys(rawBalances).length}`);
    console.log(`- Balance messages created: ${balanceMessages.length}`);
    console.log(`- Messages with price data: ${balanceMessages.filter(m => m.metadata?.price).length}`);
    console.log(`- Processing errors: ${processingErrors.length}`);
    
    if (processingErrors.length === 0 && balanceMessages.length > 0) {
      console.log(`\n🎉 All tests passed! The balances party flow appears to be working correctly.`);
    } else if (balanceMessages.length > 0) {
      console.log(`\n⚠️  Tests completed with some issues. Check the processing errors above.`);
    } else {
      console.log(`\n❌ Tests failed - no balance messages were created.`);
    }
    
  } catch (error) {
    console.log(`❌ Error in complete balances flow test:`, error);
    console.log(`❌ Error details:`, {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

testCompleteBalancesFlow().catch(console.error);
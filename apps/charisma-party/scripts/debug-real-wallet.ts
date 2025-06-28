#!/usr/bin/env tsx

/**
 * Debug Script 5: Test with real wallet address
 * 
 * This script tests the complete flow with a real wallet that has balances
 * to verify the enriched data is properly displayed.
 */

import { 
  loadTokenMetadata, 
  fetchUserBalances, 
  createBalanceUpdateMessage,
  isValidUserAddress,
  type EnhancedTokenRecord 
} from '../src/balances-lib.js';

console.log('🔍 DEBUG: Testing with real wallet address...');
console.log('============================================');

async function testRealWallet() {
  const realWalletAddress = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
  
  try {
    console.log(`🎯 Testing with wallet: ${realWalletAddress}`);
    console.log(`✅ Address validation: ${isValidUserAddress(realWalletAddress)}`);
    
    console.log('\n📋 STEP 1: Loading enriched token metadata...');
    console.log('==============================================');
    
    const tokenRecords = await loadTokenMetadata();
    const withPrice = Array.from(tokenRecords.values()).filter(r => 
      r.price !== null && r.price !== undefined && typeof r.price === 'number'
    ).length;
    
    console.log(`✅ Loaded ${tokenRecords.size} token records`);
    console.log(`📊 ${withPrice}/${tokenRecords.size} tokens have price data`);
    
    console.log('\n📋 STEP 2: Fetching real user balances...');
    console.log('=========================================');
    
    const startTime = Date.now();
    const rawBalances = await fetchUserBalances([realWalletAddress], tokenRecords);
    const endTime = Date.now();
    
    console.log(`⏱️  fetchUserBalances completed in ${endTime - startTime}ms`);
    console.log(`📊 Raw balances received: ${Object.keys(rawBalances).length} entries`);
    
    if (Object.keys(rawBalances).length === 0) {
      console.log('❌ No balances found for this wallet either');
      console.log('🔍 This might indicate an API issue or the wallet truly has no balances');
      return;
    }
    
    console.log('\n🔍 Raw balance entries (first 5):');
    Object.entries(rawBalances).slice(0, 5).forEach(([key, balance], index) => {
      console.log(`${index + 1}. Key: ${key}`);
      console.log(`   User: ${balance.userId}`);
      console.log(`   Contract: ${balance.contractId}`);
      console.log(`   Balance: ${balance.balance}`);
      console.log(`   Source: ${balance.source}`);
    });
    
    console.log('\n📋 STEP 3: Creating enriched balance messages...');
    console.log('===============================================');
    
    const enrichedMessages: any[] = [];
    const processingErrors: any[] = [];
    let messagesWithPrice = 0;
    
    for (const [key, balanceData] of Object.entries(rawBalances)) {
      try {
        const { userId, contractId } = balanceData;
        
        // Find token record with fallback logic
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
        
        // Create balance info
        const balanceInfo = {
          balance: balanceData.balance,
          totalSent: balanceData.totalSent,
          totalReceived: balanceData.totalReceived,
          formattedBalance: balanceData.balance / Math.pow(10, tokenRecord.decimals),
          timestamp: balanceData.timestamp,
          source: balanceData.source
        };
        
        // Create enriched message
        const message = createBalanceUpdateMessage(tokenRecord, userId, balanceInfo);
        enrichedMessages.push(message);
        
        // Check if this message has price data
        if (message.metadata?.price !== null && message.metadata?.price !== undefined) {
          messagesWithPrice++;
          
          console.log(`💰 ${tokenRecord.symbol}: Balance ${balanceInfo.formattedBalance}, Price $${message.metadata.price}`);
          if (message.metadata.change24h !== null && message.metadata.change24h !== undefined) {
            console.log(`   📈 24h Change: ${message.metadata.change24h}%`);
          }
          if (message.metadata.marketCap !== null && message.metadata.marketCap !== undefined) {
            console.log(`   🏪 Market Cap: $${message.metadata.marketCap}`);
          }
        } else {
          console.log(`❌ ${tokenRecord.symbol}: Balance ${balanceInfo.formattedBalance}, No price data`);
        }
        
      } catch (error) {
        processingErrors.push({ key, error: error instanceof Error ? error.message : 'Unknown error' });
        console.log(`❌ Error processing ${key}:`, error instanceof Error ? error.message : error);
      }
    }
    
    console.log(`\n📊 Processing Results:`);
    console.log(`- Total balance entries processed: ${Object.keys(rawBalances).length}`);
    console.log(`- Enriched messages created: ${enrichedMessages.length}`);
    console.log(`- Messages with price data: ${messagesWithPrice}`);
    console.log(`- Processing errors: ${processingErrors.length}`);
    
    if (processingErrors.length > 0) {
      console.log(`\n❌ Processing Errors:`);
      processingErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.key}: ${error.error}`);
      });
    }
    
    console.log('\n📋 STEP 4: Portfolio value calculation...');
    console.log('========================================');
    
    let totalPortfolioValue = 0;
    let totalChange24h = 0;
    let tokensInPortfolio = 0;
    
    enrichedMessages.forEach(message => {
      if (message.metadata?.price && message.formattedBalance > 0) {
        const tokenValue = message.formattedBalance * message.metadata.price;
        totalPortfolioValue += tokenValue;
        tokensInPortfolio++;
        
        if (message.metadata.change24h !== null && message.metadata.change24h !== undefined) {
          const change24hValue = tokenValue * (message.metadata.change24h / 100);
          totalChange24h += change24hValue;
        }
        
        console.log(`💎 ${message.metadata.symbol}: ${message.formattedBalance} tokens × $${message.metadata.price} = $${tokenValue.toFixed(2)}`);
      }
    });
    
    console.log(`\n💰 Portfolio Summary:`);
    console.log(`- Total Portfolio Value: $${totalPortfolioValue.toFixed(2)}`);
    console.log(`- 24h Change: $${totalChange24h.toFixed(2)}`);
    console.log(`- 24h Change %: ${totalPortfolioValue > 0 ? ((totalChange24h / (totalPortfolioValue - totalChange24h)) * 100).toFixed(2) : 0}%`);
    console.log(`- Tokens in portfolio: ${tokensInPortfolio}`);
    
    console.log('\n📋 STEP 5: Sample enriched message...');
    console.log('====================================');
    
    const messageWithPrice = enrichedMessages.find(msg => 
      msg.metadata?.price !== null && msg.metadata?.price !== undefined
    );
    
    if (messageWithPrice) {
      console.log(`🔢 Sample message with complete enriched data:`);
      console.log(JSON.stringify(messageWithPrice, null, 2));
    } else {
      console.log(`❌ No messages with price data found`);
    }
    
    console.log('\n📋 STEP 6: BALANCE_BATCH simulation...');
    console.log('=====================================');
    
    if (enrichedMessages.length > 0) {
      const batchMessage = {
        type: 'BALANCE_BATCH',
        balances: enrichedMessages,
        timestamp: Date.now()
      };
      
      console.log(`📦 BALANCE_BATCH would broadcast ${batchMessage.balances.length} enriched messages`);
      console.log(`📊 ${messagesWithPrice} of these messages contain price data`);
      
      // Test serialization
      try {
        const serialized = JSON.stringify(batchMessage);
        console.log(`✅ JSON serialization successful (${serialized.length} characters)`);
        
        const parsed = JSON.parse(serialized);
        console.log(`✅ Round-trip test passed`);
        
      } catch (error) {
        console.log(`❌ JSON serialization failed:`, error);
      }
    }
    
    console.log('\n✅ Real wallet test completed!');
    console.log('==============================');
    
    if (enrichedMessages.length > 0 && messagesWithPrice > 0) {
      console.log(`🎉 SUCCESS! The enriched data flow is working perfectly:`);
      console.log(`   - ${enrichedMessages.length} balance messages created`);
      console.log(`   - ${messagesWithPrice} messages include price data`);
      console.log(`   - Portfolio value: $${totalPortfolioValue.toFixed(2)}`);
      console.log(`\n✨ Your balances page should now show enriched price data!`);
    } else if (enrichedMessages.length > 0) {
      console.log(`⚠️  Balances found but no price data available for those tokens`);
    } else {
      console.log(`❌ No balances found for this wallet`);
    }
    
  } catch (error) {
    console.log(`❌ Error in real wallet test:`, error);
    console.log(`❌ Error details:`, {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

testRealWallet().catch(console.error);
#!/usr/bin/env tsx

/**
 * Validation Script: Test subnet balance processing and attachment
 * 
 * This script validates that subnet balances are properly processed and attached
 * to balance messages by testing the entire flow from token metadata loading
 * to balance message creation.
 */

import { 
  loadTokenMetadata, 
  fetchUserBalances, 
  createBalanceUpdateMessage,
  isValidUserAddress,
  type EnhancedTokenRecord 
} from '../src/balances-lib.js';

console.log('🔍 SUBNET BALANCE VALIDATION TEST');
console.log('==================================');

async function validateSubnetBalances() {
  const testWalletAddress = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
  
  try {
    console.log(`🎯 Testing with wallet: ${testWalletAddress}`);
    console.log(`✅ Address validation: ${isValidUserAddress(testWalletAddress)}`);
    
    console.log('\n📋 STEP 1: Loading token metadata...');
    console.log('====================================');
    
    const tokenRecords = await loadTokenMetadata();
    console.log(`✅ Loaded ${tokenRecords.size} token records`);
    
    // Find tokens that have subnet versions
    const mainnetTokensWithSubnets: EnhancedTokenRecord[] = [];
    const subnetTokens: EnhancedTokenRecord[] = [];
    
    for (const record of tokenRecords.values()) {
      if (record.type === 'SUBNET') {
        subnetTokens.push(record);
      } else {
        // Check if this mainnet token has a subnet version
        const hasSubnetVersion = Array.from(tokenRecords.values()).some(
          r => r.type === 'SUBNET' && r.base === record.contractId
        );
        if (hasSubnetVersion) {
          mainnetTokensWithSubnets.push(record);
        }
      }
    }
    
    console.log(`📊 Found ${mainnetTokensWithSubnets.length} mainnet tokens with subnet versions`);
    console.log(`📊 Found ${subnetTokens.length} subnet tokens`);
    
    if (mainnetTokensWithSubnets.length > 0) {
      console.log('\n🔍 Mainnet tokens with subnet versions:');
      mainnetTokensWithSubnets.slice(0, 5).forEach((token, index) => {
        const subnetVersion = subnetTokens.find(s => s.base === token.contractId);
        console.log(`${index + 1}. ${token.symbol} (${token.contractId})`);
        console.log(`   Subnet: ${subnetVersion?.symbol} (${subnetVersion?.contractId})`);
      });
    }
    
    console.log('\n📋 STEP 2: Fetching user balances...');
    console.log('===================================');
    
    const rawBalances = await fetchUserBalances([testWalletAddress], tokenRecords);
    console.log(`📊 Raw balances received: ${Object.keys(rawBalances).length} entries`);
    
    if (Object.keys(rawBalances).length === 0) {
      console.log('❌ No balances found for this wallet');
      return;
    }
    
    console.log('\n📋 STEP 3: Testing subnet balance detection...');
    console.log('=============================================');
    
    let balancesWithSubnets = 0;
    let balancesWithoutSubnets = 0;
    const subnetBalanceExamples: any[] = [];
    
    for (const [key, balanceData] of Object.entries(rawBalances)) {
      const { userId, contractId } = balanceData;
      
      // Find token record
      let tokenRecord = tokenRecords.get(contractId);
      if (!tokenRecord && contractId.includes('::')) {
        const baseContractId = contractId.split('::')[0];
        tokenRecord = tokenRecords.get(baseContractId!);
      }
      
      if (!tokenRecord) {
        console.log(`⚠️  No token record found for ${contractId}, skipping...`);
        continue;
      }
      
      // Check if this token has subnet support
      const hasSubnetSupport = mainnetTokensWithSubnets.some(t => t.contractId === tokenRecord.contractId);
      
      if (hasSubnetSupport) {
        balancesWithSubnets++;
        console.log(`✅ ${tokenRecord.symbol}: Has subnet support`);
        
        // Create balance info
        const balanceInfo = {
          balance: balanceData.balance,
          totalSent: balanceData.totalSent,
          totalReceived: balanceData.totalReceived,
          formattedBalance: balanceData.balance / Math.pow(10, tokenRecord.decimals),
          timestamp: balanceData.timestamp,
          source: balanceData.source
        };
        
        // Find the subnet token
        const subnetToken = subnetTokens.find(s => s.base === tokenRecord.contractId);
        
        // Create subnet balance info (simulated for now - would come from actual subnet contract calls)
        const subnetBalanceInfo = subnetToken ? {
          contractId: subnetToken.contractId,
          balance: Math.floor(balanceData.balance * 0.1), // Simulate 10% of mainnet balance
          totalSent: '0',
          totalReceived: '0',
          formattedBalance: Math.floor(balanceData.balance * 0.1) / Math.pow(10, tokenRecord.decimals),
          timestamp: balanceData.timestamp,
          source: 'subnet-contract-call'
        } : undefined;
        
        // Create the balance message
        const message = createBalanceUpdateMessage(tokenRecord, userId, balanceInfo, subnetBalanceInfo);
        
        console.log(`🔍 ${tokenRecord.symbol} balance message structure:`, {
          contractId: message.contractId,
          balance: message.balance,
          formattedBalance: message.formattedBalance,
          subnetBalance: message.subnetBalance,
          formattedSubnetBalance: message.formattedSubnetBalance,
          subnetContractId: message.subnetContractId,
          hasSubnetData: !!(message.subnetBalance !== undefined)
        });
        
        subnetBalanceExamples.push({
          tokenSymbol: tokenRecord.symbol,
          mainnetContract: tokenRecord.contractId,
          subnetContract: subnetToken?.contractId,
          message
        });
        
      } else {
        balancesWithoutSubnets++;
        console.log(`❌ ${tokenRecord.symbol}: No subnet support`);
      }
    }
    
    console.log(`\n📊 Subnet Balance Analysis:`);
    console.log(`- Tokens with subnet support: ${balancesWithSubnets}`);
    console.log(`- Tokens without subnet support: ${balancesWithoutSubnets}`);
    console.log(`- Total balance entries: ${Object.keys(rawBalances).length}`);
    
    console.log('\n📋 STEP 4: Testing BlazeProvider message processing...');
    console.log('====================================================');
    
    if (subnetBalanceExamples.length > 0) {
      const example = subnetBalanceExamples[0];
      console.log(`🔍 Testing with ${example.tokenSymbol} message:`, {
        type: example.message.type,
        contractId: example.message.contractId,
        subnetBalance: example.message.subnetBalance,
        formattedSubnetBalance: example.message.formattedSubnetBalance,
        subnetContractId: example.message.subnetContractId
      });
      
      // Simulate BlazeProvider processing
      const balanceData = {
        // Core balance fields
        balance: String(example.message.balance || 0),
        totalSent: example.message.totalSent || '0',
        totalReceived: example.message.totalReceived || '0',
        formattedBalance: example.message.formattedBalance || 0,
        timestamp: example.message.timestamp || Date.now(),
        source: example.message.source || 'realtime',
        
        // Subnet balance fields
        subnetBalance: example.message.subnetBalance,
        formattedSubnetBalance: example.message.formattedSubnetBalance,
        subnetContractId: example.message.subnetContractId,
        
        // NEW: Structured metadata
        metadata: example.message.metadata || {},
        
        // Legacy fields for backward compatibility
        name: example.message.metadata?.name || example.message.name,
        symbol: example.message.metadata?.symbol || example.message.symbol,
        decimals: example.message.metadata?.decimals || example.message.decimals,
      };
      
      console.log(`✅ Simulated BlazeProvider balanceData:`, {
        hasSubnetBalance: balanceData.subnetBalance !== undefined,
        subnetBalance: balanceData.subnetBalance,
        formattedSubnetBalance: balanceData.formattedSubnetBalance,
        subnetContractId: balanceData.subnetContractId
      });
      
      // Test subnet detection logic (from TokenInputSection)
      const hasSubnet = balanceData.subnetBalance !== undefined;
      console.log(`🔍 Subnet detection result: ${hasSubnet}`);
      
      if (hasSubnet) {
        console.log(`🎉 SUCCESS: Subnet balance data is properly attached!`);
        console.log(`   - Subnet balance: ${balanceData.subnetBalance}`);
        console.log(`   - Formatted subnet balance: ${balanceData.formattedSubnetBalance}`);
        console.log(`   - Subnet contract ID: ${balanceData.subnetContractId}`);
      } else {
        console.log(`❌ ISSUE: Subnet balance data is missing`);
      }
    }
    
    console.log('\n✅ Subnet balance validation completed!');
    console.log('======================================');
    
  } catch (error) {
    console.log(`❌ Error in subnet balance validation:`, error);
    console.log(`❌ Error details:`, {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

validateSubnetBalances().catch(console.error);
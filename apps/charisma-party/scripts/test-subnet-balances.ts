#!/usr/bin/env tsx

/**
 * Debug script to test subnet token balance fetching
 * This simulates what the balances party server does on startup
 * 
 * Usage: pnpm script test-subnet-balances [userId]
 */

import { fetchUserBalances, loadTokenMetadata } from '../src/balances-lib.js';

async function main() {
  console.log('🔍 Testing Subnet Token Balance Fetching');
  console.log('=' .repeat(50));

  // Get user ID from args or use default
  const testUserId = process.argv[2] || 'SP1HTBVD3JG9C05J7HBJTHGR0GGW7KX975CN0QKJ3';
  
  console.log(`👤 Testing with user: ${testUserId}`);
  console.log();

  try {
    // Step 1: Load token metadata like the server does
    console.log('📋 Step 1: Loading token metadata...');
    const enhancedTokenRecords = await loadTokenMetadata();
    
    console.log(`✅ Loaded ${enhancedTokenRecords.size} token records`);
    
    // Step 2: Check specific tokens we're interested in
    console.log('\n🔍 Step 2: Checking aeUSDC token metadata...');
    const aeUSDCContract = 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc';
    const aeUSDCRecord = enhancedTokenRecords.get(aeUSDCContract);
    
    if (aeUSDCRecord) {
      console.log('✅ Found aeUSDC metadata:');
      console.log(`   Contract: ${aeUSDCRecord.contractId}`);
      console.log(`   Symbol: ${aeUSDCRecord.symbol}`);
      console.log(`   Type: ${aeUSDCRecord.type}`);
      console.log(`   Base: ${aeUSDCRecord.base || 'undefined'}`);
      console.log(`   Metadata Source: ${aeUSDCRecord.metadataSource}`);
    } else {
      console.log('❌ aeUSDC not found in metadata');
    }

    // Step 3: Check for subnet tokens
    console.log('\n🏗️  Step 3: Checking for subnet tokens...');
    const allTokens = Array.from(enhancedTokenRecords.values());
    const subnetTokens = allTokens.filter(record => record.type === 'SUBNET');
    
    console.log(`📊 Found ${subnetTokens.length} subnet tokens out of ${allTokens.length} total tokens:`);
    subnetTokens.forEach(token => {
      console.log(`   - ${token.symbol} (${token.contractId})`);
      console.log(`     Base: ${token.base || 'undefined'}`);
      console.log(`     Type: ${token.type}`);
    });

    // Step 4: Look specifically for aeUSDC subnet tokens
    console.log('\n🔍 Step 4: Looking for aeUSDC subnet tokens...');
    const aeUSDCSubnetTokens = subnetTokens.filter(token => 
      token.base === aeUSDCContract || 
      token.contractId.includes('aeusdc') || 
      token.symbol.toLowerCase().includes('aeusdc')
    );
    
    if (aeUSDCSubnetTokens.length > 0) {
      console.log(`✅ Found ${aeUSDCSubnetTokens.length} aeUSDC subnet token(s):`);
      aeUSDCSubnetTokens.forEach(token => {
        console.log(`   - ${token.symbol} (${token.contractId})`);
        console.log(`     Base: ${token.base}`);
        console.log(`     Type: ${token.type}`);
      });
    } else {
      console.log('❌ No aeUSDC subnet tokens found');
      console.log('   This explains why no subnet balances are being fetched!');
    }

    // Step 5: Check environment variables
    console.log('\n🌍 Step 5: Checking environment variables...');
    const tokenSummariesUrl = process.env.TOKEN_SUMMARIES_URL || 
                             process.env.NEXT_PUBLIC_TOKEN_SUMMARIES_URL || 
                             'https://invest.charisma.rocks/api/v1/tokens/all?includePricing=true';
    console.log(`   Token Summaries URL: ${tokenSummariesUrl}`);

    // Step 6: Fetch actual balances
    console.log('\n💰 Step 6: Fetching user balances...');
    const balanceUpdates = await fetchUserBalances([testUserId], enhancedTokenRecords);
    
    console.log(`📊 Fetched ${Object.keys(balanceUpdates).length} balance entries:`);
    
    // Look for aeUSDC related balances
    const aeUSDCBalances = Object.entries(balanceUpdates).filter(([key, balance]) => 
      balance.contractId.includes('aeusdc') || key.includes('aeusdc')
    );
    
    if (aeUSDCBalances.length > 0) {
      console.log('\n💰 aeUSDC related balances:');
      aeUSDCBalances.forEach(([key, balance]) => {
        console.log(`   Key: ${key}`);
        console.log(`   Contract: ${balance.contractId}`);
        console.log(`   Balance: ${balance.balance}`);
        console.log(`   Source: ${balance.source}`);
        console.log(`   ---`);
      });
    } else {
      console.log('\n❌ No aeUSDC balances found for this user');
    }

    // Step 7: Check known subnet mappings
    console.log('\n🗺️  Step 7: Checking known subnet mappings...');
    const { promises: fs } = await import('fs');
    const path = await import('path');
    
    // Read the balances-lib file to see the mappings
    const balancesLibPath = path.join(process.cwd(), 'src/balances-lib.ts');
    try {
      const balancesLibContent = await fs.readFile(balancesLibPath, 'utf8');
      
      const mappingsMatch = balancesLibContent.match(/KNOWN_SUBNET_MAPPINGS[\s\S]*?\]\);/);
      if (mappingsMatch) {
        console.log('📋 Known subnet mappings found in code:');
        console.log(mappingsMatch[0]);
        
        // Check if aeUSDC has a mapping
        if (mappingsMatch[0].includes('aeusdc') || mappingsMatch[0].includes('token-aeusdc')) {
          console.log('✅ aeUSDC appears to have a subnet mapping');
        } else {
          console.log('❌ aeUSDC does NOT have a known subnet mapping');
          console.log('   This might be why subnet balances are not being fetched');
        }
      }
    } catch (error) {
      console.log('⚠️  Could not read balances-lib.ts file');
    }

    // Step 8: Summary and recommendations
    console.log('\n📋 Summary & Recommendations:');
    console.log('=' .repeat(50));
    
    if (aeUSDCSubnetTokens.length === 0) {
      console.log('🚨 ISSUE: No aeUSDC subnet tokens found in metadata');
      console.log('   Possible causes:');
      console.log('   1. aeUSDC subnet token not in the tokens API');
      console.log('   2. aeUSDC subnet token has wrong metadata (type !== "SUBNET")');
      console.log('   3. aeUSDC subnet token has wrong base field');
      console.log('   4. aeUSDC subnet token contract ID is different than expected');
      console.log('   5. Need to add aeUSDC to KNOWN_SUBNET_MAPPINGS');
      console.log('\n   🔧 Next steps:');
      console.log('   - Check the tokens API response for aeUSDC subnet tokens');
      console.log('   - Verify aeUSDC subnet contract exists and is accessible');
      console.log('   - Add aeUSDC to KNOWN_SUBNET_MAPPINGS if needed');
    } else {
      console.log('✅ aeUSDC subnet tokens found in metadata');
      if (aeUSDCBalances.length === 0) {
        console.log('   Issue: User has no aeUSDC balances (mainnet or subnet)');
      } else {
        console.log('   Issue might be in subnet balance fetching logic');
      }
    }
    
  } catch (error) {
    console.error('❌ Error during testing:', error);
    if (error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}
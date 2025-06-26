#!/usr/bin/env tsx

/**
 * Check CHA Token Subnet Configuration
 * 
 * This script investigates why the CHA token is not showing subnet balance fields
 * in the websocket data.
 */

import { 
  loadTokenMetadata, 
  fetchTokenSummariesFromAPI
} from '../src/balances-lib.js';

console.log('🔍 CHA TOKEN SUBNET INVESTIGATION');
console.log('=================================');

async function checkChaSubnet() {
  try {
    console.log('📋 STEP 1: Fetching token summaries...');
    console.log('======================================');
    
    const summaries = await fetchTokenSummariesFromAPI();
    console.log(`✅ Fetched ${summaries.length} token summaries`);
    
    // Find CHA-related tokens
    const chaTokens = summaries.filter(t => 
      t.symbol === 'CHA' || 
      t.contractId.includes('charisma-token') ||
      t.name?.toLowerCase().includes('charisma')
    );
    
    console.log(`\n🔍 Found ${chaTokens.length} CHA-related tokens:`);
    chaTokens.forEach(t => {
      console.log(`- ${t.symbol} (${t.contractId})`);
      console.log(`  Type: ${t.type}`);
      console.log(`  Base: ${t.base || 'none'}`);
      console.log(`  Name: ${t.name}`);
      console.log('');
    });
    
    // Find all subnet tokens
    const subnetTokens = summaries.filter(t => t.type === 'SUBNET');
    console.log(`\n📊 Found ${subnetTokens.length} total subnet tokens:`);
    subnetTokens.forEach(t => {
      console.log(`- ${t.symbol} (${t.contractId})`);
      console.log(`  Base: ${t.base}`);
    });
    
    // Look for CHA subnet specifically
    const chaSubnet = subnetTokens.find(t => 
      t.base && (
        t.base.includes('charisma-token') ||
        t.base === 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'
      )
    );
    
    console.log('\n📋 STEP 2: CHA subnet analysis...');
    console.log('==================================');
    
    if (chaSubnet) {
      console.log('✅ Found CHA subnet token:');
      console.log(`- Symbol: ${chaSubnet.symbol}`);
      console.log(`- Contract: ${chaSubnet.contractId}`);
      console.log(`- Base: ${chaSubnet.base}`);
      console.log(`- Type: ${chaSubnet.type}`);
    } else {
      console.log('❌ No CHA subnet token found');
      console.log('\n🔍 Checking if there are any subnet tokens with CHA in the name:');
      const chaNamedSubnets = subnetTokens.filter(t => 
        t.symbol?.toLowerCase().includes('cha') ||
        t.name?.toLowerCase().includes('charisma') ||
        t.contractId.toLowerCase().includes('cha')
      );
      
      if (chaNamedSubnets.length > 0) {
        console.log('Found CHA-named subnet tokens:');
        chaNamedSubnets.forEach(t => {
          console.log(`- ${t.symbol} (${t.contractId})`);
          console.log(`  Base: ${t.base}`);
          console.log(`  Name: ${t.name}`);
        });
      } else {
        console.log('No CHA-related subnet tokens found');
      }
    }
    
    console.log('\n📋 STEP 3: Validation with enhanced records...');
    console.log('===============================================');
    
    const enhancedRecords = await loadTokenMetadata();
    const chaRecord = enhancedRecords.get('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token');
    
    if (chaRecord) {
      console.log('✅ Found CHA enhanced record:');
      console.log(`- Symbol: ${chaRecord.symbol}`);
      console.log(`- Type: ${chaRecord.type}`);
      console.log(`- Base: ${chaRecord.base || 'none'}`);
      
      // Check if any subnet token points to this CHA token
      const chaSubnetFromRecords = Array.from(enhancedRecords.values()).find(r => 
        r.type === 'SUBNET' && r.base === chaRecord.contractId
      );
      
      if (chaSubnetFromRecords) {
        console.log('\n✅ Found subnet token pointing to CHA:');
        console.log(`- Symbol: ${chaSubnetFromRecords.symbol}`);
        console.log(`- Contract: ${chaSubnetFromRecords.contractId}`);
        console.log(`- Base: ${chaSubnetFromRecords.base}`);
      } else {
        console.log('\n❌ No subnet token found pointing to CHA in enhanced records');
      }
    } else {
      console.log('❌ CHA token not found in enhanced records');
    }
    
    console.log('\n📋 STEP 4: Checking base token mappings...');
    console.log('==========================================');
    
    // Show all base token mappings for subnet tokens
    console.log('Subnet → Base mappings:');
    subnetTokens.forEach(t => {
      if (t.base) {
        console.log(`${t.symbol} → ${t.base}`);
      }
    });
    
    console.log('\n✅ CHA subnet investigation completed!');
    console.log('=====================================');
    
  } catch (error) {
    console.log(`❌ Error in CHA subnet investigation:`, error);
    console.log(`❌ Error details:`, {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

checkChaSubnet().catch(console.error);
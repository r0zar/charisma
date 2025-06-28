#!/usr/bin/env tsx

/**
 * Fix Subnet Token Base Mappings
 * 
 * This script identifies and fixes subnet tokens that are missing their 
 * base token mappings by fetching relationship data from the dex-cache API
 * and updating the token metadata in KV storage.
 */

import { kv } from '@vercel/kv';
import { fetchMetadata } from '@repo/tokens';

interface SubnetMapping {
  subnetContract: string;
  baseContract: string;
  symbol: string;
  name: string;
}

interface VaultData {
  contractId: string;
  tokenAContract?: string;
  tokenBContract?: string;
  symbol?: string;
  name?: string;
  type?: string;
}

/**
 * Fetch subnet mappings from the dex-cache API
 */
async function fetchSubnetMappingsFromAPI(): Promise<SubnetMapping[]> {
  try {
    console.log('🔗 Fetching subnet mappings from dex-cache API...');
    const response = await fetch('http://localhost:3003/api/v1/vaults?type=SUBLINK');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const vaults: VaultData[] = await response.json();
    console.log(`✅ Fetched ${vaults.length} SUBLINK vaults from API`);
    
    const mappings: SubnetMapping[] = [];
    
    for (const vault of vaults) {
      // SUBLINK vaults represent subnet tokens
      // tokenB.base should point to the mainnet token
      if (vault.tokenBContract && vault.contractId) {
        mappings.push({
          subnetContract: vault.contractId,
          baseContract: vault.tokenBContract,
          symbol: vault.symbol || 'UNKNOWN',
          name: vault.name || 'Unknown Token'
        });
        
        console.log(`🔗 Found mapping: ${vault.symbol} subnet (${vault.contractId}) → base (${vault.tokenBContract})`);
      }
    }
    
    console.log(`📊 Generated ${mappings.length} subnet mappings from API data`);
    return mappings;
    
  } catch (error) {
    console.error('❌ Failed to fetch subnet mappings from API:', error);
    console.log('🔄 Falling back to static mappings...');
    
    // Fallback to static mappings if API is unavailable
    return [
      {
        subnetContract: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1',
        baseContract: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
        symbol: 'CHA',
        name: 'Charisma'
      },
      {
        subnetContract: 'SP2KGJEAZRDVK78ZWTRGSDE11A1VMZVEATNQFZ73C.world-peace-stacks-stxcity-subnet',
        baseContract: 'SP14J806BWEPQAXVA0G6RYZN7GNA126B7JFRRYTEM.world-peace-stacks-stxcity',
        symbol: 'WPS',
        name: 'World Peace Stacks'
      },
      {
        subnetContract: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.leo-token-subnet-v1',
        baseContract: 'SP1AY6K3PQV5MRT6R4S671NWW2FRVPKM0BR162CT6.leo-token',
        symbol: 'LEO',
        name: 'LEO Token'
      },
      {
        subnetContract: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.kangaroo-subnet',
        baseContract: 'SP2C1WREHGM75C7TGFAEJPFKTFTEGZKF6DFT6E2GE.kangaroo',
        symbol: '$ROO',
        name: 'Kangaroo'
      },
      {
        subnetContract: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.usda-token-subnet',
        baseContract: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token',
        symbol: 'USDA',
        name: 'USDA Token'
      },
      {
        subnetContract: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dmtoken-subnet',
        baseContract: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dmtoken',
        symbol: 'DMT',
        name: 'DMT Token'
      },
      {
        subnetContract: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.nope-subnet',
        baseContract: 'SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ.nope',
        symbol: 'NOT',
        name: 'NOT Token'
      },
      {
        subnetContract: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-token-subnet-v1',
        baseContract: 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token',
        symbol: 'WELSH',
        name: 'Welsh Corgi Coin'
      }
    ];
  }
}

async function fixSubnetMappings() {
  const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');
  
  console.log(`🔧 ${isDryRun ? 'DRY RUN: ' : 'LIVE RUN: '}Starting subnet token base mapping fix...`);
  
  try {
    // Step 1: Fetch subnet mappings from API
    console.log('\n📋 STEP 1: Fetching subnet mappings...');
    console.log('==========================================');
    const subnetMappings = await fetchSubnetMappingsFromAPI();
    
    if (subnetMappings.length === 0) {
      console.log('❌ No subnet mappings found. Exiting.');
      return;
    }
    
    // Step 2: Fetch all existing metadata from KV cache
    console.log('\n📋 STEP 2: Fetching existing metadata from KV cache...');
    console.log('====================================================');
    const allMetadata = await fetchMetadata();
    console.log(`Found ${allMetadata.length} tokens in cache`);
    
    // Filter for subnet tokens
    const subnetTokens = allMetadata.filter(token => token.type === 'SUBNET');
    console.log(`Found ${subnetTokens.length} subnet tokens in cache:`);
    subnetTokens.forEach(token => {
      console.log(`- ${token.symbol} (${token.contractId})`);
      console.log(`  Base: ${token.base || 'MISSING'}`);
      console.log(`  Type: ${token.type}`);
    });
    
    // Step 3: Identify tokens that need fixes
    console.log('\n📋 STEP 3: Identifying tokens that need fixes...');
    console.log('===============================================');
    const tokensToFix = [];
    
    for (const mapping of subnetMappings) {
      const subnetToken = subnetTokens.find(t => t.contractId === mapping.subnetContract);
      const baseTokenExists = allMetadata.find(t => t.contractId === mapping.baseContract);
      
      if (!subnetToken) {
        console.log(`⚠️  Subnet token ${mapping.symbol} (${mapping.subnetContract}) not found in cache`);
        continue;
      }
      
      if (!baseTokenExists) {
        console.log(`⚠️  Base token ${mapping.symbol} (${mapping.baseContract}) not found in cache`);
        continue;
      }
      
      if (subnetToken.base !== mapping.baseContract) {
        console.log(`🔧 ${mapping.symbol}: Need to fix base mapping`);
        console.log(`   Current: ${subnetToken.base || 'null'}`);
        console.log(`   Should be: ${mapping.baseContract}`);
        tokensToFix.push({
          token: subnetToken,
          mapping: mapping
        });
      } else {
        console.log(`✅ ${mapping.symbol}: Base mapping is correct`);
      }
    }
    
    if (tokensToFix.length === 0) {
      console.log('\n🎉 All subnet token base mappings are correct!');
      return;
    }
    
    console.log(`\n📋 STEP 4: ${isDryRun ? 'Simulating fixes' : 'Applying fixes'}...`);
    console.log(`===============================================`);
    console.log(`${isDryRun ? 'Would fix' : 'Fixing'} ${tokensToFix.length} subnet token mappings...`);
    
    let fixed = 0;
    let errors = 0;
    
    for (const { token, mapping } of tokensToFix) {
      try {
        console.log(`\n🔧 ${isDryRun ? 'Would fix' : 'Fixing'} ${mapping.symbol} (${token.contractId})...`);
        
        if (isDryRun) {
          console.log(`   📝 Would update base: ${token.base || 'null'} → ${mapping.baseContract}`);
          console.log(`   📝 Would update type: ${token.type || 'null'} → SUBNET`);
          console.log(`   📝 Would update lastUpdated: ${token.lastUpdated || 'null'} → ${Date.now()}`);
        } else {
          // Create updated token metadata
          const updatedToken = {
            ...token,
            base: mapping.baseContract,
            type: 'SUBNET', // Ensure type is set correctly
            lastUpdated: Date.now()
          };
          
          // Update in KV storage
          const kvKey = `sip10:${token.contractId}`;
          await kv.set(kvKey, updatedToken);
          
          console.log(`✅ Fixed ${mapping.symbol}: base now points to ${mapping.baseContract}`);
        }
        
        fixed++;
        
      } catch (error) {
        console.error(`❌ Error ${isDryRun ? 'simulating fix for' : 'fixing'} ${mapping.symbol}:`, error);
        errors++;
      }
    }
    
    // Step 5: Verification (only for live runs)
    if (!isDryRun) {
      console.log('\n📋 STEP 5: Verification...');
      console.log('===========================');
      console.log('Checking updated subnet tokens...');
      const updatedMetadata = await fetchMetadata();
      const updatedSubnetTokens = updatedMetadata.filter(token => token.type === 'SUBNET');
      
      console.log('\nUpdated subnet token mappings:');
      updatedSubnetTokens.forEach(token => {
        const mapping = subnetMappings.find(m => m.subnetContract === token.contractId);
        const isCorrect = mapping && token.base === mapping.baseContract;
        const status = isCorrect ? '✅' : '❌';
        console.log(`${status} ${token.symbol} (${token.contractId})`);
        console.log(`   Base: ${token.base || 'null'}`);
      });
    }
    
    console.log('\n✅ Subnet mapping fix completed!');
    console.log(`📊 Final stats:`);
    console.log(`   • ${fixed} tokens ${isDryRun ? 'would be fixed' : 'fixed'}`);
    console.log(`   • ${errors} errors`);
    
    if (isDryRun && fixed > 0) {
      console.log('\n💡 Run without --dry-run to apply these changes.');
    } else if (!isDryRun && fixed > 0) {
      console.log('\n🔄 Note: The token-summaries API should pick up these changes immediately');
      console.log('   since it reads from the same KV store.');
    }
    
  } catch (error) {
    console.error('❌ Failed to fix subnet mappings:', error);
    process.exit(1);
  }
}

// Show usage information
function showUsage() {
  console.log('Usage: pnpm script fix-subnet-mappings [--dry-run]');
  console.log('\nOptions:');
  console.log('  --dry-run, -d    Show what would be updated without making changes');
  console.log('\nDescription:');
  console.log('  Fixes subnet token base mappings by fetching relationship data from the dex-cache API');
  console.log('  and updating the token metadata in KV storage. This ensures subnet tokens are properly');
  console.log('  linked to their mainnet counterparts for balance display purposes.');
  console.log('\nExamples:');
  console.log('  pnpm script fix-subnet-mappings --dry-run    # Show what would be fixed');
  console.log('  pnpm script fix-subnet-mappings              # Apply the fixes');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showUsage();
  process.exit(0);
}

fixSubnetMappings().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
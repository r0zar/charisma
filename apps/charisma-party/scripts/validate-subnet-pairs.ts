#!/usr/bin/env tsx

/**
 * Validate Subnet Token Pairs
 * 
 * This script validates that known mainnet tokens have their corresponding
 * subnet tokens with proper base mappings. Throws errors for missing pairs.
 */

interface TokenSummary {
  contractId: string;
  symbol: string;
  name: string;
  type?: string;
  base?: string;
  price?: {
    usd: number;
    change24h: number;
  };
}

// Known mainnet tokens that MUST have subnet pairs
const REQUIRED_SUBNET_PAIRS = [
  {
    mainnet: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
    subnet: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1',
    symbol: 'CHA'
  },
  {
    mainnet: 'SP1AY6K3PQV5MRT6R4S671NWW2FRVPKM0BR162CT6.leo-token',
    subnet: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.leo-token-subnet-v1',
    symbol: 'LEO'
  },
  {
    mainnet: 'SP2C1WREHGM75C7TGFAEJPFKTFTEGZKF6DFT6E2GE.kangaroo',
    subnet: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.kangaroo-subnet',
    symbol: '$ROO'
  },
  {
    mainnet: 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token',
    subnet: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-token-subnet-v1',
    symbol: 'WELSH'
  }
];

async function validateSubnetPairs() {
  console.log('🔍 VALIDATING SUBNET TOKEN PAIRS');
  console.log('=================================\n');

  try {
    // Fetch token summaries
    console.log('📋 Fetching token summaries...');
    const response = await fetch('https://swap.charisma.rocks/api/token-summaries');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch token summaries: ${response.status}`);
    }
    
    const tokens: TokenSummary[] = await response.json();
    console.log(`✅ Fetched ${tokens.length} token summaries\n`);

    // Create lookup maps
    const tokenByContract = new Map<string, TokenSummary>();
    const subnetTokens = new Map<string, TokenSummary>();
    
    tokens.forEach(token => {
      tokenByContract.set(token.contractId, token);
      if (token.type === 'SUBNET') {
        subnetTokens.set(token.contractId, token);
      }
    });

    console.log(`📊 Found ${subnetTokens.size} subnet tokens\n`);

    let errors = 0;
    let validPairs = 0;

    // Validate each required pair
    for (const pair of REQUIRED_SUBNET_PAIRS) {
      console.log(`🔍 Validating ${pair.symbol} (${pair.mainnet})...`);
      
      const mainnetToken = tokenByContract.get(pair.mainnet);
      const subnetToken = tokenByContract.get(pair.subnet);
      
      // Check if mainnet token exists
      if (!mainnetToken) {
        console.error(`❌ ERROR: Mainnet token not found: ${pair.mainnet}`);
        errors++;
        continue;
      }
      
      // Check if subnet token exists
      if (!subnetToken) {
        console.error(`❌ ERROR: Subnet token not found: ${pair.subnet}`);
        errors++;
        continue;
      }
      
      // Check if subnet token has SUBNET type
      if (subnetToken.type !== 'SUBNET') {
        console.error(`❌ ERROR: Token ${pair.subnet} has type '${subnetToken.type}', expected 'SUBNET'`);
        errors++;
        continue;
      }
      
      // Check if subnet token has correct base mapping
      if (subnetToken.base !== pair.mainnet) {
        console.error(`❌ ERROR: Subnet token ${pair.subnet} has base '${subnetToken.base}', expected '${pair.mainnet}'`);
        errors++;
        continue;
      }
      
      // All checks passed
      console.log(`✅ ${pair.symbol}: Valid subnet pair`);
      console.log(`   Mainnet: ${mainnetToken.symbol} (${pair.mainnet})`);
      console.log(`   Subnet: ${subnetToken.symbol} (${pair.subnet})`);
      console.log(`   Base mapping: ${subnetToken.base}`);
      validPairs++;
    }

    console.log('\n📋 VALIDATION SUMMARY');
    console.log('====================');
    console.log(`✅ Valid pairs: ${validPairs}`);
    console.log(`❌ Errors: ${errors}`);
    
    if (errors > 0) {
      console.log('\n🚨 SUBNET PAIR VALIDATION FAILED!');
      console.log('The following issues must be resolved:');
      console.log('1. Missing subnet tokens or incorrect base mappings');
      console.log('2. This will prevent proper subnet balance display in the UI');
      console.log('3. Run fix-subnet-mappings script to resolve mapping issues');
      
      throw new Error(`Subnet pair validation failed with ${errors} errors`);
    }
    
    console.log('\n🎉 All subnet token pairs are properly configured!');
    
  } catch (error) {
    console.error('\n❌ Validation failed:', error);
    process.exit(1);
  }
}

// Show usage information
function showUsage() {
  console.log('Usage: pnpm script validate-subnet-pairs');
  console.log('\nDescription:');
  console.log('  Validates that known mainnet tokens have corresponding subnet tokens');
  console.log('  with proper base mappings. Throws errors if any pairs are missing or');
  console.log('  incorrectly configured.');
  console.log('\nRequired subnet pairs:');
  REQUIRED_SUBNET_PAIRS.forEach(pair => {
    console.log(`  ${pair.symbol}: ${pair.mainnet} → ${pair.subnet}`);
  });
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showUsage();
  process.exit(0);
}

validateSubnetPairs().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
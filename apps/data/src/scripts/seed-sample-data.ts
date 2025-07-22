#!/usr/bin/env tsx

/**
 * Sample data seeder for blockchain data warehouse
 * Creates realistic Stacks ecosystem data for testing
 */

import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables from .env.local
config({ path: join(process.cwd(), '.env.local') });

// Verify we have the required token
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('❌ BLOB_READ_WRITE_TOKEN not found in environment variables');
  console.error('');
  console.error('Please set up your environment:');
  console.error('1. Run: pnpm setup');
  console.error('2. Or manually add BLOB_READ_WRITE_TOKEN to .env.local');
  console.error('3. Get your token from: https://vercel.com/dashboard → Storage → Blob');
  process.exit(1);
}

import { blobStorageService } from '../services/blob-storage-service.js';

// Sample Stacks addresses
const SAMPLE_ADDRESSES = [
  'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9', // STX mainnet address
  'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR', // Alex DEX
  'SP3D6PV2ACBPEKYJTCMH7HEN02KP87QSP8KTEH335', // Arkadiko
  'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM', // Stackswap
  'STSPS4HHDQ7MVHJGV4WKF2K1MWMZAERW4CKNTNX'    // Testnet address
];

// Sample contract addresses  
const SAMPLE_CONTRACTS = [
  'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-registry',
  'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.alex-token',
  'SP3D6PV2ACBPEKYJTCMH7HEN02KP87QSP8KTEH335.arkadiko-swap',
  'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.stackswap-pool'
];

// Sample token pairs
const SAMPLE_TOKEN_PAIRS = [
  'STX-USDA',
  'STX-ALEX',
  'WELSH-STX',
  'ARKADIKO-STX',
  'DIKO-USDA'
];

/**
 * Generate sample balance data
 */
function generateBalanceData() {
  return {
    stx: {
      balance: Math.floor(Math.random() * 10000000000), // Random STX balance in microSTX
      locked: Math.floor(Math.random() * 1000000000),
      burn_block_height: Math.floor(Math.random() * 100000) + 800000
    },
    fungible_tokens: Array.from({ length: 3 }, (_, i) => ({
      contract_id: SAMPLE_CONTRACTS[i % SAMPLE_CONTRACTS.length],
      balance: Math.floor(Math.random() * 1000000000000),
      total_sent: Math.floor(Math.random() * 100000000),
      total_received: Math.floor(Math.random() * 500000000)
    })),
    non_fungible_tokens: []
  };
}

/**
 * Generate sample transaction data
 */
function generateTransactionData() {
  return {
    limit: 20,
    offset: 0,
    total: Math.floor(Math.random() * 1000) + 100,
    results: Array.from({ length: 20 }, (_, i) => ({
      tx_id: `0x${Buffer.from(`tx-${i}-${Date.now()}`).toString('hex').padEnd(64, '0')}`,
      tx_type: ['token_transfer', 'contract_call', 'smart_contract'][Math.floor(Math.random() * 3)],
      tx_status: 'success',
      block_height: Math.floor(Math.random() * 100000) + 800000,
      block_hash: `0x${Buffer.from(`block-${i}`).toString('hex').padEnd(64, '0')}`,
      burn_block_height: Math.floor(Math.random() * 100000) + 800000,
      burn_block_time: Date.now() - Math.floor(Math.random() * 86400000 * 30), // Last 30 days
      canonical: true,
      fee_rate: Math.floor(Math.random() * 10000) + 1000,
      sponsored: false,
      sender_address: SAMPLE_ADDRESSES[Math.floor(Math.random() * SAMPLE_ADDRESSES.length)],
      tx_result: {
        hex: '0x0703',
        repr: '(ok true)'
      }
    }))
  };
}

/**
 * Generate sample contract function data
 */
function generateContractFunctionData(contractAddress: string, functionName: string) {
  const baseData = {
    contract_id: contractAddress,
    function_name: functionName,
    last_updated: new Date().toISOString()
  };

  switch (functionName) {
    case 'get-balance':
      return {
        ...baseData,
        result: {
          type: 'uint',
          value: Math.floor(Math.random() * 1000000000000)
        }
      };
    
    case 'get-total-supply':
      return {
        ...baseData,
        result: {
          type: 'uint', 
          value: Math.floor(Math.random() * 100000000000000)
        }
      };
    
    case 'get-name':
      return {
        ...baseData,
        result: {
          type: 'string-ascii',
          value: 'Sample Token'
        }
      };
    
    case 'get-symbol':
      return {
        ...baseData,
        result: {
          type: 'string-ascii',
          value: 'SMPL'
        }
      };
    
    case 'get-decimals':
      return {
        ...baseData,
        result: {
          type: 'uint',
          value: 6
        }
      };
    
    default:
      return {
        ...baseData,
        result: {
          type: 'bool',
          value: true
        }
      };
  }
}

/**
 * Generate sample price data
 */
function generatePriceData(pair: string, type: 'current' | 'history') {
  const [base, quote] = pair.split('-');
  const basePrice = Math.random() * 10; // Random price between 0-10
  
  if (type === 'current') {
    return {
      pair,
      base_token: base,
      quote_token: quote,
      price: basePrice,
      volume_24h: Math.floor(Math.random() * 1000000),
      change_24h: (Math.random() - 0.5) * 20, // -10% to +10%
      last_updated: new Date().toISOString(),
      source: 'aggregated'
    };
  } else {
    // Historical data - 30 days of hourly data
    return {
      pair,
      timeframe: '1h',
      data: Array.from({ length: 24 * 30 }, (_, i) => {
        const timestamp = Date.now() - (i * 60 * 60 * 1000); // Hourly intervals
        const price = basePrice * (1 + (Math.random() - 0.5) * 0.1); // ±5% variance
        
        return {
          timestamp,
          open: price * 0.995,
          high: price * 1.005,
          low: price * 0.99,
          close: price,
          volume: Math.floor(Math.random() * 100000)
        };
      }).reverse() // Chronological order
    };
  }
}

/**
 * Main seeding function
 */
async function seedSampleData() {
  console.log('🌱 Seeding blockchain data warehouse...');
  
  try {
    // Seed address balances
    console.log('📊 Seeding address balances...');
    for (const address of SAMPLE_ADDRESSES) {
      const balanceData = generateBalanceData();
      await blobStorageService.put(`addresses/${address}/balances.json`, balanceData);
      console.log(`  ✅ ${address}/balances`);
    }
    
    // Seed transaction history
    console.log('📝 Seeding transaction history...');
    for (const address of SAMPLE_ADDRESSES) {
      const transactionData = generateTransactionData();
      await blobStorageService.put(`addresses/${address}/transactions.json`, transactionData);
      console.log(`  ✅ ${address}/transactions`);
    }
    
    // Seed contract functions
    console.log('📋 Seeding contract functions...');
    const contractFunctions = ['get-balance', 'get-total-supply', 'get-name', 'get-symbol', 'get-decimals'];
    
    for (const contract of SAMPLE_CONTRACTS) {
      // Contract metadata
      const metadata = {
        contract_id: contract,
        clarity_version: 2,
        contract_interface: {
          functions: contractFunctions.map(fn => ({
            name: fn,
            access: 'read_only',
            args: [],
            outputs: { type: 'response' }
          }))
        },
        last_updated: new Date().toISOString()
      };
      await blobStorageService.put(`contracts/${contract}/metadata.json`, metadata);
      console.log(`  ✅ ${contract}/metadata`);
      
      // Individual function results
      for (const fn of contractFunctions) {
        const functionData = generateContractFunctionData(contract, fn);
        await blobStorageService.put(`contracts/${contract}/${fn}.json`, functionData);
        console.log(`  ✅ ${contract}/${fn}`);
      }
    }
    
    // Seed price data
    console.log('💰 Seeding price data...');
    for (const pair of SAMPLE_TOKEN_PAIRS) {
      // Current prices
      const currentPrice = generatePriceData(pair, 'current');
      await blobStorageService.put(`prices/${pair}/current.json`, currentPrice);
      console.log(`  ✅ ${pair}/current`);
      
      // Historical prices
      const historicalPrices = generatePriceData(pair, 'history');
      await blobStorageService.put(`prices/${pair}/history.json`, historicalPrices);
      console.log(`  ✅ ${pair}/history`);
    }
    
    console.log('🎉 Sample data seeding completed successfully!');
    console.log('\n📋 Data Summary:');
    console.log(`  • ${SAMPLE_ADDRESSES.length} addresses with balances & transactions`);
    console.log(`  • ${SAMPLE_CONTRACTS.length} contracts with ${contractFunctions.length} functions each`);
    console.log(`  • ${SAMPLE_TOKEN_PAIRS.length} token pairs with current & historical prices`);
    console.log('\n🚀 Start the development server to explore the data:');
    console.log('  pnpm dev');
    
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedSampleData();
}

export { seedSampleData };
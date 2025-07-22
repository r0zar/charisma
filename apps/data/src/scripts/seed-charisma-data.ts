#!/usr/bin/env tsx

/**
 * Seed Charisma API data - extract addresses and contracts from price data
 */

import { blobStorageService } from '../services/blob-storage-service';

interface CharismaToken {
  symbol: string;
  name: string;
  address?: string;
  contractId?: string;
  price?: number;
  change24h?: number;
  volume24h?: number;
  marketCap?: number;
}

interface PriceData {
  tokens: CharismaToken[];
  timestamp: string;
}

/**
 * Extract addresses and contract IDs from Charisma API response
 */
async function extractCharismaData(): Promise<{
  addresses: Set<string>;
  contracts: Set<string>;
  tokens: CharismaToken[];
}> {
  console.log('Fetching Charisma price data...');
  
  const response = await fetch('https://invest.charisma.rocks/api/v1/prices', {
    headers: {
      'User-Agent': 'Charisma-Data-Seeder/1.0',
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Charisma data: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('Data received, processing...');

  const addresses = new Set<string>();
  const contracts = new Set<string>();
  const tokens: CharismaToken[] = [];

  // Recursive function to find all addresses and contracts in nested data
  function extractFromObject(obj: any, path: string = ''): void {
    if (!obj || typeof obj !== 'object') return;

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      // Check if key or value contains a Stacks address
      const addressRegex = /^S[PTM][A-Z0-9]{28,}$/;
      const contractRegex = /^S[PTM][A-Z0-9]{28,}\.[a-z0-9-]+$/i;

      // Check key
      if (typeof key === 'string') {
        if (contractRegex.test(key)) {
          contracts.add(key);
          const address = key.split('.')[0];
          addresses.add(address);
        } else if (addressRegex.test(key)) {
          addresses.add(key);
        }
      }

      // Check value
      if (typeof value === 'string') {
        if (contractRegex.test(value)) {
          contracts.add(value);
          const address = value.split('.')[0];
          addresses.add(address);
        } else if (addressRegex.test(value)) {
          addresses.add(value);
        }
      }

      // For token-like objects, collect additional info
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        if (value.symbol && value.name) {
          tokens.push({
            symbol: value.symbol,
            name: value.name,
            address: value.address || (addressRegex.test(key) ? key : undefined),
            contractId: value.contractId || (contractRegex.test(key) ? key : undefined),
            price: typeof value.price === 'number' ? value.price : undefined,
            change24h: typeof value.change24h === 'number' ? value.change24h : undefined,
            volume24h: typeof value.volume24h === 'number' ? value.volume24h : undefined,
            marketCap: typeof value.marketCap === 'number' ? value.marketCap : undefined
          });
        }
        // Recursively process nested objects
        extractFromObject(value, currentPath);
      }

      // Process arrays
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          extractFromObject(item, `${currentPath}[${index}]`);
        });
      }
    }
  }

  extractFromObject(data);

  console.log(`Found ${addresses.size} unique addresses`);
  console.log(`Found ${contracts.size} unique contracts`);
  console.log(`Found ${tokens.length} token entries`);

  return { addresses, contracts, tokens };
}

/**
 * Generate mock balance data for addresses
 */
function generateMockBalanceData(address: string) {
  return {
    balances: {
      stx: {
        balance: Math.floor(Math.random() * 1000000000000).toString(),
        total_sent: '0',
        total_received: Math.floor(Math.random() * 1000000000000).toString(),
        lock_tx_id: '',
        locked: '0',
        lock_height: 0,
        burnchain_lock_height: 0,
        burnchain_unlock_height: 0
      },
      fungible_tokens: []
    },
    transactions: {
      limit: 20,
      offset: 0,
      total: Math.floor(Math.random() * 100),
      results: []
    }
  };
}

/**
 * Generate mock contract data
 */
function generateMockContractData(contractId: string, token?: CharismaToken) {
  const [address, contractName] = contractId.split('.');
  
  return {
    metadata: {
      name: contractName,
      description: token?.name || `Smart contract ${contractName}`,
      version: '1.0.0',
      symbol: token?.symbol || contractName.toUpperCase(),
      address: address,
      contractId: contractId
    },
    functions: {
      'get-balance': {
        result: Math.floor(Math.random() * 1000000).toString(),
        block_height: Math.floor(Math.random() * 100000) + 50000
      },
      'get-total-supply': {
        result: Math.floor(Math.random() * 100000000).toString(),
        block_height: Math.floor(Math.random() * 100000) + 50000
      }
    }
  };
}

/**
 * Generate price data from extracted tokens and contracts
 */
function generatePriceData(tokens: CharismaToken[], contracts: Set<string>) {
  const priceData: Record<string, any> = {};

  // Generate from tokens if we have any
  for (const token of tokens) {
    if (token.symbol && token.symbol !== 'Unknown') {
      const pairKey = `${token.symbol}-USDA`;
      priceData[pairKey] = {
        current: {
          price: token.price?.toString() || (Math.random() * 10).toFixed(6),
          change_24h: token.change24h?.toString() || (Math.random() * 20 - 10).toFixed(2),
          volume_24h: token.volume24h?.toString() || Math.floor(Math.random() * 1000000).toString(),
          market_cap: token.marketCap?.toString() || Math.floor(Math.random() * 10000000).toString(),
          timestamp: new Date().toISOString()
        },
        history: []
      };
    }
  }

  // If no tokens found, generate from known contract names
  if (Object.keys(priceData).length === 0) {
    const knownTokens = [
      'CHA', 'WELSH', 'STX', 'LEO', 'VELAR', 'DME', 'ROO', 'MEME', 
      'NOPE', 'DROID', 'USDA', 'SBTC', 'ALEX', 'PEPE', 'BOB'
    ];

    for (const symbol of knownTokens) {
      const pairKey = `${symbol}-USDA`;
      priceData[pairKey] = {
        current: {
          price: (Math.random() * 10).toFixed(6),
          change_24h: (Math.random() * 20 - 10).toFixed(2),
          volume_24h: Math.floor(Math.random() * 1000000).toString(),
          market_cap: Math.floor(Math.random() * 10000000).toString(),
          timestamp: new Date().toISOString()
        },
        history: []
      };
    }
  }

  return priceData;
}

/**
 * Main seeding function
 */
async function seedCharismaData(): Promise<void> {
  try {
    console.log('🌱 Starting Charisma data seeding...');

    // Extract data from Charisma API
    const { addresses, contracts, tokens } = await extractCharismaData();

    // Prepare data structures
    const addressData: Record<string, any> = {};
    const contractData: Record<string, any> = {};
    
    console.log('📍 Processing addresses...');
    for (const address of addresses) {
      addressData[address] = generateMockBalanceData(address);
    }

    console.log('📄 Processing contracts...');
    for (const contractId of contracts) {
      const token = tokens.find(t => t.contractId === contractId || t.address === contractId.split('.')[0]);
      contractData[contractId] = generateMockContractData(contractId, token);
    }

    console.log('💰 Processing price data...');
    const priceData = generatePriceData(tokens, contracts);

    // Update todo status
    console.log('💾 Saving to blob storage with proper nested structure...');

    // Create batch updates for individual address/contract paths
    const batchUpdates: Array<{ path: string; data: any }> = [];

    // Add individual address balance and transaction data
    for (const [address, data] of Object.entries(addressData)) {
      batchUpdates.push(
        { path: `addresses/${address}/balances`, data: data.balances },
        { path: `addresses/${address}/transactions`, data: data.transactions }
      );
    }

    // Add individual contract metadata and function data  
    for (const [contractId, data] of Object.entries(contractData)) {
      batchUpdates.push(
        { path: `contracts/${contractId}/metadata`, data: data.metadata }
      );
      // Add function data if it exists
      if (data.functions) {
        for (const [funcName, funcData] of Object.entries(data.functions)) {
          batchUpdates.push(
            { path: `contracts/${contractId}/${funcName}`, data: funcData }
          );
        }
      }
    }

    // Add individual price pair data
    for (const [pairKey, data] of Object.entries(priceData)) {
      batchUpdates.push(
        { path: `prices/${pairKey}/current`, data: data.current },
        { path: `prices/${pairKey}/history`, data: data.history }
      );
    }

    console.log(`📦 Prepared ${batchUpdates.length} individual updates...`);
    
    // Use batch update with proper nested paths
    await blobStorageService.putBatch(batchUpdates);
    
    console.log(`✅ Batch saved with nested structure:`);
    console.log(`  - ${addresses.size} addresses (${addresses.size * 2} paths: balances + transactions)`);
    console.log(`  - ${contracts.size} contracts (${Object.values(contractData).reduce((sum, contract) => sum + 1 + (contract.functions ? Object.keys(contract.functions).length : 0), 0)} paths)`);  
    console.log(`  - ${Object.keys(priceData).length} price pairs (${Object.keys(priceData).length * 2} paths: current + history)`);

    // Debug the final state
    const rootBlob = await blobStorageService.getRoot();
    const finalCounts = {
      addresses: Object.keys(rootBlob.addresses || {}).length,
      contracts: Object.keys(rootBlob.contracts || {}).length,
      prices: Object.keys(rootBlob.prices || {}).length
    };

    console.log('🎉 Seeding completed successfully!');
    console.log('Final counts:', finalCounts);

    // Log some examples
    console.log('\n📋 Sample addresses:');
    Array.from(addresses).slice(0, 5).forEach(addr => console.log(`  - ${addr}`));

    console.log('\n📋 Sample contracts:');
    Array.from(contracts).slice(0, 5).forEach(contract => console.log(`  - ${contract}`));

    console.log('\n📋 Sample tokens:');
    tokens.slice(0, 5).forEach(token => 
      console.log(`  - ${token.symbol}: ${token.name}${token.price ? ` ($${token.price})` : ''}`)
    );

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedCharismaData()
    .then(() => {
      console.log('🏁 Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

export { seedCharismaData, extractCharismaData };
#!/usr/bin/env tsx

/**
 * Extract and display Charisma API data without saving to blob storage
 */

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

/**
 * Extract addresses and contract IDs from Charisma API response
 */
async function extractCharismaData(): Promise<{
  addresses: Set<string>;
  contracts: Set<string>;
  tokens: CharismaToken[];
}> {
  console.log('🔍 Fetching Charisma price data...');
  
  const response = await fetch('https://invest.charisma.rocks/api/v1/prices', {
    headers: {
      'User-Agent': 'Charisma-Data-Extractor/1.0',
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Charisma data: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('📊 Data received, processing...');

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

  return { addresses, contracts, tokens };
}

/**
 * Main extraction function
 */
async function main(): Promise<void> {
  try {
    console.log('🎯 Extracting Charisma blockchain data...\n');

    // Extract data from Charisma API
    const { addresses, contracts, tokens } = await extractCharismaData();

    console.log('📈 EXTRACTION RESULTS');
    console.log('='.repeat(50));
    console.log(`🏠 Unique Addresses Found: ${addresses.size}`);
    console.log(`📄 Unique Contracts Found: ${contracts.size}`);
    console.log(`🪙 Token Entries Found: ${tokens.length}\n`);

    if (addresses.size > 0) {
      console.log('🏠 ADDRESSES:');
      console.log('-'.repeat(30));
      Array.from(addresses).sort().forEach((addr, i) => {
        console.log(`${(i + 1).toString().padStart(3, ' ')}. ${addr}`);
      });
      console.log();
    }

    if (contracts.size > 0) {
      console.log('📄 CONTRACTS:');
      console.log('-'.repeat(30));
      Array.from(contracts).sort().forEach((contract, i) => {
        console.log(`${(i + 1).toString().padStart(3, ' ')}. ${contract}`);
      });
      console.log();
    }

    if (tokens.length > 0) {
      console.log('🪙 TOKEN INFO:');
      console.log('-'.repeat(30));
      tokens.forEach((token, i) => {
        const info = [
          token.symbol,
          token.name,
          token.price ? `$${token.price}` : null,
          token.change24h ? `${token.change24h}%` : null
        ].filter(Boolean).join(' | ');
        console.log(`${(i + 1).toString().padStart(3, ' ')}. ${info}`);
      });
      console.log();
    }

    // Group contracts by address
    const contractsByAddress = new Map<string, string[]>();
    for (const contract of contracts) {
      const [address, contractName] = contract.split('.');
      if (!contractsByAddress.has(address)) {
        contractsByAddress.set(address, []);
      }
      contractsByAddress.get(address)!.push(contractName);
    }

    console.log('🏢 CONTRACTS BY ADDRESS:');
    console.log('-'.repeat(40));
    for (const [address, contractNames] of contractsByAddress) {
      console.log(`📍 ${address}`);
      contractNames.forEach(name => {
        console.log(`   └── ${name}`);
      });
      console.log();
    }

    console.log('✅ Extraction completed successfully!');
    console.log('\nTo seed this data into your blob storage, run:');
    console.log('  pnpm script src/scripts/seed-charisma-data.ts');
    console.log('\nMake sure to set your BLOB_READ_WRITE_TOKEN environment variable first.');

  } catch (error) {
    console.error('❌ Extraction failed:', error);
    process.exit(1);
  }
}

// Run the main function
main();
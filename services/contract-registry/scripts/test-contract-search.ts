#!/usr/bin/env tsx

/**
 * Simple Contract Search Test Script
 * 
 * Tests contract search functionality by searching for specific patterns
 * and logging results to the console.
 */

import { ContractRegistry, createDefaultConfig } from '../src/index';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

/**
 * Test basic contract search functionality
 */
async function testContractSearch() {
  console.log('🔍 TESTING CONTRACT SEARCH FUNCTIONALITY');
  console.log('='.repeat(60));

  try {
    // Initialize registry
    const config = createDefaultConfig('mainnet-contract-registry');
    const registry = new ContractRegistry(config);

    console.log('⚙️ Registry initialized successfully');
    console.log('');

    // Test 1: Get all contracts (first 10)
    console.log('📋 Test 1: Getting first 10 contracts...');
    const allContracts = await registry.searchContracts({ limit: 10 });
    
    console.log(`   Found ${allContracts.total} total contracts in registry`);
    console.log(`   Showing first ${allContracts.contracts.length} contracts:`);
    
    allContracts.contracts.forEach((contract, i) => {
      console.log(`   ${i + 1}. ${contract.contractId}`);
      console.log(`      Type: ${contract.contractType} | Status: ${contract.validationStatus}`);
      console.log(`      Traits: [${contract.implementedTraits.join(', ')}]`);
    });
    console.log('');

    // Test 2: Search for token contracts
    console.log('🪙 Test 2: Searching for token contracts...');
    const tokenContracts = await registry.searchContracts({ 
      contractType: 'token', 
      limit: 5 
    });
    
    console.log(`   Found ${tokenContracts.total} token contracts`);
    console.log(`   Showing first ${tokenContracts.contracts.length}:`);
    
    tokenContracts.contracts.forEach((contract, i) => {
      console.log(`   ${i + 1}. ${contract.contractId}`);
      console.log(`      Traits: [${contract.implementedTraits.join(', ')}]`);
    });
    console.log('');

    // Test 3: Search for NFT contracts
    console.log('🎨 Test 3: Searching for NFT contracts...');
    const nftContracts = await registry.searchContracts({ 
      contractType: 'nft', 
      limit: 5 
    });
    
    console.log(`   Found ${nftContracts.total} NFT contracts`);
    console.log(`   Showing first ${nftContracts.contracts.length}:`);
    
    nftContracts.contracts.forEach((contract, i) => {
      console.log(`   ${i + 1}. ${contract.contractId}`);
      console.log(`      Traits: [${contract.implementedTraits.join(', ')}]`);
    });
    console.log('');

    // Test 4: Search for contracts with specific traits
    console.log('🏷️ Test 4: Searching for contracts with SIP010 trait...');
    const sip010Contracts = await registry.searchContracts({ 
      implementedTraits: ['SIP010'], 
      limit: 5 
    });
    
    console.log(`   Found ${sip010Contracts.total} contracts with SIP010 trait`);
    console.log(`   Showing first ${sip010Contracts.contracts.length}:`);
    
    sip010Contracts.contracts.forEach((contract, i) => {
      console.log(`   ${i + 1}. ${contract.contractId}`);
      console.log(`      Type: ${contract.contractType} | All Traits: [${contract.implementedTraits.join(', ')}]`);
    });
    console.log('');

    // Test 5: Search for contracts with SIP009 trait
    console.log('🖼️ Test 5: Searching for contracts with SIP009 trait...');
    const sip009Contracts = await registry.searchContracts({ 
      implementedTraits: ['SIP009'], 
      limit: 5 
    });
    
    console.log(`   Found ${sip009Contracts.total} contracts with SIP009 trait`);
    console.log(`   Showing first ${sip009Contracts.contracts.length}:`);
    
    sip009Contracts.contracts.forEach((contract, i) => {
      console.log(`   ${i + 1}. ${contract.contractId}`);
      console.log(`      Type: ${contract.contractType} | All Traits: [${contract.implementedTraits.join(', ')}]`);
    });
    console.log('');

    // Test 6: Search by validation status
    console.log('✅ Test 6: Searching for valid contracts...');
    const validContracts = await registry.searchContracts({ 
      validationStatus: 'valid', 
      limit: 3 
    });
    
    console.log(`   Found ${validContracts.total} valid contracts`);
    console.log(`   Showing first ${validContracts.contracts.length}:`);
    
    validContracts.contracts.forEach((contract, i) => {
      console.log(`   ${i + 1}. ${contract.contractId}`);
      console.log(`      Type: ${contract.contractType} | Discovered: ${new Date(contract.discoveredAt).toLocaleDateString()}`);
    });
    console.log('');

    // Test 7: Test the new search functionality
    console.log('🔎 Test 7: Testing text search functionality...');
    const searchResults = await registry.searchContracts({ 
      search: 'alex', 
      limit: 3 
    });
    
    console.log(`   Found ${searchResults.total} contracts matching 'alex'`);
    console.log(`   Showing first ${searchResults.contracts.length}:`);
    
    searchResults.contracts.forEach((contract, i) => {
      console.log(`   ${i + 1}. ${contract.contractId}`);
      console.log(`      Name: ${contract.contractName || 'N/A'} | Type: ${contract.contractType}`);
    });
    console.log('');

    // Summary
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total contracts in registry: ${allContracts.total}`);
    console.log(`Token contracts: ${tokenContracts.total}`);
    console.log(`NFT contracts: ${nftContracts.total}`);
    console.log(`SIP010 contracts: ${sip010Contracts.total}`);
    console.log(`SIP009 contracts: ${sip009Contracts.total}`);
    console.log(`Valid contracts: ${validContracts.total}`);
    console.log(`Contracts matching 'alex': ${searchResults.total}`);

  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
}

/**
 * Test trait-based discovery directly
 */
async function testTraitDiscovery() {
  console.log('\n🧪 TESTING TRAIT-BASED DISCOVERY');
  console.log('='.repeat(60));

  try {
    // Initialize registry with discovery enabled
    const config = createDefaultConfig('mainnet-contract-registry');
    config.enableDiscovery = true;
    const registry = new ContractRegistry(config);

    console.log('⚙️ Registry initialized with discovery enabled');

    // Test simple trait discovery configuration - very basic transfer function
    const simpleTraitConfig = {
      traits: [{
        trait: {
          name: 'Any Transfer Function',
          description: 'Any function named transfer',
          functions: [{
            name: "transfer",
            access: "public" as const,
            args: [],  // No specific args - just look for any transfer function
            outputs: {
              type: "any"  // Any output type
            }
          }]
        },
        enabled: true,
        priority: 1,
        batchSize: 10
      }],
      sipStandards: [],
      apiScan: { 
        enabled: false, 
        batchSize: 10, 
        maxRetries: 1, 
        retryDelay: 500, 
        timeout: 5000,  // Reduced from 15s to 5s
        blacklist: [] 
      }
    };

    console.log('🔍 Testing simple trait discovery...');
    console.log('   Looking for contracts with transfer functions...');
    console.log('   This may take a moment...');
    
    console.log('\n📋 Discovery Configuration:');
    console.log(`   • Traits: ${simpleTraitConfig.traits?.length || 0}`);
    console.log(`   • SIP Standards: ${simpleTraitConfig.sipStandards?.length || 0}`);
    console.log(`   • Batch Size: ${simpleTraitConfig.traits?.[0]?.batchSize || 'N/A'}`);
    console.log('');
    
    console.log('⏳ Starting discovery process...');
    const startTime = Date.now();
    const discoveryResult = await registry.discoverContracts(simpleTraitConfig);
    const endTime = Date.now();
    
    console.log(`✅ Discovery completed in ${((endTime - startTime) / 1000).toFixed(2)}s`);
    console.log('');
    
    console.log('📋 Discovery Results:');
    console.log(`   Success: ${discoveryResult.success}`);
    console.log(`   Duration: ${(discoveryResult.duration / 1000).toFixed(2)}s`);
    console.log(`   Contracts Found: ${discoveryResult.totalContractsFound}`);
    console.log(`   Contracts Processed: ${discoveryResult.totalContractsProcessed}`);
    console.log(`   Contracts Added: ${discoveryResult.totalContractsAdded}`);
    console.log(`   Total Errors: ${discoveryResult.errors?.length || 0}`);

    if (discoveryResult.results && discoveryResult.results.length > 0) {
      console.log('\n🎯 Individual Discovery Methods:');
      discoveryResult.results.forEach((result, i) => {
        console.log(`   ${i + 1}. Method: ${result.method}`);
        console.log(`      ✓ Found: ${result.contractsFound} | Processed: ${result.contractsProcessed} | Added: ${result.contractsAdded}`);
        console.log(`      ✓ Success: ${result.success} | Duration: ${(result.duration / 1000).toFixed(2)}s`);
        if (result.newContracts && result.newContracts.length > 0) {
          console.log(`      📝 New contracts: ${result.newContracts.slice(0, 3).join(', ')}${result.newContracts.length > 3 ? ` (and ${result.newContracts.length - 3} more)` : ''}`);
        }
        if (result.errors && result.errors.length > 0) {
          console.log(`      ❌ Errors: ${result.errors.slice(0, 2).join(' | ')}${result.errors.length > 2 ? ` (and ${result.errors.length - 2} more)` : ''}`);
        }
        console.log('');
      });
    }

    if (discoveryResult.errors && discoveryResult.errors.length > 0) {
      console.log('⚠️ Overall Discovery Errors:');
      discoveryResult.errors.slice(0, 5).forEach((error, i) => {
        console.log(`   ${i + 1}. ${error}`);
      });
      if (discoveryResult.errors.length > 5) {
        console.log(`   ... and ${discoveryResult.errors.length - 5} more errors`);
      }
    } else {
      console.log('✅ No overall errors encountered during discovery');
    }

  } catch (error) {
    console.error('❌ Trait discovery test failed:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack.split('\n').slice(0, 5).join('\n'));
    }
  }
}

/**
 * Test with 10 different trait syntax variations
 */
async function testMultipleTraitSyntax() {
  console.log('\n🔬 TESTING 10 DIFFERENT TRAIT SYNTAX VARIATIONS');
  console.log('='.repeat(80));

  const config = createDefaultConfig('mainnet-contract-registry');
  config.enableDiscovery = true;
  const registry = new ContractRegistry(config);

  // Array of different trait configurations to test
  const traitVariations = [
    {
      name: 'Basic get-name (minimal)',
      config: {
        traits: [{
          trait: {
            name: 'Get Name',
            description: 'Get name function',
            functions: [{
              name: "get-name",
              access: "read_only",
              args: [],
              outputs: { type: "string" }
            }]
          },
          enabled: true,
          priority: 1,
          batchSize: 1
        }]
      }
    },
    {
      name: 'Get-name with response wrapper',
      config: {
        traits: [{
          trait: {
            name: 'Get Name Response',
            description: 'Get name with response',
            functions: [{
              name: "get-name",
              access: "read_only",
              args: [],
              outputs: {
                type: {
                  response: {
                    ok: "string",
                    error: "none"
                  }
                }
              }
            }]
          },
          enabled: true,
          priority: 1,
          batchSize: 1
        }]
      }
    },
    {
      name: 'Get-name with string-ascii',
      config: {
        traits: [{
          trait: {
            name: 'Get Name ASCII',
            description: 'Get name ASCII string',
            functions: [{
              name: "get-name",
              access: "read_only",
              args: [],
              outputs: {
                type: {
                  response: {
                    ok: { "string-ascii": { length: 32 } },
                    error: "none"
                  }
                }
              }
            }]
          },
          enabled: true,
          priority: 1,
          batchSize: 1
        }]
      }
    },
    {
      name: 'Transfer basic',
      config: {
        traits: [{
          trait: {
            name: 'Transfer Basic',
            description: 'Basic transfer',
            functions: [{
              name: "transfer",
              access: "public",
              args: [
                { name: "amount", type: "uint128" },
                { name: "sender", type: "principal" },
                { name: "recipient", type: "principal" }
              ],
              outputs: { type: "bool" }
            }]
          },
          enabled: true,
          priority: 1,
          batchSize: 1
        }]
      }
    },
    {
      name: 'Transfer with response',
      config: {
        traits: [{
          trait: {
            name: 'Transfer Response',
            description: 'Transfer with response',
            functions: [{
              name: "transfer",
              access: "public",
              args: [
                { name: "amount", type: "uint128" },
                { name: "sender", type: "principal" },
                { name: "recipient", type: "principal" }
              ],
              outputs: {
                type: {
                  response: {
                    ok: "bool",
                    error: "uint128"
                  }
                }
              }
            }]
          },
          enabled: true,
          priority: 1,
          batchSize: 1
        }]
      }
    },
    {
      name: 'Transfer with memo',
      config: {
        traits: [{
          trait: {
            name: 'Transfer Memo',
            description: 'Transfer with memo',
            functions: [{
              name: "transfer",
              access: "public",
              args: [
                { name: "amount", type: "uint128" },
                { name: "sender", type: "principal" },
                { name: "recipient", type: "principal" },
                { name: "memo", type: { optional: { buffer: { length: 34 } } } }
              ],
              outputs: {
                type: {
                  response: {
                    ok: "bool",
                    error: "uint128"
                  }
                }
              }
            }]
          },
          enabled: true,
          priority: 1,
          batchSize: 1
        }]
      }
    },
    {
      name: 'Get-balance simple',
      config: {
        traits: [{
          trait: {
            name: 'Get Balance',
            description: 'Get balance function',
            functions: [{
              name: "get-balance",
              access: "read_only",
              args: [
                { name: "account", type: "principal" }
              ],
              outputs: { type: "uint128" }
            }]
          },
          enabled: true,
          priority: 1,
          batchSize: 1
        }]
      }
    },
    {
      name: 'Get-balance with response',
      config: {
        traits: [{
          trait: {
            name: 'Get Balance Response',
            description: 'Get balance with response',
            functions: [{
              name: "get-balance",
              access: "read_only",
              args: [
                { name: "account", type: "principal" }
              ],
              outputs: {
                type: {
                  response: {
                    ok: "uint128",
                    error: "none"
                  }
                }
              }
            }]
          },
          enabled: true,
          priority: 1,
          batchSize: 1
        }]
      }
    },
    {
      name: 'Mint simple',
      config: {
        traits: [{
          trait: {
            name: 'Mint Simple',
            description: 'Simple mint function',
            functions: [{
              name: "mint",
              access: "public",
              args: [
                { name: "amount", type: "uint128" },
                { name: "recipient", type: "principal" }
              ],
              outputs: { type: "bool" }
            }]
          },
          enabled: true,
          priority: 1,
          batchSize: 1
        }]
      }
    },
    {
      name: 'Any function (wildcard)',
      config: {
        traits: [{
          trait: {
            name: 'Any Function',
            description: 'Match any function',
            functions: [{
              name: "*",  // Wildcard
              access: "public",
              args: [],
              outputs: { type: "*" }  // Wildcard
            }]
          },
          enabled: true,
          priority: 1,
          batchSize: 1
        }]
      }
    }
  ];

  const testLimit = 3; // Limit to first 3 for faster testing
  console.log(`🧪 Testing ${testLimit} different trait syntax patterns...\n`);

  for (let i = 0; i < Math.min(testLimit, traitVariations.length); i++) {
    const variation = traitVariations[i];
    console.log(`${String(i + 1).padStart(2)}/${testLimit}: ${variation.name}`);
    
    try {
      const fullConfig = {
        ...variation.config,
        sipStandards: [],
        apiScan: { enabled: false, batchSize: 1, maxRetries: 1, retryDelay: 100, timeout: 1000, blacklist: [] }
      };

      const startTime = Date.now();
      const result = await registry.discoverContracts(fullConfig);
      const duration = Date.now() - startTime;
      
      console.log(`      ⏱️  ${(duration/1000).toFixed(2)}s | 📊 Found: ${result.totalContractsFound} | Processed: ${result.totalContractsProcessed} | Added: ${result.totalContractsAdded}`);
      
      if (result.totalContractsFound > 0) {
        console.log(`      🎯 SUCCESS! This pattern found contracts!`);
        if (result.results && result.results[0] && result.results[0].newContracts) {
          const sample = result.results[0].newContracts.slice(0, 3);
          console.log(`      📝 Sample contracts: ${sample.join(', ')}`);
        }
      }
      
      if (result.errors && result.errors.length > 0) {
        console.log(`      ⚠️  ${result.errors.length} errors: ${result.errors[0]}`);
      }
      
    } catch (error) {
      console.log(`      ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    console.log(''); // Empty line between tests
  }

  console.log('✅ All trait syntax variations tested');
}

/**
 * Test with even simpler trait patterns (for backward compatibility)
 */
async function testSuperSimpleTraits() {
  console.log('\n🔬 TESTING SUPER SIMPLE TRAITS');
  console.log('='.repeat(60));
  
  // Just run a subset of the multiple trait syntax test
  await testMultipleTraitSyntax();
}

/**
 * Main execution function
 */
async function main() {
  console.log('🧪 CONTRACT REGISTRY TEST SUITE');
  console.log('=' .repeat(80));

  // Parse command line arguments
  const args = process.argv.slice(2);
  const testDiscovery = args.includes('--discovery') || args.includes('-d');
  const testSearch = args.includes('--search') || args.includes('-s');
  const testSimple = args.includes('--simple') || args.includes('--simple-traits');
  const testMultiple = args.includes('--multiple') || args.includes('--multi') || args.includes('-m');

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: tsx test-contract-search.ts [options]

Options:
  --search, -s        Test contract search functionality (default)
  --discovery, -d     Test trait-based discovery functionality
  --simple            Test very simple trait patterns (fast)
  --multiple, -m      Test 10 different trait syntax variations
  --help, -h          Show this help message

Examples:
  tsx test-contract-search.ts                    # Test search functionality
  tsx test-contract-search.ts --search           # Test search functionality  
  tsx test-contract-search.ts --discovery        # Test discovery functionality
  tsx test-contract-search.ts --simple           # Test simple traits (fastest)
  tsx test-contract-search.ts --multiple         # Test multiple trait syntaxes
  tsx test-contract-search.ts -s -d              # Test both search and discovery
`);
    process.exit(0);
  }

  try {
    // Default to testing search if no specific test is requested
    if (!testDiscovery && !testSearch && !testSimple && !testMultiple) {
      await testContractSearch();
    } else {
      if (testSearch) {
        await testContractSearch();
      }
      if (testDiscovery) {
        await testTraitDiscovery();
      }
      if (testSimple) {
        await testSuperSimpleTraits();
      }
      if (testMultiple) {
        await testMultipleTraitSyntax();
      }
    }

    console.log('\n✅ All tests completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test suite failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️ Tests interrupted by user');
  process.exit(0);
});

// Run the main function
main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
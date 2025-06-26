#!/usr/bin/env tsx

/**
 * Script to test getContractInfo from @packages/polyglot
 * Usage: pnpm script test-contract-info.ts [contract_id]
 */

import { getContractInfo, getContractInfoWithParsedAbi, parseContractAbi } from '@repo/polyglot';

async function testGetContractInfo() {
  // Get contract ID from command line arguments or use default
  const contractId = process.argv[2] || 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';
  
  console.log(`Testing getContractInfo with contract: ${contractId}\n`);
  
  try {
    const result = await getContractInfo(contractId);
    
    if (result) {
      console.log('=== FULL UNEDITED RESPONSE ===');
      console.log(JSON.stringify(result, null, 2));
      console.log('\n=== RESPONSE SUMMARY ===');
      console.log(`Contract ID: ${result.contract_id}`);
      console.log(`Transaction ID: ${result.tx_id}`);
      console.log(`Block Height: ${result.block_height}`);
      console.log(`Canonical: ${result.canonical}`);
      console.log(`Clarity Version: ${result.clarity_version}`);
      console.log(`Source Code Length: ${result.source_code?.length || 0} characters`);
      console.log(`ABI Length: ${result.abi?.length || 0} characters`);
      
      // Test the parsed ABI functionality
      console.log('\n=== TESTING PARSED ABI ===');
      const parsedAbi = parseContractAbi(result.abi);
      if (parsedAbi) {
        console.log(`Functions: ${parsedAbi.functions.length}`);
        console.log(`Variables: ${parsedAbi.variables.length}`);
        console.log(`Maps: ${parsedAbi.maps.length}`);
        console.log(`Fungible Tokens: ${parsedAbi.fungible_tokens.length}`);
        console.log(`Non-Fungible Tokens: ${parsedAbi.non_fungible_tokens.length}`);
        console.log(`Epoch: ${parsedAbi.epoch}`);
        console.log(`Clarity Version: ${parsedAbi.clarity_version}`);
        
        // Show function names
        if (parsedAbi.functions.length > 0) {
          console.log('\nPublic Functions:');
          parsedAbi.functions
            .filter(f => f.access === 'public')
            .slice(0, 5) // Show first 5
            .forEach(f => console.log(`  - ${f.name} (${f.args.length} args)`));
          
          if (parsedAbi.functions.filter(f => f.access === 'public').length > 5) {
            console.log(`  ... and ${parsedAbi.functions.filter(f => f.access === 'public').length - 5} more`);
          }
        }
      } else {
        console.log('Failed to parse ABI');
      }
      
      // Test the enhanced function
      console.log('\n=== TESTING ENHANCED FUNCTION ===');
      const enhancedResult = await getContractInfoWithParsedAbi(contractId);
      if (enhancedResult && enhancedResult.parsed_abi) {
        console.log('Enhanced function with parsed ABI works correctly!');
        console.log(`Has parsed ABI: ${enhancedResult.parsed_abi !== null}`);
      }
      
    } else {
      console.log('Contract not found or error occurred');
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    console.error('Full error:', error);
  }
}

// Run the test
testGetContractInfo().catch(console.error);
#!/usr/bin/env tsx

/**
 * Show SIP010 Contracts - Display a random selection of SIP010 contracts from the registry
 */

import { ContractRegistry, createDefaultConfig } from '../src/index';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function showSIP010Contracts() {
  console.log('🪙 SIP010 CONTRACTS SAMPLE');
  console.log('='.repeat(60));

  try {
    const config = createDefaultConfig('mainnet-contract-registry');
    const registry = new ContractRegistry(config);

    console.log('✅ Registry initialized');
    
    // Get all contracts with SIP010 trait
    console.log('\n🔍 Searching for SIP010 contracts...');
    const sip010Contracts = await registry.searchContracts({ 
      implementedTraits: ['SIP010'], 
      limit: 50  // Get more than we need so we can randomize
    });

    console.log(`📊 Found ${sip010Contracts.total} SIP010 contracts total`);
    console.log(`📋 Retrieved ${sip010Contracts.contracts.length} for sampling`);

    if (sip010Contracts.contracts.length === 0) {
      console.log('❌ No SIP010 contracts found in the registry');
      return;
    }

    // Randomly select 20 contracts (or all if less than 20)
    const sampleSize = Math.min(20, sip010Contracts.contracts.length);
    const shuffled = [...sip010Contracts.contracts].sort(() => Math.random() - 0.5);
    const selectedContracts = shuffled.slice(0, sampleSize);

    console.log(`\n🎲 Random sample of ${selectedContracts.length} SIP010 contracts:\n`);

    for (let i = 0; i < selectedContracts.length; i++) {
      const contract = selectedContracts[i];
      console.log(`${String(i + 1).padStart(2)}/20: ${contract.contractId}`);
      console.log(`      Name: ${contract.contractName || 'N/A'}`);
      console.log(`      Type: ${contract.contractType}`);
      console.log(`      Status: ${contract.validationStatus}`);
      console.log(`      Traits: [${contract.implementedTraits.join(', ')}]`);
      console.log(`      Discovered: ${new Date(contract.discoveredAt).toLocaleDateString()}`);
      console.log(`      Method: ${contract.discoveryMethod}`);
      
      // Show ABI structure if available
      if (contract.abi) {
        try {
          let abiData;
          if (typeof contract.abi === 'string') {
            abiData = JSON.parse(contract.abi);
          } else {
            abiData = contract.abi;
          }

          if (abiData && abiData.functions) {
            const functions = abiData.functions.slice(0, 3); // Show first 3 functions
            console.log(`      Functions (first 3):`);
            functions.forEach((func: any) => {
              const args = func.args ? func.args.map((arg: any) => `${arg.name}: ${typeof arg.type === 'string' ? arg.type : JSON.stringify(arg.type).substring(0, 20)}`).join(', ') : '';
              const output = typeof func.outputs?.type === 'string' ? func.outputs.type : JSON.stringify(func.outputs?.type).substring(0, 30);
              console.log(`        • ${func.name}(${args}) -> ${output}`);
            });
            if (abiData.functions.length > 3) {
              console.log(`        ... and ${abiData.functions.length - 3} more functions`);
            }
          }
        } catch (error) {
          console.log(`      ABI: [Error parsing - ${contract.abi.substring(0, 50)}...]`);
        }
      } else {
        console.log(`      ABI: Not available`);
      }

      // Show source code snippet if available
      if (contract.sourceCode) {
        const sourceLines = contract.sourceCode.split('\n');
        const transferFunction = sourceLines.find(line => 
          line.includes('define-public') && line.includes('transfer')
        );
        if (transferFunction) {
          console.log(`      Transfer function: ${transferFunction.trim().substring(0, 80)}...`);
        } else {
          console.log(`      Source: ${sourceLines.length} lines available`);
        }
      }

      // Show token metadata if available
      if (contract.tokenMetadata) {
        const metadata = contract.tokenMetadata;
        console.log(`      Token Info: ${metadata.name || 'N/A'} (${metadata.symbol || 'N/A'})`);
        if (metadata.decimals !== undefined) {
          console.log(`      Decimals: ${metadata.decimals}`);
        }
      }

      console.log(''); // Empty line between contracts
    }

    // Summary of what we found
    console.log('🔍 ANALYSIS SUMMARY:');
    console.log(`   • Total SIP010 contracts in registry: ${sip010Contracts.total}`);
    console.log(`   • Sample size: ${selectedContracts.length}`);
    
    const withABI = selectedContracts.filter(c => c.abi).length;
    const withSource = selectedContracts.filter(c => c.sourceCode).length;
    const withTokenMetadata = selectedContracts.filter(c => c.tokenMetadata).length;
    
    console.log(`   • Contracts with ABI: ${withABI}/${selectedContracts.length}`);
    console.log(`   • Contracts with source code: ${withSource}/${selectedContracts.length}`);
    console.log(`   • Contracts with token metadata: ${withTokenMetadata}/${selectedContracts.length}`);

    // Show discovery methods
    const discoveryMethods = selectedContracts.reduce((acc: Record<string, number>, contract) => {
      acc[contract.discoveryMethod] = (acc[contract.discoveryMethod] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`   • Discovery methods used:`);
    Object.entries(discoveryMethods).forEach(([method, count]) => {
      console.log(`     - ${method}: ${count} contracts`);
    });

  } catch (error) {
    console.error('❌ Failed to show SIP010 contracts:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('Stack:', error.stack.split('\n').slice(0, 5).join('\n'));
    }
  }
}

// Run the script
showSIP010Contracts().then(() => {
  console.log('\n✅ SIP010 contract analysis completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
/**
 * Get the actual SIP-010 trait ABI to understand the format
 */

import { getContractInfoWithParsedAbi } from '@repo/polyglot';

async function getSipTraitAbi() {
  // Test both the trait definition and a real implementation
  const contracts = [
    'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard', // The trait itself
    'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-token' // A real implementation
  ];
  
  for (const contractId of contracts) {
    console.log(`\n🔍 Getting ${contractId} ABI...`);
  
  try {
    const contractInfo = await getContractInfoWithParsedAbi(contractId);
    
    if (contractInfo && contractInfo.parsed_abi) {
      console.log('✅ Success! Here is the SIP-010 trait structure:');
      
      // Show overall structure
      console.log('\n📋 ABI Structure:');
      console.log('- Functions:', contractInfo.parsed_abi.functions?.length || 0);
      console.log('- Variables:', contractInfo.parsed_abi.variables?.length || 0);
      console.log('- Maps:', contractInfo.parsed_abi.maps?.length || 0);
      console.log('- Fungible tokens:', contractInfo.parsed_abi.fungible_tokens?.length || 0);
      console.log('- Non-fungible tokens:', contractInfo.parsed_abi.non_fungible_tokens?.length || 0);
      
      // Show trait definitions if any
      if (contractInfo.parsed_abi.traits) {
        console.log('\n🎯 Trait definitions found:');
        contractInfo.parsed_abi.traits.forEach((trait: any, index: number) => {
          console.log(`\nTrait ${index + 1}:`);
          console.log(JSON.stringify(trait, null, 2));
        });
      }
      
      // Show function definitions
      if (contractInfo.parsed_abi.functions) {
        console.log('\n🔧 Functions:');
        contractInfo.parsed_abi.functions.forEach((func: any, index: number) => {
          console.log(`\n${index + 1}. ${func.name} (${func.access})`);
          console.log('   Args:', func.args?.map((arg: any) => `${arg.name}: ${arg.type}`).join(', ') || 'none');
          console.log('   Output:', func.outputs?.type || 'none');
        });
      }
      
      // Full structure for debugging
      console.log('\n📄 Full parsed ABI structure (first 3 levels):');
      console.log(JSON.stringify(contractInfo.parsed_abi, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          const depth = (key.match(/\./g) || []).length;
          if (depth > 2) return '[Object]';
        }
        return value;
      }, 2));
      
    } else {
      console.log('❌ No contract info or parsed ABI found');
    }
    
  } catch (error) {
    console.log('❌ Error:', error);
  }
  }
}

getSipTraitAbi().catch(console.error);
#!/usr/bin/env tsx

/**
 * Validate SIP Compliance - Test if our current validation properly checks function signatures
 */

import { ContractRegistry, createDefaultConfig } from '../src/index';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Expected SIP010 function signatures based on charisma-traits-v1.clar
const SIP010_SIGNATURES = {
  'transfer': {
    access: 'public',
    args: [
      { name: 'amount', type: 'uint' }, // Note: uint not uint128 in real contracts
      { name: 'sender', type: 'principal' },
      { name: 'recipient', type: 'principal' },
      { name: 'memo', type: { optional: { buffer: { length: 34 } } } }
    ],
    outputs: { type: { response: { ok: 'bool', error: 'uint' } } }
  },
  'get-name': {
    access: 'read_only',
    args: [],
    outputs: { type: { response: { ok: { 'string-ascii': { length: 32 } }, error: 'uint' } } }
  },
  'get-symbol': {
    access: 'read_only', 
    args: [],
    outputs: { type: { response: { ok: { 'string-ascii': { length: 32 } }, error: 'uint' } } }
  },
  'get-decimals': {
    access: 'read_only',
    args: [],
    outputs: { type: { response: { ok: 'uint', error: 'uint' } } }
  },
  'get-balance': {
    access: 'read_only',
    args: [{ name: 'account', type: 'principal' }],
    outputs: { type: { response: { ok: 'uint', error: 'uint' } } }
  },
  'get-total-supply': {
    access: 'read_only',
    args: [],
    outputs: { type: { response: { ok: 'uint', error: 'uint' } } }
  }
};

// Expected SIP009 function signatures based on charisma-traits-v1.clar  
const SIP009_SIGNATURES = {
  'get-last-token-id': {
    access: 'read_only',
    args: [],
    outputs: { type: { response: { ok: 'uint', error: 'uint' } } }
  },
  'get-token-uri': {
    access: 'read_only',
    args: [{ name: 'token-id', type: 'uint' }],
    outputs: { type: { response: { ok: { optional: { 'string-ascii': { length: 256 } } }, error: 'uint' } } }
  },
  'get-owner': {
    access: 'read_only',
    args: [{ name: 'token-id', type: 'uint' }],
    outputs: { type: { response: { ok: { optional: 'principal' }, error: 'uint' } } }
  },
  'transfer': {
    access: 'public',
    args: [
      { name: 'token-id', type: 'uint' },
      { name: 'sender', type: 'principal' },
      { name: 'recipient', type: 'principal' }
    ],
    outputs: { type: { response: { ok: 'bool', error: 'uint' } } }
  }
};

async function validateSipCompliance() {
  console.log('🔍 VALIDATING SIP COMPLIANCE');
  console.log('='.repeat(50));

  const config = createDefaultConfig('mainnet-contract-registry');
  const registry = new ContractRegistry(config);

  console.log('✅ Registry initialized\n');

  // Get some existing SIP010 contracts to validate
  console.log('🪙 Testing SIP010 contract compliance...');
  const sip010Contracts = await registry.searchContracts({ 
    implementedTraits: ['SIP010'], 
    limit: 5 
  });

  console.log(`📊 Found ${sip010Contracts.contracts.length} SIP010 contracts to validate\n`);

  for (let i = 0; i < Math.min(3, sip010Contracts.contracts.length); i++) {
    const contract = sip010Contracts.contracts[i];
    console.log(`${i+1}. Validating ${contract.contractId}`);
    
    if (contract.abi) {
      let abi;
      try {
        abi = typeof contract.abi === 'string' ? JSON.parse(contract.abi) : contract.abi;
      } catch (error) {
        console.log(`   ❌ Invalid ABI format`);
        continue;
      }

      console.log(`   📋 Functions found: ${abi.functions?.length || 0}`);
      
      // Check each required SIP010 function
      let compliantFunctions = 0;
      let totalRequired = Object.keys(SIP010_SIGNATURES).length;
      
      for (const [funcName, expectedSig] of Object.entries(SIP010_SIGNATURES)) {
        const actualFunc = abi.functions?.find((f: any) => f.name === funcName);
        
        if (!actualFunc) {
          console.log(`   ❌ Missing function: ${funcName}`);
          continue;
        }
        
        // Check basic properties
        const accessMatch = actualFunc.access === expectedSig.access;
        const argsCountMatch = (actualFunc.args?.length || 0) === expectedSig.args.length;
        
        if (accessMatch && argsCountMatch) {
          console.log(`   ✅ ${funcName}: access=${actualFunc.access}, args=${actualFunc.args?.length || 0}`);
          compliantFunctions++;
        } else {
          console.log(`   ⚠️  ${funcName}: access=${actualFunc.access} (expected ${expectedSig.access}), args=${actualFunc.args?.length || 0} (expected ${expectedSig.args.length})`);
        }
      }
      
      const complianceScore = compliantFunctions / totalRequired;
      console.log(`   📊 Compliance: ${compliantFunctions}/${totalRequired} (${(complianceScore * 100).toFixed(1)}%)`);
      
      if (complianceScore === 1.0) {
        console.log(`   🎯 FULLY COMPLIANT`);
      } else if (complianceScore >= 0.8) {
        console.log(`   ⚠️  MOSTLY COMPLIANT (may have signature variations)`);
      } else {
        console.log(`   ❌ NON-COMPLIANT (should not be tagged as SIP010)`);
      }
    } else {
      console.log(`   ❌ No ABI available for validation`);
    }
    
    console.log('');
  }

  // Test one known SIP010 contract in detail
  console.log('🔬 DETAILED SIGNATURE ANALYSIS');
  if (sip010Contracts.contracts.length > 0) {
    const testContract = sip010Contracts.contracts[0];
    console.log(`Contract: ${testContract.contractId}\n`);
    
    if (testContract.abi) {
      let abi;
      try {
        abi = typeof testContract.abi === 'string' ? JSON.parse(testContract.abi) : testContract.abi;
      } catch (error) {
        console.log(`❌ Invalid ABI format`);
        return;
      }

      const transferFunc = abi.functions?.find((f: any) => f.name === 'transfer');
      if (transferFunc) {
        console.log(`Transfer function signature:`);
        console.log(`   Access: ${transferFunc.access}`);
        console.log(`   Args: ${JSON.stringify(transferFunc.args, null, 2)}`);
        console.log(`   Outputs: ${JSON.stringify(transferFunc.outputs, null, 2)}`);
        
        console.log(`\nExpected SIP010 transfer signature:`);
        console.log(`   Access: ${SIP010_SIGNATURES.transfer.access}`);
        console.log(`   Args: ${JSON.stringify(SIP010_SIGNATURES.transfer.args, null, 2)}`);
        console.log(`   Outputs: ${JSON.stringify(SIP010_SIGNATURES.transfer.outputs, null, 2)}`);
      }
    }
  }

  console.log('\n📋 RECOMMENDATIONS:');
  console.log('   1. Current validation only checks function NAMES, not SIGNATURES');
  console.log('   2. Need to add signature validation to prevent false positives');
  console.log('   3. Should validate argument types, counts, and return types');
  console.log('   4. Consider stricter compliance thresholds');

  console.log('\n✅ SIP compliance validation completed');
}

// Run the validation
validateSipCompliance().then(() => {
  console.log('\n✅ All compliance tests completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});
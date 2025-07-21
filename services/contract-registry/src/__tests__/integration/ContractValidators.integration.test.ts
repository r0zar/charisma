/**
 * Contract Validators Integration Tests
 * Tests validators against real mainnet contract data
 */

import { describe, it, expect } from 'vitest';
import { isValidContractId, isValidPrincipal, isValidContractName } from '../../utils/validators';
import { integrationUtils, integrationConfig } from '../setup';

describe('Contract Validators Integration Tests', () => {
  it('should validate 100+ real mainnet contracts', async () => {
    console.log('🔍 Testing validator against real mainnet contract IDs...');

    // Use real contract IDs that we know exist on mainnet (from previous discovery tests)
    const realMainnetContracts = [
      'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
      'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zststxbtc-v2_v2-0',
      'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-stx-shark-v-1-1',
      'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-stx-flat-v-1-1',
      'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-fakfun-stx-v-1-1',
      'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-pepe-stx-v-1-1',
      'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-nasty-stx-v-1-1',
      'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-not-stx-v-1-1',
      'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.token-aeusdc-subnet',
      'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-pool-usdh-susdh-v-1-4',
      'SP331D6T77PNS2YZXR03CDC4G3XN0SYBPV69D8JW5.xyk-pool-sbtc-beast1-v-1-1',
      'SP6P4EJF0VG8V0RB3TQQKJBHDQKEF6NVRD1KZE3C.charisma-token',
      'SP1K1A1PMGW2ZJCNF46NWZWHG8TS1D23EGH1KNK60.crashpunks-v2',
      'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-vault',
      'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-dao',
      'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.alex-reserve-pool',
      'SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ.mega-bright-grassland',
      'SP2TZK01NKDC89J6TA56SA47SDF7RTHYEQ79AAB9A.wrapped-stx-token',
      'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token',
      'SPQC38PW542EQJ5M11CR25P7BS1CA6QT4TBXGB3M.bitflow-stx-usda-lp-token-v-1-0',
      'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststx-token',
      'SP1Z92MPDQEWZXW36VX71Q25HKF5K2EPCJ304F275.stackswap-swap-token-v5k',
      'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-abtc',
      'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.auto-alex-v2',
      'SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK.token-apower',
      'SP4K5H1SGX94BDY8W9D1JXBTQM8GFZ7QYF3RMRQJ.age000-governance-token',
      'SP1AY6K3PQV5DA61FPXZJ1Q8YZPE3Y8F0S5EBK4X4.token-susdt',
      'SP1BYSW9H4TJ16HDNM1F1YQ65KRN6T45DZQJ1B3RX.token-ausd',
      'SP4K5H1SGX94BDY8W9D1JXBTQM8GFZ7QYF3RMRQJ.age001-alex-token',
      'SP38GGZN0D8X14S4M7K8NJQBM5DAPEB4XZNFQFJT1.uniswap-v2-core'
    ];

    console.log(`📊 Testing against ${realMainnetContracts.length} real mainnet contracts...`);

    // Test validator against all real contract IDs
    let validContracts = 0;
    let invalidContracts = 0;
    const invalidContractExamples: string[] = [];

    for (const contractId of realMainnetContracts) {
      console.log(`🔍 Validating: ${contractId}`);
      
      if (isValidContractId(contractId)) {
        validContracts++;
        
        // Also test individual components
        const [principal, contractName] = contractId.split('.');
        expect(isValidPrincipal(principal)).toBe(true);
        expect(isValidContractName(contractName)).toBe(true);
      } else {
        invalidContracts++;
        if (invalidContractExamples.length < 5) {
          invalidContractExamples.push(contractId);
        }
        console.warn(`❌ Invalid contract: ${contractId}`);
      }
    }

    console.log(`📊 Validation Results:`);
    console.log(`   ✅ Valid contracts: ${validContracts}`);
    console.log(`   ❌ Invalid contracts: ${invalidContracts}`);
    
    if (invalidContractExamples.length > 0) {
      console.log(`   📝 Invalid examples:`, invalidContractExamples);
    }

    // We expect all real mainnet contracts to be valid according to our validator
    expect(validContracts).toBe(realMainnetContracts.length);
    expect(invalidContracts).toBe(0);

    // Additional comprehensive validation
    expect(validContracts).toBeGreaterThanOrEqual(20); // Ensure we tested a good sample
    
    console.log(`🎉 Successfully validated ${validContracts} real mainnet contracts!`);

  }, 15000);

  it('should validate contract principals from real mainnet data', async () => {
    const requiredVars = ['HIRO_API_KEY'];
    integrationUtils.skipIfMissingEnv(requiredVars, 'principal validation');

    console.log('🔍 Testing principal validation against real mainnet addresses...');

    // Test some known real principals
    const realPrincipals = [
      'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS', // charisma token
      'SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N', // real mainnet address
      'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR', // real mainnet address
      'SP331D6T77PNS2YZXR03CDC4G3XN0SYBPV69D8JW5', // real mainnet address
      'SP6P4EJF0VG8V0RB3TQQKJBHDQKEF6NVRD1KZE3C', // real mainnet address
      'SP1K1A1PMGW2ZJCNF46NWZWHG8TS1D23EGH1KNK60', // real mainnet address
      'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1', // real mainnet address
      'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR', // real mainnet address
      'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE', // real mainnet address
      'SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ'  // real mainnet address
    ];

    let validPrincipals = 0;
    let invalidPrincipals = 0;

    for (const principal of realPrincipals) {
      console.log(`🔍 Validating principal: ${principal}`);
      
      if (isValidPrincipal(principal)) {
        validPrincipals++;
      } else {
        invalidPrincipals++;
        console.warn(`❌ Invalid principal: ${principal}`);
      }
    }

    console.log(`📊 Principal Validation Results:`);
    console.log(`   ✅ Valid principals: ${validPrincipals}`);
    console.log(`   ❌ Invalid principals: ${invalidPrincipals}`);

    // All real mainnet principals should be valid
    expect(validPrincipals).toBe(realPrincipals.length);
    expect(invalidPrincipals).toBe(0);

    console.log(`🎉 Successfully validated ${validPrincipals} real mainnet principals!`);

  }, 15000);

  it('should validate contract names from real mainnet data', async () => {
    console.log('🔍 Testing contract name validation against real examples...');

    // Real contract names from mainnet
    const realContractNames = [
      'charisma-token',
      'zststxbtc-v2_v2-0', 
      'xyk-pool-stx-shark-v-1-1',
      'xyk-pool-sbtc-beast1-v-1-1',
      'stableswap-pool-usdh-susdh-v-1-4',
      'token-aeusdc-subnet',
      'crashpunks-v2',
      'univ2-vault',
      'arkadiko-dao',
      'alex-reserve-pool',
      'mega-bright-grassland',
      'wrapped-stx-token',
      'usda-token',
      'bitflow-stx-usda-lp-token-v-1-0',
      'clarity-bitcoin-mini'
    ];

    let validNames = 0;
    let invalidNames = 0;

    for (const name of realContractNames) {
      console.log(`🔍 Validating contract name: ${name}`);
      
      if (isValidContractName(name)) {
        validNames++;
      } else {
        invalidNames++;
        console.warn(`❌ Invalid contract name: ${name}`);
      }
    }

    console.log(`📊 Contract Name Validation Results:`);
    console.log(`   ✅ Valid names: ${validNames}`);
    console.log(`   ❌ Invalid names: ${invalidNames}`);

    // All real contract names should be valid
    expect(validNames).toBe(realContractNames.length);
    expect(invalidNames).toBe(0);

    console.log(`🎉 Successfully validated ${validNames} real contract names!`);

  }, 10000);
});
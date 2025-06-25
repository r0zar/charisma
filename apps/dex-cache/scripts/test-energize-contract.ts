// Test the specific energize contract functions and understand the energy system
import { getContractInfo, callReadOnlyFunction } from '@repo/polyglot';
import { getAllVaultData } from '../src/lib/pool-service';
import { uintCV, optionalCVOf, bufferCVFromString } from '@stacks/transactions';

async function testEnergizeContract() {
    console.log('⚡ Testing Energize Contract Functions');
    console.log('');
    
    const energizeContractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energize-v1';
    const holdToEarnContractId = 'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dexterity-hold-to-earn';
    
    try {
        // 1. Get contract info
        console.log('📋 Contract Information:');
        const contractInfo = await getContractInfo(energizeContractId);
        if (contractInfo) {
            console.log(`  Contract: ${energizeContractId}`);
            console.log(`  Block Height: ${contractInfo.block_height}`);
            console.log(`  Clarity Version: ${contractInfo.clarity_version}`);
            console.log(`  Source Length: ${contractInfo.source_code.length} characters`);
            console.log('');
        }

        // 2. Test the quote function (read-only)
        console.log('🔍 Testing Contract Functions:');
        
        const [contractAddress, contractName] = energizeContractId.split('.');
        
        // Test quote function with harvest energy opcode
        console.log('  Testing quote function...');
        try {
            const harvestOpcode = bufferCVFromString('07'); // OP_HARVEST_ENERGY as hex
            const quoteResult = await callReadOnlyFunction(
                contractAddress,
                contractName,
                'quote',
                [uintCV(0), optionalCVOf(harvestOpcode)]
            );
            console.log(`    ✅ Quote result:`, quoteResult);
        } catch (error) {
            console.log(`    ❌ Quote failed:`, error);
        }

        // Test quote without opcode
        console.log('  Testing quote without opcode...');
        try {
            const quoteResult2 = await callReadOnlyFunction(
                contractAddress,
                contractName,
                'quote',
                [uintCV(0), optionalCVOf(null)]
            );
            console.log(`    ✅ Quote (no opcode) result:`, quoteResult2);
        } catch (error) {
            console.log(`    ❌ Quote (no opcode) failed:`, error);
        }

        // Test get-token-uri
        console.log('  Testing get-token-uri...');
        try {
            const uriResult = await callReadOnlyFunction(
                contractAddress,
                contractName,
                'get-token-uri',
                []
            );
            console.log(`    ✅ Token URI result:`, uriResult);
        } catch (error) {
            console.log(`    ❌ Token URI failed:`, error);
        }

        console.log('');

        // 3. Test the hold-to-earn contract functions
        console.log('🎯 Testing Hold-to-Earn Contract:');
        const [hteAddress, hteName] = holdToEarnContractId.split('.');
        
        // Test if we can read some basic info from hold-to-earn
        const testAddress = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS'; // Test with deployer address
        
        // Check if hold-to-earn contract exists
        console.log('  Checking hold-to-earn contract accessibility...');
        try {
            const hteInfo = await getContractInfo(holdToEarnContractId);
            if (hteInfo) {
                console.log(`    ✅ Hold-to-earn contract accessible (block ${hteInfo.block_height})`);
                console.log(`    📄 Source length: ${hteInfo.source_code.length} characters`);
            } else {
                console.log(`    ❌ Hold-to-earn contract not found`);
            }
        } catch (error) {
            console.log(`    ❌ Error accessing hold-to-earn:`, error);
        }

        console.log('');

        // 4. Analyze the vault configuration
        console.log('🗃️ Vault Configuration Analysis:');
        const energyVaults = await getAllVaultData({ type: 'ENERGY' });
        
        energyVaults.forEach(vault => {
            console.log(`  Vault: ${vault.name} (${vault.contractId})`);
            console.log(`    Type: ${vault.type}`);
            console.log(`    Protocol: ${vault.protocol}`);
            console.log(`    Base Token: ${vault.base || 'Not specified'}`);
            console.log(`    Engine: ${vault.engineContractId || 'Not specified'}`);
            console.log(`    Image: ${vault.image ? 'Present' : 'Not set'}`);
            console.log('');
        });

        // 5. Extract relationships from source code
        console.log('🔗 Contract Relationships Analysis:');
        if (contractInfo) {
            const sourceCode = contractInfo.source_code;
            
            // Look for contract-call patterns
            const contractCalls = sourceCode.match(/contract-call\?\s+[^)]+/g);
            if (contractCalls) {
                console.log('  Contract calls found:');
                contractCalls.forEach(call => {
                    console.log(`    - ${call.trim()}`);
                });
            }
            
            // Look for trait implementations
            const traitImpls = sourceCode.match(/impl-trait[^)]+/g);
            if (traitImpls) {
                console.log('  Trait implementations:');
                traitImpls.forEach(impl => {
                    console.log(`    - ${impl.trim()}`);
                });
            }
            
            // Look for constants
            const constants = sourceCode.match(/define-constant[^)]+\)/g);
            if (constants) {
                console.log('  Constants defined:');
                constants.forEach(constant => {
                    console.log(`    - ${constant.trim()}`);
                });
            }
        }

        console.log('');
        console.log('✨ Energize contract analysis complete!');

    } catch (error) {
        console.error('❌ Error during energize contract testing:', error);
        process.exit(1);
    }
}

// Run the test
testEnergizeContract().catch(console.error);
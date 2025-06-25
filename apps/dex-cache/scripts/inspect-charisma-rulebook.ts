// Script to inspect the charisma-rulebook-v0 contract
import { getContractInfo, callReadOnlyFunction } from '@repo/polyglot';

const contractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-rulebook-v0';

async function inspectCharismaRulebook() {
    console.log('🔍 Inspecting Charisma Rulebook Contract');
    console.log(`Contract: ${contractId}`);
    console.log('');

    // First, let's try to get contract info using polyglot
    try {
        console.log('📋 Fetching contract information...');
        const contractInfo = await getContractInfo(contractId);
        
        console.log('✅ Contract Info:');
        console.log(`   Canonical: ${contractInfo.canonical}`);
        console.log(`   Block Height: ${contractInfo.block_height}`);
        console.log(`   Tx ID: ${contractInfo.tx_id}`);
        console.log('');
        
        if (contractInfo.source_code) {
            console.log('📜 Contract Source Code:');
            console.log('---');
            console.log(contractInfo.source_code);
            console.log('---');
            console.log('');
        }
        
        if (contractInfo.abi) {
            console.log('🔧 Contract ABI:');
            console.log('Functions:');
            
            if (contractInfo.abi.functions) {
                contractInfo.abi.functions.forEach((func: any) => {
                    console.log(`   ${func.access} ${func.name}(${func.args.map((arg: any) => `${arg.name}: ${arg.type}`).join(', ')}) -> ${func.outputs.type}`);
                });
            }
            
            if (contractInfo.abi.variables) {
                console.log('Variables:');
                contractInfo.abi.variables.forEach((variable: any) => {
                    console.log(`   ${variable.access} ${variable.name}: ${variable.type}`);
                });
            }
            
            if (contractInfo.abi.maps) {
                console.log('Maps:');
                contractInfo.abi.maps.forEach((map: any) => {
                    console.log(`   ${map.name}: ${map.key} -> ${map.value}`);
                });
            }
            
            if (contractInfo.abi.fungible_tokens) {
                console.log('Fungible Tokens:');
                contractInfo.abi.fungible_tokens.forEach((token: any) => {
                    console.log(`   ${token.name}`);
                });
            }
            
            if (contractInfo.abi.non_fungible_tokens) {
                console.log('Non-Fungible Tokens:');
                contractInfo.abi.non_fungible_tokens.forEach((nft: any) => {
                    console.log(`   ${nft.name}: ${nft.type}`);
                });
            }
        }
        
    } catch (error) {
        console.log(`❌ Error fetching contract info: ${error}`);
    }

    // Try to call some common read-only functions to understand the contract
    console.log('🧪 Testing common read-only functions...');
    
    const commonFunctions = [
        'get-contract-uri',
        'get-owner', 
        'get-admin',
        'get-version',
        'get-name',
        'get-description',
        'get-total-supply',
        'get-balance',
        'get-token-uri',
        'get-last-token-id',
        'get-mint-limit',
        'get-mint-price'
    ];

    for (const functionName of commonFunctions) {
        try {
            console.log(`   Testing: ${functionName}()`);
            const result = await callReadOnlyFunction(contractId, functionName, []);
            
            console.log(`   ✅ ${functionName}: ${JSON.stringify(result, null, 2)}`);
        } catch (error) {
            console.log(`   ❌ ${functionName}: Function not available or error`);
        }
    }

    console.log('');
    console.log('✨ Contract inspection complete!');
}

// Run the inspection
inspectCharismaRulebook().catch(console.error);
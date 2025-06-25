// Inspect all contract functions to find the correct URI function
import { getContractInterface } from '@repo/polyglot';
import { callReadOnlyFunction, ClarityType } from '@stacks/transactions';
import { StacksMainnet } from '@stacks/network';

async function inspectContractFunctions() {
    console.log('🔍 Deep Contract Function Inspection');
    console.log('═'.repeat(70));
    console.log('');

    const contractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.anime-demon-girl';
    const [contractAddress, contractName] = contractId.split('.');

    try {
        // Get full contract interface
        const contractInterface = await getContractInterface(contractAddress, contractName);
        
        if (!contractInterface?.functions) {
            console.log('❌ No contract functions found');
            return;
        }

        console.log(`📋 Found ${Object.keys(contractInterface.functions).length} functions:`);
        console.log('');

        // List all functions with details
        Object.entries(contractInterface.functions).forEach(([name, func]: [string, any], index) => {
            console.log(`${index + 1}. ${name}`);
            console.log(`   Args: ${JSON.stringify(func.args || [])}`);
            console.log(`   Outputs: ${JSON.stringify(func.outputs || [])}`);
            console.log(`   Access: ${func.access || 'unknown'}`);
            console.log('');
        });

        // Look for functions that might return URIs
        console.log('🎯 Analyzing Potential URI Functions:');
        console.log('─'.repeat(50));

        const allFunctions = Object.keys(contractInterface.functions);
        
        // Check for read-only functions that might return strings
        const readOnlyFunctions = Object.entries(contractInterface.functions)
            .filter(([name, func]: [string, any]) => func.access === 'read_only')
            .map(([name]) => name);

        console.log(`Found ${readOnlyFunctions.length} read-only functions:`);
        readOnlyFunctions.forEach(name => console.log(`  - ${name}`));
        console.log('');

        // Try to call some likely URI functions
        const network = new StacksMainnet();
        
        const candidateFunctions = readOnlyFunctions.filter(name => 
            name.includes('uri') || 
            name.includes('metadata') || 
            name.includes('url') ||
            name.includes('image') ||
            name.includes('json') ||
            name === 'get-token-info' ||
            name === 'get-metadata' ||
            name === 'token-metadata'
        );

        if (candidateFunctions.length > 0) {
            console.log('🔍 Testing candidate URI functions:');
            console.log('─'.repeat(40));

            for (const funcName of candidateFunctions) {
                try {
                    console.log(`Testing: ${funcName}`);
                    const funcDef = contractInterface.functions[funcName];
                    
                    // Try calling with no arguments first
                    if (!funcDef.args || funcDef.args.length === 0) {
                        const result = await callReadOnlyFunction({
                            contractAddress,
                            contractName,
                            functionName: funcName,
                            functionArgs: [],
                            network,
                            senderAddress: contractAddress
                        });
                        
                        console.log(`  ✅ Success: ${JSON.stringify(result, null, 2)}`);
                    } else {
                        console.log(`  ⏸️  Requires args: ${JSON.stringify(funcDef.args)}`);
                    }
                } catch (error: any) {
                    console.log(`  ❌ Error: ${error.message}`);
                }
            }
        } else {
            console.log('❌ No obvious URI functions found');
            
            // Try some common function names that might exist
            const commonNames = [
                'get-token-info',
                'token-info', 
                'metadata',
                'get-metadata',
                'info',
                'details',
                'data'
            ];

            console.log('');
            console.log('🔍 Testing common function patterns:');
            console.log('─'.repeat(40));

            for (const funcName of commonNames) {
                if (allFunctions.includes(funcName)) {
                    try {
                        console.log(`Testing: ${funcName}`);
                        const result = await callReadOnlyFunction({
                            contractAddress,
                            contractName,
                            functionName: funcName,
                            functionArgs: [],
                            network,
                            senderAddress: contractAddress
                        });
                        
                        console.log(`  ✅ Success: ${JSON.stringify(result, null, 2)}`);
                    } catch (error: any) {
                        console.log(`  ❌ Error: ${error.message}`);
                    }
                } else {
                    console.log(`${funcName}: Not found`);
                }
            }
        }

        // Check if this is a standard SIP-010 token with expected functions
        console.log('');
        console.log('📊 SIP-010 Standard Compliance Check:');
        console.log('─'.repeat(40));
        
        const sip010Functions = [
            'transfer',
            'get-name',
            'get-symbol', 
            'get-decimals',
            'get-balance',
            'get-total-supply',
            'get-token-uri'
        ];

        sip010Functions.forEach(func => {
            const exists = allFunctions.includes(func);
            console.log(`${exists ? '✅' : '❌'} ${func}`);
        });

        // If get-token-uri exists, try to call it
        if (allFunctions.includes('get-token-uri')) {
            console.log('');
            console.log('🎯 Found get-token-uri! Testing...');
            console.log('─'.repeat(30));
            
            try {
                const result = await callReadOnlyFunction({
                    contractAddress,
                    contractName,
                    functionName: 'get-token-uri',
                    functionArgs: [],
                    network,
                    senderAddress: contractAddress
                });
                
                console.log(`✅ get-token-uri result:`);
                console.log(JSON.stringify(result, null, 2));
                
                // Extract the actual URI if it's in the response
                if (result && typeof result === 'object') {
                    // Handle different response formats
                    const value = result.value || result;
                    if (typeof value === 'string') {
                        console.log(`🎯 FOUND TOKEN URI: ${value}`);
                    }
                }
                
            } catch (error: any) {
                console.log(`❌ get-token-uri error: ${error.message}`);
            }
        }

    } catch (error: any) {
        console.error('❌ Contract inspection error:', error.message);
        console.error('Stack:', error.stack);
    }
}

inspectContractFunctions();
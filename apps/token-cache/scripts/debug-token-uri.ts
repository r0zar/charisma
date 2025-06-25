// Debug token URI fetching for anime-demon-girl to find the real image
import { Cryptonomicon } from '../src/lib/cryptonomicon';
import { getContractInterface } from '@repo/polyglot';

async function debugTokenUri() {
    console.log('🔍 Debug Token URI for anime-demon-girl');
    console.log('═'.repeat(70));
    console.log('');

    const contractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.anime-demon-girl';
    const [contractAddress, contractName] = contractId.split('.');

    console.log(`Contract: ${contractId}`);
    console.log(`Address: ${contractAddress}`);
    console.log(`Name: ${contractName}`);
    console.log('');

    try {
        // Step 1: Check contract interface for get-token-uri function
        console.log('📋 Step 1: Contract Interface Analysis');
        console.log('─'.repeat(50));
        
        const contractInterface = await getContractInterface(contractAddress, contractName);
        console.log('Contract interface fetched successfully');
        
        if (contractInterface?.functions) {
            const functions = Object.keys(contractInterface.functions);
            console.log(`Found ${functions.length} functions:`);
            
            // Look for URI-related functions
            const uriFunctions = functions.filter(f => 
                f.includes('uri') || f.includes('metadata') || f.includes('token-uri')
            );
            
            if (uriFunctions.length > 0) {
                console.log('📍 URI-related functions found:');
                uriFunctions.forEach(func => {
                    const funcDef = contractInterface.functions[func];
                    console.log(`  - ${func}:`);
                    console.log(`    Args: ${JSON.stringify(funcDef.args || [])}`);
                    console.log(`    Output: ${JSON.stringify(funcDef.outputs || [])}`);
                });
            } else {
                console.log('❌ No URI-related functions found');
                console.log('Available functions:');
                functions.slice(0, 10).forEach(func => console.log(`  - ${func}`));
                if (functions.length > 10) {
                    console.log(`  ... and ${functions.length - 10} more`);
                }
            }
        }
        console.log('');

        // Step 2: Test direct contract calls for token URI
        console.log('📞 Step 2: Direct Contract Calls');
        console.log('─'.repeat(50));
        
        // Try common token URI function names
        const commonUriFunctions = [
            'get-token-uri',
            'token-uri', 
            'get-uri',
            'uri',
            'metadata-uri',
            'get-metadata-uri'
        ];

        for (const funcName of commonUriFunctions) {
            try {
                console.log(`Testing function: ${funcName}`);
                
                // Try calling the function (this would need actual contract call implementation)
                // For now, let's check if the function exists in the interface
                if (contractInterface?.functions?.[funcName]) {
                    console.log(`  ✅ Function ${funcName} exists in contract`);
                    const funcDef = contractInterface.functions[funcName];
                    console.log(`     Args: ${JSON.stringify(funcDef.args)}`);
                    console.log(`     Output: ${JSON.stringify(funcDef.outputs)}`);
                } else {
                    console.log(`  ❌ Function ${funcName} not found`);
                }
            } catch (error: any) {
                console.log(`  ❌ Error testing ${funcName}: ${error.message}`);
            }
        }
        console.log('');

        // Step 3: Analyze current metadata fetching process
        console.log('🔍 Step 3: Current Metadata Process Analysis');
        console.log('─'.repeat(50));
        
        const cryptonomicon = new Cryptonomicon({ 
            debug: true, // Enable debug mode to see detailed logs
            apiKey: process.env.HIRO_API_KEY 
        });

        console.log('Fetching metadata with full debug logging...');
        const metadata = await cryptonomicon.getTokenMetadata(contractId);
        
        if (metadata) {
            console.log('');
            console.log('📊 Final metadata result:');
            console.log(`  Name: ${metadata.name}`);
            console.log(`  Symbol: ${metadata.symbol}`);
            console.log(`  Image: ${metadata.image}`);
            console.log(`  Description: ${metadata.description}`);
            console.log(`  Identifier: ${metadata.identifier}`);
            
            // Analyze the image source
            if (metadata.image) {
                if (metadata.image.includes('ui-avatars.com')) {
                    console.log('');
                    console.log('⚠️  ISSUE IDENTIFIED:');
                    console.log('   The token is getting a fallback UI-Avatars image instead of its real image.');
                    console.log('   This means the get-token-uri call is not working or not being attempted.');
                } else {
                    console.log('');
                    console.log('✅ Token has a real image (not fallback)');
                }
            }
        }
        console.log('');

        // Step 4: Manual URI investigation
        console.log('🔎 Step 4: Manual Token URI Investigation');
        console.log('─'.repeat(50));
        
        // Try to manually construct and test the token URI
        console.log('Checking common token URI patterns...');
        
        const commonUriPatterns = [
            `https://charisma.rocks/api/v0/metadata/${contractId}`,
            `https://api.charisma.rocks/metadata/${contractId}`,
            `https://metadata.charisma.rocks/${contractId}`,
            `https://gaia.hiro.so/hub/${contractAddress}/${contractName}.json`,
            `https://assets.hiro.so/api/mainnet/token-metadata-api/${contractId}`
        ];

        for (const uri of commonUriPatterns) {
            try {
                console.log(`Testing URI: ${uri}`);
                const response = await fetch(uri);
                console.log(`  Status: ${response.status}`);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log(`  ✅ Success! Data found:`);
                    console.log(`     Name: ${data.name || 'N/A'}`);
                    console.log(`     Image: ${data.image || 'N/A'}`);
                    console.log(`     Description: ${data.description ? 'Present' : 'N/A'}`);
                    
                    if (data.image && !data.image.includes('ui-avatars.com')) {
                        console.log('');
                        console.log('🎯 FOUND REAL IMAGE!');
                        console.log(`   Real image URL: ${data.image}`);
                        console.log('   This should be used instead of the fallback.');
                    }
                } else {
                    console.log(`  ❌ Failed: ${response.status} ${response.statusText}`);
                }
            } catch (error: any) {
                console.log(`  ❌ Error: ${error.message}`);
            }
        }

        console.log('');
        console.log('💡 RESOLUTION PLAN:');
        console.log('─'.repeat(50));
        console.log('1. Identify the correct get-token-uri function in the contract');
        console.log('2. Implement proper contract call to fetch the real token URI');
        console.log('3. Update the metadata extraction to prioritize real URIs over fallbacks');
        console.log('4. Test and verify the real image is fetched and cached');

    } catch (error: any) {
        console.error('❌ Debug error:', error.message);
        console.error('Stack:', error.stack);
    }
}

debugTokenUri();
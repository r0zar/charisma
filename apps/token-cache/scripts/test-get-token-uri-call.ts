// Test the actual get-token-uri contract call
import { callReadOnlyFunction } from '@repo/polyglot';

async function testGetTokenUriCall() {
    console.log('🔍 Testing Direct get-token-uri Contract Call');
    console.log('═'.repeat(60));
    console.log('');

    const contractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.anime-demon-girl';
    const [contractAddress, contractName] = contractId.split('.');

    console.log(`Contract: ${contractId}`);
    console.log(`Address: ${contractAddress}`);
    console.log(`Name: ${contractName}`);
    console.log('');

    try {
        console.log('📞 Calling get-token-uri function...');
        
        const result = await callReadOnlyFunction(
            contractAddress,
            contractName,
            "get-token-uri", 
            []
        );

        console.log('Raw result from get-token-uri:');
        console.log(JSON.stringify(result, null, 2));
        console.log('');

        // Parse the result like the cryptonomicon does
        const tokenUri = result?.value?.value;
        console.log(`Parsed token URI: ${tokenUri}`);
        console.log('');

        if (tokenUri) {
            console.log('✅ SUCCESS: get-token-uri returned a URI!');
            console.log(`🎯 Token URI: ${tokenUri}`);
            console.log('');
            
            // Try to fetch metadata from this URI
            console.log('📥 Fetching metadata from token URI...');
            try {
                const response = await fetch(tokenUri);
                console.log(`Response status: ${response.status}`);
                
                if (response.ok) {
                    const metadata = await response.json();
                    console.log('✅ Metadata found:');
                    console.log(JSON.stringify(metadata, null, 2));
                    
                    if (metadata.image) {
                        console.log('');
                        console.log('🎉 REAL IMAGE FOUND!');
                        console.log(`Real image URL: ${metadata.image}`);
                        console.log('This should be used instead of the fallback!');
                    }
                } else {
                    console.log(`❌ Failed to fetch metadata: ${response.status} ${response.statusText}`);
                }
            } catch (fetchError: any) {
                console.log(`❌ Error fetching metadata: ${fetchError.message}`);
            }
        } else {
            console.log('❌ No token URI returned');
            console.log('The contract\'s get-token-uri function returned None/null');
            console.log('This means the token has no configured URI');
            
            // Check if there's a different structure
            console.log('');
            console.log('🔍 Analyzing result structure...');
            if (result) {
                console.log('Result keys:', Object.keys(result));
                if (result.value) {
                    console.log('Result.value keys:', Object.keys(result.value));
                    console.log('Result.value type:', typeof result.value);
                }
            }
        }

    } catch (error: any) {
        console.error('❌ Error calling get-token-uri:', error.message);
        console.error('Stack:', error.stack);
    }
}

testGetTokenUriCall();
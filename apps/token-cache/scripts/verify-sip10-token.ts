// Verify anime-demon-girl is a proper SIP-010 token using @repo/polyglot
import { getContractInterface } from '@repo/polyglot';

async function verifySip10Token() {
    console.log('🔍 Verifying SIP-010 Token: anime-demon-girl');
    console.log('═'.repeat(70));
    console.log('');

    const contractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.anime-demon-girl';
    const [contractAddress, contractName] = contractId.split('.');

    console.log(`Contract: ${contractId}`);
    console.log(`Address: ${contractAddress}`);
    console.log(`Name: ${contractName}`);
    console.log('');

    try {
        console.log('📋 Fetching contract interface...');
        const contractInterface = await getContractInterface(contractAddress, contractName);
        
        if (!contractInterface) {
            console.log('❌ No contract interface returned');
            return;
        }

        console.log('✅ Contract interface fetched successfully');
        console.log('');

        // Show the raw interface structure
        console.log('📊 Raw Contract Interface:');
        console.log('─'.repeat(40));
        console.log(JSON.stringify(contractInterface, null, 2));
        console.log('');

        // Check for SIP-010 functions specifically
        if (contractInterface.functions) {
            const functions = Object.keys(contractInterface.functions);
            console.log(`📋 Found ${functions.length} functions:`);
            
            // List all functions with their signatures
            Object.entries(contractInterface.functions).forEach(([name, func]: [string, any]) => {
                console.log(`  ${name}:`);
                console.log(`    Access: ${func.access || 'unknown'}`);
                console.log(`    Args: ${JSON.stringify(func.args || [])}`);
                console.log(`    Outputs: ${JSON.stringify(func.outputs || [])}`);
                console.log('');
            });

            // Check SIP-010 standard functions
            console.log('🎯 SIP-010 Standard Compliance Check:');
            console.log('─'.repeat(50));
            
            const sip010Functions = [
                'transfer',
                'get-name',
                'get-symbol', 
                'get-decimals',
                'get-balance',
                'get-total-supply',
                'get-token-uri'
            ];

            let compliantCount = 0;
            sip010Functions.forEach(func => {
                const exists = functions.includes(func);
                console.log(`${exists ? '✅' : '❌'} ${func}`);
                if (exists) compliantCount++;
            });

            console.log('');
            console.log(`📊 SIP-010 Compliance: ${compliantCount}/${sip010Functions.length} functions present`);
            
            if (compliantCount === sip010Functions.length) {
                console.log('🎉 FULLY SIP-010 COMPLIANT!');
            } else if (compliantCount >= 5) {
                console.log('⚠️  Mostly SIP-010 compliant');
            } else {
                console.log('❌ Not SIP-010 compliant');
            }

            // If get-token-uri exists, this is critical for our investigation
            if (functions.includes('get-token-uri')) {
                console.log('');
                console.log('🎯 CRITICAL FINDING: get-token-uri function EXISTS!');
                console.log('─'.repeat(60));
                
                const getTokenUriFunc = contractInterface.functions['get-token-uri'];
                console.log('get-token-uri function details:');
                console.log(`  Access: ${getTokenUriFunc.access}`);
                console.log(`  Args: ${JSON.stringify(getTokenUriFunc.args)}`);
                console.log(`  Returns: ${JSON.stringify(getTokenUriFunc.outputs)}`);
                console.log('');
                
                console.log('💡 IMPLICATION:');
                console.log('This means our metadata extraction system should be calling');
                console.log('this function to get the real token URI, not using fallbacks!');
                console.log('');
                console.log('🔧 REQUIRED ACTION:');
                console.log('1. Implement proper get-token-uri contract call');
                console.log('2. Fetch metadata from the returned URI');
                console.log('3. Use that metadata instead of generating fallbacks');
            }

        } else {
            console.log('❌ No functions found in contract interface');
        }

        // Check for fungible tokens section
        if (contractInterface.fungible_tokens) {
            console.log('🪙 Fungible Tokens:');
            console.log('─'.repeat(30));
            console.log(JSON.stringify(contractInterface.fungible_tokens, null, 2));
        }

        // Check for variables that might contain metadata
        if (contractInterface.variables) {
            console.log('📝 Contract Variables:');
            console.log('─'.repeat(30));
            Object.entries(contractInterface.variables).forEach(([name, variable]: [string, any]) => {
                console.log(`  ${name}: ${JSON.stringify(variable)}`);
            });
        }

        // Check for maps that might contain token data
        if (contractInterface.maps) {
            console.log('🗺️  Contract Maps:');
            console.log('─'.repeat(25));
            Object.entries(contractInterface.maps).forEach(([name, map]: [string, any]) => {
                console.log(`  ${name}: ${JSON.stringify(map)}`);
            });
        }

    } catch (error: any) {
        console.error('❌ Error fetching contract interface:', error.message);
        console.error('Stack:', error.stack);
    }
}

verifySip10Token();
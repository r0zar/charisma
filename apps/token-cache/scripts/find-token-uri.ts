// Find the real token URI for anime-demon-girl
import { getContractInterface } from '@repo/polyglot';

async function findTokenUri() {
    console.log('🔍 Finding Real Token URI for anime-demon-girl');
    console.log('═'.repeat(70));
    console.log('');

    const contractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.anime-demon-girl';
    const [contractAddress, contractName] = contractId.split('.');

    try {
        // Get contract interface 
        const contractInterface = await getContractInterface(contractAddress, contractName);
        
        if (!contractInterface?.functions) {
            console.log('❌ No contract functions found');
            return;
        }

        const functions = Object.keys(contractInterface.functions);
        console.log(`📋 Contract has ${functions.length} functions:`);
        
        // Show all functions to understand what we're working with
        functions.forEach((func, index) => {
            const funcDef = contractInterface.functions[func];
            console.log(`${index + 1}. ${func} (${funcDef.access || 'unknown'})`);
            if (funcDef.args && funcDef.args.length > 0) {
                console.log(`   Args: ${JSON.stringify(funcDef.args)}`);
            }
            if (funcDef.outputs && funcDef.outputs.length > 0) {
                console.log(`   Returns: ${JSON.stringify(funcDef.outputs)}`);
            }
        });
        console.log('');

        // Check for SIP-010 compliance
        console.log('📊 SIP-010 Standard Functions:');
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
            const exists = functions.includes(func);
            console.log(`${exists ? '✅' : '❌'} ${func}`);
        });
        console.log('');

        // If no get-token-uri, check what the charisma metadata API should be doing
        if (!functions.includes('get-token-uri')) {
            console.log('❌ This contract does NOT have get-token-uri function');
            console.log('');
            console.log('🔍 Analyzing the real issue...');
            console.log('─'.repeat(40));
            
            console.log('The problem is:');
            console.log('1. ❌ Contract has no get-token-uri function');
            console.log('2. ❌ Charisma API is generating fallback image instead of real image');
            console.log('3. ✅ Our system correctly fetches from Charisma API');
            console.log('4. 💡 We need to find where the REAL image should come from');
            console.log('');
            
            // Check if this token has metadata stored elsewhere
            console.log('🎯 Investigating Alternative Image Sources...');
            console.log('─'.repeat(50));
            
            // Check various potential image sources
            const imageSources = [
                'https://charisma.rocks/images/tokens/anime-demon-girl.png',
                'https://charisma.rocks/images/tokens/anime-demon-girl.jpg', 
                'https://charisma.rocks/images/tokens/THICC.png',
                'https://charisma.rocks/images/tokens/THICC.jpg',
                'https://assets.charisma.rocks/tokens/anime-demon-girl.png',
                'https://assets.charisma.rocks/tokens/THICC.png',
                'https://cdn.charisma.rocks/tokens/anime-demon-girl.png',
                'https://raw.githubusercontent.com/charisma-token/assets/main/anime-demon-girl.png'
            ];

            for (const imageUrl of imageSources) {
                try {
                    console.log(`Testing: ${imageUrl}`);
                    const response = await fetch(imageUrl);
                    console.log(`  Status: ${response.status}`);
                    
                    if (response.ok) {
                        const contentType = response.headers.get('content-type');
                        console.log(`  ✅ FOUND REAL IMAGE! Content-Type: ${contentType}`);
                        console.log(`  🎯 Real image URL: ${imageUrl}`);
                        
                        // This is the image that should be used!
                        console.log('');
                        console.log('🎉 SOLUTION FOUND!');
                        console.log(`   The real image is at: ${imageUrl}`);
                        console.log('   The charisma.rocks metadata API should return this URL');
                        console.log('   instead of generating a fallback UI-Avatars image.');
                        return;
                    }
                } catch (error: any) {
                    console.log(`  ❌ Error: ${error.message}`);
                }
            }

            console.log('');
            console.log('📋 No standard image locations found.');
            console.log('');
            console.log('🔧 RECOMMENDED SOLUTION:');
            console.log('─'.repeat(30));
            console.log('Since this token has no get-token-uri function and no standard');
            console.log('image locations, the issue is likely in the charisma.rocks');
            console.log('metadata API configuration.');
            console.log('');
            console.log('OPTIONS:');
            console.log('1. 📞 Contact the token creator to add a real image');
            console.log('2. 🎨 Upload a real image to charisma.rocks assets');
            console.log('3. 🔧 Update the charisma API to point to the correct image');
            console.log('4. 📝 Add manual metadata override for this specific token');
            
        } else {
            console.log('✅ Contract has get-token-uri function!');
            console.log('The issue is that our system is not calling it properly.');
            console.log('');
            console.log('🔧 Next steps:');
            console.log('1. Implement proper get-token-uri contract call');
            console.log('2. Parse the returned URI');
            console.log('3. Fetch metadata from that URI');
            console.log('4. Update cache with real image');
        }

    } catch (error: any) {
        console.error('❌ Error:', error.message);
    }
}

findTokenUri();
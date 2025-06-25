// Call the get-token-uri function to get the real token URI
import { Cryptonomicon } from '../src/lib/cryptonomicon';

async function callGetTokenUri() {
    console.log('🎯 Calling get-token-uri for anime-demon-girl');
    console.log('═'.repeat(60));
    console.log('');

    const contractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.anime-demon-girl';

    try {
        // Use the cryptonomicon to make the contract call
        console.log('📞 Making contract call to get-token-uri...');
        
        const cryptonomicon = new Cryptonomicon({ 
            debug: true,
            apiKey: process.env.HIRO_API_KEY 
        });

        // The issue is that our getTokenMetadata doesn't call get-token-uri
        // Let's check if we can access the raw contract call mechanism
        console.log('');
        console.log('🔍 Current metadata extraction process:');
        console.log('─'.repeat(50));
        
        const metadata = await cryptonomicon.getTokenMetadata(contractId);
        console.log('Current metadata result:');
        console.log(JSON.stringify(metadata, null, 2));
        console.log('');
        
        console.log('❌ ISSUE IDENTIFIED:');
        console.log('The cryptonomicon.getTokenMetadata() is NOT calling get-token-uri!');
        console.log('It\'s only checking external URIs and generating fallbacks.');
        console.log('');
        
        console.log('🔧 REQUIRED FIX:');
        console.log('We need to update the cryptonomicon to:');
        console.log('1. Call the contract\'s get-token-uri function FIRST');
        console.log('2. If it returns a URI, fetch metadata from that URI');
        console.log('3. Only use fallbacks if get-token-uri returns None');
        console.log('');
        
        console.log('💡 NEXT STEPS:');
        console.log('1. Update cryptonomicon.ts to call get-token-uri');
        console.log('2. Implement proper contract call functionality');
        console.log('3. Parse the returned URI and fetch real metadata');
        console.log('4. Cache the real metadata instead of fallbacks');
        
    } catch (error: any) {
        console.error('❌ Error:', error.message);
    }
}

callGetTokenUri();
import { getContractInterface } from '@repo/polyglot';
import { Cryptonomicon } from '../src/lib/cryptonomicon';

const contractId = process.argv[2] || 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.brc20-ormm';

async function testEnvironmentAndContract() {
    console.log('🔧 Environment Check:');
    console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    console.log(`  HIRO_API_KEY: ${process.env.HIRO_API_KEY ? 'set ✅' : 'not set ❌'}`);
    console.log(`  KV_REST_API_URL: ${process.env.KV_REST_API_URL ? 'set ✅' : 'not set ❌'}`);
    console.log('');

    try {
        console.log(`🧪 Testing contract interface for: ${contractId}`);
        const [contractAddress, contractName] = contractId.split('.');
        
        const contractInterface = await getContractInterface(contractAddress, contractName);
        
        if (contractInterface && contractInterface.fungible_tokens) {
            console.log('✅ Contract interface loaded successfully');
            console.log(`📋 Fungible tokens found: ${contractInterface.fungible_tokens.length}`);
            
            if (contractInterface.fungible_tokens.length > 0) {
                const firstToken = contractInterface.fungible_tokens[0] as any;
                console.log(`🎯 First token identifier: "${firstToken.name}"`);
            }
        } else {
            console.log('❌ No fungible tokens found in contract interface');
        }
        
        console.log('');
        console.log('🧪 Testing Cryptonomicon (token metadata fetching)...');
        
        const cryptonomicon = new Cryptonomicon({
            debug: true,
            apiKey: process.env.HIRO_API_KEY,
        });
        
        // Test only the token identifier extraction (doesn't need KV)
        const identifier = await cryptonomicon.getTokenIdentifier(contractId);
        console.log(`🔍 Token identifier: "${identifier}"`);
        
        console.log('');
        console.log('✅ All tests completed successfully!');
        
    } catch (error: any) {
        console.error('❌ Error:', error.message);
        if (error.message.includes('KV_REST_API')) {
            console.log('💡 This is expected if KV environment variables are not set');
        }
    }
}

testEnvironmentAndContract();
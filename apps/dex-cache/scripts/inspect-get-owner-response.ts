// Script to inspect the raw JSON response from get-owner calls
import { callReadOnlyFunction } from '@repo/polyglot';
import { uintCV } from '@stacks/transactions';

async function inspectGetOwnerResponse() {
    console.log('🔍 Inspecting get-owner Response Format');
    console.log('='.repeat(80));
    
    try {
        // Test a few different Raven IDs to see the response format
        const testIds = [1, 2, 50, 99, 100];
        
        for (const ravenId of testIds) {
            console.log(`\n🐦 Testing Raven #${ravenId}:`);
            console.log('-'.repeat(40));
            
            try {
                const result = await callReadOnlyFunction(
                    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
                    'odins-raven',
                    'get-owner',
                    [uintCV(ravenId)]
                );
                
                console.log('📦 Raw result:');
                console.log(result);
                console.log('');
                console.log('📋 Result type:', typeof result);
                console.log('📋 Result JSON:');
                console.log(JSON.stringify(result, null, 2));
                
                if (result) {
                    console.log('');
                    console.log('🔍 Detailed analysis:');
                    console.log('  - Has toString():', typeof result.toString === 'function');
                    if (typeof result.toString === 'function') {
                        console.log('  - toString() result:', result.toString());
                    }
                    
                    if (typeof result === 'object') {
                        console.log('  - Object keys:', Object.keys(result));
                        console.log('  - Object values:', Object.values(result));
                    }
                }
                
            } catch (error: any) {
                console.log('❌ Error calling get-owner:', error.message);
            }
            
            console.log('='.repeat(60));
        }
        
    } catch (error) {
        console.error('❌ Failed to inspect get-owner responses:', error);
    }
}

// Run the inspection
inspectGetOwnerResponse().catch(console.error);
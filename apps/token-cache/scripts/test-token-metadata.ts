import { getTokenData } from '../src/lib/tokenService';

const contractId = process.argv[2] || 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.brc20-ormm';

async function testTokenMetadata() {
    try {
        console.log(`🧪 Testing token metadata for: ${contractId}`);
        console.log('Forcing fresh fetch (bypassing cache)...\n');
        
        const metadata = await getTokenData(contractId, true);
        
        if (metadata) {
            console.log('✅ Token metadata retrieved successfully:');
            console.log('📊 Data:', JSON.stringify(metadata, null, 2));
            
            console.log('\n🔍 Type validation:');
            console.log(`  identifier: ${typeof metadata.identifier} = "${metadata.identifier}"`);
            console.log(`  decimals: ${typeof metadata.decimals} = ${metadata.decimals}`);
            console.log(`  total_supply: ${typeof metadata.total_supply} = ${metadata.total_supply}`);
            
            // Validate types
            const validations = [
                { field: 'identifier', type: 'string', value: metadata.identifier },
                { field: 'decimals', type: 'number', value: metadata.decimals },
                { field: 'total_supply', type: 'number', value: metadata.total_supply },
            ];
            
            console.log('\n📋 Validation Results:');
            validations.forEach(({ field, type, value }) => {
                const actualType = typeof value;
                const isValid = actualType === type;
                const status = isValid ? '✅' : '❌';
                console.log(`  ${status} ${field}: expected ${type}, got ${actualType}`);
            });
            
        } else {
            console.log('❌ No metadata found for this token');
        }
    } catch (error: any) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

testTokenMetadata();
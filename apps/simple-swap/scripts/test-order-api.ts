// Test order API functionality and database connections
import { orderQuote } from '../src/lib/swap-api';

const fromToken = process.argv[2] || 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.brc20-ormm';
const toToken = process.argv[3] || 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';
const amount = process.argv[4] || '1000000';

async function testOrderAPI() {
    console.log('🧪 Testing Simple Swap Order API');
    console.log('');
    
    console.log('🔧 Environment Check:');
    console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    console.log(`  DATABASE_URL: ${process.env.DATABASE_URL ? 'set ✅' : 'not set ❌'}`);
    console.log(`  HIRO_API_KEY: ${process.env.HIRO_API_KEY ? 'set ✅' : 'not set ❌'}`);
    console.log('');

    try {
        console.log(`📊 Testing order quote:`);
        console.log(`  From: ${fromToken}`);
        console.log(`  To: ${toToken}`);
        console.log(`  Amount: ${amount}`);
        console.log('');

        const quote = await orderQuote({
            fromToken,
            toToken,
            amount: parseInt(amount),
            slippage: 0.05 // 5%
        });

        console.log('✅ Order quote retrieved successfully:');
        console.log('📈 Quote details:', JSON.stringify(quote, null, 2));
        
        console.log('');
        console.log('🔍 Type validation:');
        console.log(`  amount: ${typeof quote.amount} = ${quote.amount}`);
        console.log(`  route: ${Array.isArray(quote.route) ? 'array' : typeof quote.route} with ${quote.route?.length || 0} steps`);
        
    } catch (error: any) {
        console.error('❌ Error testing order API:', error.message);
        if (error.message.includes('DATABASE_URL')) {
            console.log('💡 This is expected if database environment variables are not set');
        }
        if (error.message.includes('fetch')) {
            console.log('💡 This might be a network issue or API endpoint problem');
        }
    }
}

testOrderAPI();
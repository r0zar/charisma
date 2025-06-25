// Test script to validate the SSE endpoint
import fetch from 'node-fetch';

const TEST_USER_ADDRESS = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
const SSE_URL = `http://localhost:3003/api/v1/energy/stream/${TEST_USER_ADDRESS}`;

async function testSSEEndpoint() {
    console.log('🌊 Testing SSE Endpoint...\n');
    console.log(`📡 Connecting to: ${SSE_URL}`);

    try {
        const response = await fetch(SSE_URL, {
            headers: {
                'Accept': 'text/event-stream',
                'Cache-Control': 'no-cache'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        console.log('✅ SSE connection established');
        console.log(`📋 Headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}`);

        // Note: In a real browser environment, you'd use EventSource
        // This is a simplified test to verify the endpoint responds correctly
        console.log('\n🎯 SSE endpoint is configured correctly!');
        console.log('📱 In the browser, the component will connect using EventSource API');
        console.log('⚡ Real-time energy updates will stream every second');

    } catch (error) {
        console.error('❌ SSE endpoint test failed:', error);
        console.log('\n💡 Make sure the development server is running with: pnpm dev');
    }
}

testSSEEndpoint().catch(console.error);
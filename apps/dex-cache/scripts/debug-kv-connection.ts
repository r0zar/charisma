#!/usr/bin/env tsx

import { kv } from "@vercel/kv";

/**
 * Script to debug KV connection and test basic operations
 */

async function debugKvConnection() {
    console.log('🔍 Debugging KV connection...\n');

    // Check environment variables
    console.log('📋 Environment variables:');
    console.log(`KV_REST_API_URL: ${process.env.KV_REST_API_URL ? 'SET' : 'NOT SET'}`);
    console.log(`KV_REST_API_TOKEN: ${process.env.KV_REST_API_TOKEN ? 'SET' : 'NOT SET'}`);
    console.log('');

    // Test basic KV operations
    const testKey = 'test-key-debug';
    const testValue = { test: true, timestamp: Date.now() };

    try {
        console.log('🧪 Testing KV write operation...');
        await kv.set(testKey, testValue);
        console.log('✅ KV write successful');

        console.log('🧪 Testing KV read operation...');
        const readValue = await kv.get(testKey);
        console.log('✅ KV read successful:', readValue);

        console.log('🧪 Testing KV delete operation...');
        await kv.del(testKey);
        console.log('✅ KV delete successful');

        console.log('🧪 Verifying delete...');
        const deletedValue = await kv.get(testKey);
        console.log('✅ Delete verified:', deletedValue === null ? 'NULL (expected)' : 'UNEXPECTED VALUE');

    } catch (error) {
        console.error('❌ KV operation failed:', error);
        console.error('Full error:', error);
    }

    // Test fetching existing data
    console.log('\n🔍 Testing access to existing data...');
    
    try {
        const existingKey = 'sip10:SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';
        const existingData = await kv.get(existingKey);
        console.log(`✅ Successfully accessed existing data at ${existingKey}:`, existingData ? 'FOUND' : 'NOT FOUND');
    } catch (error) {
        console.error('❌ Failed to access existing data:', error);
    }

    // Test token-metadata key pattern
    console.log('\n🔍 Testing token-metadata key pattern...');
    
    try {
        const testTokenKey = 'token-metadata:test-contract-debug';
        const testTokenData = { contractId: 'test-contract-debug', name: 'Test Token', image: 'test-image.png' };
        
        console.log('🧪 Writing to token-metadata key...');
        await kv.set(testTokenKey, testTokenData);
        console.log('✅ Write to token-metadata key successful');

        console.log('🧪 Reading from token-metadata key...');
        const readTokenData = await kv.get(testTokenKey);
        console.log('✅ Read from token-metadata key successful:', readTokenData);

        console.log('🧪 Cleaning up test token-metadata key...');
        await kv.del(testTokenKey);
        console.log('✅ Cleanup successful');

    } catch (error) {
        console.error('❌ token-metadata key test failed:', error);
    }
}

debugKvConnection().catch(console.error);
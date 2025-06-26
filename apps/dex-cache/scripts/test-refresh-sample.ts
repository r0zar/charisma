#!/usr/bin/env tsx

import { kv } from "@vercel/kv";
import { fetchMetadata } from '@repo/tokens';
import { Cryptonomicon } from '../src/lib/cryptonomicon';

/**
 * Test refresh script on a small sample of tokens
 */

async function testRefreshSample() {
    console.log('🔍 Testing refresh on a small sample...\n');
    
    if (!process.env.HIRO_API_KEY) {
        console.error('❌ HIRO_API_KEY not found');
        return;
    }
    
    console.log(`✅ HIRO_API_KEY loaded: ${process.env.HIRO_API_KEY.substring(0, 8)}...`);
    
    const cryptonomicon = new Cryptonomicon({
        debug: false,
        apiKey: process.env.HIRO_API_KEY,
    });
    
    // Get a small sample from metadata
    const allMetadata = await fetchMetadata();
    console.log(`Found ${allMetadata.length} total tokens`);
    
    // Test with first 5 tokens
    const sampleTokens = allMetadata.slice(0, 5);
    console.log(`\nTesting with ${sampleTokens.length} sample tokens:\n`);
    
    for (const token of sampleTokens) {
        try {
            console.log(`📋 ${token.contractId}:`);
            console.log(`  Current - Symbol: ${token.symbol}, Decimals: ${token.decimals}, Image: ${token.image?.substring(0, 50)}...`);
            
            // Fetch fresh data
            const [freshSymbol, freshDecimals, freshMetadata] = await Promise.all([
                cryptonomicon.getTokenSymbol(token.contractId),
                cryptonomicon.getTokenDecimals(token.contractId),
                cryptonomicon.getTokenMetadata(token.contractId)
            ]);
            
            console.log(`  Fresh   - Symbol: ${freshSymbol}, Decimals: ${freshDecimals}, Image: ${freshMetadata?.image?.substring(0, 50)}...`);
            
            // Check for changes
            const changes = [];
            if (token.symbol !== freshSymbol) changes.push(`Symbol: ${token.symbol} → ${freshSymbol}`);
            if (token.decimals !== freshDecimals) changes.push(`Decimals: ${token.decimals} → ${freshDecimals}`);
            if (token.image !== freshMetadata?.image) changes.push(`Image changed`);
            
            if (changes.length > 0) {
                console.log(`  ✨ Changes: ${changes.join(', ')}`);
            } else {
                console.log(`  ✅ No changes`);
            }
            
            console.log('');
            
            // Small delay
            await new Promise(resolve => setTimeout(resolve, 300));
            
        } catch (error) {
            console.error(`  ❌ Error: ${error}`);
        }
    }
}

testRefreshSample().catch(console.error);
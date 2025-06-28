#!/usr/bin/env tsx

import { kv } from "@vercel/kv";

/**
 * Test a single KV key that we just synced
 */

async function testSingleKey() {
    // Test one of the tokens we just synced
    const contractId = "SP1KMAA7TPZ5AZZ4W67X74MJNFKMN576604CWNBQS.dmghoot-lp-token";
    
    console.log(`🔍 Testing all key patterns for: ${contractId}\n`);
    
    const patterns = ['token-metadata:', 'sip10:', 'metadata:', 'dex-vault:'];
    for (const pattern of patterns) {
        const testKey = pattern + contractId;
        try {
            const data = await kv.get(testKey);
            console.log(`${data ? '✅' : '❌'} ${testKey}: ${data ? 'FOUND' : 'NOT FOUND'}`);
            if (data && typeof data === 'object') {
                const obj = data as any;
                if (obj.image) {
                    console.log(`    Image: ${obj.image}`);
                }
            }
        } catch (error) {
            console.log(`⚠️  ${testKey}: ERROR - ${error}`);
        }
    }
    
    // Also test the managed list
    console.log('\n🔍 Testing managed token list:');
    try {
        const tokenList = await kv.get<string[]>('token-list:sip10');
        const isInList = tokenList?.includes(contractId);
        console.log(`Token in managed list: ${isInList ? 'YES' : 'NO'}`);
        console.log(`Total tokens in managed list: ${tokenList?.length || 0}`);
    } catch (error) {
        console.log(`⚠️  Error checking managed list: ${error}`);
    }
}

testSingleKey().catch(console.error);
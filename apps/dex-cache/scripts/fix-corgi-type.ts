#!/usr/bin/env tsx

/**
 * Fix CORGI token metadata by adding type = "POOL"
 * This simulates what should happen when the type field is properly propagated
 * 
 * Usage: pnpm script fix-corgi-type
 */

import { kv } from "@vercel/kv";

async function main() {
    console.log('🔧 Fixing CORGI Token Type Field');
    console.log('='.repeat(80));

    const corgiContractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-corgi-liquidity';
    
    try {
        console.log(`📋 Getting current metadata for: ${corgiContractId}`);
        console.log('-'.repeat(60));
        
        const tokenMetadataKey = `token-metadata:${corgiContractId}`;
        const currentMetadata = await kv.get(tokenMetadataKey);
        
        if (!currentMetadata) {
            console.log('❌ No metadata found for CORGI token');
            return;
        }
        
        console.log('=== CURRENT METADATA ===');
        console.log(JSON.stringify(currentMetadata, null, 2));
        
        // Add the type field
        const updatedMetadata = {
            ...currentMetadata,
            type: 'POOL'
        };
        
        console.log('\n=== UPDATED METADATA ===');
        console.log(JSON.stringify(updatedMetadata, null, 2));
        
        // Update the metadata in KV store
        await kv.set(tokenMetadataKey, updatedMetadata);
        
        console.log('\n✅ Successfully updated CORGI token metadata with type = "POOL"');
        
        // Verify the update
        const verifyMetadata = await kv.get(tokenMetadataKey);
        console.log('\n=== VERIFICATION ===');
        console.log(`Type field: ${(verifyMetadata as any)?.type}`);
        
        // Test detection logic
        const metadata = verifyMetadata as any;
        const hasLPFields = !!(metadata.tokenAContract && metadata.tokenBContract);
        const hasTypePool = metadata.type === 'POOL';
        const combinedDetection = hasLPFields || hasTypePool;
        
        console.log('\n=== DETECTION TEST ===');
        console.log(`Legacy detection (tokenAContract && tokenBContract): ${hasLPFields}`);
        console.log(`New detection (type === "POOL"): ${hasTypePool}`);
        console.log(`Combined detection: ${combinedDetection}`);
        
        if (combinedDetection) {
            console.log('\n🎉 SUCCESS: CORGI will now be detected as an LP token!');
        } else {
            console.log('\n❌ ERROR: Detection logic still not working');
        }
        
    } catch (error) {
        console.error('❌ Error fixing CORGI token:', error);
    }
}

// Show usage information
function showUsage() {
    console.log('Usage: pnpm script fix-corgi-type');
    console.log('\nThis script fixes the CORGI token metadata by adding type = "POOL"');
    console.log('This demonstrates that our detection logic will work once the type field is properly set.');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsage();
    process.exit(0);
}

// Run the script
main().catch(console.error);
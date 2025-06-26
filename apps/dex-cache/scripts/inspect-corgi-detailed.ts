#!/usr/bin/env tsx

/**
 * Detailed inspection of CORGI token metadata to see the exact structure
 * 
 * Usage: pnpm script inspect-corgi-detailed
 */

import { kv } from "@vercel/kv";

async function main() {
    console.log('🔍 Detailed CORGI Token Metadata Inspection');
    console.log('='.repeat(80));

    const corgiContractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-corgi-liquidity';
    
    try {
        console.log(`📋 Getting detailed metadata for: ${corgiContractId}`);
        console.log('-'.repeat(60));
        
        const tokenMetadataKey = `token-metadata:${corgiContractId}`;
        const tokenMetadata = await kv.get(tokenMetadataKey);
        
        console.log('=== RAW TOKEN METADATA ===');
        console.log(JSON.stringify(tokenMetadata, null, 2));
        
        if (tokenMetadata) {
            const metadata = tokenMetadata as any;
            
            console.log('\n=== FIELD ANALYSIS ===');
            console.log(`name: "${metadata.name}"`);
            console.log(`symbol: "${metadata.symbol}"`);
            console.log(`type: "${metadata.type}" (${typeof metadata.type})`);
            console.log(`contractId: "${metadata.contractId}"`);
            console.log(`tokenAContract: "${metadata.tokenAContract}" (${typeof metadata.tokenAContract})`);
            console.log(`tokenBContract: "${metadata.tokenBContract}" (${typeof metadata.tokenBContract})`);
            
            console.log('\n=== ALL FIELDS ===');
            Object.keys(metadata).forEach(key => {
                const value = metadata[key];
                console.log(`${key}: ${JSON.stringify(value)} (${typeof value})`);
            });
            
            // Check if name matches LP patterns
            const nameContainsLiquidity = metadata.name?.toLowerCase().includes('liquidity');
            const nameContainsLP = metadata.name?.toLowerCase().includes(' lp');
            const symbolIsLP = metadata.symbol?.toLowerCase() === 'lp';
            
            console.log('\n=== LP DETECTION PATTERNS ===');
            console.log(`Name contains "liquidity": ${nameContainsLiquidity}`);
            console.log(`Name contains " lp": ${nameContainsLP}`);
            console.log(`Symbol is "LP": ${symbolIsLP}`);
            
            // Check current detection logic
            const hasLPFields = !!(metadata.tokenAContract && metadata.tokenBContract);
            const hasTypePool = metadata.type === 'POOL';
            
            console.log('\n=== DETECTION RESULTS ===');
            console.log(`Legacy detection (tokenAContract && tokenBContract): ${hasLPFields}`);
            console.log(`New detection (type === "POOL"): ${hasTypePool}`);
            console.log(`Combined detection: ${hasLPFields || hasTypePool}`);
            
            // What we need to fix
            if (!hasTypePool && nameContainsLiquidity) {
                console.log('\n❗ ISSUE IDENTIFIED:');
                console.log('This token should have type = "POOL" but currently has type =', JSON.stringify(metadata.type));
                console.log('SOLUTION: Update metadata to include type = "POOL"');
            }
        } else {
            console.log('❌ No metadata found for CORGI token');
        }
        
    } catch (error) {
        console.error('❌ Error inspecting CORGI token:', error);
    }
}

// Show usage information
function showUsage() {
    console.log('Usage: pnpm script inspect-corgi-detailed');
    console.log('\nThis script provides detailed inspection of CORGI token metadata');
    console.log('to identify exactly what fields are missing or incorrect.');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsage();
    process.exit(0);
}

// Run the script
main().catch(console.error);
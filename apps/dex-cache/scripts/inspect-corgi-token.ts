#!/usr/bin/env tsx

/**
 * Inspect CORGI (Charismatic Corgi Liquidity) token metadata
 * to understand why it's not being detected as an LP token
 * 
 * Usage: pnpm script inspect-corgi-token
 */

import { kv } from "@vercel/kv";

async function main() {
    console.log('🔍 Inspecting CORGI Token Metadata');
    console.log('=' .repeat(80));

    const corgiContractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energetic-corgi';
    
    try {
        // 1. Check token cache metadata
        console.log(`📋 Checking token cache for: ${corgiContractId}`);
        console.log('-'.repeat(60));
        
        const tokenMetadataKey = `token-metadata:${corgiContractId}`;
        const tokenMetadata = await kv.get(tokenMetadataKey);
        
        console.log('=== TOKEN METADATA ===');
        console.log(JSON.stringify(tokenMetadata, null, 2));
        
        if (tokenMetadata) {
            console.log('\n📊 METADATA ANALYSIS:');
            const metadata = tokenMetadata as any;
            
            // Check for LP token indicators
            console.log(`Name: ${metadata.name || 'N/A'}`);
            console.log(`Symbol: ${metadata.symbol || 'N/A'}`);
            console.log(`Description: ${metadata.description || 'N/A'}`);
            console.log(`Contract ID: ${metadata.contractId || 'N/A'}`);
            
            // Check for LP-specific fields
            console.log('\n🔍 LP TOKEN DETECTION FIELDS:');
            console.log(`tokenAContract: ${metadata.tokenAContract || 'N/A'}`);
            console.log(`tokenBContract: ${metadata.tokenBContract || 'N/A'}`);
            console.log(`type: ${metadata.type || 'N/A'}`);
            console.log(`base: ${metadata.base || 'N/A'}`);
            
            // Check name patterns for LP detection
            const nameContainsLiquidity = metadata.name?.toLowerCase().includes('liquidity') || false;
            const nameContainsLP = metadata.name?.toLowerCase().includes(' lp') || false;
            const contractIdContainsLP = metadata.contractId?.toLowerCase().includes('liquidity') || false;
            
            console.log('\n🎯 LP DETECTION PATTERNS:');
            console.log(`Name contains "liquidity": ${nameContainsLiquidity}`);
            console.log(`Name contains " lp": ${nameContainsLP}`);
            console.log(`Contract ID contains "liquidity": ${contractIdContainsLP}`);
            
            // Current detection logic analysis
            const currentDetection = !!(metadata.tokenAContract && metadata.tokenBContract);
            console.log(`\n❓ CURRENT DETECTION LOGIC RESULT: ${currentDetection}`);
            console.log(`Reason: Checks for tokenAContract && tokenBContract`);
            
            // Proposed enhanced detection
            const enhancedDetection = currentDetection || nameContainsLiquidity || contractIdContainsLP;
            console.log(`\n✨ ENHANCED DETECTION LOGIC RESULT: ${enhancedDetection}`);
            console.log(`Would detect via: ${nameContainsLiquidity ? 'name pattern' : contractIdContainsLP ? 'contract ID pattern' : 'existing logic'}`);
        }
        
        // 2. Check if there are multiple variations or aliases
        console.log('\n🔄 Checking for token variations...');
        const possibleVariations = [
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energetic-corgi',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-corgi',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.corgi-liquidity',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energetic-welsh'
        ];
        
        for (const variation of possibleVariations) {
            const variationKey = `token-metadata:${variation}`;
            const variationMetadata = await kv.get(variationKey);
            if (variationMetadata) {
                const metadata = variationMetadata as any;
                console.log(`\n✅ Found variation: ${variation}`);
                console.log(`   Name: ${metadata.name}`);
                console.log(`   Symbol: ${metadata.symbol}`);
                console.log(`   Has tokenAContract: ${!!metadata.tokenAContract}`);
                console.log(`   Has tokenBContract: ${!!metadata.tokenBContract}`);
            }
        }
        
        // 3. Search token cache for any token with "corgi" in name
        console.log('\n🔍 Searching for all tokens with "corgi" in metadata...');
        
        // Get all token metadata keys
        const allTokenKeys = await kv.keys('token-metadata:*');
        console.log(`Found ${allTokenKeys.length} total tokens in cache`);
        
        const corgiTokens = [];
        for (const key of allTokenKeys) {
            const metadata = await kv.get(key) as any;
            if (metadata && (
                metadata.name?.toLowerCase().includes('corgi') ||
                metadata.symbol?.toLowerCase().includes('corgi') ||
                metadata.contractId?.toLowerCase().includes('corgi')
            )) {
                corgiTokens.push({ key, metadata });
            }
        }
        
        if (corgiTokens.length > 0) {
            console.log(`\n🐕 Found ${corgiTokens.length} tokens with "corgi" references:`);
            corgiTokens.forEach(({ key, metadata }) => {
                console.log(`\n📦 ${key.replace('token-metadata:', '')}`);
                console.log(`   Name: ${metadata.name}`);
                console.log(`   Symbol: ${metadata.symbol}`);
                console.log(`   Type: ${metadata.type || 'N/A'}`);
                console.log(`   Has LP fields: ${!!(metadata.tokenAContract && metadata.tokenBContract)}`);
                
                // Check if this would be detected as LP with enhanced logic
                const wouldDetect = !!(
                    (metadata.tokenAContract && metadata.tokenBContract) ||
                    metadata.name?.toLowerCase().includes('liquidity') ||
                    metadata.contractId?.toLowerCase().includes('liquidity')
                );
                console.log(`   Enhanced LP detection: ${wouldDetect}`);
            });
        } else {
            console.log('❌ No tokens found with "corgi" references');
        }
        
    } catch (error) {
        console.error('❌ Error inspecting CORGI token:', error);
        console.error('Full error details:', error);
    }
}

// Show usage information
function showUsage() {
    console.log('Usage: pnpm script inspect-corgi-token');
    console.log('\nThis script inspects CORGI token metadata to understand');
    console.log('why it is not being detected as an LP token.');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsage();
    process.exit(0);
}

// Run the script
main().catch(console.error);
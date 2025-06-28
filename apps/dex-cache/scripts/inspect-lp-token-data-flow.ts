#!/usr/bin/env tsx

/**
 * Inspect LP token data flow to identify where isLpToken detection breaks
 * Usage: pnpm script inspect-lp-token-data-flow
 */

import { listVaultTokens, listVaults, getLpTokenMetadata } from '@/lib/pool-service';
import { getMultipleTokenPrices } from '@/lib/pricing/price-calculator';

async function main() {
    console.log('🔍 Inspecting LP token data flow...\n');

    try {
        // Step 1: Check vault data and LP token identification
        console.log('=== STEP 1: VAULT DATA INSPECTION ===');
        const allVaults = await listVaults();
        const poolVaults = allVaults.filter(vault => vault.type === 'POOL');
        
        console.log(`Total vaults: ${allVaults.length}`);
        console.log(`Pool vaults: ${poolVaults.length}`);
        
        // Take first 3 pool vaults for detailed inspection
        const testVaults = poolVaults.slice(0, 3);
        console.log('\n📋 Test Vaults:');
        testVaults.forEach((vault, i) => {
            console.log(`${i + 1}. ${vault.contractId}`);
            console.log(`   Symbol: ${vault.symbol || 'N/A'}`);
            console.log(`   Type: ${vault.type}`);
            console.log(`   Protocol: ${vault.protocol}`);
        });

        // Step 2: Check LP token metadata generation
        console.log('\n=== STEP 2: LP TOKEN METADATA GENERATION ===');
        const lpTokens = testVaults.map(vault => {
            const lpMeta = getLpTokenMetadata(vault);
            return {
                contractId: vault.contractId,
                symbol: lpMeta.symbol,
                name: lpMeta.name,
                decimals: lpMeta.decimals,
                image: vault.image || '',
                description: vault.description || '',
                isLpToken: true
            };
        });

        console.log('Generated LP token metadata:');
        lpTokens.forEach((token, i) => {
            console.log(`${i + 1}. ${token.contractId}`);
            console.log(`   Symbol: ${token.symbol}`);
            console.log(`   Name: ${token.name}`);
            console.log(`   Decimals: ${token.decimals}`);
            console.log(`   isLpToken: ${token.isLpToken}`);
        });

        // Step 3: Check regular vault tokens
        console.log('\n=== STEP 3: REGULAR VAULT TOKENS ===');
        const allTokens = await listVaultTokens();
        console.log(`Total regular tokens: ${allTokens.length}`);
        
        // Check if any regular tokens have isLpToken field
        const tokensWithLpFlag = allTokens.filter(token => (token as any).isLpToken);
        console.log(`Regular tokens with isLpToken flag: ${tokensWithLpFlag.length}`);
        
        // Show first few regular tokens
        console.log('\nSample regular tokens:');
        allTokens.slice(0, 3).forEach((token, i) => {
            console.log(`${i + 1}. ${token.contractId}`);
            console.log(`   Symbol: ${token.symbol}`);
            console.log(`   Name: ${token.name}`);
            console.log(`   isLpToken: ${(token as any).isLpToken || 'undefined'}`);
        });

        // Step 4: Combined tokens (as done in API)
        console.log('\n=== STEP 4: COMBINED TOKENS (API SIMULATION) ===');
        const combinedTokens = [...allTokens, ...lpTokens];
        console.log(`Combined total: ${combinedTokens.length}`);
        
        // Check LP tokens in combined list
        const lpTokensInCombined = combinedTokens.filter(token => (token as any).isLpToken);
        console.log(`LP tokens in combined list: ${lpTokensInCombined.length}`);
        
        console.log('\nLP tokens found in combined list:');
        lpTokensInCombined.forEach((token, i) => {
            console.log(`${i + 1}. ${token.contractId}`);
            console.log(`   Symbol: ${token.symbol}`);
            console.log(`   isLpToken: ${(token as any).isLpToken}`);
        });

        // Step 5: Price calculation and metadata lookup
        console.log('\n=== STEP 5: PRICE CALCULATION & METADATA LOOKUP ===');
        const testTokenIds = lpTokens.map(token => token.contractId);
        console.log(`Testing price calculation for: ${testTokenIds.join(', ')}`);
        
        const priceMap = await getMultipleTokenPrices(testTokenIds);
        console.log(`Prices calculated for ${priceMap.size} tokens`);
        
        // Check what happens during API response building
        console.log('\nAPI response building simulation:');
        Array.from(priceMap.entries()).forEach(([tokenId, priceData]) => {
            // Find token metadata from combined list (as API does)
            const tokenMeta = combinedTokens.find(t => t.contractId === tokenId);
            
            console.log(`\nToken: ${tokenId}`);
            console.log(`  Found metadata: ${!!tokenMeta}`);
            if (tokenMeta) {
                console.log(`  Metadata symbol: ${tokenMeta.symbol}`);
                console.log(`  Metadata isLpToken: ${(tokenMeta as any).isLpToken}`);
                console.log(`  Type of isLpToken: ${typeof (tokenMeta as any).isLpToken}`);
            }
            console.log(`  PriceData isLpToken: ${priceData.isLpToken}`);
            console.log(`  Final API isLpToken would be: ${!!(tokenMeta as any)?.isLpToken}`);
        });

        // Step 6: Type inspection
        console.log('\n=== STEP 6: TYPE INSPECTION ===');
        console.log('Regular token interface (first token):');
        const sampleRegularToken = allTokens[0];
        console.log('Properties:', Object.keys(sampleRegularToken));
        console.log('Has isLpToken:', 'isLpToken' in sampleRegularToken);
        
        console.log('\nLP token interface (first LP token):');
        const sampleLpToken = lpTokens[0];
        console.log('Properties:', Object.keys(sampleLpToken));
        console.log('Has isLpToken:', 'isLpToken' in sampleLpToken);

        // Step 7: Recommendation
        console.log('\n=== STEP 7: ANALYSIS & RECOMMENDATIONS ===');
        
        const regularTokenHasLpFlag = allTokens.some(token => 'isLpToken' in token);
        const lpTokenHasLpFlag = lpTokens.every(token => 'isLpToken' in token);
        
        console.log(`Regular tokens have isLpToken property: ${regularTokenHasLpFlag}`);
        console.log(`LP tokens have isLpToken property: ${lpTokenHasLpFlag}`);
        
        if (!regularTokenHasLpFlag && lpTokenHasLpFlag) {
            console.log('\n✅ ISSUE IDENTIFIED:');
            console.log('- Regular vault tokens do NOT have isLpToken property');
            console.log('- Generated LP tokens DO have isLpToken property');
            console.log('- When combined, only LP tokens have the flag');
            console.log('- API lookup should work correctly');
            console.log('\n🔧 LIKELY SOLUTION:');
            console.log('- Update TokenNode interface to include optional isLpToken field');
            console.log('- Ensure regular tokens default isLpToken to false');
            console.log('- Fix API line 175 logic');
        } else {
            console.log('\n❓ UNEXPECTED RESULT - Further investigation needed');
        }

    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        console.error('Full error:', error);
    }
}

// Show usage information
function showUsage() {
    console.log('Usage: pnpm script inspect-lp-token-data-flow');
    console.log('\nThis script inspects the data flow for LP token identification');
    console.log('and helps identify where the isLpToken flag gets lost.');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsage();
    process.exit(0);
}

// Run the script
main().catch(console.error);
#!/usr/bin/env tsx

/**
 * Validate that interface updates work correctly for isLpToken detection
 * Usage: pnpm script validate-updated-interfaces
 */

import { listVaultTokens, listVaults, getLpTokenMetadata } from '@/lib/pool-service';

async function main() {
    console.log('🔍 Validating updated interfaces for isLpToken detection...\n');

    try {
        // Test 1: Check regular vault tokens now have isLpToken: false
        console.log('=== TEST 1: REGULAR VAULT TOKENS ===');
        const allTokens = await listVaultTokens();
        console.log(`Total regular tokens: ${allTokens.length}`);
        
        const regularTokensWithLpFlag = allTokens.filter(token => token.isLpToken !== undefined);
        console.log(`Regular tokens with isLpToken property: ${regularTokensWithLpFlag.length}`);
        
        const regularTokensMarkedAsLp = allTokens.filter(token => token.isLpToken === true);
        console.log(`Regular tokens marked as LP: ${regularTokensMarkedAsLp.length}`);
        
        // Show first few regular tokens
        console.log('\nSample regular tokens:');
        allTokens.slice(0, 3).forEach((token, i) => {
            console.log(`${i + 1}. ${token.contractId}`);
            console.log(`   Symbol: ${token.symbol}`);
            console.log(`   isLpToken: ${token.isLpToken}`);
        });

        // Test 2: Check LP token generation
        console.log('\n=== TEST 2: LP TOKEN GENERATION ===');
        const allVaults = await listVaults();
        const testVaults = allVaults.slice(0, 3);
        console.log(`Testing with ${testVaults.length} pool vaults`);
        
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

        console.log('Generated LP tokens:');
        lpTokens.forEach((token, i) => {
            console.log(`${i + 1}. ${token.contractId}`);
            console.log(`   Symbol: ${token.symbol}`);
            console.log(`   isLpToken: ${token.isLpToken}`);
        });

        // Test 3: Combined list (API simulation)
        console.log('\n=== TEST 3: COMBINED LIST VALIDATION ===');
        const combinedTokens = [...allTokens, ...lpTokens];
        console.log(`Combined total: ${combinedTokens.length}`);
        
        const lpTokensInCombined = combinedTokens.filter(token => token.isLpToken === true);
        const regularTokensInCombined = combinedTokens.filter(token => token.isLpToken === false);
        const undefinedTokensInCombined = combinedTokens.filter(token => token.isLpToken === undefined);
        
        console.log(`LP tokens in combined: ${lpTokensInCombined.length}`);
        console.log(`Regular tokens in combined: ${regularTokensInCombined.length}`);
        console.log(`Undefined isLpToken in combined: ${undefinedTokensInCombined.length}`);

        // Test 4: API lookup simulation
        console.log('\n=== TEST 4: API LOOKUP SIMULATION ===');
        const testLpTokenId = lpTokens[0]?.contractId;
        const testRegularTokenId = allTokens[0]?.contractId;
        
        if (testLpTokenId) {
            const lpTokenMeta = combinedTokens.find(t => t.contractId === testLpTokenId);
            console.log(`LP Token lookup: ${testLpTokenId}`);
            console.log(`  Found: ${!!lpTokenMeta}`);
            console.log(`  isLpToken: ${lpTokenMeta?.isLpToken}`);
            console.log(`  API would return: ${!!(lpTokenMeta as any)?.isLpToken}`);
        }
        
        if (testRegularTokenId) {
            const regularTokenMeta = combinedTokens.find(t => t.contractId === testRegularTokenId);
            console.log(`Regular Token lookup: ${testRegularTokenId}`);
            console.log(`  Found: ${!!regularTokenMeta}`);
            console.log(`  isLpToken: ${regularTokenMeta?.isLpToken}`);
            console.log(`  API would return: ${!!(regularTokenMeta as any)?.isLpToken}`);
        }

        // Test 5: Validation results
        console.log('\n=== TEST 5: VALIDATION RESULTS ===');
        
        const allRegularHaveFlag = allTokens.every(token => token.isLpToken === false);
        const allLpHaveFlag = lpTokens.every(token => token.isLpToken === true);
        const noUndefinedInCombined = undefinedTokensInCombined.length === 0;
        
        console.log(`✅ All regular tokens have isLpToken: false - ${allRegularHaveFlag}`);
        console.log(`✅ All LP tokens have isLpToken: true - ${allLpHaveFlag}`);
        console.log(`✅ No undefined isLpToken in combined list - ${noUndefinedInCombined}`);
        
        if (allRegularHaveFlag && allLpHaveFlag && noUndefinedInCombined) {
            console.log('\n🎉 SUCCESS: Interface updates are working correctly!');
            console.log('   - Regular tokens properly marked as isLpToken: false');
            console.log('   - LP tokens properly marked as isLpToken: true');
            console.log('   - API lookup should now work correctly');
        } else {
            console.log('\n❌ ISSUES FOUND: Interface updates need further work');
        }

    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        console.error('Full error:', error);
    }
}

// Show usage information
function showUsage() {
    console.log('Usage: pnpm script validate-updated-interfaces');
    console.log('\nThis script validates that interface updates correctly handle isLpToken flags.');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsage();
    process.exit(0);
}

// Run the script
main().catch(console.error);
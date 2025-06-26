#!/usr/bin/env tsx

/**
 * Test the exact API call that simple-swap makes to get tokens
 * 
 * Usage: pnpm script test-api-call
 */

async function main() {
    console.log('🔍 Testing DEX Cache API Call');
    console.log('='.repeat(80));

    const apiUrl = 'http://localhost:3001/api/v1/tokens/all?type=all&nestLevel=0&includePricing=false';
    
    try {
        console.log(`📋 Making API call: ${apiUrl}`);
        console.log('-'.repeat(60));
        
        const response = await fetch(apiUrl, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }
        
        const result = await response.json();
        
        console.log('=== API RESPONSE METADATA ===');
        console.log(JSON.stringify(result.metadata, null, 2));
        
        // Look for CORGI in the results
        const corgiToken = result.data?.find((token: any) => 
            token.contractId?.includes('charismatic-corgi-liquidity') || 
            token.symbol === 'CORGI'
        );
        
        if (corgiToken) {
            console.log('\n✅ CORGI found in API response:');
            console.log(JSON.stringify(corgiToken, null, 2));
        } else {
            console.log('\n❌ CORGI not found in API response');
            
            // Show first few LP tokens to compare
            const lpTokens = result.data?.filter((token: any) => token.isLpToken);
            console.log(`\n📋 Found ${lpTokens?.length || 0} LP tokens in response`);
            console.log('First 3 LP tokens:');
            lpTokens?.slice(0, 3).forEach((token: any, index: number) => {
                console.log(`\n${index + 1}. ${token.contractId}`);
                console.log(`   Symbol: ${token.symbol}`);
                console.log(`   Name: ${token.name}`);
                console.log(`   isLpToken: ${token.isLpToken}`);
            });
        }
        
        // Count total tokens by type
        const tradeable = result.data?.filter((token: any) => !token.isLpToken).length || 0;
        const lp = result.data?.filter((token: any) => token.isLpToken).length || 0;
        
        console.log(`\n📊 Token counts:`);
        console.log(`   Tradeable: ${tradeable}`);
        console.log(`   LP: ${lp}`);
        console.log(`   Total: ${result.data?.length || 0}`);
        
    } catch (error) {
        console.error('❌ Error testing API call:', error);
        
        // Try production URL as fallback
        console.log('\n🔄 Trying production URL...');
        try {
            const prodUrl = 'https://dex-cache-charisma.vercel.app/api/v1/tokens/all?type=all&nestLevel=0&includePricing=false';
            console.log(`📋 Making production API call: ${prodUrl}`);
            
            const prodResponse = await fetch(prodUrl, {
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!prodResponse.ok) {
                throw new Error(`Production API request failed: ${prodResponse.status}`);
            }
            
            const prodResult = await prodResponse.json();
            
            console.log('=== PRODUCTION API RESPONSE METADATA ===');
            console.log(JSON.stringify(prodResult.metadata, null, 2));
            
            const prodCorgiToken = prodResult.data?.find((token: any) => 
                token.contractId?.includes('charismatic-corgi-liquidity') || 
                token.symbol === 'CORGI'
            );
            
            if (prodCorgiToken) {
                console.log('\n✅ CORGI found in production API response:');
                console.log(JSON.stringify(prodCorgiToken, null, 2));
            } else {
                console.log('\n❌ CORGI not found in production API response');
            }
            
        } catch (prodError) {
            console.error('❌ Production API also failed:', prodError);
        }
    }
}

// Show usage information
function showUsage() {
    console.log('Usage: pnpm script test-api-call');
    console.log('\nThis script tests the exact API call that simple-swap makes');
    console.log('to get tokens and checks if CORGI is included.');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsage();
    process.exit(0);
}

// Run the script
main().catch(console.error);
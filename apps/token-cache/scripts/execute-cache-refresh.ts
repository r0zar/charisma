// Execute cache refresh for the 17 tokens identified as needing improvements
import { refreshTokenData } from '../src/app/actions';

// List of tokens that were identified as needing cache refresh
// Based on the analysis from refresh-problematic-tokens.ts
const tokensToRefresh = [
    "SPA0SZQ6KCCYMJV5XVKSNM7Y1DGDXH39A11ZX2Y8.gamestop", // +40 points
    "SP1CYY7BKYD60R08K734K9SC6GRZD4ZSN4WCDE5BD.golf-is-boring", // +40 points  
    "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dmtoken-subnet", // +40 points
    "SP2P2DHZJDS1Y94NCPVQXJFEP7C6RNXFR8GVSQFE5.mooncat", // +40 points
    "SP1KBVBP3BJVN07BQK8B3V4GNWDB8FHAQ7NK89K3Q.synth-eth", // +40 points
    "SP1KBVBP3BJVN07BQK8B3V4GNWDB8FHAQ7NK89K3Q.synth-wbtc", // +40 points
    "SP1KBVBP3BJVN07BQK8B3V4GNWDB8FHAQ7NK89K3Q.synth-ltc", // +40 points
    "SP1KBVBP3BJVN07BQK8B3V4GNWDB8FHAQ7NK89K3Q.synth-doge", // +40 points
    "SP1KBVBP3BJVN07BQK8B3V4GNWDB8FHAQ7NK89K3Q.synth-sol", // +40 points
    "SP1KBVBP3BJVN07BQK8B3V4GNWDB8FHAQ7NK89K3Q.synth-pepe", // +40 points
    "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.univ2-share-fee-to", // +30 points
    "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.univ2-core", // +30 points
    "SP1KBVBP3BJVN07BQK8B3V4GNWDB8FHAQ7NK89K3Q.synth-bnb", // +30 points
    "SP2TVEV7QP7WP7FXRC3VSDG7ZW8W7YJQF24TCMCG6.btc-btc", // +20 points
    "SP1KBVBP3BJVN07BQK8B3V4GNWDB8FHAQ7NK89K3Q.synth-usdt", // +20 points
    "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-corgi", // +10 points
    "SP2470N2A31DGDHX541MK2FKJSRHSCW907S5KKYTR.babycat" // +10 points
];

interface RefreshResult {
    contractId: string;
    success: boolean;
    message?: string;
    error?: string;
    expectedImprovement: number;
}

async function executeRefresh() {
    console.log('🚀 Executing Cache Refresh for Identified Tokens');
    console.log('═'.repeat(60));
    console.log(`Total tokens to refresh: ${tokensToRefresh.length}`);
    console.log('');

    const results: RefreshResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    console.log('🔄 Processing tokens...');
    console.log('');

    for (let i = 0; i < tokensToRefresh.length; i++) {
        const contractId = tokensToRefresh[i];
        const expectedImprovement = getExpectedImprovement(contractId);
        
        console.log(`[${i + 1}/${tokensToRefresh.length}] Refreshing ${contractId}...`);
        console.log(`  Expected improvement: +${expectedImprovement} points`);

        try {
            const result = await refreshTokenData(contractId);
            
            if (result.success) {
                successCount++;
                console.log(`  ✅ Success: ${result.message || 'Cache refreshed'}`);
                
                results.push({
                    contractId,
                    success: true,
                    message: result.message,
                    expectedImprovement
                });
            } else {
                errorCount++;
                console.log(`  ❌ Failed: ${result.error || 'Unknown error'}`);
                
                results.push({
                    contractId,
                    success: false,
                    error: result.error,
                    expectedImprovement
                });
            }

            // Small delay between requests to be nice to the system
            if (i < tokensToRefresh.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

        } catch (error: any) {
            errorCount++;
            console.log(`  ❌ Exception: ${error.message}`);
            
            results.push({
                contractId,
                success: false,
                error: error.message,
                expectedImprovement
            });
        }

        console.log('');
    }

    // Summary Report
    console.log('📊 REFRESH EXECUTION RESULTS');
    console.log('═'.repeat(60));
    console.log(`Total processed: ${tokensToRefresh.length}`);
    console.log(`Successful refreshes: ${successCount}`);
    console.log(`Failed refreshes: ${errorCount}`);
    console.log(`Success rate: ${((successCount / tokensToRefresh.length) * 100).toFixed(1)}%`);
    console.log('');

    // Show successful refreshes
    const successfulRefreshes = results.filter(r => r.success);
    if (successfulRefreshes.length > 0) {
        console.log('✅ SUCCESSFUL REFRESHES:');
        console.log('─'.repeat(60));
        
        const totalExpectedImprovement = successfulRefreshes.reduce((sum, r) => sum + r.expectedImprovement, 0);
        console.log(`Total expected improvement: +${totalExpectedImprovement} points across ${successfulRefreshes.length} tokens`);
        console.log('');
        
        successfulRefreshes.forEach((result, index) => {
            console.log(`${index + 1}. ${result.contractId}`);
            console.log(`   Expected improvement: +${result.expectedImprovement} points`);
            if (result.message) {
                console.log(`   Message: ${result.message}`);
            }
            console.log('');
        });
    }

    // Show failed refreshes
    const failedRefreshes = results.filter(r => !r.success);
    if (failedRefreshes.length > 0) {
        console.log('❌ FAILED REFRESHES:');
        console.log('─'.repeat(60));
        
        failedRefreshes.forEach((result, index) => {
            console.log(`${index + 1}. ${result.contractId}`);
            console.log(`   Error: ${result.error || 'Unknown error'}`);
            console.log(`   Missed improvement: +${result.expectedImprovement} points`);
            console.log('');
        });

        console.log('💡 TROUBLESHOOTING FAILED REFRESHES:');
        console.log('1. Check if tokens are blacklisted');
        console.log('2. Verify contract IDs are valid');
        console.log('3. Check network connectivity and API limits');
        console.log('4. Review server logs for detailed error information');
        console.log('');
    }

    console.log('🎯 NEXT STEPS:');
    console.log('1. Verify improvements in your applications');
    console.log('2. Check that images and descriptions now appear correctly');
    console.log('3. Monitor token displays across the Charisma ecosystem');
    
    if (failedRefreshes.length > 0) {
        console.log('4. Investigate and retry failed refreshes if needed');
    }
    
    console.log('');
    console.log('✨ Cache refresh execution completed!');
}

function getExpectedImprovement(contractId: string): number {
    // Based on the analysis from refresh-problematic-tokens.ts
    const improvementMap: Record<string, number> = {
        "SPA0SZQ6KCCYMJV5XVKSNM7Y1DGDXH39A11ZX2Y8.gamestop": 40,
        "SP1CYY7BKYD60R08K734K9SC6GRZD4ZSN4WCDE5BD.golf-is-boring": 40,
        "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dmtoken-subnet": 40,
        "SP2P2DHZJDS1Y94NCPVQXJFEP7C6RNXFR8GVSQFE5.mooncat": 40,
        "SP1KBVBP3BJVN07BQK8B3V4GNWDB8FHAQ7NK89K3Q.synth-eth": 40,
        "SP1KBVBP3BJVN07BQK8B3V4GNWDB8FHAQ7NK89K3Q.synth-wbtc": 40,
        "SP1KBVBP3BJVN07BQK8B3V4GNWDB8FHAQ7NK89K3Q.synth-ltc": 40,
        "SP1KBVBP3BJVN07BQK8B3V4GNWDB8FHAQ7NK89K3Q.synth-doge": 40,
        "SP1KBVBP3BJVN07BQK8B3V4GNWDB8FHAQ7NK89K3Q.synth-sol": 40,
        "SP1KBVBP3BJVN07BQK8B3V4GNWDB8FHAQ7NK89K3Q.synth-pepe": 40,
        "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.univ2-share-fee-to": 30,
        "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.univ2-core": 30,
        "SP1KBVBP3BJVN07BQK8B3V4GNWDB8FHAQ7NK89K3Q.synth-bnb": 30,
        "SP2TVEV7QP7WP7FXRC3VSDG7ZW8W7YJQF24TCMCG6.btc-btc": 20,
        "SP1KBVBP3BJVN07BQK8B3V4GNWDB8FHAQ7NK89K3Q.synth-usdt": 20,
        "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-corgi": 10,
        "SP2470N2A31DGDHX541MK2FKJSRHSCW907S5KKYTR.babycat": 10
    };
    
    return improvementMap[contractId] || 0;
}

// Execute the refresh
executeRefresh().catch(error => {
    console.error('Fatal error during cache refresh execution:', error);
    process.exit(1);
});
// Test script for the Raven ID cache system
import { 
    updateRavenCache, 
    getUserRavenIds, 
    getHighestRavenId, 
    getCacheStats,
    getUserRavenDetails 
} from '../src/lib/raven-cache';

async function testRavenCache() {
    console.log('🧪 Testing Raven ID Cache System');
    console.log('='.repeat(80));
    
    const testAddress = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
    
    try {
        // Check initial cache state
        console.log('📊 Initial cache stats:');
        console.log(getCacheStats());
        console.log('');
        
        // Update the cache
        console.log('🔄 Updating Raven cache...');
        await updateRavenCache();
        console.log('');
        
        // Check cache stats after update
        console.log('📊 Cache stats after update:');
        const stats = getCacheStats();
        console.log(stats);
        console.log('');
        
        // Test getting Ravens for specific user
        console.log(`🔍 Checking Ravens owned by ${testAddress}:`);
        const userRavenIds = await getUserRavenIds(testAddress);
        const highestRavenId = await getHighestRavenId(testAddress);
        
        console.log(`✅ Raven IDs owned: ${userRavenIds.join(', ') || 'None'}`);
        console.log(`🎯 Highest Raven ID: ${highestRavenId}`);
        
        if (userRavenIds.length > 0) {
            console.log('');
            console.log('📋 Detailed Raven info:');
            const ravenDetails = await getUserRavenDetails(testAddress);
            for (const raven of ravenDetails) {
                console.log(`  Raven #${raven.id}: Owner ${raven.owner}`);
                console.log(`    Last updated: ${new Date(raven.lastUpdated).toISOString()}`);
            }
        }
        
        // Calculate fee discount using the contract formula
        if (highestRavenId > 0) {
            const baseReduction = 25; // 25%
            const variableReduction = Math.round((highestRavenId * 25) / 100);
            const totalDiscount = Math.min(baseReduction + variableReduction, 50);
            
            console.log('');
            console.log('💰 Fee Discount Calculation:');
            console.log(`  Base reduction: ${baseReduction}%`);
            console.log(`  Variable reduction: ${variableReduction}% (based on Raven #${highestRavenId})`);
            console.log(`  Total discount: ${totalDiscount}%`);
        }
        
        console.log('');
        console.log('✅ Raven cache test completed successfully!');
        
    } catch (error) {
        console.error('❌ Error testing Raven cache:', error);
    }
}

// Run the test
testRavenCache().catch(console.error);
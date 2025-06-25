// Script to initialize and manage the Raven ID cache
import { 
    updateRavenCache, 
    forceUpdateRavenCache,
    getCacheStats,
    getUserRavenIds,
    getHighestRavenId 
} from '../src/lib/raven-cache';

async function initializeRavenCache() {
    console.log('🚀 Initializing Raven ID Cache System');
    console.log('='.repeat(80));
    
    const startTime = Date.now();
    
    try {
        // Check if we should force update or regular update
        const args = process.argv.slice(2);
        const forceUpdate = args.includes('--force') || args.includes('-f');
        
        if (forceUpdate) {
            console.log('🔄 Force updating Raven cache...');
            await forceUpdateRavenCache();
        } else {
            console.log('🔄 Updating Raven cache (will skip if recent)...');
            await updateRavenCache();
        }
        
        // Show final cache statistics
        const stats = getCacheStats();
        const duration = Date.now() - startTime;
        
        console.log('');
        console.log('📊 FINAL CACHE STATISTICS:');
        console.log('='.repeat(50));
        console.log(`📦 Total Ravens tracked: ${stats.totalRavens}`);
        console.log(`👥 Total unique owners: ${stats.totalOwners}`);
        console.log(`⏰ Last update: ${new Date(stats.lastUpdate).toISOString()}`);
        console.log(`📈 Cache age: ${Math.round(stats.cacheAge / 1000)}s`);
        console.log(`⚡ Update duration: ${Math.round(duration / 1000)}s`);
        
        // Test with a few sample addresses
        console.log('');
        console.log('🧪 TESTING WITH SAMPLE ADDRESSES:');
        console.log('='.repeat(50));
        
        const testAddresses = [
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS', // Contract deployer
            'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ', // Another known address
        ];
        
        for (const address of testAddresses) {
            console.log(`\n🔍 Testing address: ${address.slice(0, 8)}...${address.slice(-8)}`);
            try {
                const ravenIds = await getUserRavenIds(address);
                const highestId = await getHighestRavenId(address);
                
                if (ravenIds.length > 0) {
                    console.log(`  ✅ Owns ${ravenIds.length} Ravens: ${ravenIds.join(', ')}`);
                    console.log(`  🎯 Highest ID: ${highestId}`);
                    
                    // Calculate fee discount
                    const baseReduction = 25;
                    const variableReduction = Math.round((highestId * 25) / 100);
                    const totalDiscount = Math.min(baseReduction + variableReduction, 50);
                    console.log(`  💰 Fee discount: ${totalDiscount}% (${baseReduction}% + ${variableReduction}%)`);
                } else {
                    console.log(`  ❌ No Ravens owned`);
                }
            } catch (error) {
                console.log(`  ⚠️ Error: ${error.message}`);
            }
        }
        
        console.log('');
        console.log('✅ Raven cache initialization completed successfully!');
        console.log('');
        console.log('💡 Usage tips:');
        console.log('  - Cache automatically updates every 30 minutes');
        console.log('  - Use --force flag to force immediate update');
        console.log('  - Cache persists in memory while the app is running');
        
    } catch (error) {
        console.error('❌ Failed to initialize Raven cache:', error);
        process.exit(1);
    }
}

// Parse command line arguments and show help
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    console.log('Raven Cache Initialization Script');
    console.log('');
    console.log('Usage:');
    console.log('  pnpm tsx scripts/initialize-raven-cache.ts [options]');
    console.log('');
    console.log('Options:');
    console.log('  --force, -f    Force update cache even if recent');
    console.log('  --help, -h     Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  pnpm tsx scripts/initialize-raven-cache.ts');
    console.log('  pnpm tsx scripts/initialize-raven-cache.ts --force');
    process.exit(0);
}

// Run the initialization
initializeRavenCache().catch(console.error);
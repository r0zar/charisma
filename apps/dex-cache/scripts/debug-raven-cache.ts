import { getUserRavenIds, getHighestRavenId } from '@/lib/raven-cache';

const userAddress = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';

async function debugRavenCache() {
    console.log('🔍 Debugging Raven cache for:', userAddress);
    
    try {
        const ravenIds = await getUserRavenIds(userAddress);
        console.log('🐦 Your Raven IDs:', ravenIds);
        
        const highestId = await getHighestRavenId(userAddress);
        console.log('🎯 Highest Raven ID:', highestId);
        
        // Calculate what the discount should be
        const baseReduction = 25;
        const variableReduction = Math.round((highestId * 25) / 100);
        const expectedDiscount = Math.min(baseReduction + variableReduction, 50);
        console.log(`💰 Expected discount: ${baseReduction}% + ${variableReduction}% = ${expectedDiscount}%`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

debugRavenCache().catch(console.error);
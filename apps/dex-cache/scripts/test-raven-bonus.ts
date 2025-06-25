import { clearNFTBonusCache, getNFTBonuses } from '@/lib/nft-service';
import { getHighestRavenId } from '@/lib/raven-cache';

const userAddress = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';

async function testRavenBonus() {
    console.log('🧪 Testing Raven bonus calculation...');
    
    // Clear cache to force fresh calculation
    clearNFTBonusCache();
    
    try {
        // Test direct Raven cache
        console.log('\n🔍 Testing Raven cache directly:');
        const highestRavenId = await getHighestRavenId(userAddress);
        console.log(`- Highest Raven ID: ${highestRavenId}`);
        
        // Calculate expected discount
        const baseReduction = 25;
        const variableReduction = Math.round((highestRavenId * 25) / 100);
        const expectedDiscount = Math.min(baseReduction + variableReduction, 50);
        console.log(`- Expected calculation: ${baseReduction}% + ${variableReduction}% = ${expectedDiscount}%`);
        
        // Test full NFT bonus service
        console.log('\n🎯 Testing full NFT bonus service:');
        const bonuses = await getNFTBonuses(userAddress);
        console.log(`- Fee discount from service: ${bonuses.feeDiscountBonus}%`);
        console.log(`- Energy generation bonus: ${bonuses.energyGenerationBonus}%`);
        console.log(`- Capacity bonus: ${bonuses.capacityBonus / 1000000} energy`);
        
        console.log('\n📊 Full bonuses object:');
        console.log(JSON.stringify(bonuses, null, 2));
        
        if (bonuses.feeDiscountBonus !== expectedDiscount) {
            console.log(`❌ MISMATCH! Expected ${expectedDiscount}% but got ${bonuses.feeDiscountBonus}%`);
        } else {
            console.log(`✅ Calculation matches! ${bonuses.feeDiscountBonus}%`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testRavenBonus().catch(console.error);
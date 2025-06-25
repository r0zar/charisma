import { getNFTBonuses } from '@/lib/nft-service';

const userAddress = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';

async function debugNFTBonuses() {
    console.log('🔍 Debugging NFT bonuses for:', userAddress);
    
    try {
        const bonuses = await getNFTBonuses(userAddress);
        
        console.log('📊 Raw bonuses object:');
        console.log(JSON.stringify(bonuses, null, 2));
        
        console.log('\n✨ Formatted summary:');
        console.log(`- Welsh NFTs: ${bonuses.totalWelshCount} → +${bonuses.energyGenerationBonus}% energy generation`);
        console.log(`- Raven NFTs: ${bonuses.totalRavenCount} → -${bonuses.feeDiscountBonus}% fee discount`);
        console.log(`- Memobot NFTs: ${bonuses.totalMemobotCount} → +${bonuses.capacityBonus / 1000000} energy capacity`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

debugNFTBonuses().catch(console.error);
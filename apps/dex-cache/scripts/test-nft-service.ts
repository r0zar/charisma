// Test script for the new NFT service
import { getNFTBonuses, testNFTBonuses } from '../src/lib/nft-service';

async function testNFTService() {
    console.log('🧪 Testing NFT Bonus Service');
    console.log('='.repeat(60));

    const testAddress = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
    
    console.log(`📋 Testing NFT bonuses for: ${testAddress}`);
    console.log('-'.repeat(40));

    try {
        const bonuses = await getNFTBonuses(testAddress);
        
        console.log('✅ NFT service test completed!');
        console.log('\n🎯 Bonus Results:');
        console.log(`   Welsh NFTs: ${bonuses.totalWelshCount} (+${bonuses.energyGenerationBonus}% energy generation)`);
        console.log(`   Raven NFTs: ${bonuses.totalRavenCount} (-${bonuses.feeDiscountBonus}% fees)`);
        console.log(`   Memobot NFTs: ${bonuses.totalMemobotCount} (+${bonuses.capacityBonus / 1000000} energy capacity)`);
        
        console.log('\n📊 Detailed Collections:');
        if (bonuses.welshNFTs.length > 0) {
            console.log('   Welsh Collections:');
            bonuses.welshNFTs.forEach(collection => {
                console.log(`     - ${collection.name}: ${collection.totalCount} NFTs`);
            });
        }
        
        if (bonuses.ravenNFTs.length > 0) {
            console.log('   Raven Collections:');
            bonuses.ravenNFTs.forEach(collection => {
                console.log(`     - ${collection.name}: ${collection.totalCount} NFTs`);
            });
        }
        
        if (bonuses.memobotNFTs.length > 0) {
            console.log('   Memobot Collections:');
            bonuses.memobotNFTs.forEach(collection => {
                console.log(`     - ${collection.name}: ${collection.totalCount} NFTs`);
            });
        }
        
        return bonuses;
        
    } catch (error) {
        console.error('❌ NFT service test failed:', error);
        process.exit(1);
    }
}

// Run the test
testNFTService().catch(console.error);
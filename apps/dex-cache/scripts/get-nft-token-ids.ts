// Get specific NFT token IDs owned by a user
import { callReadOnlyFunction } from '@repo/polyglot';
import { uintCV, principalCV } from '@stacks/transactions';

async function getNFTTokenIds(userAddress: string) {
    console.log('🔍 Getting specific NFT token IDs...');
    console.log('='.repeat(80));

    const ravenContract = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.odins-raven';

    console.log(`👤 User: ${userAddress}`);
    console.log(`🐦 Raven Contract: ${ravenContract}`);
    console.log('-'.repeat(60));

    try {
        // Method 1: Try to get balance for the user
        console.log('📊 Method 1: Checking get-balance...');
        try {
            const balance = await callReadOnlyFunction(
                'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
                'odins-raven',
                'get-balance',
                [principalCV(userAddress)],
            );
            console.log('✅ Balance result:', balance);
        } catch (error: any) {
            console.log('❌ get-balance failed:', error.message);
        }

        // Method 2: Check ownership of specific Raven IDs (1-100)
        console.log('\n🔍 Method 2: Checking ownership of Ravens 1-100...');
        const ownedRavens: number[] = [];

        // Check in batches to avoid overwhelming the API
        for (let i = 1; i <= 100; i += 10) {
            const promises = [];
            for (let j = i; j < Math.min(i + 10, 101); j++) {
                promises.push(
                    callReadOnlyFunction(
                        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
                        'odins-raven',
                        'get-owner',
                        [uintCV(j)],
                    ).then(result => ({ id: j, owner: result }))
                        .catch((error: any) => ({ id: j, error: error.message }))
                );
            }

            const results = await Promise.all(promises);

            for (const result of results) {
                if ('owner' in result && result.owner) {
                    // Check if owner matches our user
                    const ownerStr = result.owner.toString();
                    if (ownerStr.includes(userAddress)) {
                        ownedRavens.push(result.id);
                        console.log(`✅ Raven #${result.id}: Owned by user`);
                    }
                } else if ('error' in result) {
                    console.log(`❌ Raven #${result.id}: ${result.error}`);
                }
            }

            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log('\n🎯 SUMMARY:');
        console.log('-'.repeat(40));
        console.log(`Total Ravens owned: ${ownedRavens.length}`);
        if (ownedRavens.length > 0) {
            console.log(`Owned Raven IDs: ${ownedRavens.join(', ')}`);
            console.log(`Highest Raven ID: ${Math.max(...ownedRavens)}`);

            // Calculate proper discount based on highest ID
            const highestId = Math.max(...ownedRavens);
            const baseReduction = 25; // 25%
            const variableReduction = Math.round((highestId * 25) / 100); // Up to 25% more
            const totalDiscount = Math.min(baseReduction + variableReduction, 50);

            console.log(`🎯 Calculated fee discount: ${totalDiscount}%`);
            console.log(`  - Base reduction: ${baseReduction}%`);
            console.log(`  - Variable reduction: ${variableReduction}% (based on Raven #${highestId})`);
        } else {
            console.log('No Ravens owned');
        }

    } catch (error: any) {
        console.error('❌ Error getting NFT token IDs:', error);
    }
}

// Run with the test address
getNFTTokenIds('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS').catch(console.error);
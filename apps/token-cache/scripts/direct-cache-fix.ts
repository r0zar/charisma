// Direct cache update bypassing server actions to avoid revalidatePath issues
import { getTokenData } from '../src/lib/tokenService';
import { Cryptonomicon } from '../src/lib/cryptonomicon';

async function directCacheFix() {
    console.log('🔧 Direct Cache Fix for Missing Images');
    console.log('═'.repeat(60));
    console.log('');

    const problematicTokens = [
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.anime-demon-girl'
    ];

    const cryptonomicon = new Cryptonomicon({ 
        debug: false,
        apiKey: process.env.HIRO_API_KEY 
    });

    for (const contractId of problematicTokens) {
        console.log(`🎯 Processing ${contractId}...`);
        console.log('');

        try {
            // Step 1: Check current cache state
            console.log('📋 Step 1: Current cache state');
            const beforeData = await getTokenData(contractId, false);
            console.log('Before refresh:');
            console.log(`  Name: ${beforeData?.name || 'N/A'}`);
            console.log(`  Symbol: ${beforeData?.symbol || 'N/A'}`);
            console.log(`  Image: ${beforeData?.image ? '✅ ' + beforeData.image.substring(0, 60) + '...' : '❌ Missing'}`);
            console.log(`  Description: ${beforeData?.description ? '✅ Present' : '❌ Missing'}`);
            console.log(`  Identifier: ${beforeData?.identifier || 'N/A'}`);
            console.log('');

            // Step 2: Force refresh via direct service call
            console.log('🔄 Step 2: Direct cache refresh');
            console.log('Calling getTokenData with forceRefresh=true...');
            const afterData = await getTokenData(contractId, true);
            
            if (afterData) {
                console.log('After refresh:');
                console.log(`  Name: ${afterData.name || 'N/A'}`);
                console.log(`  Symbol: ${afterData.symbol || 'N/A'}`);
                console.log(`  Image: ${afterData.image ? '✅ ' + afterData.image.substring(0, 60) + '...' : '❌ Missing'}`);
                console.log(`  Description: ${afterData.description ? '✅ Present' : '❌ Missing'}`);
                console.log(`  Identifier: ${afterData.identifier || 'N/A'}`);
                console.log(`  Total Supply: ${afterData.total_supply || 'N/A'}`);
                console.log('');

                // Step 3: Compare results
                console.log('📊 Step 3: Comparison Results');
                const beforeImage = !!(beforeData?.image && beforeData.image.trim() !== '');
                const afterImage = !!(afterData.image && afterData.image.trim() !== '');
                const beforeDesc = !!(beforeData?.description && beforeData.description.trim() !== '');
                const afterDesc = !!(afterData.description && afterData.description.trim() !== '');

                if (!beforeImage && afterImage) {
                    console.log('✅ SUCCESS: Image was added!');
                    console.log(`   New image: ${afterData.image}`);
                }
                if (!beforeDesc && afterDesc) {
                    console.log('✅ SUCCESS: Description was added!');
                    console.log(`   New description: ${afterData.description}`);
                }
                if (beforeImage === afterImage && beforeDesc === afterDesc) {
                    console.log('ℹ️  No changes detected - data may already be up to date');
                }

                // Step 4: Verify cache persistence
                console.log('');
                console.log('🔍 Step 4: Verify cache persistence');
                console.log('Re-fetching from cache to verify...');
                const verifyData = await getTokenData(contractId, false);
                
                if (verifyData) {
                    const verifyImage = !!(verifyData.image && verifyData.image.trim() !== '');
                    const verifyDesc = !!(verifyData.description && verifyData.description.trim() !== '');
                    
                    console.log('Cache verification:');
                    console.log(`  Image persisted: ${verifyImage ? '✅' : '❌'}`);
                    console.log(`  Description persisted: ${verifyDesc ? '✅' : '❌'}`);
                    
                    if (verifyImage && verifyDesc) {
                        console.log('');
                        console.log('🎉 COMPLETE SUCCESS: Token now has image and description in cache!');
                    } else {
                        console.log('');
                        console.log('⚠️  Partial success: Some data may not have persisted');
                    }
                } else {
                    console.log('❌ Cache verification failed - no data returned');
                }

            } else {
                console.log('❌ Force refresh returned null - token may not exist or have issues');
            }

            console.log('');
            console.log('─'.repeat(60));
            console.log('');

        } catch (error: any) {
            console.log(`❌ Error processing ${contractId}: ${error.message}`);
            console.log('');
        }
    }

    console.log('🎯 FINAL VERIFICATION');
    console.log('═'.repeat(60));
    console.log('');
    
    // Final check on the problematic token
    try {
        const finalCheck = await getTokenData('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.anime-demon-girl', false);
        
        if (finalCheck) {
            const hasImage = !!(finalCheck.image && finalCheck.image.trim() !== '');
            const hasDescription = !!(finalCheck.description && finalCheck.description.trim() !== '');
            
            console.log('Final status for anime-demon-girl:');
            console.log(`✅ Name: ${finalCheck.name}`);
            console.log(`✅ Symbol: ${finalCheck.symbol}`);
            console.log(`${hasImage ? '✅' : '❌'} Image: ${hasImage ? finalCheck.image : 'Missing'}`);
            console.log(`${hasDescription ? '✅' : '❌'} Description: ${hasDescription ? 'Present' : 'Missing'}`);
            console.log(`✅ Identifier: ${finalCheck.identifier}`);
            
            if (hasImage && hasDescription) {
                console.log('');
                console.log('🚀 MISSION ACCOMPLISHED!');
                console.log('The anime-demon-girl token now has complete metadata including image.');
                console.log('');
                console.log('💡 The issue was that the enhanced metadata system was working correctly,');
                console.log('   but the cache needed to be refreshed to pick up the improvements.');
            } else {
                console.log('');
                console.log('⚠️  Issue persists. Recommended next steps:');
                console.log('1. Check if external metadata sources are accessible');
                console.log('2. Verify fallback image generation is working');
                console.log('3. Check cache invalidation mechanisms');
            }
        } else {
            console.log('❌ Final verification failed - no data returned for anime-demon-girl');
        }
    } catch (error: any) {
        console.log(`❌ Final verification error: ${error.message}`);
    }

    console.log('');
    console.log('✨ Direct cache fix completed!');
}

directCacheFix();
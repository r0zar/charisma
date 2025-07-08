// Targeted fix for tokens where fresh metadata has images but cache doesn't
import { refreshTokenData } from '../src/app/actions';
import { Cryptonomicon } from '../src/lib/cryptonomicon';
import { getTokenData } from '../src/lib/tokenService';

interface FixResult {
    contractId: string;
    beforeRefresh: {
        hasImage: boolean;
        imageUrl: string | null;
        hasDescription: boolean;
        score: number;
    };
    afterRefresh: {
        success: boolean;
        hasImage: boolean;
        imageUrl: string | null;
        hasDescription: boolean;
        score: number;
        error?: string;
    };
    fixed: boolean;
}

function calculateMetadataScore(metadata: any): number {
    let score = 100;
    if (!metadata.name || metadata.name.trim() === '') score -= 30;
    if (!metadata.symbol || metadata.symbol.trim() === '') score -= 30;
    if (!metadata.identifier || metadata.identifier.trim() === '') score -= 30;
    if (metadata.decimals === undefined || metadata.decimals === null) score -= 30;
    if (!metadata.description || metadata.description.trim() === '') score -= 10;
    if (!metadata.image || metadata.image.trim() === '') score -= 10;
    if (!metadata.total_supply && metadata.total_supply !== 0) score -= 2;
    return Math.max(0, score);
}

async function fixMissingImages() {
    console.log('🔧 Targeted Fix for Missing Images');
    console.log('═'.repeat(60));
    console.log('');

    // Focus on the specific problematic token and a few others we know need fixing
    const problematicTokens = [
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.anime-demon-girl',
        // Add any other tokens that validation showed as missing images
    ];

    console.log(`🎯 Targeting ${problematicTokens.length} specific tokens for image fixes`);
    console.log('');

    const cryptonomicon = new Cryptonomicon({
        debug: false,
        apiKey: process.env.HIRO_API_KEY
    });

    const results: FixResult[] = [];

    for (let i = 0; i < problematicTokens.length; i++) {
        const contractId = problematicTokens[i];
        console.log(`[${i + 1}/${problematicTokens.length}] Processing ${contractId}...`);

        try {
            // Step 1: Check current cache state
            console.log('  📋 Checking current cache state...');
            const beforeData = await getTokenData(contractId, false);

            const beforeState = {
                hasImage: !!(beforeData?.image && beforeData.image.trim() !== ''),
                imageUrl: beforeData?.image || null,
                hasDescription: !!(beforeData?.description && beforeData.description.trim() !== ''),
                score: beforeData ? calculateMetadataScore(beforeData) : 0
            };

            console.log(`     Before - Image: ${beforeState.hasImage ? '✅' : '❌'}, Score: ${beforeState.score}/100`);
            if (beforeState.imageUrl) {
                console.log(`     Current image: ${beforeState.imageUrl.substring(0, 60)}...`);
            }

            // Step 2: Check what fresh metadata would provide
            console.log('  🔍 Checking enhanced metadata generation...');
            const freshData = await cryptonomicon.getTokenMetadata(contractId);

            if (freshData) {
                const freshHasImage = !!(freshData.image && freshData.image.trim() !== '');
                const freshHasDescription = !!(freshData.description && freshData.description.trim() !== '');
                console.log(`     Fresh - Image: ${freshHasImage ? '✅' : '❌'}, Description: ${freshHasDescription ? '✅' : '❌'}`);

                if (freshData.image) {
                    console.log(`     Fresh image: ${freshData.image.substring(0, 60)}...`);
                }
            } else {
                console.log('     ❌ No fresh metadata available');
            }

            // Step 3: Force refresh if cache is missing data that fresh generation has
            if (freshData &&
                ((!beforeState.hasImage && freshData.image) ||
                    (!beforeState.hasDescription && freshData.description))) {

                console.log('  🔄 Cache missing data that fresh generation provides - forcing refresh...');

                const refreshResult = await refreshTokenData(contractId);

                if (refreshResult.success) {
                    console.log('  ✅ Refresh completed successfully');

                    // Step 4: Verify the fix worked
                    console.log('  🔍 Verifying cache update...');
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay for cache propagation

                    const afterData = await getTokenData(contractId, false);
                    const afterState = {
                        success: true,
                        hasImage: !!(afterData?.image && afterData.image.trim() !== ''),
                        imageUrl: afterData?.image || null,
                        hasDescription: !!(afterData?.description && afterData.description.trim() !== ''),
                        score: afterData ? calculateMetadataScore(afterData) : 0
                    };

                    console.log(`     After - Image: ${afterState.hasImage ? '✅' : '❌'}, Score: ${afterState.score}/100`);
                    if (afterState.imageUrl) {
                        console.log(`     New image: ${afterState.imageUrl.substring(0, 60)}...`);
                    }

                    const fixed = (!beforeState.hasImage && afterState.hasImage) ||
                        (!beforeState.hasDescription && afterState.hasDescription) ||
                        (afterState.score > beforeState.score);

                    results.push({
                        contractId,
                        beforeRefresh: beforeState,
                        afterRefresh: afterState,
                        fixed
                    });

                    if (fixed) {
                        console.log('  🎉 SUCCESS: Token metadata improved!');
                        const improvements: string[] = [];
                        if (!beforeState.hasImage && afterState.hasImage) improvements.push('Added image');
                        if (!beforeState.hasDescription && afterState.hasDescription) improvements.push('Added description');
                        if (afterState.score > beforeState.score) improvements.push(`Score +${afterState.score - beforeState.score}`);
                        console.log(`     Improvements: ${improvements.join(', ')}`);
                    } else {
                        console.log('  ⚠️  Refresh completed but no improvements detected');
                    }

                } else {
                    console.log(`  ❌ Refresh failed: ${refreshResult.error}`);
                    results.push({
                        contractId,
                        beforeRefresh: beforeState,
                        afterRefresh: {
                            success: false,
                            hasImage: false,
                            imageUrl: null,
                            hasDescription: false,
                            score: 0,
                            error: refreshResult.error
                        },
                        fixed: false
                    });
                }
            } else {
                console.log('  ➖ No refresh needed - cache already has all available data');
                results.push({
                    contractId,
                    beforeRefresh: beforeState,
                    afterRefresh: {
                        success: true,
                        hasImage: beforeState.hasImage,
                        imageUrl: beforeState.imageUrl,
                        hasDescription: beforeState.hasDescription,
                        score: beforeState.score
                    },
                    fixed: false
                });
            }

        } catch (error: any) {
            console.log(`  ❌ Error processing ${contractId}: ${error.message}`);
            results.push({
                contractId,
                beforeRefresh: {
                    hasImage: false,
                    imageUrl: null,
                    hasDescription: false,
                    score: 0
                },
                afterRefresh: {
                    success: false,
                    hasImage: false,
                    imageUrl: null,
                    hasDescription: false,
                    score: 0,
                    error: error.message
                },
                fixed: false
            });
        }

        console.log('');
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Final Report
    console.log('📊 FIX RESULTS SUMMARY');
    console.log('═'.repeat(60));

    const successful = results.filter(r => r.fixed);
    const failed = results.filter(r => !r.fixed && r.afterRefresh.error);
    const noChangeNeeded = results.filter(r => !r.fixed && !r.afterRefresh.error);

    console.log(`Total tokens processed: ${results.length}`);
    console.log(`Successfully fixed: ${successful.length}`);
    console.log(`Failed to fix: ${failed.length}`);
    console.log(`No change needed: ${noChangeNeeded.length}`);
    console.log('');

    if (successful.length > 0) {
        console.log('✅ SUCCESSFULLY FIXED:');
        console.log('─'.repeat(60));
        successful.forEach((result, index) => {
            console.log(`${index + 1}. ${result.contractId}`);
            console.log(`   Before: Score ${result.beforeRefresh.score}, Image: ${result.beforeRefresh.hasImage ? 'Yes' : 'No'}`);
            console.log(`   After:  Score ${result.afterRefresh.score}, Image: ${result.afterRefresh.hasImage ? 'Yes' : 'No'}`);
            if (result.afterRefresh.imageUrl) {
                console.log(`   Image: ${result.afterRefresh.imageUrl.substring(0, 80)}...`);
            }
            console.log('');
        });
    }

    if (failed.length > 0) {
        console.log('❌ FAILED TO FIX:');
        console.log('─'.repeat(60));
        failed.forEach((result, index) => {
            console.log(`${index + 1}. ${result.contractId}`);
            console.log(`   Error: ${result.afterRefresh.error}`);
            console.log('');
        });
    }

    console.log('🎯 NEXT STEPS:');
    if (successful.length > 0) {
        console.log('1. ✅ Verify fixed tokens now display images correctly in applications');
        console.log('2. 📱 Check token displays across the Charisma ecosystem');
    }
    if (failed.length > 0) {
        console.log('3. 🔍 Investigate failed fixes for root cause analysis');
        console.log('4. 🛠️  Consider alternative approaches for persistent failures');
    }
    console.log('5. 🔄 Run full ecosystem validation to identify any remaining issues');

    console.log('');
    console.log('✨ Targeted image fix completed!');
}

fixMissingImages();
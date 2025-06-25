// Validate current token metadata and identify missing images
import { listTokens } from '@repo/tokens';
import { Cryptonomicon } from '../src/lib/cryptonomicon';
import { getTokenData } from '../src/lib/tokenService';

interface ValidationResult {
    contractId: string;
    cachedData: any | null;
    freshData: any | null;
    hasImage: boolean;
    imageUrl: string | null;
    hasDescription: boolean;
    hasIdentifier: boolean;
    metadataScore: number;
    issues: string[];
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

function identifyIssues(metadata: any): string[] {
    const issues = [];
    if (!metadata.image || metadata.image.trim() === '') issues.push('Missing image');
    if (!metadata.description || metadata.description.trim() === '') issues.push('Missing description');
    if (!metadata.identifier || metadata.identifier.trim() === '') issues.push('Missing identifier');
    if (!metadata.name || metadata.name.trim() === '') issues.push('Missing name');
    if (!metadata.symbol || metadata.symbol.trim() === '') issues.push('Missing symbol');
    if (metadata.decimals === undefined || metadata.decimals === null) issues.push('Missing decimals');
    return issues;
}

async function validateTokenImages() {
    console.log('🔍 Validating Current Token Images and Metadata');
    console.log('═'.repeat(70));
    console.log('');

    try {
        // Get all tokens from the current cache
        console.log('📥 Fetching all cached tokens...');
        const cachedTokens = await listTokens();
        console.log(`Found ${cachedTokens.length} tokens in cache`);
        console.log('');

        // Focus on the specific token mentioned and a sample
        const testTokens = [
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.anime-demon-girl',
            'SPA0SZQ6KCCYMJV5XVKSNM7Y1DGDXH39A11ZX2Y8.gamestop',
            'SP1CYY7BKYD60R08K734K9SC6GRZD4ZSN4WCDE5BD.golf-is-boring',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-corgi'
        ];

        // Also sample some tokens from the cache
        const sampleTokens = cachedTokens.slice(0, 10);
        const allTestTokens = [...new Set([...testTokens, ...sampleTokens.map(t => t.contractId)])];

        console.log(`🧪 Testing ${allTestTokens.length} tokens (specific + sample):`);
        console.log('');

        const cryptonomicon = new Cryptonomicon({ 
            debug: false,
            apiKey: process.env.HIRO_API_KEY 
        });

        const results: ValidationResult[] = [];
        let tokensWithImages = 0;
        let tokensWithDescriptions = 0;
        let tokensWithIdentifiers = 0;

        for (let i = 0; i < allTestTokens.length; i++) {
            const contractId = allTestTokens[i];
            console.log(`[${i + 1}/${allTestTokens.length}] Validating ${contractId}...`);

            try {
                // Get cached data
                const cachedData = await getTokenData(contractId, false);
                
                // Get fresh data to compare
                const freshData = await cryptonomicon.getTokenMetadata(contractId);

                const hasImage = !!(cachedData?.image && cachedData.image.trim() !== '');
                const hasDescription = !!(cachedData?.description && cachedData.description.trim() !== '');
                const hasIdentifier = !!(cachedData?.identifier && cachedData.identifier.trim() !== '');
                
                if (hasImage) tokensWithImages++;
                if (hasDescription) tokensWithDescriptions++;
                if (hasIdentifier) tokensWithIdentifiers++;

                const result: ValidationResult = {
                    contractId,
                    cachedData,
                    freshData,
                    hasImage,
                    imageUrl: cachedData?.image || null,
                    hasDescription,
                    hasIdentifier,
                    metadataScore: cachedData ? calculateMetadataScore(cachedData) : 0,
                    issues: cachedData ? identifyIssues(cachedData) : ['No cached data']
                };

                results.push(result);

                // Show status
                const status = hasImage ? '✅' : '❌';
                const imageInfo = hasImage ? 
                    `Image: ${cachedData.image.substring(0, 60)}${cachedData.image.length > 60 ? '...' : ''}` : 
                    'No image';
                
                console.log(`  ${status} ${imageInfo}`);
                
                if (result.issues.length > 0) {
                    console.log(`  ⚠️  Issues: ${result.issues.join(', ')}`);
                }

                // Compare cached vs fresh if available
                if (freshData && cachedData) {
                    const freshHasImage = !!(freshData.image && freshData.image.trim() !== '');
                    const cachedHasImage = !!(cachedData.image && cachedData.image.trim() !== '');
                    
                    if (freshHasImage && !cachedHasImage) {
                        console.log(`  🔄 Fresh data has image but cache doesn't - needs refresh`);
                    } else if (!freshHasImage && !cachedHasImage) {
                        console.log(`  💡 No image available from any source`);
                    }
                }

                console.log('');

                // Small delay to be nice to APIs
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error: any) {
                console.log(`  ❌ Error: ${error.message}`);
                results.push({
                    contractId,
                    cachedData: null,
                    freshData: null,
                    hasImage: false,
                    imageUrl: null,
                    hasDescription: false,
                    hasIdentifier: false,
                    metadataScore: 0,
                    issues: [`Error: ${error.message}`]
                });
                console.log('');
            }
        }

        // Summary Analysis
        console.log('📊 VALIDATION RESULTS');
        console.log('═'.repeat(70));
        console.log(`Total tokens tested: ${results.length}`);
        console.log(`Tokens with images: ${tokensWithImages} (${((tokensWithImages/results.length)*100).toFixed(1)}%)`);
        console.log(`Tokens with descriptions: ${tokensWithDescriptions} (${((tokensWithDescriptions/results.length)*100).toFixed(1)}%)`);
        console.log(`Tokens with identifiers: ${tokensWithIdentifiers} (${((tokensWithIdentifiers/results.length)*100).toFixed(1)}%)`);
        console.log('');

        // Show tokens missing images
        const missingImages = results.filter(r => !r.hasImage);
        if (missingImages.length > 0) {
            console.log('❌ TOKENS MISSING IMAGES:');
            console.log('─'.repeat(70));
            missingImages.forEach((result, index) => {
                console.log(`${index + 1}. ${result.contractId}`);
                console.log(`   Score: ${result.metadataScore}/100`);
                console.log(`   Issues: ${result.issues.join(', ')}`);
                if (result.cachedData) {
                    console.log(`   Name: ${result.cachedData.name || 'N/A'}`);
                    console.log(`   Symbol: ${result.cachedData.symbol || 'N/A'}`);
                }
                console.log('');
            });
        }

        // Show tokens with images (success cases)
        const withImages = results.filter(r => r.hasImage);
        if (withImages.length > 0) {
            console.log('✅ TOKENS WITH IMAGES:');
            console.log('─'.repeat(70));
            withImages.slice(0, 5).forEach((result, index) => {
                console.log(`${index + 1}. ${result.contractId}`);
                console.log(`   Score: ${result.metadataScore}/100`);
                console.log(`   Image: ${result.imageUrl?.substring(0, 80)}${result.imageUrl && result.imageUrl.length > 80 ? '...' : ''}`);
                console.log('');
            });
            if (withImages.length > 5) {
                console.log(`... and ${withImages.length - 5} more tokens with images`);
                console.log('');
            }
        }

        // Analysis and recommendations
        console.log('🔍 ANALYSIS & RESOLUTION PLAN');
        console.log('═'.repeat(70));
        
        if (missingImages.length > 0) {
            console.log('❌ ISSUES IDENTIFIED:');
            console.log(`1. ${missingImages.length} tokens still missing images`);
            console.log(`2. Enhanced metadata system may not be reaching these tokens`);
            console.log(`3. Cache may not be properly updated for some tokens`);
            console.log('');
            
            console.log('🔧 RESOLUTION PLAN:');
            console.log('');
            console.log('STEP 1: Verify Enhanced Metadata Generation');
            console.log('  - Test cryptonomicon.getTokenMetadata() directly on problem tokens');
            console.log('  - Ensure fallback image generation is working');
            console.log('');
            console.log('STEP 2: Force Cache Refresh for Problem Tokens');
            console.log('  - Use forceRefresh=true for tokens missing images');
            console.log('  - Verify cache update actually saves the enhanced data');
            console.log('');
            console.log('STEP 3: Check Token Cache API Endpoints');
            console.log('  - Verify the cache API is serving updated data');
            console.log('  - Check if there are multiple cache layers causing issues');
            console.log('');
            console.log('STEP 4: Update Cache Management');
            console.log('  - Ensure proper cache invalidation');
            console.log('  - Fix any issues with cache key generation');
            console.log('');
            
            console.log('🚀 IMMEDIATE ACTIONS:');
            missingImages.slice(0, 5).forEach((result, index) => {
                console.log(`${index + 1}. Force refresh: ${result.contractId}`);
            });
            
            if (missingImages.length > 5) {
                console.log(`... and ${missingImages.length - 5} more tokens need force refresh`);
            }
        } else {
            console.log('✅ ALL TESTED TOKENS HAVE IMAGES!');
            console.log('The enhanced metadata system is working correctly.');
        }

        console.log('');
        console.log('💡 NEXT STEPS:');
        console.log('1. Run targeted fix for tokens missing images');
        console.log('2. Verify cache API endpoints are serving updated data');
        console.log('3. Test with the specific token mentioned: anime-demon-girl');
        console.log('4. Consider running full ecosystem scan if issues persist');

    } catch (error: any) {
        console.error('❌ Error during validation:', error.message);
    }
}

validateTokenImages();
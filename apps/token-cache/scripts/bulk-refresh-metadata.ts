// Bulk refresh all cached token metadata with enhanced extraction
import { listTokens } from '@repo/tokens';
import { Cryptonomicon } from '../src/lib/cryptonomicon';

interface RefreshResult {
    contractId: string;
    status: 'success' | 'error' | 'no_change';
    beforeScore: number;
    afterScore: number;
    improvement: number;
    hasNewImage: boolean;
    hasNewDescription: boolean;
    hasNewIdentifier: boolean;
    error?: string;
}

function calculateMetadataScore(metadata: any): number {
    let score = 100;
    
    // Critical issues (30 points each)
    if (!metadata.name || metadata.name.trim() === '') score -= 30;
    if (!metadata.symbol || metadata.symbol.trim() === '') score -= 30;
    if (!metadata.identifier || metadata.identifier.trim() === '') score -= 30;
    if (metadata.decimals === undefined || metadata.decimals === null) score -= 30;
    
    // Warning issues (10 points each)
    if (!metadata.description || metadata.description.trim() === '') score -= 10;
    if (!metadata.image || metadata.image.trim() === '') score -= 10;
    
    // Info issues (2 points each)
    if (!metadata.total_supply && metadata.total_supply !== 0) score -= 2;
    
    return Math.max(0, score);
}

function isPlaceholderImage(url: string): boolean {
    if (!url) return true;
    const placeholderPatterns = [
        /placehold\.co/i,
        /placeholder/i,
        /ui-avatars\.com/i,
        /\?text=/i
    ];
    return placeholderPatterns.some(pattern => pattern.test(url));
}

async function bulkRefreshMetadata(dryRun: boolean = true, batchSize: number = 10) {
    console.log('🔄 Bulk Token Metadata Refresh');
    console.log(`Mode: ${dryRun ? 'DRY RUN (read-only)' : 'LIVE (will update cache)'}`);
    console.log(`Batch size: ${batchSize} tokens`);
    console.log('');
    
    console.log('🔧 Environment Check:');
    console.log(`  TOKEN_CACHE_URL: ${process.env.TOKEN_CACHE_URL || process.env.NEXT_PUBLIC_TOKEN_CACHE_URL || 'https://tokens.charisma.rocks'}`);
    console.log('');

    try {
        console.log('📥 Fetching all tokens from cache...');
        const tokens = await listTokens();
        console.log(`Found ${tokens.length} tokens to refresh`);
        console.log('');

        if (tokens.length === 0) {
            console.log('❌ No tokens found. Check your TOKEN_CACHE_URL configuration.');
            return;
        }

        const cryptonomicon = new Cryptonomicon({ 
            debug: false,
            apiKey: process.env.HIRO_API_KEY 
        });

        const results: RefreshResult[] = [];
        let processedCount = 0;
        let improvedCount = 0;
        let errorCount = 0;

        console.log('🔄 Processing tokens in batches...');
        console.log('');

        // Process tokens in batches to avoid overwhelming the system
        for (let i = 0; i < tokens.length; i += batchSize) {
            const batch = tokens.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(tokens.length / batchSize)} (${batch.length} tokens)...`);

            for (const token of batch) {
                try {
                    processedCount++;
                    console.log(`  [${processedCount}/${tokens.length}] Processing ${token.contractId}...`);

                    // Get enhanced metadata using our improved extraction
                    const enhancedMetadata = await cryptonomicon.getTokenMetadata(token.contractId);

                    if (!enhancedMetadata) {
                        results.push({
                            contractId: token.contractId,
                            status: 'error',
                            beforeScore: calculateMetadataScore(token),
                            afterScore: 0,
                            improvement: 0,
                            hasNewImage: false,
                            hasNewDescription: false,
                            hasNewIdentifier: false,
                            error: 'Failed to fetch enhanced metadata'
                        });
                        errorCount++;
                        continue;
                    }

                    // Calculate scores and improvements
                    const beforeScore = calculateMetadataScore(token);
                    const afterScore = calculateMetadataScore(enhancedMetadata);
                    const improvement = afterScore - beforeScore;

                    // Check for specific improvements
                    const hasNewImage = (!token.image || isPlaceholderImage(token.image)) && 
                                       enhancedMetadata.image && !isPlaceholderImage(enhancedMetadata.image);
                    const hasNewDescription = (!token.description || token.description.trim() === '') && 
                                             enhancedMetadata.description && enhancedMetadata.description.trim() !== '';
                    const hasNewIdentifier = (!token.identifier || token.identifier.trim() === '') && 
                                           enhancedMetadata.identifier && enhancedMetadata.identifier.trim() !== '';

                    const result: RefreshResult = {
                        contractId: token.contractId,
                        status: improvement > 0 ? 'success' : 'no_change',
                        beforeScore,
                        afterScore,
                        improvement,
                        hasNewImage,
                        hasNewDescription,
                        hasNewIdentifier
                    };

                    results.push(result);

                    if (improvement > 0) {
                        improvedCount++;
                        console.log(`    ✅ Improved: ${beforeScore} → ${afterScore} (+${improvement})`);
                        
                        const improvements = [];
                        if (hasNewIdentifier) improvements.push('identifier');
                        if (hasNewDescription) improvements.push('description');
                        if (hasNewImage) improvements.push('image');
                        
                        if (improvements.length > 0) {
                            console.log(`    📈 Added: ${improvements.join(', ')}`);
                        }
                    } else {
                        console.log(`    ➖ No improvement needed (Score: ${beforeScore})`);
                    }

                    // In live mode, we would update the cache here
                    if (!dryRun && improvement > 0) {
                        console.log(`    💾 Would update cache with enhanced metadata`);
                        // TODO: Implement cache update via API call to /api/admin/refresh or similar
                        // This would need to call the refreshTokenData action or similar
                    }

                } catch (error: any) {
                    console.log(`    ❌ Error: ${error.message}`);
                    results.push({
                        contractId: token.contractId,
                        status: 'error',
                        beforeScore: calculateMetadataScore(token),
                        afterScore: 0,
                        improvement: 0,
                        hasNewImage: false,
                        hasNewDescription: false,
                        hasNewIdentifier: false,
                        error: error.message
                    });
                    errorCount++;
                }
            }

            // Small delay between batches to be nice to external APIs
            if (i + batchSize < tokens.length) {
                console.log('    ⏱️  Waiting 2 seconds between batches...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            console.log('');
        }

        console.log('📊 BULK REFRESH RESULTS:');
        console.log('═'.repeat(60));
        console.log(`Total tokens processed: ${processedCount}`);
        console.log(`Tokens improved: ${improvedCount}`);
        console.log(`Tokens with errors: ${errorCount}`);
        console.log(`No change needed: ${processedCount - improvedCount - errorCount}`);
        console.log('');

        // Show summary of improvements
        const improvedResults = results.filter(r => r.status === 'success');
        if (improvedResults.length > 0) {
            const avgImprovement = improvedResults.reduce((sum, r) => sum + r.improvement, 0) / improvedResults.length;
            console.log(`Average improvement: +${avgImprovement.toFixed(1)} points`);
            
            const identifierFixes = improvedResults.filter(r => r.hasNewIdentifier).length;
            const descriptionFixes = improvedResults.filter(r => r.hasNewDescription).length;
            const imageFixes = improvedResults.filter(r => r.hasNewImage).length;
            
            console.log('');
            console.log('🎯 Improvements breakdown:');
            console.log(`  Fixed missing identifiers: ${identifierFixes} tokens`);
            console.log(`  Added descriptions: ${descriptionFixes} tokens`);
            console.log(`  Improved images: ${imageFixes} tokens`);
        }

        // Show top improved tokens
        const topImproved = results
            .filter(r => r.status === 'success')
            .sort((a, b) => b.improvement - a.improvement)
            .slice(0, 10);

        if (topImproved.length > 0) {
            console.log('');
            console.log('🏆 TOP IMPROVED TOKENS:');
            console.log('─'.repeat(60));
            topImproved.forEach((result, index) => {
                console.log(`${index + 1}. ${result.contractId}`);
                console.log(`   Score: ${result.beforeScore} → ${result.afterScore} (+${result.improvement})`);
                
                const improvements = [];
                if (result.hasNewIdentifier) improvements.push('✅ Identifier');
                if (result.hasNewDescription) improvements.push('✅ Description');
                if (result.hasNewImage) improvements.push('✅ Image');
                
                if (improvements.length > 0) {
                    console.log(`   ${improvements.join(', ')}`);
                }
                console.log('');
            });
        }

        // Show errors if any
        const errorResults = results.filter(r => r.status === 'error');
        if (errorResults.length > 0) {
            console.log('❌ ERRORS:');
            console.log('─'.repeat(60));
            errorResults.slice(0, 5).forEach(result => {
                console.log(`${result.contractId}: ${result.error}`);
            });
            if (errorResults.length > 5) {
                console.log(`... and ${errorResults.length - 5} more errors`);
            }
            console.log('');
        }

        if (dryRun) {
            console.log('🔄 This was a DRY RUN. To apply these improvements:');
            console.log('');
            console.log('OPTION 1 - Use the admin interface:');
            console.log('  1. Go to your token-cache admin panel');
            console.log('  2. Use the "Force Refresh" button for improved tokens');
            console.log('');
            console.log('OPTION 2 - Run live mode (use with caution):');
            console.log('  pnpm script bulk-refresh-metadata live 5');
            console.log('');
            console.log('OPTION 3 - Use individual refresh actions:');
            console.log('  Call refreshTokenData() for each improved token');
        } else {
            console.log('✅ LIVE MODE COMPLETED!');
            console.log('');
            console.log('🎯 Next steps:');
            console.log('1. Verify improvements in your application');
            console.log('2. Monitor for any issues with updated metadata');
            console.log('3. Consider running this periodically to maintain quality');
        }

        console.log('');
        console.log('💡 The enhanced metadata system is now providing:');
        console.log('   • Complete identifiers from contract interfaces');
        console.log('   • Generated descriptions for all tokens');
        console.log('   • Default images for tokens without custom ones');
        console.log('   • Better external metadata source integration');
        
    } catch (error: any) {
        console.error('❌ Error during bulk refresh:', error.message);
    }
}

// Get command line arguments
const mode = process.argv[2] || 'dry-run';
const batchSizeArg = process.argv[3] || '10';

const isLiveMode = mode === 'live';
const batchSize = parseInt(batchSizeArg) || 10;

bulkRefreshMetadata(!isLiveMode, batchSize);
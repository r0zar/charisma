// Refresh only tokens that show significant improvements in metadata
import { listTokens } from '@repo/tokens';
import { Cryptonomicon } from '../src/lib/cryptonomicon';

interface TokenRefreshCandidate {
    contractId: string;
    currentScore: number;
    potentialScore: number;
    improvement: number;
    missingFields: string[];
    shouldRefresh: boolean;
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

function getMissingFields(metadata: any): string[] {
    const missing = [];
    if (!metadata.identifier || metadata.identifier.trim() === '') missing.push('identifier');
    if (!metadata.description || metadata.description.trim() === '') missing.push('description');
    if (!metadata.image || metadata.image.trim() === '') missing.push('image');
    return missing;
}

async function identifyRefreshCandidates() {
    console.log('🔍 Identifying Tokens That Need Cache Refresh');
    console.log('');
    
    try {
        console.log('📥 Fetching all tokens from cache...');
        const tokens = await listTokens();
        console.log(`Found ${tokens.length} tokens to analyze`);
        console.log('');

        const cryptonomicon = new Cryptonomicon({ 
            debug: false,
            apiKey: process.env.HIRO_API_KEY 
        });

        const candidates: TokenRefreshCandidate[] = [];
        let analyzedCount = 0;

        console.log('🔄 Analyzing tokens for improvement potential...');
        console.log('');

        // Sample a subset of tokens that are likely to need refreshing
        const priorityTokens = tokens.filter(token => {
            const score = calculateMetadataScore(token);
            const missingFields = getMissingFields(token);
            // Focus on tokens with missing critical fields or low scores
            return score < 100 || missingFields.length > 0;
        });

        console.log(`Found ${priorityTokens.length} tokens that might benefit from refresh`);
        console.log('');

        for (const token of priorityTokens.slice(0, 20)) { // Limit to first 20 for testing
            try {
                analyzedCount++;
                console.log(`[${analyzedCount}/${Math.min(20, priorityTokens.length)}] Analyzing ${token.contractId}...`);

                const currentScore = calculateMetadataScore(token);
                const currentMissing = getMissingFields(token);

                // Get what the enhanced metadata would look like
                const enhancedMetadata = await cryptonomicon.getTokenMetadata(token.contractId);
                
                if (!enhancedMetadata) {
                    console.log(`  ❌ Could not fetch enhanced metadata`);
                    continue;
                }

                const potentialScore = calculateMetadataScore(enhancedMetadata);
                const improvement = potentialScore - currentScore;

                const candidate: TokenRefreshCandidate = {
                    contractId: token.contractId,
                    currentScore,
                    potentialScore,
                    improvement,
                    missingFields: currentMissing,
                    shouldRefresh: improvement >= 10 // Only refresh if significant improvement
                };

                candidates.push(candidate);

                if (candidate.shouldRefresh) {
                    console.log(`  ✅ SHOULD REFRESH: ${currentScore} → ${potentialScore} (+${improvement})`);
                    console.log(`     Would fix: ${currentMissing.join(', ')}`);
                } else {
                    console.log(`  ➖ No significant improvement: ${currentScore} → ${potentialScore} (+${improvement})`);
                }

                // Small delay to be nice to APIs
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error: any) {
                console.log(`  ❌ Error analyzing ${token.contractId}: ${error.message}`);
            }
        }

        // Generate results
        const shouldRefresh = candidates.filter(c => c.shouldRefresh);
        const noRefreshNeeded = candidates.filter(c => !c.shouldRefresh);

        console.log('');
        console.log('📊 ANALYSIS RESULTS:');
        console.log('═'.repeat(60));
        console.log(`Total analyzed: ${candidates.length}`);
        console.log(`Should refresh: ${shouldRefresh.length}`);
        console.log(`No refresh needed: ${noRefreshNeeded.length}`);
        console.log('');

        if (shouldRefresh.length > 0) {
            console.log('🎯 TOKENS RECOMMENDED FOR REFRESH:');
            console.log('─'.repeat(60));
            
            // Sort by improvement potential
            shouldRefresh
                .sort((a, b) => b.improvement - a.improvement)
                .forEach((candidate, index) => {
                    console.log(`${index + 1}. ${candidate.contractId}`);
                    console.log(`   Score improvement: ${candidate.currentScore} → ${candidate.potentialScore} (+${candidate.improvement})`);
                    console.log(`   Will fix: ${candidate.missingFields.join(', ')}`);
                    console.log('');
                });

            console.log('');
            console.log('💡 HOW TO REFRESH THESE TOKENS:');
            console.log('');
            console.log('Option 1 - Admin Interface:');
            console.log('  Go to your token-cache admin panel and use "Force Refresh" for each token');
            console.log('');
            console.log('Option 2 - API Calls:');
            console.log('  Use the refreshTokenData action for each contract ID');
            console.log('');
            console.log('Option 3 - Inspection Interface:');
            console.log('  Use the inspect page and force refresh button for each token');
            console.log('');
            console.log('🚀 PRIORITY REFRESH COMMANDS:');
            console.log('Copy and run these in your admin interface or via API:');
            console.log('');
            
            shouldRefresh.slice(0, 10).forEach(candidate => {
                console.log(`refreshTokenData("${candidate.contractId}"); // +${candidate.improvement} points`);
            });

            if (shouldRefresh.length > 10) {
                console.log(`... and ${shouldRefresh.length - 10} more tokens`);
            }
        } else {
            console.log('✅ All analyzed tokens already have good metadata!');
            console.log('The enhanced metadata system is working well.');
        }

        console.log('');
        console.log('🎯 SUMMARY:');
        console.log(`The cache refresh will improve ${shouldRefresh.length} tokens`);
        console.log(`Average improvement: +${shouldRefresh.length > 0 ? (shouldRefresh.reduce((sum, c) => sum + c.improvement, 0) / shouldRefresh.length).toFixed(1) : 0} points`);
        console.log('');
        console.log('🔄 Next steps:');
        console.log('1. Refresh the recommended tokens using your preferred method');
        console.log('2. Verify improvements in your applications');  
        console.log('3. Consider setting up automated refresh for low-scoring tokens');
        
    } catch (error: any) {
        console.error('❌ Error during analysis:', error.message);
    }
}

identifyRefreshCandidates();
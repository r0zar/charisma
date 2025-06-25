// Audit to identify tokens with real images vs generated fallbacks
import { listTokens } from '@repo/tokens';

interface ImageAuditResult {
    contractId: string;
    name: string;
    symbol: string;
    imageUrl: string;
    imageType: 'real' | 'generated' | 'missing';
    isUIAvatar: boolean;
    isPlaceholder: boolean;
    hasCustomDomain: boolean;
    needsRecovery: boolean;
}

function analyzeImageType(imageUrl: string): {
    imageType: 'real' | 'generated' | 'missing';
    isUIAvatar: boolean;
    isPlaceholder: boolean;
    hasCustomDomain: boolean;
    needsRecovery: boolean;
} {
    if (!imageUrl || imageUrl.trim() === '') {
        return {
            imageType: 'missing',
            isUIAvatar: false,
            isPlaceholder: false,
            hasCustomDomain: false,
            needsRecovery: true
        };
    }

    // Check for UI-Avatars (our generated fallbacks)
    const isUIAvatar = imageUrl.includes('ui-avatars.com');
    
    // Check for placeholder services
    const isPlaceholder = /placehold\.co|placeholder|via\.placeholder|dummyimage\.com/i.test(imageUrl);
    
    // Check for custom domains that would indicate real images
    const hasCustomDomain = /charisma\.rocks|ipfs|githubusercontent|amazonaws|cloudfront|vercel|cdn\./i.test(imageUrl) && !isUIAvatar && !isPlaceholder;
    
    // Determine if this needs recovery
    const needsRecovery = isUIAvatar || isPlaceholder || imageUrl.includes('?text=');
    
    let imageType: 'real' | 'generated' | 'missing' = 'missing';
    if (isUIAvatar || isPlaceholder) {
        imageType = 'generated';
    } else if (hasCustomDomain || imageUrl.startsWith('http')) {
        imageType = 'real';
    }

    return {
        imageType,
        isUIAvatar,
        isPlaceholder,
        hasCustomDomain,
        needsRecovery
    };
}

async function auditRealVsGeneratedImages() {
    console.log('🔍 Auditing Real vs Generated Images in Token Metadata');
    console.log('═'.repeat(70));
    console.log('');

    try {
        console.log('📥 Fetching all tokens...');
        const tokens = await listTokens();
        console.log(`Found ${tokens.length} tokens to audit`);
        console.log('');

        const results: ImageAuditResult[] = [];
        let realImages = 0;
        let generatedImages = 0;
        let missingImages = 0;
        let needsRecovery = 0;

        console.log('🔍 Analyzing image types...');
        console.log('');

        for (const token of tokens) {
            const analysis = analyzeImageType(token.image);
            
            const result: ImageAuditResult = {
                contractId: token.contractId,
                name: token.name || 'Unknown',
                symbol: token.symbol || 'UNK',
                imageUrl: token.image || '',
                ...analysis
            };

            results.push(result);

            if (analysis.imageType === 'real') realImages++;
            else if (analysis.imageType === 'generated') generatedImages++;
            else missingImages++;

            if (analysis.needsRecovery) needsRecovery++;

            // Show progress for first few and problematic ones
            if (results.length <= 10 || analysis.needsRecovery) {
                const status = analysis.imageType === 'real' ? '✅' : 
                             analysis.imageType === 'generated' ? '⚠️' : '❌';
                console.log(`${status} ${token.contractId}`);
                console.log(`   Name: ${result.name} (${result.symbol})`);
                console.log(`   Image: ${analysis.imageType} - ${token.image?.substring(0, 80)}...`);
                if (analysis.needsRecovery) {
                    console.log(`   🔧 NEEDS RECOVERY: ${analysis.isUIAvatar ? 'UI-Avatar' : 'Placeholder'}`);
                }
                console.log('');
            }
        }

        // Summary Report
        console.log('📊 IMAGE AUDIT RESULTS');
        console.log('═'.repeat(70));
        console.log(`Total tokens analyzed: ${tokens.length}`);
        console.log(`Real images: ${realImages} (${((realImages/tokens.length)*100).toFixed(1)}%)`);
        console.log(`Generated/fallback images: ${generatedImages} (${((generatedImages/tokens.length)*100).toFixed(1)}%)`);
        console.log(`Missing images: ${missingImages} (${((missingImages/tokens.length)*100).toFixed(1)}%)`);
        console.log(`Tokens needing recovery: ${needsRecovery} (${((needsRecovery/tokens.length)*100).toFixed(1)}%)`);
        console.log('');

        // Show tokens that need recovery
        const tokensNeedingRecovery = results.filter(r => r.needsRecovery);
        if (tokensNeedingRecovery.length > 0) {
            console.log('🚨 TOKENS NEEDING IMAGE RECOVERY:');
            console.log('─'.repeat(70));
            
            tokensNeedingRecovery.slice(0, 20).forEach((token, index) => {
                console.log(`${index + 1}. ${token.contractId}`);
                console.log(`   Name: ${token.name} (${token.symbol})`);
                console.log(`   Current: ${token.isUIAvatar ? 'UI-Avatar' : 'Placeholder'}`);
                console.log(`   URL: ${token.imageUrl.substring(0, 60)}...`);
                console.log('');
            });

            if (tokensNeedingRecovery.length > 20) {
                console.log(`... and ${tokensNeedingRecovery.length - 20} more tokens need recovery`);
                console.log('');
            }
        }

        // Show tokens with real images (the good ones)
        const tokensWithRealImages = results.filter(r => r.imageType === 'real');
        if (tokensWithRealImages.length > 0) {
            console.log('✅ TOKENS WITH REAL IMAGES (examples):');
            console.log('─'.repeat(70));
            
            tokensWithRealImages.slice(0, 10).forEach((token, index) => {
                console.log(`${index + 1}. ${token.contractId}`);
                console.log(`   Name: ${token.name} (${token.symbol})`);
                console.log(`   Real image: ${token.imageUrl.substring(0, 60)}...`);
                console.log('');
            });

            if (tokensWithRealImages.length > 10) {
                console.log(`... and ${tokensWithRealImages.length - 10} more tokens have real images`);
                console.log('');
            }
        }

        // Damage assessment
        console.log('💥 DAMAGE ASSESSMENT:');
        console.log('─'.repeat(30));
        
        if (needsRecovery > tokens.length * 0.5) {
            console.log('🚨 CRITICAL: Over 50% of tokens have generated/fallback images');
            console.log('   This suggests widespread overwriting of real images');
        } else if (needsRecovery > tokens.length * 0.25) {
            console.log('⚠️  SIGNIFICANT: Over 25% of tokens have generated/fallback images');
            console.log('   Substantial image recovery needed');
        } else {
            console.log('ℹ️  MODERATE: Less than 25% of tokens need image recovery');
        }

        console.log('');
        console.log('🔧 RECOVERY RECOMMENDATIONS:');
        console.log('─'.repeat(40));
        console.log('1. 🔍 Investigate when/how real images were overwritten');
        console.log('2. 📦 Check if backups of original metadata exist');
        console.log('3. 🎨 Identify original image sources for major tokens');
        console.log('4. 🔄 Restore real images to charisma.rocks metadata API');
        console.log('5. 🛡️  Implement safeguards to prevent future overwrites');
        console.log('6. ✅ Verify restored images work across ecosystem');

        return {
            totalTokens: tokens.length,
            realImages,
            generatedImages,
            missingImages,
            needsRecovery,
            tokensNeedingRecovery: tokensNeedingRecovery.map(t => t.contractId)
        };

    } catch (error: any) {
        console.error('❌ Error during image audit:', error.message);
        return null;
    }
}

// Export for use in recovery planning
export { auditRealVsGeneratedImages, analyzeImageType };

// Run the audit
auditRealVsGeneratedImages().then(results => {
    if (results) {
        console.log('');
        console.log('📋 AUDIT COMPLETE');
        console.log(`Recovery needed for ${results.needsRecovery} tokens out of ${results.totalTokens}`);
    }
});